import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildSegmentSlug } from "@/lib/slug";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type TrackPoint = [number, number, number];

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { routeId: number; trackPoints: TrackPoint[] };
    const { routeId, trackPoints } = body;

    if (!routeId || !trackPoints?.length) {
      return NextResponse.json({ error: "routeId and trackPoints are required" }, { status: 400 });
    }

    // 1. Fetch route to get segment_ids
    const { data: route, error: routeErr } = await supabaseAdmin
      .from("routes")
      .select("*")
      .eq("id", routeId)
      .single();

    if (routeErr || !route) {
      return NextResponse.json({ error: routeErr ? routeErr.message : "Route not found" }, { status: 404 });
    }

    if (!route.segment_ids || route.segment_ids.length === 0) {
      return NextResponse.json({ error: "No segments found for this route" }, { status: 400 });
    }

    // 2. Fetch the actual segments and their waypoints
    const { data: segmentsData, error: segErr } = await supabaseAdmin
      .from("segments")
      .select("*, start_waypoint:waypoints!start_waypoint_id(*), end_waypoint:waypoints!end_waypoint_id(*)")
      .in("id", route.segment_ids);

    if (segErr || !segmentsData) {
      return NextResponse.json({ error: segErr ? segErr.message : "Failed to fetch segments" }, { status: 500 });
    }

    // 3. Order segments and identify waypoints
    const segmentsInOrder = route.segment_ids.map((id: number) => 
      segmentsData.find(s => s.id === id)
    ).filter(Boolean);

    if (segmentsInOrder.length === 0) {
      return NextResponse.json({ error: "Segments could not be matched" }, { status: 400 });
    }

    const waypoints: { id: number; lat: number; lon: number; slug: string; type: string }[] = [];
    waypoints.push({
      id:   segmentsInOrder[0].start_waypoint.id,
      lat:  segmentsInOrder[0].start_waypoint.lat,
      lon:  segmentsInOrder[0].start_waypoint.lon,
      slug: segmentsInOrder[0].start_waypoint.slug,
      type: segmentsInOrder[0].start_waypoint.type,
    });
    for (const seg of segmentsInOrder) {
      waypoints.push({
        id:   seg.end_waypoint.id,
        lat:  seg.end_waypoint.lat,
        lon:  seg.end_waypoint.lon,
        slug: seg.end_waypoint.slug,
        type: seg.end_waypoint.type,
      });
    }

    // 3. Find indices in the track with forward-only search to handle loops/complex paths
    let indices: number[] = [];
    
    function getIndices(pts: TrackPoint[]) {
      const idxs: number[] = [];
      let currentStart = 0;
      for (const wp of waypoints) {
        let bestIdx = currentStart;
        let bestDist = Infinity;
        // Search from currentStart to avoid snapping to a point before the previous waypoint
        for (let i = currentStart; i < pts.length; i++) {
          const d = haversineM(pts[i][0], pts[i][1], wp.lon, wp.lat);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
        idxs.push(bestIdx);
        currentStart = bestIdx;
      }
      return idxs;
    }

    indices = getIndices(trackPoints);

    // Auto-reverse if the track seems to be in the wrong overall direction
    // (e.g., if even with forward search, we had to snap everything to the end or beginning)
    if (indices.length > 1 && indices[0] > indices[indices.length - 1]) {
      trackPoints.reverse();
      indices = getIndices(trackPoints);
    }

    // 4. Re-slice and update each segment
    let totalDurationMin = 0;
    let totalDistanceM   = 0;

    for (let i = 0; i < segmentsInOrder.length; i++) {
      const seg = segmentsInOrder[i];
      const a = indices[i];
      const b = indices[i + 1];
      
      let fullSegmentTrack = b > a 
        ? trackPoints.slice(a, b + 1) 
        : [trackPoints[a], trackPoints[Math.min(a + 1, trackPoints.length - 1)]];

      let walkTrack = fullSegmentTrack;
      let busTrack: TrackPoint[] | null = null;

      // Handle bus-combined segments (splitting at bus stop)
      if (seg.is_bus_combined && seg.bus_details?.bus_stop_id_key) {
        // Fetch bus stop waypoint
        const { data: busStopWp } = await supabaseAdmin
          .from("waypoints")
          .select("lat, lon")
          .eq("id", parseInt(seg.bus_details.bus_stop_id_key))
          .single();

        if (busStopWp) {
          const midIdx = findNearestIndex(fullSegmentTrack, busStopWp.lat, busStopWp.lon);
          
          if (seg.segment_type === "APPROACH") {
            // Bus: Station -> Bus Stop (0 to mid)
            // Walk: Bus Stop -> Trailhead (mid to end)
            busTrack  = fullSegmentTrack.slice(0, midIdx + 1);
            walkTrack = fullSegmentTrack.slice(midIdx);
          } else if (seg.segment_type === "RETURN") {
            // Walk: Trailhead -> Bus Stop (0 to mid)
            // Bus: Bus Stop -> Station (mid to end)
            walkTrack = fullSegmentTrack.slice(0, midIdx + 1);
            busTrack  = fullSegmentTrack.slice(midIdx);
          }
        }
      }

      const walkStats = computeStats(walkTrack);
      
      // Update segment in DB - ONLY update track and distance/elevation stats.
      // Use walkTrack and walkStats for the main segment data.
      const updates: any = {
        track_data: { type: "LineString", coordinates: walkTrack },
        ...walkStats,
      };

      // If it was a bus segment, update the bus_track_data inside bus_details
      if (seg.is_bus_combined && busTrack) {
        updates.bus_details = {
          ...seg.bus_details,
          bus_track_data: { type: "LineString", coordinates: busTrack },
        };
      }

      const { error: segUpdErr } = await supabaseAdmin
        .from("segments")
        .update(updates)
        .eq("id", seg.id);

      if (segUpdErr) throw segUpdErr;

      // For the route total, use the EXISTING estimated_time_min from the segment (which should be walk time)
      // and EXCLUDE bus duration as per user request ("Exclude both time and distance for bus").
      totalDurationMin += (seg.estimated_time_min || 0);
      totalDistanceM   += walkStats.distance_m;
    }

    // 5. Update route totals (Hiking Only)
    const { error: routeUpdErr } = await supabaseAdmin
      .from("routes")
      .update({
        total_duration_min: totalDurationMin,
        total_distance_m:   totalDistanceM,
      })
      .eq("id", routeId);

    if (routeUpdErr) throw routeUpdErr;

    // 6. Force Cache Revalidation
    try {
      const { revalidatePath, revalidateTag } = await import("next/cache");
      // @ts-ignore
      revalidateTag("route-list");
      // @ts-ignore
      revalidateTag(`route-detail-${routeId}`);
      revalidatePath(`/route/${routeId}`);
      revalidatePath(`/admin`); // Ensure admin view is also fresh
    } catch (e) {
      console.error("Revalidation error:", e);
    }

    return NextResponse.json({ 
      ok: true, 
      totalDistanceM, 
      totalDurationMin,
      pointCount: trackPoints.length,
      message: "Hiking stats updated successfully (Bus excluded). Please refresh."
    });

  } catch (err) {
    console.error("Update Track Error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed" }, { status: 500 });
  }
}
