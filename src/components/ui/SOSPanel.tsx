"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { Phone, MessageSquare, X, MapPin, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/useLanguage";
import { tUI } from "@/lib/i18n";

// ── GPS moving-average hook ────────────────────────────────────────────────

const BUFFER_SIZE = 8;

interface Coords {
  lat: number;
  lon: number;
  accuracy: number | null;
}

function useSmoothedGPS() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const buffer = useRef<{ lat: number; lon: number }[]>([]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const raw = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        buffer.current = [...buffer.current.slice(-(BUFFER_SIZE - 1)), raw];
        const n = buffer.current.length;
        const avg = buffer.current.reduce(
          (acc, c) => ({ lat: acc.lat + c.lat / n, lon: acc.lon + c.lon / n }),
          { lat: 0, lon: 0 }
        );
        setCoords({
          lat: Math.round(avg.lat * 10000) / 10000,
          lon: Math.round(avg.lon * 10000) / 10000,
          accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null,
        });
        setError(null);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setError("Location permission denied");
        else setError("Unable to get location");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
    );

    return () => navigator.geolocation.clearWatch(id);
  }, []);

  return { coords, error };
}

// ── Script builder ─────────────────────────────────────────────────────────

function buildScript(coords: Coords | null) {
  const loc = coords
    ? `Lat: ${coords.lat.toFixed(4)}, Lon: ${coords.lon.toFixed(4)}`
    : "[Location unavailable — check GPS display]";
  const locKo = coords
    ? `위도 ${coords.lat.toFixed(4)}, 경도 ${coords.lon.toFixed(4)}`
    : "[위치 확인 불가]";
  return {
    en: `I am lost in the mountain. My location is ${loc}. Please send rescue.`,
    ko: `산에서 길을 잃었습니다. 제 위치는 ${locKo}입니다. 구조 바랍니다.`,
  };
}

// ── Call Overlay ───────────────────────────────────────────────────────────

interface OverlayProps {
  number: "119" | "1330";
  coords: Coords | null;
  onClose: () => void;
}

