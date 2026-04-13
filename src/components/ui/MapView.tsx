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
import type { Waypoint } from "@/types/trail";
import { Footprints, GitFork, Camera, Flag, TrainFront, Bus } from "lucide-react";
import { Icon } from "@iconify/react";
import { t } from "@/lib/i18n";

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
};

/** Types that trigger a proximity notification pill while hiking */
const ALERT_ON_TYPES = new Set<string>(["SUMMIT", "JUNCTION", "TRAILHEAD"]);

// ── Static UI strings (5 supported locales) ───────────────────────────────────
const UI_STRINGS: Record<string, { offRoute: string; gpsHttps: string; alert: Record<string, string> }> = {
  en: {
    offRoute: "Off route — return to the trail",
    gpsHttps: "HTTPS required for GPS",
    alert: {
      JUNCTION:  "Check your path! Make sure you're heading the right way.",
      SUMMIT:    "You've reached the summit",
      TRAILHEAD: "Trailhead ahead",
    },
  },
  ko: {
    offRoute: "경로 이탈 — 등산로로 돌아가세요",
    gpsHttps: "GPS를 사용하려면 HTTPS가 필요합니다",
    alert: {
      JUNCTION:  "경로를 확인하세요! 올바른 방향으로 가고 있는지 확인하세요.",
      SUMMIT:    "정상에 도달했습니다",
      TRAILHEAD: "등산로 입구가 가까워졌습니다",
    },
  },
  zh: {
    offRoute: "偏离路线 — 请返回登山道",
    gpsHttps: "GPS需要HTTPS连接",
    alert: {
      JUNCTION:  "请确认路线！确保您朝正确方向行进。",
      SUMMIT:    "您已到达山顶",
      TRAILHEAD: "登山口在前方",
    },
  },
  ja: {
    offRoute: "ルート外れ — 登山道に戻ってください",
    gpsHttps: "GPSにはHTTPSが必要です",
    alert: {
      JUNCTION:  "ルートを確認してください！正しい方向に進んでいるか確認してください。",
      SUMMIT:    "山頂に到達しました",
      TRAILHEAD: "登山口が近くにあります",
    },
  },
  es: {
    offRoute: "Fuera de ruta — regresa al sendero",
    gpsHttps: "Se requiere HTTPS para el GPS",
    alert: {
      JUNCTION:  "¡Verifica tu ruta! Asegúrate de ir en la dirección correcta.",
      SUMMIT:    "Has llegado a la cima",
      TRAILHEAD: "Entrada al sendero adelante",
    },
  },
};

// ── Constants ─────────────────────────────────────────────────────────────────
const OFF_ROUTE_M      = 50;
const GPS_POLL_MS      = 6_000;
const WAYPOINT_ALERT_M = 40;

