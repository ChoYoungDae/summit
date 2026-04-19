"use client";

import React from "react";
import Image from "next/image";

export default function SubwayHero() {
  return (
    <div className="relative w-full h-[180px] sm:h-[220px] overflow-hidden rounded-[16px] border border-[var(--color-border)] shadow-sm bg-[#F7F4F0]">
      {/* ── Background Image (Modern Sansuhwa) ── */}
      <Image
        src="/images/hero_sansuhwa.png"
        alt="Modern Sansuhwa Landscape"
        fill
        className="object-cover"
        priority
      />

      {/* Subtle Grain Texture for premium feel */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Soft Vignette and bottom blend */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#F7F4F0]/30 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 ring-1 ring-inset ring-black/5 rounded-[16px] pointer-events-none" />
    </div>
  );
}
