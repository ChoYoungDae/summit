"use client";

import { useMemo, useCallback, useRef, useEffect } from "react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { Bus, Footprints, Flag } from "lucide-react";
import type { SegmentType, RoutePhoto } from "@/types/trail";
import { Icon } from "@iconify/react";

// ── Color palette ─────────────────────────────────────────────────────────────
const COLOR_ASCENT   = "#10B981"; // Emerald green — climbing
const COLOR_DESCENT  = "#8B5CF6"; // Purple — descending
const COLOR_BUS       = "#FF7A00"; // Bright Orange
const COLOR_WALK     = "#94A3B8"; // Slate gray — non-bus approach/return
const COLOR_ACTIVE   = "#C8362A"; // Dancheong Red — hover / GPS cursor

// ── Public types ──────────────────────────────────────────────────────────────

export interface SegmentElevationInfo {
  type: SegmentType;
  isBus: boolean;
  busColor?: string;
  /** [lon, lat, ele] — elevation may be 0 if not captured (e.g. bus GPS) */
  points: [number, number, number][];
}

// ── Internal data model ───────────────────────────────────────────────────────

interface ElevationPoint {
  dist: number;
  ele: number;
  eleApproach?: number;
  eleAscent?: number;
  eleDescent?: number;
  eleReturn?: number;
  origPt: [number, number, number];
}

interface BoundaryInfo {
  dist: number;
  segType: SegmentType;
  isBus: boolean;
  busColor?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Multi-segment data builder ────────────────────────────────────────────────

function buildData(segments: SegmentElevationInfo[]): {
  data: ElevationPoint[];
  trackIndexMap: Map<number, number>; // ASCENT+DESCENT track index → global index
  boundaries: BoundaryInfo[];
} {
  let cumDist = 0;
  let trackIdx = 0;
  const data: ElevationPoint[] = [];
  const trackIndexMap = new Map<number, number>();
  const boundaries: BoundaryInfo[] = [];
  let prevPt: [number, number, number] | null = null;

  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si];
    const isHiking = seg.type === "ASCENT" || seg.type === "DESCENT";

    if (si > 0) {
      // Record boundary node at the junction (current cumDist = end of previous seg)
      boundaries.push({
        dist: cumDist,
        segType: seg.type,
        isBus: seg.isBus,
        busColor: seg.busColor,
      });

      // Seamless join: patch last point of previous segment to also carry
      // this segment's elevation key — lines meet without a gap.
      const junction = data[data.length - 1];
      if (junction) {
        switch (seg.type) {
          case "APPROACH": junction.eleApproach = junction.ele; break;
          case "ASCENT":   junction.eleAscent   = junction.ele; break;
          case "DESCENT":  junction.eleDescent  = junction.ele; break;
          case "RETURN":   junction.eleReturn   = junction.ele; break;
        }
      }
    }

    for (let i = 0; i < seg.points.length; i++) {
      const pt = seg.points[i];
      if (prevPt !== null) {
        const d = haversineKm(prevPt[1], prevPt[0], pt[1], pt[0]);
        if (!isNaN(d)) cumDist += d;
      }
      prevPt = pt;

      const globalIndex = data.length;
      if (isHiking) trackIndexMap.set(trackIdx++, globalIndex);

      // Bus segments are rendered "Flat" — using the elevation of the first point in the segment
      const ele = seg.isBus ? (seg.points[0][2] ?? 0) : (pt[2] ?? 0);
      data.push({
        dist: parseFloat(cumDist.toFixed(3)),
        ele,
        origPt: pt,
        eleApproach: seg.type === "APPROACH" ? ele : undefined,
        eleAscent:   seg.type === "ASCENT"   ? ele : undefined,
        eleDescent:  seg.type === "DESCENT"  ? ele : undefined,
        eleReturn:   seg.type === "RETURN"   ? ele : undefined,
      });
    }
  }

  return { data, trackIndexMap, boundaries };
}

// ── Node icon label (rendered inside Recharts SVG via ReferenceLine label) ────

