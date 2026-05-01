"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/** How many consecutive off-route GPS readings trigger an alert. */
const CONSECUTIVE_THRESHOLD = 3;
/** Milliseconds of continuous off-route position before triggering an alert. */
const TIME_THRESHOLD_MS = 5_000;
/** Track-point radius used for "ignore this section". */
const IGNORE_RANGE_RADIUS = 50;

interface Options {
  /** Metres from the nearest track point. `null` when GPS is unavailable. */
  distanceToPathM: number | null;
  /** Off-route threshold in metres (from user settings). */
  threshold: number;
  /** Only runs detection when true (Active Mode). */
  enabled: boolean;
  /** Index of the nearest track point for the "ignore section" feature. */
  nearestTrackIndex: number;
  /** Current GPS accuracy in metres. Alert is suppressed when accuracy > threshold. */
  gpsAccuracyM?: number | null;
}

export interface OffRouteAlertState {
  isAlertVisible: boolean;
  handleMute5min: () => void;
  handleIgnoreSection: () => void;
  handleDismiss: () => void;
}

export function useOffRouteAlert({
  distanceToPathM,
  threshold,
  enabled,
  nearestTrackIndex,
  gpsAccuracyM,
}: Options): OffRouteAlertState {
  const [isAlertVisible, setIsAlertVisible] = useState(false);

  const consecutiveRef   = useRef(0);
  const firstOffTimeRef  = useRef<number | null>(null);
  const muteUntilRef     = useRef<number | null>(null);
  const ignoredRangeRef  = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (!enabled || distanceToPathM === null) {
      consecutiveRef.current  = 0;
      firstOffTimeRef.current = null;
      return;
    }

    // ── GPS accuracy gate ──────────────────────────────────────────────────
    // If GPS accuracy is worse than the user's off-route threshold, the fix
    // is too coarse to reliably detect off-route — suppress the alert.
    if (gpsAccuracyM !== null && gpsAccuracyM !== undefined && gpsAccuracyM > threshold) {
      consecutiveRef.current  = 0;
      firstOffTimeRef.current = null;
      return;
    }

    const now = Date.now();

    // ── Mute window ────────────────────────────────────────────────────────
    if (muteUntilRef.current !== null) {
      if (now < muteUntilRef.current) {
        consecutiveRef.current  = 0;
        firstOffTimeRef.current = null;
        return;
      }
      muteUntilRef.current = null;
    }

    // ── Ignored section ────────────────────────────────────────────────────
    if (ignoredRangeRef.current) {
      const [lo, hi] = ignoredRangeRef.current;
      if (nearestTrackIndex >= lo && nearestTrackIndex <= hi) {
        consecutiveRef.current  = 0;
        firstOffTimeRef.current = null;
        return;
      }
      // User left the ignored section — clear it
      ignoredRangeRef.current = null;
    }

    // ── Debounce logic ─────────────────────────────────────────────────────
    const isOffRoute = distanceToPathM > threshold;

    if (isOffRoute) {
      consecutiveRef.current += 1;
      if (firstOffTimeRef.current === null) firstOffTimeRef.current = now;

      const durationMs = now - firstOffTimeRef.current;
      if (consecutiveRef.current >= CONSECUTIVE_THRESHOLD || durationMs >= TIME_THRESHOLD_MS) {
        setIsAlertVisible(true);
        // Vibrate once when the alert first fires
        if (typeof navigator !== "undefined") navigator.vibrate?.(200);
      }
    } else {
      consecutiveRef.current  = 0;
      firstOffTimeRef.current = null;
      setIsAlertVisible(false);
    }
  }, [distanceToPathM, threshold, enabled, nearestTrackIndex, gpsAccuracyM]);

  const handleMute5min = useCallback(() => {
    muteUntilRef.current    = Date.now() + 5 * 60 * 1_000;
    consecutiveRef.current  = 0;
    firstOffTimeRef.current = null;
    setIsAlertVisible(false);
  }, []);

  const handleIgnoreSection = useCallback(() => {
    ignoredRangeRef.current = [
      Math.max(0, nearestTrackIndex - IGNORE_RANGE_RADIUS),
      nearestTrackIndex + IGNORE_RANGE_RADIUS,
    ];
    consecutiveRef.current  = 0;
    firstOffTimeRef.current = null;
    setIsAlertVisible(false);
  }, [nearestTrackIndex]);

  const handleDismiss = useCallback(() => {
    consecutiveRef.current  = 0;
    firstOffTimeRef.current = null;
    setIsAlertVisible(false);
  }, []);

  return { isAlertVisible, handleMute5min, handleIgnoreSection, handleDismiss };
}
