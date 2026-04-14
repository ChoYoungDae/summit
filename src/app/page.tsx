import Link from "next/link";
import { Mountain, Train } from "lucide-react";

export default function LandingPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "var(--color-bg-light)" }}
    >
      {/* Title */}
      <div className="mb-10 text-center">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-en)" }}
        >
          Seoul Routes
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
          Explore Seoul — on foot or by subway
        </p>
      </div>

      {/* Cards — side by side */}
      <div className="w-full max-w-sm flex gap-3">

        {/* Subway card — left, coming soon */}
        <div
          className="relative flex-1 flex flex-col gap-3 p-5 rounded-[var(--radius-card)] opacity-50 cursor-not-allowed"
          style={{
            background: "var(--color-card)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "var(--color-bg-light)" }}
          >
            <Train
              className="w-5 h-5"
              strokeWidth={2}
              style={{ color: "var(--color-text-muted)" }}
            />
          </div>
          <div>
            <p
              className="text-sm font-bold leading-snug"
              style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-en)" }}
            >
              Step-Free Seoul Subway
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              No more dragging suitcases
            </p>
          </div>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide self-start"
            style={{ background: "var(--color-bg-light)", color: "var(--color-text-muted)" }}
          >
            Coming soon
          </span>
        </div>

        {/* Hiking card — right */}
        <Link
          href="/hiking"
          className="relative flex-1 flex flex-col gap-3 p-5 rounded-[var(--radius-card)] active:opacity-80 transition-opacity"
          style={{ background: "var(--color-primary)", color: "#fff" }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            <Mountain className="w-5 h-5" strokeWidth={2} />
          </div>
          <div>
            <p
              className="text-sm font-bold leading-snug"
              style={{ fontFamily: "var(--font-en)" }}
            >
              Seoul Subway to Summit
            </p>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.75)" }}>
              Find hiking trails via Seoul Subway
            </p>
          </div>
        </Link>

      </div>
    </div>
  );
}
