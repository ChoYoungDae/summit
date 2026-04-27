import { getCachedRoute } from "@/lib/trails";
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
  const segs = route.segments.filter((s) => s.segmentType === "APPROACH");
  const bus: [number, number][] = [];
  const walk: [number, number][] = [];

  for (const s of segs) {
    if (s.isBusCombined && s.busDetails?.bus_track_data) {
      bus.push(...s.busDetails.bus_track_data.coordinates.map((c) => [c[0], c[1]] as [number, number]));
    }
    walk.push(...s.trackData.coordinates.map((c) => [c[0], c[1]] as [number, number]));
  }
  return { bus, walk };
}

/** Return GPS tracks: walk (trailhead→stop) and bus (stop→station). */
function buildReturnTracks(route: ResolvedRoute): { bus: [number, number][], walk: [number, number][] } {
  const segs = route.segments.filter((s) => s.segmentType === "RETURN");
  const bus: [number, number][] = [];
  const walk: [number, number][] = [];

  for (const s of segs) {
    if (s.isBusCombined && s.busDetails?.bus_track_data) {
      bus.push(...s.busDetails.bus_track_data.coordinates.map((c) => [c[0], c[1]] as [number, number]));
    }
    walk.push(...s.trackData.coordinates.map((c) => [c[0], c[1]] as [number, number]));
  }
  return { bus, walk };
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
    getCachedRoute(routeId),
    fetchSunsetMin(),
  ]) as [ResolvedRoute | null, number | null];
  if (!route) return null;

  const track = buildHikingTrack(route);
  const waypoints = buildWaypoints(route);
  const { bus: approachBusTrack, walk: approachWalkTrack } = buildApproachTracks(route);
  const { bus: returnBusTrack,   walk: returnWalkTrack }   = buildReturnTracks(route);

  const approachSegs = route.segments.filter((s) => s.segmentType === "APPROACH");
  const returnSegs   = route.segments.filter((s) => s.segmentType === "RETURN");

  const approachIsBus = approachSegs.some((s) => s.isBusCombined);
  const returnIsBus   = returnSegs.some((s) => s.isBusCombined);

  // Collect all bus numbers from all relevant segments, unique and joined
  const approachBusNumbers = Array.from(new Set(
    approachSegs.flatMap(s => s.busDetails?.bus_numbers ?? [])
  )).join(", ");
  
  const returnBusNumbers = Array.from(new Set(
    returnSegs.flatMap(s => s.busDetails?.bus_numbers ?? [])
  )).join(", ");

  // Sum all segments by type to handle multi-stage routes correctly
  const approachTimeMin = route.segments
    .filter((s) => s.segmentType === "APPROACH")
    .reduce((acc, s) => acc + (s.estimatedTimeMin || 0) + (s.busDetails?.bus_duration_min || 0), 0);
    
  const ascentMin = route.segments
    .filter((s) => s.segmentType === "ASCENT")
    .reduce((acc, s) => acc + (s.estimatedTimeMin || 0), 0);
    
  const descentMin = route.segments
    .filter((s) => s.segmentType === "DESCENT")
    .reduce((acc, s) => acc + (s.estimatedTimeMin || 0), 0);
    
  const returnTimeMin = route.segments
    .filter((s) => s.segmentType === "RETURN")
    .reduce((acc, s) => acc + (s.estimatedTimeMin || 0) + (s.busDetails?.bus_duration_min || 0), 0);

  const approachBusInfos = approachSegs
    .filter(s => s.isBusCombined)
    .map(s => {
      const style = seoulBusStyle(s.busDetails?.bus_numbers?.join(", "));
      const coords = s.busDetails?.bus_track_data?.coordinates;
      return {
        stopCoord: coords
          ? ([coords[Math.floor(coords.length / 2)][0], coords[Math.floor(coords.length / 2)][1]] as [number, number])
          : undefined,
        busNumbers: s.busDetails?.bus_numbers?.join(", "),
        color: style.color,
        chipTextColor: style.chipTextColor,
      };
    });

  const returnBusInfos = returnSegs
    .filter(s => s.isBusCombined)
    .map(s => {
      const style = seoulBusStyle(s.busDetails?.bus_numbers?.join(", "));
      const coords = s.busDetails?.bus_track_data?.coordinates;
      return {
        stopCoord: coords
          ? ([coords[Math.floor(coords.length / 2)][0], coords[Math.floor(coords.length / 2)][1]] as [number, number])
          : undefined,
        busNumbers: s.busDetails?.bus_numbers?.join(", "),
        color: style.color,
        chipTextColor: style.chipTextColor,
      };
    });

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
      approachBusInfos={approachBusInfos}
      returnBusInfos={returnBusInfos}
      sunsetMin={sunsetMin}
      approachTimeMin={approachTimeMin}
      ascentMin={ascentMin}
      descentMin={descentMin}
      returnTimeMin={returnTimeMin}
      routeName={tDB(route.mountain.name, locale)}
      backHref={`/route?mountain=${route.mountain.id}`}
      locale={locale}
    />
  );
}