function CallOverlay({ number, coords, onClose }: OverlayProps) {
  const { locale } = useLanguage();
  const script = buildScript(coords);
  const is119 = number === "119";

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col"
      style={{ background: is119 ? "#C8362A" : "var(--color-primary)" }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <span className="text-white/70 text-sm font-medium">
          {is119 ? tUI("sosOverlayRescue", locale) : tUI("sosOverlayTourism", locale)}
        </span>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full"
          style={{ background: "rgba(255,255,255,0.18)" }}
          aria-label="Close"
        >
          <X size={18} className="text-white" />
        </button>
      </div>

      {/* Number */}
      <div className="flex flex-col items-center pt-4 pb-6">
        <span className="text-white/60 text-xs font-medium tracking-widest uppercase mb-1">
          {is119 ? tUI("sosOverlayKoreaEmergency", locale) : tUI("sosOverlayKoreaTourism", locale)}
        </span>
        <span className="text-white font-bold" style={{ fontSize: 64, lineHeight: 1 }}>
          {number}
        </span>
      </div>

      {/* GPS */}
      <div
        className="mx-5 rounded-2xl px-4 py-3 mb-4"
        style={{ background: "rgba(0,0,0,0.22)" }}
      >
        <div className="flex items-center gap-2 mb-1">
          <MapPin size={14} className="text-white/70" />
          <span className="text-white/70 text-xs font-semibold tracking-wide uppercase">
            {tUI("sosOverlayYourLocation", locale)}
          </span>
        </div>
        {coords ? (
          <p className="text-white font-mono text-sm">
            Lat: {coords.lat.toFixed(4)} &nbsp; Lon: {coords.lon.toFixed(4)}
            {coords.accuracy && (
              <span className="text-white/50 ml-2 text-xs">±{coords.accuracy}m</span>
            )}
          </p>
        ) : (
          <p className="text-white/60 text-sm">{tUI("sosOverlayAcquiringGPS", locale)}</p>
        )}
      </div>

      {/* Script */}
      {is119 && (
        <div
          className="mx-5 rounded-2xl px-4 py-4 mb-4 flex-1 overflow-y-auto"
          style={{ background: "rgba(0,0,0,0.22)" }}
        >
          <p className="text-white/60 text-xs font-semibold uppercase tracking-wide mb-3">
            {tUI("sosOverlayReadScript", locale)}
          </p>
          <p className="text-white text-base leading-relaxed font-medium mb-4">
            {script.en}
          </p>
          <p className="text-white/70 text-sm leading-relaxed">{script.ko}</p>
        </div>
      )}

      {/* Interpreter notice */}
      {is119 && (
        <div className="mx-5 mb-4 flex items-start gap-2">
          <Icon icon="ph:headset" width={16} height={16} className="text-white/60 mt-0.5 shrink-0" />
          <p className="text-white/70 text-xs leading-snug">
            {tUI("sosInterpreterNotice", locale)}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="px-5 pb-8 flex flex-col gap-3">
        <a
          href={`tel:${number}`}
          className="flex items-center justify-center gap-3 rounded-2xl py-4 text-base font-bold"
          style={{ background: "rgba(255,255,255,0.95)", color: is119 ? "#C8362A" : "var(--color-primary)" }}
        >
          <Phone size={20} />
          {tUI("sosOverlayCallNow", locale).replace("{number}", number)}
        </a>
        {is119 && (
          <a
            href={`sms:119?body=${encodeURIComponent(script.en)}`}
            className="flex items-center justify-center gap-3 rounded-2xl py-3.5 text-sm font-semibold text-white"
            style={{ background: "rgba(255,255,255,0.18)" }}
          >
            <MessageSquare size={18} />
            {tUI("sosOverlaySendSMS", locale)}
          </a>
        )}
      </div>
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────

export function SOSPanel() {
  const { locale } = useLanguage();
  const { coords, error } = useSmoothedGPS();
  const [overlay, setOverlay] = useState<"119" | "1330" | null>(null);
  const script = buildScript(coords);

  return (
    <>
      {overlay && (
        <CallOverlay number={overlay} coords={coords} onClose={() => setOverlay(null)} />
      )}

      <div className="flex flex-col gap-4 px-4 pt-4 pb-6">

        {/* Header */}
        <div
          className="rounded-2xl px-4 py-4 flex items-center gap-3"
          style={{ background: "rgba(200,54,42,0.08)" }}
        >
          <div
            className="flex items-center justify-center rounded-full shrink-0"
            style={{ width: 44, height: 44, background: "rgba(200,54,42,0.12)" }}
          >
            <Icon icon="ph:warning" width={22} height={22} style={{ color: "#C8362A" }} />
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: "#C8362A" }}>
              {tUI("sosHeroTitle", locale)}
            </p>
            <p className="text-xs leading-snug" style={{ color: "var(--color-text-body)" }}>
              {tUI("sosHeroSubtitle", locale)}
            </p>
          </div>
        </div>

        {/* GPS Card */}
        <div
          className="rounded-2xl px-4 py-4"
          style={{ background: "var(--color-card)", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <MapPin size={15} style={{ color: "var(--color-primary)" }} />
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-primary)" }}>
              {tUI("sosGPSLabel", locale)}
            </span>
          </div>
          {error ? (
            <p className="text-sm" style={{ color: "#C8362A" }}>{error}</p>
          ) : coords ? (
            <div className="flex flex-col gap-0.5">
              <p className="font-mono text-sm font-medium" style={{ color: "var(--color-text-body)" }}>
                Lat: {coords.lat.toFixed(4)} &nbsp; Lon: {coords.lon.toFixed(4)}
              </p>
              {coords.accuracy && (
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {tUI("sosGPSAccuracy", locale)
                    .replace("{accuracy}", String(coords.accuracy))
                    .replace("{readings}", String(Math.min(8, Math.ceil((coords.accuracy || 0) / 10 + 1))))}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" style={{ color: "var(--color-text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>{tUI("sosGPSAcquiring", locale)}</p>
            </div>
          )}
        </div>

        {/* Call 119 */}
        <button
          onClick={() => setOverlay("119")}
          className="flex items-center gap-4 rounded-2xl px-5 py-5 text-left active:scale-[0.98] transition-transform"
          style={{ background: "#C8362A" }}
        >
          <div
            className="flex items-center justify-center rounded-full shrink-0"
            style={{ width: 52, height: 52, background: "rgba(255,255,255,0.18)" }}
          >
            <Phone size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-white font-bold text-base">{tUI("sosCall119Title", locale)}</p>
            <p className="text-white/75 text-xs mt-0.5">{tUI("sosCall119Desc", locale)}</p>
          </div>
          <Icon icon="ph:caret-right" width={18} height={18} className="text-white/60" />
        </button>

        {/* Call 1330 */}
        <button
          onClick={() => setOverlay("1330")}
          className="flex items-center gap-4 rounded-2xl px-5 py-5 text-left active:scale-[0.98] transition-transform"
          style={{ background: "var(--color-primary)" }}
        >
          <div
            className="flex items-center justify-center rounded-full shrink-0"
            style={{ width: 52, height: 52, background: "rgba(255,255,255,0.18)" }}
          >
            <Phone size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-white font-bold text-base">{tUI("sosCall1330Title", locale)}</p>
            <p className="text-white/75 text-xs mt-0.5">{tUI("sosCall1330Desc", locale)}</p>
          </div>
          <Icon icon="ph:caret-right" width={18} height={18} className="text-white/60" />
        </button>

        {/* Auto-script */}
        <div
          className="rounded-2xl px-4 py-4"
          style={{ background: "var(--color-card)", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Icon icon="ph:chat-text" width={15} height={15} style={{ color: "var(--color-primary)" }} />
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-primary)" }}>
              {tUI("sosScriptTitle", locale)}
            </span>
          </div>
          <p className="text-sm leading-relaxed font-medium mb-2" style={{ color: "var(--color-text-body)" }}>
            {script.en}
          </p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            {script.ko}
          </p>
        </div>

        {/* SMS shortcut */}
        <a
          href={`sms:119?body=${encodeURIComponent(script.en)}`}
          className="flex items-center gap-3 rounded-2xl px-5 py-4 border active:scale-[0.98] transition-transform"
          style={{
            borderColor: "rgba(200,54,42,0.25)",
            background: "rgba(200,54,42,0.04)",
          }}
        >
          <MessageSquare size={20} style={{ color: "#C8362A" }} />
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: "#C8362A" }}>
              {tUI("sosSMS119Title", locale)}
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              {tUI("sosSMS119Desc", locale)}
            </p>
          </div>
          <Icon icon="ph:caret-right" width={16} height={16} style={{ color: "#C8362A" }} />
        </a>

        {/* Interpreter notice */}
        <div
          className="rounded-xl px-4 py-3 flex items-start gap-2.5"
          style={{ background: "rgba(46,94,74,0.06)" }}
        >
          <Icon icon="ph:headset" width={16} height={16} style={{ color: "var(--color-primary)", marginTop: 1 }} />
          <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-body)" }}>
            {tUI("sosInterpreterNotice", locale)}
          </p>
        </div>

      </div>
    </>
  );
}
