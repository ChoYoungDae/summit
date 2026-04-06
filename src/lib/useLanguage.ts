"use client";

import { useState, useEffect, useCallback } from "react";
import type { SupportedLocale } from "./i18n";

export const LANGUAGE_STORAGE_KEY = "app-language";
export const DEFAULT_LANGUAGE: SupportedLocale = "en";
const CHANGE_EVENT = "language-change";

export const LANGUAGES: { locale: SupportedLocale; label: string }[] = [
  { locale: "en", label: "English" },
  { locale: "ko", label: "한국어" },
  { locale: "zh", label: "中文" },
  { locale: "ja", label: "日本語" },
  { locale: "es", label: "Español" },
];

export function useLanguage() {
  const [locale, setLocale] = useState<SupportedLocale>(DEFAULT_LANGUAGE);

  useEffect(() => {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && LANGUAGES.some((l) => l.locale === stored)) {
      setLocale(stored as SupportedLocale);
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
    window.dispatchEvent(
      new CustomEvent<{ locale: SupportedLocale }>(CHANGE_EVENT, {
        detail: { locale: l },
      }),
    );
  }, []);

  return { locale, setLanguage };
}
