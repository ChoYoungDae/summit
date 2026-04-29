"use client";

import Link from "next/link";
import { ChevronLeft, AlertTriangle, Flag, Train, Moon } from "lucide-react";
import { formatMinutesAsTime } from "@/lib/safetyEngine";
import { tDB, tUI } from "@/lib/i18n";
import type { StationInfo, HikingPhase } from "@/types/trail";
import { useLanguage } from "@/lib/useLanguage";

const SUBWAY_LINE_COLORS: Record<number | string, string> = {
  1: "#0052A4",
  2: "#00A84D",
  3: "#EF7C1C",
  4: "#00A5DE",
  5: "#996CAC",
  6: "#CD7C2F",
  7: "#747F00",
  8: "#E6186C",
  9: "#BDB092",
  "신림": "#3D85C8",
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
  hikingMode?: "preview" | "active";
  nightView?: boolean;
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
  hikingMode,
  nightView,
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
      className="absolute top-3 left-3 right-3 z-10 rounded-2xl overflow-hidden border border-white/30 pointer-events-auto"
      style={cardStyle}
    >
      {/* ── Back link row ────────────────────────────────── */}
      {routeName && (
        <Link
          href={backHref}
          className="flex items-center gap-0.5 pl-1 pr-4 pt-2.5 pb-1"
          style={{ color: "var(--color-primary)" }}
        >
          <ChevronLeft className="w-6 h-6 shrink-0" />
          <span className="text-[20px] font-extrabold tracking-tight truncate">
            {routeName}
          </span>
        </Link>
      )}

      <div className={`flex justify-between gap-6 px-4 pb-3.5 pt-1 ${nightView && (!isHiking || hikingMode !== "active") ? "items-start" : "items-center"}`}>
        {/* Left: Station info section */}
        {stationInfo ? (
          <div className="flex flex-col gap-1 min-w-0">
            {/* Row 1: line circles + exit badge */}
            <div className="flex items-center gap-1.5">
              {stationInfo.lines?.map((ln) =>
                typeof ln === "string" ? (
                  <span
                    key={ln}
                    className="inline-flex items-center justify-center rounded-full px-1.5 text-white font-black leading-none shrink-0"
                    style={{ height: 20, fontSize: 10, background: SUBWAY_LINE_COLORS[ln] ?? "#888", fontFamily: "var(--font-ko)" }}
                  >
                    {ln}
                  </span>
                ) : (
                  <span
                    key={ln}
                    className="inline-flex items-center justify-center text-white font-black text-[11px] leading-none shrink-0"
                    style={{ width: 20, height: 20, borderRadius: "50%", background: SUBWAY_LINE_COLORS[ln] ?? "#888" }}
                  >
                    {ln}
                  </span>
                )
              )}
              {stationInfo.exit && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-md font-black text-[11px] leading-none shrink-0"
                  style={{ background: "#1A1A1A", color: "#F5C842" }}
                >
                  Exit {stationInfo.exit}
                </span>
              )}
            </div>
            {/* Row 2: English name (primary) + Korean name (70% size) */}
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-black text-[1.15rem] leading-tight tracking-tight">
                {tDB(stationInfo.name, locale)}
              </span>
              {locale !== "ko" && stationInfo.name.ko && (
                <span
                  className="font-semibold leading-tight"
                  style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", fontFamily: "var(--font-ko)" }}
                >
                  {stationInfo.name.ko}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div />
        )}

        {/* Right: Triple ETA Stack */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {(!isHiking || hikingMode !== "active") ? (
            nightView ? (
              /* NIGHT VIEW MODE */
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ background: "#1A237E" }}
              >
                <Moon className="w-3.5 h-3.5 text-white" />
                <span className="text-[12px] font-bold tracking-wide text-white">
                  Night View
                </span>
              </div>
            ) : (
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
            )
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
