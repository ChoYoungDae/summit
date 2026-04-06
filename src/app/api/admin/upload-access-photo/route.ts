import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const BUCKET = "waypoints";

export async function POST(req: NextRequest) {
  try {
    const form      = await req.formData();
    const file      = form.get("file") as File | null;
    const trailSlug = (form.get("trailSlug") as string | null)?.trim();

    if (!file || !trailSlug) {
      return NextResponse.json({ error: "file and trailSlug are required" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Not an image file" }, { status: 400 });
    }

    const base = file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_\-]/g, "_")
      .slice(0, 60);
    const path = `${trailSlug}/access/${base}_${Date.now()}.jpg`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (uploadErr) throw new Error(uploadErr.message);

    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}
