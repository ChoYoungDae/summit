"use client";
import { TrainFront, Navigation, Sun, Map } from "lucide-react";
import MountainDiscovery from "@/components/ui/MountainDiscovery";
import { useLanguage } from "@/lib/useLanguage";
import { tUI } from "@/lib/i18n";

/* ── Page ─────────────────────────────────────────────────────── */
export default function HomePage() {
  const { locale } = useLanguage();

  const coreValues = [
    {
      Icon: TrainFront,
      title: tUI("valueStationTitle", locale),
      color: "#4A5D4E",
      bgColor: "rgba(74, 93, 78, 0.1)",
    },
    {
      Icon: Navigation,
      title: tUI("valueGPSAlertsTitle", locale),
      color: "var(--color-secondary)",
      bgColor: "rgba(200, 54, 42, 0.1)",
    },
    {
      Icon: Sun,
      title: tUI("valueSafetyReturnTitle", locale),
      color: "#4A5D4E",
      bgColor: "rgba(74, 93, 78, 0.1)",
    },
    {
      Icon: Map,
      title: tUI("valueJunctionGuideTitle", locale),
      color: "var(--color-secondary)",
      bgColor: "rgba(200, 54, 42, 0.1)",
    },
  ];

  const title = tUI("homeTitle", locale);
  const highlightedTitle = title.split(/(Seoul|Subway|서울|지하철)/g).map((part, i) => {
    if (["Seoul", "Subway", "서울", "지하철"].includes(part)) {
      return (
        <span key={i} style={{ color: "var(--color-secondary)" }}>
          {part}
        </span>
      );
    }
    return part;
  });

  return (
    <div className="flex flex-col gap-6 p-4 pb-8">
      {/* ── Intro ─────────────────────────────────────────────── */}
      <section className="pt-2 flex flex-col gap-6">
        <div>
          <h1
            className="text-[1.125rem] font-bold leading-snug text-[var(--color-text-primary)]"
            style={{ fontFamily: "var(--font-en)" }}
          >
            {highlightedTitle}
          </h1>
          <div className="mt-2 flex flex-col gap-1">
            <p className="text-[0.875rem] text-[#3A3A45] leading-relaxed">
              {tUI("homeSubtitle", locale)}
            </p>
            <p className="text-[0.875rem] text-[#3A3A45] leading-relaxed">
              {tUI("homeDescription", locale)}
            </p>
          </div>
        </div>

        {/* ── 1x4 Card Row ── */}
        <div className="grid grid-cols-4 px-1">
          {coreValues.map(({ Icon, title, color, bgColor }, index) => (
            <div 
              key={title} 
              className="relative flex flex-col items-center gap-2 py-1"
            >
              {/* Vertical Divider */}
              {index < 3 && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[0.5px] h-7 bg-[#E9E9EB]" />
              )}
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: bgColor }}
              >
                <Icon
                  className="w-5 h-5"
                  style={{ color: color }}
                  strokeWidth={2}
                />
              </div>
              <p
                className="text-[9px] font-bold text-center leading-tight uppercase tracking-tight"
                style={{ fontFamily: "var(--font-en)", color: color }}
              >
                {title}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Interest Chips + Mountain Illustration (shared state) ── */}
      <MountainDiscovery />

      {/* ── Personal Note ────────────────────────────────────────── */}
      <section 
        className="mt-2 rounded-[16px] border border-[#4A5D4E]/20 bg-[#F9F9F9] p-6 flex flex-col gap-4 shadow-sm"
      >
        <div className="flex">
          <span 
            className="inline-flex items-center bg-[#4A5D4E] text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-[0.05em]"
            style={{ fontFamily: "var(--font-en)" }}
          >
            {tUI("personalNoteDate", locale)}
          </span>
        </div>
        <p 
          className="text-[0.9375rem] leading-[1.6] text-[#3A3A45]"
          style={{ letterSpacing: "-0.01em" }}
        >
          {tUI("personalNote", locale)}
        </p>
      </section>

    </div>
  );
}
