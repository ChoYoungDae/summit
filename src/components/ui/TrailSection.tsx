"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { getDistance } from "geolib";
import MapViewLoader from "./MapViewLoader";
import WaypointSheet from "./WaypointSheet";
import GuideCard from "./GuideCard";
import FloatingTrailHeader from "./FloatingTrailHeader";
import HikingBottomSheet from "./HikingBottomSheet";
import type { SegmentElevationInfo } from "./ElevationChart";
import { useHikingGPS } from "@/lib/useHikingGPS";
import { useHikingLevel } from "@/lib/useHikingLevel";
import { useOffRouteSettings } from "@/lib/useOffRouteSettings";
import { useOffRouteAlert } from "@/lib/useOffRouteAlert";
import { calcLatestStartMin, nowKSTMin } from "@/lib/safetyEngine";
import { Icon } from "@iconify/react";
import type { Waypoint, ResolvedRoute, StationInfo } from "@/types/trail";

// ── Constants ─────────────────────────────────────────────────────────────────

const GUIDE_RADIUS_KM = 0.35;
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

function findNearestWaypoint(pt: [number, number], waypoints: Waypoint[]): Waypoint | null {
  let nearest: Waypoint | null = null;
  let minDist = Infinity;
  for (const wpt of waypoints) {
    const d = haversineKm(pt[1], pt[0], wpt.lat, wpt.lon);
    if (d < minDist) { minDist = d; nearest = wpt; }
  }
  return minDist <= GUIDE_RADIUS_KM ? nearest : null;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface BusInfo {
  stopCoord?: [number, number];
  busNumbers?: string;
  color?: string;
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
  approachBusInfo?: BusInfo;
  returnBusInfo?: BusInfo;
  locale?: string;
  sunsetMin?: number | null;
  approachTimeMin?: number;
  ascentMin?: number;
  descentMin?: number;
  returnTimeMin?: number;
  routeName?: string;
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
  approachBusInfo,
  returnBusInfo,
  locale = "en",
  sunsetMin,
  approachTimeMin,
  ascentMin,
  descentMin,
  returnTimeMin,
  routeName,
}: Props) {
  const [hoveredPoint,          setHoveredPoint]          = useState<[number, number, number] | null>(null);
  const [chartHighlightIndex,   setChartHighlightIndex]   = useState<number | null>(null);
  const [selectedWaypointIndex, setSelectedWaypointIndex] = useState<number | null>(null);
  const [isHiking,              setIsHiking]              = useState(false);
  const [startedAtMin,          setStartedAtMin]          = useState<number | null>(null);
  const [sheetHeightPx,         setSheetHeightPx]         = useState(MIN_SHEET_H);

  // ── Hiking mode: "preview" (far from trailhead) | "active" (within 500 m) ──
  const [hikingMode, setHikingMode] = useState<"preview" | "active">("preview");
  const hasEnteredActiveRef = useRef(false);

  const { skill } = useHikingLevel();
  const skillMultiplier = skill.multiplier;

  const gps = useHikingGPS({ segments: route.segments, enabled: isHiking });
  const { threshold: offRouteThreshold } = useOffRouteSettings();

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

  // ── Off-route alert (Active Mode only) ────────────────────────────────────
  const offRoute = useOffRouteAlert({
    distanceToPathM: gps.distanceToPathM,
    threshold: offRouteThreshold,
    enabled: isHiking && hikingMode === "active",
    nearestTrackIndex: gps.nearestTrackIndex,
  });

  // ── Elevation segments for multi-segment chart ───────────────────────────
  const elevationSegments = useMemo<SegmentElevationInfo[]>(() => {
    return route.segments.map((seg) => {
      // Base walk/hiking coordinates with elevation
      let points: [number, number, number][] = seg.trackData.coordinates.map(
        (c) => [c[0], c[1], c[2] ?? 0]
      );

      // For bus-combined segments, prepend bus track (APPROACH) or append (RETURN)
      // Bus GPS usually lacks elevation so those points appear flat at ele=0.
      if (seg.isBusCombined && seg.busDetails?.bus_track_data) {
        const busPts: [number, number, number][] =
          seg.busDetails.bus_track_data.coordinates.map(
            (c) => [c[0], c[1], c[2] ?? 0]
          );
        if (seg.segmentType === "APPROACH") {
          points = [...busPts, ...points];
        } else if (seg.segmentType === "RETURN") {
          points = [...points, ...busPts];
        }
      }

      return {
        type: seg.segmentType,
        isBus: seg.isBusCombined ?? false,
        busColor: seg.busDetails?.route_color,
        points,
      };
    });
  }, [route.segments]);

  // ── Station info ──────────────────────────────────────────────────────────
  const stationInfo = useMemo<StationInfo | undefined>(() => {
    const approachSeg = route.segments.find((s) => s.segmentType === "APPROACH");
    const sw = approachSeg?.startWaypoint;
    if (!sw || sw.type !== "STATION") return undefined;
    return { name: sw.name };
  }, [route.segments]);

  // ── Safety: latestStartMin ────────────────────────────────────────────────
  const latestStartMin = useMemo(() => {
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
    if (!isHiking) return null;
    if (hikingMode === "active" && gps.currentPos) {
      if (gps.phase === "descent") return null; // already past summit
      const mins = naismithMinutes(gps.remainingM, gps.remainingAscentElevM, ASCENT_SPEED_M_PER_MIN);
      return nowKSTMin() + Math.round(mins);
    }
    if (startedAtMin != null && ascentMin != null) {
      return startedAtMin + (approachTimeMin ?? 0) + Math.round(ascentMin * skillMultiplier);
    }
    return null;
  // gps updates on position change — intentional exhaustive deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHiking, hikingMode, gps.currentPos, gps.phase, gps.remainingM, gps.remainingAscentElevM, startedAtMin, ascentMin, approachTimeMin, skillMultiplier]);

  const finalETAMin = useMemo(() => {
    if (!isHiking) return null;
    if (hikingMode === "active" && gps.currentPos) {
      if (gps.phase === "ascent") {
        // Time to summit + rest + full descent
        const toSummitMins = naismithMinutes(gps.remainingM, gps.remainingAscentElevM, ASCENT_SPEED_M_PER_MIN);
        const descentMins  = naismithMinutes(gps.totalDescentM, 0, DESCENT_SPEED_M_PER_MIN);
        return nowKSTMin() + Math.round(toSummitMins) + SUMMIT_REST_MIN + Math.round(descentMins);
      }
      // Descent phase: summit rest already done
      return nowKSTMin() + Math.round(naismithMinutes(gps.remainingM, 0, DESCENT_SPEED_M_PER_MIN));
    }
    if (startedAtMin != null && ascentMin != null && descentMin != null) {
      return (
        startedAtMin +
        (approachTimeMin ?? 0) +
        Math.round(ascentMin * skillMultiplier) +
        SUMMIT_REST_MIN +
        Math.round(descentMin * skillMultiplier) +
        (returnTimeMin ?? 0)
      );
    }
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHiking, hikingMode, gps.currentPos, gps.phase, gps.remainingM, gps.remainingAscentElevM, gps.totalDescentM, startedAtMin, ascentMin, descentMin, approachTimeMin, returnTimeMin, skillMultiplier]);

  // ── Elevation chart: GPS position dot during active hiking ───────────────
  const elevationHighlightIndex =
    isHiking && hikingMode === "active" && gps.currentPos !== null
      ? gps.nearestTrackIndex
      : chartHighlightIndex;

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleHover = useCallback((pt: [number, number, number] | null) => {
    setHoveredPoint(pt);
    if (pt !== null) setChartHighlightIndex(null);
  }, []);

  const handleTrailPointClick = useCallback((index: number | null) => {
    setChartHighlightIndex(index);
    setHoveredPoint(index !== null ? (track[index] ?? null) : null);
  }, [track]);

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

  function handleToggleHiking() {
    setIsHiking((h) => {
      if (!h) setStartedAtMin(nowKSTMin());
      else setStartedAtMin(null);
      return !h;
    });
  }

  const nearestWaypoint = hoveredPoint
    ? findNearestWaypoint([hoveredPoint[0], hoveredPoint[1]], waypoints)
    : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-0">

      <MapViewLoader
        track={track}
        waypoints={waypoints}
        hoveredPoint={hoveredPoint}
        onWaypointClick={handleWaypointClick}
        onTrailPointClick={handleTrailPointClick}
        isHiking={isHiking}
        selectedWaypointIndex={selectedWaypointIndex}
        approachBusTrack={approachBusTrack}
        approachWalkTrack={approachWalkTrack}
        returnBusTrack={returnBusTrack}
        returnWalkTrack={returnWalkTrack}
        approachIsBus={approachIsBus}
        returnIsBus={returnIsBus}
        approachBusInfo={approachBusInfo}
        returnBusInfo={returnBusInfo}
        bottomPadding={sheetHeightPx}
        controlsBottomOffset={sheetHeightPx}
        locale={locale}
      />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.22) 0%, transparent 26%), " +
            "linear-gradient(to top,   rgba(0,0,0,0.14) 0%, transparent 22%)",
          boxShadow: "inset 0 0 16px rgba(0,0,0,0.12)",
        }}
      />

      <FloatingTrailHeader
        isHiking={isHiking}
        stationInfo={stationInfo}
        latestStartMin={latestStartMin}
        isPastLatestStart={isPastLatestStart}
        peakETAMin={peakETAMin}
        finalETAMin={finalETAMin}
        routeName={routeName}
      />

      {nearestWaypoint && (
        <div
          className="fixed left-4 right-4 z-20 transition-all duration-300"
          style={{ bottom: sheetHeightPx + 8 }}
        >
          <GuideCard waypoint={nearestWaypoint} locale={locale} />
        </div>
      )}

      {/* ── Off-route alert overlay ──────────────────────────────────────── */}
      {offRoute.isAlertVisible && (
        <div
          className="fixed left-4 right-4 z-30 rounded-2xl px-4 py-3 shadow-lg"
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

      <HikingBottomSheet
        isHiking={isHiking}
        onToggleHiking={handleToggleHiking}
        gps={gps}
        track={track}
        elevationSegments={elevationSegments}
        onHover={handleHover}
        highlightIndex={elevationHighlightIndex}
        onSheetHeightChange={setSheetHeightPx}
      />

      {selectedWaypointIndex !== null && waypoints.length > 0 && (
        <WaypointSheet
          waypoints={waypoints}
          selectedIndex={selectedWaypointIndex}
          onClose={() => setSelectedWaypointIndex(null)}
          onSelect={handleWaypointSelect}
          locale={locale}
        />
      )}
    </div>
  );
}
