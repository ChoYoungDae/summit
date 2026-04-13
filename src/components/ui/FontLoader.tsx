"use client";

/**
 * FontLoader — dynamic CJK font injection based on the selected UI locale.
 *
 * Strategy:
 *  - Noto Sans KR is always loaded statically in globals.css (trail signs are always Korean).
 *  - Noto Sans JP / SC are large; load them only when the user selects ja / zh.
 *  - Latin locales (en, es) and ko need no extra font — Nunito + Noto Sans KR cover them.
 *
 * Google Fonts CSS API handles unicode-range subsetting automatically — it only
 * downloads the glyph blocks the page actually renders.
 */

import { useEffect } from "react";
import { LANGUAGE_STORAGE_KEY, DEFAULT_LANGUAGE } from "@/lib/useLanguage";
import type { SupportedLocale } from "@/lib/i18n";

const LINK_ID = "dynamic-cjk-font";

/** Maps locales that need an extra font to the Google Fonts URL for that font. */
const EXTRA_FONT_URL: Partial<Record<SupportedLocale, string>> = {
  ja: "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&display=swap",
  zh: "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&display=swap",
};

function applyFont(locale: SupportedLocale) {
  const existing = document.getElementById(LINK_ID);
  const url = EXTRA_FONT_URL[locale];

  if (!url) {
    // No extra font needed for this locale — remove any previously injected link.
    existing?.remove();
    return;
  }

  if (existing) {
    if ((existing as HTMLLinkElement).href === url) return; // already correct
    existing.remove();
  }

  const link = document.createElement("link");
  link.id = LINK_ID;
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}

export default function FontLoader() {
  useEffect(() => {
    // Apply font for the initial stored locale.
    const stored = (localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? DEFAULT_LANGUAGE) as SupportedLocale;
    applyFont(stored);

    // Re-apply on locale change dispatched by useLanguage.
    function handleChange(e: Event) {
      const locale = (e as CustomEvent<{ locale: SupportedLocale }>).detail.locale;
      applyFont(locale);
    }
    window.addEventListener("language-change", handleChange);
    return () => window.removeEventListener("language-change", handleChange);
  }, []);

  return null;
}
