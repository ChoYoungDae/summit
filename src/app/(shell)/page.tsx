import { TrainFront, Navigation, Sun, Map } from "lucide-react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import MountainDiscovery from "@/components/ui/MountainDiscovery";
import { HomeWeatherBar } from "@/components/ui/HomeWeatherBar";
import { tUI, LANGUAGE_STORAGE_KEY, DEFAULT_LANGUAGE } from "@/lib/i18n";
import type { SupportedLocale } from "@/lib/i18n";
import { fetchMountainSummaries } from "@/lib/trails";
import { fetchSunsetMin } from "@/lib/sunset";
import { cookies } from "next/headers";

export default async function HomePage() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get(LANGUAGE_STORAGE_KEY)?.value as SupportedLocale)
    ?? DEFAULT_LANGUAGE;

  const [rawMountains, sunsetMin] = await Promise.all([
    fetchMountainSummaries(),
    fetchSunsetMin(),
  ]);
  const mountains = [...rawMountains].sort((a, b) => (a.maxElevationM ?? 0) - (b.maxElevationM ?? 0));

  const coreValues = [
    { Icon: TrainFront, title: tUI("valueStationTitle", locale),    color: "#4A5D4E",                   bgColor: "rgba(74, 93, 78, 0.1)" },
    { Icon: Navigation, title: tUI("valueGPSAlertsTitle", locale),  color: "var(--color-secondary)",    bgColor: "rgba(200, 54, 42, 0.1)" },
    { Icon: Sun,        title: tUI("valueSafetyReturnTitle", locale),color: "#4A5D4E",                   bgColor: "rgba(74, 93, 78, 0.1)" },
    { Icon: Map,        title: tUI("valueJunctionGuideTitle", locale),color: "var(--color-secondary)",   bgColor: "rgba(200, 54, 42, 0.1)" },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 pb-8">
      {/* ── Identity + silhouette + feature chips ─────────────── */}
      <section className="relative -mx-4 px-4 pt-4 pb-4 flex flex-col gap-5 min-h-[235px]">
        {/* Faint mountain silhouette */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
          <img
            src="/images/hero-mountain.jpg"
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: "center 45%", opacity: 0.15 }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(247,247,250,1) 0%, rgba(247,247,250,0.65) 6%, rgba(247,247,250,0.05) 18%, rgba(247,247,250,0) 30%, rgba(247,247,250,0) 55%, rgba(247,247,250,0.55) 74%, rgba(247,247,250,0.93) 88%, rgba(247,247,250,1) 100%)",
            }}
          />
        </div>

        {/* Icon + title */}
        <div className="relative z-10 flex items-center gap-3">
          <img
            src="/images/S2S.png"
            alt="S2S"
            width={56}
            height={56}
            className="shrink-0"
          />
          <h1
            className="text-[1.625rem] font-bold leading-tight whitespace-nowrap"
            style={{ fontFamily: "var(--font-en)" }}
          >
            <span style={{ color: "var(--color-primary)" }}>Seoul </span>
            <span style={{ color: "var(--color-secondary)" }}>Subway</span>
            <span style={{ color: "var(--color-primary)" }}> to Summit</span>
          </h1>
        </div>

        {/* 1×4 feature chips */}
        <div className="relative z-10 grid grid-cols-4 px-1 mt-auto">
          {coreValues.map(({ Icon, title, color, bgColor }, index) => (
            <div key={title} className="relative flex flex-col items-center gap-2 py-1">
              {index < 3 && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[0.5px] h-7 bg-[#E9E9EB]" />
              )}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: bgColor }}
              >
                <Icon className="w-5 h-5" style={{ color }} strokeWidth={2} />
              </div>
              <p
                className="text-[9px] font-bold text-center leading-tight uppercase tracking-tight"
                style={{ fontFamily: "var(--font-en)", color }}
              >
                {title}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Weather + Sunset ──────────────────────────────────── */}
      <HomeWeatherBar sunsetMin={sunsetMin} />

      {/* ── Mountain Grid ─────────────────────────────────────── */}
      <MountainDiscovery mountains={mountains} locale={locale} />

      {/* ── Why Seoul teaser ──────────────────────────────────── */}
      <section
        className="rounded-2xl px-4 py-4 flex flex-col gap-2.5"
        style={{ background: "var(--color-card)", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}
      >
        <div className="flex items-center gap-2">
          <Icon icon="ph:mountains" width={18} height={18} style={{ color: "var(--color-primary)" }} />
          <p className="text-base font-bold" style={{ color: "var(--color-primary)", fontFamily: "var(--font-en)" }}>
            {tUI("infoSectionWhySeoulTitle", locale)}
          </p>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-body)" }}>
          {tUI("infoWhyHourRuleDesc", locale)}
        </p>
        <Link
          href="/info"
          className="self-end text-sm font-semibold hover:opacity-75 transition-opacity"
          style={{ color: "var(--color-primary)", fontFamily: "var(--font-en)" }}
        >
          Full hiking guide →
        </Link>
      </section>

      {/* ── Feedback ──────────────────────────────────────────── */}
      <section className="mt-2 flex justify-center">
        <Link
          href="https://docs.google.com/forms/d/e/1FAIpQLSfuIAIdYil3vwRWOWBzrnxexNv_wcdvC24yN2-EhfPZM9JplQ/viewform?usp=sf_link"
          target="_blank"
          className="inline-flex items-center gap-1.5 text-[0.875rem] font-bold text-[var(--color-primary)] hover:opacity-80 transition-opacity"
        >
          <Icon icon="ph:chat-circle-dots" width={18} height={18} />
          {tUI("sendFeedback", locale)}
        </Link>
      </section>
    </div>
  );
}
