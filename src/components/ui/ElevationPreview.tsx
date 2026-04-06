"use client";

import { useMemo, useCallback } from "react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";

const COLOR_ASCENT  = "#2E5E4A";
const COLOR_DESCENT = "#5B8FA8";

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

interface ElevationPoint {
  dist: number;
  ele: number;
  eleAscent?: number;
  eleDescent?: number;
}

interface Props {
  track: [number, number, number][];
}

export default function ElevationPreview({ track }: Props) {
  const { data, peakIdx, peakEle } = useMemo(() => {
    if (!track || track.length === 0) return { data: [], peakIdx: 0, peakEle: 0 };

    let dist = 0;
    const raw = track.map(([lon, lat, ele], i) => {
      if (i > 0) {
        const prev = track[i - 1];
        dist += haversineKm(prev[1], prev[0], lat, lon);
      }
      return { dist: parseFloat(dist.toFixed(3)), ele };
    });

    const peakIdx = raw.reduce(
      (best, pt, i) => (pt.ele > raw[best].ele ? i : best),
      0
    );

    const data: ElevationPoint[] = raw.map((pt, i) => ({
      dist: pt.dist,
      ele: pt.ele,
      eleAscent:  i <= peakIdx ? pt.ele : undefined,
      eleDescent: i >= peakIdx ? pt.ele : undefined,
    }));

    return { data, peakIdx, peakEle: raw[peakIdx].ele };
  }, [track]);

  // Render peak dot + label at the exact recharts-computed position
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderPeakDot = useCallback((props: any) => {
    const { cx, cy, index } = props;
    if (index !== peakIdx || cx == null || cy == null) return <g key={index} />;
    const label = `${peakEle} m`;
    return (
      <g key={`peak-${index}`}>
        <circle cx={cx} cy={cy} r={3} fill={COLOR_ASCENT} stroke="white" strokeWidth={1.5} />
        <text
          x={cx}
          y={cy - 7}
          textAnchor="middle"
          fontSize={9}
          fontWeight={700}
          fill={COLOR_ASCENT}
          style={{ fontFamily: "var(--font-en)" }}
        >
          {label}
        </text>
      </g>
    );
  }, [peakIdx, peakEle]);

  if (data.length === 0) return null;

  return (
    <div className="w-full" style={{ height: 60 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 16, right: 4, bottom: 0, left: 4 }}>
          <XAxis dataKey="dist" hide />
          <YAxis hide domain={["auto", "dataMax + 30"]} />

          {/* Horizontal baseline */}
          <ReferenceLine y={0} stroke="#D1D5DB" strokeWidth={1} ifOverflow="visible" />

          {/* Ascent — renders peak dot + label */}
          <Area
            type="monotone"
            dataKey="eleAscent"
            stroke={COLOR_ASCENT}
            strokeWidth={2.5}
            fill="none"
            dot={renderPeakDot}
            activeDot={false}
            isAnimationActive={false}
            connectNulls={false}
          />
          <Area
            type="monotone"
            dataKey="eleDescent"
            stroke={COLOR_DESCENT}
            strokeWidth={2.5}
            fill="none"
            dot={false}
            activeDot={false}
            isAnimationActive={false}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
