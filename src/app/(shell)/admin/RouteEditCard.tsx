"use client";

import { useState } from "react";
import { CheckCircle, AlertCircle, Trash2, ChevronDown } from "lucide-react";

const INPUT     = "rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm bg-[var(--color-bg-light)] focus:outline-none focus:ring-2 focus:ring-primary/40 w-full";
const LABEL     = "text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]";
const CARD      = "rounded-2xl bg-white border border-[var(--color-border)] p-5 flex flex-col gap-4";
const BTN_PRIMARY = "flex items-center justify-center gap-2 rounded-xl bg-primary text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed";

type Mountain = { id: number; name: { en?: string; ko?: string } };
type RouteRow  = {
  id: number;
  name: { en?: string; ko?: string };
  tags?: { en: string; ko: string }[];
  highlights?: { type: "highlight" | "pro_tip" | "warning"; text: { en: string; ko: string } }[];
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

  const [tags,       setTags]       = useState<TagItem[]>([]);
  const [highlights, setHighlights] = useState<HighlightItem[]>([]);

  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState("");

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
    setTags([]);
    setHighlights([]);
  }

  function selectRoute(id: number) {
    const route = routes.find((r) => r.id === id);
    if (!route) return;
    setRouteId(id);
    setTags(route.tags ?? [{ en: "", ko: "" }]);
    setHighlights(
      (route.highlights ?? [{ type: "highlight", text: { en: "", ko: "" } }]).map((h) => ({
        type: h.type,
        en:   h.text.en,
        ko:   h.text.ko,
      })),
    );
    setSuccess(false);
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

  return (
    <div className={CARD}>
      {/* Header */}
      <div>
        <p className="text-sm font-semibold text-[var(--color-text-body)]">Edit Route — Tags & Highlights</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Select a route to update its hashtags and highlight bullets.</p>
      </div>

      {/* Mountain select */}
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
          <option value="">— select mountain —</option>
          {mountains.map((m) => (
            <option key={m.id} value={m.id}>{m.name.en ?? m.name.ko}</option>
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
            <option value="">— select route —</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>{r.name.en ?? r.name.ko}</option>
            ))}
          </select>
        </div>
      )}

      {/* Edit fields — shown only after route is selected */}
      {routeId && (
        <>
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
                  placeholder="Subway Access"
                  value={tag.en}
                  onChange={(e) => {
                    const next = [...tags];
                    next[i] = { ...next[i], en: e.target.value };
                    setTags(next);
                  }}
                />
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
                  placeholder="Best subway access on this mountain."
                  value={h.en}
                  onChange={(e) => {
                    const next = [...highlights];
                    next[i] = { ...next[i], en: e.target.value };
                    setHighlights(next);
                  }}
                />
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
              </div>
            ))}
          </div>

          {/* Feedback */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm bg-red-50 text-red-600">
              <AlertCircle size={15} /> {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm bg-green-50 text-green-700">
              <CheckCircle size={15} /> Saved
            </div>
          )}

          <button onClick={handleSave} disabled={saving} className={BTN_PRIMARY}>
            {saving ? (
              <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Saving…</>
            ) : (
              "Save Changes"
            )}
          </button>
        </>
      )}
    </div>
  );
}
