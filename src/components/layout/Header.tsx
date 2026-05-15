"use client";

import Link from "next/link";
import { Mountain, ChevronLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const CHIP_BG = "#C8362A";

// PTY code → weather emoji
function ptyIcon(pty: number): string {
  switch (pty) {
    case 1: return "🌧";
    case 2: return "🌨";
    case 3: return "❄️";
    case 4: return "🌦";
    default: return "☀️";
  }
}

interface WeatherData {
  tempC: number;
  tempF: number;
  pty: number;
}

export function Header() {
  const pathname = usePathname();
  const isRouteContext = pathname.startsWith("/route/");
  const [scrolled, setScrolled] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    fetch("/api/weather")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data && data.tempC != null) setWeather(data); })
      .catch(() => {});
  }, []);

  if (isRouteContext) {
    return (
      <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 h-14 bg-white/80 dark:bg-card-dark/80 backdrop-blur-sm flex items-center px-4 transition-all">
        <Link
          href="/"
          className="inline-flex items-center gap-0.5 text-[var(--color-primary)] active:opacity-70 transition-opacity"
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={2} />
          <span
            className="text-[0.9375rem] font-semibold"
            style={{ fontFamily: "var(--font-en)" }}
          >
            Home
          </span>
        </Link>
      </header>
    );
  }

  return (
    <header
      className={`fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 h-14 flex items-center px-4 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 dark:bg-card-dark/95 backdrop-blur-md border-b border-gray-100/60 shadow-sm"
          : "bg-[#F7F7FA] dark:bg-card-dark"
      }`}
    >
      <Link
        href="/"
        className="inline-flex items-center gap-2 active:opacity-70 transition-opacity"
      >
        <Mountain
          className="w-5 h-5 text-[var(--color-primary)] shrink-0"
          strokeWidth={2}
        />
        <span
          className="text-[var(--color-primary)] font-semibold text-[15px] tracking-tight"
          style={{ fontFamily: "var(--font-en)" }}
        >
          Seoul Subway to Summit
        </span>
      </Link>

      <span
        className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold shrink-0"
        style={{ color: "#374151", fontFamily: "var(--font-num)" }}
      >
        {weather ? (
          <>
            <span>{ptyIcon(weather.pty)}</span>
            <span>{weather.tempC}°C ({weather.tempF}°F)</span>
            <span className="opacity-40">·</span>
            <span style={{ fontFamily: "var(--font-en)" }}>SEOUL</span>
          </>
        ) : (
          <>
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse inline-block shrink-0"
              style={{ backgroundColor: "#9CA3AF" }}
            />
            <span style={{ fontFamily: "var(--font-en)" }}>SEOUL</span>
          </>
        )}
      </span>
    </header>
  );
}
