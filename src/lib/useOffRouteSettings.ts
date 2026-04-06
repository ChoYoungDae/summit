"use client";

import { useState, useEffect } from "react";

export const OFF_ROUTE_THRESHOLD_KEY = "off-route-alert-threshold";
export const OFF_ROUTE_THRESHOLD_DEFAULT = 30;
export const OFF_ROUTE_THRESHOLD_MIN = 20;
export const OFF_ROUTE_THRESHOLD_MAX = 100;
export const OFF_ROUTE_THRESHOLD_STEP = 10;

function clamp(v: number): number {
  return (
    Math.round(Math.max(OFF_ROUTE_THRESHOLD_MIN, Math.min(OFF_ROUTE_THRESHOLD_MAX, v)) /
      OFF_ROUTE_THRESHOLD_STEP) * OFF_ROUTE_THRESHOLD_STEP
  );
}

export function useOffRouteSettings() {
  const [threshold, setThresholdState] = useState(OFF_ROUTE_THRESHOLD_DEFAULT);

  useEffect(() => {
    const stored = localStorage.getItem(OFF_ROUTE_THRESHOLD_KEY);
    if (stored) {
      const n = parseInt(stored, 10);
      if (!isNaN(n)) setThresholdState(clamp(n));
    }
  }, []);

  function setThreshold(m: number) {
    const value = clamp(m);
    setThresholdState(value);
    localStorage.setItem(OFF_ROUTE_THRESHOLD_KEY, String(value));
  }

  return { threshold, setThreshold };
}
