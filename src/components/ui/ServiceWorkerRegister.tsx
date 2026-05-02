"use client";

import { useEffect } from "react";

/** Registers the service worker once the app is hydrated. Returns nothing. */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => console.warn("[SW] Registration failed:", err));

    // When the SW activates a new version it sends SW_UPDATED.
    // Reload the page so the new JS actually runs (the SW swap alone
    // doesn't replace already-executing scripts).
    navigator.serviceWorker.addEventListener("message", (e) => {
      if (e.data?.type === "SW_UPDATED") {
        window.location.reload();
      }
    });
  }, []);

  return null;
}
