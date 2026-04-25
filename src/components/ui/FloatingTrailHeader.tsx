"use client";

import Link from "next/link";
import { ChevronLeft, AlertTriangle, Flag, Train } from "lucide-react";
import { formatMinutesAsTime } from "@/lib/safetyEngine";
import { tDB, tUI } from "@/lib/i18n";
import type { StationInfo, HikingPhase } from "@/types/trail";
import { useLanguage } from "@/lib/useLanguage";

const SUBWAY_LINE_COLORS: Record<number, string> = {
  1: "#0052A4",
  2: "#00A84D",
  3: "#EF7C1C",
  4: "#00A5DE",
  5: "#996CAC",
  6: "#CD7C2F",
  7: "#747F00",
  8: "#E6186C",
  9: "#BDB092",
};

interface Props {
  isHiking: boolean;
  stationInfo?: StationInfo;
  latestStartMin?: number | null;
  isPastLatestStart: boolean;
  /** Peak ETA in minutes from midnight (KST) */
  peakETAMin?: number | null;
  /** Trailhead ETA (end of mountain path) */
  trailheadETAMin?: number | null;
  /** Final (subway station) ETA */
  finalETAMin?: number | null;
  /** Route display name */
  routeName?: string;
  /** href for the back link (defaults to /route) */
  backHref?: string;
  locale?: string;
  hikingPhase?: HikingPhase;
}

export default function FloatingTrailHeader({
  isHiking,
  stationInfo,
  latestStartMin,
  isPastLatestStart,
  peakETAMin,
  trailheadETAMin,
  finalETAMin,
  routeName,
  backHref = "/route",
  locale: propLocale,
  hikingPhase,
}: Props) {
  const { locale: hookLocale } = useLanguage();
  const locale = propLocale || hookLocale;

  const cardStyle = {
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    boxShadow: "0 4px 24px rgba(0,0,0,0.16)",
  };

  const renderETALine = (
    label: string,
    timeMin: number | null | undefined,
    Icon: any,
    color?: string,
    iconColor?: string
  ) => {
    if (timeMin == null) return <div className="h-5" />;
    return (
      <div className="flex items-center justify-end gap-3 min-w-[145px]">
        <div className="flex items-center gap-1.5 flex-1 justify-end">
          <Icon
            className="w-3.5 h-3.5"
            style={{ color: iconColor || "var(--color-text-muted)" }}
          />
          <span
            className="text-[9.5px] font-bold uppercase tracking-tight text-right leading-none"
            style={{ color: "var(--color-text-muted)" }}
          >
            {label}
          </span>
        </div>
        <span
          className="text-[14px] font-black tabular-nums leading-none min-w-[66px] text-right"
          style={{ color: color || "var(--color-primary)" }}
        >
          {formatMinutesAsTime(timeMin)}
        </span>
      </div>
    );
  };

  return (
    <div
      className="absolute top-3 left-3 right-3 z-10 rounded-2xl overflow-hidden border border-white/30"
      style={cardStyle}
    >
      {/* ── Back link row ────────────────────────────────── */}
      {routeName && (
        <Link
          href={backHref}
          className="flex items-center gap-1 px-4 pt-2.5 pb-1"
          style={{ color: "var(--color-primary)" }}
        >
          <ChevronLeft className="w-5 h-5 shrink-0" />
          <span className="text-[16px] font-extrabold tracking-tight truncate">
            {routeName}
          </span>
        </Link>
      )}

      <div className="flex items-center justify-between gap-6 px-4 pb-3.5 pt-1">
        {/* Left: Station info section */}
        {stationInfo ? (
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-black text-[1.15rem] leading-tight tracking-tight">
                {locale === "ko"
                  ? `${tDB(stationInfo.name, locale)}${stationInfo.exit ? ` ${stationInfo.exit}번 출구` : ""}`
                  : `${stationInfo.exit ? `${tUI("exit", locale)} ${stationInfo.exit}, ` : ""}${tDB(stationInfo.name, locale)}`}
              </span>
              {stationInfo.line && SUBWAY_LINE_COLORS[stationInfo.line] && (
                <span
                  className="inline-flex items-center justify-center text-white font-black text-[11px] leading-none shrink-0"
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: SUBWAY_LINE_COLORS[stationInfo.line],
                  }}
                >
                  {stationInfo.line}
                </span>
              )}
            </div>
            {locale !== "ko" && stationInfo.name.ko && (
              <span
                className="text-[11px] font-semibold"
                style={{
                  fontFamily: "var(--font-ko)",
                  color: "var(--color-text-muted)",
                }}
              >
                {stationInfo.name.ko}
                {stationInfo.exit ? ` ${stationInfo.exit}번 출구` : ""}
              </span>
            )}
          </div>
        ) : (
          <div />
        )}

        {/* Right: Triple ETA Stack */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {!isHiking ? (
            /* PRE-HIKE MODE */
            <>
              {latestStartMin != null && renderETALine(
                tUI("lastSafeStart", locale),
                latestStartMin,
                AlertTriangle,
                isPastLatestStart ? "#EF4444" : "#D97706",
                isPastLatestStart ? "#EF4444" : "#D97706"
              )}
              {renderETALine(tUI("summitArrival", locale), peakETAMin, Flag)}
              {renderETALine(tUI("stationArrival", locale), finalETAMin, Train)}
            </>
          ) : hikingPhase === "ascent" ? (
            /* ASCENT MODE */
            <>
              <div className="h-4" />
              {renderETALine(tUI("summitArrival", locale), peakETAMin, Flag)}
              {renderETALine(tUI("stationArrival", locale), finalETAMin, Train)}
            </>
          ) : (
            /* DESCENT MODE */
            <>
              <div className="h-4" />
              {renderETALine(tUI("trailheadArrival", locale), trailheadETAMin, Flag)}
              {renderETALine(tUI("stationArrival", locale), finalETAMin, Train)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
