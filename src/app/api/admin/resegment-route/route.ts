import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildSegmentSlug } from "@/lib/slug";
import { haversineM, computeTrackStats, findNearestIndex, inferSegmentType, type TrackPoint3D } from "@/lib/geo";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type SegmentType = "APPROACH" | "ASCENT" | "DESCENT" | "RETURN";

type PreviewSeg = {
  segType:      string;
  startWpName:  string;
  startWpNameKo?: string;
  endWpName:    string;
  endWpNameKo?: string;
  gpsEndWpName: string;
  distanceM:    number;
  durationMin:  number;
  startWpIdx:   number;
  endWpIdx:     number;
};

/**
 * POST /api/admin/resegment-route
 *
 * Re-creates segments for an existing route WITHOUT touching:
 *   - route name / description / tags / highlights
 *   - waypoints
 *   - route_photos (photos + descriptions stay intact)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      routeId:               number;
      trackPoints:           TrackPoint3D[];
      waypointIds:           number[];
      segmentOverrides:      (number | null)[];
      segmentWpOverrides?:   ({ startWpIdx: number; endWpIdx: number } | null)[];
      segmentEndWpOverrides?: (number | null)[];
      segmentSpecs?: {
        segment_type?:          string;
        estimated_time_min?:    number;
        is_bus_combined?:       boolean;
        bus_duration_min?:      number;
        bus_color?:             string;
        bus_numbers?:           string;
        station_bus_stop_name?: string;
      }[];
      preview?: boolean;
    };

    const {
      routeId, trackPoints, waypointIds, segmentOverrides,
      segmentWpOverrides, segmentEndWpOverrides, segmentSpecs, preview,
    } = body;

    if (!routeId || !trackPoints?.length || !waypointIds?.length || !segmentOverrides?.length) {
      return NextResponse.json(
        { error: "routeId, trackPoints, waypointIds, segmentOverrides required" },
        { status: 400 },
      );
    }

    // Validate route exists
    const { data: route, error: routeErr } = await supabaseAdmin
      .from("routes").select("id, mountain_id, name").eq("id", routeId).single();
    if (routeErr || !route) {
      return NextResponse.json({ error: `Route ${routeId} not found` }, { status: 404 });
    }

    // Fetch mountain slug and waypoints in parallel
    const [{ data: mountain }, { data: waypoints, error: wpErr }] = await Promise.all([
      supabaseAdmin.from("mountains").select("slug").eq("id", route.mountain_id).single(),
      supabaseAdmin.from("waypoints").select("id, slug, type, lat, lon, name").in("id", waypointIds),
    ]);
    if (wpErr || !waypoints) {
      return NextResponse.json({ error: "Failed to fetch waypoints" }, { status: 500 });
    }
    const mountainSlug = mountain?.slug ?? String(route.mountain_id);

    // Re-order fetched waypoints to match waypointIds order
    const ordered = waypointIds.map((id) => {
      const wp = waypoints.find((w) => w.id === id);
      if (!wp) throw new Error(`Waypoint ${id} not found`);
      return wp;
    });

    // Pre-fetch all existing segments in one query (avoids N+1 in the loop)
    const existingIds = segmentOverrides.filter((id): id is number => id != null);
    const existingSegMap = new Map<number, { id: number; estimated_time_min: number; distance_m: number }>();
    if (existingIds.length > 0) {
      const { data: existingSegs } = await supabaseAdmin
        .from("segments").select("id, estimated_time_min, distance_m").in("id", existingIds);
      for (const s of existingSegs ?? []) existingSegMap.set(s.id, s);
    }

    // Find nearest track index for each waypoint, then trim to the relevant range
    const rawIndices = ordered.map((wp) => findNearestIndex(trackPoints, wp.lat, wp.lon));
    const minIdx = Math.min(...rawIndices);
    const maxIdx = Math.max(...rawIndices);
    const trimmed = trackPoints.slice(minIdx, maxIdx + 1);
    const indices = rawIndices.map((i) => i - minIdx);

    function sliceTrack(startWpIdx: number, endWpIdx: number): TrackPoint3D[] {
      const a = Math.min(indices[startWpIdx], indices[endWpIdx]);
      const b = Math.max(indices[startWpIdx], indices[endWpIdx]);
      return b > a ? trimmed.slice(a, b + 1) : [trimmed[a], trimmed[Math.min(a + 1, trimmed.length - 1)]];
    }

    const gpsEndId = (s: { isBusCombined?: boolean; midWpId?: number; endWpId?: number }) =>
      (s.isBusCombined && s.midWpId) ? s.midWpId : s.endWpId;

    // Process each slot
    const newSegmentIds: number[] = [];
    let totalDurationMin = 0;
    let totalDistanceM   = 0;
    const previewSegments: PreviewSeg[] = [];

    for (let idx = 0; idx < segmentOverrides.length; idx++) {
      const existingId = segmentOverrides[idx];
      const spec = segmentSpecs?.[idx];

      if (existingId != null) {
        const seg = existingSegMap.get(existingId);
        newSegmentIds.push(existingId);
        totalDurationMin += seg?.estimated_time_min ?? 0;
        totalDistanceM   += seg?.distance_m ?? 0;
        continue;
      }

      const ov = segmentWpOverrides?.[idx];
      if (!ov) continue;

      const { startWpIdx: ovStart, endWpIdx: ovEnd } = ov;
      if (ovStart < 0 || ovEnd >= ordered.length || ovStart >= ovEnd) continue;

      const startWp  = ordered[ovStart];
      const gpsEndWp = ordered[ovEnd];

      // For bus-combined: end_waypoint_id is the station, GPS ends at the bus stop
      const endWpIdOverride = segmentEndWpOverrides?.[idx];
      let endWp = gpsEndWp;
      if (endWpIdOverride) {
        const { data: overrideWp } = await supabaseAdmin
          .from("waypoints").select("id, slug, type, lat, lon, name").eq("id", endWpIdOverride).single();
        if (overrideWp) endWp = overrideWp;
      }

      const track = sliceTrack(ovStart, ovEnd);
      const stats = computeTrackStats(track);

      let estTime = Math.max(1, Math.round(stats.distance_m / 1000 / 2.0 * 60 + stats.total_ascent_m / 10));
      if (spec?.estimated_time_min != null) estTime = spec.estimated_time_min;

      const segType = (spec?.segment_type as SegmentType | undefined)
        ?? inferSegmentType(startWp.type as Parameters<typeof inferSegmentType>[0], endWp.type as Parameters<typeof inferSegmentType>[1]);

      if (preview) {
        previewSegments.push({
          segType,
          startWpName:   (startWp.name as any)?.en || startWp.slug,
          startWpNameKo: (startWp.name as any)?.ko,
          endWpName:     (endWp.name as any)?.en || endWp.slug,
          endWpNameKo:   (endWp.name as any)?.ko,
          gpsEndWpName:  (gpsEndWp.name as any)?.en || gpsEndWp.slug,
          distanceM:     stats.distance_m,
          durationMin:   estTime,
          startWpIdx:    ovStart,
          endWpIdx:      ovEnd,
        });
        totalDurationMin += estTime;
        totalDistanceM   += stats.distance_m;
        continue;
      }

      const isBusCombined = spec?.is_bus_combined ?? false;
      const busDetails = isBusCombined && spec ? {
        bus_numbers:      spec.bus_numbers ? spec.bus_numbers.split(",").map((s) => s.trim()).filter(Boolean) : [],
        route_color:      spec.bus_color ?? null,
        bus_duration_min: spec.bus_duration_min ?? null,
        ...(spec.station_bus_stop_name ? { station_bus_stop_name: spec.station_bus_stop_name } : {}),
      } : null;
      const subSegments = isBusCombined
        ? (segType === "APPROACH" ? [{ mode: "bus" }, { mode: "walk" }] : [{ mode: "walk" }, { mode: "bus" }])
        : null;

      const segSlug   = buildSegmentSlug(mountainSlug, segType, startWp.slug, endWp.slug);
      const segPayload = {
        mountain_id:        route.mountain_id,
        segment_type:       segType,
        start_waypoint_id:  startWp.id,
        end_waypoint_id:    endWp.id,
        track_data:         { type: "LineString", coordinates: track },
        is_bus_combined:    isBusCombined,
        bus_details:        busDetails,
        sub_segments:       subSegments,
        slug:               segSlug,
        estimated_time_min: estTime,
        ...stats,
      };

      // Try insert; on slug conflict update the existing row
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("segments").insert(segPayload).select("id").single();

      let segId: number;
      if (insertErr) {
        if (insertErr.code !== "23505") {
          return NextResponse.json({ error: `Segment insert failed: ${insertErr.message}` }, { status: 500 });
        }
        const { data: existing } = await supabaseAdmin
          .from("segments").select("id").eq("slug", segSlug).single();
        if (!existing) {
          return NextResponse.json({ error: `Segment conflict but not found: ${segSlug}` }, { status: 500 });
        }
        const { error: updateErr } = await supabaseAdmin
          .from("segments").update(segPayload).eq("id", existing.id);
        if (updateErr) {
          return NextResponse.json({ error: `Segment update failed: ${updateErr.message}` }, { status: 500 });
        }
        segId = existing.id;
      } else {
        segId = inserted.id;
      }

      newSegmentIds.push(segId);
      totalDurationMin += estTime;
      totalDistanceM   += stats.distance_m;
    }

    if (preview) {
      return NextResponse.json({ segments: previewSegments, totalDurationMin, totalDistanceM });
    }

    const { error: routeUpdateErr } = await supabaseAdmin
      .from("routes")
      .update({ segment_ids: newSegmentIds, total_duration_min: totalDurationMin, total_distance_m: totalDistanceM })
      .eq("id", routeId);
    if (routeUpdateErr) {
      return NextResponse.json({ error: `Route update failed: ${routeUpdateErr.message}` }, { status: 500 });
    }

    try {
      const { revalidatePath, revalidateTag } = await import("next/cache");
      revalidateTag("route-list", {});
      revalidateTag("route-detail", {});
      revalidatePath("/route");
    } catch { /* non-fatal */ }

    return NextResponse.json({ routeId, segmentIds: newSegmentIds, totalDurationMin, totalDistanceM });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
