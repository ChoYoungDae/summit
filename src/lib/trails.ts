import { cache } from "react";
import { supabase } from "./supabase";
import type {
  Mountain,
  Waypoint,
  WaypointType,
  Segment,
  SegmentType,
  Route,
  ResolvedRoute,
  ResolvedSegment,
  GeoJsonLineString,
} from "@/types/trail";
import type { LocalizedText } from "./i18n";

// ── DB row shapes ─────────────────────────────────────────────────────────────

interface MountainRow {
  id: number;
  slug: string;
  name: LocalizedText;
  image_url?: string;
  region?: string;
  max_elevation_m?: number;
  terrain_tags?: { id: string; en: string; ko?: string }[];
}

interface WaypointRow {
  id: number;
  mountain_id: number;
  name: LocalizedText;
  type: WaypointType;
  lat: number;
  lon: number;
  elevation_m?: number;
  image_url?: string;
  description?: LocalizedText;
  exit_number?: string;
  subway_line?: string;
  bus_numbers?: string;
}

interface SegmentRow {
  id: number;
  mountain_id: number;
  segment_type: SegmentType;
  start_waypoint_id: number;
  end_waypoint_id: number;
  track_data: GeoJsonLineString;
  distance_m?: number;
  total_ascent_m?: number;
  total_descent_m?: number;
  estimated_time_min?: number;
  difficulty?: number;
  is_bus_combined?: boolean;
  bus_details?: {
    bus_stop_id_key?: string;
    bus_numbers?: string[];
    route_color?: string;
    bus_track_data?: GeoJsonLineString;
    station_bus_stop_name?: string;
    instruction?: string;
  } | null;
  sub_segments?: { mode: "bus" | "walk"; duration?: number }[] | null;
}

interface RouteRow {
  id: number;
  mountain_id: number;
  name: LocalizedText;
  segment_ids: number[];
  total_duration_min?: number;
  total_distance_m?: number;
  total_difficulty?: number;
  route_preview_img?: string;
  hero_images?: string[];
  description?: LocalizedText;
}

// ── Row → App type converters ─────────────────────────────────────────────────

function rowToMountain(row: MountainRow): Mountain {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    imageUrl: row.image_url,
    region: row.region,
    maxElevationM: row.max_elevation_m,
    terrainTags: row.terrain_tags,
  };
}

function rowToWaypoint(row: WaypointRow): Waypoint {
  return {
    id: row.id,
    mountainId: row.mountain_id,
    name: row.name,
    type: row.type,
    lat: row.lat,
    lon: row.lon,
    elevationM: row.elevation_m,
    imageUrl: row.image_url,
    description: row.description,
    exitNumber: row.exit_number,
    subwayLine: row.subway_line,
    busNumbers: row.bus_numbers,
  };
}

function rowToSegment(row: SegmentRow): Segment {
  return {
    id: row.id,
    mountainId: row.mountain_id,
    segmentType: row.segment_type,
    startWaypointId: row.start_waypoint_id,
    endWaypointId: row.end_waypoint_id,
    trackData: row.track_data,
    distanceM: row.distance_m,
    totalAscentM: row.total_ascent_m,
    totalDescentM: row.total_descent_m,
    estimatedTimeMin: row.estimated_time_min,
    difficulty: row.difficulty,
    isBusCombined: row.is_bus_combined,
    busDetails: row.bus_details ?? undefined,
    subSegments: row.sub_segments ?? undefined,
  };
}

