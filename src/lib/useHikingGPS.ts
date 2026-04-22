"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { getDistance } from "geolib";
import type { ResolvedSegment, Waypoint, HikingPhase } from "@/types/trail";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface HikingGPSState {
  currentPos: { lat: number; lon: number } | null;
  phase: HikingPhase;
  /** 0–1: fraction of the current phase completed */
  progressRatio: number;
  /** Metres remaining to the phase goal (summit or trailhead) */
  remainingM: number;
  /** Index on the combined ASCENT+DESCENT track nearest to current GPS position */
  nearestTrackIndex: number;
  /** Metres from current GPS position to the nearest track point (off-route distance) */
  distanceToPathM: number;
  /** Remaining vertical ascent (m) from current position to summit. 0 during descent. */
  remainingAscentElevM: number;
  /** Total horizontal distance of the descent portion (m) — constant per route. */
  totalDescentM: number;
  error: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GPS_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 8_000,
  timeout: 10_000,
};

// ── Pure helpers ──────────────────────────────────────────────────────────────

/**
 * Build a flat [lon, lat, ele?] track from an ordered list of segments.
 * Only processes ASCENT + DESCENT segments (the on-mountain portions).
 */
function buildHikingTrack(
  segments: ResolvedSegment[]
): [number, number, number][] {
  const relevant = segments.filter(
    (s) => s.segmentType === "ASCENT" || s.segmentType === "DESCENT"
  );
  return relevant.flatMap((s) =>
    s.trackData.coordinates.map(
      (c) => [c[0], c[1], c[2] ?? 0] as [number, number, number]
    )
  );
}

/**
 * Collect unique waypoints referenced by segments, deduplicated by id.
 * Used to register proximity alerts with the service worker.
 */
function collectWaypoints(segments: ResolvedSegment[]): Waypoint[] {
  const seen = new Set<number>();
  const result: Waypoint[] = [];
  for (const seg of segments) {
    for (const wpt of [seg.startWaypoint, seg.endWaypoint]) {
      if (!seen.has(wpt.id)) {
        seen.add(wpt.id);
        result.push(wpt);
      }
    }
  }
  return result;
}

/**
 * Pre-compute cumulative metre distances along a track.
 * arr[i] is the distance (m) from track[0] to track[i].
 */
function buildCumDist(track: [number, number, number][]): number[] {
  const arr: number[] = [0];
  for (let i = 1; i < track.length; i++) {
    const d = getDistance(
      { latitude: track[i - 1][1], longitude: track[i - 1][0] },
      { latitude: track[i][1], longitude: track[i][0] }
    );
    arr.push(arr[arr.length - 1] + d);
  }
  return arr;
}

/**
 * Sum positive elevation gains from track[fromIdx] to track[toIdx] (exclusive).
 * Used for Naismith's Rule penalty calculation.
 */
function calcRemainingAscent(
  track: [number, number, number][],
  fromIdx: number,
  toIdx: number
): number {
  let ascent = 0;
  for (let i = fromIdx; i < toIdx && i + 1 < track.length; i++) {
    const diff = (track[i + 1]?.[2] ?? 0) - (track[i]?.[2] ?? 0);
    if (diff > 0) ascent += diff;
  }
  return ascent;
}

