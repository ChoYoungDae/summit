import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("trails")
    .select(
      "id, slug, name, description, difficulty, ascent_time_min, descent_time_min, mountain_id, start_station, access_mode, access_detail",
    )
    .order("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json() as {
    id: number;
    slug?: string;
    name: { en: string; ko?: string };
    description?: { en?: string; ko?: string } | null;
    difficulty: number | null;
    ascentTimeMin: number | null;
    descentTimeMin: number | null;
    mountainId?: number | null;
    startStation?: {
      line: number;
      name: { en: string; ko?: string };
      exit: number;
    } | null;
    accessMode?: "walk" | "bus" | null;
    accessDetail?: {
      track?: [number, number][];
      steps?: { coords: [number, number]; photo?: string; direction?: string }[];
    } | null;
  };

  const {
    id, slug, name, description, difficulty,
    ascentTimeMin, descentTimeMin, mountainId,
    startStation, accessMode, accessDetail,
  } = body;

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const nameJsonb = { en: name.en, ...(name.ko ? { ko: name.ko } : {}) };
  const descJsonb = (description?.en || description?.ko)
    ? {
        ...(description?.en ? { en: description.en } : {}),
        ...(description?.ko ? { ko: description.ko } : {}),
      }
    : null;

  const { error } = await supabaseAdmin
    .from("trails")
    .update({
      slug:             slug ?? null,
      name:             nameJsonb,
      description:      descJsonb,
      difficulty,
      ascent_time_min:  ascentTimeMin,
      descent_time_min: descentTimeMin,
      mountain_id:      mountainId ?? null,
      start_station:    startStation ?? null,
      access_mode:      accessMode ?? null,
      access_detail:    accessDetail ?? null,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
