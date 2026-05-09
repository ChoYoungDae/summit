/**
 * /api/weather — Seoul current weather for header chip
 *
 * Source: 기상청 초단기실황 (getUltraSrtNcst)
 * Key   : KMA_API_KEY (data.go.kr → 기상청_단기예보 조회서비스 신청)
 *
 * Returns: { tempC, tempF, pty }
 *   pty: 0=없음 1=비 2=비/눈 3=눈 4=소나기
 */

import { NextResponse } from "next/server";

const KMA_NX = 60; // 서울 중구
const KMA_NY = 127;

/** KST base_date / base_time (데이터는 매시 10분 이후 제공) */
function getKSTBaseTime(): { base_date: string; base_time: string } {
  // Subtract 10 min to ensure the hour's data is published
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000 - 10 * 60 * 1000);
  const y  = kst.getUTCFullYear();
  const mo = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d  = String(kst.getUTCDate()).padStart(2, "0");
  const h  = String(kst.getUTCHours()).padStart(2, "0");
  return { base_date: `${y}${mo}${d}`, base_time: `${h}00` };
}

export async function GET() {
  const key = process.env.KMA_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "KMA_API_KEY not set" }, { status: 503 });
  }

  const { base_date, base_time } = getKSTBaseTime();
  const params = new URLSearchParams({
    serviceKey: key,
    base_date,
    base_time,
    nx: String(KMA_NX),
    ny: String(KMA_NY),
    numOfRows: "10",
    pageNo: "1",
    dataType: "JSON",
  });

  try {
    const res = await fetch(
      `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst?${params}`,
      { next: { revalidate: 1800 } }
    );
    if (!res.ok) throw new Error(`KMA ${res.status}`);

    const json = await res.json();
    const items: { category: string; obsrValue: string }[] =
      json?.response?.body?.items?.item ?? [];

    const get = (cat: string) =>
      parseFloat(items.find((i) => i.category === cat)?.obsrValue ?? "NaN");

    const tempC = get("T1H");
    const pty   = Math.round(get("PTY"));

    if (isNaN(tempC)) throw new Error("T1H missing");

    const tempF = Math.round(tempC * 9 / 5 + 32);

    return NextResponse.json(
      { tempC: Math.round(tempC), tempF, pty },
      { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=300" } }
    );
  } catch (err) {
    console.error("[/api/weather]", err);
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}
