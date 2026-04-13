"use client";

import { useState } from "react";
import InterestChips from "./InterestChips";
import SeoulMountainsIllustration from "./SeoulMountainsIllustration";

const CHIP_MOUNTAINS: Record<string, string[]> = {
  "challenge":    ["bukhansan", "gwanaksan"],
  "city-views":   ["inwangsan"],
  "nature-walk":  ["inwangsan", "ansan"],
};

export default function MountainDiscovery() {
  const [selected, setSelected] = useState<string | null>(null);
  const highlightSlugs = selected ? (CHIP_MOUNTAINS[selected] ?? null) : null;

  return (
    <>
      <section>
        <InterestChips selected={selected} onSelect={setSelected} />
      </section>

      <section className="flex flex-col gap-2">
        <p
          className="text-[0.9375rem] font-semibold leading-snug text-[var(--color-text-primary)]"
          style={{ fontFamily: "var(--font-en)" }}
        >
          Discover Your Peak
        </p>
        <SeoulMountainsIllustration highlightSlugs={highlightSlugs} />
        <p className="text-center text-[0.6875rem] text-[var(--color-text-muted)]">
          Tap a mountain to explore routes
        </p>
      </section>
    </>
  );
}
