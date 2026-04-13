import { TrainFront, BellRing, Sun } from "lucide-react";
import MountainDiscovery from "@/components/ui/MountainDiscovery";

/* ── Core value items ─────────────────────────────────────────── */
const CORE_VALUES = [
  {
    Icon: TrainFront,
    title: "Station-to-Trail",
    desc: "Every route starts from a subway exit — no transfers, no guesswork.",
  },
  {
    Icon: BellRing,
    title: "Safety Alerts",
    desc: "Off-route GPS alerts and photo-based junction guides.",
  },
  {
    Icon: Sun,
    title: "Safe Return Guide",
    desc: "Personalized start-time alerts to ensure you're always back before it gets dark.",
  },
];

/* ── Page ─────────────────────────────────────────────────────── */
export default function HomePage() {
  return (
    <div className="flex flex-col gap-8 p-4 pb-8">

      {/* ── Intro ─────────────────────────────────────────────── */}
      <section className="pt-2 flex flex-col gap-5">
        <div>
          <h1
            className="text-[1.125rem] font-bold leading-snug text-[var(--color-text-primary)]"
            style={{ fontFamily: "var(--font-en)" }}
          >
            Start Your Hike from the Subway Exit
          </h1>
          <p className="mt-2 text-[0.875rem] text-[#3A3A45] leading-relaxed">
            Every route is{" "}
            <span className="font-semibold text-[var(--color-primary)]">
              personally verified
            </span>{" "}
            for{" "}
            <span className="font-semibold text-[var(--color-primary)]">
              your safety
            </span>
            .
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {CORE_VALUES.map(({ Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0 mt-0.5">
                <Icon
                  className="w-4 h-4 text-[var(--color-primary)]"
                  strokeWidth={2}
                />
              </div>
              <div>
                <p
                  className="text-[0.875rem] font-semibold leading-snug text-[var(--color-text-primary)]"
                  style={{ fontFamily: "var(--font-en)" }}
                >
                  {title}
                </p>
                <p className="text-[0.75rem] text-[#666674] leading-snug mt-0.5">
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Interest Chips + Mountain Illustration (shared state) ── */}
      <MountainDiscovery />

      {/* ── Personal Note ────────────────────────────────────────── */}
      <section 
        className="mt-2 rounded-[24px] border border-[#4A5D4E]/20 bg-[#F9F9F9] p-6 flex flex-col gap-4 shadow-sm"
      >
        <div className="flex">
          <span 
            className="inline-flex items-center bg-[#4A5D4E] text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-[0.05em]"
            style={{ fontFamily: "var(--font-en)" }}
          >
            April 13, 2026
          </span>
        </div>
        <p 
          className="text-[0.9375rem] leading-[1.6] text-[#3A3A45]"
          style={{ letterSpacing: "-0.01em" }}
        >
          Hi! I'm personally mapping out the Seoul trails I’ve loved and walked for decades. I’m currently uploading my favorite routes, vivid photos, and hidden tips one by one. Please visit often to see my journey unfold and find your next adventure!
        </p>
      </section>

    </div>
  );
}
