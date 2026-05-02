"use client";

import { useEffect } from "react";

/**
 * Service worker registration.
 *
 * SW is intentionally disabled: Next.js+Vercel content-hashes all JS chunks
 * so the CDN handles caching correctly without SW interference. The SW was
 * causing users to receive stale code after deploys.
 *
 * On first load after this change, unregister any previously installed SW
 * so users are no longer stuck on old cached assets.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Unregister any previously installed SW to clear stale caches.
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((r) => r.unregister());
    });
  }, []);

  return null;
}
