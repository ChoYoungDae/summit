"use client";

import { useState, useEffect, useCallback } from "react";
import type { SupportedLocale } from "./i18n";

import { LANGUAGE_STORAGE_KEY, DEFAULT_LANGUAGE } from "./i18n";
const CHANGE_EVENT = "language-change";

export const LANGUAGES: { locale: SupportedLocale; label: string }[] = [
  { locale: "en", label: "English" },
  { locale: "zh", label: "中文" },
  { locale: "ja", label: "日本語" },
  { locale: "es", label: "Español" },
  { locale: "ko", label: "한국어" },
];

export function useLanguage() {
  const [locale, setLocale] = useState<SupportedLocale>(DEFAULT_LANGUAGE);

  useEffect(() => {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && LANGUAGES.some((l) => l.locale === stored)) {
      setLocale(stored as SupportedLocale);
      // Sync to cookie so server components pick up the right locale
      document.cookie = `${LANGUAGE_STORAGE_KEY}=${stored}; path=/; max-age=31536000; SameSite=Lax`;
    }

    function handler(e: Event) {
      setLocale((e as CustomEvent<{ locale: SupportedLocale }>).detail.locale);
    }
    window.addEventListener(CHANGE_EVENT, handler);
    return () => window.removeEventListener(CHANGE_EVENT, handler);
  }, []);

  const setLanguage = useCallback((l: SupportedLocale) => {
    setLocale(l);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, l);
    // Set cookie for server components (expires in 1 year)
    document.cookie = `${LANGUAGE_STORAGE_KEY}=${l}; path=/; max-age=31536000; SameSite=Lax`;
    window.dispatchEvent(
      new CustomEvent<{ locale: SupportedLocale }>(CHANGE_EVENT, {
        detail: { locale: l },
      }),
    );
  }, []);

  return { locale, setLanguage };
}
