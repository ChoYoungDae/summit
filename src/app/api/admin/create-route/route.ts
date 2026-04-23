import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { toSlug, buildSegmentSlug } from "@/lib/slug";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type TrackPoint = [number, number, number]; // [lon, lat, ele]
type WaypointType = "STATION" | "TRAILHEAD" | "SUMMIT" | "JUNCTION" | "SHELTER" | "BUS_STOP";
type SegmentType  = "APPROACH" | "ASCENT" | "DESCENT" | "RETURN";

// ── Waypoint spec from client ─────────────────────────────────────────────────

type ExistingWaypointSpec = { existingId: number };

type NewWaypointSpec = {
  nameEn: string;
  nameKo?: string;
  type: WaypointType;
  lat: number;
  lon: number;
  elevationM?: number;
  // STATION fields
  exitNumber?: string;
  subwayLine?: string;
  subwayStation?: string;
  // BUS_STOP fields
  arsId?: string;
  busNumbers?: string;
  busColor?: string;
  busDurationMin?: number;
};

type WaypointSpec = ExistingWaypointSpec | NewWaypointSpec;

type ResolvedWaypoint = {
  id: number;
  slug: string;
  type: WaypointType;
  lat: number;
  lon: number;
  busColor?: string;
  busDurationMin?: number;
  busNumbers?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function haversineM(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R  = 6_371_000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function computeStats(points: TrackPoint[]) {
  let distM = 0, ascM = 0, descM = 0;
  for (let i = 1; i < points.length; i++) {
    distM += haversineM(points[i-1][0], points[i-1][1], points[i][0], points[i][1]);
    const dEle = points[i][2] - points[i-1][2];
    if (dEle > 0) ascM  += dEle;
    else          descM -= dEle;
  }
  return {
    distance_m:      Math.round(distM),
    total_ascent_m:  Math.round(ascM),
    total_descent_m: Math.round(descM),
  };
}

function findNearestIndex(track: TrackPoint[], lat: number, lon: number): number {
  let bestIdx  = 0;
  let bestDist = Infinity;
  for (let i = 0; i < track.length; i++) {
    const d = haversineM(track[i][0], track[i][1], lon, lat);
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }
  return bestIdx;
}

function inferSegmentType(startType: WaypointType, endType: WaypointType): SegmentType {
  const isStart = (t: WaypointType) => t === "STATION" || t === "BUS_STOP";
  const isEnd   = (t: WaypointType) => t === "STATION" || t === "BUS_STOP";
  const isMid   = (t: WaypointType) => t === "TRAILHEAD" || t === "JUNCTION" || t === "SHELTER";

  if (isStart(startType) && isMid(endType))   return "APPROACH";
  if (isMid(startType)   && endType === "SUMMIT") return "ASCENT";
  if (startType === "SUMMIT" && isMid(endType))   return "DESCENT";
  if (isMid(startType)   && isEnd(endType))   return "RETURN";
  // same-side fallback
  if (isStart(startType) && isEnd(endType))   return "APPROACH";
  if (isMid(startType)   && isMid(endType))   return "ASCENT";
  return "APPROACH";
}

// ── POST /api/admin/create-route ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      mountainId:      number;
      routeNameEn:     string;
      routeNameKo?:    string;
      routeDifficulty?: number;
      trackPoints:     TrackPoint[];
      waypointSpecs:   WaypointSpec[];
    };

    const { mountainId, routeNameEn, routeNameKo, routeDifficulty, trackPoints, waypointSpecs } = body;

    if (!mountainId || !routeNameEn || !trackPoints?.length || !waypointSpecs?.length) {
      return NextResponse.json(
        { error: "mountainId, routeNameEn, trackPoints, waypointSpecs required" },
        { status: 400 },
      );
    }
    if (waypointSpecs.length < 2) {
      return NextResponse.json({ error: "At least 2 waypoints required" }, { status: 400 });
    }

    // Fetch mountain slug for segment slug generation
    const { data: mountain } = await supabaseAdmin
      .from("mountains").select("slug").eq("id", mountainId).single();
    const mountainSlug = mountain?.slug ?? String(mountainId);

    // ── Step 1: Resolve waypoints ─────────────────────────────────────────────

    const resolved: ResolvedWaypoint[] = [];

    for (const spec of waypointSpecs) {
      if ("existingId" in spec) {
        const { data: wp, error } = await supabaseAdmin
          .from("waypoints")
          .select("id, slug, type, lat, lon, bus_numbers")
          .eq("id", spec.existingId)
          .single();
        if (error || !wp) {
          return NextResponse.json({ error: `Waypoint ${spec.existingId} not found` }, { status: 400 });
        }
        resolved.push({
          id:   wp.id,
          slug: wp.slug ?? toSlug(String(wp.id)),
          type: wp.type as WaypointType,
          lat:  wp.lat,
          lon:  wp.lon,
          busNumbers: wp.bus_numbers ?? undefined,
        });
      } else {
        const slug = toSlug(spec.nameEn);
        const { data: wp, error: wpErr } = await supabaseAdmin
          .from("waypoints")
          .insert({
            mountain_id:    mountainId,
            name:           { en: spec.nameEn, ...(spec.nameKo ? { ko: spec.nameKo } : {}) },
            type:           spec.type,
            lat:            spec.lat,
            lon:            spec.lon,
            slug,
            ...(spec.elevationM != null && Number.isFinite(spec.elevationM) ? { elevation_m: Math.round(spec.elevationM) } : {}),
            ...(spec.exitNumber   ? { exit_number:    spec.exitNumber }   : {}),
            ...(spec.subwayLine   ? { subway_line:    spec.subwayLine }   : {}),
            ...(spec.subwayStation ? { subway_station: spec.subwayStation } : {}),
            ...(spec.arsId        ? { ars_id:         spec.arsId }        : {}),
            ...(spec.busNumbers   ? { bus_numbers:    spec.busNumbers }   : {}),
          })
          .select("id")
          .single();
        if (wpErr) {
          return NextResponse.json({ error: `Create waypoint failed: ${wpErr.message}` }, { status: 500 });
        }
        resolved.push({
          id:            wp.id,
          slug,
          type:          spec.type,
          lat:           spec.lat,
          lon:           spec.lon,
          busColor:      spec.busColor,
          busDurationMin: spec.busDurationMin,
          busNumbers:    spec.busNumbers,
        });
      }
    }

    // ── Step 2: Find nearest track index for each waypoint ────────────────────

    const rawIndices = resolved.map(wp => findNearestIndex(trackPoints, wp.lat, wp.lon));

    // Trim full track to [first waypoint … last waypoint] and re-index
    const minIdx = Math.min(...rawIndices);
    const maxIdx = Math.max(...rawIndices);
    const trimmed   = trackPoints.slice(minIdx, maxIdx + 1);
    const indices   = rawIndices.map(i => i - minIdx);

    // ── Step 3: Build raw segments between consecutive waypoints ──────────────

    type RawSeg = { startWpIdx: number; endWpIdx: number; track: TrackPoint[] };

    const rawSegs: RawSeg[] = [];
    for (let i = 0; i < resolved.length - 1; i++) {
      const a = Math.min(indices[i], indices[i + 1]);
      const b = Math.max(indices[i], indices[i + 1]);
      rawSegs.push({
        startWpIdx: i,
        endWpIdx:   i + 1,
        // Ensure minimum 2-point track even if waypoints land on same index
        track: b > a ? trimmed.slice(a, b + 1) : [trimmed[a], trimmed[Math.min(a + 1, trimmed.length - 1)]],
      });
    }

    // ── Step 4: Merge BUS_STOP pairs into combined APPROACH / RETURN ──────────

    type FinalSeg = {
      segType:          SegmentType;
      startWaypointId:  number;
      startWpSlug:      string;
      endWaypointId:    number;
      endWpSlug:        string;
      track:            TrackPoint[]; // walk track
      isBusCombined:    boolean;
      busTrack?:        TrackPoint[];
      busStopWaypoint?: ResolvedWaypoint;
    };

    const finalSegs: FinalSeg[] = [];
    let i = 0;
    while (i < rawSegs.length) {
      const seg    = rawSegs[i];
      const startWp = resolved[seg.startWpIdx];
      const endWp   = resolved[seg.endWpIdx];

      // STATION → BUS_STOP → TRAILHEAD/JUNCTION  →  one APPROACH (bus combined)
      if (
        startWp.type === "STATION" &&
        endWp.type   === "BUS_STOP" &&
        i + 1 < rawSegs.length
      ) {
        const nextSeg   = rawSegs[i + 1];
        const nextEndWp = resolved[nextSeg.endWpIdx];
        if (nextEndWp.type === "TRAILHEAD" || nextEndWp.type === "JUNCTION" || nextEndWp.type === "SHELTER") {
          finalSegs.push({
            segType:          "APPROACH",
            startWaypointId:  startWp.id,
            startWpSlug:      startWp.slug,
            endWaypointId:    nextEndWp.id,
            endWpSlug:        nextEndWp.slug,
            track:            nextSeg.track,  // walk: bus stop → trailhead
            isBusCombined:    true,
            busTrack:         seg.track,      // bus: station → bus stop
            busStopWaypoint:  endWp,
          });
          i += 2;
          continue;
        }
      }

      // TRAILHEAD/JUNCTION → BUS_STOP → STATION  →  one RETURN (bus combined)
      if (
        (startWp.type === "TRAILHEAD" || startWp.type === "JUNCTION" || startWp.type === "SHELTER") &&
        endWp.type   === "BUS_STOP" &&
        i + 1 < rawSegs.length
      ) {
        const nextSeg   = rawSegs[i + 1];
        const nextEndWp = resolved[nextSeg.endWpIdx];
        if (nextEndWp.type === "STATION") {
          finalSegs.push({
            segType:          "RETURN",
            startWaypointId:  startWp.id,
            startWpSlug:      startWp.slug,
            endWaypointId:    nextEndWp.id,
            endWpSlug:        nextEndWp.slug,
            track:            seg.track,       // walk: trailhead → bus stop
            isBusCombined:    true,
            busTrack:         nextSeg.track,   // bus: bus stop → station
            busStopWaypoint:  endWp,
          });
          i += 2;
          continue;
        }
      }

      // Normal segment
      finalSegs.push({
        segType:         inferSegmentType(startWp.type, endWp.type),
        startWaypointId: startWp.id,
        startWpSlug:     startWp.slug,
        endWaypointId:   endWp.id,
        endWpSlug:       endWp.slug,
        track:           seg.track,
        isBusCombined:   false,
      });
      i++;
    }

    // ── Step 5: Insert segments ───────────────────────────────────────────────

    const segmentIds: number[] = [];
    let totalDurationMin = 0;
    let totalDistanceM   = 0;

    for (const seg of finalSegs) {
      const stats   = computeStats(seg.track);
      // Naismith variant: ~2 km/h ascent pace + 10 m elevation per minute
      const estTime = Math.max(
        1,
        Math.round(stats.distance_m / 1000 / 2.0 * 60 + stats.total_ascent_m / 10),
      );

      const segSlug = buildSegmentSlug(mountainSlug, seg.segType, seg.startWpSlug, seg.endWpSlug);

      let busDetails  = null;
      let subSegments = null;

      if (seg.isBusCombined && seg.busTrack && seg.busStopWaypoint) {
        const bsWp = seg.busStopWaypoint;
        busDetails = {
          bus_stop_id_key:  String(bsWp.id),
          bus_numbers:      bsWp.busNumbers
            ? bsWp.busNumbers.split(",").map((s) => s.trim()).filter(Boolean)
            : [],
          route_color:      bsWp.busColor ?? null,
          bus_track_data:   { type: "LineString", coordinates: seg.busTrack },
          ...(bsWp.busDurationMin != null ? { bus_duration_min: bsWp.busDurationMin } : {}),
        };
        subSegments = seg.segType === "APPROACH"
          ? [{ mode: "bus" }, { mode: "walk" }]
          : [{ mode: "walk" }, { mode: "bus" }];
      }

      const { data: inserted, error: segErr } = await supabaseAdmin
        .from("segments")
        .insert({
          mountain_id:       mountainId,
          segment_type:      seg.segType,
          start_waypoint_id: seg.startWaypointId,
          end_waypoint_id:   seg.endWaypointId,
          track_data:        { type: "LineString", coordinates: seg.track },
          is_bus_combined:   seg.isBusCombined,
          bus_details:       busDetails,
          sub_segments:      subSegments,
          slug:              segSlug,
          estimated_time_min: estTime,
          ...stats,
          ...(routeDifficulty ? { difficulty: routeDifficulty } : {}),
        })
        .select("id")
        .single();

      if (segErr) {
        return NextResponse.json({ error: `Segment insert failed: ${segErr.message}` }, { status: 500 });
      }

      segmentIds.push(inserted.id);
      totalDurationMin += estTime;
      totalDistanceM   += stats.distance_m;
    }

    // ── Step 6: Insert route ──────────────────────────────────────────────────

    const { data: route, error: routeErr } = await supabaseAdmin
      .from("routes")
      .insert({
        mountain_id:        mountainId,
        name:               { en: routeNameEn, ...(routeNameKo ? { ko: routeNameKo } : {}) },
        segment_ids:        segmentIds,
        total_duration_min: totalDurationMin,
        total_distance_m:   totalDistanceM,
        ...(routeDifficulty ? { total_difficulty: routeDifficulty } : {}),
      })
      .select("id")
      .single();

    if (routeErr) {
      return NextResponse.json({ error: `Route insert failed: ${routeErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ routeId: route.id, segmentIds });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
