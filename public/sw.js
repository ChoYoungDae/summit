/**
 * S3 Service Worker — battery-friendly offline caching + background waypoint proximity
 *
 * Strategy:
 *  • Mapbox tiles / styles / glyphs  → cache-first  (max 500 entries, LRU trim)
 *  • Next.js static chunks (_next/static/) → cache-first
 *  • HTML navigation requests         → network-first with cache fallback
 *  • Everything else (Supabase API, analytics) → pass-through (no caching)
 */

const TILE_CACHE = "s3-tiles-v1";
const STATIC_CACHE = "s3-static-v2"; // bump this on every deploy to bust stale JS
const MAX_TILES = 500;

// ── Lifecycle ─────────────────────────────────────────────────────────────────

self.addEventListener("install", () => {
  // Activate immediately without waiting for existing tabs to close
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Keep map tile cache (expensive to re-download) but delete ALL static/page
  // caches — Next.js chunk filenames are content-hashed so re-fetching is fast,
  // and this guarantees users always get the latest JS after a deploy.
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== TILE_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch router ──────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip non-http(s) requests (chrome-extension://, etc.)
  if (!url.protocol.startsWith("http")) return;

  // ── Mapbox map data (tiles, styles, sprites, glyphs) ──────────────────────
  // Skip events.mapbox.com (analytics — never cache)
  if (url.hostname === "events.mapbox.com") return;

  if (
    url.hostname.endsWith(".mapbox.com") ||
    url.hostname === "api.mapbox.com"
  ) {
    event.respondWith(cacheFirst(request, TILE_CACHE, MAX_TILES));
    return;
  }

  // ── Next.js immutable static assets ───────────────────────────────────────
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, Infinity));
    return;
  }

  // ── App page navigations ───────────────────────────────────────────────────
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  // All other requests (Supabase, API routes, etc.) fall through unmodified
});

// ── Strategies ────────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName, maxEntries) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      // Put a clone — response body can only be consumed once
      cache.put(request, response.clone());
      if (isFinite(maxEntries)) trimCache(cache, maxEntries);
    }
    return response;
  } catch {
    return new Response("Offline", {
      status: 503,
      statusText: "Service Unavailable",
    });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return (
      cached ??
      new Response("Offline", { status: 503, statusText: "Service Unavailable" })
    );
  }
}

// ── Background waypoint proximity ─────────────────────────────────────────────
//
// The main thread sends GPS fixes via postMessage while hiking.
// The SW checks them against stored waypoints and fires a notification when
// the hiker enters the alert radius — even if the app tab is backgrounded.

/** Waypoint store: set via SET_WAYPOINTS, cleared via CLEAR_WAYPOINTS. */
let hikingWaypoints = [];
const PROXIMITY_RADIUS_M = 80;

/** Inline Haversine (metres) — SW cannot import TS modules. */
function swDistM(lat1, lon1, lat2, lon2) {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

self.addEventListener("message", (event) => {
  const { type } = event.data ?? {};

  if (type === "SET_WAYPOINTS") {
    // Reset alerted flags on each new hike session
    hikingWaypoints = (event.data.waypoints ?? []).map((w) => ({ ...w, _alerted: false }));
    return;
  }

  if (type === "CLEAR_WAYPOINTS") {
    hikingWaypoints = [];
    return;
  }

  if (type === "CHECK_PROXIMITY") {
    const { lat, lon } = event.data;
    for (const wpt of hikingWaypoints) {
      if (wpt._alerted) continue;
      const dist = swDistM(lat, lon, wpt.lat, wpt.lon);
      if (dist > PROXIMITY_RADIUS_M) continue;

      wpt._alerted = true;

      // Notify all open clients (app in foreground)
      self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
        clients.forEach((c) =>
          c.postMessage({ type: "WAYPOINT_NEAR", waypoint: wpt }),
        );
      });

      // Push a notification for background / locked-screen scenarios
      // (requires Notification permission granted by the user)
      const isDanger = wpt.type === "danger";
      self.registration
        .showNotification(wpt.name?.en ?? "Waypoint ahead", {
          body: isDanger ? "⚠ Caution: difficult section ahead" : `Approaching ${wpt.name?.en ?? "waypoint"}`,
          tag: `wpt-${wpt.lat}-${wpt.lon}`,
          icon: "/icons/icon-192.png",
          silent: !isDanger,
        })
        .catch(() => {/* notification permission not granted — silently ignore */});
    }
    return;
  }
});

/** Remove oldest entries when cache exceeds maxEntries (approximate LRU). */
async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    // Cache API returns keys in insertion order → delete the oldest ones
    const overflow = keys.length - maxEntries;
    await Promise.all(keys.slice(0, overflow).map((k) => cache.delete(k)));
  }
}
