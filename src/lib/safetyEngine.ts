import type { ResolvedRoute } from "@/types/trail";

/** How many minutes before sunset the hiker must be off the mountain. */
export const SUNSET_BUFFER_MIN = 120;
/** Basic rest time at the summit. */
export const SUMMIT_REST_MIN = 30;

/**
 * Calculate the latest time a hiker can depart from the subway exit (KST).
 *
 * Formula:
 *   latestStart = sunset − SUNSET_BUFFER_MIN − totalHikingTime
 *
 * where:
 *   totalHikingTime = (approach + round(ascent × m) + round(descent × m) + return) + SUMMIT_REST_MIN
 *   m = skillMultiplier (0.6–1.5) — applied to ASCENT + DESCENT segments only
 *
 * Returns minutes from midnight (KST), or null if ascent/descent time is missing.
 */
export function calcLatestStartMin(
  route: ResolvedRoute,
  sunsetMin: number,
  skillMultiplier = 1.0
): number | null {
  if (!route.segments || route.segments.length === 0) return null;

  let totalHikingTime = 0;
  let hasAscentOrDescent = false;

  for (const seg of route.segments) {
    const baseTime = seg.estimatedTimeMin || 0;
    
    if (seg.segmentType === "ASCENT" || seg.segmentType === "DESCENT") {
      totalHikingTime += Math.round(baseTime * skillMultiplier);
      hasAscentOrDescent = true;
    } else {
      totalHikingTime += baseTime;
    }

    if (seg.isBusCombined && seg.busDetails?.bus_duration_min) {
      totalHikingTime += seg.busDetails.bus_duration_min;
    }
  }

  if (totalHikingTime === 0) return null;

  // Add summit rest only if it's a mountain hike (has ascent/descent)
  if (hasAscentOrDescent) {
    totalHikingTime += SUMMIT_REST_MIN;
  }

  const result = sunsetMin - SUNSET_BUFFER_MIN - totalHikingTime;
  
  console.log(`[safetyEngine] Sunset: ${sunsetMin}m, Buffer: ${SUNSET_BUFFER_MIN}m, TotalTime: ${totalHikingTime}m => Result: ${result}m`);
  
  return result;
}

/**
 * Simplified version for the route list page, where only the cached
 * total duration is available (skillMultiplier is always 1.0 on list view).
 */
export function calcLatestStartFromDuration(
  hikingDurationMin: number,
  busDurationMin: number,
  sunsetMin: number
): number {
  // Always include summit rest for the simplified version as most routes are mountain hikes
  return sunsetMin - SUNSET_BUFFER_MIN - hikingDurationMin - busDurationMin - SUMMIT_REST_MIN;
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
