/**
 * Internationalization utility for JSONB-backed multilingual text fields.
 *
 * DB columns (name, description, direction_guide) are stored as JSONB objects
 * supporting 5 locales: en, ko, zh, ja, es.
 *
 *   { "en": "...", "ko": "...", "zh": "...", "ja": "...", "es": "..." }
 *
 * Use `t()` to resolve the right string for the current locale,
 * with automatic fallback to English when the locale key is absent.
 */

/** The 5 supported UI locales. */
export type SupportedLocale = "en" | "ko" | "zh" | "ja" | "es";

/**
 * A multilingual text object stored as JSONB in the database.
 * `en` is required; all other locales are optional so partial data is valid.
 * UI components and type definitions must accept all 5 keys.
 */
export type LocalizedText = {
  en: string;
  ko?: string;
  zh?: string;
  ja?: string;
  es?: string;
};

/**
 * Returns the text for `locale` from a LocalizedText object.
 * Falls back to English ("en") if the requested locale is missing or empty.
 * Returns "" if the object itself is null / undefined.
 *
 * @example
 *   t({ en: "Summit", ko: "정상" }, "ko")  // → "정상"
 *   t({ en: "Summit", ko: "정상" }, "ja")  // → "Summit"  (fallback)
 *   t(undefined, "en")                     // → ""
 */
export function t(
  text: LocalizedText | null | undefined,
  locale: string,
): string {
  if (!text) return "";
  return (text as Record<string, string | undefined>)[locale] || text.en || "";
}
