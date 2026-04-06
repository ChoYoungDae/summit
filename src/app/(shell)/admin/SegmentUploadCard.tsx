"use client";

import { useState, useEffect, useRef } from "react";
import { Route, CheckCircle, AlertCircle, ChevronRight, RotateCcw, Upload } from "lucide-react";
import { parseTrackFile, type ParseGpxResult } from "@/lib/parseGpx";
import { buildSegmentSlug } from "@/lib/slug";

const CARD  = "rounded-2xl bg-card border border-[var(--color-border)] p-5 flex flex-col gap-4";
const INPUT = "rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm bg-[var(--color-bg-light)] focus:outline-none focus:ring-2 focus:ring-primary/40";
const BTN_SECONDARY = "flex-1 rounded-xl border-2 border-primary text-primary py-2.5 text-sm font-semibold hover:bg-primary/5 active:bg-primary/10 transition-colors";
const BTN_PRIMARY   = "flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary text-white py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed";

type Mountain  = { id: number; slug: string; name: { en?: string; ko?: string } };
type Waypoint  = { id: number; slug?: string | null; name: { en: string; ko?: string }; type: string };
type SegType   = "APPROACH" | "ASCENT" | "DESCENT" | "RETURN";
type Phase     = "input" | "preview" | "uploading" | "done" | "error";

const SEG_TYPE_LABELS: Record<SegType, string> = {
  APPROACH: "Approach (Station → Trailhead)",
  ASCENT:   "Ascent (Trailhead → Summit)",
  DESCENT:  "Descent (Summit → Trailhead)",
  RETURN:   "Return (Trailhead → Station)",
};

