import { NextRequest, NextResponse } from "next/server";
import { DOMParser } from "@xmldom/xmldom";
import { createClient } from "@supabase/supabase-js";

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
    ] satisfies TrackPoint;
  });
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function parseGpxXml(xml: string): TrackPoint[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");

  const trkpts = Array.from(doc.getElementsByTagName("trkpt"));
  const wpts   = Array.from(doc.getElementsByTagName("wpt"));
  const nodes  = trkpts.length > 0 ? trkpts : wpts;

  if (nodes.length === 0) {
    throw new Error("GPX 파일에 <trkpt> 또는 <wpt> 요소가 없습니다.");
  }

  return nodes.map((node) => {
    const lat = parseFloat(node.getAttribute("lat") ?? "");
    const lon = parseFloat(node.getAttribute("lon") ?? "");
    const eleText = node.getElementsByTagName("ele")[0]?.textContent?.trim();
    const ele = eleText ? parseFloat(eleText) : 0;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error(`유효하지 않은 좌표: lat=${lat}, lon=${lon}`);
    }

    return [
      Math.round(lon * 1_000_000) / 1_000_000,
      Math.round(lat * 1_000_000) / 1_000_000,
      Math.round(ele * 10) / 10,
    ] satisfies TrackPoint;
  });
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const gpxFile         = form.get("gpx");
    const nameEn          = (form.get("nameEn")          as string | null)?.trim();
    const nameKo          = (form.get("nameKo")          as string | null)?.trim() || undefined;
    const descEn          = (form.get("descEn")          as string | null)?.trim() || undefined;
    const descKo          = (form.get("descKo")          as string | null)?.trim() || undefined;
    const slug            = (form.get("slug")            as string | null)?.trim() || null;
    const mountainId      = (form.get("mountainId")      as string | null)?.trim() || null;
    const ascentTimeMin   = parseInt(form.get("ascentTimeMin")  as string) || null;
    const descentTimeMin  = parseInt(form.get("descentTimeMin") as string) || null;
    const difficulty      = parseInt(form.get("difficulty") as string) || null;

    if (!(gpxFile instanceof File)) {
      return NextResponse.json({ error: "트랙 파일(GPX 또는 GeoJSON)이 필요합니다." }, { status: 400 });
    }
    if (!nameEn) {
      return NextResponse.json({ error: "Trail name (EN) 은 필수입니다." }, { status: 400 });
    }

    const text  = await gpxFile.text();
    const track = gpxFile.name.toLowerCase().endsWith(".geojson")
      ? parseGeoJson(text)
      : parseGpxXml(text);
    const [firstLon, firstLat] = track[0];

    const nameJsonb = { en: nameEn, ...(nameKo ? { ko: nameKo } : {}) };
    const descJsonb = (descEn || descKo)
      ? { ...(descEn ? { en: descEn } : {}), ...(descKo ? { ko: descKo } : {}) }
      : null;

    const { data, error } = await supabaseAdmin.rpc("insert_trail", {
      p_name:             nameJsonb,
      p_gpx_data:         track,
      p_start_lat:        firstLat,
      p_start_lon:        firstLon,
      p_slug:             slug,
      p_mountain_id:      mountainId ? parseInt(mountainId) : null,
      p_ascent_time_min:  ascentTimeMin,
      p_descent_time_min: descentTimeMin,
      p_difficulty:       difficulty,
      p_description:      descJsonb,
    });

    if (error) {
      console.error("[upload-gpx] rpc error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = data as { id: string };

    return NextResponse.json({
      trailId:    result.id,
      pointCount: track.length,
      startLatLng: { lat: firstLat, lon: firstLon },
      nameJsonb,
    });
  } catch (err) {
    console.error("[upload-gpx] unexpected error:", err);
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
