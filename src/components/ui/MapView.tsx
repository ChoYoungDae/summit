"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Map, {
  Marker,
  Source,
  Layer,
  AttributionControl,
} from "react-map-gl";
import type { MapRef } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Waypoint, RoutePhoto } from "@/types/trail";
import { Footprints, GitFork, Camera, Flag, TrainFront, Bus, LocateFixed } from "lucide-react";
import { Icon } from "@iconify/react";
import { tDB } from "@/lib/i18n";

// ── Brand colors ──────────────────────────────────────────────────────────────
const COLOR_BUS          = "#FF7A00"; // Bright Orange
const COLOR_ASCENT       = "#10B981"; // Emerald Green
const COLOR_DESCENT      = "#8B5CF6"; // Purple Indigo
const COLOR_PRIMARY      = "#2E5E4A"; // Namsan Pine Green (Marker base)
const COLOR_SECONDARY    = "#C8362A"; // Dancheong Red (GPS pulse)
const COLOR_GPS          = "#2E5E4A";
const COLOR_GPS_OFF      = "#C8362A";
const COLOR_CASING       = "#FFFFFF";

// ── Waypoint marker config (Lucide icon-based) ────────────────────────────────
type MarkerStyle = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  IconComponent: React.ComponentType<any>;
  bg: string;
  iconColor: string;
  size: number;
  border: string;
};

const MARKER_STYLE: Record<string, MarkerStyle> = {
  TRAILHEAD: { IconComponent: Footprints, bg: "#ffffff", iconColor: COLOR_PRIMARY, size: 30, border: `2px solid ${COLOR_PRIMARY}` },
  SUMMIT:    { IconComponent: Flag,       bg: "#ffffff", iconColor: COLOR_PRIMARY, size: 40, border: `2px solid ${COLOR_PRIMARY}` },
  JUNCTION:  { IconComponent: GitFork,    bg: "#ffffff", iconColor: COLOR_PRIMARY, size: 28, border: `2px solid ${COLOR_PRIMARY}` },
  SHELTER:   { IconComponent: Camera,     bg: "#ffffff", iconColor: COLOR_PRIMARY, size: 28, border: `2px solid ${COLOR_PRIMARY}` },
  BUS_STOP:  { IconComponent: Bus,        bg: COLOR_BUS, iconColor: "#ffffff",     size: 30, border: "none" },
};

/** Types that trigger a proximity notification pill while hiking */
const ALERT_ON_TYPES = new Set<string>(["SUMMIT", "JUNCTION", "TRAILHEAD"]);

// ── Static UI strings (5 supported locales) ───────────────────────────────────
const UI_STRINGS: Record<string, { gpsHttps: string; alert: Record<string, string> }> = {
  en: {
    gpsHttps: "HTTPS required for GPS",
    alert: {
      JUNCTION:  "Check your path! Make sure you're heading the right way.",
      SUMMIT:    "You've reached the summit",
      TRAILHEAD: "Trailhead ahead",
    },
  },
  ko: {
    gpsHttps: "GPS를 사용하려면 HTTPS가 필요합니다",
    alert: {
      JUNCTION:  "경로를 확인하세요! 올바른 방향으로 가고 있는지 확인하세요.",
      SUMMIT:    "정상에 도달했습니다",
      TRAILHEAD: "등산로 입구가 가까워졌습니다",
    },
  },
  zh: {
    gpsHttps: "GPS需要HTTPS连接",
    alert: {
      JUNCTION:  "请确认路线！确保您朝正确方向行进。",
      SUMMIT:    "您已到达山顶",
      TRAILHEAD: "登山口在前方",
    },
  },
  ja: {
    gpsHttps: "GPSにはHTTPSが必要です",
    alert: {
      JUNCTION:  "ルートを確認してください！正しい方向に進んでいるか確認してください。",
      SUMMIT:    "山頂に到達しました",
      TRAILHEAD: "登山口が近くにあります",
    },
  },
  es: {
    gpsHttps: "Se requiere HTTPS para el GPS",
    alert: {
      JUNCTION:  "¡Verifica tu ruta! Asegúrate de ir en la dirección correcta.",
      SUMMIT:    "Has llegado a la cima",
      TRAILHEAD: "Entrada al sendero adelante",
    },
  },
};

// ── Constants ─────────────────────────────────────────────────────────────────
const WAYPOINT_ALERT_M = 40;

// ── Geometry ──────────────────────────────────────────────────────────────────

/**
 * Build a GeoJSON Polygon approximating a circle of `radiusM` metres
 * centred on [lon, lat]. Used to render the GPS accuracy ring on the map.
 */
function createAccuracyCircle(
  lon: number,
  lat: number,
  radiusM: number,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const POINTS = 64;
  const kmPerDegLat = 111.32;
  const kmPerDegLon = 111.32 * Math.cos((lat * Math.PI) / 180);
  const radiusKm = radiusM / 1000;
  const coords: [number, number][] = [];
  for (let i = 0; i <= POINTS; i++) {
    const angle = (i / POINTS) * 2 * Math.PI;
    coords.push([
      lon + (radiusKm / kmPerDegLon) * Math.cos(angle),
      lat + (radiusKm / kmPerDegLat) * Math.sin(angle),
    ]);
  }
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [coords] },
  };
}

function haversineM(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6_371_000;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(lat2 - lat1);
  const dLon = toR(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toR = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toR(lon2 - lon1)) * Math.cos(toR(lat2));
  const x = Math.cos(toR(lat1)) * Math.sin(toR(lat2)) -
            Math.sin(toR(lat1)) * Math.cos(toR(lat2)) * Math.cos(toR(lon2 - lon1));
  const brng = Math.atan2(y, x);
  return (brng * 180 / Math.PI + 360) % 360;
}

function checkOffRoute(
  lat: number,
  lon: number,
  track: [number, number, number][],
  thresholdM: number,
): boolean {
  for (const [tLon, tLat] of track) {
    if (haversineM(lat, lon, tLat, tLon) < thresholdM) return false;
  }
  return true;
}

// ── Marker components — React elements, no manual DOM appendChild ─────────────

