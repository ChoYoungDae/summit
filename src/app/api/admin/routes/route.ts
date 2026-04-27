import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
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
    .select("id, name, segment_ids, total_duration_min, total_distance_m, total_difficulty, is_oneway, hide_safe_start, tags, highlights, description")
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
    isOneway?: boolean;
    hideSafeStart?: boolean;
  };

  const { mountainId, nameEn, nameKo, segmentIds, totalDurationMin, totalDistanceM, totalDifficulty, isOneway, hideSafeStart } = body;

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
    is_oneway:          isOneway         ?? false,
    hide_safe_start:    hideSafeStart    ?? false,
  }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // @ts-ignore
  revalidateTag("route-list");
  // @ts-ignore
  revalidateTag("route-detail");
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
    isOneway?: boolean;
    hideSafeStart?: boolean;
    tags?: { en: string; ko: string }[];
    highlights?: { type: "highlight" | "pro_tip" | "warning"; text: { en: string; ko: string } }[];
    description?: { en: string; ko: string };
  };

  const { id, nameEn, nameKo, segmentIds, totalDurationMin, totalDistanceM, totalDifficulty, isOneway, hideSafeStart, tags, highlights, description } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (nameEn)                updates.name               = { en: nameEn, ...(nameKo ? { ko: nameKo } : {}) };
  if (segmentIds)            updates.segment_ids        = segmentIds;
  if (totalDurationMin != null) updates.total_duration_min = totalDurationMin;
  if (totalDistanceM   != null) updates.total_distance_m   = totalDistanceM;
  if (totalDifficulty  != null) updates.total_difficulty    = totalDifficulty;
  if (tags !== undefined)       updates.tags              = tags;
  if (highlights !== undefined) updates.highlights        = highlights;
  if (description !== undefined) updates.description      = description;
  if (isOneway         != null) updates.is_oneway          = isOneway;
  if (hideSafeStart    != null) updates.hide_safe_start    = hideSafeStart;

  const { error } = await supabaseAdmin.from("routes").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // @ts-ignore
  revalidateTag("route-list");
  // @ts-ignore
  revalidateTag("route-detail");
  // @ts-ignore
  revalidateTag(`route-detail-${id}`);
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/routes?id=X
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await supabaseAdmin.from("routes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // @ts-ignore
  revalidateTag("route-list");
  // @ts-ignore
  revalidateTag("route-detail");
  // @ts-ignore
  revalidateTag(`route-detail-${id}`);
  return NextResponse.json({ ok: true });
}
