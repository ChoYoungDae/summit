import { type HTMLAttributes } from "react";

/**
 * SubLabel — a secondary-language annotation beneath the primary (English) text.
 *
 * Korean is optional and should only be used where it genuinely helps users
 * (e.g. reading physical trail signs). Future languages can be added via
 * `extraLabels` — Korean is always the last sub-label.
 *
 * Visual contract:
 *   - English (main)  →  default text color, 100% size, font-en
 *   - Korean  (sub)   →  muted color (#AAABB8), ~60% size, font-ko
 *   - Others  (sub)   →  muted color, ~60% size, font of choice
 */
export interface SubLabel {
  /** The text to display */
  text: string;
  /** BCP-47 language tag, e.g. "ko", "zh-Hans", "ja" */
  lang: string;
  /** CSS font-family string. Defaults to --font-ko for "ko". */
  fontFamily?: string;
}

export interface DualTextProps extends HTMLAttributes<HTMLSpanElement> {
  /** Primary English text */
  en: string;
  /** Korean annotation — only for signage/place-name contexts where Korean text helps users */
  ko?: string;
  /**
   * Optional additional language labels rendered between English and Korean.
   * Korean is always appended last so it is visually closest to the English.
   */
  extraLabels?: Omit<SubLabel, "lang">[];
  /** Font size for the English label (CSS value, e.g. "1rem", "16px"). Defaults to "1rem". */
  size?: string;
  /** Ratio of Korean label size relative to English. Defaults to 0.6 (60%). */
  subRatio?: number;
  /** Tailwind / CSS class for the wrapper element */
  className?: string;
}

/**
 * DualText — renders English as the primary label with optional Korean (or
 * other language) sub-labels for signage contexts.
 *
 * @example
 * <DualText en="Bukhansan" />
 * <DualText en="Bukhansan" ko="북한산" />
 */
export function DualText({
  en,
  ko,
  extraLabels = [],
  size = "1rem",
  subRatio = 0.6,
  className = "",
  ...rest
}: DualTextProps) {
  const subFontSize = `calc(${size} * ${subRatio})`;

  // If both are same (common when locale is 'ko'), only show one
  const isDuplicate = en === ko;

  // Extra labels are shown between English and Korean
  const extras: SubLabel[] = extraLabels.map((l, i) => ({
    ...l,
    lang: `extra-${i}`,
  }));

  const korean: SubLabel[] = ko && !isDuplicate
    ? [{ text: ko, lang: "ko", fontFamily: "var(--font-ko)" }]
    : [];

  const allSubs: SubLabel[] = [...extras, ...korean];

  // Heuristic to check if text is CJK to apply correct font-family
  const isKoreanText = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(en);

  return (
    <span
      className={`inline-flex flex-col leading-none gap-[0.25em] ${className}`}
      {...rest}
    >
      {/* ── Primary ── */}
      <span
        className="font-medium text-[var(--fg)]"
        style={{ 
          fontSize: size, 
          fontFamily: isKoreanText ? "var(--font-ko)" : "var(--font-en)" 
        }}
        lang={isKoreanText ? "ko" : "en"}
      >
        {en}
      </span>

      {/* ── Secondary: Extra + Korean (if not duplicate) ── */}
      {allSubs.map((sub) => (
        <span
          key={sub.lang}
          className="text-[var(--color-text-muted)]"
          style={{
            fontSize: subFontSize,
            fontFamily: sub.fontFamily ?? "var(--font-ko)",
          }}
          lang={sub.lang.startsWith("extra-") ? undefined : sub.lang}
        >
          {sub.text}
        </span>
      ))}
    </span>
  );
}
