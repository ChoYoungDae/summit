"use client";

import { useEffect } from "react";

/**
 * Service worker cleanup.
 *
 * SW registration is disabled. This component:
 * 1. Listens for SW_UPDATED from any still-active old SW → force-reloads
 *    the page so fresh JS is loaded from the network immediately.
 * 2. Unregisters any previously installed SW registrations.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Old SW activates our new sw.js, posts SW_UPDATED, then unregisters itself.
    // Force-reload here so this tab immediately gets fresh code from the network.
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "SW_UPDATED") {
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener("message", handleMessage);

    // Unregister any previously installed SW
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((r) => r.unregister());
    });

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, []);

  return null;
}
