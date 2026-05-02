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
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Icon } from "@iconify/react";
import type { Waypoint, ResolvedRoute, StationInfo, RoutePhoto } from "@/types/trail";

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

const MIN_SHEET_H = 88;

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
  const [sheetHeightPx,         setSheetHeightPx]         = useState(MIN_SHEET_H);
  const [showFarConfirm,        setShowFarConfirm]        = useState(false);
  const [showOffRoutePrompt,    setShowOffRoutePrompt]    = useState(false);
  // Header collapsed state — auto-collapses when bottom sheet expands to "mid"
  const [isHeaderCollapsed,     setIsHeaderCollapsed]     = useState(false);

  // ── Route photos ──────────────────────────────────────────────────────────
  const [photos,        setPhotos]        = useState<RoutePhoto[]>([]);
  const [activePhoto,   setActivePhoto]   = useState<RoutePhoto | null>(null);

  // Fetch route photos once on mount, then preload all into browser cache
  useEffect(() => {
    fetch(`/api/admin/route-photos?routeId=${route.id}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: RoutePhoto[]) => {
        if (!Array.isArray(data)) return;
        setPhotos(data);
        data.forEach(p => { const img = new window.Image(); img.src = renderUrl(p.url, 900); });
      })
      .catch(() => {});
  }, [route.id]);

  // ── Hiking mode: "preview" (far from trailhead) | "active" (within 500 m) ──
  const [hikingMode, setHikingMode] = useState<"preview" | "active">("preview");
  const hasEnteredActiveRef  = useRef(false);
  const photoTouchStartX     = useRef(0);

  const { skill } = useHikingLevel();
  const skillMultiplier = skill.multiplier;

  const gps = useHikingGPS({ segments: route.segments, enabled: isHiking, fix: mapGpsFix });
  const { threshold: offRouteThreshold, enabled: offRouteEnabled, setEnabled: setOffRouteEnabled } = useOffRouteSettings();

  // ── Auto-detect Active Mode once near the trailhead ──────────────────────
  useEffect(() => {
    if (!isHiking) {
      hasEnteredActiveRef.current = false;
      setHikingMode("preview");
      return;
    }
    if (hasEnteredActiveRef.current) return; // already active — stay active
    if (!gps.currentPos || track.length === 0) return;

    const trailhead = track[0]!;
    const dist = getDistance(
      { latitude: gps.currentPos.lat, longitude: gps.currentPos.lon },
      { latitude: trailhead[1], longitude: trailhead[0] },
    );
    if (dist <= TRAILHEAD_ACTIVE_M) {
      hasEnteredActiveRef.current = true;
      setHikingMode("active");
    }
  }, [isHiking, gps.currentPos, track]);

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
  // Active mode: Naismith-adjusted real-time ETA from GPS position.
  //   Ascent  → 2.0 km/h + 10 min per 100 m vertical gain remaining
  //   Descent → 3.2 km/h, no elevation penalty
  //   Summit rest: +30 min added between peak and final ETA
  // Preview mode: static offset from segment estimates.
  const peakETAMin = useMemo(() => {
    // GPS real-time mode: only when actively hiking near the trailhead.
    if (isHiking && hikingMode === "active" && gps.currentPos) {
      if (gps.phase === "descent") return null;
      const mins = naismithMinutes(gps.remainingM, gps.remainingAscentElevM, ASCENT_SPEED_M_PER_MIN);
      return nowKSTMin() + Math.round(mins);
    }
    // Pre-hike or started-but-far: show ETA relative to Last Safe Start.
    if (latestStartMin == null) return null;
    if (ascentMin != null) {
      return latestStartMin + (approachTimeMin ?? 0) + Math.round(ascentMin * skillMultiplier);
    }
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHiking, hikingMode, gps.currentPos, gps.phase, gps.remainingM, gps.remainingAscentElevM, latestStartMin, ascentMin, approachTimeMin, skillMultiplier]);

  const trailheadETAMin = useMemo(() => {
    // GPS real-time mode: only when actively hiking near the trailhead.
    if (isHiking && hikingMode === "active" && gps.currentPos) {
      if (gps.phase === "ascent") {
        const toSummitMins = naismithMinutes(gps.remainingM, gps.remainingAscentElevM, ASCENT_SPEED_M_PER_MIN);
        const descentMins  = naismithMinutes(gps.totalDescentM, 0, DESCENT_SPEED_M_PER_MIN);
        return nowKSTMin() + Math.round(toSummitMins) + SUMMIT_REST_MIN + Math.round(descentMins);
      }
      return nowKSTMin() + Math.round(naismithMinutes(gps.remainingM, 0, DESCENT_SPEED_M_PER_MIN));
    }
    // Pre-hike or started-but-far: show ETA relative to Last Safe Start.
    if (latestStartMin == null) return null;
    if (ascentMin != null && descentMin != null) {
      return (
        latestStartMin +
        (approachTimeMin ?? 0) +
        Math.round(ascentMin * skillMultiplier) +
        SUMMIT_REST_MIN +
        Math.round(descentMin * skillMultiplier)
      );
    }
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHiking, hikingMode, gps.currentPos, gps.phase, gps.remainingM, gps.remainingAscentElevM, gps.totalDescentM, latestStartMin, ascentMin, descentMin, approachTimeMin, skillMultiplier]);

  const finalETAMin = useMemo(() => {
    const thETA = trailheadETAMin;
    if (thETA == null) return null;
    return thETA + (returnTimeMin ?? 0);
  }, [trailheadETAMin, returnTimeMin]);

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
  }, [waypoints, handleWaypointSelect]);

  function startHiking() {
    setIsHiking(true);
    setShowFarConfirm(false);
    setShowOffRoutePrompt(false);
  }

  function checkDistAndPrompt(lat: number, lon: number) {
    const trailhead = track[0]!;
    const dist = getDistance(
      { latitude: lat, longitude: lon },
      { latitude: trailhead[1], longitude: trailhead[0] },
    );
    if (dist > TRAILHEAD_ACTIVE_M) {
      setShowFarConfirm(true);
    } else {
      setShowOffRoutePrompt(true);
    }
  }

  function handleToggleHiking() {
    if (isHiking) {
      setIsHiking(false);
      return;
    }
    // MapView's GPS watch already has a fix — use it for distance check.
    if (mapGpsFix) {
      checkDistAndPrompt(mapGpsFix.lat, mapGpsFix.lon);
      return;
    }
    // No GPS fix yet — start immediately without distance check.
    // The map will center on the user once the first fix arrives.
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
        locale={locale}
        // Unified Logic: Filter out photos that are already represented as Waypoints
        photos={photos.filter(p => {
          if (p.lat == null || p.lon == null) return true;
          // If a waypoint is within 20m of this photo, don't show it as a separate camera icon
          const isAtWaypoint = waypoints.some(wpt => haversineKm(p.lat!, p.lon!, wpt.lat, wpt.lon) < 0.02);
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
            trailheadETAMin={trailheadETAMin}
            finalETAMin={finalETAMin}
            routeName={routeName}
            backHref={backHref}
            locale={locale}
            hikingPhase={gps.phase}
            hikingMode={hikingMode}
            nightView={!!route.hideSafeStart}
            isCollapsed={isHeaderCollapsed}
            onToggleCollapse={() => setIsHeaderCollapsed((v) => !v)}
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
                    <Icon icon="ph:map-pin-simple-slash" width={20} height={20} style={{ color: "var(--color-secondary)" }} />
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
            showOffRoutePrompt={showOffRoutePrompt}
            offRouteEnabled={offRouteEnabled}
            onToggleOffRoute={() => setOffRouteEnabled(!offRouteEnabled)}
            onConfirmStart={startHiking}
            onCancelPrompt={() => setShowOffRoutePrompt(false)}
          />

          {/* ── Photo description popup (Unified for Photos & Waypoints) ── */}
          {activePhoto && (() => {
            const photoIndex = photos.findIndex(p => p.id === activePhoto.id);
            const canPrev    = photoIndex > 0;
            const canNext    = photoIndex < photos.length - 1;

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
                      if (delta >  50 && canPrev) setActivePhoto(photos[photoIndex - 1]);
                      if (delta < -50 && canNext) setActivePhoto(photos[photoIndex + 1]);
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={renderUrl(activePhoto.url, 900)}
                      alt=""
                      className="w-full h-full object-cover"
                      style={{ objectPosition: "center 65%" }}
                    />

                    {/* Waypoint Indicator Overlay */}
                    {linkedWpt && (
                      <div className="absolute top-4 left-4 right-4 flex flex-col items-start gap-1 pointer-events-none">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-md shadow-lg">
                          <span className="text-[10px] font-black text-white px-2 py-0.5 rounded-full bg-[var(--color-primary)] uppercase tracking-tighter">
                            {tUI(`wpt_${linkedWpt.type.toLowerCase()}` as any, locale) || linkedWpt.type}
                          </span>
                          <span className="text-[15px] font-black text-[var(--color-text-primary)] tracking-tight">
                            {tDB(linkedWpt.name, locale)}
                          </span>
                          {linkedWpt.elevationM && (
                            <span className="text-[12px] font-bold text-[var(--color-text-muted)] ml-0.5">
                              {linkedWpt.elevationM}m
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Close Button */}
                    <button
                      onClick={() => setActivePhoto(null)}
                      className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center
                                 bg-black/35 backdrop-blur-md text-white hover:bg-black/55 transition-colors z-10"
                      aria-label="Close"
                    >
                      <X size={18} strokeWidth={2.5} />
                    </button>

                    {/* Navigation Arrows */}
                    {canPrev && (
                      <button
                        onClick={() => setActivePhoto(photos[photoIndex - 1])}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center
                                   bg-black/25 backdrop-blur-sm text-white hover:bg-black/45 transition-colors"
                        aria-label="Previous photo"
                      >
                        <ChevronLeft size={22} strokeWidth={2.5} />
                      </button>
                    )}
                    {canNext && (
                      <button
                        onClick={() => setActivePhoto(photos[photoIndex + 1])}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center
                                   bg-black/25 backdrop-blur-sm text-white hover:bg-black/45 transition-colors"
                        aria-label="Next photo"
                      >
                        <ChevronRight size={22} strokeWidth={2.5} />
                      </button>
                    )}

                    {/* Counter */}
                    {photos.length > 1 && (
                      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[12px] font-num text-white/90 bg-black/35 backdrop-blur-md px-3 py-1 rounded-full">
                        {photoIndex + 1} / {photos.length}
                      </p>
                    )}
                  </div>

                  {/* Caption Section */}
                  {displayCaption && (
                    <div className="px-6 py-5">
                      <p
                        className="text-[15px] leading-relaxed text-[var(--color-text-body)] text-center"
                        style={locale === "ko" ? { fontFamily: "var(--font-ko)" } : undefined}
                      >
                        {displayCaption}
                      </p>
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
