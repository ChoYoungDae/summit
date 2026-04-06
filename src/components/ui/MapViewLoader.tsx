"use client";

import dynamic from "next/dynamic";
import type { MapViewProps } from "./MapView";

// mapbox-gl references browser globals at import time — must be loaded client-side only
const MapView = dynamic(() => import("./MapView"), { 
  ssr: false,
  loading: () => <div className="w-full bg-[var(--color-bg-light)] animate-pulse rounded-[var(--radius-card)]" style={{ height: "420px" }} />
});

export default function MapViewLoader(props: MapViewProps) {
  return (
    <div className="w-full h-full">
      <MapView {...props} />
    </div>
  );
}