/** O(n) nearest-point scan. Fast enough for typical GPX tracks (< 2,000 pts). */
function findNearest(
  lat: number,
  lon: number,
  track: [number, number, number][]
): { idx: number; dist: number } {
  let minDist = Infinity;
  let idx = 0;
  for (let i = 0; i < track.length; i++) {
    const d = getDistance(
      { latitude: lat, longitude: lon },
      { latitude: track[i][1], longitude: track[i][0] }
    );
    if (d < minDist) {
      minDist = d;
      idx = i;
    }
  }
  return { idx, dist: minDist === Infinity ? 0 : minDist };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

interface Options {
  /** Ordered segments for this route (APPROACH, ASCENT, DESCENT, RETURN) */
  segments: ResolvedSegment[];
  /** Only activates watchPosition when true */
  enabled: boolean;
}

export function useHikingGPS({ segments, enabled }: Options): HikingGPSState {
  const [pos, setPos] = useState<{ lat: number; lon: number } | null>(null);
  const [phase, setPhase] = useState<HikingPhase>("ascent");
  const [error, setError] = useState<string | null>(null);

  const phaseRef = useRef<HikingPhase>("ascent");

  // ── Derived constants ─────────────────────────────────────────────────────

  // Combined ASCENT + DESCENT track (on-mountain portion only)
  const track = useMemo(() => buildHikingTrack(segments), [segments]);
  const cumDist = useMemo(() => buildCumDist(track), [track]);
  const totalM = cumDist[cumDist.length - 1] ?? 0;

  // Summit = last point of the ASCENT segment in the combined track
  const summitTrackIdx = useMemo(() => {
    const ascentSeg = segments.find((s) => s.segmentType === "ASCENT");
    if (!ascentSeg) return Math.floor(track.length * 0.7);
    const ascentLen = ascentSeg.trackData.coordinates.length;
    return Math.max(ascentLen - 1, 0);
  }, [segments, track.length]);

  // All waypoints (for SW proximity registration)
  const allWaypoints = useMemo(() => collectWaypoints(segments), [segments]);

  // ── GPS watcher ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !navigator.geolocation) return;

    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "SET_WAYPOINTS",
        waypoints: allWaypoints.map((w) => ({
          lat: w.lat,
          lon: w.lon,
          type: w.type,
          name: w.name,
        })),
      });
    }

    const id = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const { latitude, longitude } = coords;
        setPos({ lat: latitude, lon: longitude });
        setError(null);

        // Phase auto-advance: once we pass the summit index, lock into descent
        if (phaseRef.current === "ascent" && track.length > 0) {
          const { idx } = findNearest(latitude, longitude, track);
          if (idx >= summitTrackIdx) {
            phaseRef.current = "descent";
            setPhase("descent");
          }
        }

        navigator.serviceWorker?.controller?.postMessage({
          type: "CHECK_PROXIMITY",
          lat: latitude,
          lon: longitude,
        });
      },
      (err) => setError(err.message),
      GPS_OPTIONS
    );

    return () => {
      navigator.geolocation.clearWatch(id);
      navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_WAYPOINTS" });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, summitTrackIdx]);

  // ── Derived progress ──────────────────────────────────────────────────────

  return useMemo<HikingGPSState>(() => {
    const descentStartM = cumDist[summitTrackIdx] ?? totalM;
    const totalDescentM = totalM - descentStartM;

    if (!pos || track.length === 0) {
      return {
        currentPos: null,
        phase,
        progressRatio: 0,
        remainingM: phase === "ascent" ? (cumDist[summitTrackIdx] ?? totalM) : totalM,
        nearestTrackIndex: 0,
        distanceToPathM: 0,
        remainingAscentElevM: phase === "ascent"
          ? calcRemainingAscent(track, 0, summitTrackIdx)
          : 0,
        totalDescentM,
        error,
      };
    }

    const { idx: nearestTrackIndex, dist: distanceToPathM } = findNearest(pos.lat, pos.lon, track);
    const traversedM = cumDist[nearestTrackIndex] ?? 0;

    if (phase === "ascent") {
      const goalM = cumDist[summitTrackIdx] ?? totalM;
      return {
        currentPos: pos,
        phase,
        progressRatio: goalM > 0 ? Math.min(traversedM / goalM, 1) : 0,
        remainingM: Math.max(goalM - traversedM, 0),
        nearestTrackIndex,
        distanceToPathM,
        remainingAscentElevM: calcRemainingAscent(track, nearestTrackIndex, summitTrackIdx),
        totalDescentM,
        error,
      };
    }

    // Descent: summit already reached — no remaining ascent elevation
    const descentTotalM = totalDescentM;
    const descentTravelledM = Math.max(traversedM - descentStartM, 0);
    return {
      currentPos: pos,
      phase,
      progressRatio: descentTotalM > 0
        ? Math.min(descentTravelledM / descentTotalM, 1)
        : 1,
      remainingM: Math.max(totalM - traversedM, 0),
      nearestTrackIndex,
      distanceToPathM,
      remainingAscentElevM: 0,
      totalDescentM,
      error,
    };
  }, [pos, phase, cumDist, summitTrackIdx, totalM, track, error]);
}
