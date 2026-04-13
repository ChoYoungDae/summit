"use client";

import dynamic from "next/dynamic";
import type { MountainPin, StationPin } from "@/lib/trails";

// mapbox-gl references browser globals at import — must load client-side only
const HomeMapView = dynamic(() => import("./HomeMapView"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full rounded-[var(--radius-card)] relative overflow-hidden flex items-center justify-center border border-[#E5E2DD]"
      style={{
        height: 380,
        backgroundColor: "#F9F7F4",
        backgroundImage: `
          linear-gradient(#E8E5E0 1px, transparent 1px),
          linear-gradient(90deg, #E8E5E0 1px, transparent 1px)
        `,
        backgroundSize: "24px 24px",
      }}
    >
      <div className="flex flex-col items-center gap-2 opacity-30 select-none">
        <svg width="40" height="40" viewBox="0 0 100 80" fill="none" stroke="#2E5E4A" strokeWidth="2">
          <path d="M10 70 L35 30 L50 45 L75 15 L90 70" />
        </svg>
        <span className="text-[11px] font-bold text-[#2E5E4A] tracking-widest uppercase">
          Sketching Map...
        </span>
      </div>
      
      {/* Subtle paper grain texture overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.03]" 
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />
    </div>
  ),
});

interface Props {
  mountains: MountainPin[];
  stations: StationPin[];
}

export default function HomeMapViewLoader(props: Props) {
  return <HomeMapView {...props} />;
}
