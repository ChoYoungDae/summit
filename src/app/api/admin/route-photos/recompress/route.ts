import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const BUCKET = "waypoints";

// POST /api/admin/route-photos/recompress
// Accepts multipart/form-data: { id, photo (WebP blob) }
// Overwrites the existing file in Supabase storage at the same path.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const id   = parseInt((form.get("id") as string) ?? "");
    const file = form.get("photo") as File | null;

    if (!id || !file) {
      return NextResponse.json({ error: "id and photo required" }, { status: 400 });
    }

    // Fetch existing photo URL from DB
    const { data: photo, error: fetchErr } = await supabaseAdmin
      .from("route_photos")
      .select("url")
      .eq("id", id)
      .single();

    if (fetchErr || !photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    // Strip any existing cache-bust param before extracting storage path
    const cleanUrl    = photo.url.split("?")[0];
    const bucketMarker = `/storage/v1/object/public/${BUCKET}/`;
    const pathStart    = cleanUrl.indexOf(bucketMarker);
    if (pathStart === -1) {
      return NextResponse.json({ error: "Cannot resolve storage path" }, { status: 400 });
    }
    const storagePath = cleanUrl.slice(pathStart + bucketMarker.length);

    // Overwrite with the new (smaller) blob
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: "image/webp", upsert: true });

    if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

    // Append cache-buster so CDN serves the new file instead of the cached one
    const newUrl = `${cleanUrl}?v=${Date.now()}`;
    const { error: updateErr } = await supabaseAdmin
      .from("route_photos").update({ url: newUrl }).eq("id", id);
    if (updateErr) throw new Error(`DB update failed: ${updateErr.message}`);

    return NextResponse.json({ ok: true, id, url: newUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Recompress failed" },
      { status: 500 },
    );
  }
}

// GET /api/admin/route-photos/recompress
// Returns all photo IDs + URLs for bulk recompression (no route filter).
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("route_photos")
    .select("id, url")
    .order("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
