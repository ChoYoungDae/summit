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

export const LANGUAGE_STORAGE_KEY = "app-language";
export const DEFAULT_LANGUAGE: SupportedLocale = "en";

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
 */
export function tDB(
  text: LocalizedText | null | undefined,
  locale: string,
): string {
  if (!text) return "";
  return (text as Record<string, string | undefined>)[locale] || text.en || "";
}

/** ── UI String Translations ────────────────────────────────────────────────── */

import UI_STRINGS_JSON from "./ui_strings_generated.json";

/**
 * UI_STRINGS is now generated from the i18n_glossary table in the database.
 * To update these strings, edit the DB and run `npx tsx scripts/translate.ts`.
 */
export const UI_STRINGS = UI_STRINGS_JSON as typeof UI_STRINGS_JSON;

export function tUI(key: keyof typeof UI_STRINGS.en, locale: string): string {
  const dict = (UI_STRINGS as any)[locale] || UI_STRINGS.en;
  return dict[key] || (UI_STRINGS.en as any)[key] || "";
}
