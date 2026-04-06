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
