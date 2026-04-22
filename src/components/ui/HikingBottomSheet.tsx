"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import ElevationChart from "./ElevationChart";
import type { SegmentElevationInfo } from "./ElevationChart";
import type { RoutePhoto, HikingPhase } from "@/types/trail";
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

function snapTranslateY(snap: Snap, vh: number): number {
  if (snap === "min") return vh - MIN_H;
  return Math.min(vh * 0.75, vh - MIN_H); // mid: 25% visible height, map stays dominant
}

function snapVisibleH(snap: Snap, vh: number): number {
  if (snap === "min") return MIN_H;
  return Math.max(vh * 0.25, MIN_H);
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
  onToggleHiking: () => void;
  gps: HikingGPSState;
  track: [number, number, number][];
  elevationSegments?: SegmentElevationInfo[];
  onHover: (pt: [number, number, number] | null) => void;
  highlightIndex: number | null;
  onSheetHeightChange?: (heightPx: number) => void;
  photos?: RoutePhoto[];
  onPhotoClick?: (photo: RoutePhoto) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HikingBottomSheet({
  isHiking,
  onToggleHiking,
  gps,
  track,
  elevationSegments,
  onHover,
  highlightIndex,
  onSheetHeightChange,
  photos = [],
  onPhotoClick,
}: Props) {
  const [snap, setSnap] = useState<Snap>("min");
  const [liveY, setLiveY] = useState<number | null>(null);

  const dragStartY  = useRef(0);
  const baseY       = useRef(0);
  const isDragging  = useRef(false);

  const { skill } = useHikingLevel();
  const { locale } = useLanguage();

  const progressPct = Math.round(gps.progressRatio * 100);

  useEffect(() => {
    onSheetHeightChange?.(MIN_H);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-expand to mid when a trail point is selected (pre-hike only)
  useEffect(() => {
    if (!isHiking && highlightIndex != null) {
      const vh = window.innerHeight;
      setSnap("mid");
      setLiveY(null);
      onSheetHeightChange?.(snapVisibleH("mid", vh));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightIndex]);

  // ── Drag handlers ─────────────────────────────────────────────────────────

  function handleHandleTap() {
    const vh = window.innerHeight;
    const nextSnap: Snap = snap === "min" ? "mid" : "min";
    setSnap(nextSnap);
    setLiveY(null);
    onSheetHeightChange?.(snapVisibleH(nextSnap, vh));
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDragging.current = true;
    dragStartY.current = e.clientY;
    baseY.current = snapTranslateY(snap, window.innerHeight);
    setLiveY(baseY.current);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current) return;
    const vh  = window.innerHeight;
    const dy  = e.clientY - dragStartY.current;
    const raw = baseY.current + dy;
    const clamped = Math.max(vh * 0.05, Math.min(vh - 40, raw));
    setLiveY(clamped);
    onSheetHeightChange?.(vh - clamped);
  }

  function onPointerUp() {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (liveY === null) return;

    const vh = window.innerHeight;
    const snaps: Snap[] = ["min", "mid"];
    const closest = snaps.reduce<Snap>(
      (best, s) =>
        Math.abs(liveY - snapTranslateY(s, vh)) <
        Math.abs(liveY - snapTranslateY(best, vh))
          ? s
          : best,
      "min",
    );

    setSnap(closest);
    setLiveY(null);
    onSheetHeightChange?.(snapVisibleH(closest, vh));
  }

  // ── Transform ─────────────────────────────────────────────────────────────

  const transform =
    liveY !== null
      ? `translateY(${liveY}px)`
      : snap === "min"
      ? `translateY(calc(100vh - ${MIN_H}px))`
      : `translateY(75vh)`;

  const transition =
    liveY !== null ? "none" : "transform 0.32s cubic-bezier(0.32,0.72,0,1)";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20" style={{ pointerEvents: "none" }}>
      <div
        className="rounded-t-2xl shadow-2xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          height: "100vh",
          transform,
          transition,
          pointerEvents: "auto",
          willChange: "transform",
        }}
      >

        {/* ── Drag handle ───────────────────────────────────── */}
        <div
          className="flex flex-col items-center pt-2 pb-1 cursor-grab active:cursor-grabbing touch-none select-none"
          onClick={handleHandleTap}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="w-9 h-1 rounded-full bg-gray-300" />
        </div>

        {/* ══════════════════════════════════════════════════════
            MIN band — always visible
        ══════════════════════════════════════════════════════ */}
        <div className="px-5">
          {isHiking ? (
            /* Active hiking: progress bar */
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
            /* Pre-hike: Start button + level badge */
            <div className="flex items-center justify-between gap-4">
              {/* Current level chip — taps through to Settings */}
              <Link
                href="/settings"
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
                className="shrink-0 px-4 py-2 rounded-xl text-sm font-bold text-white shadow-sm active:scale-95 transition-transform"
                style={{ background: "var(--color-primary)" }}
              >
                {tUI("startHiking", locale)}
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
                onHover={onHover}
                highlightTrackIndex={highlightIndex}
                photos={photos}
                onPhotoClick={onPhotoClick}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
