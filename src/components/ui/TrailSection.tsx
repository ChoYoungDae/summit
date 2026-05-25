"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { getDistance } from "geolib";
import MapViewLoader from "./MapViewLoader";
import FloatingTrailHeader from "./FloatingTrailHeader";
import HikingBottomSheet from "./HikingBottomSheet";
import type { SegmentElevationInfo } from "./ElevationChart";
import { useHikingGPS } from "@/lib/useHikingGPS";
import type { ExternalGPSFix } from "@/lib/useHikingGPS";
import { useHikingLevel } from "@/lib/useHikingLevel";
import { useOffRouteSettings } from "@/lib/useOffRouteSettings";
import { useOffRouteAlert } from "@/lib/useOffRouteAlert";
import { calcLatestStartMin, nowKSTMin } from "@/lib/safetyEngine";
import { tUI, tDB } from "@/lib/i18n";
import { X, ChevronLeft, ChevronRight, RouteOff } from "lucide-react";
import { Icon } from "@iconify/react";
import type { Waypoint, ResolvedRoute, StationInfo, RoutePhoto, HikingPhase } from "@/types/trail";

// ── Constants ─────────────────────────────────────────────────────────────────

const TRAILHEAD_ACTIVE_M = 500;         // within 500 m → Active Mode
const ASCENT_SPEED_M_PER_MIN  = 2000 / 60; // 2.0 km/h
const DESCENT_SPEED_M_PER_MIN = 3200 / 60; // 3.2 km/h
const NAISMITH_MIN_PER_100M = 10;          // +10 min per 100 m vertical ascent
const SUMMIT_REST_MIN = 30;                // rest at summit before descent

/**
 * Naismith-adjusted travel time in minutes.
 * Elevation penalty applies to ascent only; pass ascentElevM=0 for descent.
 */
function naismithMinutes(distanceM: number, ascentElevM: number, speedMPerMin: number): number {
  return distanceM / speedMPerMin + (ascentElevM / 100) * NAISMITH_MIN_PER_100M;
}

// ── Nearest-waypoint helper (elevation chart cursor) ──────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Supabase Image Transformation ────────────────────────────────────────────
// Requires "Image Transformations" enabled in Supabase dashboard (Pro plan).
// Flip to true after confirming your project supports it.
const USE_IMG_TRANSFORM = false;
function renderUrl(url: string, width: number): string {
  if (!USE_IMG_TRANSFORM) return url;
  return url.replace("/object/public/", "/render/image/public/") + `?width=${width}&quality=80`;
}

// ── Photo visibility rules ────────────────────────────────────────────────────
// All photos must be within 20 m of this route's walking track to be visible.
// Photos without GPS are shown only if they belong directly to this route.
const PHOTO_PROXIMITY_KM = 0.02; // 20 metres

// ── Component ─────────────────────────────────────────────────────────────────

interface BusInfo {
  stopCoord?: [number, number];
  busNumbers?: string;
  color?: string;
  chipTextColor?: string;
}

interface Props {
  route: ResolvedRoute;
  track: [number, number, number][];
  waypoints: Waypoint[];
  approachBusTrack?: [number, number][];
  approachWalkTrack?: [number, number][];
  returnBusTrack?: [number, number][];
  returnWalkTrack?: [number, number][];
  approachIsBus?: boolean;
  returnIsBus?: boolean;
  approachBusInfos?: BusInfo[];
  returnBusInfos?: BusInfo[];
  locale?: string;
  sunsetMin?: number | null;
  approachTimeMin?: number;
  ascentMin?: number;
  descentMin?: number;
  returnTimeMin?: number;
  routeName?: string;
  backHref?: string;
}

// MIN_SHEET_H removed — sheet only renders during active hiking, starting height is 0

