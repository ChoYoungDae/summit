import { fetchRoute } from "@/lib/trails";
import { fetchSunsetMin } from "@/lib/sunset";
import { tDB, LANGUAGE_STORAGE_KEY, DEFAULT_LANGUAGE } from "@/lib/i18n";
import { cookies, headers } from "next/headers";
import type { SupportedLocale } from "@/lib/i18n";
import TrailSection from "./TrailSection";
import type { ResolvedRoute, Waypoint } from "@/types/trail";

// ── Adapters: ResolvedRoute → TrailSection props ──────────────────────────────

/** Build combined ASCENT + DESCENT track as [lon, lat, ele][] */
function buildHikingTrack(route: ResolvedRoute): [number, number, number][] {
  return route.segments
    .filter((s) => s.segmentType === "ASCENT" || s.segmentType === "DESCENT")
    .flatMap((s) =>
      s.trackData.coordinates.map(
        (c) => [c[0], c[1], c[2] ?? 0] as [number, number, number]
      )
    );
}

/** Deduplicated ordered waypoints from on-mountain segments. */
function buildWaypoints(route: ResolvedRoute): Waypoint[] {
  const seen = new Set<number>();
  const result: Waypoint[] = [];
  for (const seg of route.segments) {
    for (const wpt of [seg.startWaypoint, seg.endWaypoint]) {
      if (!seen.has(wpt.id)) {
        seen.add(wpt.id);
        result.push(wpt);
      }
    }
  }
  return result;
}

/** Approach GPS tracks: bus (station→stop) and walk (stop→trailhead). */
function buildApproachTracks(route: ResolvedRoute): { bus: [number, number][], walk: [number, number][] } {
  const seg = route.segments.find((s) => s.segmentType === "APPROACH");
  if (!seg) return { bus: [], walk: [] };
  const walk = seg.trackData.coordinates.map((c) => [c[0], c[1]] as [number, number]);
  if (seg.isBusCombined && seg.busDetails?.bus_track_data) {
    const bus = seg.busDetails.bus_track_data.coordinates.map((c) => [c[0], c[1]] as [number, number]);
    return { bus, walk };
  }
  return { bus: [], walk };
}

/** Return GPS tracks: walk (trailhead→stop) and bus (stop→station). */
function buildReturnTracks(route: ResolvedRoute): { bus: [number, number][], walk: [number, number][] } {
  const seg = route.segments.find((s) => s.segmentType === "RETURN");
  if (!seg) return { bus: [], walk: [] };
  const walk = seg.trackData.coordinates.map((c) => [c[0], c[1]] as [number, number]);
  if (seg.isBusCombined && seg.busDetails?.bus_track_data) {
    const bus = seg.busDetails.bus_track_data.coordinates.map((c) => [c[0], c[1]] as [number, number]);
    return { bus, walk };
  }
  return { bus: [], walk };
}

/**
 * Seoul bus style from bus number format.
 * Returns bg color + chip text color (yellow uses dark text; others white).
 *
 * 간선 (blue)   : 3-digit        e.g. 140, 270, 741
 * 지선/마을 (green): 4-digit or alphanumeric  e.g. 0211, 1711, 성북06
 * 광역 (red)    : M-prefix or 4-digit 9xxx   e.g. M4108, 9401
 * 순환 (yellow) : 1-2 digit      e.g. 01, 02
 */
function seoulBusStyle(busNumbers: string | undefined): { color: string; chipTextColor: string } {
  if (!busNumbers) return { color: "#33B02B", chipTextColor: "#FFFFFF" };
  const first = busNumbers.split(",")[0].trim();
  if (/^M\d+$/i.test(first) || /^9\d{3}$/.test(first)) return { color: "#F33535", chipTextColor: "#FFFFFF" }; // 광역
  if (/^\d{1,2}$/.test(first))                           return { color: "#FFB300", chipTextColor: "#212529" }; // 순환
  if (/^\d{3}$/.test(first))                             return { color: "#0068B7", chipTextColor: "#FFFFFF" }; // 간선
  return { color: "#33B02B", chipTextColor: "#FFFFFF" };                                                        // 지선/마을
}

