"use client";

import { useEffect, useState } from "react";
import { fetchMountainSummaries } from "@/lib/trails";
import type { MountainSummary } from "@/lib/trails";
import { useLanguage } from "@/lib/useLanguage";
import { tUI } from "@/lib/i18n";
import MountainCard from "./MountainCard";

export default function MountainDiscovery() {
  const { locale } = useLanguage();
  const [mountains, setMountains] = useState<MountainSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await fetchMountainSummaries();
      // Sort specifically as Ansan, Inwangsan, Gwanaksan, Bukhansan (by elevation ascending)
      const sorted = [...data].sort((a, b) => (a.maxElevationM || 0) - (b.maxElevationM || 0));
      setMountains(sorted);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        <div className="h-6 w-1/3 bg-gray-200 rounded-md" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-44 bg-gray-200 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2
          className="text-lg font-bold leading-tight"
          style={{ fontFamily: locale === "ko" ? "var(--font-ko)" : "var(--font-en)" }}
        >
          {tUI("discoverYourPeak", locale)}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {mountains.map((mt, i) => (
          <MountainCard key={mt.id} mountain={mt} locale={locale} priority={i < 2} />
        ))}
      </div>

      <p className="text-center text-[13px] text-[var(--color-text-muted)] mt-1">
        {tUI("tapMountain", locale)}
      </p>
    </div>
  );
}
