"use client";

import { type Waypoint } from "@/types/trail";
import { t } from "@/lib/i18n";
import { DualText } from "./DualText";

interface Props {
  waypoint: Waypoint;
  locale?: string;
}

export default function GuideCard({ waypoint, locale = "en" }: Props) {
  const isJunction = waypoint.type === "JUNCTION";
  const accentColor = isJunction
    ? "var(--color-primary)"    // urgent at junctions
    : "var(--color-secondary)"; // informational

  const primaryName = t(waypoint.name, locale);
  const koName = locale !== "ko" ? waypoint.name.ko : undefined;
  const desc = waypoint.description ? t(waypoint.description, locale) : undefined;

  return (
    <div className="mx-3 mt-0 mb-2 rounded-xl bg-[var(--color-card)] border border-[var(--color-border)] overflow-hidden shadow-sm">
      {/* Thin top accent stripe */}
      <div className="h-[3px]" style={{ background: accentColor }} />

      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <DualText en={primaryName} ko={koName ?? ""} size="0.9rem" />
          {waypoint.elevationM != null && (
            <span
              className="text-xs text-[var(--color-text-muted)] mt-0.5 shrink-0"
              style={{ fontFamily: "var(--font-en)" }}
            >
              {waypoint.elevationM} m
            </span>
          )}
        </div>

        {desc && (
          <p
            className="mt-1.5 text-xs leading-snug text-[var(--color-text-body)]"
            style={{ fontFamily: "var(--font-en)" }}
          >
            {desc}
          </p>
        )}
      </div>
    </div>
  );
}
