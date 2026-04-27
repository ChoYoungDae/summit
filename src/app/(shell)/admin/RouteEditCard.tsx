"use client";

import { useState, useRef } from "react";
import { CheckCircle, AlertCircle, Trash2, ChevronDown, Upload, Route } from "lucide-react";
import { parseTrackFile } from "@/lib/parseGpx";

const INPUT     = "rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm bg-[var(--color-bg-light)] focus:outline-none focus:ring-2 focus:ring-primary/40 w-full";
const LABEL     = "text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]";
const CARD      = "rounded-2xl bg-white border border-[var(--color-border)] p-5 flex flex-col gap-4";
const BTN_PRIMARY = "flex items-center justify-center gap-2 rounded-xl bg-primary text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed";
const BTN_GHOST   = "flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-bg-light)] transition-colors";

type Mountain = { id: number; name: { en?: string; ko?: string } };
type RouteRow  = {
  id: number;
  name: { en?: string; ko?: string };
  tags?: { en: string; ko: string }[];
  highlights?: { type: "highlight" | "pro_tip" | "warning"; text: { en: string; ko: string } }[];
  description?: { en?: string; ko?: string };
  total_distance_m?: number;
  total_duration_min?: number;
};

type TagItem       = { en: string; ko: string };
type HighlightType = "highlight" | "pro_tip" | "warning";
type HighlightItem = { type: HighlightType; en: string; ko: string };