function Alert({ type, message }: { type: "success" | "error" | "loading"; message: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
      type === "success" ? "bg-[#EEF5F1] text-[#2E5E4A]"
      : type === "error" ? "bg-red-50 text-red-700"
                         : "bg-[var(--color-bg-light)] text-[var(--color-text-muted)]"
    }`}>
      {type === "success" && <CheckCircle className="w-4 h-4 flex-shrink-0" />}
      {type === "error"   && <AlertCircle  className="w-4 h-4 flex-shrink-0" />}
      {type === "loading" && <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin flex-shrink-0" />}
      <span>{message}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-[var(--color-bg-light)] px-3 py-2">
      <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">{label}</span>
      <span className="text-sm font-semibold font-mono">{value}</span>
    </div>
  );
}

function Steps({ current, labels }: { current: number; labels: string[] }) {
  return (
    <ol className="flex items-center gap-0">
      {labels.map((label, i) => {
        const n      = i + 1;
        const done   = n < current;
        const active = n === current;
        return (
          <li key={n} className="flex items-center">
            <div className="flex flex-col items-center gap-0.5">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                done    ? "bg-[#2E5E4A] text-white"
                : active ? "bg-primary text-white"
                         : "bg-[var(--color-border)] text-[var(--color-text-muted)]"
              }`}>
                {done ? <CheckCircle className="w-3.5 h-3.5" /> : n}
              </span>
              <span className={`text-[10px] whitespace-nowrap ${active ? "text-primary font-semibold" : "text-[var(--color-text-muted)]"}`}>
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div className={`h-px w-8 mx-1 mb-3.5 transition-colors ${done ? "bg-[#2E5E4A]" : "bg-[var(--color-border)]"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function SegmentUploadCard() {
  const [mountains, setMountains]       = useState<Mountain[]>([]);
  const [mountainId, setMountainId]     = useState("");
  const [waypoints, setWaypoints]       = useState<Waypoint[]>([]);
  const [loadingWp, setLoadingWp]       = useState(false);

  const [segType, setSegType]           = useState<SegType>("ASCENT");
  const [startWpId, setStartWpId]       = useState("");
  const [endWpId, setEndWpId]           = useState("");
  const [estimatedMin, setEstimatedMin] = useState("");
  const [difficulty, setDifficulty]     = useState("");

  const [file, setFile]                 = useState<File | null>(null);
  const [parsed, setParsed]             = useState<ParseGpxResult | null>(null);
  const [parsing, setParsing]           = useState(false);
  const [parseErr, setParseErr]         = useState("");

  const [phase, setPhase]               = useState<Phase>("input");
  const [msg, setMsg]                   = useState("");
  const [isPending, setIsPending]       = useState(false);
  const fileRef                         = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/mountains").then(r => r.json())
      .then(data => { if (Array.isArray(data)) setMountains(data as Mountain[]); })
      .catch(() => {});
  }, []);

  async function handleMountainChange(mid: string) {
    setMountainId(mid);
    setWaypoints([]);
    setStartWpId(""); setEndWpId("");
    if (!mid) return;
    setLoadingWp(true);
    try {
      const res  = await fetch(`/api/admin/waypoints?mountainId=${mid}`);
      const data = await res.json() as Waypoint[];
      if (Array.isArray(data)) setWaypoints(data);
    } catch { /* non-critical */ }
    finally { setLoadingWp(false); }
  }

  async function handleFileChange(f: File | null) {
    setFile(f);
    setParsed(null);
    setParseErr("");
    if (!f) return;
    setParsing(true);
    try {
      const result = await parseTrackFile(f);
      setParsed(result);
    } catch (e) {
      setParseErr(e instanceof Error ? e.message : "Parse failed");
    } finally {
      setParsing(false);
    }
  }

  async function handleUpload() {
    if (!file || !parsed || !mountainId || !startWpId || !endWpId) return;
    setIsPending(true);
    setPhase("uploading");
    try {
      const form = new FormData();
      form.append("gpx",             file);
      form.append("mountainId",      mountainId);
      form.append("segmentType",     segType);
      form.append("startWaypointId", startWpId);
      form.append("endWaypointId",   endWpId);
      if (estimatedMin)              form.append("estimatedTimeMin", estimatedMin);
      if (difficulty)                form.append("difficulty",       difficulty);
      if (segmentSlugPreview?.slug)  form.append("slug",             segmentSlugPreview.slug);

      const res = await fetch("/api/admin/segments", { method: "POST", body: form });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error);
      }
      const { id, pointCount, distance_m, total_ascent_m, total_descent_m } = await res.json() as {
        id: number; pointCount: number; distance_m: number; total_ascent_m: number; total_descent_m: number;
      };
      setMsg(`Segment #${id} saved — ${pointCount.toLocaleString()} pts · ${(distance_m / 1000).toFixed(1)} km · +${total_ascent_m}m / -${total_descent_m}m`);
      setPhase("done");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Upload failed");
      setPhase("error");
    } finally {
      setIsPending(false);
    }
  }

  function reset() {
    setPhase("input");
    setFile(null); setParsed(null); setParsing(false); setParseErr("");
    setStartWpId(""); setEndWpId(""); setEstimatedMin(""); setDifficulty("");
    setMsg("");
    if (fileRef.current) fileRef.current.value = "";
  }

  const stepNum = phase === "input" ? 1 : phase === "preview" ? 2 : 3;
  const canPreview = !!parsed && !!mountainId && !!startWpId && !!endWpId;

  const eleRange = parsed
    ? (() => { const e = parsed.points.map(p => p[2]); return `${Math.min(...e).toFixed(0)}m — ${Math.max(...e).toFixed(0)}m`; })()
    : "";

  const waypointLabel = (id: string) => {
    const w = waypoints.find(x => String(x.id) === id);
    if (!w) return "—";
    return `${w.name.en}${w.name.ko ? ` (${w.name.ko})` : ""} [${w.type}]`;
  };

  const mountainLabel = () => {
    const m = mountains.find(x => String(x.id) === mountainId);
    if (!m) return "—";
    return `${m.name.en ?? ""}${m.name.ko ? ` (${m.name.ko})` : ""}`;
  };

  const segmentSlugPreview = (() => {
    const m   = mountains.find(x => String(x.id) === mountainId);
    const sw  = waypoints.find(x => String(x.id) === startWpId);
    const ew  = waypoints.find(x => String(x.id) === endWpId);
    if (!m || !sw || !ew) return null;
    if (!sw.slug || !ew.slug) return { slug: null, missingSlug: true };
    return { slug: buildSegmentSlug(m.slug, segType, sw.slug, ew.slug), missingSlug: false };
  })();

  return (
    <div className={CARD}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#EEF5F1] flex items-center justify-center flex-shrink-0">
            <Route className="w-4 h-4 text-[#2E5E4A]" />
          </div>
          <span className="font-medium text-[1rem]" style={{ fontFamily: "var(--font-en)" }}>Upload Segment</span>
        </div>
        {(phase !== "input" || !!file) && (
          <button onClick={reset} className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-primary">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        )}
      </div>

      <Steps current={stepNum} labels={["Configure", "Preview", "Upload"]} />

      {/* ── Step 1 ── */}
      {phase === "input" && (
        <div className="flex flex-col gap-3">
          {/* Mountain */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[var(--color-text-muted)]">Mountain *</span>
            <select value={mountainId} onChange={e => handleMountainChange(e.target.value)} className={INPUT}>
              <option value="">— Select mountain —</option>
              {mountains.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name.en}{m.name.ko ? ` (${m.name.ko})` : ""}
                </option>
              ))}
            </select>
          </label>

          {/* Segment type */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[var(--color-text-muted)]">Segment Type *</span>
            <select value={segType} onChange={e => {
              const t = e.target.value as SegType;
              setSegType(t);
              if (t === "APPROACH" || t === "RETURN") setDifficulty("");
            }} className={INPUT}>
              {(Object.keys(SEG_TYPE_LABELS) as SegType[]).map(t => (
                <option key={t} value={t}>{SEG_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </label>

          {/* Waypoint pickers */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--color-text-muted)]">Start Waypoint *</span>
              <select value={startWpId} onChange={e => setStartWpId(e.target.value)}
                disabled={!mountainId || loadingWp} className={INPUT}>
                <option value="">— Select —</option>
                {waypoints.map(w => (
                  <option key={w.id} value={w.id}>
                    [{w.type}] {w.name.en}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--color-text-muted)]">End Waypoint *</span>
              <select value={endWpId} onChange={e => setEndWpId(e.target.value)}
                disabled={!mountainId || loadingWp} className={INPUT}>
                <option value="">— Select —</option>
                {waypoints.map(w => (
                  <option key={w.id} value={w.id}>
                    [{w.type}] {w.name.en}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Optional fields */}
          <div className={`grid gap-3 ${segType === "APPROACH" || segType === "RETURN" ? "grid-cols-1" : "grid-cols-2"}`}>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--color-text-muted)]">Est. Time (min)</span>
              <input type="number" placeholder="45" value={estimatedMin}
                onChange={e => setEstimatedMin(e.target.value)} className={INPUT} />
            </label>
            {segType !== "APPROACH" && segType !== "RETURN" && (
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--color-text-muted)]">Difficulty (1–5)</span>
                <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className={INPUT}>
                  <option value="">—</option>
                  <option value="1">1 — Easy</option>
                  <option value="2">2 — Novice</option>
                  <option value="3">3 — Intermediate</option>
                  <option value="4">4 — Advanced</option>
                  <option value="5">5 — Expert</option>
                </select>
              </label>
            )}
          </div>

          {/* Track file */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[var(--color-text-muted)]">Track File (GPX or GeoJSON) *</span>
            <input ref={fileRef} type="file" accept=".gpx,.geojson"
              onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
              className="text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-primary file:text-white file:text-xs file:cursor-pointer" />
          </label>

          {/* Segment slug preview */}
          {segmentSlugPreview && (
            <div className={`rounded-xl px-3 py-2.5 text-xs ${
              segmentSlugPreview.missingSlug
                ? "bg-amber-50 text-amber-700"
                : "bg-[#EEF5F1] text-[#2E5E4A]"
            }`}>
              <div className="text-[10px] uppercase tracking-wide mb-1 opacity-60">Final Segment Slug</div>
              {segmentSlugPreview.missingSlug
                ? "⚠ One or more waypoints have no slug — edit them in Manage Waypoints first."
                : <span className="font-mono font-semibold">{segmentSlugPreview.slug}</span>
              }
            </div>
          )}

          {parsing  && <Alert type="loading" message="Parsing…" />}
          {parseErr && <Alert type="error" message={parseErr} />}

          {parsed && !parsing && (
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Points"    value={parsed.points.length.toLocaleString()} />
              <Stat label="Elevation" value={eleRange} />
              <Stat label="Start"     value={`${parsed.points[0][1].toFixed(4)}, ${parsed.points[0][0].toFixed(4)}`} />
            </div>
          )}

          <button onClick={() => setPhase("preview")} disabled={!canPreview}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#2E5E4A] text-white py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
            Review <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Step 2 ── */}
      {phase === "preview" && parsed && (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)] text-sm">
            {[
              ["Mountain",      mountainLabel()],
              ["Segment Type",  SEG_TYPE_LABELS[segType]],
              ["Start Waypoint", waypointLabel(startWpId)],
              ["End Waypoint",   waypointLabel(endWpId)],
              ["Slug",           segmentSlugPreview?.slug ?? "—"],
              ["Est. Time",      estimatedMin ? `${estimatedMin} min` : "—"],
              ...(segType !== "APPROACH" && segType !== "RETURN" ? [["Difficulty", difficulty || "—"]] : []),
              ["GPX Points",     parsed.points.length.toLocaleString()],
              ["Elevation Range", eleRange],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between px-3 py-2">
                <span className="text-[var(--color-text-muted)]">{k}</span>
                <span className="font-medium font-mono text-right">{v}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={() => setPhase("input")} className={BTN_SECONDARY}>Back</button>
            <button onClick={handleUpload} disabled={isPending} className={BTN_PRIMARY}>
              <Upload className="w-4 h-4" /> Save Segment
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3 ── */}
      {(phase === "uploading" || phase === "done" || phase === "error") && (
        <div className="flex flex-col gap-3">
          <Alert
            type={phase === "uploading" ? "loading" : phase === "done" ? "success" : "error"}
            message={phase === "uploading" ? "Saving to database…" : msg}
          />
          {phase === "error" && (
            <button onClick={() => setPhase("preview")} className={`${BTN_SECONDARY} flex-none w-full`}>Back</button>
          )}
          {phase === "done" && (
            <button onClick={reset}
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-[#2E5E4A] text-[#2E5E4A] py-2.5 text-sm font-semibold hover:bg-[#EEF5F1] transition-colors">
              <RotateCcw className="w-4 h-4" /> Add Another Segment
            </button>
          )}
        </div>
      )}
    </div>
  );
}
