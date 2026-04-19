import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const BUCKET = "waypoints"; // reuse existing bucket

// ── Haversine distance (metres) ───────────────────────────────────────────────
function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(lat2 - lat1);
  const dLon = toR(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Resolve segment + order_index from GPS coords ─────────────────────────────
// Walks the route's segments in order, finds the nearest track point,
// and returns both the segment ID and the cumulative distance from the
// route start (used as order_index so photos sort by trail position).
async function resolvePhotoMeta(
  routeId: number,
  lat: number,
  lon: number,
): Promise<{ segmentId: number | null; distM: number; orderIndex: number }> {
  const { data: route } = await supabaseAdmin
    .from("routes")
    .select("segment_ids")
    .eq("id", routeId)
    .single();

  if (!route?.segment_ids?.length) return { segmentId: null, distM: Infinity, orderIndex: 999_999 };

  const { data: segments } = await supabaseAdmin
    .from("segments")
    .select("id, track_data, segment_type, bus_details, is_bus_combined")
    .in("id", route.segment_ids);

  if (!segments?.length) return { segmentId: null, distM: Infinity, orderIndex: 999_999 };

  // Preserve the route's declared segment order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const segMap = new Map(segments.map(s => [s.id as number, s as any]));
  const orderedSegs = (route.segment_ids as number[])
    .map(id => segMap.get(id))
    .filter(Boolean);

  let cumDist = 0;
  let bestSegId: number | null = null;
  let bestDist = Infinity;
  let bestCumDist = 999_999;
  let prevCoord: [number, number] | null = null; // [lon, lat]

  for (const seg of orderedSegs) {
    const walkPoints = (seg.track_data?.coordinates ?? []) as [number, number, number][];
    const busPoints  = (seg.bus_details?.bus_track_data?.coordinates ?? []) as [number, number, number][];

    let combined: [number, number, number][] = [];
    if (seg.is_bus_combined) {
      if (seg.segment_type === "APPROACH") {
        combined = [...busPoints, ...walkPoints];
      } else if (seg.segment_type === "RETURN") {
        combined = [...walkPoints, ...busPoints];
      } else {
        combined = walkPoints;
      }
    } else {
      combined = walkPoints;
    }

    for (const [sLon, sLat] of combined) {
      if (prevCoord) {
        cumDist += haversineM(prevCoord[1], prevCoord[0], sLat, sLon);
      }
      const d = haversineM(lat, lon, sLat, sLon);
      if (d < bestDist) {
        bestDist    = d;
        bestSegId   = seg.id as number;
        bestCumDist = Math.round(cumDist);
      }
      prevCoord = [sLon, sLat];
    }
  }

  return { segmentId: bestSegId, distM: bestDist, orderIndex: bestCumDist };
}

// ── Row normaliser ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPhoto(row: any) {
  return {
    id:            row.id,
    routeId:       row.route_id,
    segmentId:     row.segment_id ?? null,
    lat:           row.lat ?? null,
    lon:           row.lon ?? null,
    url:           row.url,
    descriptionEn: row.description_en ?? null,
    descriptionKo: row.description_ko ?? null,
    orderIndex:    row.order_index ?? 0,
    createdAt:     row.created_at,
  };
}

