"use client";

import type { MountainSummary } from "@/lib/trails";
import { tUI } from "@/lib/i18n";
import MountainCard from "./MountainCard";

interface Props {
  mountains: MountainSummary[];
  locale: string;
}

export default function MountainDiscovery({ mountains, locale }: Props) {
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
