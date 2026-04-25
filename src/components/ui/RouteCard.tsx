"use client";

import Link from "next/link";
import {
  ChevronRight,
  Ruler,
  Footprints,
  TrendingUp,
  Bus,
} from "lucide-react";
import { Icon } from "@iconify/react";
import { tDB, tUI } from "@/lib/i18n";
import type { LocalizedText } from "@/lib/i18n";
import { formatMinutesAsTime, nowKSTMin } from "@/lib/safetyEngine";
import type { Route } from "@/types/trail";

const HIGHLIGHT_COLOR = {
  highlight: "var(--color-primary)",
  pro_tip:   "#0068B7",
  warning:   "#C8362A",
} as const;

const HIGHLIGHT_ICON = {
  highlight: "ph:check-circle",
  pro_tip:   "ph:star",
  warning:   "ph:warning",
} as const;

const METRO_COLOR: Record<number | string, string> = {
  1: "#0052A4",
  2: "#00A84D",
  3: "#EF7C1C",
  4: "#3A8DDE",
  5: "#8B50A4",
  6: "#B05B25",
  7: "#707B03",
  8: "#E6186C",
  9: "#BB8C00",
  "신림": "#3D85C8",
};

function formatTime(minutes: number, locale: string = "en"): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hLabel = tUI("hour", locale);
  const mLabel = tUI("minute", locale);
  
  if (h === 0) return `${m}${mLabel}`;
  return m === 0 ? `${h}${hLabel}` : `${h}${hLabel} ${m}${mLabel}`;
}

function formatDistanceKm(metres: number): string {
  return (metres / 1000).toFixed(1);
}

interface RouteCardProps {
  route: Route;
  busDurationMin?: number;
  busSegmentCount?: number;
  latestStartMin?: number | null;
  stationInfo?: { name: LocalizedText; lines: (number | string)[] };
  locale?: string;
}