export default function TrailSection({
  route,
  track,
  waypoints,
  approachBusTrack = [],
  approachWalkTrack = [],
  returnBusTrack = [],
  returnWalkTrack = [],
  approachIsBus = false,
  returnIsBus = false,
  approachBusInfos = [],
  returnBusInfos = [],
  locale = "en",
  sunsetMin,
  approachTimeMin,
  ascentMin,
  descentMin,
  returnTimeMin,
  routeName,
  backHref,
}: Props) {
  const [chartHighlightIndex,   setChartHighlightIndex]   = useState<number | null>(null);
  const [selectedWaypointIndex, setSelectedWaypointIndex] = useState<number | null>(null);
  const [isHiking,              setIsHiking]              = useState(false);
  const [isLocating] = useState(false); // kept for HikingBottomSheet prop type
  // Single GPS fix forwarded from MapView's watchPosition — shared with useHikingGPS
  // so no second GPS watcher is needed.
  const [mapGpsFix,             setMapGpsFix]             = useState<ExternalGPSFix | null>(null);
  // Visible track range from MapView viewport — used to sync elevation chart Y-axis
  const [visibleTrackRange, setVisibleTrackRange] = useState<{ startIdx: number; endIdx: number } | null>(null);
  const [sheetHeightPx,         setSheetHeightPx]         = useState(0);
  const [showFarConfirm,        setShowFarConfirm]        = useState(false);
  // Header collapsed state — auto-collapses when bottom sheet expands to "mid"
  const [isHeaderCollapsed,     setIsHeaderCollapsed]     = useState(false);

  // ── Route photos ──────────────────────────────────────────────────────────
  const [photos,        setPhotos]        = useState<RoutePhoto[]>([]);
  const [activePhoto,   setActivePhoto]   = useState<RoutePhoto | null>(null);

  // Fetch route photos once on mount
  useEffect(() => {
    fetch(`/api/admin/route-photos?routeId=${route.id}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: RoutePhoto[]) => {
        if (!Array.isArray(data)) return;
        setPhotos(data);
      })
      .catch(() => {});
  }, [route.id]);

  // ── GPS proximity filter + route-relative sort ────────────────────────────
  // Build a flat [lon, lat] point list covering walk/hiking sub-tracks ONLY.
  // Bus tracks (city streets) are intentionally excluded — proximity to a bus
  // route should NOT pull in urban photos that aren't on the hiking trail.
  const routeTrackFlat = useMemo<Array<[number, number]>>(() => {
    // Sequential order: approach walk → main trail → return walk
    // This ensures photoTrailDist gives correct route-order cumulative distances.
    // Bus tracks excluded — city streets should not pull in urban photos.
    const pts: Array<[number, number]> = [];
    for (const pt of approachWalkTrack) pts.push([pt[0], pt[1]]);
    for (const pt of track)             pts.push([pt[0], pt[1]]);
    for (const pt of returnWalkTrack)   pts.push([pt[0], pt[1]]);
    return pts;
  }, [track, approachWalkTrack, returnWalkTrack]);

  // Cumulative distance (km) along routeTrackFlat — used to sort photos in trail order.
  const trackCumDist = useMemo<number[]>(() => {
    const cum = [0];
    for (let i = 1; i < routeTrackFlat.length; i++) {
      const prev = routeTrackFlat[i - 1]!;
      const curr = routeTrackFlat[i]!;
      cum.push(cum[i - 1]! + haversineKm(prev[1], prev[0], curr[1], curr[0]));
    }
    return cum;
  }, [routeTrackFlat]);

  // Returns cumulative distance (km) from route start to the nearest track point.
  // Photos without GPS get Infinity so they sort to the end.
  function photoTrailDist(p: RoutePhoto): number {
    if (p.lat == null || p.lon == null) return Infinity;
    let bestIdx = 0, bestDist = Infinity;
    for (let i = 0; i < routeTrackFlat.length; i++) {
      const pt = routeTrackFlat[i]!;
      const d = haversineKm(p.lat, p.lon, pt[1], pt[0]);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    return trackCumDist[bestIdx] ?? Infinity;
  }

  // visiblePhotos: filtered AND sorted by position along THIS route's track.
  // Candidate pool is already scoped by the API (this route + sibling routes only).
  // Client filter: photos must be within 20 m of the walking track OR within 50 m of any route waypoint.
  const visiblePhotos = useMemo<RoutePhoto[]>(() => {
    if (routeTrackFlat.length === 0) return photos;
    const filtered = photos.filter(p => {
      // No GPS: only show if it belongs directly to this route
      if (p.lat == null || p.lon == null) return p.routeId === route.id;
      
      // Has GPS: must be within 20 m of this route's walking track...
      const nearTrack = routeTrackFlat.some(pt => haversineKm(p.lat!, p.lon!, pt[1], pt[0]) < PHOTO_PROXIMITY_KM);
      if (nearTrack) return true;

      // ...OR within 50 m of any route waypoint (like starting station, bus stop, etc.)
      const nearWaypoint = waypoints.some(wpt => haversineKm(p.lat!, p.lon!, wpt.lat, wpt.lon) < 0.05);
      return nearWaypoint;
    });
    // Sort by distance along this route's track (ignores stored order_index)
    return [...filtered].sort((a, b) => photoTrailDist(a) - photoTrailDist(b));
  }, [photos, routeTrackFlat, trackCumDist, waypoints]); // eslint-disable-line react-hooks/exhaustive-deps

  // Smart preload: when activePhoto changes, preload current ± 2 neighbors.
  // Placed after visiblePhotos declaration to satisfy TS block-scoping rules.
  useEffect(() => {
    if (!activePhoto || visiblePhotos.length === 0) return;
    const idx = visiblePhotos.findIndex(p => p.id === activePhoto.id);
    if (idx === -1) return;
    [idx - 1, idx, idx + 1, idx + 2]
      .filter(i => i >= 0 && i < visiblePhotos.length)
      .forEach(i => {
        const photo = visiblePhotos[i];
        if (photo) { const img = new window.Image(); img.src = renderUrl(photo.url, 900); }
      });
  }, [activePhoto, visiblePhotos]);

  // ── Hiking mode: "preview" (far from trailhead) | "active" (within 500 m) ──
  const [hikingMode, setHikingMode] = useState<"preview" | "active">("preview");
  const hasEnteredActiveRef  = useRef(false);
  const photoTouchStartX     = useRef(0);

  // ── ETA snapshot (triggered recalculation) ───────────────────────────────
  const [etaSnapshot, setEtaSnapshot] = useState<{
    peakMin: number | null;
    trailheadMin: number | null;
    finalMin: number | null;
    updatedAt: number;
  } | null>(null);
  // Refs initialised after gps/returnTimeMin are declared below
  const gpsRef = useRef<typeof gps | null>(null);
  const returnTimeMinRef = useRef<number | null | undefined>(null);
  const approachTimeMinRef = useRef<number | undefined>(undefined);

  const { skill } = useHikingLevel();
  const skillMultiplier = skill.multiplier;

  const gps = useHikingGPS({ segments: route.segments, enabled: isHiking, fix: mapGpsFix });
  gpsRef.current = gps;
  returnTimeMinRef.current = returnTimeMin;
  approachTimeMinRef.current = approachTimeMin;

  const recalculateETA = useCallback(() => {
    const g = gpsRef.current;
    if (!g?.currentPos) return;
    const now = nowKSTMin();

    // If the user is still before the ASCENT track (at the station / on the approach),
    // add the full approach segment time so the ETA includes the walk-in.
    // Detected when the nearest ASCENT track point is track[0] and GPS is >200 m away.
    const pendingApproachMin =
      g.phase === "ascent" && g.nearestTrackIndex === 0 && g.distanceToPathM > 200
        ? (approachTimeMinRef.current ?? 0)
        : 0;

    let peakMin: number | null = null;
    let trailheadMin: number | null = null;
    if (g.phase === "ascent") {
      const toSummitMins = naismithMinutes(g.remainingM, g.remainingAscentElevM, ASCENT_SPEED_M_PER_MIN);
      peakMin = now + pendingApproachMin + Math.round(toSummitMins);
      const descentMins = naismithMinutes(g.totalDescentM, 0, DESCENT_SPEED_M_PER_MIN);
      trailheadMin = now + pendingApproachMin + Math.round(toSummitMins) + SUMMIT_REST_MIN + Math.round(descentMins);
    } else {
      trailheadMin = now + Math.round(naismithMinutes(g.remainingM, 0, DESCENT_SPEED_M_PER_MIN));
    }
    const finalMin = trailheadMin != null ? trailheadMin + (returnTimeMinRef.current ?? 0) : null;
    setEtaSnapshot({ peakMin, trailheadMin, finalMin, updatedAt: Date.now() });
  }, []);
  const { threshold: offRouteThreshold, enabled: offRouteEnabled, setEnabled: setOffRouteEnabled } = useOffRouteSettings();

  // ── Auto-detect Active Mode once near the trailhead ──────────────────────
  useEffect(() => {
    if (!isHiking) {
      hasEnteredActiveRef.current = false;
      setHikingMode("preview");
      return;
    }
    if (hasEnteredActiveRef.current) return; // already active — stay active
    if (!gps.currentPos) return;

    const near = routeTrackFlat.some((pt) =>
      getDistance(
        { latitude: gps.currentPos!.lat, longitude: gps.currentPos!.lon },
        { latitude: pt[1], longitude: pt[0] },
      ) <= TRAILHEAD_ACTIVE_M
    );
    if (near) {
      hasEnteredActiveRef.current = true;
      setHikingMode("active");
    }
  }, [isHiking, gps.currentPos, routeTrackFlat]);

  // ── ETA triggers ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isHiking) setSheetHeightPx(0);
  }, [isHiking]);

  const hasTriggeredInitialETA = useRef(false);
  useEffect(() => {
    if (!isHiking) { hasTriggeredInitialETA.current = false; setEtaSnapshot(null); return; }
    if (gps.currentPos && !hasTriggeredInitialETA.current) {
      hasTriggeredInitialETA.current = true;
      recalculateETA();
    }
  }, [isHiking, gps.currentPos, recalculateETA]);

  // Recalculate ETA automatically on ascent → descent phase transition.
  const prevPhaseRef = useRef<HikingPhase>("ascent");
  useEffect(() => {
    if (!isHiking) { prevPhaseRef.current = "ascent"; return; }
    if (gps.phase === "descent" && prevPhaseRef.current === "ascent") {
      recalculateETA();
    }
    prevPhaseRef.current = gps.phase;
  }, [isHiking, gps.phase, recalculateETA]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && isHiking) recalculateETA();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [isHiking, recalculateETA]);

  // ── Off-route alert (Active Mode only, gated by user toggle) ─────────────
  const offRoute = useOffRouteAlert({
    distanceToPathM: gps.distanceToPathM,
    threshold: offRouteThreshold,
    enabled: isHiking && hikingMode === "active" && offRouteEnabled,
    nearestTrackIndex: gps.nearestTrackIndex,
    gpsAccuracyM: gps.gpsAccuracyM,
  });

  const summitElevationM = useMemo(
    () => waypoints.find((w) => w.type === "SUMMIT")?.elevationM,
    [waypoints]
  );

  // ── Elevation segments for multi-segment chart ───────────────────────────
  const elevationSegments = useMemo<SegmentElevationInfo[]>(() => {
    return route.segments.map((seg) => ({
      type: seg.segmentType,
      isBus: false,
      busColor: seg.busDetails?.route_color,
      // For bus-combined segments, track_data holds the walk portion only;
      // the bus portion (bus_track_data) has no meaningful elevation and is excluded.
      points: seg.trackData.coordinates.map((c) => [c[0], c[1], c[2] ?? 0] as [number, number, number]),
    }));
  }, [route.segments]);

  // ── Station info ──────────────────────────────────────────────────────────
  const stationInfo = useMemo<StationInfo | undefined>(() => {
    const approachSeg = route.segments.find((s) => s.segmentType === "APPROACH");
    const sw = approachSeg?.startWaypoint;
    if (!sw || sw.type !== "STATION") return undefined;

    // Parse exit from DB field, or fall back to extracting from the name string
    // English name may be stored as "Exit 4, Sadang Station"
    let exit: number | undefined;
    let cleanEn = sw.name.en ?? "";
    let cleanKo = sw.name.ko ?? "";
    const enMatch = cleanEn.match(/^Exit\s+(\d+),\s*(.+)$/i);
    if (enMatch) { exit = parseInt(enMatch[1], 10); cleanEn = enMatch[2].trim(); }
    if (!exit && sw.exitNumber) exit = parseInt(sw.exitNumber, 10) || undefined;
    // Korean: strip "N번 출구" suffix
    cleanKo = cleanKo.replace(/\s*\d+번\s*출구\s*$/, "").trim();

    const lines = sw.subwayLine
      ? sw.subwayLine.split(",").map((s) => {
          const t = s.trim();
          const n = parseInt(t, 10);
          return !isNaN(n) && n > 0 ? n : t;
        }).filter((l) => l !== "")
      : undefined;
    return {
      name: { ...sw.name, en: cleanEn, ko: cleanKo || sw.name.ko },
      lines: lines?.length ? lines : undefined,
      exit: exit && !isNaN(exit) ? exit : undefined,
    };
  }, [route.segments]);

  // ── Safety: latestStartMin ────────────────────────────────────────────────
  const latestStartMin = useMemo(() => {
    if (route.hideSafeStart) return null;
    if (sunsetMin == null) return null;
    return calcLatestStartMin(route, sunsetMin, skillMultiplier);
  }, [route, sunsetMin, skillMultiplier]);

  const isPastLatestStart = latestStartMin != null && nowKSTMin() > latestStartMin;

  // ── ETA calculation ───────────────────────────────────────────────────────
  // While hiking: snapshot-based (triggered on Start, screen wake, manual button).
  // Pre-hike: static estimate from Last Safe Start.
  const peakETAMin = useMemo(() => {
    if (isHiking) return etaSnapshot?.peakMin ?? null;
    if (latestStartMin == null || ascentMin == null) return null;
    return latestStartMin + (approachTimeMin ?? 0) + Math.round(ascentMin * skillMultiplier);
  }, [isHiking, etaSnapshot, latestStartMin, ascentMin, approachTimeMin, skillMultiplier]);

  const trailheadETAMin = useMemo(() => {
    if (isHiking) return etaSnapshot?.trailheadMin ?? null;
    if (latestStartMin == null || ascentMin == null || descentMin == null) return null;
    return latestStartMin + (approachTimeMin ?? 0) + Math.round(ascentMin * skillMultiplier) + SUMMIT_REST_MIN + Math.round(descentMin * skillMultiplier);
  }, [isHiking, etaSnapshot, latestStartMin, ascentMin, descentMin, approachTimeMin, skillMultiplier]);

  const finalETAMin = useMemo(() => {
    if (isHiking) return etaSnapshot?.finalMin ?? null;
    if (trailheadETAMin == null) return null;
    return trailheadETAMin + (returnTimeMin ?? 0);
  }, [isHiking, etaSnapshot, trailheadETAMin, returnTimeMin]);

  // ── Elevation chart: GPS position dot during active hiking ───────────────
  const elevationHighlightIndex =
    isHiking && hikingMode === "active" && gps.currentPos !== null
      ? gps.nearestTrackIndex
      : chartHighlightIndex;

  // ── Handlers ─────────────────────────────────────────────────────────────

  // Find the nearest track index to a waypoint and sync the elevation chart.
  const handleWaypointSelect = useCallback((idx: number) => {
    setSelectedWaypointIndex(idx);
    const wpt = waypoints[idx];
    if (!wpt || track.length === 0) return;
    let nearestTrackIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < track.length; i++) {
      const pt = track[i];
      if (!pt) continue;
      const d = haversineKm(pt[1], pt[0], wpt.lat, wpt.lon);
      if (d < minDist) { minDist = d; nearestTrackIdx = i; }
    }
    setChartHighlightIndex(nearestTrackIdx);
  }, [waypoints, track]);

  const handleWaypointClick = useCallback((wpt: Waypoint) => {
    const idx = waypoints.findIndex((w) => w.id === wpt.id);
    if (idx !== -1) handleWaypointSelect(idx);
    // Search ALL photos (not just visible) — station/bus-stop photos may be outside
    // the walk track proximity filter but are still relevant to the waypoint.
    const nearby = photos.find(p =>
      p.lat != null && p.lon != null &&
      haversineKm(p.lat, p.lon, wpt.lat, wpt.lon) < 0.05
    );
    if (nearby) setActivePhoto(nearby);
  }, [waypoints, photos, handleWaypointSelect]);

  function startHiking() {
    setIsHiking(true);
    setShowFarConfirm(false);
  }

  function handleToggleHiking() {
    if (isHiking) {
      setIsHiking(false);
      return;
    }
    // If GPS fix is available, check distance to the nearest route entry point.
    // "Near" means within 500 m of either the ASCENT start OR the APPROACH start (station).
    if (mapGpsFix) {
      const near = routeTrackFlat.some((pt) =>
        getDistance(
          { latitude: mapGpsFix.lat, longitude: mapGpsFix.lon },
          { latitude: pt[1], longitude: pt[0] },
        ) <= TRAILHEAD_ACTIVE_M
      );
      if (!near) {
        setShowFarConfirm(true);
        return;
      }
    }
    startHiking();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[var(--bg)]">

      <MapViewLoader
        track={track}
        waypoints={waypoints}
        onWaypointClick={handleWaypointClick}
        isHiking={isHiking}
        selectedWaypointIndex={selectedWaypointIndex}
        approachBusTrack={approachBusTrack}
        approachWalkTrack={approachWalkTrack}
        returnBusTrack={returnBusTrack}
        returnWalkTrack={returnWalkTrack}
        approachIsBus={approachIsBus}
        returnIsBus={returnIsBus}
        approachBusInfos={approachBusInfos}
        returnBusInfos={returnBusInfos}
        bottomPadding={sheetHeightPx}
        controlsBottomOffset={sheetHeightPx}
        controlsTopOffset={isHeaderCollapsed ? 72 : 132}
        locale={locale}
        // Unified Logic: Filter out photos that are already represented as Waypoints
        photos={visiblePhotos.filter(p => {
          if (p.lat == null || p.lon == null) return true;
          // BUS_STOP has no map marker — photos near it show normally as camera icons.
          // For other waypoint types, hide the camera icon (accessible via waypoint tap).
          const isAtWaypoint = waypoints.some(wpt =>
            wpt.type !== "BUS_STOP" &&
            haversineKm(p.lat!, p.lon!, wpt.lat, wpt.lon) < 0.02
          );
          return !isAtWaypoint;
        })}
        onPhotoClick={setActivePhoto}
        offRouteEnabled={offRouteEnabled}
        onToggleOffRoute={() => setOffRouteEnabled(!offRouteEnabled)}
        offRouteThresholdM={offRouteThreshold}
        onGpsFix={setMapGpsFix}
        onVisibleTrackRange={setVisibleTrackRange}
      />

      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.22) 0%, transparent 26%), " +
            "linear-gradient(to top,   rgba(0,0,0,0.14) 0%, transparent 22%)",
          boxShadow: "inset 0 0 16px rgba(0,0,0,0.12)",
        }}
      />

      {/* ── UI Centering Wrapper ─────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none z-20 flex justify-center">
        <div className="relative w-full max-w-[480px] pointer-events-none">
          
          <FloatingTrailHeader
            isHiking={isHiking}
            stationInfo={stationInfo}
            latestStartMin={latestStartMin}
            isPastLatestStart={isPastLatestStart}
            peakETAMin={peakETAMin}
            finalETAMin={finalETAMin}
            routeName={routeName}
            backHref={backHref}
            locale={locale}
            hikingPhase={gps.phase}
            hikingMode={hikingMode}
            nightView={!!route.hideSafeStart}
            isCollapsed={isHeaderCollapsed}
            onToggleCollapse={() => setIsHeaderCollapsed((v) => !v)}
            onRecalcETA={isHiking ? recalculateETA : undefined}
            etaUpdatedAt={etaSnapshot?.updatedAt ?? null}
          />

          {/* ── Off-route alert overlay ──────────────────────────────────── */}
          {offRoute.isAlertVisible && (
            <div
              className="absolute left-4 right-4 pointer-events-auto rounded-2xl px-4 py-3 shadow-lg"
              style={{
                bottom: sheetHeightPx + 12,
                background: "rgba(255,255,255,0.97)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                boxShadow: "0 4px 20px rgba(200,54,42,0.18)",
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="shrink-0 flex items-center justify-center rounded-full mt-0.5"
                  style={{ width: 32, height: 32, background: "rgba(200,54,42,0.10)" }}
                >
                  <Icon icon="ph:warning" width={18} height={18} style={{ color: "var(--color-secondary)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold leading-snug" style={{ color: "var(--color-secondary)" }}>
                    Oops! You seem to be off the path. 😊
                  </p>
                  <p className="text-[12px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                    Check the map and rejoin the trail when safe.
                  </p>
                  <div className="flex gap-2 mt-2.5">
                    <button
                      onClick={offRoute.handleIgnoreSection}
                      className="flex-1 py-1.5 rounded-lg text-[12px] font-semibold"
                      style={{ background: "var(--color-bg-light)", color: "var(--color-primary)" }}
                    >
                      Ignore this section
                    </button>
                    <button
                      onClick={offRoute.handleMute5min}
                      className="flex-1 py-1.5 rounded-lg text-[12px] font-semibold"
                      style={{ background: "var(--color-bg-light)", color: "var(--color-text-muted)" }}
                    >
                      Mute 5 min
                    </button>
                    <button
                      onClick={offRoute.handleDismiss}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-semibold"
                      style={{ background: "rgba(200,54,42,0.10)", color: "var(--color-secondary)" }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Far-from-trailhead confirmation popup ─────────────────────── */}
          {showFarConfirm && (
            <div
              className="absolute inset-0 z-50 flex items-end justify-center pb-10 px-4 pointer-events-auto"
              style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)" }}
              onClick={() => setShowFarConfirm(false)}
            >
              <div
                className="w-full max-w-sm rounded-3xl p-6"
                style={{ background: "var(--color-card)" }}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="shrink-0 flex items-center justify-center rounded-full"
                    style={{ width: 36, height: 36, background: "rgba(200,54,42,0.10)" }}
                  >
                    <RouteOff size={20} style={{ color: "var(--color-secondary)" }} />
                  </div>
                  <p className="text-sm font-bold" style={{ color: "var(--color-secondary)" }}>
                    Not near the trail
                  </p>
                </div>
                <p className="text-sm mb-5" style={{ color: "var(--color-text-muted)" }}>
                  {tUI("notNearTrail", locale)}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowFarConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: "var(--color-bg-light)", color: "var(--color-text-muted)" }}
                  >
                    {tUI("cancel", locale)}
                  </button>
                  <button
                    onClick={startHiking}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                    style={{ background: "var(--color-primary)" }}
                  >
                    {tUI("startAnyway", locale)}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Start Hiking floating button (pre-hike only) ─────────────── */}
          {!isHiking && (
            <div className="absolute bottom-8 left-4 right-4 flex pointer-events-auto">
              <button
                onClick={handleToggleHiking}
                className="flex-1 py-4 rounded-full text-base font-bold text-white shadow-xl active:scale-95 transition-transform"
                style={{ background: "var(--color-primary)" }}
              >
                {tUI("startHiking", locale)}
              </button>
            </div>
          )}

          {/* ── Active hiking bottom sheet ────────────────────────────────── */}
          {isHiking && (
            <HikingBottomSheet
              isHiking={isHiking}
              hikingMode={hikingMode}
              isLocating={isLocating}
              onToggleHiking={handleToggleHiking}
              gps={gps}
              track={track}
              elevationSegments={elevationSegments}
              summitElevationM={summitElevationM}
              highlightIndex={elevationHighlightIndex}
              visibleTrackRange={visibleTrackRange}
              onSheetHeightChange={setSheetHeightPx}
              onSnapChange={(snap) => setIsHeaderCollapsed(snap === "mid")}
              offRouteEnabled={offRouteEnabled}
              onToggleOffRoute={() => setOffRouteEnabled(!offRouteEnabled)}
            />
          )}

          {/* ── Photo description popup (Unified for Photos & Waypoints) ── */}
          {activePhoto && (() => {
            const photoIndex = visiblePhotos.findIndex(p => p.id === activePhoto.id);
            const canPrev    = photoIndex > 0;
            const canNext    = photoIndex !== -1 && photoIndex < visiblePhotos.length - 1;

            // Find if this photo represents a Waypoint (increased threshold to 100m)
            let linkedWpt: Waypoint | null = null;
            if (activePhoto.lat != null && activePhoto.lon != null) {
              const minDist = 0.1; // 100 meters
              linkedWpt = waypoints.find(wpt => haversineKm(activePhoto.lat!, activePhoto.lon!, wpt.lat, wpt.lon) < minDist) || null;
            }

            const photoDesc = activePhoto.description ? (typeof activePhoto.description === 'string' ? activePhoto.description : tDB(activePhoto.description as any, locale)) : "";
            const wptDesc   = linkedWpt?.description ? tDB(linkedWpt.description, locale) : "";
            const displayCaption = photoDesc || wptDesc;

            return (
              <div
                className="absolute inset-0 z-50 flex items-center justify-center px-4 pointer-events-auto"
                style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
                onClick={() => setActivePhoto(null)}
              >
                <div
                  className="w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
                  style={{ background: "var(--color-card)" }}
                  onClick={e => e.stopPropagation()}
                >
                  {/* Photo Section */}
                  <div
                    className="relative w-full"
                    style={{ aspectRatio: "1 / 1" }}
                    onTouchStart={e => { photoTouchStartX.current = e.touches[0].clientX; }}
                    onTouchEnd={e => {
                      const delta = e.changedTouches[0].clientX - photoTouchStartX.current;
                      if (delta >  50 && canPrev) setActivePhoto(visiblePhotos[photoIndex - 1]);
                      if (delta < -50 && canNext) setActivePhoto(visiblePhotos[photoIndex + 1]);
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={renderUrl(activePhoto.url, 900)}
                      alt=""
                      className="w-full h-full object-cover"
                      style={{ objectPosition: "center 65%" }}
                    />

                    {/* Top-left: type chip (from photo tag OR linked waypoint) */}
                    {(() => {
                      // Priority: explicit waypointType tag > GPS-linked waypoint type
                      const chipType = activePhoto.waypointType ?? linkedWpt?.type ?? null;
                      if (!chipType) return null;

                      const CHIP_STYLE: Record<string, { bg: string; icon: string }> = {
                        SUMMIT:   { bg: "rgba(217,119,6,0.88)",  icon: "ph:flag" },
                        PEAK:     { bg: "rgba(234,88,12,0.88)",  icon: "ph:triangle" },
                        VIEW:     { bg: "rgba(8,145,178,0.88)",  icon: "ph:binoculars" },
                        LANDMARK: { bg: "rgba(67,56,202,0.88)",  icon: "ph:flag-banner" },
                        TRAILHEAD:{ bg: "rgba(22,163,74,0.88)",  icon: "ph:person-simple-walk" },
                        JUNCTION: { bg: "rgba(109,40,217,0.88)", icon: "ph:git-fork" },
                        SHELTER:  { bg: "rgba(75,85,99,0.88)",   icon: "ph:house-simple" },
                        CAUTION:  { bg: "rgba(220,38,38,0.88)",  icon: "ph:warning" },
                        STATION:  { bg: "rgba(37,99,235,0.88)",  icon: "ph:train" },
                        BUS_STOP: { bg: "rgba(13,148,136,0.88)", icon: "ph:bus" },
                      };
                      const style = CHIP_STYLE[chipType] ?? { bg: "rgba(46,94,74,0.88)", icon: "ph:map-pin" };

                      // Name: from linked waypoint if available, else just the type label
                      const chipName = linkedWpt
                        ? tDB(linkedWpt.name, locale)
                        : chipType.charAt(0) + chipType.slice(1).toLowerCase().replace("_", " ");
                      const elevation = linkedWpt?.elevationM;

                      return (
                        <div className="absolute top-3 left-3 flex items-center gap-1.5 pointer-events-none"
                             style={{ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", background: style.bg, borderRadius: 9999, paddingLeft: 8, paddingRight: elevation ? 10 : 10, paddingTop: 5, paddingBottom: 5 }}>
                          <Icon icon={style.icon} width={13} height={13} style={{ color: "#fff", flexShrink: 0 }} />
                          <span className="text-white text-[12px] font-bold leading-none">{chipName}</span>
                          {elevation && (
                            <span className="text-white/80 text-[11px] font-num leading-none">{elevation}m</span>
                          )}
                        </div>
                      );
                    })()}

                    {/* Close Button */}
                    <button
                      onClick={() => setActivePhoto(null)}
                      className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center
                                 bg-black/35 backdrop-blur-md text-white hover:bg-black/55 transition-colors z-10"
                      aria-label="Close"
                    >
                      <X size={18} strokeWidth={2.5} />
                    </button>

                    {/* Navigation Arrows */}
                    {canPrev && (
                      <button
                        onClick={() => setActivePhoto(visiblePhotos[photoIndex - 1])}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center
                                   bg-black/25 backdrop-blur-sm text-white hover:bg-black/45 transition-colors"
                        aria-label="Previous photo"
                      >
                        <ChevronLeft size={22} strokeWidth={2.5} />
                      </button>
                    )}
                    {canNext && (
                      <button
                        onClick={() => setActivePhoto(visiblePhotos[photoIndex + 1])}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center
                                   bg-black/25 backdrop-blur-sm text-white hover:bg-black/45 transition-colors"
                        aria-label="Next photo"
                      >
                        <ChevronRight size={22} strokeWidth={2.5} />
                      </button>
                    )}

                    {/* Counter */}
                    {visiblePhotos.length > 1 && photoIndex !== -1 && (
                      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[12px] font-num text-white/90 bg-black/35 backdrop-blur-md px-3 py-1 rounded-full">
                        {photoIndex + 1} / {visiblePhotos.length}
                      </p>
                    )}
                  </div>

                  {/* Caption Section */}
                  {displayCaption && (
                    <div className="px-6 py-5">
                      <div className="text-center">
                        <p
                          className="inline-block text-left text-[15px] leading-relaxed text-[var(--color-text-body)]"
                          style={{ whiteSpace: "pre-wrap", ...(locale === "ko" ? { fontFamily: "var(--font-ko)" } : {}) }}
                        >
                          {displayCaption}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
