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
import { Footprints, GitFork, Camera, Flag, TrainFront } from "lucide-react";

type AccessMode = "walk" | "bus";
import { t } from "@/lib/i18n";

// ── Brand colors ──────────────────────────────────────────────────────────────
const COLOR_PRIMARY      = "#2E5E4A"; // Namsan Pine Green
const COLOR_SECONDARY    = "#C8362A"; // Dancheong Red
const COLOR_DESCEND      = "#6366F1"; // Purple Indigo (Vibrant)
const COLOR_GPS          = "#2E5E4A";
const COLOR_GPS_OFF      = "#C8362A";

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
  const size = isSelected ? 34 : 30;

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
        borderRadius: "4px", // Square with slight rounding
        boxShadow: isSelected
          ? `0 0 0 2px #fff, 0 4px 12px rgba(0,0,0,0.5)`
          : "0 2px 8px rgba(0,0,0,0.35)",
        cursor: "pointer",
        userSelect: "none",
        transition: "width 0.2s, height 0.2s, box-shadow 0.2s",
      }}
    >
      {exitNum ? (
        <span
          style={{
            fontWeight: 900,
            fontSize: isSelected ? 19 : 17,
            color: TEXT_YELLOW,
            lineHeight: 1,
            fontFamily: "var(--font-ko)", // Use bold Korean font for numbers if needed
          }}
        >
          {exitNum}
        </span>
      ) : (
        <TrainFront size={isSelected ? 19 : 17} color={TEXT_YELLOW} strokeWidth={2.5} />
      )}
    </div>
  );
}

