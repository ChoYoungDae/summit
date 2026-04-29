"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import ElevationChart from "./ElevationChart";
import type { SegmentElevationInfo } from "./ElevationChart";
import type { HikingPhase } from "@/types/trail";
import { useHikingLevel } from "@/lib/useHikingLevel";
import type { HikingGPSState } from "@/lib/useHikingGPS";
import { useLanguage } from "@/lib/useLanguage";
import { tUI } from "@/lib/i18n";

// ── Re-export for callers that still import from this module ──────────────────
export { SKILL_LEVELS } from "@/lib/hikingLevel";
export type { SkillIndex } from "@/lib/hikingLevel";

// ── Snap constants ────────────────────────────────────────────────────────────

type Snap = "min" | "mid";

export const MIN_H = 88; // px — visible height at min snap

// mid snap: show at most MID_MAX_H px — prevents large blank space on tall screens
const MID_MAX_H = 280;

function snapVisibleH(snap: Snap, vh: number): number {
  if (snap === "min") return MIN_H;
  return Math.min(Math.round(vh * 0.45), MID_MAX_H);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtKm(metres: number): string {
  return metres >= 1000
    ? `${(metres / 1000).toFixed(1)} km`
    : `${Math.round(metres)} m`;
}

function phaseLabel(phase: HikingPhase, locale: string): string {
  return phase === "ascent" ? tUI("toPeak", locale) : tUI("toTrailhead", locale);
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  isHiking: boolean;
  hikingMode?: "preview" | "active";
  isLocating?: boolean;
  onToggleHiking: () => void;
  gps: HikingGPSState;
  track: [number, number, number][];
  elevationSegments?: SegmentElevationInfo[];
  summitElevationM?: number;
  onHover: (pt: [number, number, number] | null) => void;
  highlightIndex: number | null;
  onSheetHeightChange?: (heightPx: number) => void;
  showOffRoutePrompt?: boolean;
  offRouteEnabled?: boolean;
  onToggleOffRoute?: () => void;
  onConfirmStart?: () => void;
  onCancelPrompt?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HikingBottomSheet({
  isHiking,
  hikingMode = "preview",
  isLocating = false,
  onToggleHiking,
  gps,
  track,
  elevationSegments,
  summitElevationM,
  onHover,
  highlightIndex,
  onSheetHeightChange,
  showOffRoutePrompt = false,
  offRouteEnabled = true,
  onToggleOffRoute,
  onConfirmStart,
  onCancelPrompt,
}: Props) {
  const [snap, setSnap] = useState<Snap>("min");

  const pathname = usePathname();
  const { skill } = useHikingLevel();
  const { locale } = useLanguage();

  const progressPct = Math.round(gps.progressRatio * 100);

  useEffect(() => {
    onSheetHeightChange?.(MIN_H);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-expand to mid when hiking starts
  useEffect(() => {
    if (isHiking) {
      const vh = window.innerHeight;
      setSnap("mid");
      onSheetHeightChange?.(snapVisibleH("mid", vh));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHiking]);

  // Auto-expand to mid when a trail point is selected (pre-hike only)
  useEffect(() => {
    if (!isHiking && highlightIndex != null) {
      const vh = window.innerHeight;
      setSnap("mid");
      onSheetHeightChange?.(snapVisibleH("mid", vh));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightIndex]);

  function handleHandleTap() {
    const vh = window.innerHeight;
    const nextSnap: Snap = snap === "min" ? "mid" : "min";
    setSnap(nextSnap);
    onSheetHeightChange?.(snapVisibleH(nextSnap, vh));
  }

  // ── Transform ─────────────────────────────────────────────────────────────

  const transform =
    snap === "min"
      ? `translateY(calc(100dvh - ${MIN_H}px))`
      : `translateY(calc(100dvh - min(45dvh, ${MID_MAX_H}px)))`;

  const transition = "transform 0.22s ease-out";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="absolute bottom-0 inset-x-0 z-20" style={{ pointerEvents: "none" }}>
      <div
        className="rounded-t-2xl shadow-2xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          height: "100dvh",
          transform,
          transition,
          pointerEvents: "auto",
          willChange: "transform",
        }}
      >

        {/* ── Tap handle ── */}
        <div
          className="flex flex-col items-center pt-2 pb-1 select-none cursor-pointer"
          onClick={handleHandleTap}
        >
          <div className="w-9 h-1 rounded-full bg-gray-300 mb-0.5" />
          {snap === "min"
            ? <ChevronUp size={14} className="text-gray-400 animate-bounce-hint" />
            : <ChevronDown size={14} className="text-gray-400 animate-bounce-hint" />
          }
        </div>

        {/* ══════════════════════════════════════════════════════
            MIN band — always visible
        ══════════════════════════════════════════════════════ */}
        <div className="px-5">
          {isHiking ? (
            hikingMode === "active" ? (
              /* On-trail: progress bar + End Hike */
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span
                      className="text-[11px] font-semibold uppercase tracking-wide"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {gps.phase === "ascent" ? tUI("ascending", locale) : tUI("descending", locale)} · {progressPct}%
                    </span>
                    <span
                      className="text-[11px] font-medium tabular-nums"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {fmtKm(gps.remainingM)} {phaseLabel(gps.phase, locale)}
                    </span>
                  </div>
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: "var(--color-bg-light)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${progressPct}%`,
                        background:
                          gps.phase === "ascent"
                            ? "var(--color-primary)"
                            : "var(--color-secondary)",
                      }}
                    />
                  </div>
                </div>

                <button
                  onClick={onToggleHiking}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-opacity active:opacity-70"
                  style={{ background: "var(--color-secondary)" }}
                >
                  {tUI("endHike", locale)}
                </button>
              </div>
            ) : (
              /* Preview mode: not on trail yet — just offer cancel */
              <div className="flex justify-end">
                <button
                  onClick={onToggleHiking}
                  className="shrink-0 px-4 py-1.5 rounded-lg text-sm font-semibold transition-opacity active:opacity-70"
                  style={{ background: "rgba(200,54,42,0.12)", color: "var(--color-secondary)" }}
                >
                  {tUI("goBack", locale)}
                </button>
              </div>
            )
          ) : showOffRoutePrompt ? (
            /* Case 2: off-route alert confirmation before starting */
            <div className="flex flex-col gap-3 w-full">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ color: "var(--color-text-body)" }}>
                  {tUI("offRouteAlertLabel", locale)}
                </span>
                <button
                  onClick={onToggleOffRoute}
                  className="relative flex-shrink-0 w-12 h-6 rounded-full transition-colors duration-200"
                  style={{ background: offRouteEnabled ? "var(--color-primary)" : "#D1D5DB" }}
                  aria-label="Toggle off-route alert"
                >
                  <span
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                    style={{ transform: offRouteEnabled ? "translateX(26px)" : "translateX(2px)" }}
                  />
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onCancelPrompt}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: "var(--color-bg-light)", color: "var(--color-text-muted)" }}
                >
                  {tUI("cancel", locale)}
                </button>
                <button
                  onClick={onConfirmStart}
                  className="flex-1 py-2 rounded-xl text-sm font-bold text-white active:scale-95 transition-transform"
                  style={{ background: "var(--color-primary)" }}
                >
                  {tUI("startHiking", locale)}
                </button>
              </div>
            </div>
          ) : (
            /* Pre-hike: Start button + level badge */
            <div className="flex items-center justify-between gap-4">
              {/* Current level chip — taps through to Settings */}
              <Link
                href={`/settings?returnUrl=${encodeURIComponent(pathname)}`}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 active:opacity-70 transition-opacity"
                style={{ background: "var(--color-bg-light)" }}
              >
                <div className="flex flex-col gap-0">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wide leading-none"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {tUI("myHikingLevel", locale)}
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span
                      className="text-[12px] font-bold leading-none"
                      style={{ color: "var(--color-primary)" }}
                    >
                      {skill.label}
                    </span>
                    <span
                      className="text-[11px] leading-none"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {skill.multiplier}×
                    </span>
                  </div>
                </div>
                <ChevronRight
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: "var(--color-text-muted)" }}
                />
              </Link>

              <button
                onClick={onToggleHiking}
                disabled={isLocating}
                className="shrink-0 px-4 py-2 rounded-xl text-sm font-bold text-white shadow-sm active:scale-95 transition-transform disabled:opacity-60"
                style={{ background: "var(--color-primary)" }}
              >
                {isLocating ? "…" : tUI("startHiking", locale)}
              </button>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════
            MID / MAX content
        ══════════════════════════════════════════════════════ */}
        <div className="px-5 pt-4 overflow-y-auto" style={{ maxHeight: "80vh" }}>

          {/* Elevation chart */}
          {(elevationSegments?.some((s) => s.points.length > 0) ?? track.length > 0) && (
            <div className="mb-4">
              <ElevationChart
                segments={
                  elevationSegments && elevationSegments.length > 0
                    ? elevationSegments
                    : [{ type: "ASCENT", isBus: false, points: track }]
                }
                summitElevationM={summitElevationM}
                onHover={onHover}
                highlightTrackIndex={highlightIndex}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