// ── Geometry ──────────────────────────────────────────────────────────────────
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
): boolean {
  for (const [tLon, tLat] of track) {
    if (haversineM(lat, lon, tLat, tLon) < OFF_ROUTE_M) return false;
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
      title={t(wpt.name, locale)}
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
      title={t(wpt.name, locale)}
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
  const wptName = t(wpt.name, locale);
  switch (wpt.type) {
    case "JUNCTION":  return ui.alert.JUNCTION;
    case "SUMMIT":    return `${ui.alert.SUMMIT} — ${wptName}`;
    case "TRAILHEAD": return `${ui.alert.TRAILHEAD} — ${wptName}`;
    default:          return wptName;
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
  return (
    <div
      style={{
        width: 28,
        height: 28,
        pointerEvents: "none",
        transform: `rotate(${rotation}deg)`,
        transformOrigin: "50% 50%",
        transition: "transform 0.2s linear",
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width="28"
        height="28"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 2 L20 20 L12 15 L4 20 Z"
          fill={isOffRoute ? COLOR_GPS_OFF : COLOR_GPS}
          stroke="white"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
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
  hoveredPoint?: [number, number, number] | null;
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
  /** Bus chip info for the approach segment */
  approachBusInfo?: BusSegmentInfo;
  /** Bus chip info for the return segment */
  returnBusInfo?: BusSegmentInfo;
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
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MapView({
  track,
  waypoints,
  hoveredPoint,
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
  approachBusInfo,
  returnBusInfo,
  bottomPadding = 0,
  controlsBottomOffset = 88,
  locale = "en",
}: MapViewProps) {
  const mapRef = useRef<MapRef>(null);

  // GPS state — React owns position, no manual DOM marker manipulation
  const [gpsPos,       setGpsPos]       = useState<[number, number] | null>(null);
  const [gpsHeading,   setGpsHeading]   = useState(0);
  const [isOffRoute,   setIsOffRoute]   = useState(false);
  const [isMapLoaded,  setIsMapLoaded]  = useState(false);

  // Map / compass state
  const [isTracking, setIsTracking] = useState(false);
  const [mapBearing, setMapBearing] = useState(0);
  const [mapError,   setMapError]   = useState<string | null>(null);
  const [gpsError,   setGpsError]   = useState<string | null>(null);

  // Refs for stable interval/closure access
  const isTrackingRef   = useRef(false);
  const isHikingRef     = useRef(isHiking);
  const gpsIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackRef        = useRef(track); // stable reference for interval closure

  // Keep isHikingRef in sync with prop; reset off-route when hiking stops
  useEffect(() => {
    isHikingRef.current = isHiking;
    if (!isHiking) {
      setIsOffRoute(false);
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
    // Hiking just started — center map on user's GPS position if available
    if (gpsPos && isMapLoaded && mapRef.current) {
      mapRef.current.easeTo({ center: gpsPos, zoom: 16, duration: 700 });
    } else {
      // No GPS fix yet — trigger an immediate poll so we get one quickly
      pollGps();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHiking]);

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

  // ── GPS polling ─────────────────────────────────────────────────────────────
  const pollGps = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon, heading, speed } = pos.coords;
        setGpsPos([lon, lat]);
        if (isHikingRef.current) {
          setIsOffRoute(checkOffRoute(lat, lon, trackRef.current));
        }
        if (heading !== null && speed !== null && speed > 0.5) {
          setGpsHeading(heading);
          if (isTrackingRef.current) {
            mapRef.current?.easeTo({ bearing: heading });
          }
        }
      },
      (err) => {
        console.warn("[GPS]", err.message);
        if (err.message.includes("secure origins") || err.code === 1) {
          setGpsError((UI_STRINGS[locale] ?? UI_STRINGS.en).gpsHttps);
        }
      },
      { enableHighAccuracy: true, maximumAge: GPS_POLL_MS, timeout: 20_000 },
    );
  }, []); // stable — only touches refs and state setters

  const handleMapLoad = useCallback(() => {
    setIsMapLoaded(true);
    const map = mapRef.current?.getMap();
    if (map) {
      map.loadImage("/footprint.svg", (error, image) => {
        if (!error && image) map.addImage("footprint", image);
      });
    }

    mapRef.current?.fitBounds(bounds, {
      padding: { top: 100, left: 40, right: 40, bottom: bottomPadding + 40 },
      maxZoom: 15,
    });
    pollGps();
    gpsIntervalRef.current = setInterval(pollGps, GPS_POLL_MS);
  // bottomPadding is intentionally excluded — only matters at load time
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds, pollGps]);

  // Animate map camera padding as the bottom sheet rises / falls
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current) return;
    mapRef.current.easeTo({
      padding: { top: 0, left: 0, right: 0, bottom: bottomPadding },
      duration: 320,
    });
  }, [bottomPadding, isMapLoaded]);

  // Cleanup GPS interval on unmount
  useEffect(() => {
    return () => {
      if (gpsIntervalRef.current !== null) {
        clearInterval(gpsIntervalRef.current);
        gpsIntervalRef.current = null;
      }
    };
  }, []);

  // Vibrate on off-route detection (only when hiking)
  useEffect(() => {
    if (isOffRoute && isHiking && "vibrate" in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  }, [isOffRoute, isHiking]);

  // ── Device orientation (compass heading) ───────────────────────────────────
  useEffect(() => {
    function handleOrientation(e: DeviceOrientationEvent) {
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

  // ── Sync Focus ─────────────────────────────────────────────────────────────
  // Snap map to hovered point from elevation chart
  useEffect(() => {
    if (!hoveredPoint) return;
    const [lon, lat] = hoveredPoint;
    const map = mapRef.current;
    if (!map) return;

    // Snappy follow center — 450ms feels responsive
    // This now works even when isHiking is true, prioritizing manual exploration
    map.easeTo({ center: [lon, lat], duration: 450 });
  }, [hoveredPoint]);

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

  // ── Compass toggle ──────────────────────────────────────────────────────────
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
  // Transition duration matches HikingBottomSheet snap animation
  const controlsTransition = "bottom 0.32s cubic-bezier(0.32,0.72,0,1)";

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
              paint={{ "line-color": approachBusInfo?.color ?? COLOR_BUS, "line-width": 16, "line-opacity": 0.12 }}
            />
            {/* Main Road Line */}
            <Layer
              id="approach-bus-line"
              type="line"
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{ "line-color": approachBusInfo?.color ?? COLOR_BUS, "line-width": 10, "line-opacity": 1.0 }}
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
              paint={{ "line-color": returnBusInfo?.color ?? COLOR_BUS, "line-width": 16, "line-opacity": 0.12 }}
            />
            {/* Main Road Line */}
            <Layer
              id="return-bus-line"
              type="line"
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{ "line-color": returnBusInfo?.color ?? COLOR_BUS, "line-width": 10, "line-opacity": 1.0 }}
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

        {/* Waypoint markers */}
        {waypoints.map((wpt, idx) => {
          // Calculate rotation for start/end points to point along the trail
          let rotation = 0;
          if (track && track.length >= 2) {
            const dStart = haversineM(wpt.lat, wpt.lon, track[0][1], track[0][0]);
            const dEnd = haversineM(wpt.lat, wpt.lon, track[track.length - 1][1], track[track.length - 1][0]);
            
            if (dStart < 40) {
              // Point directed towards the first segment
              rotation = getBearing(track[0][1], track[0][0], track[1][1], track[1][0]);
            } else if (dEnd < 40) {
              // Point directed along the last segment
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

        {/* Bus stop markers — shown at the boarding/alighting point of bus segments */}
        {approachIsBus && approachBusInfo?.stopCoord && (
          <Marker
            longitude={approachBusInfo.stopCoord[0]}
            latitude={approachBusInfo.stopCoord[1]}
            anchor="bottom"
          >
            <BusChip 
              busNumbers={approachBusInfo.busNumbers} 
              color={approachBusInfo.color} 
              chipTextColor={approachBusInfo.chipTextColor} 
            />
          </Marker>
        )}
        {returnIsBus && returnBusInfo?.stopCoord && (
          <Marker
            longitude={returnBusInfo.stopCoord[0]}
            latitude={returnBusInfo.stopCoord[1]}
            anchor="bottom"
          >
            <BusChip 
              busNumbers={returnBusInfo.busNumbers} 
              color={returnBusInfo.color} 
              chipTextColor={returnBusInfo.chipTextColor} 
            />
          </Marker>
        )}

        {/* Elevation-chart hover sync marker */}
        {hoveredPoint && (
          <Marker longitude={hoveredPoint[0]} latitude={hoveredPoint[1]} anchor="center">
            <HoverDot ele={hoveredPoint[2]} />
          </Marker>
        )}

        {/* GPS position — rendered only after first fix */}
        {gpsPos && (
          <Marker longitude={gpsPos[0]} latitude={gpsPos[1]} anchor="center">
            <GpsArrow rotation={arrowRotation} isOffRoute={isOffRoute} />
          </Marker>
        )}

      </Map>

      {/* GPS Secure Origin (HTTPS) warning pill */}
      {gpsError && isHiking && (
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

      {/* Off-route warning banner — only while hiking */}
      {isHiking && isOffRoute && gpsPos && (
        <div
          role="alert"
          aria-live="assertive"
          className="absolute top-3 left-4 right-4 z-10
                     flex items-center justify-center gap-2 px-4 py-3
                     rounded-2xl text-white text-sm font-bold
                     pointer-events-none"
          style={{
            background: COLOR_GPS_OFF,
            boxShadow: "0 4px 16px rgba(200,54,42,0.45)",
            animation: "offRoutePulse 1.4s ease-in-out infinite",
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 16 }}>⚠</span>
          {(UI_STRINGS[locale] ?? UI_STRINGS.en).offRoute}
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
