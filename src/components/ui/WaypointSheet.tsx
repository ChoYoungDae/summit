"use client";

import { useRef } from "react";
import { X } from "lucide-react";
import type { Waypoint } from "@/types/trail";
import { t } from "@/lib/i18n";

interface Props {
  waypoints: Waypoint[];
  selectedIndex: number;
  onClose: () => void;
  onSelect: (index: number) => void;
  locale?: string;
}

const TYPE_LABEL: Record<string, string> = {
  STATION:   "Station",
  TRAILHEAD: "Trailhead",
  SUMMIT:    "Summit",
  JUNCTION:  "Junction",
  SHELTER:   "Shelter",
};

const TYPE_COLOR: Record<string, string> = {
  STATION:   "#2E5E4A",
  TRAILHEAD: "#2E5E4A",
  SUMMIT:    "#C8362A",
  JUNCTION:  "#2E5E4A",
  SHELTER:   "#2E5E4A",
};

export default function WaypointSheet({
  waypoints,
  selectedIndex,
  onClose,
  onSelect,
  locale = "en",
}: Props) {
  const touchStartX = useRef(0);

  if (!waypoints.length) return null;
  const wpt = waypoints[selectedIndex];
  if (!wpt) return null;

  const name    = t(wpt.name, locale);
  const koName  = locale !== "ko" ? wpt.name.ko : undefined;
  const desc    = t(wpt.description, locale);
  const hasPhoto = !!wpt.imageUrl;

  const canPrev = selectedIndex > 0;
  const canNext = selectedIndex < waypoints.length - 1;
  const typeLbl = TYPE_LABEL[wpt.type] ?? wpt.type;
  const typeClr = TYPE_COLOR[wpt.type] ?? "#2E5E4A";

  function handleSwipeStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleSwipeEnd(e: React.TouchEvent) {
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta >  50 && canPrev) onSelect(selectedIndex - 1);
    if (delta < -50 && canNext) onSelect(selectedIndex + 1);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60"
      onClick={onClose}
    >
      {/* ── Modal card ───────────────────────────────────────────────────────── */}
      <div
        className="relative w-full max-w-sm mx-4 bg-[var(--color-card)] rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => { e.stopPropagation(); handleSwipeStart(e); }}
        onTouchEnd={(e) => { e.stopPropagation(); handleSwipeEnd(e); }}
      >
        {hasPhoto ? (
          /* ── Full card — with photo ──────────────────────────────────────── */
          <>
            <div className="relative w-full overflow-hidden" style={{ aspectRatio: "4/3" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={wpt.imageUrl}
                alt={name}
                className="w-full h-full object-cover"
              />
              {/* Close — top-right */}
              <button
                onClick={onClose}
                className="absolute top-2 right-2 w-7 h-7 rounded-full
                           bg-black/35 backdrop-blur-sm
                           flex items-center justify-center text-white
                           hover:bg-black/55 transition-colors"
                aria-label="Close"
              >
                <X size={13} strokeWidth={2.5} />
              </button>
            </div>

            {/* Info row */}
            <div className={`px-3.5 pt-2.5 ${desc ? "pb-2" : "pb-3"}`}>
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="shrink-0 text-[10px] font-semibold px-2 py-[3px] rounded-full text-white"
                  style={{ background: typeClr, fontFamily: "var(--font-en)" }}
                >
                  {typeLbl}
                </span>
                {wpt.elevationM != null && (
                  <span
                    className="shrink-0 text-[10px] px-2 py-[3px] rounded-full
                               bg-[var(--color-bg-light)] text-[var(--color-text-muted)]"
                    style={{ fontFamily: "var(--font-en)" }}
                  >
                    {wpt.elevationM} m
                  </span>
                )}
                <p
                  className="truncate text-[13px] font-semibold text-[var(--color-text-primary)] leading-none"
                  style={{ fontFamily: "var(--font-en)" }}
                >
                  {name}
                </p>
              </div>
              {koName && (
                <p
                  className="mt-0.5 text-[11px] text-[var(--color-text-muted)] pl-0.5 leading-tight"
                  style={{ fontFamily: "var(--font-ko)" }}
                >
                  {koName}
                </p>
              )}
            </div>

            {/* Description */}
            {desc && (
              <div className="px-3.5 pb-3">
                <p
                  className="text-[12.5px] leading-relaxed text-[var(--color-text-body)]"
                  style={{ fontFamily: "var(--font-en)" }}
                >
                  {desc}
                </p>
              </div>
            )}
          </>
        ) : (
          /* ── Compact card — no photo ─────────────────────────────────────── */
          <div className="px-3.5 py-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {/* Badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className="text-[10px] font-semibold px-2 py-[3px] rounded-full text-white"
                    style={{ background: typeClr, fontFamily: "var(--font-en)" }}
                  >
                    {typeLbl}
                  </span>
                  {wpt.elevationM != null && (
                    <span
                      className="text-[10px] px-2 py-[3px] rounded-full
                                 bg-[var(--color-bg-light)] text-[var(--color-text-muted)]"
                      style={{ fontFamily: "var(--font-en)" }}
                    >
                      {wpt.elevationM} m
                    </span>
                  )}
                </div>

                {/* Name */}
                <p
                  className="mt-1.5 text-[14px] font-semibold text-[var(--color-text-primary)] leading-tight"
                  style={{ fontFamily: "var(--font-en)" }}
                >
                  {name}
                </p>
                {koName && (
                  <p
                    className="mt-0.5 text-[11px] text-[var(--color-text-muted)] leading-tight"
                    style={{ fontFamily: "var(--font-ko)" }}
                  >
                    {koName}
                  </p>
                )}

                {/* Description */}
                {desc && (
                  <p
                    className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-text-body)]"
                    style={{ fontFamily: "var(--font-en)" }}
                  >
                    {desc}
                  </p>
                )}
              </div>

              {/* Close button */}
              <button
                onClick={onClose}
                className="shrink-0 w-7 h-7 rounded-full bg-[var(--color-bg-light)]
                           flex items-center justify-center
                           text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]
                           transition-colors"
                aria-label="Close"
              >
                <X size={13} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Pagination dots ───────────────────────────────────────────────────── */}
      {waypoints.length > 1 && (
        <div
          className="flex items-center gap-1.5 mt-3"
          onClick={(e) => e.stopPropagation()}
        >
          {waypoints.map((_, i) => (
            <button
              key={i}
              onClick={() => onSelect(i)}
              className={`rounded-full transition-all duration-200 ${
                i === selectedIndex
                  ? "w-4 h-2 bg-white"
                  : "w-2 h-2 bg-white/40 hover:bg-white/65"
              }`}
              aria-label={`Waypoint ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
