"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getLineColor } from "@/lib/subway";
import { formatMinutesAsTime } from "@/lib/safetyEngine";
import { t } from "@/lib/i18n";
import type { StationInfo } from "@/types/trail";

interface Props {
  isHiking: boolean;
  stationInfo?: StationInfo;
  latestStartMin?: number | null;
  isPastLatestStart: boolean;
  /** Peak ETA in minutes from midnight (KST) — shown in Active mode */
  peakETAMin?: number | null;
  /** Final (subway) ETA in minutes from midnight (KST) — shown in Active mode */
  finalETAMin?: number | null;
  /** Route display name — renders a back-link row at the top when provided */
  routeName?: string;
  /** href for the back link (defaults to /route) */
  backHref?: string;
}

export default function FloatingTrailHeader({
  isHiking,
  stationInfo,
  latestStartMin,
  isPastLatestStart,
  peakETAMin,
  finalETAMin,
  routeName,
  backHref = "/hiking/route",
}: Props) {
  const cardStyle = {
    background: "rgba(255,255,255,0.88)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    boxShadow: "0 2px 12px rgba(0,0,0,0.13)",
  };

  return (
    <div
      className="absolute top-3 left-3 right-3 z-10 rounded-xl"
      style={cardStyle}
    >
      {/* ── Back link row ────────────────────────────────── */}
      {routeName && (
        <Link
          href={backHref}
          className="flex items-center gap-1 px-3 pt-3 pb-2"
          style={{ color: "var(--color-primary)" }}
        >
          <ChevronLeft className="w-4 h-4 shrink-0" />
          <span className="text-sm font-semibold leading-tight truncate">
            {routeName}
          </span>
        </Link>
      )}

      {!isHiking ? (
        /* ── Ready to Hike Mode ─────────────────────────────── */
        <div className={`flex items-center justify-between gap-3 px-4 ${routeName ? "pt-1 pb-3" : "py-3"}`}>
          {/* Station info section */}
          {stationInfo ? (
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold text-[0.9rem] leading-none truncate">
                  {stationInfo.exit ? `Exit ${stationInfo.exit}, ` : ""}{t(stationInfo.name, "en")}
                </span>
              </div>
              {stationInfo.name.ko && (
                <span
                  className="text-[11px]"
                  style={{
                    fontFamily: "var(--font-ko)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {stationInfo.name.ko}{stationInfo.exit ? ` ${stationInfo.exit}번 출구` : ""}
                </span>
              )}
            </div>
          ) : (
            <div />
          )}

          {/* Latest Start */}
          {latestStartMin != null && (
            <div className="flex flex-col items-end shrink-0">
              <span
                className="text-[10px] font-semibold uppercase tracking-wide"
                style={{
                  color: isPastLatestStart ? "#EF4444" : "var(--color-text-muted)",
                }}
              >
                Last Safe Start
              </span>
              <span
                key={latestStartMin}
                className="text-sm font-bold tabular-nums"
                style={{
                  color: isPastLatestStart ? "#EF4444" : "var(--color-primary)",
                  display: "inline-block",
                  animation: "etaUpdate 0.28s ease",
                }}
              >
                {formatMinutesAsTime(latestStartMin)}
              </span>
            </div>
          )}
        </div>
      ) : (
        /* ── Active Hiking Mode ─────────────────────────────── */
        <div className={`flex items-center justify-between px-4 ${routeName ? "pt-1 pb-3" : "py-3"}`}>
          {/* Peak ETA */}
          <div className="flex flex-col gap-0.5">
            <span
              className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--color-text-muted)" }}
            >
              ▲ Peak ETA
            </span>
            <span
              key={peakETAMin}
              className="text-sm font-bold tabular-nums"
              style={{
                color: "var(--color-primary)",
                display: "inline-block",
                animation: "etaUpdate 0.28s ease",
              }}
            >
              {peakETAMin != null ? formatMinutesAsTime(peakETAMin) : "—"}
            </span>
          </div>

          <div
            className="w-px self-stretch"
            style={{ background: "var(--color-border)" }}
          />

          {/* Final ETA */}
          <div className="flex flex-col items-end gap-0.5">
            <span
              className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--color-text-muted)" }}
            >
              🏁 Final ETA
            </span>
            <span
              key={finalETAMin}
              className="text-sm font-bold tabular-nums"
              style={{
                color: "var(--color-primary)",
                display: "inline-block",
                animation: "etaUpdate 0.28s ease",
              }}
            >
              {finalETAMin != null ? formatMinutesAsTime(finalETAMin) : "—"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