function NodeIconLabel({
  viewBox,
  segType,
  isBus,
  busColor,
}: {
  viewBox?: { x: number; y: number; width: number; height: number };
  segType: SegmentType;
  isBus: boolean;
  busColor?: string;
}) {
  if (!viewBox) return null;
  const { x } = viewBox;

  let color: string;
  let IconComp: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

  if (segType === "DESCENT") {
    // Transition to descent = summit reached → Flag
    color = COLOR_DESCENT;
    IconComp = Flag;
  } else if (isBus) {
    color = COLOR_BUS;
    IconComp = Bus;
  } else if (segType === "ASCENT") {
    color = COLOR_ASCENT;
    IconComp = Footprints;
  } else {
    // RETURN walk
    color = COLOR_DESCENT; // Return walk matches descent color theme but dashed in legend
    IconComp = Footprints;
  }

  return (
    <g>
      {/* White halo for map-background legibility */}
      <circle cx={x} cy={11} r={10} fill="white" opacity={0.9} />
      <circle cx={x} cy={11} r={9} fill="white" stroke={color} strokeWidth={1.5} />
      <foreignObject x={x - 6} y={5} width={12} height={12}>
        {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
        {/* @ts-ignore — xmlns attribute required for foreignObject HTML context */}
        <div
          style={{
            width: 12,
            height: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconComp size={9} color={color} strokeWidth={2.5} />
        </div>
      </foreignObject>
    </g>
  );
}

// ── Photo camera label (rendered inside Recharts SVG via ReferenceLine label) ─

function PhotoIconLabel({
  viewBox,
  onClick,
}: {
  viewBox?: { x: number; y: number; width: number; height: number };
  onClick?: () => void;
}) {
  if (!viewBox) return null;
  const { x } = viewBox;
  return (
    <g style={{ cursor: "pointer" }} onClick={onClick}>
      <circle cx={x} cy={11} r={10} fill="white" opacity={0.9} />
      <circle cx={x} cy={11} r={9} fill="#F59E0B" />
      <foreignObject x={x - 6} y={5} width={12} height={12}>
        {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
        {/* @ts-ignore — xmlns attribute required for foreignObject HTML context */}
        <div
          style={{
            width: 12,
            height: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon icon="ph:camera" width={9} height={9} color="#fff" />
        </div>
      </foreignObject>
    </g>
  );
}

// ── Find dist value for a lat/lon in the elevation data ───────────────────────
function findDistForCoord(
  data: { dist: number; origPt: [number, number, number] }[],
  lat: number,
  lon: number,
): number | null {
  if (data.length === 0) return null;
  let minDist = Infinity;
  let best = data[0].dist;
  for (const pt of data) {
    const [pLon, pLat] = pt.origPt;
    const d = (pLat - lat) ** 2 + (pLon - lon) ** 2;
    if (d < minDist) { minDist = d; best = pt.dist; }
  }
  return best;
}

// ── Legend row ────────────────────────────────────────────────────────────────

function LegendDash({
  color,
  dashed,
  label,
}: {
  color: string;
  dashed?: boolean;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1">
      <svg width={18} height={8}>
        <line
          x1={0} y1={4} x2={18} y2={4}
          stroke={color}
          strokeWidth={dashed ? 2 : 2.5}
          strokeDasharray={dashed ? "5 3" : undefined}
          strokeLinecap="round"
        />
      </svg>
      <span style={{ fontSize: 10, color: "var(--color-text-muted)", fontFamily: "var(--font-en)" }}>
        {label}
      </span>
    </span>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  segments: SegmentElevationInfo[];
  onHover: (point: [number, number, number] | null) => void;
  /**
   * Index into the concatenated ASCENT+DESCENT track array.
   * Built by gps.nearestTrackIndex or chart click.
   */
  highlightTrackIndex?: number | null;
  /** Route photos to show as camera markers along the elevation profile. */
  photos?: RoutePhoto[];
  /** Called when a photo marker is clicked. */
  onPhotoClick?: (photo: RoutePhoto) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ElevationChart({ segments, onHover, highlightTrackIndex, photos = [], onPhotoClick }: Props) {
  const { data, trackIndexMap, boundaries } = useMemo(
    () => buildData(segments),
    [segments]
  );
  const rafRef = useRef<number | null>(null);

  const approachSeg = segments.find((s) => s.type === "APPROACH");
  const returnSeg   = segments.find((s) => s.type === "RETURN");

  const approachColor = approachSeg?.isBus ? COLOR_BUS : COLOR_ASCENT;
  const returnColor   = returnSeg?.isBus   ? COLOR_BUS : COLOR_DESCENT;

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePointSelect = useCallback((nextState: any) => {
    const dataIndex: unknown = nextState?.activeTooltipIndex;
    if (typeof dataIndex !== "number") return;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const pt = data[dataIndex];
      if (pt) onHover(pt.origPt);
    });
  }, [data, onHover]);

  const handleLeave = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    onHover(null);
  }, [onHover]);

  // Map GPS track index (ASCENT+DESCENT only) to global chart index
  const highlightGlobalIndex =
    highlightTrackIndex != null
      ? (trackIndexMap.get(highlightTrackIndex) ?? null)
      : null;

  const highlightPt = highlightGlobalIndex != null ? data[highlightGlobalIndex] : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderDot = useCallback((props: any) => {
    if (props.index !== highlightGlobalIndex) return <g key={props.index} />;
    const { cx, cy, value } = props;
    if (value === undefined || value === null || !isFinite(cy)) return <g key={props.index} />;
    return (
      <circle
        key={`dot-${props.index}`}
        cx={cx}
        cy={cy}
        r={7}
        fill={COLOR_ACTIVE}
        stroke="#fff"
        strokeWidth={2}
      />
    );
  }, [highlightGlobalIndex]);

  // Build legend entries only for segments that actually have points
  const hasApproach = !!approachSeg && approachSeg.points.length > 0;
  const hasReturn   = !!returnSeg   && returnSeg.points.length > 0;
  const hasAscent   = segments.some((s) => s.type === "ASCENT" && s.points.length > 0);
  const hasDescent  = segments.some((s) => s.type === "DESCENT" && s.points.length > 0);

  return (
    <div
      className="px-2 pt-3 pb-1 rounded-xl"
      style={{ minHeight: "140px", background: "#F2F2F5" }}
      onTouchEnd={handleLeave}
    >
      {/* Header row */}
      <div className="flex items-center justify-between px-2 mb-1">
        <p
          className="text-[0.7rem] leading-none"
          style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-en)" }}
        >
          Elevation Profile
        </p>
        {/* Inline legend */}
        <div className="flex items-center gap-2.5">
          {hasApproach && (
            <LegendDash
              color={approachColor}
              dashed={approachSeg?.isBus}
              label={approachSeg?.isBus ? "Bus" : "Walk"}
            />
          )}
          {hasAscent  && <LegendDash color={COLOR_ASCENT}  label="Ascent"  />}
          {hasDescent && <LegendDash color={COLOR_DESCENT} label="Descent" />}
          {hasReturn  && (
            <LegendDash
              color={returnColor}
              dashed={returnSeg?.isBus}
              label={returnSeg?.isBus ? "Bus" : "Walk"}
            />
          )}
        </div>
      </div>

      {data.length > 0 ? (
        // drop-shadow gives the strokes a subtle white glow — improves legibility
        // over complex map backgrounds when the sheet is partially transparent
        <div style={{ filter: "drop-shadow(0 0 1px rgba(255,255,255,0.7)) drop-shadow(0 1px 2px rgba(0,0,0,0.10))" }}>
          <ResponsiveContainer width="100%" height={118}>
            <AreaChart
              data={data}
              margin={{ top: 24, right: 8, bottom: 0, left: 4 }}
              onMouseMove={handlePointSelect}
              onClick={handlePointSelect}
              onMouseLeave={handleLeave}
            >
              {/* SVG definitions: ascent gradient fill */}
              <defs>
                <linearGradient id="elevAscentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={COLOR_ASCENT} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={COLOR_ASCENT} stopOpacity={0} />
                </linearGradient>
              </defs>

              <XAxis dataKey="dist" hide />
              <YAxis hide width={0} domain={["auto", "dataMax + 20"]} />

              {/* Horizontal baseline */}
              <ReferenceLine y={0} stroke="#D1D5DB" strokeWidth={1} ifOverflow="visible" />

              <Tooltip
                cursor={{ stroke: "rgba(170,171,184,0.35)", strokeWidth: 1 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const pt = payload[0]?.payload as ElevationPoint;
                  return (
                    <div
                      style={{
                        background: "rgba(17,17,22,0.85)",
                        borderRadius: 6,
                        padding: "4px 10px",
                        fontSize: 12,
                        color: "#fff",
                        lineHeight: 1.6,
                        pointerEvents: "none",
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{pt.ele} m</div>
                      <div style={{ color: "#AAABB8", fontSize: 11 }}>
                        {pt.dist.toFixed(2)} km
                      </div>
                    </div>
                  );
                }}
              />

              {/* Vertical dashed progress line */}
              {highlightPt && (
                <ReferenceLine
                  x={highlightPt.dist}
                  stroke={COLOR_ACTIVE}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  strokeOpacity={0.65}
                  ifOverflow="visible"
                />
              )}

              {/* ── Approach segment ── */}
              <Area
                type="monotone"
                dataKey="eleApproach"
                stroke={approachColor}
                strokeWidth={approachSeg?.isBus ? 2.5 : 1.5}
                strokeDasharray={approachSeg?.isBus ? "8 5" : undefined}
                strokeLinecap="round"
                fill="none"
                dot={false}
                activeDot={{ r: 3, fill: approachColor, stroke: "#fff", strokeWidth: 1 }}
                isAnimationActive={false}
                connectNulls={false}
              />

              {/* ── Ascent segment — emerald + gradient fill ── */}
              <Area
                type="monotone"
                dataKey="eleAscent"
                stroke={COLOR_ASCENT}
                strokeWidth={3}
                strokeLinecap="round"
                fill="url(#elevAscentGrad)"
                dot={renderDot}
                activeDot={{ r: 4, fill: COLOR_ACTIVE, stroke: "#fff", strokeWidth: 1.5 }}
                isAnimationActive={false}
                connectNulls={false}
              />

              {/* ── Descent segment — purple solid ── */}
              <Area
                type="monotone"
                dataKey="eleDescent"
                stroke={COLOR_DESCENT}
                strokeWidth={3}
                strokeLinecap="round"
                fill="none"
                dot={renderDot}
                activeDot={{ r: 4, fill: COLOR_ACTIVE, stroke: "#fff", strokeWidth: 1.5 }}
                isAnimationActive={false}
                connectNulls={false}
              />

              {/* ── Return segment ── */}
              <Area
                type="monotone"
                dataKey="eleReturn"
                stroke={returnColor}
                strokeWidth={returnSeg?.isBus ? 2.5 : 1.5}
                strokeDasharray={returnSeg?.isBus ? "8 5" : undefined}
                strokeLinecap="round"
                fill="none"
                dot={false}
                activeDot={{ r: 3, fill: returnColor, stroke: "#fff", strokeWidth: 1 }}
                isAnimationActive={false}
                connectNulls={false}
              />

              {/* ── Segment boundary node icons ── */}
              {boundaries.map((b, i) => (
                <ReferenceLine
                  key={i}
                  x={b.dist}
                  stroke="rgba(0,0,0,0.08)"
                  strokeWidth={1}
                  strokeDasharray="2 3"
                  ifOverflow="visible"
                  label={
                    <NodeIconLabel
                      segType={b.segType}
                      isBus={b.isBus}
                      busColor={b.busColor}
                    />
                  }
                />
              ))}

              {/* ── Photo camera markers ── */}
              {photos
                .filter(p => p.lat != null && p.lon != null)
                .map(photo => {
                  const dist = findDistForCoord(data, photo.lat!, photo.lon!);
                  if (dist === null) return null;
                  return (
                    <ReferenceLine
                      key={`photo-${photo.id}`}
                      x={dist}
                      stroke="rgba(245,158,11,0.4)"
                      strokeWidth={1}
                      strokeDasharray="2 3"
                      ifOverflow="visible"
                      label={
                        <PhotoIconLabel onClick={() => onPhotoClick?.(photo)} />
                      }
                    />
                  );
                })
              }
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[118px] flex items-center justify-center text-xs text-[var(--color-text-muted)]">
          No elevation data available
        </div>
      )}
    </div>
  );
}