export default function RouteEditCard() {
  const [mountains,        setMountains]        = useState<Mountain[]>([]);
  const [mountainsLoaded,  setMountainsLoaded]  = useState(false);
  const [mountainId,       setMountainId]       = useState<number | null>(null);

  const [routes,           setRoutes]           = useState<RouteRow[]>([]);
  const [routeId,          setRouteId]          = useState<number | null>(null);
  const [selectedRoute,    setSelectedRoute]    = useState<RouteRow | null>(null);

  const [tags,       setTags]       = useState<TagItem[]>([]);
  const [highlights, setHighlights] = useState<HighlightItem[]>([]);
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionKo, setDescriptionKo] = useState("");

  const [saving,  setSaving]  = useState(false);
  const [fixing,  setFixing]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [fixSuccess, setFixSuccess] = useState(false);
  const [parsedPointCount, setParsedPointCount] = useState<number | null>(null);
  const [error,   setError]   = useState("");

  const gpxInputRef = useRef<HTMLInputElement>(null);

  async function loadMountains() {
    if (mountainsLoaded) return;
    const res  = await fetch("/api/admin/mountains");
    const data = await res.json();
    setMountains(data ?? []);
    setMountainsLoaded(true);
  }

  async function loadRoutes(mid: number) {
    const res  = await fetch(`/api/admin/routes?mountainId=${mid}`);
    const data: RouteRow[] = await res.json();
    setRoutes(data ?? []);
    setRouteId(null);
    setSelectedRoute(null);
    setTags([]);
    setHighlights([]);
  }

  function selectRoute(id: number) {
    const route = routes.find((r) => r.id === id);
    if (!route) return;
    setRouteId(id);
    setSelectedRoute(route);
    setTags(route.tags ?? [{ en: "", ko: "" }]);
    setHighlights(
      (route.highlights ?? [{ type: "highlight", text: { en: "", ko: "" } }]).map((h) => ({
        type: h.type,
        en:   h.text.en,
        ko:   h.text.ko,
      })),
    );
    setDescriptionEn(route.description?.en || "");
    setDescriptionKo(route.description?.ko || "");
    setSuccess(false);
    setFixSuccess(false);
    setError("");
  }

  async function handleSave() {
    if (!routeId) return;
    setSaving(true);
    setError("");
    setSuccess(false);

    const res = await fetch("/api/admin/routes", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id:         routeId,
        tags:       tags.filter((t) => t.en || t.ko),
        highlights: highlights
          .filter((h) => h.en || h.ko)
          .map((h) => ({ type: h.type, text: { en: h.en, ko: h.ko } })),
        description: (descriptionEn || descriptionKo)
          ? { en: descriptionEn, ko: descriptionKo }
          : undefined,
      }),
    });

    setSaving(false);
    if (res.ok) {
      setSuccess(true);
    } else {
      const d = await res.json();
      setError(d.error ?? "Save failed");
    }
  }

  async function handleGpxReplace(file: File) {
    if (!routeId) return;
    setFixing(true);
    setError("");
    setSuccess(false);
    setFixSuccess(false);

    try {
      const parsed = await parseTrackFile(file);
      const res = await fetch("/api/admin/routes/update-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeId,
          trackPoints: parsed.points,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");

      setFixSuccess(true);
      setParsedPointCount(data.pointCount);
      setTimeout(() => setFixSuccess(false), 5000); // Keep it visible a bit longer

      // Update local stats immediately
      if (selectedRoute) {
        setSelectedRoute({
          ...selectedRoute,
          total_distance_m: data.totalDistanceM,
          total_duration_min: data.totalDurationMin,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "GPX update failed");
    } finally {
      setFixing(false);
    }
  }

  return (
    <div className={CARD}>
      {/* Header */}
      <div>
        <p className="text-sm font-semibold text-[var(--color-text-body)]">Edit Route Content & GPS</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Select a route to update its metadata or replace a glitched GPS track.</p>
      </div>

      {/* Mountain select */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className={LABEL}>Mountain</p>
          <select
            className={INPUT}
            value={mountainId ?? ""}
            onFocus={loadMountains}
            onChange={(e) => {
              const mid = Number(e.target.value) || null;
              setMountainId(mid);
              if (mid) loadRoutes(mid);
            }}
          >
            <option value="">— mountain —</option>
            {mountains.map((m) => (
              <option key={m.id} value={m.id}>{m.name.ko || m.name.en}</option>
            ))}
          </select>
        </div>

        {/* Route select */}
        {routes.length > 0 && (
          <div>
            <p className={LABEL}>Route</p>
            <select
              className={INPUT}
              value={routeId ?? ""}
              onChange={(e) => selectRoute(Number(e.target.value))}
            >
              <option value="">— select —</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>{r.name.ko || r.name.en}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Edit fields — shown only after route is selected */}
      {routeId && (
        <>
          {/* GPS Fix Section */}
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                <Route size={14} /> GPS Track Fix
              </p>
              {selectedRoute && (
                <div className={`flex flex-col items-end transition-all duration-500 ${fixSuccess ? "scale-110" : ""}`}>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                    fixSuccess 
                      ? "bg-green-100 border-green-300 text-green-700 font-bold" 
                      : "bg-white/50 border-amber-200 text-amber-600"
                  }`}>
                    {Math.round(selectedRoute.total_distance_m || 0).toLocaleString()}m · {selectedRoute.total_duration_min}m
                  </span>
                  {fixSuccess && <span className="text-[9px] text-green-600 font-bold mt-0.5 animate-pulse">Updated!</span>}
                </div>
              )}
            </div>
            <p className="text-[10px] text-amber-700 leading-tight">
              If the current GPS track has glitches or spikes, upload a corrected file. 
              All segments will be re-calculated based on this new track.
            </p>
            
            <input
              ref={gpxInputRef}
              type="file"
              accept=".gpx,.geojson"
              className="hidden"
              onChange={(e) => { 
                const file = e.target.files?.[0];
                if (file) {
                  handleGpxReplace(file);
                }
                // Clear the input so the same file can be selected again
                e.target.value = "";
              }}
            />
            
            <button
              onClick={() => gpxInputRef.current?.click()}
              disabled={fixing}
              className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-amber-600 text-white py-2 text-xs font-bold hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {fixing ? (
                <>
                  <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Updating Track…
                </>
              ) : (
                <>
                  <Upload size={14} />
                  Replace & Fix GPS Track
                </>
              )}
            </button>
            {fixSuccess && (
              <p className="text-[10px] font-bold text-green-600 text-center animate-bounce">
                ✅ GPS Track Updated Successfully! {parsedPointCount ? `(Parsed ${parsedPointCount.toLocaleString()} points)` : ""}
              </p>
            )}
          </div>

          <div className="h-px bg-[var(--color-border)] my-1" />

          {/* Tags */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className={LABEL}>Hashtags</p>
              {tags.length < 3 && (
                <button
                  onClick={() => setTags((prev) => [...prev, { en: "", ko: "" }])}
                  className="text-[11px] text-primary font-semibold"
                >
                  + Add
                </button>
              )}
            </div>
            {tags.length === 0 && (
              <button
                onClick={() => setTags([{ en: "", ko: "" }])}
                className="text-xs text-primary font-semibold self-start"
              >
                + Add first tag
              </button>
            )}
            {tags.map((tag, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <input
                  className={INPUT}
                  placeholder="지하철 접근"
                  value={tag.ko}
                  onChange={(e) => {
                    const next = [...tags];
                    next[i] = { ...next[i], ko: e.target.value };
                    setTags(next);
                  }}
                />
                <input
                  className={INPUT}
                  placeholder="Subway Access"
                  value={tag.en}
                  onChange={(e) => {
                    const next = [...tags];
                    next[i] = { ...next[i], en: e.target.value };
                    setTags(next);
                  }}
                />
                <button
                  onClick={() => setTags((prev) => prev.filter((_, j) => j !== i))}
                  className="text-[var(--color-text-muted)] hover:text-red-500 flex-none"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Highlights */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className={LABEL}>Highlights</p>
              <button
                onClick={() => setHighlights((prev) => [...prev, { type: "highlight", en: "", ko: "" }])}
                className="text-[11px] text-primary font-semibold"
              >
                + Add
              </button>
            </div>
            {highlights.length === 0 && (
              <button
                onClick={() => setHighlights([{ type: "highlight", en: "", ko: "" }])}
                className="text-xs text-primary font-semibold self-start"
              >
                + Add first highlight
              </button>
            )}
            {highlights.map((h, i) => (
              <div key={i} className="flex flex-col gap-1.5 rounded-xl border border-[var(--color-border)] p-3">
                <div className="flex items-center gap-2">
                  <select
                    className="rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-xs bg-[var(--color-bg-light)] focus:outline-none flex-none"
                    value={h.type}
                    onChange={(e) => {
                      const next = [...highlights];
                      next[i] = { ...next[i], type: e.target.value as HighlightType };
                      setHighlights(next);
                    }}
                  >
                    <option value="highlight">Highlight</option>
                    <option value="pro_tip">Pro Tip</option>
                    <option value="warning">Warning</option>
                  </select>
                  <button
                    onClick={() => setHighlights((prev) => prev.filter((_, j) => j !== i))}
                    className="ml-auto text-[var(--color-text-muted)] hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <input
                  className={INPUT}
                  placeholder="이 산에서 지하철 접근성이 가장 좋습니다."
                  value={h.ko}
                  onChange={(e) => {
                    const next = [...highlights];
                    next[i] = { ...next[i], ko: e.target.value };
                    setHighlights(next);
                  }}
                />
                <input
                  className={INPUT}
                  placeholder="Best subway access on this mountain."
                  value={h.en}
                  onChange={(e) => {
                    const next = [...highlights];
                    next[i] = { ...next[i], en: e.target.value };
                    setHighlights(next);
                  }}
                />
              </div>
            ))}
          </div>

          {/* Route Description */}
          <div className="flex flex-col gap-3">
            <div>
              <p className={LABEL}>Route Description (KO)</p>
              <textarea
                className={`${INPUT} min-h-[100px] resize-y`}
                placeholder="국내 사용자를 위한 상세 경로 설명..."
                value={descriptionKo}
                onChange={(e) => setDescriptionKo(e.target.value)}
              />
            </div>
            <div>
              <p className={LABEL}>Route Description (EN)</p>
              <textarea
                className={`${INPUT} min-h-[100px] resize-y`}
                placeholder="Detailed description for foreign hikers..."
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
              />
            </div>
          </div>

          {/* Feedback */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm bg-red-50 text-red-600">
              <AlertCircle size={15} /> {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm bg-green-50 text-green-700">
              <CheckCircle size={15} /> Saved/Updated Successfully
            </div>
          )}

          <button onClick={handleSave} disabled={saving} className={BTN_PRIMARY}>
            {saving ? (
              <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Saving…</>
            ) : (
              "Save Content Changes"
            )}
          </button>
        </>
      )}
    </div>
  );
}