export default function RouteCard({
  route,
  busDurationMin = 0,
  busSegmentCount = 0,
  latestStartMin,
  stationInfo,
  locale = "en",
}: RouteCardProps) {
  const isPastLatestStart =
    latestStartMin != null && nowKSTMin() > latestStartMin;

  return (
    <div
      className="rounded-[var(--radius-card)] overflow-hidden"
      style={{
        background: "var(--color-card)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      }}
    >
      {/* ── Station + safety banner ── */}
      {!route.hideSafeStart && latestStartMin != null && (
        <div
          className="flex items-center justify-between gap-2 px-3 py-2"
          style={{ background: "#FFFFFF", borderBottom: "1px solid rgba(0,0,0,0.10)" }}
        >
          {/* Left: subway line circles + station name + shoe icon */}
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            {stationInfo?.lines.map((line) =>
              typeof line === "string" ? (
                <span
                  key={line}
                  className="inline-flex items-center justify-center rounded-full px-1.5 h-[18px] text-white shrink-0"
                  style={{ fontSize: "9px", fontWeight: 700, background: METRO_COLOR[line] ?? "#888", fontFamily: "var(--font-ko)" }}
                >
                  {line}
                </span>
              ) : (
                <span
                  key={line}
                  className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full text-white shrink-0"
                  style={{ fontSize: "10px", fontWeight: 700, background: METRO_COLOR[line] ?? "#888" }}
                >
                  {line}
                </span>
              )
            )}
            {stationInfo && (
              <span
                className="text-[12px] font-semibold truncate"
                style={{ color: "var(--color-text-body)" }}
              >
                {tDB(stationInfo.name, locale)}
              </span>
            )}
            <Icon icon="ph:sneaker" width={14} height={14} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
          </div>
          {/* Right: last safe start */}
          <div className="flex items-center gap-1 shrink-0">
            <Icon icon="ph:warning-circle" width={12} height={12} style={{ color: isPastLatestStart ? "#EF4444" : "var(--color-text-muted)" }} />
            <span
              className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--color-text-muted)" }}
            >
              {tUI("lastSafeStart", locale)}
            </span>
            <span
              className="font-num text-[11px] font-bold"
              style={{ color: isPastLatestStart ? "#EF4444" : "var(--color-text-body)" }}
            >
              {formatMinutesAsTime(latestStartMin)}
            </span>
          </div>
        </div>
      )}

      {/* ── Card body ── */}
      <div className="flex flex-col gap-4 px-4 pt-4 pb-4">
        {/* Title */}
        <div className="flex flex-col items-center gap-1">
          <h2
            className="text-base font-bold leading-snug text-center flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1"
            style={{ fontFamily: locale === "ko" ? "var(--font-ko)" : "var(--font-en)" }}
          >
            {tDB(route.name, locale)}
          </h2>
          {route.isOneway && (
            <span
              className="px-2 py-0.5 rounded-full border border-primary/30 text-[10px] font-bold text-primary uppercase tracking-tight"
              style={{ background: "rgba(46,94,74,0.05)" }}
            >
              {tUI("oneWayAscent", locale)}
            </span>
          )}
        </div>

        {/* Stats — AllTrails style */}
        <div className="flex justify-evenly">
          {route.totalDistanceM != null && (
            <StatItem
              icon={<Ruler size={14} strokeWidth={2} />}
              value={`${formatDistanceKm(route.totalDistanceM)} km`}
              label={tUI("statDistance", locale)}
            />
          )}
          {route.totalDurationMin != null && (
            <StatItem
              icon={<Footprints size={14} strokeWidth={2} />}
              value={formatTime(
                busDurationMin > 0 ? route.totalDurationMin - busDurationMin : route.totalDurationMin,
                locale
              )}
              label={tUI("statWalking", locale)}
            />
          )}
          {busDurationMin > 0 && (
            <StatItem
              icon={<Bus size={14} strokeWidth={2} />}
              value={
                busSegmentCount > 1
                  ? `${Math.round(busDurationMin / busSegmentCount)}${tUI("minute", locale)} ×${busSegmentCount}`
                  : formatTime(busDurationMin, locale)
              }
              label={tUI("statBus", locale)}
              color="#0068B7"
            />
          )}
          {route.totalDifficulty != null && (
            <StatItem
              icon={<TrendingUp size={14} strokeWidth={2} />}
              value={tUI(`diff_${route.totalDifficulty}` as Parameters<typeof tUI>[0], locale)}
              label={tUI("statDifficulty", locale)}
              color={route.totalDifficulty >= 4 ? "#C8362A" : "var(--color-primary)"}
            />
          )}
        </div>


        {/* Tags */}
        {route.tags && route.tags.length > 0 && (
          <div className="flex flex-wrap justify-evenly gap-y-1.5">
            {route.tags.map((tag, i) => (
              <span
                key={i}
                className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(0,0,0,0.04)",
                  color: "var(--color-text-muted)",
                  border: "1px solid rgba(0,0,0,0.08)",
                }}
              >
                #{tDB(tag, locale)}
              </span>
            ))}
          </div>
        )}

        {/* Highlights */}
        {route.highlights && route.highlights.length > 0 && (
          <div className="flex flex-col gap-1">
            {route.highlights.map((h, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <Icon
                  icon={HIGHLIGHT_ICON[h.type]}
                  width={15}
                  height={15}
                  className="mt-[3px] shrink-0"
                  style={{ color: HIGHLIGHT_COLOR[h.type] }}
                />
                <p className="text-sm leading-snug" style={{ color: "var(--color-text-body)" }}>
                  {tDB(h.text, locale)}
                </p>
              </div>
            ))}
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
            }}
          >
            <span className="text-sm font-semibold">{tUI("viewRoute", locale)}</span>
            <ChevronRight size={14} strokeWidth={2} />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Small sub-components ──────────────────────────────────────────────────────

function StatItem({
  icon,
  value,
  label,
  color = "var(--color-primary)",
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1" style={{ color }}>
        {icon}
        <span className="font-num text-sm font-bold">{value}</span>
      </div>
      <span className="text-[11px] font-medium" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </span>
    </div>
  );
}
