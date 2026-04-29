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
import type { SegmentType } from "@/types/trail";

// ── Color palette ─────────────────────────────────────────────────────────────
const COLOR_ASCENT   = "#10B981"; // Emerald green — climbing
const COLOR_DESCENT  = "#8B5CF6"; // Purple — descending
const COLOR_BUS       = "#FF7A00"; // Bright Orange
// COLOR_WALK reserved for future use
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

function smoothElevations(data: ElevationPoint[], radius = 8): ElevationPoint[] {
  return data.map((pt, i) => {
    const lo = Math.max(0, i - radius);
    const hi = Math.min(data.length - 1, i + radius);
    let sum = 0, count = 0;
    for (let j = lo; j <= hi; j++) { sum += data[j].ele; count++; }
    const smoothed = sum / count;
    return {
      ...pt,
      ele:         smoothed,
      eleApproach: pt.eleApproach != null ? smoothed : undefined,
      eleAscent:   pt.eleAscent   != null ? smoothed : undefined,
      eleDescent:  pt.eleDescent  != null ? smoothed : undefined,
      eleReturn:   pt.eleReturn   != null ? smoothed : undefined,
    };
  });
}

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
  elevM,
}: {
  viewBox?: { x: number; y: number; width: number; height: number };
  segType: SegmentType;
  isBus: boolean;
  elevM?: number;
}) {
  if (!viewBox) return null;
  const { x } = viewBox;

  let color: string;
  let IconComp: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

  if (segType === "DESCENT") {
    color = COLOR_DESCENT;
    IconComp = Flag;
  } else if (isBus) {
    color = COLOR_BUS;
    IconComp = Bus;
  } else if (segType === "ASCENT") {
    color = COLOR_ASCENT;
    IconComp = Footprints;
  } else {
    color = COLOR_DESCENT;
    IconComp = Footprints;
  }

  const label = elevM != null ? `${elevM}m` : null;
  const labelW = label ? label.length * 6.5 + 10 : 0;

  return (
    <g>
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
      {label && (
        <g>
          <rect x={x + 13} y={4} width={labelW} height={14} rx={7} fill="rgba(17,17,22,0.82)" />
          <text
            x={x + 13 + labelW / 2}
            y={11}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={10}
            fontFamily="var(--font-num)"
            fontWeight="bold"
            fill="white"
          >
            {label}
          </text>
        </g>
      )}
    </g>
  );
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
          strokeWidth={2.5}
          strokeDasharray={dashed ? "2 3" : undefined}
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
  summitElevationM?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ElevationChart({ segments, onHover, highlightTrackIndex, summitElevationM }: Props) {
  const nonBusSegments = useMemo(() => segments.filter((s) => !s.isBus), [segments]);
  const { data: rawData, trackIndexMap, boundaries } = useMemo(
    () => buildData(nonBusSegments),
    [nonBusSegments]
  );
  const data = useMemo(() => smoothElevations(rawData), [rawData]);
  const rafRef = useRef<number | null>(null);

  const approachSeg = nonBusSegments.find((s) => s.type === "APPROACH");
  const returnSeg   = nonBusSegments.find((s) => s.type === "RETURN");

  const approachColor = COLOR_ASCENT;
  const returnColor   = COLOR_DESCENT;

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

  const yDomain = useMemo(() => {
    const eles = data.map((d) => d.ele).filter((e) => isFinite(e) && e > 0);
    if (eles.length === 0) return ["auto", "auto"] as const;
    const minEle = Math.min(...eles);
    const maxEle = Math.max(...eles);
    const range = Math.max(maxEle - minEle, 40);
    return [Math.max(0, Math.floor(minEle - range * 0.06)), Math.ceil(maxEle + range * 0.04)] as const;
  }, [data]);

  // Summit point: boundary where DESCENT starts (= peak reached)
  const summitPt = useMemo(() => {
    if (data.length === 0) return null;
    const summitBoundary = boundaries.find((b) => b.segType === "DESCENT" && !b.isBus);
    if (summitBoundary) {
      return data.reduce((best, pt) =>
        Math.abs(pt.dist - summitBoundary.dist) < Math.abs(best.dist - summitBoundary.dist) ? pt : best
      );
    }
    return data.reduce((best, pt) => (pt.ele > best.ele ? pt : best));
  }, [data, boundaries]);

  const summitDataIndex = useMemo(
    () => (summitPt ? data.indexOf(summitPt) : -1),
    [summitPt, data]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderAscentDot = useCallback((props: any) => {
    const { cx, cy, index, value } = props;
    if (value === undefined || value === null || !isFinite(cy)) return <g key={index} />;

    // Summit elevation label — rendered at the actual peak pixel position
    if (summitElevationM && index === summitDataIndex) {
      const label = `${summitElevationM}m`;
      const w = label.length * 7 + 12;
      return (
        <g key={`summit-label-${index}`}>
          <rect x={cx - w / 2} y={cy - 19} width={w} height={15} rx={7.5} fill="rgba(17,17,22,0.82)" />
          <text
            x={cx}
            y={cy - 11}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={10}
            fontFamily="var(--font-num)"
            fontWeight="bold"
            fill="white"
          >
            {label}
          </text>
        </g>
      );
    }

    if (index !== highlightGlobalIndex) return <g key={index} />;
    return (
      <circle key={`dot-${index}`} cx={cx} cy={cy} r={7} fill={COLOR_ACTIVE} stroke="#fff" strokeWidth={2} />
    );
  }, [highlightGlobalIndex, summitDataIndex, summitElevationM]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderDescentDot = useCallback((props: any) => {
    const { cx, cy, index, value } = props;
    if (value === undefined || value === null || !isFinite(cy)) return <g key={index} />;
    if (index !== highlightGlobalIndex) return <g key={index} />;
    return (
      <circle key={`dot-${index}`} cx={cx} cy={cy} r={7} fill={COLOR_ACTIVE} stroke="#fff" strokeWidth={2} />
    );
  }, [highlightGlobalIndex]);

  // X axis ticks: start, summit, end
  const xTicks = useMemo(() => {
    if (data.length === 0) return [];
    const endDist = data[data.length - 1].dist;
    const ticks: number[] = [0];
    if (summitPt && summitPt.dist > 0.05 && summitPt.dist < endDist - 0.05) {
      ticks.push(summitPt.dist);
    }
    ticks.push(endDist);
    return ticks;
  }, [data, summitPt]);

  // Build legend entries only for segments that actually have points
  const hasApproach = !!approachSeg && approachSeg.points.length > 0;
  const hasReturn   = !!returnSeg   && returnSeg.points.length > 0;
  const hasAscent   = segments.some((s) => s.type === "ASCENT" && s.points.length > 0);
  const hasDescent  = segments.some((s) => s.type === "DESCENT" && s.points.length > 0);

  return (
    <div
      className="px-2 pt-3 pb-1 rounded-xl"
      style={{ minHeight: "160px", background: "#F2F2F5" }}
      onTouchEnd={handleLeave}
    >
      {/* Inline legend */}
      <div className="flex items-center justify-end gap-2.5 px-2 mb-1">
        {hasApproach && <LegendDash color={approachColor} dashed label="Approach" />}
        {hasAscent   && <LegendDash color={COLOR_ASCENT}  label="Ascent"  />}
        {hasDescent  && <LegendDash color={COLOR_DESCENT} label="Descent" />}
        {hasReturn   && <LegendDash color={returnColor}   dashed label="Return" />}
      </div>

      {data.length > 0 ? (
        // drop-shadow gives the strokes a subtle white glow — improves legibility
        // over complex map backgrounds when the sheet is partially transparent
        <div style={{ filter: "drop-shadow(0 0 1px rgba(255,255,255,0.7)) drop-shadow(0 1px 2px rgba(0,0,0,0.10))" }}>
          <ResponsiveContainer width="100%" height={152}>
            <AreaChart
              data={data}
              margin={{ top: 22, right: 8, bottom: 4, left: 4 }}
              onMouseMove={handlePointSelect}
              onClick={handlePointSelect}
              onMouseLeave={handleLeave}
            >
              <defs />

              <XAxis
                dataKey="dist"
                ticks={xTicks}
                tick={{ fontSize: 9, fill: "#9CA3AF", fontFamily: "var(--font-num)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => (v === 0 ? "0" : `${v.toFixed(1)} km`)}
              />
              <YAxis hide width={0} domain={yDomain} />

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

              {/* ── Approach segment (walk — dashed) ── */}
              <Area
                type="basis"
                dataKey="eleApproach"
                stroke={approachColor}
                strokeWidth={3}
                strokeDasharray="4 6"
                strokeLinecap="round"
                fill="none"
                dot={false}
                activeDot={{ r: 3, fill: approachColor, stroke: "#fff", strokeWidth: 1 }}
                isAnimationActive={false}
                connectNulls={false}
              />

              {/* ── Ascent segment — solid, no fill ── */}
              <Area
                type="basis"
                dataKey="eleAscent"
                stroke={COLOR_ASCENT}
                strokeWidth={3}
                strokeLinecap="round"
                fill="none"
                dot={renderAscentDot}
                activeDot={{ r: 4, fill: COLOR_ACTIVE, stroke: "#fff", strokeWidth: 1.5 }}
                isAnimationActive={false}
                connectNulls={false}
              />

              {/* ── Descent segment — purple solid ── */}
              <Area
                type="basis"
                dataKey="eleDescent"
                stroke={COLOR_DESCENT}
                strokeWidth={3}
                strokeLinecap="round"
                fill="none"
                dot={renderDescentDot}
                activeDot={{ r: 4, fill: COLOR_ACTIVE, stroke: "#fff", strokeWidth: 1.5 }}
                isAnimationActive={false}
                connectNulls={false}
              />

              {/* ── Return segment (walk — dashed) ── */}
              <Area
                type="basis"
                dataKey="eleReturn"
                stroke={returnColor}
                strokeWidth={3}
                strokeDasharray="4 6"
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
                      elevM={b.segType === "DESCENT" && !b.isBus ? summitElevationM : undefined}
                    />
                  }
                />
              ))}

            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[138px] flex items-center justify-center text-xs text-[var(--color-text-muted)]">
          No elevation data available
        </div>
      )}
    </div>
  );
}