// ── Component ─────────────────────────────────────────────────────────────────

export default async function TrailDataLoader({ routeId }: { routeId: number }) {
  const cookieStore = await cookies();
  const headersList = await headers();
  const acceptLanguage = headersList.get("accept-language");
  const hasKoInHeaders = acceptLanguage?.toLowerCase().includes("ko");

  const locale = (cookieStore.get(LANGUAGE_STORAGE_KEY)?.value as SupportedLocale)
    || (hasKoInHeaders ? "ko" : null)
    || DEFAULT_LANGUAGE;

  const [route, sunsetMin] = await Promise.all([
    fetchRoute(routeId),
    fetchSunsetMin(),
  ]);
  if (!route) return null;

  const track = buildHikingTrack(route);
  const waypoints = buildWaypoints(route);
  const { bus: approachBusTrack, walk: approachWalkTrack } = buildApproachTracks(route);
  const { bus: returnBusTrack,   walk: returnWalkTrack }   = buildReturnTracks(route);

  const approachSeg = route.segments.find((s) => s.segmentType === "APPROACH");
  const ascentSeg   = route.segments.find((s) => s.segmentType === "ASCENT");
  const descentSeg  = route.segments.find((s) => s.segmentType === "DESCENT");
  const returnSeg   = route.segments.find((s) => s.segmentType === "RETURN");

  const approachIsBus = approachSeg?.isBusCombined ?? false;
  const returnIsBus   = returnSeg?.isBusCombined   ?? false;

  // Bus stop coordinate: last point of bus_track_data = junction between bus and walk
  const approachBusStopRaw = approachSeg?.busDetails?.bus_track_data?.coordinates;
  const returnBusStopRaw   = returnSeg?.busDetails?.bus_track_data?.coordinates;

  const approachBusNumbers = approachSeg?.busDetails?.bus_numbers?.join(", ");
  const returnBusNumbers   = returnSeg?.busDetails?.bus_numbers?.join(", ");

  const approachStyle = seoulBusStyle(approachBusNumbers);
  const returnStyle   = seoulBusStyle(returnBusNumbers);

  const approachBusInfo = approachIsBus ? {
    stopCoord: approachBusStopRaw
      ? ([approachBusStopRaw[Math.floor(approachBusStopRaw.length / 2)][0], approachBusStopRaw[Math.floor(approachBusStopRaw.length / 2)][1]] as [number, number])
      : undefined,
    busNumbers: approachBusNumbers,
    color: approachStyle.color,
    chipTextColor: approachStyle.chipTextColor,
  } : undefined;

  const returnBusInfo = returnIsBus ? {
    stopCoord: returnBusStopRaw
      ? ([returnBusStopRaw[Math.floor(returnBusStopRaw.length / 2)][0], returnBusStopRaw[Math.floor(returnBusStopRaw.length / 2)][1]] as [number, number])
      : undefined,
    busNumbers: returnBusNumbers,
    color: returnStyle.color,
    chipTextColor: returnStyle.chipTextColor,
  } : undefined;

  return (
    <TrailSection
      route={route}
      track={track}
      waypoints={waypoints}
      approachBusTrack={approachBusTrack}
      approachWalkTrack={approachWalkTrack}
      returnBusTrack={returnBusTrack}
      returnWalkTrack={returnWalkTrack}
      approachIsBus={approachIsBus}
      returnIsBus={returnIsBus}
      approachBusInfo={approachBusInfo}
      returnBusInfo={returnBusInfo}
      sunsetMin={sunsetMin}
      approachTimeMin={approachSeg?.estimatedTimeMin}
      ascentMin={ascentSeg?.estimatedTimeMin}
      descentMin={descentSeg?.estimatedTimeMin}
      returnTimeMin={returnSeg?.estimatedTimeMin}
      routeName={tDB(route.mountain.name, locale)}
      locale={locale}
    />
  );
}
