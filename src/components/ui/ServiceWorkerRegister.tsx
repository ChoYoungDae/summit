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
    // We defer the reload until the user navigates away or the page is hidden,
    // so an active hiking session is never interrupted mid-trail.
    navigator.serviceWorker.addEventListener("message", (e) => {
      if (e.data?.type !== "SW_UPDATED") return;
      // If the page isn't visible (tab in background / screen off), reload now.
      if (document.visibilityState === "hidden") {
        window.location.reload();
        return;
      }
      // Otherwise wait until the user leaves the page.
      const reloadOnHide = () => {
        if (document.visibilityState === "hidden") {
          window.location.reload();
        }
      };
      document.addEventListener("visibilitychange", reloadOnHide, { once: true });
    });
  }, []);

  return null;
}
