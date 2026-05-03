export type WaypointType = "STATION" | "TRAILHEAD" | "SUMMIT" | "PEAK" | "JUNCTION" | "SHELTER" | "VIEW" | "LANDMARK" | "CAUTION" | "BUS_STOP";

export interface PhotoItem {
  key:         string;
  file:        File;        // WebP blob
  originalName: string;
  previewUrl:  string;
  lat?:        number;
  lon?:        number;
  ele?:        number;
  descEn:      string;
  descKo:      string;
  waypointType?: WaypointType;
}

export interface WaypointData {
  nameEn:       string;
  nameKo:       string;
  type:         WaypointType;
  lat:          number;
  lon:          number;
  elevationM?:  number;
  // STATION
  exitNumber?:    string;
  subwayLine?:    string;
  subwayStationEn?: string;
  subwayStation?:   string;
  // BUS_STOP
  arsId?:        string;
  busNumbers?:   string;
  busColor?:     string;
  busDurationMin?: number;
}

export interface WaypointSlot {
  source:         "new" | "existing";
  existingId?:    number;
  sourcePhotoIdx?: number;
  data:           WaypointData;
}

export interface ExistingWaypoint {
  id:           number;
  name:         { en?: string; ko?: string };
  type:         string;
  lat:          number;
  lon:          number;
  elevation_m?: number;
  exit_number?: string | null;
  subway_line?: string | null;
  subway_station?: string | null;
  ars_id?:      string | null;
  bus_numbers?: string | null;
}

export interface SegmentPreview {
  segType:        string;
  source:         "new" | "existing";
  existingId?:    number;
  startWpName:    string;
  startWpNameKo?: string;
  endWpName:      string;
  endWpNameKo?:   string;
  distanceM:      number;
  durationMin:    number;
  // Bus sub-segment (APPROACH / RETURN only)
  isBusCombined?:      boolean;
  busDurationMin?:     number;
  busColor?:           string;
  busNumbers?:         string;
  stationBusStopName?: string;
  // Waypoint boundary overrides (index into waypointSpecs / resolved[])
  startWpIdx?: number;
  endWpIdx?:   number;
}

export interface ExistingSegment {
  id:                 number;
  slug:               string;
  segment_type:       string;
  distance_m?:        number;
  estimated_time_min?: number;
  is_bus_combined?:   boolean;
  start_wp_name?:     string;
  start_wp_name_ko?:  string;
  end_wp_name?:       string;
  end_wp_name_ko?:    string;
}
