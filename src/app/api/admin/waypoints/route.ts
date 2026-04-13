import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { toSlug } from "@/lib/slug";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const BUCKET = "waypoints";
const MAX_PX = 1280;
const JPEG_Q = 82;

async function compressOrPassthrough(buf: ArrayBuffer, mime: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sharp = require("sharp") as typeof import("sharp");
    const data = await sharp(Buffer.from(buf))
      .resize(MAX_PX, MAX_PX, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPEG_Q })
      .toBuffer();
    return { data, contentType: "image/jpeg" };
  } catch {
    return { data: Buffer.from(buf), contentType: mime };
  }
}

async function uploadImage(file: File, folder: string): Promise<string> {
  const buf = await file.arrayBuffer();
  const { data: compressed, contentType } = await compressOrPassthrough(buf, file.type);
  const base = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 60);
  const path = `${folder}/${base}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`;
  const { error } = await supabaseAdmin.storage
    .from(BUCKET).upload(path, compressed, { contentType, upsert: false });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// GET /api/admin/waypoints?mountainId=X
export async function GET(req: NextRequest) {
  const mountainId = req.nextUrl.searchParams.get("mountainId");
  if (!mountainId) return NextResponse.json({ error: "mountainId is required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("waypoints")
    .select("id, mountain_id, slug, name, type, lat, lon, elevation_m, image_url, description, exit_number, subway_line, subway_station, ars_id, bus_numbers")
    .eq("mountain_id", mountainId)
    .order("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/admin/waypoints — create
export async function POST(req: NextRequest) {
  const form       = await req.formData();
  const mountainId = Number(form.get("mountain_id"));
  const lat        = parseFloat(form.get("lat") as string);
  const lon        = parseFloat(form.get("lon") as string);
  const elevationM = parseFloat((form.get("elevation_m") as string) || "");
  const nameEn     = (form.get("nameEn") as string)?.trim();
  const nameKo     = (form.get("nameKo") as string)?.trim() ?? "";
  const type       = (form.get("type")   as string)?.trim() ?? "JUNCTION";
  const slugRaw    = (form.get("slug")   as string)?.trim();
  const descEn     = (form.get("descEn") as string)?.trim() ?? "";
  const descKo     = (form.get("descKo") as string)?.trim() ?? "";
  const exitNumber = (form.get("exit_number") as string)?.trim() ?? "";
  const subwayLine = (form.get("subway_line") as string)?.trim() ?? "";
  const subwayStation = (form.get("subway_station") as string)?.trim() ?? "";
  const arsId      = (form.get("ars_id")      as string)?.trim() ?? "";
  const busNumbers = (form.get("bus_numbers") as string)?.trim() ?? "";
  const imageFile  = form.get("image");

  const missing = [
    !mountainId             && "mountain_id",
    !nameEn                 && "Name (EN)",
    !Number.isFinite(lat)   && "Lat",
    !Number.isFinite(lon)   && "Lon",
  ].filter(Boolean);
  if (missing.length) return NextResponse.json({ error: `Required: ${missing.join(", ")}` }, { status: 400 });

  let imageUrl: string | null = null;
  if (imageFile instanceof File && imageFile.size > 0) {
    const { data: mtn } = await supabaseAdmin.from("mountains").select("slug").eq("id", mountainId).single();
    imageUrl = await uploadImage(imageFile, `${mtn?.slug ?? String(mountainId)}/waypoints`);
  }

  const nameJsonb = { en: nameEn, ...(nameKo ? { ko: nameKo } : {}) };
  const descJsonb = (descEn || descKo)
    ? { ...(descEn ? { en: descEn } : {}), ...(descKo ? { ko: descKo } : {}) }
    : null;

  const waypointSlug = slugRaw ? toSlug(slugRaw) : toSlug(nameEn);

  const { data, error } = await supabaseAdmin.from("waypoints").insert({
    mountain_id: mountainId,
    lat, lon,
    ...(Number.isFinite(elevationM) ? { elevation_m: Math.round(elevationM) } : {}),
    name: nameJsonb,
    type,
    slug: waypointSlug,
    exit_number: exitNumber || null,
    subway_line: subwayLine || null,
    subway_station: subwayStation || null,
    ars_id: arsId || null,
    bus_numbers: busNumbers || null,
    ...(imageUrl  ? { image_url:   imageUrl   } : {}),
    ...(descJsonb ? { description: descJsonb  } : {}),
  }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, imageUrl });
}

// PATCH /api/admin/waypoints — update
export async function PATCH(req: NextRequest) {
  const form  = await req.formData();
  const id    = Number(form.get("id"));
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const lat          = form.get("lat")         != null ? parseFloat(form.get("lat")         as string) : undefined;
  const lon          = form.get("lon")         != null ? parseFloat(form.get("lon")         as string) : undefined;
  const elevationM   = form.get("elevation_m") != null ? parseFloat(form.get("elevation_m") as string) : undefined;
  const nameEn       = (form.get("nameEn")      as string | null)?.trim();
  const nameKo       = (form.get("nameKo")      as string | null)?.trim() ?? "";
  const type         = (form.get("type")        as string | null)?.trim();
  const slugRaw      = (form.get("slug")        as string | null)?.trim();
  const descEn       = (form.get("descEn")      as string | null)?.trim() ?? "";
  const descKo       = (form.get("descKo")      as string | null)?.trim() ?? "";
  const exitNumber   = (form.get("exit_number") as string | null)?.trim();
  const subwayLine   = (form.get("subway_line") as string | null)?.trim();
  const subwayStation = (form.get("subway_station") as string | null)?.trim();
  const arsId        = (form.get("ars_id")      as string | null)?.trim();
  const busNumbers   = (form.get("bus_numbers") as string | null)?.trim();
  const imageFile    = form.get("image");
  const mountainSlug = (form.get("mountainSlug") as string | null)?.trim() ?? "unknown";

  const updates: Record<string, unknown> = {};
  if (nameEn)   updates.name = { en: nameEn, ...(nameKo ? { ko: nameKo } : {}) };
  if (type)     updates.type = type;
  if (slugRaw)  updates.slug = toSlug(slugRaw);
  if (lat      !== undefined && Number.isFinite(lat))      updates.lat         = lat;
  if (lon      !== undefined && Number.isFinite(lon))      updates.lon         = lon;
  if (elevationM !== undefined && Number.isFinite(elevationM)) updates.elevation_m = Math.round(elevationM);
  if (descEn || descKo) updates.description = {
    ...(descEn ? { en: descEn } : {}),
    ...(descKo ? { ko: descKo } : {}),
  };
  if (exitNumber !== undefined) updates.exit_number = exitNumber || null;
  if (subwayLine !== undefined) updates.subway_line = subwayLine || null;
  if (subwayStation !== undefined) updates.subway_station = subwayStation || null;
  if (arsId !== undefined) updates.ars_id = arsId || null;
  if (busNumbers !== undefined) updates.bus_numbers = busNumbers || null;

  if (imageFile instanceof File && imageFile.size > 0) {
    updates.image_url = await uploadImage(imageFile, `${mountainSlug}/waypoints`);
  }

  const { error } = await supabaseAdmin.from("waypoints").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, imageUrl: updates.image_url ?? null });
}

// DELETE /api/admin/waypoints?id=X
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await supabaseAdmin.from("waypoints").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
