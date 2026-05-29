"use client";

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";

function ptyIcon(pty: number): string {
  switch (pty) {
    case 1: return "🌧";
    case 2: return "🌨";
    case 3: return "❄️";
    case 4: return "🌦";
    default: return "☀️";
  }
}

function formatSunsetMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

interface WeatherData { tempC: number; tempF: number; pty: number }

export function HomeWeatherBar({ sunsetMin }: { sunsetMin: number | null }) {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    fetch("/api/weather")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.tempC != null) setWeather(d); })
      .catch(() => {});
  }, []);

  return (
    <div
      className="flex items-center rounded-2xl px-4 py-3"
      style={{
        background: "rgba(255,255,255,0.55)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.4)",
        boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
      }}
    >
      {/* Weather */}
      <div className="flex items-center gap-2.5 flex-1">
        <span className="text-xl leading-none">
          {weather ? ptyIcon(weather.pty) : "🌤"}
        </span>
        <div>
          <p className="font-num text-[15px] font-bold leading-none" style={{ color: "var(--color-text-body)" }}>
            {weather ? `${weather.tempC}°C / ${weather.tempF}°F` : "—"}
          </p>
          <p
            className="text-[10px] font-semibold uppercase tracking-wide mt-0.5"
            style={{ fontFamily: "var(--font-en)", color: "var(--color-text-muted)" }}
          >
            Seoul
          </p>
        </div>
      </div>

      {sunsetMin != null && (
        <>
          <div className="w-px h-8 mx-3" style={{ background: "rgba(0,0,0,0.08)" }} />
          <div className="flex items-center gap-2.5">
            <Icon icon="ph:sunset" width={20} height={20} style={{ color: "var(--color-primary)" }} />
            <div>
              <p className="font-num text-[15px] font-bold leading-none" style={{ color: "var(--color-text-body)" }}>
                {formatSunsetMin(sunsetMin)}
              </p>
              <p
                className="text-[10px] font-semibold uppercase tracking-wide mt-0.5"
                style={{ fontFamily: "var(--font-en)", color: "var(--color-text-muted)" }}
              >
                Sunset KST
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
