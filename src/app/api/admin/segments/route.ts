import { NextRequest, NextResponse } from "next/server";
import { DOMParser } from "@xmldom/xmldom";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type TrackPoint = [number, number, number]; // [lon, lat, ele]

function parseGeoJson(text: string): TrackPoint[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let geojson: any;
  try { geojson = JSON.parse(text); } catch { throw new Error("Invalid GeoJSON file"); }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function extractCoords(g: any): number[][] {
    const t = g?.type;
    if (t === "FeatureCollection") {
      for (const f of g.features ?? []) { const c = extractCoords(f); if (c.length) return c; }
      return [];
    }
    if (t === "Feature")         return extractCoords(g.geometry);
    if (t === "LineString")      return g.coordinates ?? [];
    if (t === "MultiLineString") return (g.coordinates as number[][][] ?? []).flat();
    return [];
  }

  const coords = extractCoords(geojson);
  if (coords.length === 0) throw new Error("No LineString coordinates found in GeoJSON");

  return coords.map((c) => {
    const lon = c[0], lat = c[1], ele = c[2] ?? 0;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      throw new Error(`Invalid coordinates: lon=${lon}, lat=${lat}`);
    }
    return [
      Math.round(lon * 1_000_000) / 1_000_000,
      Math.round(lat * 1_000_000) / 1_000_000,
      Math.round(ele * 10) / 10,
    ] as TrackPoint;
  });
}

function parseGpx(xml: string): TrackPoint[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const trkpts = Array.from(doc.getElementsByTagName("trkpt"));
  const wpts   = Array.from(doc.getElementsByTagName("wpt"));
  const nodes  = trkpts.length > 0 ? trkpts : wpts;

  if (nodes.length === 0) throw new Error("No track points found in GPX file");

  return nodes.map((node) => {
    const lat = parseFloat(node.getAttribute("lat") ?? "");
    const lon = parseFloat(node.getAttribute("lon") ?? "");
    const ele = parseFloat(node.getElementsByTagName("ele")[0]?.textContent?.trim() ?? "0") || 0;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error(`Invalid coordinates: lat=${lat}, lon=${lon}`);
    }
    return [
      Math.round(lon * 1_000_000) / 1_000_000,
      Math.round(lat * 1_000_000) / 1_000_000,
      Math.round(ele * 10) / 10,
    ] as TrackPoint;
  });
}

