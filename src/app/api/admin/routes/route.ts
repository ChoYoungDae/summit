import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// GET /api/admin/routes?mountainId=X
export async function GET(req: NextRequest) {
  const mountainId = req.nextUrl.searchParams.get("mountainId");
  if (!mountainId) return NextResponse.json({ error: "mountainId is required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("routes")
    .select("id, name, segment_ids, total_duration_min, total_distance_m, total_difficulty")
    .eq("mountain_id", mountainId)
    .order("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/admin/routes — create
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    mountainId: number;
    nameEn: string;
    nameKo?: string;
    segmentIds: number[];
    totalDurationMin?: number | null;
    totalDistanceM?: number | null;
    totalDifficulty?: number | null;
  };

  const { mountainId, nameEn, nameKo, segmentIds, totalDurationMin, totalDistanceM, totalDifficulty } = body;

  if (!mountainId || !nameEn || !segmentIds?.length) {
    return NextResponse.json({ error: "mountainId, nameEn, segmentIds required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.from("routes").insert({
    mountain_id:        mountainId,
    name:               { en: nameEn, ...(nameKo ? { ko: nameKo } : {}) },
    segment_ids:        segmentIds,
    total_duration_min: totalDurationMin ?? null,
    total_distance_m:   totalDistanceM   ?? null,
    total_difficulty:   totalDifficulty  ?? null,
  }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

// PATCH /api/admin/routes — update
export async function PATCH(req: NextRequest) {
  const body = await req.json() as {
    id: number;
    nameEn?: string;
    nameKo?: string;
    segmentIds?: number[];
    totalDurationMin?: number | null;
    totalDistanceM?: number | null;
    totalDifficulty?: number | null;
  };

  const { id, nameEn, nameKo, segmentIds, totalDurationMin, totalDistanceM, totalDifficulty } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (nameEn)                updates.name               = { en: nameEn, ...(nameKo ? { ko: nameKo } : {}) };
  if (segmentIds)            updates.segment_ids        = segmentIds;
  if (totalDurationMin != null) updates.total_duration_min = totalDurationMin;
  if (totalDistanceM   != null) updates.total_distance_m   = totalDistanceM;
  if (totalDifficulty  != null) updates.total_difficulty    = totalDifficulty;

  const { error } = await supabaseAdmin.from("routes").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/routes?id=X
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await supabaseAdmin.from("routes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
