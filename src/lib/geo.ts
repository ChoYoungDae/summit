export type TrackPoint3D = [number, number, number]; // [lon, lat, ele]

// ─── Shared geo utilities used by admin API routes ───────────────────────────

/** Haversine distance in metres between two lon/lat pairs. */
export function haversineM(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R  = 6_371_000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Distance, ascent, and descent statistics for a 3D track. */
export function computeTrackStats(points: TrackPoint3D[]) {
  let distM = 0, ascM = 0, descM = 0;
  for (let i = 1; i < points.length; i++) {
    distM += haversineM(points[i-1][0], points[i-1][1], points[i][0], points[i][1]);
    const dEle = points[i][2] - points[i-1][2];
    if (dEle > 0) ascM  += dEle;
    else          descM -= dEle;
  }
  return {
    distance_m:      Math.round(distM),
    total_ascent_m:  Math.round(ascM),
    total_descent_m: Math.round(descM),
  };
}

/** Index of the track point nearest to [lat, lon]. */
export function findNearestIndex(track: TrackPoint3D[], lat: number, lon: number): number {
  let bestIdx = 0, bestDist = Infinity;
  for (let i = 0; i < track.length; i++) {
    const d = haversineM(track[i][0], track[i][1], lon, lat);
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }
  return bestIdx;
}

type WaypointType = "STATION" | "TRAILHEAD" | "SUMMIT" | "PEAK" | "JUNCTION" | "SHELTER" | "BUS_STOP";
type SegmentType  = "APPROACH" | "ASCENT" | "DESCENT" | "RETURN";

/** Infer a segment type from its start/end waypoint types. */
export function inferSegmentType(startType: WaypointType, endType: WaypointType): SegmentType {
  const isTransit = (t: WaypointType) => t === "STATION" || t === "BUS_STOP";
  const isMid     = (t: WaypointType) => t === "TRAILHEAD" || t === "JUNCTION" || t === "SHELTER";
  const isPeak    = (t: WaypointType) => t === "PEAK" || t === "SUMMIT";

  if (isTransit(startType) && isMid(endType))        return "APPROACH";
  if (isTransit(startType) && isPeak(endType))        return "APPROACH";
  if (isMid(startType)     && isPeak(endType))        return "ASCENT";
  if (isPeak(startType)    && isPeak(endType))        return "ASCENT";   // peak-to-peak ridge walk
  if (isMid(startType)     && endType === "SUMMIT")   return "ASCENT";
  if (startType === "SUMMIT" && isMid(endType))       return "DESCENT";
  if (isPeak(startType)    && isMid(endType))         return "DESCENT";
  if (isPeak(startType)    && isTransit(endType))     return "RETURN";
  if (isMid(startType)     && isTransit(endType))     return "RETURN";
  if (isTransit(startType) && isTransit(endType))     return "APPROACH";
  if (isMid(startType)     && isMid(endType))         return "ASCENT";
  return "APPROACH";
}

// ─── Haversine distance between two [lon, lat] points, in km (internal) ──────
/** Haversine distance between two [lon, lat] points, in km */
function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Total track distance in km, rounded to 1 decimal.
 * Accepts 2D [lon, lat] or 3D [lon, lat, ele] arrays.
 */
export function trackDistanceKm(
  track: [number, number][] | [number, number, number][],
): number {
  let total = 0;
  for (let i = 1; i < track.length; i++) {
    total += haversineKm(
      [track[i - 1][0], track[i - 1][1]],
      [track[i][0], track[i][1]],
    );
  }
  return Math.round(total * 10) / 10;
}

/** Max elevation (metres) from a 3D track, rounded to the nearest metre. */
export function trackMaxEle(track: [number, number, number][]): number | null {
  if (!track.length) return null;
  return Math.round(Math.max(...track.map((p) => p[2])));
}
