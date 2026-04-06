import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service-role client — server only
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const BUCKET = "waypoints";
const MAX_PX = 1280;
const JPEG_QUALITY = 0.82; // sharp default

/** 고유 Storage 경로 생성 */
function buildStoragePath(originalName: string, folder: string): string {
  const base = originalName
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_\-]/g, "_")
    .slice(0, 60);
  const ts   = Date.now();
  const rand = Math.random().toString(36).slice(2, 7);
  return `${folder}/${base}_${ts}_${rand}.jpg`;
}

/**
 * Server-side 이미지 압축 — sharp 미설치 시 원본 Blob 그대로 업로드.
 * (sharp은 optional dependency이므로 없어도 동작)
 */
async function compressOrPassthrough(
  buffer: ArrayBuffer,
  mimeType: string,
): Promise<{ data: Buffer; contentType: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sharp = require("sharp") as typeof import("sharp");
    const compressed = await sharp(Buffer.from(buffer))
      .resize(MAX_PX, MAX_PX, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: Math.round(JPEG_QUALITY * 100) })
      .toBuffer();
    return { data: compressed, contentType: "image/jpeg" };
  } catch {
    // sharp 없음 → 원본 그대로
    return { data: Buffer.from(buffer), contentType: mimeType };
  }
}

/**
 * GPX 트랙에서 주어진 좌표와 가장 가까운 포인트의 인덱스를 반환.
 * order_index를 GPX 파일의 포인트 순서에 맞게 자동 동기화하는 데 사용.
 */
function findClosestTrackIndex(
  track: [number, number, number][],
  lat: number,
  lon: number,
): number {
  let minDist = Infinity;
  let minIdx  = 0;
  for (let i = 0; i < track.length; i++) {
    const [tLon, tLat] = track[i];
    const dist = (tLat - lat) ** 2 + (tLon - lon) ** 2;
    if (dist < minDist) { minDist = dist; minIdx = i; }
  }
  return minIdx;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const trailSlug  = (form.get("trailSlug") as string | null)?.trim();
    const type       = (form.get("type")       as string | null)?.trim() ?? "peak";
    const lat        = parseFloat((form.get("lat") as string) ?? "");
    const lon        = parseFloat((form.get("lon") as string) ?? "");
    const ele        = parseFloat((form.get("ele") as string) ?? "0");

    // name and description as plain text (KO or EN) — AI will build full JSONB
    const nameEn  = (form.get("nameEn")  as string | null)?.trim() ?? "";
    const nameKo  = (form.get("nameKo")  as string | null)?.trim() ?? "";
    const descEn  = (form.get("descEn")  as string | null)?.trim() ?? "";
    const descKo  = (form.get("descKo")  as string | null)?.trim() ?? "";

    // Manual order override (optional — ignored when coords are present)
    const orderOverride = (form.get("orderIndex") as string | null)?.trim();

    if (!trailSlug) {
      return NextResponse.json({ error: "trailSlug는 필수입니다." }, { status: 400 });
    }

    // ── 1. trail 조회 (track도 함께 가져와서 order_index 자동 계산에 사용) ──
    const { data: trail, error: trailErr } = await supabaseAdmin
      .from("trails")
      .select("id, track")
      .eq("slug", trailSlug)
      .single();

    if (trailErr || !trail) {
      return NextResponse.json(
        { error: `slug "${trailSlug}"에 해당하는 트레일을 찾을 수 없습니다.` },
        { status: 404 },
      );
    }

    const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);

    // ── 2. order_index 결정 ───────────────────────────────────────────────
    // 좌표가 있으면 GPX 트랙의 최근접 포인트 인덱스를 사용 (GPX Order Sync).
    // 좌표가 없거나 track이 비어 있으면 수동 입력값 사용.
    let orderIndex = orderOverride ? parseInt(orderOverride, 10) : 0;
    if (hasCoords) {
      const track = (trail.track ?? []) as [number, number, number][];
      if (track.length > 0) {
        orderIndex = findClosestTrackIndex(track, lat, lon);
      }
    }

    // ── 3. name / description JSONB 구성 ─────────────────────────────────
    const nameJsonb = (nameEn || nameKo)
      ? { ...(nameEn ? { en: nameEn } : {}), ...(nameKo ? { ko: nameKo } : {}) }
      : null;
    const descJsonb = (descEn || descKo)
      ? { ...(descEn ? { en: descEn } : {}), ...(descKo ? { ko: descKo } : {}) }
      : null;

    // ── 4. 사진 업로드 ────────────────────────────────────────────────────
    const photoFiles = form.getAll("photos").filter((v): v is File => v instanceof File);

    if (photoFiles.length === 0) {
      return NextResponse.json({ error: "photos 파일이 없습니다." }, { status: 400 });
    }

    const urls: string[] = [];

    for (const file of photoFiles) {
      if (!file.type.startsWith("image/")) continue;

      const buffer = await file.arrayBuffer();
      const { data: compressed, contentType } = await compressOrPassthrough(buffer, file.type);

      const storagePath = buildStoragePath(file.name, `${trailSlug}/photos`);

      const { error: uploadErr } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(storagePath, compressed, { contentType, upsert: false });

      if (uploadErr) throw new Error(`Storage 업로드 실패: ${uploadErr.message}`);

      const { data: urlData } = supabaseAdmin.storage
        .from(BUCKET)
        .getPublicUrl(storagePath);

      urls.push(urlData.publicUrl);
    }

    if (urls.length === 0) {
      return NextResponse.json({ error: "유효한 이미지 파일이 없습니다." }, { status: 400 });
    }

    // ── 5. waypoints INSERT ───────────────────────────────────────────────
    let waypointIds: number[] = [];

    if (hasCoords) {
      const rows = urls.map((photoUrl, i) => ({
        trail_id:    trail.id,
        order_index: orderIndex + i,
        lon,
        lat,
        ele:         Number.isFinite(ele) ? ele : 0,
        name:        nameJsonb ?? { en: `Photo ${i + 1}` },
        type,
        photo:       photoUrl,
        ...(descJsonb ? { description: descJsonb } : {}),
      }));

      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("waypoints")
        .insert(rows)
        .select("id");

      if (insertErr) throw new Error(`waypoints INSERT 실패: ${insertErr.message}`);
      waypointIds = (inserted ?? []).map((r) => r.id as number);
    }

    return NextResponse.json({
      trailId: trail.id,
      urls,
      waypointIds,
      orderIndex,
      nameJsonb,
      descJsonb,
      message: hasCoords
        ? `${urls.length}장 업로드 및 waypoint ${waypointIds.length}건 저장 완료 (order_index: ${orderIndex})`
        : `${urls.length}장 Storage 업로드 완료 (좌표 미입력 — waypoint 미생성)`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
