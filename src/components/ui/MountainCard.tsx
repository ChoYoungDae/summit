"use client";

import Image from "next/image";
import Link from "next/link";
import { TrendingUp, Ruler, Map as MapIcon } from "lucide-react";
import { tDB, tUI } from "@/lib/i18n";
import type { MountainSummary } from "@/lib/trails";

interface Props {
  mountain: MountainSummary;
  locale: string;
  priority?: boolean;
}

const LEVEL_LABELS: Record<string, { label: string; color: string }> = {
  ansan:     { label: "Level 1", color: "#4ADE80" }, // Green
  inwangsan: { label: "Level 2", color: "#FACC15" }, // Yellow
  gwanaksan: { label: "Level 3", color: "#FB923C" }, // Orange
  bukhansan: { label: "Level 4", color: "#F87171" }, // Red
};

export default function MountainCard({ mountain, locale, priority = false }: Props) {
  const levelInfo = LEVEL_LABELS[mountain.slug] || { label: "Level ?", color: "#9CA3AF" };
  
  return (
    <Link
      href={`/route?mountain=${mountain.id}`}
      className="group relative flex flex-col h-[180px] rounded-2xl overflow-hidden shadow-sm active:scale-[0.98] transition-all duration-200"
    >
      {/* Background Image */}
      {mountain.imageUrl ? (
        <div className="absolute inset-0 z-0">
          <Image
            src={mountain.imageUrl}
            alt={mountain.name.en}
            fill
            sizes="(max-width: 768px) 50vw, 33vw"
            priority={priority}
            className="object-cover transition-transform duration-500 group-hover:scale-110"
          />
          {/* Gradients */}
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        </div>
      ) : (
        <div className="absolute inset-0 z-0 bg-gray-200" />
      )}

      {/* Content Overlay */}
      <div className="relative z-10 flex flex-col justify-end h-full p-4 text-white">
        {/* Top: Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 opacity-100">
          <span 
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg"
            style={{ 
              background: levelInfo.color, 
              color: "white",
              textShadow: "0 1px 2px rgba(0,0,0,0.3)"
            }}
          >
            <TrendingUp size={11} strokeWidth={3} />
            {levelInfo.label}
          </span>
        </div>

        {/* Bottom Info */}
        <h3 className="text-base font-bold leading-tight mb-2 drop-shadow-md">
          <span className="font-en">{tDB(mountain.name, locale)}</span>
          {locale !== "ko" && mountain.name.ko && (
            <span className="text-[0.7em] font-ko font-medium ml-1.5 opacity-90">
              {mountain.name.ko}
            </span>
          )}
        </h3>
        
        <div className="flex items-center gap-4 text-[11px] font-medium text-white/90">
          <div className="flex items-center gap-1">
            <Ruler size={12} />
            <span>{mountain.maxElevationM}{tUI("meters", locale)}</span>
          </div>
          <div className="flex items-center gap-1">
            <MapIcon size={12} />
            <span>
              {mountain.routeCount}{" "}
              {mountain.routeCount === 1 ? tUI("routesCount", locale).replace(/s$/, "") : tUI("routesCount", locale)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
