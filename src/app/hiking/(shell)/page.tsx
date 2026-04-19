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
      bgColor: "#F3F6F4",
    },
    {
      Icon: Navigation,
      title: tUI("valueGPSAlertsTitle", locale),
      color: "var(--color-secondary)",
      bgColor: "rgba(200, 54, 42, 0.08)",
    },
    {
      Icon: Sun,
      title: tUI("valueSafetyReturnTitle", locale),
      color: "#4A5D4E",
      bgColor: "#F3F6F4",
    },
    {
      Icon: Map,
      title: tUI("valueJunctionGuideTitle", locale),
      color: "var(--color-secondary)",
      bgColor: "rgba(200, 54, 42, 0.08)",
    },
  ];

  const title = tUI("homeTitle", locale);
  const highlightedTitle = title.split(/(Seoul|Subway Exit|서울|지하철)/g).map((part, i) => {
    if (["Seoul", "Subway Exit", "서울", "지하철"].includes(part)) {
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
          <p className="mt-2 text-[0.875rem] text-[#3A3A45] leading-relaxed">
            {tUI("homeSubtitle", locale)}
          </p>
        </div>

        {/* ── 1x4 Card Row ── */}
        <div className="grid grid-cols-4 gap-2">
          {coreValues.map(({ Icon, title, color, bgColor }) => (
            <div 
              key={title} 
              className="flex flex-col items-center justify-center gap-2.5 p-3 rounded-[20px] bg-white border border-[#E9E9EB] shadow-sm active:bg-[#F9F9F9] transition-colors h-[100px]"
            >
              <div 
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: bgColor }}
              >
                <Icon
                  className="w-[18px] h-[18px]"
                  style={{ color: color }}
                  strokeWidth={2.5}
                />
              </div>
              <p
                className="text-[10px] font-bold text-center leading-tight uppercase tracking-tight"
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
            {new Date().toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
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