/** Square subway exit badge — dark background with gold border/text */
function StationMarker({
  wpt,
  onClick,
  isSelected = false,
  locale = "en",
}: {
  wpt: Waypoint;
  onClick: () => void;
  isSelected?: boolean;
  locale?: string;
}) {
  const exitNum = wpt.exitNumber;
  const BG_SOFT_DARK = "#2D2D2D";
  const TEXT_YELLOW = "#FFCE00";
  const size = isSelected ? 28 : 24;

  return (
    <div
      title={tDB(wpt.name, locale)}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BG_SOFT_DARK,
        borderRadius: "4px",
        boxShadow: isSelected
          ? `0 0 0 1.5px #fff, 0 3px 8px rgba(0,0,0,0.5)`
          : "0 1.5px 5px rgba(0,0,0,0.35)",
        cursor: "pointer",
        userSelect: "none",
        transition: "width 0.2s, height 0.2s, box-shadow 0.2s",
      }}
    >
      {exitNum ? (
        <span
          style={{
            fontWeight: 700,
            fontSize: isSelected ? 16 : 14,
            color: TEXT_YELLOW,
            lineHeight: isSelected ? "16px" : "14px",
            fontFamily: "var(--font-ko)",
            textRendering: "optimizeLegibility",
            WebkitFontSmoothing: "subpixel-antialiased",
            MozOsxFontSmoothing: "auto",
            letterSpacing: "-0.02em",
          }}
        >
          {exitNum}
        </span>
      ) : (
        <TrainFront size={isSelected ? 16 : 14} color={TEXT_YELLOW} strokeWidth={2.5} />
      )}
    </div>
  );
}

