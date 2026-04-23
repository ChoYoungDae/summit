"use client";

import { Icon } from "@iconify/react";
import { Train, Shield } from "lucide-react";
import { useLanguage } from "@/lib/useLanguage";
import { tUI } from "@/lib/i18n";

// ── Shared card wrapper ────────────────────────────────────────────────────

function Section({
  icon,
  iconId,
  title,
  accent = false,
  children,
}: {
  icon?: React.ReactNode;
  iconId?: string;
  title: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl px-4 py-4 flex flex-col gap-3"
      style={{ background: "var(--color-card)", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="flex items-center justify-center rounded-full shrink-0"
          style={{
            width: 36,
            height: 36,
            background: accent ? "rgba(200,54,42,0.10)" : "rgba(46,94,74,0.09)",
          }}
        >
          {iconId ? (
            <Icon
              icon={iconId}
              width={18}
              height={18}
              style={{ color: accent ? "#C8362A" : "var(--color-primary)" }}
            />
          ) : (
            icon
          )}
        </div>
        <h2
          className="font-bold text-base"
          style={{ color: accent ? "#C8362A" : "var(--color-primary)" }}
        >
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

function Item({
  iconId,
  icon,
  label,
  body,
  accent = false,
}: {
  iconId?: string;
  icon?: React.ReactNode;
  label: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div
        className="flex items-center justify-center rounded-full shrink-0 mt-0.5"
        style={{
          width: 28,
          height: 28,
          background: accent ? "rgba(200,54,42,0.08)" : "rgba(46,94,74,0.07)",
        }}
      >
        {iconId ? (
          <Icon
            icon={iconId}
            width={14}
            height={14}
            style={{ color: accent ? "#C8362A" : "var(--color-primary)" }}
          />
        ) : (
          icon
        )}
      </div>
      <div className="flex flex-col gap-0.5 flex-1">
        <p className="text-[15px] font-semibold" style={{ color: "var(--color-text-body)" }}>
          {label}
        </p>
        <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          {body}
        </p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function InfoPage() {
  const { locale } = useLanguage();

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-6">

      {/* Hero */}
      <div
        className="rounded-2xl px-4 py-4 flex items-center gap-3"
        style={{ background: "rgba(46,94,74,0.07)" }}
      >
        <div
          className="flex items-center justify-center rounded-full shrink-0"
          style={{ width: 44, height: 44, background: "rgba(46,94,74,0.12)" }}
        >
          <Icon icon="ph:mountains" width={22} height={22} style={{ color: "var(--color-primary)" }} />
        </div>
        <div>
          <p className="font-bold text-base" style={{ color: "var(--color-primary)" }}>
            {tUI("infoHeroTitle", locale)}
          </p>
          <p className="text-sm leading-snug" style={{ color: "var(--color-text-body)" }}>
            {tUI("infoHeroSubtitle", locale)}
          </p>
        </div>
      </div>

      {/* 1. Tourism Center */}
      <Section iconId="ph:map-trifold" title={tUI("infoSectionTourismTitle", locale)}>
        <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-body)" }}>
          {tUI("infoSectionTourismDesc", locale)}
        </p>
        <a
          href="https://seoulhiking.or.kr"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 self-start"
          style={{ color: "var(--color-primary)" }}
        >
          <Icon icon="ph:arrow-square-out" width={14} height={14} />
          <span className="text-sm font-medium underline underline-offset-2">seoulhiking.or.kr</span>
        </a>

        {/* Center locations */}
        <div className="flex flex-col gap-2">
          {[
            {
              name: tUI("infoCenterBukhansan", locale),
              subway: tUI("infoSubwayBukhansan", locale),
              hours: tUI("infoHours", locale),
              closed: tUI("infoClosedMon", locale),
            },
            {
              name: tUI("infoCenterBugaksan", locale),
              subway: tUI("infoSubwayBugaksan", locale),
              hours: tUI("infoHours", locale),
              closed: tUI("infoClosedTue", locale),
            },
            {
              name: tUI("infoCenterGwanaksan", locale),
              subway: tUI("infoSubwayGwanaksan", locale),
              hours: tUI("infoHours", locale),
              closed: tUI("infoClosedWed", locale),
            },
          ].map((c) => (
            <div
              key={c.name}
              className="rounded-xl px-3 py-2.5 flex items-start gap-2.5"
              style={{ background: "rgba(46,94,74,0.06)" }}
            >
              <Icon
                icon="ph:map-pin"
                width={14}
                height={14}
                style={{ color: "var(--color-primary)", marginTop: 2, flexShrink: 0 }}
              />
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold" style={{ color: "var(--color-text-body)" }}>
                  {c.name}
                </p>
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  {c.subway}
                </p>
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  {c.hours} · {c.closed}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 pt-1">
          <Item
            iconId="ph:backpack"
            label={tUI("infoGearRentalTitle", locale)}
            body={tUI("infoGearRentalDesc", locale)}
          />
          <Item
            iconId="ph:lock-key"
            label={tUI("infoFacilitiesTitle", locale)}
            body={tUI("infoFacilitiesDesc", locale)}
          />
          <Item
            iconId="ph:book-open"
            label={tUI("infoInformationTitle", locale)}
            body={tUI("infoInformationDesc", locale)}
          />
        </div>
      </Section>

      {/* 2. Why Seoul */}
      <Section iconId="ph:mountains" title={tUI("infoSectionWhySeoulTitle", locale)}>
        <div className="flex flex-col gap-3">
          <Item
            icon={<Train size={14} style={{ color: "var(--color-primary)" }} />}
            label={tUI("infoWhyHourRuleTitle", locale)}
            body={tUI("infoWhyHourRuleDesc", locale)}
          />
          <Item
            iconId="ph:stairs"
            label={tUI("infoWhyNatureTitle", locale)}
            body={tUI("infoWhyNatureDesc", locale)}
          />
          <Item
            iconId="ph:cell-signal-full"
            label={tUI("infoWhySafetyTitle", locale)}
            body={tUI("infoWhySafetyDesc", locale)}
          />
          <Item
            iconId="ph:paw-print"
            label={tUI("infoWhyWildlifeTitle", locale)}
            body={tUI("infoWhyWildlifeDesc", locale)}
          />
        </div>
      </Section>

      {/* 3. Safety & Rules */}
      <Section
        icon={<Shield size={18} style={{ color: "#C8362A" }} />}
        title={tUI("infoSectionSafetyTitle", locale)}
        accent
      >
        <div className="flex flex-col gap-3">
          <Item
            iconId="ph:boot"
            label={tUI("infoSafetyGearTitle", locale)}
            body={tUI("infoSafetyGearDesc", locale)}
            accent
          />
          <Item
            iconId="ph:prohibit"
            label={tUI("infoSafetyAlcoholTitle", locale)}
            body={tUI("infoSafetyAlcoholDesc", locale)}
            accent
          />
          <Item
            iconId="ph:paw-print"
            label={tUI("infoSafetyWildlifeTitle", locale)}
            body={tUI("infoSafetyWildlifeDesc", locale)}
            accent
          />
        </div>
      </Section>

      {/* 4. Zero-Waste */}
      <Section iconId="ph:leaf" title={tUI("infoSectionZeroWasteTitle", locale)}>
        <div className="flex flex-col gap-3">
          <Item
            iconId="ph:trash"
            label={tUI("infoZeroWasteNoCansTitle", locale)}
            body={tUI("infoZeroWasteNoCansDesc", locale)}
          />
          <Item
            iconId="ph:bag"
            label={tUI("infoZeroWasteBYOBTitle", locale)}
            body={tUI("infoZeroWasteBYOBDesc", locale)}
          />
        </div>
      </Section>

    </div>
  );
}
