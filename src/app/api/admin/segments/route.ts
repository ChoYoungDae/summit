import { NextRequest, NextResponse } from "next/server";
import { DOMParser } from "@xmldom/xmldom";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type TrackPoint = [number, number, number]; // [lon, lat, ele]

function parseGeoJson(text: string): TrackPoint[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let geojson: any;
  try { geojson = JSON.parse(text); } catch { throw new Error("Invalid GeoJSON file"); }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function extractCoords(g: any): number[][] {
    const t = g?.type;
    if (t === "FeatureCollection") {
      for (const f of g.features ?? []) { const c = extractCoords(f); if (c.length) return c; }
      return [];
    }
    if (t === "Feature")         return extractCoords(g.geometry);
    if (t === "LineString")      return g.coordinates ?? [];
    if (t === "MultiLineString") return (g.coordinates as number[][][] ?? []).flat();
    return [];
  }

  const coords = extractCoords(geojson);
  if (coords.length === 0) throw new Error("No LineString coordinates found in GeoJSON");

  return coords.map((c) => {
    const lon = c[0], lat = c[1], ele = c[2] ?? 0;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      throw new Error(`Invalid coordinates: lon=${lon}, lat=${lat}`);
    }
    return [
      Math.round(lon * 1_000_000) / 1_000_000,
      Math.round(lat * 1_000_000) / 1_000_000,
      Math.round(ele * 10) / 10,
    ] as TrackPoint;
  });
}

function parseGpx(xml: string): TrackPoint[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const trkpts = Array.from(doc.getElementsByTagName("trkpt"));
  const wpts   = Array.from(doc.getElementsByTagName("wpt"));
  const nodes  = trkpts.length > 0 ? trkpts : wpts;

  if (nodes.length === 0) throw new Error("No track points found in GPX file");

  return nodes.map((node) => {
    const lat = parseFloat(node.getAttribute("lat") ?? "");
    const lon = parseFloat(node.getAttribute("lon") ?? "");
    const ele = parseFloat(node.getElementsByTagName("ele")[0]?.textContent?.trim() ?? "0") || 0;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error(`Invalid coordinates: lat=${lat}, lon=${lon}`);
    }
    return [
      Math.round(lon * 1_000_000) / 1_000_000,
      Math.round(lat * 1_000_000) / 1_000_000,
      Math.round(ele * 10) / 10,
    ] as TrackPoint;
  });
}

function haversineM(lon1: number, lat1: number, lon2: number, lat2: number) {
  const R  = 6_371_000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function computeStats(points: TrackPoint[]) {
  let distM = 0, ascM = 0, descM = 0;
  for (let i = 1; i < points.length; i++) {
    distM += haversineM(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
    const dEle = points[i][2] - points[i - 1][2];
    if (dEle > 0) ascM  += dEle;
    else          descM -= dEle;
  }
  return {
    distance_m:      Math.round(distM),
    total_ascent_m:  Math.round(ascM),
    total_descent_m: Math.round(descM),
  };
}

// GET /api/admin/segments?mountainId=X
export async function GET(req: NextRequest) {
  const mountainId = req.nextUrl.searchParams.get("mountainId");
  if (!mountainId) return NextResponse.json({ error: "mountainId is required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("segments")
    .select("id, slug, segment_type, start_waypoint_id, end_waypoint_id, distance_m, total_ascent_m, total_descent_m, estimated_time_min, difficulty")
    .eq("mountain_id", mountainId)
    .order("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/admin/segments — FormData with GPX
export async function POST(req: NextRequest) {
  try {
    const form            = await req.formData();
    const gpxFile         = form.get("gpx");
    const mountainId      = parseInt(form.get("mountainId")      as string);
    const segmentType     = (form.get("segmentType")     as string)?.trim().toUpperCase();
    const startWaypointId = parseInt(form.get("startWaypointId") as string);
    const endWaypointId   = parseInt(form.get("endWaypointId")   as string);
    const estimatedTimeMin = parseInt(form.get("estimatedTimeMin") as string) || null;
    const difficulty       = parseInt(form.get("difficulty")       as string) || null;
    const slug             = (form.get("slug") as string | null)?.trim() || null;

    if (!(gpxFile instanceof File)) {
      return NextResponse.json({ error: "Track file (GPX or GeoJSON) required" }, { status: 400 });
    }
    const missingFields = [
      !mountainId      && "mountainId",
      !segmentType     && "segmentType",
      !startWaypointId && "startWaypointId",
      !endWaypointId   && "endWaypointId",
    ].filter(Boolean);
    if (missingFields.length) {
      return NextResponse.json({ error: `Required: ${missingFields.join(", ")}` }, { status: 400 });
    }

    const text   = await gpxFile.text();
    const points = gpxFile.name.toLowerCase().endsWith(".geojson")
      ? parseGeoJson(text)
      : parseGpx(text);
    const stats  = computeStats(points);

    const trackData = { type: "LineString", coordinates: points };

    const { data, error } = await supabaseAdmin.from("segments").insert({
      mountain_id:       mountainId,
      segment_type:      segmentType,
      start_waypoint_id: startWaypointId,
      end_waypoint_id:   endWaypointId,
      track_data:        trackData,
      ...stats,
      ...(estimatedTimeMin ? { estimated_time_min: estimatedTimeMin } : {}),
      ...(difficulty       ? { difficulty }                           : {}),
      ...(slug             ? { slug }                                 : {}),
    }).select("id").single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: data.id, pointCount: points.length, ...stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