function WaypointDot({
  wpt,
  onClick,
  isSelected = false,
  locale = "en",
  rotation = 0,
}: {
  wpt: Waypoint;
  onClick: () => void;
  isSelected?: boolean;
  locale?: string;
  rotation?: number;
}) {
  if (wpt.type === "STATION") {
    return <StationMarker wpt={wpt} onClick={onClick} isSelected={isSelected} locale={locale} />;
  }
  const s = MARKER_STYLE[wpt.type] ?? MARKER_STYLE.JUNCTION;
  const baseSize = s.size;
  const size = isSelected ? baseSize + 8 : baseSize;
  const iconSize = Math.round(size * 0.52);
  const Icon = s.IconComponent;
  return (
    <div
      title={tDB(wpt.name, locale)}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        background: s.bg,
        borderRadius: "50%",
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: isSelected ? `3px solid ${s.bg === "#ffffff" ? COLOR_PRIMARY : "#fff"}` : s.border,
        boxShadow: isSelected
          ? `0 0 0 3px ${s.bg === "#ffffff" ? COLOR_PRIMARY : s.bg}, 0 4px 12px rgba(0,0,0,0.5)`
          : "0 2px 8px rgba(0,0,0,0.4)",
        cursor: "pointer",
        userSelect: "none",
        transition: "width 0.2s, height 0.2s, box-shadow 0.2s",
        filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))",
      }}
    >
      <div style={{ transform: `rotate(${rotation}deg)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={iconSize} color={s.iconColor} strokeWidth={2} />
      </div>
    </div>
  );
}

function waypointAlertMessage(wpt: Waypoint, locale: string): string {
  const ui = UI_STRINGS[locale] ?? UI_STRINGS.en;
  const primaryName = tDB(wpt.name, locale);
  switch (wpt.type) {
    case "JUNCTION":  return ui.alert.JUNCTION;
    case "SUMMIT":    return `${ui.alert.SUMMIT} — ${primaryName}`;
    case "TRAILHEAD": return `${ui.alert.TRAILHEAD} — ${primaryName}`;
    default:          return primaryName;
  }
}

/** Bus chip marker — shows at the bus stop coordinate on bus segments */
function BusChip({ busNumbers, color, chipTextColor }: { busNumbers?: string; color?: string; chipTextColor?: string }) {
  const bg       = color         ?? COLOR_BUS;
  const textColor = chipTextColor ?? "#FFFFFF";
  return (
    <div
      className="font-num"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "0 8px",
        borderRadius: 4,
        background: bg,
        color: textColor,
        fontSize: 11,
        fontWeight: "bold",
        height: 20,
        lineHeight: 1,
        whiteSpace: "nowrap",
        pointerEvents: "none",
        marginBottom: 8,
      }}
    >
      <Bus size={13} strokeWidth={2.5} />
      {busNumbers && <span>{busNumbers}</span>}
    </div>
  );
}

function PhotoMarker({ onClick }: { onClick: () => void }) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: "#F59E0B",
        border: "2px solid #fff",
        boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <Icon icon="ph:camera" width={14} height={14} color="#fff" />
    </div>
  );
}

function HoverDot({ ele }: { ele?: number }) {
  return (
    <div className="flex flex-col items-center group pointer-events-none">
      {/* Elevation Label */}
      {ele !== undefined && (
        <div 
          className="mb-1 px-2 py-0.5 rounded-md bg-[#111116]/85 text-white text-[10px] font-bold shadow-md"
          style={{ backdropFilter: "blur(4px)" }}
        >
          {Math.round(ele)}m
        </div>
      )}
      {/* The Dot */}
      <div
        className="animate-pulse"
        style={{
          background: COLOR_SECONDARY,
          borderRadius: "50%",
          width: 16,
          height: 16,
          border: "2.5px solid #fff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }}
      />
    </div>
  );
}

function GpsArrow({
  rotation,
  isOffRoute,
}: {
  rotation: number;
  isOffRoute: boolean;
}) {
  const color = isOffRoute ? COLOR_GPS_OFF : COLOR_GPS;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 44, height: 44 }}>
      {/* Solid center dot with white border */}
      <div
        className="absolute rounded-full"
        style={{
          width: 14,
          height: 14,
          background: color,
          border: "2.5px solid #fff",
          boxShadow: `0 0 0 1.5px ${color}, 0 2px 6px rgba(0,0,0,0.3)`,
          zIndex: 1,
          pointerEvents: "none",
        }}
      />

      {/* Direction arrow — rotates to show heading */}
      <div
        style={{
          position: "absolute",
          width: 28,
          height: 28,
          pointerEvents: "none",
          transform: `rotate(${rotation}deg)`,
          transformOrigin: "50% 50%",
          transition: "transform 0.2s linear",
          zIndex: 2,
        }}
      >
        <svg viewBox="0 0 24 24" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 2 L19 20 L12 15.5 L5 20 Z"
            fill={color}
            stroke="white"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────
export interface BusSegmentInfo {
  /** Coordinate [lon, lat] where the bus is boarded / alighted — shows bus chip */
  stopCoord?: [number, number];
  /** Bus route numbers to display in the chip, e.g. "704, 34" */
  busNumbers?: string;
  /** Hex color derived from Seoul bus number format (간선/지선/광역/순환) */
  color?: string;
  /** Chip text color — white for most types, dark (#212529) for yellow 순환 */
  chipTextColor?: string;
}

export interface MapViewProps {
  track: [number, number, number][];
  waypoints: Waypoint[];
  onWaypointClick?: (wpt: Waypoint) => void;
  onTrailPointClick?: (index: number | null) => void;
  isHiking?: boolean;
  /** Index of the currently selected waypoint — drives flyTo + marker highlight */
  selectedWaypointIndex?: number | null;
  /** GPS coordinates [lon, lat] of the bus component of the approach route */
  approachBusTrack?: [number, number][];
  /** GPS coordinates [lon, lat] of the walk component of the approach route */
  approachWalkTrack?: [number, number][];
  /** GPS coordinates [lon, lat] of the bus component of the return route */
  returnBusTrack?: [number, number][];
  /** GPS coordinates [lon, lat] of the walk component of the return route */
  returnWalkTrack?: [number, number][];
  /** true → approach track styled as bus (thin, 60 % opacity) */
  approachIsBus?: boolean;
  /** true → return track styled as bus (thin, 60 % opacity) */
  returnIsBus?: boolean;
  /** Array of bus chip info for all approach segments */
  approachBusInfos?: BusSegmentInfo[];
  /** Array of bus chip info for all return segments */
  returnBusInfos?: BusSegmentInfo[];
  /** Trail photos to show as camera markers on the map. */
  photos?: RoutePhoto[];
  /** Called when a photo marker is tapped. */
  onPhotoClick?: (photo: RoutePhoto) => void;
  /**
   * Pixels of bottom padding for the Mapbox camera.
   * When the bottom sheet rises, pass its visible height so the trail
   * centre shifts up to stay in the unobscured viewport region.
   */
  bottomPadding?: number;
  /**
   * Pixels from the bottom of the screen where the map control buttons sit.
   * Should match the current visible height of the bottom sheet so the
   * buttons float just above it.
   */
  controlsBottomOffset?: number;
  /** Active locale — drives waypoint labels and alert messages. Defaults to "en". */
  locale?: string;
  /** Whether off-route alerts are enabled. Defaults to true. */
  offRouteEnabled?: boolean;
  /** Called when the user taps the off-route toggle button on the map. */
  onToggleOffRoute?: () => void;
  /** Off-route threshold in metres — matches the Settings value. Defaults to 30. */
  offRouteThresholdM?: number;
  /**
   * Called on every accepted GPS fix with raw position + accuracy.
   * Parent uses this as the single source of truth for GPS state so that
   * no second watchPosition is needed elsewhere (e.g. useHikingGPS).
   */
  onGpsFix?: (fix: { lat: number; lon: number; accuracy: number } | null) => void;
  /**
   * Called after each map pan/zoom ends with the track indices visible
   * in the current viewport. null when no track points are in view.
   * Used to sync the elevation chart to the visible portion of the route.
   */
  onVisibleTrackRange?: (range: { startIdx: number; endIdx: number } | null) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MapView({
  track,
  waypoints,
  onWaypointClick,
  onTrailPointClick,
  isHiking = false,
  selectedWaypointIndex = null,
  approachBusTrack = [],
  approachWalkTrack = [],
  returnBusTrack = [],
  returnWalkTrack = [],
  approachIsBus = false,
  returnIsBus = false,
  approachBusInfos = [],
  returnBusInfos = [],
  photos = [],
  onPhotoClick,
  bottomPadding = 0,
  controlsBottomOffset = 88,
  locale = "en",
  offRouteEnabled = true,
  onToggleOffRoute,
  offRouteThresholdM = 30,
  onGpsFix,
  onVisibleTrackRange,
}: MapViewProps) {
  const mapRef = useRef<MapRef>(null);

  // GPS state — React owns position, no manual DOM marker manipulation
  const [gpsPos,       setGpsPos]       = useState<[number, number] | null>(null);
  const [gpsAccuracy,  setGpsAccuracy]  = useState<number | null>(null);
  const [gpsHeading,   setGpsHeading]   = useState(0);
  const [isOffRoute,   setIsOffRoute]   = useState(false);
  const [isMapLoaded,       setIsMapLoaded]       = useState(false);
  const [isFootprintReady,  setIsFootprintReady]  = useState(false);
  const [gpsAcquiring,      setGpsAcquiring]      = useState(false);

  // Map / compass state
  const [isTracking, setIsTracking] = useState(false);
  const [mapBearing, setMapBearing] = useState(0);
  const [mapError,   setMapError]   = useState<string | null>(null);
  const [gpsError,   setGpsError]   = useState<string | null>(null);

  // Refs for stable interval/closure access
  const isTrackingRef           = useRef(false);
  const isHikingRef             = useRef(isHiking);
  const offRouteEnabledRef      = useRef(offRouteEnabled);
  const offRouteThresholdRef    = useRef(offRouteThresholdM);
  const gpsWatchRef             = useRef<number | null>(null);
  /** Coarse (network/FLP) watcher — gives current location fast */
  const coarseWatchRef          = useRef<number | null>(null);
  /** Last position from the coarse (network) watcher — used to validate GPS fixes */
  const coarsePosRef            = useRef<[number, number] | null>(null);
  /** True once a GPS fix has passed the coarse-proximity check */
  const hasFineFixRef           = useRef(false);

  const trackRef                = useRef(track); // stable reference for interval closure
  const gpsPosRef               = useRef<[number, number] | null>(null);
  const hasCenteredOnStartRef   = useRef(false);
  const bottomPaddingRef        = useRef(bottomPadding);
  const hasFirstFixRef          = useRef(false);
  // Stable refs for callbacks — avoids re-creating handlers when props change
  const onGpsFixRef             = useRef(onGpsFix);
  const onVisibleTrackRangeRef  = useRef(onVisibleTrackRange);

  // Keep callback refs in sync
  useEffect(() => { onGpsFixRef.current = onGpsFix; }, [onGpsFix]);
  useEffect(() => { onVisibleTrackRangeRef.current = onVisibleTrackRange; }, [onVisibleTrackRange]);

  // Keep offRoute refs in sync
  useEffect(() => {
    offRouteEnabledRef.current = offRouteEnabled;
    if (!offRouteEnabled) setIsOffRoute(false);
  }, [offRouteEnabled]);

  useEffect(() => {
    offRouteThresholdRef.current = offRouteThresholdM;
  }, [offRouteThresholdM]);

  // Keep isHikingRef in sync with prop; reset off-route when hiking stops
  useEffect(() => {
    isHikingRef.current = isHiking;
    if (!isHiking) {
      setIsOffRoute(false);
      hasCenteredOnStartRef.current = false;
      // Finish — return to full-route overview
      if (isMapLoaded && mapRef.current) {
        setIsTracking(false);
        isTrackingRef.current = false;
        mapRef.current.fitBounds(bounds, {
          padding: { top: 100, left: 40, right: 40, bottom: bottomPadding + 40 },
          maxZoom: 15,
          bearing: 0,
          pitch: 0,
          duration: 800,
        });
      }
      return;
    }
    // Hiking just started — if GPS position is already known, center immediately.
    // Don't wait for bottomPadding or gpsPos to change (they may already be stable).
    if (isMapLoaded && mapRef.current && gpsPosRef.current && !hasCenteredOnStartRef.current) {
      hasCenteredOnStartRef.current = true;
      mapRef.current.easeTo({
        center: gpsPosRef.current,
        zoom: 16,
        padding: { top: 0, left: 0, right: 0, bottom: bottomPaddingRef.current },
        duration: 700,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHiking, isMapLoaded]);

  // ── Derived: bounds + center + GeoJSON ─────────────────────────────────────
  const { bounds } = useMemo(() => {
    if (!track || track.length === 0) {
      return {
        center: { longitude: 126.9779, latitude: 37.5665 }, // Seoul center fallback
        bounds: [[126.96, 37.55], [126.99, 37.58]] as [[number, number], [number, number]],
      };
    }
    // Include all access/return track coords in bounds
    const allLons = [
      ...track.map(([lon]) => lon),
      ...approachBusTrack.map(([lon]) => lon),
      ...approachWalkTrack.map(([lon]) => lon),
      ...returnBusTrack.map(([lon]) => lon),
      ...returnWalkTrack.map(([lon]) => lon),
    ];
    const allLats = [
      ...track.map(([, lat]) => lat),
      ...approachBusTrack.map(([, lat]) => lat),
      ...approachWalkTrack.map(([, lat]) => lat),
      ...returnBusTrack.map(([, lat]) => lat),
      ...returnWalkTrack.map(([, lat]) => lat),
    ];
    return {
      bounds: [
        [Math.min(...allLons), Math.min(...allLats)],
        [Math.max(...allLons), Math.max(...allLats)],
      ] as [[number, number], [number, number]],
    };
  }, [track, approachBusTrack, approachWalkTrack, returnBusTrack, returnWalkTrack]);

  const approachBusGeoJSON = useMemo<GeoJSON.Feature<GeoJSON.LineString> | null>(() => {
    if (!approachBusTrack || approachBusTrack.length < 2) return null;
    return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: approachBusTrack } };
  }, [approachBusTrack]);

  const approachWalkGeoJSON = useMemo<GeoJSON.Feature<GeoJSON.LineString> | null>(() => {
    if (!approachWalkTrack || approachWalkTrack.length < 2) return null;
    return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: approachWalkTrack } };
  }, [approachWalkTrack]);

  const returnBusGeoJSON = useMemo<GeoJSON.Feature<GeoJSON.LineString> | null>(() => {
    if (!returnBusTrack || returnBusTrack.length < 2) return null;
    return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: returnBusTrack } };
  }, [returnBusTrack]);

  const returnWalkGeoJSON = useMemo<GeoJSON.Feature<GeoJSON.LineString> | null>(() => {
    if (!returnWalkTrack || returnWalkTrack.length < 2) return null;
    return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: returnWalkTrack } };
  }, [returnWalkTrack]);

  /** Nearest waypoint within alert radius while hiking (rest type excluded). */
  const nearAlertWaypoint = useMemo<Waypoint | null>(() => {
    if (!gpsPos || !isHiking) return null;
    for (const wpt of waypoints) {
      if (!ALERT_ON_TYPES.has(wpt.type)) continue;
      if (haversineM(gpsPos[1], gpsPos[0], wpt.lat, wpt.lon) <= WAYPOINT_ALERT_M) return wpt;
    }
    return null;
  }, [gpsPos, isHiking, waypoints]);

  const trailGeoJSON = useMemo<GeoJSON.Feature<GeoJSON.LineString>>(() => ({
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: track.map(([lon, lat]) => [lon, lat]),
    },
  }), [track]);

  // ── Ascending / descending split — color changes at summit ───────────────────
  const summitTrackIndex = useMemo(() => {
    const summit = waypoints.find((w) => w.type === "SUMMIT");
    if (!summit || track.length === 0) return track.length - 1;
    let minDist = Infinity;
    let idx = track.length - 1;
    for (let i = 0; i < track.length; i++) {
      const d = haversineM(summit.lat, summit.lon, track[i][1], track[i][0]);
      if (d < minDist) { minDist = d; idx = i; }
    }
    return idx;
  }, [waypoints, track]);

  const ascendGeoJSON = useMemo<GeoJSON.Feature<GeoJSON.LineString>>(() => ({
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: track.slice(0, summitTrackIndex + 1).map(([lon, lat]) => [lon, lat]),
    },
  }), [track, summitTrackIndex]);

  const descendGeoJSON = useMemo<GeoJSON.Feature<GeoJSON.LineString> | null>(() => {
    if (summitTrackIndex >= track.length - 1) return null;
    return {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: track.slice(summitTrackIndex).map(([lon, lat]) => [lon, lat]),
      },
    };
  }, [track, summitTrackIndex]);

  // ── GPS watch ────────────────────────────────────────────────────────────────
  const handleGpsPos = useCallback((pos: GeolocationPosition) => {
    const { latitude: lat, longitude: lon, heading, speed, accuracy } = pos.coords;

    if (!hasFirstFixRef.current) {
      hasFirstFixRef.current = true;
      setGpsAcquiring(false);
    }
    const newPos: [number, number] = [lon, lat];
    setGpsPos(newPos);
    setGpsAccuracy(accuracy);
    gpsPosRef.current = newPos;
    // Notify parent so it can share this fix with other consumers (e.g. useHikingGPS)
    // — eliminates the need for a second watchPosition elsewhere.
    onGpsFixRef.current?.({ lat, lon, accuracy });
    if (isHikingRef.current) {
      // Gate off-route detection on GPS accuracy ≤ user threshold
      // — avoids false alerts when coarse network fix is still active
      const accuracyOk = accuracy <= offRouteThresholdRef.current;
      setIsOffRoute(offRouteEnabledRef.current && accuracyOk && checkOffRoute(lat, lon, trackRef.current, offRouteThresholdRef.current));
    }
    if (heading !== null && speed !== null && speed > 0.5) {
      setGpsHeading(heading);
      if (isTrackingRef.current) {
        mapRef.current?.easeTo({ bearing: heading });
      }
    }
  }, []); // stable — only touches refs and state setters

  const handleMapLoad = useCallback(() => {
    setIsMapLoaded(true);
    const map = mapRef.current?.getMap();
    if (map) {
      const svgData = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M9,13.25C9.21,11.23,10.61,9.75,12,8c1.39,1.75,2.79,3.23,3,5.25c0.16,1.46-0.67,2.75-2,2.75S9.84,14.71,9,13.25z M12,2C10.9,2,10,2.9,10,4s0.9,2,2,2s2-0.9,2-2S13.1,2,12,2z M12,18c-1.1,0-2,0.9-2,2s0.9,2,2,2s2-0.9,2-2S13.1,18,12,18z"/></svg>`;
      const img = new Image(24, 24);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 24;
        canvas.height = 24;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        const imageData = ctx?.getImageData(0, 0, 24, 24);
        if (imageData && !map.hasImage("footprint")) {
          map.addImage("footprint", imageData);
          setIsFootprintReady(true);
        }
      };
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`;
    }

    mapRef.current?.fitBounds(bounds, {
      padding: { top: 100, left: 40, right: 40, bottom: bottomPadding + 40 },
      maxZoom: 15,
    });

    if ("geolocation" in navigator) {
      setGpsAcquiring(true);

      // enableHighAccuracy:true → GPS chip (<20 m).  The timestamp filter above
      // catches Samsung's stale-cache fix that arrives before the chip has a lock.
      // maximumAge:0 prevents the OS from serving a cached position from a previous
      // session (honoured by most browsers; Samsung sometimes ignores it —
      // the timestamp guard handles that case).
      gpsWatchRef.current = navigator.geolocation.watchPosition(
        handleGpsPos,
        (err) => {
          console.warn("[GPS]", err.message, err.code);
          setGpsAcquiring(false);
          const ui = UI_STRINGS[locale] ?? UI_STRINGS.en;
          if (err.code === 1) {
            setGpsError("Location access denied — enable in browser settings");
          } else if (err.message.includes("secure origins")) {
            setGpsError(ui.gpsHttps);
          } else if (err.code === 2 || err.code === 3) {
            setGpsError("GPS unavailable — check location settings");
          }
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
      );
    }
  // bottomPadding is intentionally excluded — only matters at load time
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds, handleGpsPos]);

  // Keep bottomPaddingRef in sync for use in gpsPos effect
  useEffect(() => {
    bottomPaddingRef.current = bottomPadding;
  }, [bottomPadding]);

  // Animate map padding — and center on GPS when hiking first starts
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current) return;
    if (isHikingRef.current && !hasCenteredOnStartRef.current && gpsPosRef.current) {
      hasCenteredOnStartRef.current = true;
      mapRef.current.easeTo({
        center: gpsPosRef.current,
        zoom: 16,
        padding: { top: 0, left: 0, right: 0, bottom: bottomPadding },
        duration: 700,
      });
    } else {
      mapRef.current.easeTo({
        padding: { top: 0, left: 0, right: 0, bottom: bottomPadding },
        duration: 320,
      });
    }
  }, [bottomPadding, isMapLoaded]);

  // GPS centering — fires when Start Hiking is pressed but GPS fix hasn't arrived yet
  useEffect(() => {
    if (!gpsPos || !isMapLoaded || !mapRef.current) return;
    if (!isHikingRef.current || hasCenteredOnStartRef.current) return;
    hasCenteredOnStartRef.current = true;
    mapRef.current.easeTo({
      center: gpsPos,
      zoom: 16,
      padding: { top: 0, left: 0, right: 0, bottom: bottomPaddingRef.current },
      duration: 700,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsPos, isMapLoaded]);

  // Cleanup GPS watches on unmount
  useEffect(() => {
    return () => {
      if (gpsWatchRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchRef.current);
        gpsWatchRef.current = null;
      }
      if (coarseWatchRef.current !== null) {
        navigator.geolocation.clearWatch(coarseWatchRef.current);
        coarseWatchRef.current = null;
      }
    };
  }, []);

  // Vibrate on off-route detection (only when hiking)
  useEffect(() => {
    if (isOffRoute && isHiking && "vibrate" in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  }, [isOffRoute, isHiking]);

  // ── Device orientation (compass heading) — throttled to 16 ms ─────────────
  useEffect(() => {
    let lastTs = 0;
    function handleOrientation(e: DeviceOrientationEvent) {
      const now = performance.now();
      if (now - lastTs < 16) return; // ~60 fps cap; sensor fires faster
      lastTs = now;

      type Extended = DeviceOrientationEvent & { webkitCompassHeading?: number };
      const ext = e as Extended;
      let heading: number | null = null;
      if (ext.webkitCompassHeading != null) {
        heading = ext.webkitCompassHeading;
      } else if (e.absolute && e.alpha !== null) {
        heading = (360 - e.alpha) % 360;
      }
      if (heading === null) return;
      setGpsHeading(heading);
      if (isTrackingRef.current) {
        mapRef.current?.easeTo({ bearing: heading });
      }
    }
    window.addEventListener(
      "deviceorientationabsolute" as keyof WindowEventMap,
      handleOrientation as EventListener,
      { passive: true },
    );
    window.addEventListener("deviceorientation", handleOrientation, { passive: true });
    return () => {
      window.removeEventListener(
        "deviceorientationabsolute" as keyof WindowEventMap,
        handleOrientation as EventListener,
      );
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, []);

  // ── Gallery popup: fly to selected waypoint ────────────────────────────────
  // Modal is a fixed full-screen overlay — no padding needed, just center+zoom.
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current || selectedWaypointIndex == null) return;
    const wpt = waypoints[selectedWaypointIndex];
    if (!wpt) return;
    mapRef.current.easeTo({ center: [wpt.lon, wpt.lat], zoom: 15, duration: 600 });
  }, [selectedWaypointIndex, waypoints, isMapLoaded]);

  // ── Map interaction handlers ────────────────────────────────────────────────
  const handleDragStart = useCallback(() => {}, []);

  const handleMapClick = useCallback((e: any) => {
    if (!onTrailPointClick || track.length === 0) return;

    // Find nearest track point by geographic distance — no layer query needed
    const { lng, lat } = e.lngLat;
    const SNAP_THRESHOLD_M = 250;
    let minDist = Infinity;
    let nearestIdx = -1;
    for (let i = 0; i < track.length; i++) {
      const d = haversineM(lat, lng, track[i][1], track[i][0]);
      if (d < minDist) { minDist = d; nearestIdx = i; }
    }
    if (nearestIdx >= 0 && minDist <= SNAP_THRESHOLD_M) {
      onTrailPointClick(nearestIdx);
    } else {
      onTrailPointClick(null);
    }
  }, [track, onTrailPointClick]);

  // Keep mapBearing in sync for GPS arrow rotation calculation
  const handleRotate = useCallback(() => {
    setMapBearing(mapRef.current?.getBearing() ?? 0);
  }, []);

  // ── Viewport → elevation chart sync ──────────────────────────────────────────
  // Fires once after each pan/zoom ends (moveend). Finds which track points
  // are inside the current map bounds and notifies the parent so the elevation
  // chart can auto-scale its Y-axis to the visible elevation range.
  const handleMoveEnd = useCallback(() => {
    const cb = onVisibleTrackRangeRef.current;
    if (!cb || track.length === 0 || !mapRef.current) return;

    const bounds = mapRef.current.getBounds();
    if (!bounds) return;

    let startIdx = -1;
    let endIdx   = -1;
    for (let i = 0; i < track.length; i++) {
      const [lon, lat] = track[i];
      if (bounds.contains([lon, lat])) {
        if (startIdx === -1) startIdx = i;
        endIdx = i;
      }
    }

    // Require at least 5 visible points to make a meaningful slice
    if (startIdx === -1 || endIdx - startIdx < 4) {
      cb(null);
    } else {
      cb({ startIdx, endIdx });
    }
  }, [track]); // track changes only when route changes

  // ── Compass toggle ──────────────────────────────────────────────────────────
  const centerOnGps = useCallback(() => {
    if (!gpsPos || !mapRef.current) return;
    mapRef.current.easeTo({
      center: gpsPos,
      zoom: 16,
      padding: { top: 0, left: 0, right: 0, bottom: bottomPaddingRef.current },
      duration: 600,
    });
  }, [gpsPos]);

  const toggleTracking = useCallback(async () => {
    type DOEWithPerm = typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<PermissionState>;
    };
    const DOE = DeviceOrientationEvent as DOEWithPerm;
    if (!isTracking && typeof DOE.requestPermission === "function") {
      try {
        const result = await DOE.requestPermission();
        if (result !== "granted") return;
      } catch {
        return;
      }
    }
    const next = !isTracking;
    setIsTracking(next);
    isTrackingRef.current = next;
    if (!next) mapRef.current?.easeTo({ bearing: 0, duration: 600 });
  }, [isTracking]);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  // When tracking, map bearing equals heading → arrow always points forward (0°)
  const arrowRotation = isTracking ? 0 : gpsHeading - mapBearing;

  // ── Render ─────────────────────────────────────────────────────────────────
  const controlsTransition = "bottom 0.22s ease-out";

  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        mapStyle="mapbox://styles/mapbox/outdoors-v12"
        initialViewState={{
          bounds,
          fitBoundsOptions: {
            padding: { top: 100, left: 40, right: 40, bottom: 128 },
            maxZoom: 15,
          },
        }}
        reuseMaps
        attributionControl={false}
        interactiveLayerIds={["trail-hitbox"]}
        onLoad={handleMapLoad}
        onError={(e) => setMapError(e.error?.message || "Map failed to load")}
        onDragStart={handleDragStart}
        onClick={handleMapClick}
        onRotate={handleRotate}
        onMoveEnd={handleMoveEnd}
        style={{ width: "100%", height: "100%" }}
      >
        <AttributionControl compact position="bottom-right" />

        {/* ── Approach Segments ── */}

        {/* Approach Walk Part (Emerald Dashed) */}
        {approachWalkGeoJSON && (
          <Source id="approach-walk-route" type="geojson" data={approachWalkGeoJSON}>
            {/* Casing */}
            <Layer
              id="approach-walk-casing"
              type="line"
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{ "line-color": COLOR_CASING, "line-width": 8, "line-opacity": 1.0 }}
            />
            {/* Dashed Line */}
            <Layer
              id="approach-walk-line"
              type="line"
              layout={{ "line-join": "round", "line-cap": "butt" }}
              paint={{ "line-color": COLOR_ASCENT, "line-width": 4.5, "line-dasharray": [1, 1], "line-opacity": 0.8 }}
            />
          </Source>
        )}

        {/* Approach Bus Part (Triple-Layer Road) */}
        {approachBusGeoJSON && (
          <Source id="approach-bus-route" type="geojson" data={approachBusGeoJSON}>
            {/* Casing (Outer) */}
            <Layer
              id="approach-bus-casing"
              type="line"
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{ "line-color": COLOR_CASING, "line-width": 13, "line-opacity": 1.0 }}
            />
            {/* Glow */}
            <Layer
              id="approach-bus-glow"
              type="line"
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{ "line-color": approachBusInfos[0]?.color ?? COLOR_BUS, "line-width": 16, "line-opacity": 0.12 }}
            />
            {/* Main Road Line */}
            <Layer
              id="approach-bus-line"
              type="line"
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{ "line-color": approachBusInfos[0]?.color ?? COLOR_BUS, "line-width": 10, "line-opacity": 1.0 }}
            />
            {/* Center Stripe */}
            <Layer
              id="approach-bus-center"
              type="line"
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{ "line-color": COLOR_CASING, "line-width": 1.5, "line-opacity": 0.9 }}
            />
          </Source>
        )}

        {/* ── Return Segments ── */}

        {/* Return Walk Part (Purple Dashed) */}
        {returnWalkGeoJSON && (
          <Source id="return-walk-route" type="geojson" data={returnWalkGeoJSON}>
            {/* Casing */}
            <Layer
              id="return-walk-casing"
              type="line"
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{ "line-color": COLOR_CASING, "line-width": 8, "line-opacity": 1.0 }}
            />
            {/* Dashed Line */}
            <Layer
              id="return-walk-line"
              type="line"
              layout={{ "line-join": "round", "line-cap": "butt" }}
              paint={{ "line-color": COLOR_DESCENT, "line-width": 4.5, "line-dasharray": [1, 1], "line-opacity": 0.8 }}
            />
          </Source>
        )}

        {/* Return Bus Part (Triple-Layer Road) */}
        {returnBusGeoJSON && (
          <Source id="return-bus-route" type="geojson" data={returnBusGeoJSON}>
            {/* Casing (Outer) */}
            <Layer
              id="return-bus-casing"
              type="line"
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{ "line-color": COLOR_CASING, "line-width": 13, "line-opacity": 1.0 }}
            />
            {/* Glow */}
            <Layer
              id="return-bus-glow"
              type="line"
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{ "line-color": returnBusInfos[0]?.color ?? COLOR_BUS, "line-width": 16, "line-opacity": 0.12 }}
            />
            {/* Main Road Line */}
            <Layer
              id="return-bus-line"
              type="line"
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{ "line-color": returnBusInfos[0]?.color ?? COLOR_BUS, "line-width": 10, "line-opacity": 1.0 }}
            />
            {/* Center Stripe */}
            <Layer
              id="return-bus-center"
              type="line"
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{ "line-color": COLOR_CASING, "line-width": 1.5, "line-opacity": 0.9 }}
            />
          </Source>
        )}

        {/* Ascending trail — trailhead → summit (Emerald Green) */}
        <Source id="trail-ascend" type="geojson" data={ascendGeoJSON}>
          {/* Casing */}
          <Layer
            id="trail-ascend-casing"
            type="line"
            layout={{ "line-join": "round", "line-cap": "round" }}
            paint={{ "line-color": COLOR_CASING, "line-width": 8.5, "line-opacity": 1.0 }}
          />
          {/* Main Line */}
          <Layer
            id="trail-ascend-line"
            type="line"
            layout={{ "line-join": "round", "line-cap": "round" }}
            paint={{ "line-color": COLOR_ASCENT, "line-width": 5 }}
          />
          {/* Footprints */}
          {isFootprintReady && (
            <Layer
              id="trail-ascend-footprints"
              type="symbol"
              minzoom={14}
              layout={{
                "icon-image": "footprint",
                "icon-size": 0.45,
                "symbol-placement": "line",
                "symbol-spacing": 60,
                "icon-rotate": 90,
                "icon-allow-overlap": true
              }}
            />
          )}
        </Source>

        {/* Descending trail — summit → end (Purple Indigo) */}
        {descendGeoJSON && (
          <Source id="trail-descend" type="geojson" data={descendGeoJSON}>
            {/* Casing */}
            <Layer
              id="trail-descend-casing"
              type="line"
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{ "line-color": COLOR_CASING, "line-width": 8.5, "line-opacity": 1.0 }}
            />
            {/* Main Line */}
            <Layer
              id="trail-descend-line"
              type="line"
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{ "line-color": COLOR_DESCENT, "line-width": 5 }}
            />
            {/* Footprints */}
            {isFootprintReady && (
              <Layer
                id="trail-descend-footprints"
                type="symbol"
                minzoom={14}
                layout={{
                  "icon-image": "footprint",
                  "icon-size": 0.45,
                  "symbol-placement": "line",
                  "symbol-spacing": 60,
                  "icon-rotate": 90,
                  "icon-allow-overlap": true
                }}
              />
            )}
          </Source>
        )}

        {/* Invisible hitbox over full trail — wide for easy touch */}
        <Source id="trail-hitbox-src" type="geojson" data={trailGeoJSON}>
          <Layer
            id="trail-hitbox"
            type="line"
            layout={{ "line-join": "round", "line-cap": "round" }}
            paint={{ "line-color": "rgba(0,0,0,0)", "line-width": 24 }}
          />
        </Source>

        {/* Waypoint markers — BUS_STOP excluded (shown via bus chip label instead) */}
        {waypoints.map((wpt, idx) => {
          if (wpt.type === "BUS_STOP") return null;

          // Calculate rotation for start/end points to point along the trail
          let rotation = 0;
          if (track && track.length >= 2) {
            const dStart = haversineM(wpt.lat, wpt.lon, track[0][1], track[0][0]);
            const dEnd = haversineM(wpt.lat, wpt.lon, track[track.length - 1][1], track[track.length - 1][0]);

            if (dStart < 40) {
              rotation = getBearing(track[0][1], track[0][0], track[1][1], track[1][0]);
            } else if (dEnd < 40) {
              rotation = getBearing(track[track.length - 2][1], track[track.length - 2][0], track[track.length - 1][1], track[track.length - 1][0]);
            }
          }

          return (
            <Marker
              key={`${wpt.lon}-${wpt.lat}`}
              longitude={wpt.lon}
              latitude={wpt.lat}
              anchor="center"
            >
              <WaypointDot
                wpt={wpt}
                onClick={() => onWaypointClick?.(wpt)}
                isSelected={selectedWaypointIndex === idx}
                locale={locale}
                rotation={rotation}
              />
            </Marker>
          );
        })}

        {/* Bus route label chips — centered on each bus track */}
        {approachBusTrack.length > 1 && approachBusInfos[0] && (() => {
          const mid = approachBusTrack[Math.floor(approachBusTrack.length / 2)];
          const info = approachBusInfos[0];
          return (
            <Marker key="approach-bus-chip" longitude={mid[0]} latitude={mid[1]} anchor="bottom">
              <BusChip busNumbers={info.busNumbers} color={info.color} chipTextColor={info.chipTextColor} />
            </Marker>
          );
        })()}
        {returnBusTrack.length > 1 && returnBusInfos[0] && (() => {
          const mid = returnBusTrack[Math.floor(returnBusTrack.length / 2)];
          const info = returnBusInfos[0];
          return (
            <Marker key="return-bus-chip" longitude={mid[0]} latitude={mid[1]} anchor="bottom">
              <BusChip busNumbers={info.busNumbers} color={info.color} chipTextColor={info.chipTextColor} />
            </Marker>
          );
        })()}

        {/* Photo markers — amber camera dots */}
        {photos.filter(p => p.lat != null && p.lon != null).map(photo => (
          <Marker
            key={`photo-${photo.id}`}
            longitude={photo.lon!}
            latitude={photo.lat!}
            anchor="center"
          >
            <PhotoMarker onClick={() => onPhotoClick?.(photo)} />
          </Marker>
        ))}

        {/* GPS accuracy circle — scales with zoom, shown behind the dot */}
        {gpsPos && gpsAccuracy !== null && (
          <Source
            id="gps-accuracy"
            type="geojson"
            data={createAccuracyCircle(gpsPos[0], gpsPos[1], gpsAccuracy)}
          >
            <Layer
              id="gps-accuracy-fill"
              type="fill"
              paint={{ "fill-color": "#2E5E4A", "fill-opacity": 0.18 }}
            />
            <Layer
              id="gps-accuracy-stroke"
              type="line"
              paint={{ "line-color": "#2E5E4A", "line-width": 1.5, "line-opacity": 0.55 }}
            />
          </Source>
        )}

        {/* GPS position dot — rendered only after first fix */}
        {gpsPos && (
          <Marker longitude={gpsPos[0]} latitude={gpsPos[1]} anchor="center">
            <GpsArrow rotation={arrowRotation} isOffRoute={isOffRoute} />
          </Marker>
        )}

      </Map>

      {/* GPS acquiring pill — shown while waiting for first fix */}
      {gpsAcquiring && !gpsPos && !gpsError && (
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 z-10
                     flex items-center gap-1.5 px-3 py-1.5
                     rounded-full text-white text-[12px] font-semibold
                     pointer-events-none"
          style={{
            background: "rgba(17,17,22,0.72)",
            backdropFilter: "blur(4px)",
          }}
        >
          <LocateFixed size={12} strokeWidth={2.5} />
          Locating…
        </div>
      )}

      {/* GPS accuracy chip — bottom-left, same row as the compass button */}
      {gpsPos && gpsAccuracy !== null && (
        <div
          className="absolute left-3 z-10
                     flex items-center gap-1 px-2.5 py-1
                     rounded-full text-white text-[11px] font-semibold font-num
                     pointer-events-none shadow-md"
          style={{
            bottom: controlsBottomOffset + 8,
            transition: controlsTransition,
            background: gpsAccuracy <= 20 ? "#16a34a" : gpsAccuracy <= 60 ? "#d97706" : "#dc2626",
          }}
        >
          <LocateFixed size={11} strokeWidth={2.5} />
          <span>±{Math.round(gpsAccuracy)}m</span>
        </div>
      )}

      {/* GPS error pill — shown whenever GPS fails, not just while hiking */}
      {gpsError && (
        <div
          role="alert"
          className="absolute top-2 left-1/2 -translate-x-1/2 z-10
                     flex items-center gap-1.5 px-3 py-1.5
                     rounded-full text-white text-[12px] font-semibold
                     pointer-events-none"
          style={{
            background: "rgba(17,17,22,0.85)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
            backdropFilter: "blur(4px)",
          }}
        >
          <span aria-hidden="true">🔒</span>
          {gpsError}
        </div>
      )}


      {/* Waypoint proximity alert pill — only while hiking, rest type excluded */}
      {nearAlertWaypoint && !isOffRoute && (() => {
        const ms = MARKER_STYLE[nearAlertWaypoint.type] ?? MARKER_STYLE.JUNCTION;
        const AlertIcon = ms.IconComponent;
        const pillBg = ms.bg === "#ffffff" ? COLOR_PRIMARY : ms.bg;
        return (
          <div
            role="alert"
            aria-live="polite"
            className="absolute top-2 left-1/2 -translate-x-1/2 z-10
                       flex items-center gap-1.5 px-3 py-1.5
                       rounded-full text-white text-[13px] font-semibold
                       pointer-events-none"
            style={{
              background: pillBg,
              boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
            }}
          >
            <AlertIcon size={14} color="#fff" strokeWidth={2} aria-hidden />
            {waypointAlertMessage(nearAlertWaypoint, locale)}
          </div>
        );
      })()}

      {/* My Location button — visible once GPS is started (acquiring or has fix) */}
      {(gpsPos || gpsAcquiring) && (
        <button
          onClick={gpsPos ? centerOnGps : undefined}
          aria-label={gpsPos ? "Center map on my location" : "Acquiring GPS…"}
          disabled={!gpsPos}
          className="absolute right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center shadow-lg"
          style={{
            bottom: controlsBottomOffset + 52,
            transition: controlsTransition,
            background: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(0,0,0,0.1)",
            opacity: gpsPos ? 1 : 0.5,
          }}
        >
          <Icon icon={gpsPos ? "ph:crosshair" : "ph:circle-notch"} width={18} height={18} color="#2E5E4A" />
        </button>
      )}

      {/* Off-route alert toggle — only visible while hiking */}
      {isHiking && (
        <button
          onClick={onToggleOffRoute}
          aria-label={offRouteEnabled ? "Off-route alert on — tap to disable" : "Off-route alert off — tap to enable"}
          className="absolute right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center shadow-lg"
          style={{
            bottom: controlsBottomOffset + 96,
            transition: controlsTransition,
            background: offRouteEnabled ? "var(--color-primary)" : "rgba(255,255,255,0.92)",
            border: offRouteEnabled ? "none" : "1px solid rgba(0,0,0,0.1)",
          }}
        >
          <Icon
            icon={offRouteEnabled ? "ph:bell-ringing" : "ph:bell-slash"}
            width={18}
            height={18}
            color={offRouteEnabled ? "#fff" : "#6B7280"}
          />
        </button>
      )}

      {/* Compass / auto-rotate button — floats just above the bottom sheet */}
      <button
        onClick={toggleTracking}
        aria-label={
          isTracking
            ? "Compass tracking on — tap for north-up"
            : "Tap to track device heading"
        }
        className="absolute right-3 z-10
                   w-9 h-9 rounded-full
                   flex items-center justify-center
                   shadow-lg"
        style={{
          bottom: controlsBottomOffset + 8,
          transition: controlsTransition,
          background: isTracking ? "#2E5E4A" : "rgba(255,255,255,0.92)",
          border: isTracking ? "none" : "1px solid rgba(0,0,0,0.1)",
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <polygon
            points="12,3 14,10 12,8.5 10,10"
            fill={isTracking ? "#fff" : "#2E5E4A"}
          />
          <polygon
            points="12,21 10,14 12,15.5 14,14"
            fill={isTracking ? "rgba(255,255,255,0.4)" : "rgba(46,94,74,0.35)"}
          />
          <circle
            cx="12"
            cy="12"
            r="1.5"
            fill={isTracking ? "#fff" : "#2E5E4A"}
          />
        </svg>
      </button>

      {/* Error / Missing Token Overlay */}
      {(!token || mapError) && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-50/90 p-6 text-center">
          <div className="mb-3 text-3xl">{!token ? "🔑" : "⚠️"}</div>
          <p className="text-sm font-semibold text-gray-900">
            {!token ? "Mapbox Token Missing" : "Map Initialization Failed"}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {!token
              ? "Ensure NEXT_PUBLIC_MAPBOX_TOKEN is set in .env.local"
              : mapError}
          </p>
        </div>
      )}
    </div>
  );
}