// ── GET /api/admin/route-photos?routeId=X ────────────────────────────────────
export async function GET(req: NextRequest) {
  const routeId = req.nextUrl.searchParams.get("routeId");
  if (!routeId) return NextResponse.json({ error: "routeId required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("route_photos")
    .select("*")
    .eq("route_id", parseInt(routeId))
    .order("order_index", { ascending: true })
    .order("id", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map(toPhoto));
}

// ── POST /api/admin/route-photos ──────────────────────────────────────────────
// Accepts multipart/form-data:
//   routeId          — number (string)
//   photo_{i}        — File (WebP blob, already resized client-side)
//   lat_{i}          — string  (EXIF lat, may be empty)
//   lon_{i}          — string  (EXIF lon, may be empty)
//   name_{i}         — string  (original filename for storage path)
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const routeId = parseInt((form.get("routeId") as string) ?? "");
    if (!routeId) return NextResponse.json({ error: "routeId required" }, { status: 400 });

    // Collect all photo slots (photo_0, photo_1, …)
    const results = [];
    let i = 0;
    while (form.has(`photo_${i}`)) {
      const file   = form.get(`photo_${i}`) as File;
      const latRaw = (form.get(`lat_${i}`) as string | null) ?? "";
      const lonRaw = (form.get(`lon_${i}`) as string | null) ?? "";
      const name   = (form.get(`name_${i}`) as string | null) ?? file.name;
      i++;

      if (!file || !file.type.startsWith("image/")) continue;

      const lat = latRaw ? parseFloat(latRaw) : null;
      const lon = lonRaw ? parseFloat(lonRaw) : null;
      const hasGps = lat !== null && lon !== null && isFinite(lat) && isFinite(lon);

      // Build storage path
      const safeName = name
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 60);
      const storagePath = `photos/${routeId}/${safeName}_${Date.now()}.webp`;

      // Upload to Supabase Storage
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error: uploadErr } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(storagePath, buffer, { contentType: "image/webp", upsert: false });

      if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

      const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);
      const url = urlData.publicUrl;

      // Auto-map to nearest segment + resolve order_index (100m threshold)
      const THRESHOLD_M = 100;
      let segmentId: number | null = null;
      let autoMapped = false;
      let orderIndex = 999_999;
      if (hasGps) {
        const { segmentId: sid, distM, orderIndex: oi } = await resolvePhotoMeta(routeId, lat!, lon!);
        orderIndex = oi;
        if (distM <= THRESHOLD_M) {
          segmentId = sid;
          autoMapped = true;
        }
      }

      // Insert to DB
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("route_photos")
        .insert({
          route_id:   routeId,
          segment_id: segmentId,
          lat:        hasGps ? lat : null,
          lon:        hasGps ? lon : null,
          url,
          order_index: orderIndex,
        })
        .select("*")
        .single();

      if (insertErr) throw new Error(`DB insert failed: ${insertErr.message}`);

      results.push({ ...toPhoto(inserted), autoMapped, distM: autoMapped ? undefined : null });
    }

    return NextResponse.json({ photos: results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}

// ── PATCH /api/admin/route-photos ─────────────────────────────────────────────
// Body: { id, description_en?, description_ko?, segment_id? }
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();

    // Support bulk reorder if body is an array
    if (Array.isArray(body)) {
      const results = [];
      for (const item of body) {
        if (!item.id) continue;
        const { data, error } = await supabaseAdmin
          .from("route_photos")
          .update({ order_index: item.order_index })
          .eq("id", item.id)
          .select("*")
          .single();
        if (!error) results.push(toPhoto(data));
      }
      return NextResponse.json({ photos: results });
    }

    const { id, description_en, description_ko, segment_id, order_index, recalculate } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const patch: Record<string, unknown> = {};
    if (description_en !== undefined) patch.description_en = description_en;
    if (description_ko !== undefined) patch.description_ko = description_ko;
    if (segment_id     !== undefined) patch.segment_id     = segment_id;
    if (order_index    !== undefined) patch.order_index    = order_index;

    // Handle recalculation request
    if (recalculate) {
      const { data: photo } = await supabaseAdmin.from("route_photos").select("route_id, lat, lon").eq("id", id).single();
      if (photo?.lat && photo?.lon) {
        const { segmentId: sid, orderIndex: oi } = await resolvePhotoMeta(photo.route_id, photo.lat, photo.lon);
        patch.segment_id = sid;
        patch.order_index = oi;
      }
    }

    const { data, error } = await supabaseAdmin
      .from("route_photos")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(toPhoto(data));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 },
    );
  }
}

// ── DELETE /api/admin/route-photos?id=X ──────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const id = parseInt(req.nextUrl.searchParams.get("id") ?? "");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    // Fetch the row to get the storage path
    const { data: photo, error: fetchErr } = await supabaseAdmin
      .from("route_photos")
      .select("url")
      .eq("id", id)
      .single();

    if (fetchErr || !photo) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Extract storage path from public URL
    const urlStr: string = photo.url;
    const bucketMarker = `/storage/v1/object/public/${BUCKET}/`;
    const pathStart = urlStr.indexOf(bucketMarker);
    if (pathStart !== -1) {
      const storagePath = urlStr.slice(pathStart + bucketMarker.length);
      await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
    }

    const { error: deleteErr } = await supabaseAdmin
      .from("route_photos")
      .delete()
      .eq("id", id);

    if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 },
    );
  }
}