function WaypointDot({
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
      <Icon size={iconSize} color={s.iconColor} strokeWidth={2} />
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
export interface MapViewProps {
  track: [number, number, number][];
  waypoints: Waypoint[];
  hoveredPoint?: [number, number, number] | null;
  onWaypointClick?: (wpt: Waypoint) => void;
  onTrailPointClick?: (index: number | null) => void;
  isHiking?: boolean;
  /** Index of the currently selected waypoint — drives flyTo + marker highlight */
  selectedWaypointIndex?: number | null;
  /** GPS coordinates [lon, lat] of the access route (subway → trailhead) */
  accessTrack?: [number, number][];
  /** GPS coordinates [lon, lat] of the return route (trail exit → subway) */
  returnTrack?: [number, number][];
  /** walk → dashed green line; bus → solid orange line */
  accessMode?: AccessMode;
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
  accessTrack,
  returnTrack,
  accessMode = "walk",
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
  const [is3D,       setIs3D]       = useState(true);
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
          pitch: 45,
          duration: 800,
        });
        setIs3D(true);
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
    // Include access track coords in bounds so the full journey is visible on load
    const allLons = [
      ...track.map(([lon]) => lon),
      ...(accessTrack ?? []).map(([lon]) => lon),
    ];
    const allLats = [
      ...track.map(([, lat]) => lat),
      ...(accessTrack ?? []).map(([, lat]) => lat),
    ];
    return {
      bounds: [
        [Math.min(...allLons), Math.min(...allLats)],
        [Math.max(...allLons), Math.max(...allLats)],
      ] as [[number, number], [number, number]],
    };
  }, [track, accessTrack]);

  // Access route GeoJSON
  const accessGeoJSON = useMemo<GeoJSON.Feature<GeoJSON.LineString> | null>(() => {
    if (!accessTrack || accessTrack.length < 2) return null;
    return {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: accessTrack },
    };
  }, [accessTrack]);

  // Return route GeoJSON
  const returnGeoJSON = useMemo<GeoJSON.Feature<GeoJSON.LineString> | null>(() => {
    if (!returnTrack || returnTrack.length < 2) return null;
    return {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: returnTrack },
    };
  }, [returnTrack]);

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

  // Start GPS once the map style is loaded
  const handleMapLoad = useCallback(() => {
    setIsMapLoaded(true);
    mapRef.current?.fitBounds(bounds, {
      padding: { top: 100, left: 40, right: 40, bottom: bottomPadding + 40 },
      maxZoom: 15,
      pitch: 45,
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
  const handleDragStart = useCallback(() => {
    if ((mapRef.current?.getPitch() ?? 0) > 0) {
      mapRef.current?.easeTo({ pitch: 0, duration: 600 });
      setIs3D(false);
    }
  }, []);

  const toggle3D = useCallback(() => {
    const next = !is3D;
    setIs3D(next);
    mapRef.current?.easeTo({ pitch: next ? 45 : 0, duration: 600 });
  }, [is3D]);

  const handleMapClick = useCallback((e: any) => {
    if ((mapRef.current?.getPitch() ?? 0) > 0) {
      mapRef.current?.easeTo({ pitch: 0, duration: 600 });
      setIs3D(false);
    }
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

        {/* Access route — dashed (walk) or solid orange (bus) */}
        {accessGeoJSON && (
          <Source id="access-route" type="geojson" data={accessGeoJSON}>
            {accessMode === "bus" && (
              <Layer
                id="access-casing"
                type="line"
                layout={{ "line-join": "round", "line-cap": "round" }}
                paint={{ "line-color": "#ffffff", "line-width": 6, "line-opacity": 0.8 }}
              />
            )}
            <Layer
              id="access-line"
              type="line"
              layout={{
                "line-join": "round",
                "line-cap": accessMode === "walk" ? "butt" : "round",
              }}
              paint={
                accessMode === "walk"
                  ? {
                      "line-color": "#2E5E4A",
                      "line-width": 5,
                      "line-dasharray": [1, 1],
                      "line-opacity": 0.65,
                    }
                  : {
                      "line-color": "#F97316",
                      "line-width": 5,
                      "line-opacity": 0.9,
                    }
              }
            />
          </Source>
        )}

        {/* Return route — dashed (walk) or solid orange (bus) */}
        {returnGeoJSON && (
          <Source id="return-route" type="geojson" data={returnGeoJSON}>
            {accessMode === "bus" && (
              <Layer
                id="return-casing"
                type="line"
                layout={{ "line-join": "round", "line-cap": "round" }}
                paint={{ "line-color": "#ffffff", "line-width": 6, "line-opacity": 0.8 }}
              />
            )}
            <Layer
              id="return-line"
              type="line"
              layout={{
                "line-join": "round",
                "line-cap": accessMode === "walk" ? "butt" : "round",
              }}
              paint={
                accessMode === "walk"
                  ? {
                      "line-color": COLOR_DESCEND,
                      "line-width": 5,
                      "line-dasharray": [1, 1],
                      "line-opacity": 0.65,
                    }
                  : {
                      "line-color": "#F97316",
                      "line-width": 5,
                      "line-opacity": 0.9,
                    }
              }
            />
          </Source>
        )}

        {/* Ascending trail — trailhead → summit (Pine Green) */}
        <Source id="trail-ascend" type="geojson" data={ascendGeoJSON}>
          <Layer
            id="trail-ascend-casing"
            type="line"
            layout={{ "line-join": "round", "line-cap": "round" }}
            paint={{ "line-color": "#ffffff", "line-width": 7, "line-opacity": 1.0 }}
          />
          <Layer
            id="trail-ascend-line"
            type="line"
            layout={{ "line-join": "round", "line-cap": "round" }}
            paint={{ "line-color": COLOR_PRIMARY, "line-width": 5 }}
          />
        </Source>

        {/* Descending trail — summit → end (Cool-Down Blue) */}
        {descendGeoJSON && (
          <Source id="trail-descend" type="geojson" data={descendGeoJSON}>
            <Layer
              id="trail-descend-casing"
              type="line"
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{ "line-color": "#ffffff", "line-width": 7, "line-opacity": 1.0 }}
            />
            <Layer
              id="trail-descend-line"
              type="line"
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{ "line-color": COLOR_DESCEND, "line-width": 5 }}
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
        {waypoints.map((wpt, idx) => (
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
            />
          </Marker>
        ))}

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

      {/* 3D / 2D toggle button — floats just above the bottom sheet */}
      <button
        onClick={toggle3D}
        aria-label={is3D ? "Switch to 2D view" : "Switch to 3D view"}
        className="absolute right-3 z-10
                   w-9 h-9 rounded-full
                   flex items-center justify-center
                   shadow-lg transition-colors
                   text-[10px] font-bold"
        style={{
          bottom: controlsBottomOffset + 52,
          transition: controlsTransition,
          background: is3D ? "#2E5E4A" : "rgba(255,255,255,0.92)",
          color: is3D ? "#fff" : "#2E5E4A",
          border: is3D ? "none" : "1px solid rgba(0,0,0,0.1)",
        }}
      >
        {is3D ? "3D" : "2D"}
      </button>

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
