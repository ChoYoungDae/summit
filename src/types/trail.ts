import type { LocalizedText } from "@/lib/i18n";

// ── Mountain ──────────────────────────────────────────────────────────────────

export interface Mountain {
  id: number;
  slug: string;
  name: LocalizedText;
  imageUrl?: string;
  region?: string;
  maxElevationM?: number;
}

// ── Waypoint ──────────────────────────────────────────────────────────────────

export type WaypointType =
  | "STATION"
  | "TRAILHEAD"
  | "SUMMIT"
  | "JUNCTION"
  | "SHELTER";

/** Turn direction used at JUNCTION waypoints. */
export type TurnDirection = "left" | "right" | "straight";

export interface Waypoint {
  id: number;
  mountainId: number;
  name: LocalizedText;
  type: WaypointType;
  lat: number;
  lon: number;
  elevationM?: number;
  imageUrl?: string;
  description?: LocalizedText;
  /** Only present on JUNCTION waypoints: which way to turn at this point. */
  direction?: TurnDirection;
  /** Optional subway exit number — e.g. "4" */
  exitNumber?: string;
}

// ── Segment ───────────────────────────────────────────────────────────────────

export type SegmentType = "APPROACH" | "ASCENT" | "DESCENT" | "RETURN";

export interface GeoJsonLineString {
  type: "LineString";
  /** GeoJSON order: [lon, lat] or [lon, lat, elevation] */
  coordinates: ([number, number] | [number, number, number])[];
}

export interface Segment {
  id: number;
  mountainId: number;
  segmentType: SegmentType;
  startWaypointId: number;
  endWaypointId: number;
  trackData: GeoJsonLineString;
  distanceM?: number;
  totalAscentM?: number;
  totalDescentM?: number;
  estimatedTimeMin?: number;
  difficulty?: number;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export interface Route {
  id: number;
  mountainId: number;
  name: LocalizedText;
  /** Ordered segment IDs: [approach, ascent, descent, return] */
  segmentIds: number[];
  totalDurationMin?: number;
  totalDistanceM?: number;
  totalDifficulty?: number;
  routePreviewImg?: string;
  /** Up to 3 hero images shown in the card carousel */
  heroImages?: string[];
  description?: LocalizedText;
}

// ── Station info (for FloatingTrailHeader subway chip) ───────────────────────
// Derived from the APPROACH segment's startWaypoint (STATION type).
// line and exit are optional — not yet stored in the waypoints schema.
export interface StationInfo {
  name: LocalizedText;
  line?: number;
  exit?: number;
}

// ── Resolved (joined) shapes ──────────────────────────────────────────────────

/** Segment with its start/end waypoints resolved */
export interface ResolvedSegment extends Segment {
  startWaypoint: Waypoint;
  endWaypoint: Waypoint;
}

/** Route with mountain and all segments (+ waypoints) resolved */
export interface ResolvedRoute extends Route {
  mountain: Mountain;
  segments: ResolvedSegment[];
}
