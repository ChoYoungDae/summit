import { fetchRoute } from "@/lib/trails";
import { fetchSunsetMin } from "@/lib/sunset";
import { t } from "@/lib/i18n";
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

/** Approach GPS track [lon, lat][] from APPROACH segment coordinates. */
function buildApproachTrack(
  route: ResolvedRoute
): [number, number][] {
  const seg = route.segments.find((s) => s.segmentType === "APPROACH");
  if (!seg) return [];
  return seg.trackData.coordinates.map((c) => [c[0], c[1]] as [number, number]);
}

/** Return GPS track [lon, lat][] from RETURN segment coordinates. */
function buildReturnTrack(
  route: ResolvedRoute
): [number, number][] {
  const seg = route.segments.find((s) => s.segmentType === "RETURN");
  if (!seg) return [];
  return seg.trackData.coordinates.map((c) => [c[0], c[1]] as [number, number]);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default async function TrailDataLoader({ routeId }: { routeId: number }) {
  const [route, sunsetMin] = await Promise.all([
    fetchRoute(routeId),
    fetchSunsetMin(),
  ]);
  if (!route) return null;

  const track = buildHikingTrack(route);
  const waypoints = buildWaypoints(route);
  const approachTrack = buildApproachTrack(route);
  const returnTrack = buildReturnTrack(route);

  const approachSeg = route.segments.find((s) => s.segmentType === "APPROACH");
  const ascentSeg   = route.segments.find((s) => s.segmentType === "ASCENT");
  const descentSeg  = route.segments.find((s) => s.segmentType === "DESCENT");
  const returnSeg   = route.segments.find((s) => s.segmentType === "RETURN");

  return (
    <TrailSection
      route={route}
      track={track}
      waypoints={waypoints}
      approachTrack={approachTrack}
      returnTrack={returnTrack}
      sunsetMin={sunsetMin}
      approachTimeMin={approachSeg?.estimatedTimeMin}
      ascentMin={ascentSeg?.estimatedTimeMin}
      descentMin={descentSeg?.estimatedTimeMin}
      returnTimeMin={returnSeg?.estimatedTimeMin}
      routeName={t(route.name, "en")}
    />
  );
}
