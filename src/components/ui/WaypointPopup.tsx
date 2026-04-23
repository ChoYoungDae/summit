"use client";

import { X, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import { type Waypoint } from "@/types/trail";
import { tDB } from "@/lib/i18n";
import { DualText } from "./DualText";

interface Props {
  waypoint: Waypoint;
  onClose: () => void;
  locale?: string;
}

const TYPE_BADGE: Record<string, string> = {
  STATION:   "Station",
  TRAILHEAD: "Trailhead",
  SUMMIT:    "Summit",
  JUNCTION:  "Junction",
  SHELTER:   "Shelter",
};

export default function WaypointPopup({ waypoint, onClose, locale = "en" }: Props) {
  const primaryName = tDB(waypoint.name, locale);
  const nameKo = waypoint.name.ko;
  // Korean sub-label always shown when present — hikers need to match physical signs
  const koName = locale !== "ko" ? nameKo : undefined;
  const desc = tDB(waypoint.description, locale);
  const koDesc = locale !== "ko" ? waypoint.description?.ko : undefined;

  return (
    // Backdrop — click outside to dismiss
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-[var(--color-card)] rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Photo */}
        {waypoint.imageUrl && (
          <div className="h-44 overflow-hidden bg-[var(--color-bg-light)]">
            <img
              src={waypoint.imageUrl}
              alt={primaryName}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Title bar */}
        <div className="bg-[var(--color-primary)] px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <p
              className="text-white text-base font-semibold leading-tight"
              style={{ fontFamily: "var(--font-en)" }}
            >
              {primaryName}
            </p>
            {koName && (
              <p
                className="text-white/70 text-xs leading-tight"
                style={{ fontFamily: "var(--font-ko)" }}
              >
                {koName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-white/70 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3">
          {/* Badges: elevation + type */}
          <div className="flex gap-2 mb-3">
            <span
              className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-bg-light)] text-[var(--color-text-muted)]"
              style={{ fontFamily: "var(--font-en)" }}
            >
              {waypoint.elevationM} m
            </span>
            {waypoint.type in TYPE_BADGE && (
              <span
                className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-bg-light)] text-[var(--color-text-muted)]"
                style={{ fontFamily: "var(--font-en)" }}
              >
                {TYPE_BADGE[waypoint.type]}
              </span>
            )}
          </div>

          {/* Description */}
          {desc && (
            <DualText
              en={desc}
              ko={koDesc ?? ""}
              size="0.875rem"
            />
          )}

          {/* Direction callout — decision points only */}
          {waypoint.direction && (
            <div className="mt-3 flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--color-primary)] text-white">
              {waypoint.direction === "left" && (
                <ArrowLeft size={22} strokeWidth={2.5} className="shrink-0" />
              )}
              {waypoint.direction === "right" && (
                <ArrowRight size={22} strokeWidth={2.5} className="shrink-0" />
              )}
              {waypoint.direction === "straight" && (
                <ArrowUp size={22} strokeWidth={2.5} className="shrink-0" />
              )}
              <p
                className="text-sm font-semibold leading-tight capitalize"
                style={{ fontFamily: "var(--font-en)" }}
              >
                {waypoint.direction}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
