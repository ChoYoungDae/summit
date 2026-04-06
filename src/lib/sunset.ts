import { cache } from "react";

/**
 * Fetches today's sunset time for Seoul from the KASI (천문연구원) Open API.
 *
 * Environment variable required (server-only):
 *   KASI_API_KEY — issued at https://www.data.go.kr
 *
 * Returns sunset as minutes from midnight (KST, UTC+9), or null on failure.
 */

const KASI_API_BASE =
  "https://apis.data.go.kr/B090041/openapi/service/RiseSetInfoService/getAreaRiseSetInfo";

/** Parse a KASI "HHMM" string into minutes from midnight. */
function parseHHMM(hhmm: string): number | null {
  if (hhmm.length !== 4) return null;
  const h = parseInt(hhmm.slice(0, 2), 10);
  const m = parseInt(hhmm.slice(2, 4), 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

export const fetchSunsetMin = cache(async (): Promise<number | null> => {
  const apiKey = process.env.KASI_API_KEY;
  if (!apiKey) {
    console.warn("[sunset] KASI_API_KEY is not set — skipping sunset fetch");
    return null;
  }

  // Today's date in KST (UTC+9), formatted as YYYYMMDD
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const locdate = nowKST.toISOString().slice(0, 10).replace(/-/g, "");

  const url = new URL(KASI_API_BASE);
  url.searchParams.set("serviceKey", apiKey);
  url.searchParams.set("locdate", locdate);
  url.searchParams.set("location", "서울");
  url.searchParams.set("_type", "json");

  try {
    const res = await fetch(url.toString(), {
      // Revalidate every 6 hours — sunset time is stable within a day
      next: { revalidate: 6 * 60 * 60 },
    });
    if (!res.ok) {
      console.error(`[sunset] KASI API error: ${res.status}`);
      return null;
    }

    const json = await res.json();
    const raw = json?.response?.body?.items?.item;
    // KASI returns a single object when totalCount=1, array when >1
    const item = Array.isArray(raw) ? raw[0] : raw;
    // KASI pads values with trailing spaces e.g. "1902  " — trim before parsing
    const setTime: string | undefined = item?.sunset?.trim();

    if (!setTime) {
      console.error("[sunset] Unexpected KASI response shape", JSON.stringify(json));
      return null;
    }

    return parseHHMM(setTime);
  } catch (err) {
    console.error("[sunset] Fetch failed", err);
    return null;
  }
});
