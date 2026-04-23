"use client";

import { useEffect } from "react";
import { LANGUAGE_STORAGE_KEY } from "@/lib/i18n";

/**
 * Syncs the locale from localStorage to a cookie on the first load.
 * This ensures that subsequent server component renders have access to the correct locale.
 */
export default function LocaleSync() {
  useEffect(() => {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored) {
      const cookieValue = document.cookie
        .split("; ")
        .find((row) => row.startsWith(`${LANGUAGE_STORAGE_KEY}=`))
        ?.split("=")[1];

      if (cookieValue !== stored) {
        console.log(`[LocaleSync] Syncing cookie: ${cookieValue} -> ${stored}`);
        document.cookie = `${LANGUAGE_STORAGE_KEY}=${stored}; path=/; max-age=31536000; SameSite=Lax`;
        
        // Use a small delay before reload to ensure cookie is written
        setTimeout(() => {
          window.location.reload();
        }, 50);
      }
    }
  }, []);

  return null;
}
