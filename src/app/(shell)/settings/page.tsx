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
  zh: {
    0: "徒步新手 — 走得慢，偏好平缓地形。",
    1: "偶尔徒步者 — 对清晰的步道感到舒适。",
    2: "常规徒步者 — 在大多数地形上保持稳定步速。",
    3: "身体强健且经验丰富 — 对陡峭的上坡感到舒适。",
    4: "越野跑速度 — 尽量减少休息停顿。",
  },
  ja: {
    0: "登山初心者 — ゆっくり歩き、緩やかな地形を好みます。",
    1: "時々登山をする人 — 整備された登山道を無理なく歩けます。",
    2: "一般的な登山客 — ほとんどの地形で一定の速度で歩きます。",
    3: "熟練した登山客 — 急な登り坂も慣れた様子で登ります。",
    4: "トレイルランナー級 — 休憩を最小限に抑え、非常に速く移動します。",
  },
  es: {
    0: "Nuevo en el senderismo: va despacio, prefiere terrenos suaves.",
    1: "Excursionista ocasional: se siente cómodo en senderos claros.",
    2: "Excursionista regular: ritmo constante en la mayoría de los terrenos.",
    3: "En forma y experimentado: cómodo con ascensos empinados.",
    4: "Ritmo de trail-runner: minimiza las paradas de descanso.",
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
          const disabled = false; // All languages are now enabled
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
          {tUI("gpsAlertNote", locale)}
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
        {/* Version */}
        <div className="px-4 py-3.5 flex items-center justify-between border-bottom border-black/[0.04]" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
          <span className="text-sm font-medium">{tUI("version", locale)}</span>
          <span
            className="text-sm font-bold tabular-nums"
            style={{ color: "var(--color-text-muted)" }}
          >
            1.0.0
          </span>
        </div>

        {/* Feedback */}
        <Link
          href="https://docs.google.com/forms/d/e/1FAIpQLSfuIAIdYil3vwRWOWBzrnxexNv_wcdvC24yN2-EhfPZM9JplQ/viewform?usp=sf_link&embedded=true"
          target="_blank"
          className="px-4 py-3.5 flex items-center justify-between hover:bg-[var(--color-bg-light)] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Icon icon="ph:chat-circle-dots" width={18} height={18} style={{ color: "var(--color-primary)" }} />
            <span className="text-sm font-medium">{tUI("sendFeedback", locale)}</span>
          </div>
          <Icon icon="ph:caret-right" width={16} height={16} style={{ color: "var(--color-text-muted)" }} />
        </Link>
      </div>
    </div>
  );
}
