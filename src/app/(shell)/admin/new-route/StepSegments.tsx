"use client";

import { Clock, ArrowRight, Route, Info } from "lucide-react";
import type { SegmentPreview } from "./types";

const INPUT = "rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm bg-[var(--color-bg-light)] focus:outline-none focus:ring-2 focus:ring-primary/40 w-24 text-center font-num";
const LABEL = "text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]";
const CARD = "rounded-2xl border border-[var(--color-border)] bg-white p-4 flex flex-col gap-3";

const SEGMENT_LABELS: Record<string, string> = {
  APPROACH: "Approach",
  ASCENT:   "Ascent",
  DESCENT:  "Descent",
  RETURN:   "Return",
};

const SEGMENT_COLORS: Record<string, string> = {
  APPROACH: "bg-blue-50 text-blue-600 border-blue-100",
  ASCENT:   "bg-orange-50 text-orange-600 border-orange-100",
  DESCENT:  "bg-amber-50 text-amber-600 border-amber-100",
  RETURN:   "bg-teal-50 text-teal-600 border-teal-100",
};

export default function StepSegments({
  segments,
  onChange,
}: {
  segments: SegmentPreview[];
  onChange: (updated: SegmentPreview[]) => void;
}) {
  const totalDuration = segments.reduce((sum, s) => sum + s.durationMin, 0);
  const totalDistance = segments.reduce((sum, s) => sum + s.distanceM, 0);

  function updateDuration(idx: number, val: string) {
    const mins = parseInt(val) || 0;
    const next = [...segments];
    next[idx] = { ...next[idx], durationMin: mins };
    onChange(next);
  }

  if (segments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[var(--color-text-muted)] text-center gap-2">
        <Info size={32} strokeWidth={1.5} />
        <p className="text-sm">No segments inferred yet.<br/>Make sure you have at least 2 waypoints.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-primary/5 rounded-xl p-3 border border-primary/10 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-primary uppercase tracking-tight">Total Estimated Time</span>
          <span className="text-xl font-bold text-primary font-num">
            {Math.floor(totalDuration / 60)}h {totalDuration % 60}m
          </span>
        </div>
        <div className="text-right flex flex-col">
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-tight">Total Distance</span>
          <span className="text-sm font-semibold text-[var(--color-text-body)] font-num">
            {(totalDistance / 1000).toFixed(2)} km
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {segments.map((seg, idx) => (
          <div key={idx} className={CARD}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${SEGMENT_COLORS[seg.segType] || "bg-gray-50"}`}>
                {SEGMENT_LABELS[seg.segType] || seg.segType}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] font-num">
                {(seg.distanceM / 1000).toFixed(2)} km
              </span>
            </div>

            <div className="flex items-center gap-2 py-1">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[var(--color-text-body)] truncate">
                  {seg.startWpName}
                </p>
                {seg.startWpNameKo && (
                  <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                    {seg.startWpNameKo}
                  </p>
                )}
              </div>
              <ArrowRight size={14} className="text-[var(--color-border)] flex-none" />
              <div className="flex-1 min-w-0 text-right">
                <p className="text-sm font-bold text-[var(--color-text-body)] truncate">
                  {seg.endWpName}
                </p>
                {seg.endWpNameKo && (
                  <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                    {seg.endWpNameKo}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]">
              <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                <Clock size={14} />
                <span className="text-xs font-medium">Duration (min)</span>
              </div>
              <input
                type="number"
                className={INPUT}
                value={seg.durationMin}
                onChange={(e) => updateDuration(idx, e.target.value)}
                min="1"
              />
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed italic px-1">
        * Times are pre-calculated based on distance and elevation (Naismith's Rule). 
        You can override them based on trail signs or experience.
      </p>
    </div>
  );
}
