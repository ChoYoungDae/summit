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
    .select("id, slug, name, image_url, region, max_elevation_m")
    .order("id");

  if (error || !data) return [];
  return (data as MountainRow[]).map(rowToMountain);
});

/** All routes, grouped by mountain. Used on the route list page. */
export interface RouteWithTrack {
  route: Route;
  /** Combined elevation track from all segments in segment order. */
  elevationTrack: [number, number, number][];
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
    .select("id, slug, name, image_url, region, max_elevation_m")
    .in("id", mountainIds);

  const mountainMap = new Map<number, Mountain>(
    ((mtRows ?? []) as MountainRow[]).map((m) => [m.id, rowToMountain(m)])
  );

  // Fetch track_data for all segments referenced by listed routes
  const allSegmentIds = [
    ...new Set((routeRows as RouteRow[]).flatMap((r) => r.segment_ids ?? [])),
  ];
  const trackMap = new Map<number, GeoJsonLineString>();
  if (allSegmentIds.length > 0) {
    const { data: segRows } = await supabase
      .from("segments")
      .select("id, track_data")
      .in("id", allSegmentIds);
    for (const s of (segRows ?? []) as { id: number; track_data: GeoJsonLineString }[]) {
      trackMap.set(s.id, s.track_data);
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

    groups.get(row.mountain_id)!.routes.push({ route: rowToRoute(row), elevationTrack });
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
    .select("id, slug, name, image_url, region, max_elevation_m")
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

/** Waypoints for a given mountain (all types). */
export const fetchWaypoints = cache(async (mountainId: number): Promise<Waypoint[]> => {
  const { data, error } = await supabase
    .from("waypoints")
    .select("*")
    .eq("mountain_id", mountainId);

  if (error || !data) return [];
  return (data as WaypointRow[]).map(rowToWaypoint);
});
