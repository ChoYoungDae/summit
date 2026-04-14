"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Ruler,
  Footprints,
  TrendingUp,
} from "lucide-react";
import { Icon } from "@iconify/react";
import { t } from "@/lib/i18n";
import { formatMinutesAsTime, nowKSTMin } from "@/lib/safetyEngine";
import type { Route } from "@/types/trail";

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatDistanceKm(metres: number): string {
  return (metres / 1000).toFixed(1);
}

interface RouteCardProps {
  route: Route;
  /** Total bus riding time in minutes (sum across all bus-combined segments). */
  busDurationMin?: number;
  /** Number of segments that involve a bus. */
  busSegmentCount?: number;
  /** Latest departure time in minutes from midnight (KST). Null = no data. */
  latestStartMin?: number | null;
  locale?: string;
}

export default function RouteCard({
  route,
  busDurationMin = 0,
  busSegmentCount = 0,
  latestStartMin,
  locale = "en",
}: RouteCardProps) {
  const [descExpanded, setDescExpanded] = useState(false);

  const isPastLatestStart =
    latestStartMin != null && nowKSTMin() > latestStartMin;

  const description = route.description ? t(route.description, locale) : null;

  return (
    <div
      className="rounded-[var(--radius-card)] overflow-hidden"
      style={{
        background: "var(--color-card)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      }}
    >
      {/* ── Safety banner ── */}
      {!route.hideSafeStart && isPastLatestStart && latestStartMin != null && (
        <div
          className="flex items-center gap-2 px-4 py-1.5"
          style={{ background: "#EF4444" }}
        >
          <Icon icon="ph:warning-circle" width={13} height={13} style={{ color: "white" }} />
          <span className="text-[11px] font-semibold text-white uppercase tracking-wide">
            Last safe start&nbsp;
            <span className="font-num">{formatMinutesAsTime(latestStartMin)}</span>
          </span>
        </div>
      )}

      {/* ── Card body ── */}
      <div className="flex flex-col gap-2.5 px-4 pt-4 pb-3">
        {/* Title */}
        <div className="flex flex-col items-center gap-1">
          <h2
            className="text-base font-bold leading-snug text-center flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1"
            style={{ fontFamily: "var(--font-en)" }}
          >
            {t(route.name, locale)}
          </h2>
          {route.isOneway && (
            <span
              className="px-2 py-0.5 rounded-full border border-primary/30 text-[10px] font-bold text-primary uppercase tracking-tight"
              style={{ background: "rgba(46,94,74,0.05)" }}
            >
              {locale === "ko" ? "상행 전용" : "One-Way Ascent"}
            </span>
          )}
        </div>

        {/* Info chips */}

        <div className="flex flex-wrap gap-1.5 justify-center">
          {route.totalDistanceM != null && (
            <InfoChip
              icon={<Ruler size={12} strokeWidth={2} />}
              label={`${formatDistanceKm(route.totalDistanceM)} km`}
            />
          )}
          {route.totalDurationMin != null && (
            busDurationMin > 0 ? (
              <span
                className="font-num inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium gap-1.5"
                style={{ background: "rgba(46,94,74,0.08)", color: "var(--color-primary)" }}
              >
                <Footprints size={12} strokeWidth={2} />
                {formatTime(route.totalDurationMin - busDurationMin)}
                <span style={{ opacity: 0.3, margin: "0 1px" }}>|</span>
                <Icon icon="ph:bus" width={13} height={13} style={{ color: "#0052A4" }} />
                <span style={{ color: "#0052A4" }}>
                  {busSegmentCount > 1
                    ? `${Math.round(busDurationMin / busSegmentCount)}m × ${busSegmentCount}`
                    : formatTime(busDurationMin)}
                </span>
              </span>
            ) : (
              <InfoChip
                icon={<Footprints size={12} strokeWidth={2} />}
                label={formatTime(route.totalDurationMin)}
              />
            )
          )}
          {route.totalDifficulty != null && (
            <DifficultyChip difficulty={route.totalDifficulty} />
          )}
        </div>

        {/* Safety: last safe start when NOT past deadline */}
        {!route.hideSafeStart && !isPastLatestStart && latestStartMin != null && (
          <div className="flex items-center gap-1.5">
            <span
              className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--color-text-muted)" }}
            >
              Last safe start:
            </span>
            <span
              className="font-num text-[11px] font-medium"
              style={{ color: "var(--color-text-body)" }}
            >
              {formatMinutesAsTime(latestStartMin)}
            </span>
          </div>
        )}

        {/* Description with read-more */}
        {description && (
          <div>
            <p
              className={`text-sm leading-relaxed ${descExpanded ? "" : "line-clamp-3"}`}
              style={{ color: "var(--color-text-body)" }}
            >
              {description}
            </p>
            {!descExpanded && description.length > 120 && (
              <button
                onClick={() => setDescExpanded(true)}
                className="text-sm font-semibold mt-0.5"
                style={{ color: "var(--color-primary)" }}
              >
                ...more
              </button>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="flex justify-center pt-0.5">
          <Link
            href={`/hiking/route/${route.id}`}
            className="inline-flex items-center gap-1 px-4 py-1 rounded-full border
                       active:opacity-70 transition-opacity"
            style={{
              borderColor: "var(--color-primary)",
              color: "var(--color-primary)",
              fontFamily: "var(--font-en)",
            }}
          >
            <span className="text-sm font-semibold">View Route</span>
            <ChevronRight size={14} strokeWidth={2} />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Small sub-components ──────────────────────────────────────────────────────

function InfoChip({
  icon,
  label,
  variant = "default",
}: {
  icon: React.ReactNode;
  label: string;
  variant?: "default" | "bus";
}) {
  return (
    <span
      className="font-num inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium"
      style={
        variant === "bus"
          ? { background: "rgba(0,82,164,0.08)", color: "#0052A4" }
          : { background: "rgba(46,94,74,0.08)", color: "var(--color-primary)" }
      }
    >
      {icon}
      {label}
    </span>
  );
}

const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Easy",
  2: "Novice",
  3: "Intermediate",
  4: "Advanced",
  5: "Expert",
};

function DifficultyChip({ difficulty }: { difficulty: number }) {
  const label = DIFFICULTY_LABELS[difficulty] ?? "Unknown";
  const isHard = difficulty >= 4;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium"
      style={{
        background: isHard ? "rgba(200,54,42,0.08)" : "rgba(46,94,74,0.08)",
        color: isHard ? "#C8362A" : "var(--color-primary)",
      }}
    >
      <TrendingUp size={13} strokeWidth={2} />
      {label}
    </span>
  );
}
