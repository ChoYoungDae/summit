/**
 * Recalculate order_index for all route_photos.
 *
 * Photos with GPS → cumulative metres from route start (haversine walk).
 * Photos without GPS → 999999 (sorted to end).
 *
 * Usage: node scripts/recalculate-photo-order.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE);

// ── Haversine distance in metres ──────────────────────────────────────────────
function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6_371_000;
  const toR = d => (d * Math.PI) / 180;
  const dLat = toR(lat2 - lat1);
  const dLon = toR(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Cumulative distance from route start to nearest point ─────────────────────
function calcOrderIndex(segmentIds, segMap, lat, lon) {
  let cumDist = 0;
  let bestDist = Infinity;
  let bestCumDist = 999_999;
  let prev = null; // [lon, lat]

  for (const sid of segmentIds) {
    const seg = segMap.get(sid);
    if (!seg?.track_data?.coordinates) continue;

    for (const [sLon, sLat] of seg.track_data.coordinates) {
      if (prev) {
        cumDist += haversineM(prev[1], prev[0], sLat, sLon);
      }
      const d = haversineM(lat, lon, sLat, sLon);
      if (d < bestDist) {
        bestDist    = d;
        bestCumDist = Math.round(cumDist);
      }
      prev = [sLon, sLat];
    }
  }

  return bestCumDist;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Fetch all photos
  const { data: photos, error: pErr } = await db
    .from("route_photos")
    .select("id, route_id, lat, lon");
  if (pErr) throw pErr;
  console.log(`Loaded ${photos.length} photos`);

  // 2. Fetch all routes that appear in photos
  const routeIds = [...new Set(photos.map(p => p.route_id))];
  const { data: routes, error: rErr } = await db
    .from("routes")
    .select("id, segment_ids")
    .in("id", routeIds);
  if (rErr) throw rErr;

  // 3. Fetch all segments that appear in those routes
  const allSegIds = [...new Set(routes.flatMap(r => r.segment_ids ?? []))];
  const { data: segments, error: sErr } = await db
    .from("segments")
    .select("id, track_data")
    .in("id", allSegIds);
  if (sErr) throw sErr;

  const segMap    = new Map(segments.map(s => [s.id, s]));
  const routeMap  = new Map(routes.map(r => [r.id, r]));

  // 4. Calculate + batch-update
  let updated = 0;
  for (const photo of photos) {
    const route = routeMap.get(photo.route_id);
    const segIds = route?.segment_ids ?? [];

    const orderIndex =
      photo.lat != null && photo.lon != null && segIds.length
        ? calcOrderIndex(segIds, segMap, photo.lat, photo.lon)
        : 999_999;

    const { error: uErr } = await db
      .from("route_photos")
      .update({ order_index: orderIndex })
      .eq("id", photo.id);

    if (uErr) {
      console.error(`  ✗ photo ${photo.id}:`, uErr.message);
    } else {
      console.log(`  ✓ photo ${photo.id} → order_index ${orderIndex}`);
      updated++;
    }
  }

  console.log(`\nDone: ${updated}/${photos.length} photos updated`);
}

main().catch(err => { console.error(err); process.exit(1); });
