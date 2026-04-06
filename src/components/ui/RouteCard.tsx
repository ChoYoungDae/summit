"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Ruler,
  Clock,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import ElevationPreview from "@/components/ui/ElevationPreview";
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
  elevationTrack?: [number, number, number][];
  /** Latest departure time in minutes from midnight (KST). Null = no data. */
  latestStartMin?: number | null;
  locale?: string;
}

export default function RouteCard({
  route,
  elevationTrack,
  latestStartMin,
  locale = "en",
}: RouteCardProps) {
  const [descExpanded, setDescExpanded] = useState(false);

  const isPastLatestStart =
    latestStartMin != null && nowKSTMin() > latestStartMin;

  const routeLabel = t(route.name, locale);
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
      {isPastLatestStart && latestStartMin != null && (
        <div
          className="flex items-center gap-2 px-4 py-1.5"
          style={{ background: "#EF4444" }}
        >
          <AlertTriangle
            className="shrink-0"
            size={13}
            strokeWidth={2}
            color="white"
          />
          <span className="text-[11px] font-semibold text-white uppercase tracking-wide">
            Last safe start&nbsp;
            <span className="tabular-nums">{formatMinutesAsTime(latestStartMin)}</span>
          </span>
        </div>
      )}

      {/* ── Card body ── */}
      <div className="flex flex-col gap-2.5 px-4 pt-4 pb-3">
        {/* Title */}
        <h2
          className="text-sm font-bold leading-snug text-center"
          style={{ fontFamily: "var(--font-en)" }}
        >
          {routeLabel}
        </h2>

        {/* Elevation preview */}
        {elevationTrack && elevationTrack.length > 0 && (
          <ElevationPreview track={elevationTrack} />
        )}

        {/* Info chips */}
        <div className="flex flex-wrap gap-1.5 justify-center">
          {route.totalDistanceM != null && (
            <InfoChip
              icon={<Ruler size={12} strokeWidth={2} />}
              label={`${formatDistanceKm(route.totalDistanceM)} km`}
            />
          )}
          {route.totalDurationMin != null && (
            <InfoChip
              icon={<Clock size={12} strokeWidth={2} />}
              label={formatTime(route.totalDurationMin)}
            />
          )}
          {route.totalDifficulty != null && (
            <DifficultyChip difficulty={route.totalDifficulty} />
          )}
        </div>

        {/* Safety: last safe start when NOT past deadline */}
        {!isPastLatestStart && latestStartMin != null && (
          <div className="flex items-center gap-1.5">
            <span
              className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--color-text-muted)" }}
            >
              Last safe start:
            </span>
            <span
              className="text-[11px] font-medium tabular-nums"
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
              className={`text-xs leading-relaxed ${descExpanded ? "" : "line-clamp-3"}`}
              style={{ color: "var(--color-text-body)" }}
            >
              {description}
            </p>
            {!descExpanded && description.length > 120 && (
              <button
                onClick={() => setDescExpanded(true)}
                className="text-xs font-semibold mt-0.5"
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
            href={`/route/${route.id}`}
            className="inline-flex items-center gap-1 px-4 py-1 rounded-full border
                       active:opacity-70 transition-opacity"
            style={{
              borderColor: "var(--color-primary)",
              color: "var(--color-primary)",
              fontFamily: "var(--font-en)",
            }}
          >
            <span className="text-xs font-semibold">View Route</span>
            <ChevronRight size={12} strokeWidth={2} />
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
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{
        background: "rgba(46,94,74,0.08)",
        color: "var(--color-primary)",
      }}
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
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
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
