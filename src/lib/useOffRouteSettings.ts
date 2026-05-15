"use client";

import { useState, useEffect } from "react";

export const OFF_ROUTE_THRESHOLD_KEY = "off-route-alert-threshold";
export const OFF_ROUTE_ENABLED_KEY   = "off-route-alert-enabled";
export const OFF_ROUTE_THRESHOLD_DEFAULT = 30;
export const OFF_ROUTE_THRESHOLD_MIN = 20;
export const OFF_ROUTE_THRESHOLD_MAX = 50;
export const OFF_ROUTE_THRESHOLD_STEP = 10;

export const GPS_INTERVAL_KEY     = "gps-interval-sec";
export const GPS_INTERVAL_DEFAULT = 15;
export const GPS_INTERVAL_MIN     = 5;
export const GPS_INTERVAL_MAX     = 50;
export const GPS_INTERVAL_STEP    = 5;

function clamp(v: number): number {
  return (
    Math.round(Math.max(OFF_ROUTE_THRESHOLD_MIN, Math.min(OFF_ROUTE_THRESHOLD_MAX, v)) /
      OFF_ROUTE_THRESHOLD_STEP) * OFF_ROUTE_THRESHOLD_STEP
  );
}

export function useOffRouteSettings() {
  const [threshold,    setThresholdState]    = useState(OFF_ROUTE_THRESHOLD_DEFAULT);
  const [enabled,      setEnabledState]      = useState(true);
  const [gpsInterval,  setGpsIntervalState]  = useState(GPS_INTERVAL_DEFAULT);

  useEffect(() => {
    const stored = localStorage.getItem(OFF_ROUTE_THRESHOLD_KEY);
    if (stored) {
      const n = parseInt(stored, 10);
      if (!isNaN(n)) setThresholdState(clamp(n));
    }
    const storedEnabled = localStorage.getItem(OFF_ROUTE_ENABLED_KEY);
    if (storedEnabled !== null) setEnabledState(storedEnabled !== "false");

    const storedInterval = localStorage.getItem(GPS_INTERVAL_KEY);
    if (storedInterval) {
      const n = parseInt(storedInterval, 10);
      if (!isNaN(n) && n >= GPS_INTERVAL_MIN && n <= GPS_INTERVAL_MAX) {
        setGpsIntervalState(Math.round(n / GPS_INTERVAL_STEP) * GPS_INTERVAL_STEP);
      }
    }
  }, []);

  function setThreshold(m: number) {
    const value = clamp(m);
    setThresholdState(value);
    localStorage.setItem(OFF_ROUTE_THRESHOLD_KEY, String(value));
  }

  function setEnabled(v: boolean) {
    setEnabledState(v);
    localStorage.setItem(OFF_ROUTE_ENABLED_KEY, String(v));
  }

  function setGpsInterval(sec: number) {
    setGpsIntervalState(sec);
    localStorage.setItem(GPS_INTERVAL_KEY, String(sec));
  }

  return { threshold, setThreshold, enabled, setEnabled, gpsInterval, setGpsInterval };
}
