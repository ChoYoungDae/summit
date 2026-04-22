"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";
import { useHikingLevel } from "@/lib/useHikingLevel";
import { SKILL_LEVELS } from "@/lib/hikingLevel";
import type { SkillIndex } from "@/lib/hikingLevel";
import { useLanguage, LANGUAGES } from "@/lib/useLanguage";
import { tUI } from "@/lib/i18n";
import {
  useOffRouteSettings,
  OFF_ROUTE_THRESHOLD_MIN,
  OFF_ROUTE_THRESHOLD_MAX,
  OFF_ROUTE_THRESHOLD_STEP,
} from "@/lib/useOffRouteSettings";

// ── Multiplier pill colour per level ─────────────────────────────────────────

const LEVEL_COLOURS: Record<number, { bg: string; text: string }> = {
  0: { bg: "#FEF3C7", text: "#92400E" }, // Novice   — amber tint
  1: { bg: "#DBEAFE", text: "#1E40AF" }, // Beginner — blue tint
  2: { bg: "#D1FAE5", text: "#065F46" }, // Normal   — green tint
  3: { bg: "#EDE9FE", text: "#5B21B6" }, // Experienced — violet
  4: { bg: "#FFE4E6", text: "#9F1239" }, // Expert   — rose
};

// ── Description copy per level ────────────────────────────────────────────────

const LEVEL_DESC: Record<string, Record<number, string>> = {
  en: {
    0: "New to hiking — takes it slow, prefers gentle terrain.",
    1: "Occasional hiker — comfortable on clear trails.",
    2: "Regular hiker — steady pace on most terrain.",
    3: "Fit & seasoned — comfortable with steep ascents.",
    4: "Trail-runner pace — minimises rest stops.",
  },
  ko: {
    0: "등산 입문자 — 천천히 걷는 것을 선호하며 완만한 지형에 적합합니다.",
    1: "초보 등산객 — 정비된 등산로에서 무리 없이 걸을 수 있습니다.",
    2: "일반 등산객 — 대부분의 지형에서 일정한 속도로 걷습니다.",
    3: "숙련된 등산객 — 가파른 오르막길도 익숙하게 오릅니다.",
    4: "트레일 러너 수준 — 휴식을 최소화하며 매우 빠르게 이동합니다.",
  },
};

