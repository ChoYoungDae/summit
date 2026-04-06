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

const COLOR_ASCENT  = "#2E5E4A"; // Namsan Pine Green — matches map ascent line
const COLOR_DESCENT = "#6366F1"; // Purple Indigo — matches MapView COLOR_DESCEND
const COLOR_ACTIVE  = "#C8362A"; // Dancheong Red

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
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

interface ElevationPoint {
  dist: number;
  ele: number;
  index: number;
  eleAscent?: number;
  eleDescent?: number;
}

function buildRaw(track: [number, number, number][]): Omit<ElevationPoint, "eleAscent" | "eleDescent">[] {
  if (!track || track.length === 0) return [];
  let dist = 0;
  return track.map(([lon, lat, ele], i) => {
    if (i > 0) {
      const prev = track[i - 1];
      if (prev && prev.length >= 2) {
        const [pLon, pLat] = prev;
        const d = haversineKm(pLat, pLon, lat, lon);
        if (!isNaN(d)) dist += d;
      }
    }
    return {
      dist: parseFloat(dist.toFixed(3)),
      ele: ele ?? 0,
      index: i,
    };
  });
}

interface Props {
  track: [number, number, number][];
  onHover: (point: [number, number, number] | null) => void;
  highlightIndex?: number | null;
}

export default function ElevationChart({ track, onHover, highlightIndex }: Props) {
  const rawData = useMemo(() => buildRaw(track), [track]);
  const rafRef = useRef<number | null>(null);

  // Find the highest point — everything before is ascent, after is descent.
  const peakIdx = useMemo(() => {
    if (rawData.length === 0) return 0;
    return rawData.reduce(
      (best, pt, i) => (pt.ele > rawData[best].ele ? i : best),
      0
    );
  }, [rawData]);

  // Split elevation data so each Area only covers its phase.
  // Peak point is included in both to produce a seamless join at the top.
  const data: ElevationPoint[] = useMemo(
    () =>
      rawData.map((pt, i) => ({
        ...pt,
        eleAscent:  i <= peakIdx ? pt.ele : undefined,
        eleDescent: i >= peakIdx ? pt.ele : undefined,
      })),
    [rawData, peakIdx]
  );

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePointSelect = useCallback((nextState: any) => {
    const dataIndex: unknown = nextState?.activeTooltipIndex;
    if (typeof dataIndex !== "number") return;

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (dataIndex < track.length) {
        onHover(track[dataIndex]);
      }
    });
  }, [track, onHover]);

  const handleLeave = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    onHover(null);
  }, [onHover]);

  const highlightPt = highlightIndex != null ? data[highlightIndex] : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderDot = useCallback((props: any) => {
    if (props.index !== highlightIndex) return <g key={props.index} />;
    const { cx, cy, value } = props;
    // Guard: skip if this Area doesn't have a value at this index (undefined segment)
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
  }, [highlightIndex]);

  return (
    <div
      className="px-2 pt-3 pb-1 rounded-xl"
      style={{ minHeight: "140px", background: "#F2F2F5" }}
      onTouchEnd={handleLeave}
    >
      <p
        className="text-[0.7rem] px-2 mb-1 leading-none text-[var(--color-text-muted)]"
        style={{ fontFamily: "var(--font-en)" }}
      >
        Elevation Profile
      </p>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={110}>
          <AreaChart
            data={data}
            margin={{ top: 4, right: 8, bottom: 0, left: 4 }}
            onMouseMove={handlePointSelect}
            onClick={handlePointSelect}
            onMouseLeave={handleLeave}
          >
            <XAxis dataKey="dist" hide />
            <YAxis hide width={0} domain={["auto", "dataMax + 20"]} />

            {/* Horizontal baseline */}
            <ReferenceLine y={0} stroke="#D1D5DB" strokeWidth={1} ifOverflow="visible" />

            <Tooltip
              cursor={{ stroke: "rgba(170,171,184,0.35)", strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const pt = payload[0].payload as ElevationPoint;
                return (
                  <div style={{
                    background: "rgba(17,17,22,0.85)",
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontSize: 12,
                    color: "#fff",
                    lineHeight: 1.6,
                    pointerEvents: "none",
                  }}>
                    <div style={{ fontWeight: 700 }}>{pt.ele} m</div>
                    <div style={{ color: "#AAABB8", fontSize: 11 }}>{pt.dist.toFixed(2)} km</div>
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

            {/* Ascent segment — green */}
            <Area
              type="monotone"
              dataKey="eleAscent"
              stroke={COLOR_ASCENT}
              strokeWidth={3}
              fill="none"
              dot={renderDot}
              activeDot={{ r: 4, fill: COLOR_ACTIVE, stroke: "#fff", strokeWidth: 1.5 }}
              isAnimationActive={false}
              connectNulls={false}
            />

            {/* Descent segment — indigo */}
            <Area
              type="monotone"
              dataKey="eleDescent"
              stroke={COLOR_DESCENT}
              strokeWidth={3}
              fill="none"
              dot={renderDot}
              activeDot={{ r: 4, fill: COLOR_ACTIVE, stroke: "#fff", strokeWidth: 1.5 }}
              isAnimationActive={false}
              connectNulls={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[110px] flex items-center justify-center text-xs text-[var(--color-text-muted)]">
          No elevation data available
        </div>
      )}
    </div>
  );
}
