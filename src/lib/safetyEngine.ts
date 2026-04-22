import type { ResolvedRoute } from "@/types/trail";

/** How many minutes before sunset the hiker must be off the mountain. */
export const SUNSET_BUFFER_MIN = 120;

/**
 * Calculate the latest time a hiker can depart from the subway exit (KST).
 *
 * Formula:
 *   latestStart = sunset − SUNSET_BUFFER_MIN − totalHikingTime
 *
 * where:
 *   totalHikingTime = approach + round(ascent × m) + round(descent × m) + return
 *   m = skillMultiplier (0.6–1.5) — applied to ASCENT + DESCENT segments only
 *
 * Returns minutes from midnight (KST), or null if ascent/descent time is missing.
 */
export function calcLatestStartMin(
  route: ResolvedRoute,
  sunsetMin: number,
  skillMultiplier = 1.0
): number | null {
  const ascent = route.segments.find((s) => s.segmentType === "ASCENT");
  const descent = route.segments.find((s) => s.segmentType === "DESCENT");

  // Ascent and descent times are required for a meaningful estimate
  if (!ascent?.estimatedTimeMin || !descent?.estimatedTimeMin) return null;

  const approach = route.segments.find((s) => s.segmentType === "APPROACH");
  const ret = route.segments.find((s) => s.segmentType === "RETURN");

  const total =
    (approach?.estimatedTimeMin ?? 0) +
    Math.round(ascent.estimatedTimeMin * skillMultiplier) +
    Math.round(descent.estimatedTimeMin * skillMultiplier) +
    (ret?.estimatedTimeMin ?? 0);

  return sunsetMin - SUNSET_BUFFER_MIN - total;
}

/**
 * Simplified version for the route list page, where only the cached
 * total duration is available (skillMultiplier is always 1.0 on list view).
 */
export function calcLatestStartFromDuration(
  totalDurationMin: number,
  sunsetMin: number
): number {
  return sunsetMin - SUNSET_BUFFER_MIN - totalDurationMin;
}

/**
 * Format minutes-from-midnight as a 12-hour clock string, e.g. "2:30 PM".
 * Handles values outside [0, 1440) gracefully.
 */
export function formatMinutesAsTime(min: number): string {
  const h24 = Math.floor(min / 60) % 24;
  const m = ((min % 60) + 60) % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

/** Current time in minutes from midnight, KST (UTC+9). */
export function nowKSTMin(): number {
  const now = new Date();
  const kstH = (now.getUTCHours() + 9) % 24;
  return kstH * 60 + now.getUTCMinutes();
}
