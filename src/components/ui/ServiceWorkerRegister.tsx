"use client";

import { useEffect } from "react";

/** Registers the service worker once the app is hydrated. Returns nothing. */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => console.warn("[SW] Registration failed:", err));
    }
  }, []);

  return null;
}
