export type WaypointType = "STATION" | "TRAILHEAD" | "SUMMIT" | "JUNCTION" | "SHELTER" | "BUS_STOP";

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
  segType:       string;
  startWpName:   string;
  startWpNameKo?: string;
  endWpName:     string;
  endWpNameKo?:   string;
  distanceM:     number;
  durationMin:   number;
}