function haversineM(lon1: number, lat1: number, lon2: number, lat2: number) {
  const R  = 6_371_000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function computeStats(points: TrackPoint[]) {
  let distM = 0, ascM = 0, descM = 0;
  for (let i = 1; i < points.length; i++) {
    distM += haversineM(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
    const dEle = points[i][2] - points[i - 1][2];
    if (dEle > 0) ascM  += dEle;
    else          descM -= dEle;
  }
  return {
    distance_m:      Math.round(distM),
    total_ascent_m:  Math.round(ascM),
    total_descent_m: Math.round(descM),
  };
}

// GET /api/admin/segments?mountainId=X[&type=APPROACH]
export async function GET(req: NextRequest) {
  const mountainId  = req.nextUrl.searchParams.get("mountainId");
  const segmentType = req.nextUrl.searchParams.get("type");
  if (!mountainId) return NextResponse.json({ error: "mountainId is required" }, { status: 400 });

  let query = supabaseAdmin
    .from("segments")
    .select(`
      id, slug, name, segment_type,
      start_waypoint_id, end_waypoint_id,
      distance_m, total_ascent_m, total_descent_m,
      estimated_time_min, difficulty,
      is_bus_combined, bus_details,
      start_wp:start_waypoint_id(name),
      end_wp:end_waypoint_id(name)
    `)
    .eq("mountain_id", mountainId)
    .order("id");

  if (segmentType) query = query.eq("segment_type", segmentType.toUpperCase()) as typeof query;

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Flatten waypoint names for convenience
  const result = (data ?? []).map((seg: any) => ({
    ...seg,
    start_wp_name:    seg.start_wp?.name?.en ?? null,
    start_wp_name_ko: seg.start_wp?.name?.ko ?? null,
    end_wp_name:      seg.end_wp?.name?.en ?? null,
    end_wp_name_ko:   seg.end_wp?.name?.ko ?? null,
  }));

  return NextResponse.json(result);
}

// PATCH /api/admin/segments — FormData; all fields optional except id
export async function PATCH(req: NextRequest) {
  const form             = await req.formData();
  const id               = parseInt(form.get("id") as string);
  const segmentType      = (form.get("segmentType") as string | null)?.trim().toUpperCase();
  const startWaypointId  = parseInt(form.get("startWaypointId") as string) || null;
  const endWaypointId    = parseInt(form.get("endWaypointId")   as string) || null;
  const estimatedTimeMin = parseInt(form.get("estimatedTimeMin") as string) || null;
  const difficulty       = parseInt(form.get("difficulty")       as string) || null;
  const gpxFile          = form.get("gpx");
  const isBusCombined      = form.get("isBusCombined") === "true";
  const busGpxFile         = form.get("busGpx");
  const midWaypointId      = parseInt(form.get("midWaypointId") as string) || null;
  const busType            = form.get("busType")            as string | null;
  const busNumber          = form.get("busNumber")          as string | null;
  const busColor           = form.get("busColor")           as string | null;
  const stationBusStopName = (form.get("stationBusStopName") as string | null)?.trim() || null;
  const busInstruction     = (form.get("busInstruction")     as string | null)?.trim() || null;
  const busDurationMin     = parseInt(form.get("busDurationMin") as string) || null;
  const nameEn             = (form.get("nameEn") as string | null)?.trim() || null;
  const nameKo             = (form.get("nameKo") as string | null)?.trim() || null;

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (segmentType)      updates.segment_type      = segmentType;
  if (startWaypointId)  updates.start_waypoint_id = startWaypointId;
  if (endWaypointId)    updates.end_waypoint_id   = endWaypointId;
  updates.estimated_time_min = estimatedTimeMin;
  updates.difficulty         = difficulty;
  
  if (nameEn || nameKo) {
    updates.name = { en: nameEn, ko: nameKo };
  }

  // Walk GPX
  if (gpxFile instanceof File && gpxFile.size > 0) {
    const text   = await gpxFile.text();
    const points = gpxFile.name.toLowerCase().endsWith(".geojson") ? parseGeoJson(text) : parseGpx(text);
    const stats  = computeStats(points);
    updates.track_data      = { type: "LineString", coordinates: points };
    updates.distance_m      = stats.distance_m;
    updates.total_ascent_m  = stats.total_ascent_m;
    updates.total_descent_m = stats.total_descent_m;
  }

  // Bus combined
  updates.is_bus_combined = isBusCombined;
  if (isBusCombined) {
    // Fetch existing bus_details to preserve bus_track_data if no new busGpx
    let busTrackData: unknown = null;
    if (busGpxFile instanceof File && busGpxFile.size > 0) {
      const busText   = await busGpxFile.text();
      const busPoints = busGpxFile.name.toLowerCase().endsWith(".geojson") ? parseGeoJson(busText) : parseGpx(busText);
      busTrackData = { type: "LineString", coordinates: busPoints };
    } else {
      // Keep existing bus_track_data from DB
      const { data } = await supabaseAdmin.from("segments").select("bus_details").eq("id", id).single();
      busTrackData = (data?.bus_details as Record<string, unknown> | null)?.bus_track_data ?? null;
    }
    updates.bus_details = {
      bus_stop_id_key:       midWaypointId ? String(midWaypointId) : undefined,
      bus_numbers:           busNumber ? [busNumber] : [],
      route_color:           busColor,
      bus_track_data:        busTrackData,
      station_bus_stop_name: stationBusStopName,
      instruction:           busInstruction,
      ...(busDurationMin != null ? { bus_duration_min: busDurationMin } : {}),
    };
    updates.sub_segments = segmentType === "APPROACH"
      ? [{ mode: "bus" }, { mode: "walk" }]
      : [{ mode: "walk" }, { mode: "bus" }];
  } else {
    updates.bus_details  = null;
    updates.sub_segments = null;
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("segments")
    .update(updates)
    .eq("id", id)
    .select("id, slug, name, segment_type, start_waypoint_id, end_waypoint_id, distance_m, total_ascent_m, total_descent_m, estimated_time_min, difficulty, is_bus_combined, bus_details")
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  try {
    const { revalidateTag } = await import("next/cache");
    revalidateTag("route-detail", {});
    revalidateTag("route-list", {});
  } catch (e) {
    console.error("[segments] Revalidation failed", e);
  }

  return NextResponse.json(updated);
}

// DELETE /api/admin/segments?id=X
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await supabaseAdmin.from("segments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const { revalidateTag } = await import("next/cache");
    revalidateTag("route-detail", {});
    revalidateTag("route-list", {});
  } catch (e) {
    console.error("[segments] Revalidation failed", e);
  }

  return NextResponse.json({ ok: true });
}

// POST /api/admin/segments — FormData with GPX
export async function POST(req: NextRequest) {
  try {
    const form            = await req.formData();
    const gpxFile         = form.get("gpx");
    const mountainId      = parseInt(form.get("mountainId")      as string);
    const segmentType     = (form.get("segmentType")     as string)?.trim().toUpperCase();
    const startWaypointId = parseInt(form.get("startWaypointId") as string);
    const endWaypointId   = parseInt(form.get("endWaypointId")   as string);
    const estimatedTimeMin = parseInt(form.get("estimatedTimeMin") as string) || null;
    const difficulty       = parseInt(form.get("difficulty")       as string) || null;
    const slug             = (form.get("slug") as string | null)?.trim() || null;
    const nameEn           = (form.get("nameEn") as string | null)?.trim() || null;
    const nameKo           = (form.get("nameKo") as string | null)?.trim() || null;

    const missingFields = [
      !mountainId      && "mountainId",
      !segmentType     && "segmentType",
      !startWaypointId && "startWaypointId",
      !endWaypointId   && "endWaypointId",
    ].filter(Boolean);
    if (missingFields.length) {
      return NextResponse.json({ error: `Required: ${missingFields.join(", ")}` }, { status: 400 });
    }

    let points: TrackPoint[] = [];
    let stats: { distance_m: number; total_ascent_m: number; total_descent_m: number };

    if (gpxFile instanceof File && gpxFile.size > 0) {
      const text = await gpxFile.text();
      points = gpxFile.name.toLowerCase().endsWith(".geojson")
        ? parseGeoJson(text)
        : parseGpx(text);
      stats = computeStats(points);
    } else {
      // Create a simple 2-point track from waypoints
      const { data: wps, error: wpErr } = await supabaseAdmin
        .from("waypoints")
        .select("id, lat, lon, elevation_m")
        .in("id", [startWaypointId, endWaypointId]);

      if (wpErr || !wps || wps.length < 2) {
        // If we can't find both waypoints, we might only find one if start==end (unlikely)
        // or none if IDs are invalid.
        // Fallback to dummy points if necessary, but ideally we find them.
        const sw = wps?.find(w => w.id === startWaypointId);
        const ew = wps?.find(w => w.id === endWaypointId);
        const p1: TrackPoint = sw ? [sw.lon, sw.lat, sw.elevation_m || 0] : [0, 0, 0];
        const p2: TrackPoint = ew ? [ew.lon, ew.lat, ew.elevation_m || 0] : [0.001, 0.001, 0];
        points = [p1, p2];
      } else {
        const sw = wps.find(w => w.id === startWaypointId)!;
        const ew = wps.find(w => w.id === endWaypointId)!;
        points = [
          [sw.lon, sw.lat, sw.elevation_m || 0],
          [ew.lon, ew.lat, ew.elevation_m || 0],
        ];
      }
      stats = computeStats(points);
    }

    const isBusCombined      = form.get("isBusCombined") === "true";
    const busGpx             = form.get("busGpx");
    const midWaypointId      = parseInt(form.get("midWaypointId") as string) || null;
    const busType            = form.get("busType") as string || null;
    const busNumber          = form.get("busNumber") as string || null;
    const busColor           = form.get("busColor") as string || null;
    const stationBusStopName = (form.get("stationBusStopName") as string | null)?.trim() || null;
    const busInstruction     = (form.get("busInstruction")     as string | null)?.trim() || null;
    const busDurationMin     = parseInt(form.get("busDurationMin") as string) || null;

    const trackData = { type: "LineString", coordinates: points };
    
    let busDetails = null;
    let subSegments = null;

    if (isBusCombined && busGpx instanceof File) {
      const busText = await busGpx.text();
      const busPoints = busGpx.name.toLowerCase().endsWith(".geojson")
        ? parseGeoJson(busText)
        : parseGpx(busText);
      busDetails = {
        bus_stop_id_key:       midWaypointId ? String(midWaypointId) : undefined,
        bus_numbers:           busNumber ? [busNumber] : [],
        route_color:           busColor,
        bus_track_data:        { type: "LineString", coordinates: busPoints },
        station_bus_stop_name: stationBusStopName,
        instruction:           busInstruction,
        ...(busDurationMin != null ? { bus_duration_min: busDurationMin } : {}),
      };
      subSegments = segmentType === "APPROACH"
        ? [{ mode: "bus" }, { mode: "walk" }]
        : [{ mode: "walk" }, { mode: "bus" }];
    }

    const { data, error } = await supabaseAdmin.from("segments").insert({
      mountain_id:       mountainId,
      segment_type:      segmentType,
      start_waypoint_id: startWaypointId,
      end_waypoint_id:   endWaypointId,
      track_data:        trackData,
      is_bus_combined:   isBusCombined,
      bus_details:       busDetails,
      sub_segments:      subSegments,
      ...stats,
      ...(estimatedTimeMin ? { estimated_time_min: estimatedTimeMin } : {}),
      ...(difficulty       ? { difficulty }                           : {}),
      ...(slug             ? { slug }                                 : {}),
      ...(nameEn || nameKo ? { name: { en: nameEn, ko: nameKo } }     : {}),
    }).select("id").single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    try {
      const { revalidateTag } = await import("next/cache");
      revalidateTag("route-detail", {});
      revalidateTag("route-list", {});
    } catch (e) {
      console.error("[segments] Revalidation failed", e);
    }

    return NextResponse.json({ id: data.id, pointCount: points.length, ...stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