function rowToRoute(row: RouteRow): Route {
  return {
    id: row.id,
    mountainId: row.mountain_id,
    name: row.name,
    segmentIds: row.segment_ids ?? [],
    totalDurationMin: row.total_duration_min,
    totalDistanceM: row.total_distance_m,
    totalDifficulty: row.total_difficulty,
    routePreviewImg: row.route_preview_img,
    heroImages: row.hero_images ?? [],
    description: row.description,
  };
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** All mountains (for list/selection UI). */
export const fetchMountains = cache(async (): Promise<Mountain[]> => {
  const { data, error } = await supabase
    .from("mountains")
    .select("id, slug, name, image_url, region, max_elevation_m, terrain_tags")
    .order("id");

  if (error || !data) return [];
  return (data as MountainRow[]).map(rowToMountain);
});

/** All routes, grouped by mountain. Used on the route list page. */
export interface RouteWithTrack {
  route: Route;
  /** Combined elevation track from all segments in segment order. */
  elevationTrack: [number, number, number][];
  /** Ordered unique waypoints for the route title (start of first seg + end of each seg). */
  waypoints: Waypoint[];
  /** Total bus riding time in minutes across all bus-combined segments. */
  busDurationMin: number;
  /** Number of segments that involve a bus. */
  busSegmentCount: number;
}

export interface MountainGroup {
  mountain: Mountain;
  routes: RouteWithTrack[];
}

export const fetchRouteList = cache(async (): Promise<MountainGroup[]> => {
  const { data: routeRows, error } = await supabase
    .from("routes")
    .select("id, mountain_id, name, segment_ids, total_duration_min, total_distance_m, total_difficulty, route_preview_img, hero_images, description")
    .order("id");

  if (error || !routeRows) return [];

  // Collect unique mountain IDs
  const mountainIds = [...new Set((routeRows as RouteRow[]).map((r) => r.mountain_id))];
  const { data: mtRows } = await supabase
    .from("mountains")
    .select("id, slug, name, image_url, region, max_elevation_m, terrain_tags")
    .in("id", mountainIds);

  const mountainMap = new Map<number, Mountain>(
    ((mtRows ?? []) as MountainRow[]).map((m) => [m.id, rowToMountain(m)])
  );

  // Fetch track_data + waypoint IDs for all segments referenced by listed routes
  const allSegmentIds = [
    ...new Set((routeRows as RouteRow[]).flatMap((r) => r.segment_ids ?? [])),
  ];

  interface SegmentSummary {
    id: number;
    track_data: GeoJsonLineString;
    start_waypoint_id: number;
    end_waypoint_id: number;
    is_bus_combined?: boolean;
    bus_details?: { bus_numbers?: string[]; route_color?: string; bus_duration_min?: number; bus_stop_id_key?: string };
  }

  const trackMap = new Map<number, GeoJsonLineString>();
  const segSummaryMap = new Map<number, SegmentSummary>();

  if (allSegmentIds.length > 0) {
    const { data: segRows } = await supabase
      .from("segments")
      .select("id, track_data, start_waypoint_id, end_waypoint_id, is_bus_combined, bus_details")
      .in("id", allSegmentIds);
    for (const s of (segRows ?? []) as SegmentSummary[]) {
      trackMap.set(s.id, s.track_data);
      segSummaryMap.set(s.id, s);
    }
  }

  // Fetch all waypoints needed for route titles
  const allWaypointIds = [
    ...new Set(
      Array.from(segSummaryMap.values()).flatMap((s) => [
        s.start_waypoint_id,
        s.end_waypoint_id,
      ])
    ),
  ];
  const waypointMap = new Map<number, Waypoint>();
  if (allWaypointIds.length > 0) {
    const { data: wptRows } = await supabase
      .from("waypoints")
      .select("id, mountain_id, name, type, lat, lon, elevation_m, image_url, description, exit_number, subway_line, bus_numbers")
      .in("id", allWaypointIds);
    for (const w of (wptRows ?? []) as WaypointRow[]) {
      waypointMap.set(w.id, rowToWaypoint(w));
    }
  }

  const groups = new Map<number, MountainGroup>();
  for (const row of routeRows as RouteRow[]) {
    const mountain = mountainMap.get(row.mountain_id) ?? {
      id: row.mountain_id,
      slug: "",
      name: { en: "Unknown" },
    };
    if (!groups.has(row.mountain_id)) {
      groups.set(row.mountain_id, { mountain, routes: [] });
    }

    // Concatenate elevation coordinates in segment order
    const elevationTrack: [number, number, number][] = (row.segment_ids ?? []).flatMap(
      (sid) => {
        const geo = trackMap.get(sid);
        if (!geo) return [];
        return geo.coordinates.filter(
          (c): c is [number, number, number] => c.length === 3
        );
      }
    );

    // Build ordered unique waypoint list: start of first seg, then end of each seg
    const segIds = row.segment_ids ?? [];
    const waypointIds: number[] = [];
    for (let i = 0; i < segIds.length; i++) {
      const seg = segSummaryMap.get(segIds[i]);
      if (!seg) continue;
      if (i === 0) waypointIds.push(seg.start_waypoint_id);
      waypointIds.push(seg.end_waypoint_id);
    }
    const waypoints = waypointIds
      .filter((id, idx, arr) => arr.indexOf(id) === idx) // deduplicate
      .map((id) => waypointMap.get(id))
      .filter(Boolean) as Waypoint[];

    // Sum bus riding time across bus-combined segments
    let busSegmentCount = 0;
    const busDurationMin = segIds.reduce((sum, sid) => {
      const seg = segSummaryMap.get(sid);
      if (!seg?.is_bus_combined) return sum;
      busSegmentCount++;
      return sum + (seg.bus_details?.bus_duration_min ?? 0);
    }, 0);

    // Inject bus info from bus-combined segments
    for (const segId of segIds) {
      const seg = segSummaryMap.get(segId);
      if (!seg?.is_bus_combined || !seg.bus_details?.bus_numbers?.length) continue;
      const color = seg.bus_details.route_color;
      const busNums = seg.bus_details.bus_numbers.join(", ");

      // End waypoint (station) gets bus badge
      const endIdx = waypoints.findIndex((w) => w.id === seg.end_waypoint_id);
      if (endIdx !== -1) {
        waypoints[endIdx] = { ...waypoints[endIdx], busNumbers: busNums, busRouteColor: color };
      }

      // Mid waypoint (BUS_STOP) also gets route color so its badge renders correctly
      const midId = seg.bus_details.bus_stop_id_key
        ? parseInt(seg.bus_details.bus_stop_id_key)
        : null;
      if (midId) {
        const midIdx = waypoints.findIndex((w) => w.id === midId);
        if (midIdx !== -1) {
          waypoints[midIdx] = { ...waypoints[midIdx], busRouteColor: color };
        }
      }
    }

    groups.get(row.mountain_id)!.routes.push({ route: rowToRoute(row), elevationTrack, waypoints, busDurationMin, busSegmentCount });
  }

  return Array.from(groups.values());
});

/** Single fully-resolved route (mountain + segments + waypoints). Used on detail page. */
export const fetchRoute = cache(async (id: number): Promise<ResolvedRoute | null> => {
  const { data: routeRow, error: routeErr } = await supabase
    .from("routes")
    .select("*")
    .eq("id", id)
    .single();

  if (routeErr || !routeRow) return null;

  const route = rowToRoute(routeRow as RouteRow);

  // Fetch ordered segments
  const { data: segRows, error: segErr } = await supabase
    .from("segments")
    .select("*")
    .in("id", route.segmentIds);

  if (segErr || !segRows) return null;

  // Sort segments to match segmentIds order
  const segMap = new Map(
    (segRows as SegmentRow[]).map((s) => [s.id, rowToSegment(s)])
  );
  const segments: Segment[] = route.segmentIds
    .map((sid) => segMap.get(sid))
    .filter(Boolean) as Segment[];

  // Collect all waypoint IDs referenced by segments
  const waypointIds = [
    ...new Set(segments.flatMap((s) => [s.startWaypointId, s.endWaypointId])),
  ];
  const { data: wptRows } = await supabase
    .from("waypoints")
    .select("*")
    .in("id", waypointIds);

  const waypointMap = new Map<number, Waypoint>(
    ((wptRows ?? []) as WaypointRow[]).map((w) => [w.id, rowToWaypoint(w)])
  );

  const resolvedSegments: ResolvedSegment[] = segments.map((seg) => ({
    ...seg,
    startWaypoint: waypointMap.get(seg.startWaypointId)!,
    endWaypoint: waypointMap.get(seg.endWaypointId)!,
  }));

  // Fetch mountain
  const { data: mtRow } = await supabase
    .from("mountains")
    .select("id, slug, name, image_url, region, max_elevation_m, terrain_tags")
    .eq("id", route.mountainId)
    .single();

  const mountain: Mountain = mtRow
    ? rowToMountain(mtRow as MountainRow)
    : { id: route.mountainId, slug: "", name: { en: "Unknown" } };

  return {
    ...route,
    mountain,
    segments: resolvedSegments,
  };
});

// ── Home map data ─────────────────────────────────────────────────────────────

export interface MountainPin {
  id: number;
  slug: string;
  nameEn: string;
  nameKo?: string;
  lat: number;
  lon: number;
  href: string;
}

export interface StationPin {
  id: number;
  nameEn: string;
  nameKo?: string;
  lat: number;
  lon: number;
  lines: number[];
}

/** Approximate mountain-center coordinates (used when no SUMMIT waypoint exists). */
const MOUNTAIN_FALLBACK_COORDS: Record<string, [number, number]> = {
  gwanaksan: [126.9627, 37.4431],
  bukhansan: [126.9770, 37.6594],
  inwangsan: [126.9680, 37.5776],
  ansan:     [126.9480, 37.5742],
};

/** Subway lines that serve each mountain's trailhead station. */
const MOUNTAIN_SUBWAY_LINES: Record<string, number[]> = {
  gwanaksan: [2, 4],
  bukhansan: [3],
  inwangsan: [5],
  ansan:     [3],
};

/** First active route href per mountain slug. */
const MOUNTAIN_ROUTE_HREF: Record<string, string> = {
  gwanaksan: "/route/1",
};

export const fetchHomeMapData = cache(async (): Promise<{
  mountains: MountainPin[];
  stations: StationPin[];
}> => {
  // 1. Fetch all mountains
  const { data: mtRows } = await supabase
    .from("mountains")
    .select("id, slug, name")
    .order("id");

  const mountains: Mountain[] = ((mtRows ?? []) as MountainRow[]).map(rowToMountain);

  // 2. Fetch SUMMIT waypoints to get mountain coordinates
  const mountainIds = mountains.map((m) => m.id);
  const { data: summitRows } = mountainIds.length
    ? await supabase
        .from("waypoints")
        .select("id, mountain_id, name, type, lat, lon, elevation_m, image_url, description, exit_number")
        .in("mountain_id", mountainIds)
        .eq("type", "SUMMIT")
    : { data: [] };

  // Index: mountainId → first summit waypoint
  const summitByMountain = new Map<number, WaypointRow>();
  for (const row of (summitRows ?? []) as WaypointRow[]) {
    if (!summitByMountain.has(row.mountain_id)) {
      summitByMountain.set(row.mountain_id, row);
    }
  }

  const mountainPins: MountainPin[] = mountains.map((m) => {
    const summit = summitByMountain.get(m.id);
    const fallback = MOUNTAIN_FALLBACK_COORDS[m.slug] ?? [126.977, 37.566];
    return {
      id:      m.id,
      slug:    m.slug,
      nameEn:  m.name.en,
      nameKo:  m.name.ko,
      lat:     summit?.lat  ?? fallback[1],
      lon:     summit?.lon  ?? fallback[0],
      href:    MOUNTAIN_ROUTE_HREF[m.slug] ?? "/route",
    };
  });

  // 3. Fetch STATION waypoints for subway markers
  const { data: stationRows } = mountainIds.length
    ? await supabase
        .from("waypoints")
        .select("id, mountain_id, name, type, lat, lon, elevation_m, image_url, description, exit_number")
        .in("mountain_id", mountainIds)
        .eq("type", "STATION")
    : { data: [] };

  // Build a slug lookup for fast mountainId → slug
  const mountainSlugById = new Map<number, string>(mountains.map((m) => [m.id, m.slug]));

  const stationPins: StationPin[] = ((stationRows ?? []) as WaypointRow[]).map((row) => {
    const slug  = mountainSlugById.get(row.mountain_id) ?? "";
    const lines = MOUNTAIN_SUBWAY_LINES[slug] ?? [];
    return {
      id:     row.id,
      nameEn: row.name.en,
      nameKo: row.name.ko,
      lat:    row.lat,
      lon:    row.lon,
      lines,
    };
  });

  return { mountains: mountainPins, stations: stationPins };
});

/** Waypoints for a given mountain (all types). */
export const fetchWaypoints = cache(async (mountainId: number): Promise<Waypoint[]> => {
  const { data, error } = await supabase
    .from("waypoints")
    .select("*")
    .eq("mountain_id", mountainId);

  if (error || !data) return [];
  return (data as WaypointRow[]).map(rowToWaypoint);
});
