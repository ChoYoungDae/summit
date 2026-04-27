/**
 * parseGpx / parseGeoJson
 * Client-side GPX or GeoJSON → [[lon, lat, ele], ...] converter.
 * Supports GPX <trkpt>/<wpt> and GeoJSON LineString / MultiLineString / FeatureCollection.
 */

export type TrackPoint = [number, number, number]; // [lon, lat, ele]

export interface ParseGpxResult {
  points: TrackPoint[];
  /** Track/metadata name extracted from the source file */
  name: string;
  /** Bounding box derived from parsed points */
  bbox: { minLon: number; minLat: number; maxLon: number; maxLat: number } | null;
}

// ─── GPX ─────────────────────────────────────────────────────────────────────

export async function parseGpxFile(file: File): Promise<ParseGpxResult> {
  return parseGpxString(await file.text());
}

export function parseGpxString(xml: string): ParseGpxResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");

  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error(`GPX parse failed: ${doc.getElementsByTagName("parsererror")[0].textContent?.trim()}`);
  }

  const name =
    doc.getElementsByTagName("trk")[0]?.getElementsByTagName("name")[0]?.textContent?.trim() ||
    doc.getElementsByTagName("metadata")[0]?.getElementsByTagName("name")[0]?.textContent?.trim() ||
    "";

  const trkpts = Array.from(doc.getElementsByTagName("trkpt"));
  const wpts   = Array.from(doc.getElementsByTagName("wpt"));
  const nodes  = trkpts.length > 0 ? trkpts : wpts;

  if (nodes.length === 0) {
    throw new Error("GPX 파일에 트랙 포인트(<trkpt>) 또는 웨이포인트(<wpt>)가 없습니다.");
  }

  const points: TrackPoint[] = nodes.map((node) => {
    const lat = parseFloat(node.getAttribute("lat") ?? "");
    const lon = parseFloat(node.getAttribute("lon") ?? "");
    const eleText = node.getElementsByTagName("ele")[0]?.textContent?.trim();
    const ele = eleText ? parseFloat(eleText) : 0;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error(`유효하지 않은 좌표값: lat=${lat}, lon=${lon}`);
    }

    return [
      Math.round(lon * 1_000_000) / 1_000_000,
      Math.round(lat * 1_000_000) / 1_000_000,
      Math.round(ele * 10) / 10,
    ];
  });

  return { points, name, bbox: calcBbox(points) };
}

// ─── GeoJSON ──────────────────────────────────────────────────────────────────

type GeoCoord = number[]; // [lon, lat] or [lon, lat, ele]

export async function parseGeoJsonFile(file: File): Promise<ParseGpxResult> {
  return parseGeoJsonString(await file.text());
}

export function parseGeoJsonString(text: string): ParseGpxResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let geojson: any;
  try {
    geojson = JSON.parse(text);
  } catch {
    throw new Error("GeoJSON 파일을 파싱할 수 없습니다.");
  }

  const name: string = geojson?.properties?.name ?? geojson?.features?.[0]?.properties?.name ?? "";
  const coords = extractCoords(geojson);

  if (coords.length === 0) {
    throw new Error("GeoJSON 파일에 LineString 좌표가 없습니다.");
  }

  const points: TrackPoint[] = coords.map((c) => {
    const lon = c[0], lat = c[1], ele = c[2] ?? 0;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      throw new Error(`유효하지 않은 좌표값: lon=${lon}, lat=${lat}`);
    }
    return [
      Math.round(lon * 1_000_000) / 1_000_000,
      Math.round(lat * 1_000_000) / 1_000_000,
      Math.round((ele as number) * 10) / 10,
    ];
  });

  return { points, name, bbox: calcBbox(points) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractCoords(geojson: any): GeoCoord[] {
  const type: string = geojson?.type;

  if (type === "FeatureCollection") {
    let bestCoords: GeoCoord[] = [];
    for (const f of geojson.features ?? []) {
      const coords = extractCoords(f);
      if (coords.length > bestCoords.length) {
        bestCoords = coords;
      }
    }
    return bestCoords;
  }

  if (type === "Feature") return extractCoords(geojson.geometry);

  if (type === "LineString") return geojson.coordinates ?? [];

  if (type === "MultiLineString") {
    // Flatten all segments into one coordinate array
    return (geojson.coordinates as GeoCoord[][] ?? []).flat();
  }

  return [];
}

// ─── Unified entry point ──────────────────────────────────────────────────────

/** Auto-detect GPX vs GeoJSON by file extension, then parse. */
export async function parseTrackFile(file: File): Promise<ParseGpxResult> {
  if (file.name.toLowerCase().endsWith(".geojson")) {
    return parseGeoJsonFile(file);
  }
  return parseGpxFile(file);
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function calcBbox(points: TrackPoint[]) {
  if (points.length === 0) return null;
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const [lon, lat] of points) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLon, minLat, maxLon, maxLat };
}
