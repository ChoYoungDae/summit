import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl";
import type { MapRef } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { MountainPin, StationPin } from "@/lib/trails";
import MountainSketch from "./MountainSketch";
import { useRouter } from "next/navigation";

interface Props {
  mountains: MountainPin[];
  stations: StationPin[]; 
}

const HIKER_COLOR = "#2E5E4A";

export default function HomeMapView({ mountains, stations }: Props) {
  const router = useRouter();
  const mapRef = useRef<MapRef>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  const [userPos, setUserPos] = useState<[number, number] | null>(null);

  // GPS Tracking
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserPos([pos.coords.longitude, pos.coords.latitude]);
      },
      (err) => console.warn("[HomeMap GPS]", err.message),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const bounds = useMemo(() => {
    if (mountains.length === 0) return undefined;
    const lons = mountains.map((m) => m.lon);
    const lats = mountains.map((m) => m.lat);
    
    // Auto-calculating bounds centered around Seoul mountains
    return [
      [Math.min(...lons) - 0.02, Math.min(...lats) - 0.02],
      [Math.max(...lons) + 0.02, Math.max(...lats) + 0.02],
    ] as [[number, number], [number, number]];
  }, [mountains]);

  const onMapLoad = useCallback((e: any) => {
    const map = e.target;
    const style = map.getStyle();
    if (!style || !style.layers) return;

    // Filters: Hide roads, buildings, labels, admin lines
    // Keep only water and background
    style.layers.forEach((layer: any) => {
      const id = layer.id.toLowerCase();
      const isWater = id.includes("water");
      
      const shouldHide = 
        id.includes("road") || 
        id.includes("building") || 
        id.includes("place") || 
        id.includes("label") || 
        id.includes("poi") ||
        id.includes("admin") ||
        id.includes("transit") ||
        id.includes("boundary");

      if (shouldHide && !isWater) {
        map.setLayoutProperty(layer.id, "visibility", "none");
      }
    });
  }, []);

  const handleMountainClick = useCallback((m: MountainPin) => {
    if (!mapRef.current) return;

    // 1. Fly to the mountain for immersion
    mapRef.current.flyTo({
      center: [m.lon, m.lat],
      zoom: 14,
      duration: 1000,
      essential: true
    });

    // 2. Delayed transition to the detail page
    setTimeout(() => {
      router.push(m.href);
    }, 850);
  }, [router]);

  return (
    <div className="w-full h-[380px] rounded-[var(--radius-card)] overflow-hidden border border-[var(--color-border)] shadow-sm relative">
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        mapStyle="mapbox://styles/mapbox/outdoors-v12"
        initialViewState={{
          bounds,
          fitBoundsOptions: { 
            padding: { top: 60, bottom: 60, left: 40, right: 40 } 
          },
        }}
        reuseMaps
        attributionControl={false}
        onLoad={onMapLoad}
      >
        {/* Custom attribution to keep clean UI */}
        <div className="absolute bottom-1 right-1 opacity-40 scale-[0.6] origin-bottom-right">
          <a href="https://www.mapbox.com/about/maps/" target="_blank" className="text-[10px] text-gray-600">© Mapbox</a>
        </div>

        {/* User Location Marker (Hiker Figure) */}
        {userPos && (
          <Marker 
            longitude={userPos[0]} 
            latitude={userPos[1]} 
            anchor="bottom"
          >
            <div className="flex flex-col items-center group">
              <div 
                className="px-1.5 py-0.5 bg-white/95 rounded-full border border-[var(--color-border)] shadow-md mb-1.5 z-10"
                style={{ textShadow: "0 0 2px #fff" }}
              >
                <span className="text-[9px] font-bold text-[#2E5E4A] tracking-widest">YOU</span>
              </div>
              
              <div className="relative">
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1.5 bg-black/20 rounded-[50%] blur-[2px]" />
                
                <svg 
                  viewBox="0 0 24 24" 
                  className="w-10 h-10 overflow-visible" 
                  style={{ filter: "drop-shadow(0 4px 3px rgba(0,0,0,0.35))" }}
                >
                  <path 
                    d="M13.5 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM10.5 8c-.6 0-1.1.2-1.5.6L7.2 10.4c-.4.4-.4 1 0 1.4.4.4 1 .4 1.4 0l1.8-1.8V13c0 .6.4 1 1 1h1v4c0 .6.4 1 1 1s1-.4 1-1v-4.5c0-.3-.1-.5-.3-.7L11.5 10.1l.6-2.1H10.5z M9 8V6c0-1.1-.9-2-2-2s-2 .9-2 2v4c0 1.1.9 2 2 2h.5L9 10V8z M17 14h-1V12c0-1.1-.9-2-2-2V8c1.7 0 3 1.3 3 3v3z M18 10h-1v10h1v-10z" 
                    fill={HIKER_COLOR}
                    stroke="#fff"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </Marker>
        )}

        {/* Mountain Sketch Markers */}
        {mountains.map((m) => (
          <Marker 
            key={m.id} 
            longitude={m.lon} 
            latitude={m.lat}
            anchor="bottom"
          >
            <MountainSketch 
              slug={m.slug} 
              nameEn={m.nameEn} 
              nameKo={m.nameKo}
              onClick={() => handleMountainClick(m)}
            />
          </Marker>
        ))}

        {/* Minimized Controls */}
        <div className="absolute top-2 right-2 scale-75 origin-top-right grayscale opacity-60">
          <NavigationControl showCompass={false} />
        </div>
      </Map>

      {/* Subtle overlay texture to give a 'paper' feel over the whole section */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.02]" 
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />
    </div>
  );
}
