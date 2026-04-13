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

    </div>
  );
}
