"use client";

import { useState } from "react";
import { TrendingUp, Camera, Trees } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLanguage } from "@/lib/useLanguage";
import { tUI } from "@/lib/i18n";

const CHIPS: { id: string; labelKey: any; Icon: LucideIcon }[] = [
  { id: "challenge",   labelKey: "chipChallenge", Icon: TrendingUp },
  { id: "city-views",  labelKey: "chipCityViews",   Icon: Camera     },
  { id: "nature-walk", labelKey: "chipNatureWalk",  Icon: Trees      },
];

interface Props {
  selected?: string | null;
  onSelect?: (id: string | null) => void;
}

export default function InterestChips({ selected: controlledSelected, onSelect }: Props = {}) {
  const { locale } = useLanguage();
  const [internalSelected, setInternalSelected] = useState<string | null>(null);

  // Controlled when parent passes selected; otherwise self-managed
  const selected = controlledSelected !== undefined ? controlledSelected : internalSelected;
  const handleClick = (id: string) => {
    const next = selected === id ? null : id;
    if (onSelect) onSelect(next);
    else setInternalSelected(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <p
        className="text-[0.9375rem] font-semibold leading-snug text-[var(--color-text-primary)] text-center"
        style={{ fontFamily: locale === "ko" ? "var(--font-ko)" : "var(--font-en)" }}
      >
        {tUI("findPerfectTrail", locale)}
      </p>

      <div className="flex flex-wrap gap-3 justify-center">
        {CHIPS.map(({ id, labelKey, Icon }) => {
          const active = selected === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleClick(id)}
              className={[
                "flex items-center gap-1.5 px-3 py-1 rounded-full border transition-colors duration-150",
                "text-[0.75rem] font-medium",
                active
                  ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white"
                  : "border-gray-300 text-[var(--color-text-muted)]",
              ].join(" ")}
              style={{ fontFamily: locale === "ko" ? "var(--font-ko)" : "var(--font-en)" }}
            >
              <Icon
                size={14}
                strokeWidth={2}
                className={active ? "text-white" : "text-gray-400"}
              />
              {tUI(labelKey, locale)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