// ── Settings page ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { index, setLevel } = useHikingLevel();
  const { locale, setLanguage } = useLanguage();
  const { threshold, setThreshold } = useOffRouteSettings();

  return (
    <div className="px-4 pt-5 pb-8">

      {/* ── Language section ─────────────────────────────────── */}
      <h2
        className="text-[11px] font-semibold uppercase tracking-widest mb-3"
        style={{ color: "var(--color-text-muted)" }}
      >
        {tUI("language", locale)}
      </h2>
      <div
        className="rounded-2xl overflow-hidden mb-7"
        style={{ background: "var(--color-card)", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}
      >
        {LANGUAGES.map(({ locale: l, label }, i) => {
          const active = locale === l;
          const disabled = l !== "en" && l !== "ko";
          return (
            <button
              key={l}
              onClick={() => !disabled && setLanguage(l)}
              disabled={disabled}
              className="w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors"
              style={{
                background: active ? "rgba(46,94,74,0.06)" : "transparent",
                borderBottom: i < LANGUAGES.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none",
                cursor: disabled ? "default" : "pointer",
                opacity: disabled ? 0.38 : 1,
              }}
            >
              <span
                className="text-sm font-medium"
                style={{ color: active ? "var(--color-primary)" : "var(--fg)" }}
              >
                {label}
              </span>
              {active && (
                <div
                  className="shrink-0 rounded-full flex items-center justify-center"
                  style={{ width: 20, height: 20, background: "var(--color-primary)" }}
                >
                  <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
                    <path
                      d="M1 4l3 3 6-6"
                      stroke="#fff"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
              {disabled && (
                <span
                  className="text-[11px] font-medium px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(0,0,0,0.06)", color: "var(--color-text-muted)" }}
                >
                  {tUI("comingSoon", locale)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Hiking Level section ─────────────────────────────── */}
      <h2
        className="text-[11px] font-semibold uppercase tracking-widest mb-3"
        style={{ color: "var(--color-text-muted)" }}
      >
        {tUI("hikingLevel", locale)}
      </h2>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "var(--color-card)", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}
      >
        {SKILL_LEVELS.map((lvl, i) => {
          const active = index === i;
          const colours = LEVEL_COLOURS[i]!;

          return (
            <button
              key={lvl.label}
              onClick={() => setLevel(i as SkillIndex)}
              className="w-full flex items-center gap-4 px-4 py-3.5 transition-colors active:bg-[var(--color-bg-light)] text-left"
              style={{
                background: active ? "rgba(46,94,74,0.06)" : "transparent",
                borderBottom: i < SKILL_LEVELS.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none",
              }}
            >
              {/* Icon */}
              <div
                className="flex items-center justify-center rounded-xl shrink-0"
                style={{
                  width: 40,
                  height: 40,
                  background: active ? "var(--color-primary)" : "var(--color-bg-light)",
                }}
              >
                <Icon
                  icon={lvl.icon}
                  width={22}
                  height={22}
                  style={{ color: active ? "#fff" : "var(--color-text-muted)" }}
                />
              </div>

              {/* Label + description */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm font-bold"
                    style={{
                      color: active ? "var(--color-primary)" : "var(--fg)",
                      fontFamily: "var(--font-en)",
                    }}
                  >
                    {lvl.label}
                  </span>
                  <span
                    className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ background: colours.bg, color: colours.text }}
                  >
                    {lvl.multiplier}×
                  </span>
                </div>
                <p
                  className="text-[12px] leading-snug mt-0.5"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {LEVEL_DESC[locale as keyof typeof LEVEL_DESC]?.[i] || LEVEL_DESC.en[i]}
                </p>
              </div>

              {/* Active checkmark */}
              {active && (
                <div
                  className="shrink-0 rounded-full flex items-center justify-center"
                  style={{
                    width: 20,
                    height: 20,
                    background: "var(--color-primary)",
                  }}
                >
                  <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
                    <path
                      d="M1 4l3 3 6-6"
                      stroke="#fff"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <p
        className="text-[11px] mt-2 px-1"
        style={{ color: "var(--color-text-muted)" }}
      >
        This affects estimated hiking time and Last Safe Start calculations across all routes.
      </p>

      {/* ── Navigation section ───────────────────────────────── */}
      <h2
        className="text-[11px] font-semibold uppercase tracking-widest mt-7 mb-3"
        style={{ color: "var(--color-text-muted)" }}
      >
        {tUI("navigation", locale)}
      </h2>
      <div
        className="rounded-2xl px-4 py-4 mb-2"
        style={{ background: "var(--color-card)", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon icon="ph:warning" width={18} height={18} style={{ color: "var(--color-secondary)" }} />
            <span className="text-sm font-semibold">{tUI("offRouteAlert", locale)}</span>
          </div>
          <span
            className="text-sm font-bold tabular-nums px-2.5 py-0.5 rounded-lg"
            style={{ background: "rgba(200,54,42,0.08)", color: "var(--color-secondary)" }}
          >
            {threshold} m
          </span>
        </div>
        <input
          type="range"
          min={OFF_ROUTE_THRESHOLD_MIN}
          max={OFF_ROUTE_THRESHOLD_MAX}
          step={OFF_ROUTE_THRESHOLD_STEP}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className="w-full"
          style={{ accentColor: "var(--color-secondary)" }}
        />
        <div
          className="flex justify-between text-[11px] mt-1"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span>{OFF_ROUTE_THRESHOLD_MIN} m</span>
          <span>{OFF_ROUTE_THRESHOLD_MAX} m</span>
        </div>
        <p className="text-[11px] mt-2" style={{ color: "var(--color-text-muted)" }}>
          {locale === "ko" 
            ? "GPS를 3번 연속 잘못 읽거나 5초 이상 경로를 벗어나면 알림이 울립니다."
            : "Alert fires after 3 consecutive GPS readings or 5 s off the trail."}
        </p>
      </div>

      {/* ── About section ────────────────────────────────────── */}
      <h2
        className="text-[11px] font-semibold uppercase tracking-widest mt-7 mb-3"
        style={{ color: "var(--color-text-muted)" }}
      >
        {tUI("about", locale)}
      </h2>
      <div
        className="rounded-2xl overflow-hidden shadow-sm border border-black/[0.04]"
        style={{ background: "var(--color-card)" }}
      >
        <div className="px-4 py-3.5 flex items-center justify-between">
          <span className="text-sm font-medium">{tUI("version", locale)}</span>
          <span
            className="text-sm font-bold tabular-nums"
            style={{ color: "var(--color-text-muted)" }}
          >
            0.1.0
          </span>
        </div>
      </div>
    </div>
  );
}
