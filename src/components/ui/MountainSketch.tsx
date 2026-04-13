"use client";

import React, { useState } from "react";
import { MOUNTAIN_SKETCHES } from "@/constants/mountain-sketches";

interface Props {
  slug: string;
  nameEn: string;
  nameKo?: string;
  onClick?: () => void;
}

export default function MountainSketch({ slug, nameEn, nameKo, onClick }: Props) {
  const path = MOUNTAIN_SKETCHES[slug];
  if (!path) return null;

  return (
    <div
      className="group relative flex flex-col items-center cursor-pointer select-none"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {/* Label with Text Shadow */}
      <div className="mb-0.5 relative z-10 flex flex-col items-center">
        <span 
          className="text-[10px] font-bold text-[#2E5E4A] tracking-tight leading-none"
          style={{ textShadow: "0 0 3px #fff, 0 0 3px #fff, 1px 1px 0 #fff, -1px -1px 0 #fff" }}
        >
          {nameEn.toUpperCase()}
        </span>
        {nameKo && (
          <span 
            className="text-[9px] text-[#2E5E4A]/80 font-medium leading-none mt-0.5"
            style={{ textShadow: "0 0 2px #fff, 0 0 2px #fff" }}
          >
            {nameKo}
          </span>
        )}
      </div>

      {/* SVG Silhouette */}
      <div className="relative w-16 h-12 flex items-end justify-center">
        <svg
          viewBox="0 0 110 100"
          className="w-full h-full overflow-visible transition-all duration-500 ease-out group-hover:scale-110 origin-bottom"
        >
          {/* Main path */}
          <path
            d={path}
            fill="none"
            stroke="#2E5E4A"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-all duration-300 group-hover:stroke-[5px]"
            style={{ 
              vectorEffect: "non-scaling-stroke",
              filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.15))"
            }}
          />
          
          {/* Subtle 'shadow' or 'glow' path to make it more pencil-like */}
          <path
            d={path}
            fill="none"
            stroke="#2E5E4A"
            strokeWidth="1"
            className="opacity-20 translate-x-[1px] translate-y-[1px]"
            style={{ vectorEffect: "non-scaling-stroke" }}
          />
        </svg>
      </div>

      <style jsx>{`
        .group:hover .origin-bottom {
          animation: mountain-jump 0.4s ease-out;
        }
        @keyframes mountain-jump {
          0% { transform: scale(1); }
          50% { transform: scale(1.1) translateY(-2px); }
          100% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
