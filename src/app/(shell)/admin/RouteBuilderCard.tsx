"use client";

import { useState, useEffect } from "react";
import { BookOpen, CheckCircle, AlertCircle, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";

const CARD  = "rounded-2xl bg-card border border-[var(--color-border)] p-5 flex flex-col gap-4";
const INPUT = "rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm bg-[var(--color-bg-light)] focus:outline-none focus:ring-2 focus:ring-primary/40";
const BTN_SECONDARY = "flex-1 rounded-xl border-2 border-primary text-primary py-2.5 text-sm font-semibold hover:bg-primary/5 transition-colors";
const BTN_PRIMARY   = "flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary text-white py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed";

type Mountain = { id: number; name: { en?: string; ko?: string } };

type Waypoint = { id: number; name: { en: string; ko?: string }; type: string };

type Segment = {
  id: number;
  segment_type: string;
  start_waypoint_id: number;
  end_waypoint_id: number;
  distance_m?: number;
  total_ascent_m?: number;
  total_descent_m?: number;
  estimated_time_min?: number;
  difficulty?: number;
};

type Phase = "idle" | "saving" | "done" | "error";

const SEG_TYPE_COLORS: Record<string, string> = {
  APPROACH: "bg-blue-100 text-blue-700",
  ASCENT:   "bg-green-100 text-green-700",
  DESCENT:  "bg-orange-100 text-orange-700",
  RETURN:   "bg-gray-100 text-gray-600",
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
      {children}
    </p>
  );
}

export default function RouteBuilderCard() {
  const [mountains, setMountains]   = useState<Mountain[]>([]);
  const [mountainId, setMountainId] = useState("");
  const [segments, setSegments]     = useState<Segment[]>([]);
  const [waypoints, setWaypoints]   = useState<Waypoint[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [nameEn, setNameEn]         = useState("");
  const [nameKo, setNameKo]         = useState("");

  // Ordered list of selected segment IDs
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [addingId, setAddingId]       = useState("");

  const [phase, setPhase]           = useState<Phase>("idle");
  const [msg, setMsg]               = useState("");

  useEffect(() => {
    fetch("/api/admin/mountains").then(r => r.json())
      .then(data => { if (Array.isArray(data)) setMountains(data as Mountain[]); })
      .catch(() => {});
  }, []);

  async function handleMountainChange(mid: string) {
    setMountainId(mid);
    setSegments([]); setWaypoints([]);
    setSelectedIds([]); setAddingId("");
    if (!mid) return;
    setLoadingData(true);
    try {
      const [segRes, wpRes] = await Promise.all([
        fetch(`/api/admin/segments?mountainId=${mid}`).then(r => r.json()),
        fetch(`/api/admin/waypoints?mountainId=${mid}`).then(r => r.json()),
      ]);
      if (Array.isArray(segRes)) setSegments(segRes as Segment[]);
      if (Array.isArray(wpRes))  setWaypoints(wpRes  as Waypoint[]);
    } catch { /* non-critical */ }
    finally { setLoadingData(false); }
  }

  // Aggregate totals from selected segments
  const selectedSegments = selectedIds
    .map(id => segments.find(s => s.id === id))
    .filter(Boolean) as Segment[];

  const totalDurationMin = selectedSegments.reduce((acc, s) => acc + (s.estimated_time_min ?? 0), 0) || null;
  const totalDistanceM   = selectedSegments.reduce((acc, s) => acc + (s.distance_m ?? 0), 0) || null;
  const maxDifficulty    = selectedSegments.reduce((acc, s) => Math.max(acc, s.difficulty ?? 0), 0) || null;

  function addSegment() {
    const id = parseInt(addingId);
    if (!id || selectedIds.includes(id)) return;
    setSelectedIds(prev => [...prev, id]);
    setAddingId("");
  }

  function removeSegment(idx: number) {
    setSelectedIds(prev => prev.filter((_, i) => i !== idx));
  }

  function moveSegment(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    setSelectedIds(prev => {
      const arr = [...prev];
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return arr;
    });
  }

  function waypointName(id: number) {
    return waypoints.find(w => w.id === id)?.name.en ?? `WP#${id}`;
  }

  async function handleSave() {
    if (!mountainId || !nameEn || !selectedIds.length) return;
    setPhase("saving");

    try {
      const res = await fetch("/api/admin/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mountainId:     parseInt(mountainId),
          nameEn:         nameEn.trim(),
          nameKo:         nameKo.trim() || undefined,
          segmentIds:     selectedIds,
          totalDurationMin,
          totalDistanceM,
          totalDifficulty: maxDifficulty,
        }),
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error);
      }

      const { id } = await res.json() as { id: number };
      setMsg(`Route #${id} "${nameEn}" saved with ${selectedIds.length} segment${selectedIds.length !== 1 ? "s" : ""}`);
      setPhase("done");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
      setPhase("error");
    }
  }

  function reset() {
    setNameEn(""); setNameKo(""); setSelectedIds([]); setAddingId("");
    setMsg(""); setPhase("idle");
  }

  const availableToAdd = segments.filter(s => !selectedIds.includes(s.id));

  return (
    <div className={CARD}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#EEF5F1] flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-4 h-4 text-[#2E5E4A]" />
        </div>
        <span className="font-medium text-[1rem]" style={{ fontFamily: "var(--font-en)" }}>Build Route</span>
      </div>

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

      {loadingData && <Alert type="loading" message="Loading segments…" />}

      {mountainId && !loadingData && (
        <>
          {/* Route name */}
          <div className="flex flex-col gap-3">
            <SectionLabel>Route Name</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--color-text-muted)]">Name (EN) *</span>
                <input type="text" placeholder="Bukhansan Classic Loop" value={nameEn}
                  onChange={e => setNameEn(e.target.value)} className={INPUT} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--color-text-muted)]">Name (KO)</span>
                <input type="text" placeholder="북한산 클래식 루프" value={nameKo}
                  onChange={e => setNameKo(e.target.value)} className={INPUT}
                  style={{ fontFamily: "var(--font-ko)" }} />
              </label>
            </div>
          </div>

          {/* Segment ordering */}
          <div className="flex flex-col gap-3">
            <SectionLabel>Segments (in order)</SectionLabel>

            {selectedSegments.length > 0 && (
              <div className="flex flex-col gap-2">
                {selectedSegments.map((seg, i) => (
                  <div key={seg.id} className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2.5 bg-[var(--color-bg-light)]">
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button type="button" onClick={() => moveSegment(i, -1)} disabled={i === 0}
                        className="p-0.5 rounded disabled:opacity-30 hover:text-primary transition-colors">
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => moveSegment(i, 1)} disabled={i === selectedSegments.length - 1}
                        className="p-0.5 rounded disabled:opacity-30 hover:text-primary transition-colors">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SEG_TYPE_COLORS[seg.segment_type] ?? "bg-gray-100 text-gray-600"}`}>
                          {seg.segment_type}
                        </span>
                        <span className="text-xs font-medium text-[var(--color-text-muted)]">#{seg.id}</span>
                        <span className="text-xs truncate">
                          {waypointName(seg.start_waypoint_id)} → {waypointName(seg.end_waypoint_id)}
                        </span>
                      </div>
                      <div className="text-[10px] text-[var(--color-text-muted)] font-mono mt-0.5">
                        {seg.distance_m       ? `${(seg.distance_m / 1000).toFixed(1)}km · ` : ""}
                        {seg.estimated_time_min ? `${seg.estimated_time_min}min` : ""}
                        {seg.total_ascent_m   ? ` · +${seg.total_ascent_m}m` : ""}
                      </div>
                    </div>

                    <button onClick={() => removeSegment(i)}
                      className="flex items-center rounded-lg border border-red-200 text-red-500 px-2 py-1 text-xs hover:bg-red-50 transition-colors flex-shrink-0">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add segment */}
            {availableToAdd.length > 0 && (
              <div className="flex gap-2">
                <select value={addingId} onChange={e => setAddingId(e.target.value)}
                  className={`${INPUT} flex-1`}>
                  <option value="">— Add segment —</option>
                  {availableToAdd.map(s => (
                    <option key={s.id} value={s.id}>
                      [{s.segment_type}] #{s.id} — {waypointName(s.start_waypoint_id)} → {waypointName(s.end_waypoint_id)}
                    </option>
                  ))}
                </select>
                <button onClick={addSegment} disabled={!addingId} className={`${BTN_PRIMARY} flex-none px-4 py-2`}>
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}

            {segments.length === 0 && (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-2">
                No segments for this mountain yet. Upload a GPX segment first.
              </p>
            )}
          </div>

          {/* Computed totals */}
          {selectedSegments.length > 0 && (
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Duration", totalDurationMin ? `${totalDurationMin} min` : "—"],
                ["Distance", totalDistanceM   ? `${(totalDistanceM / 1000).toFixed(1)} km` : "—"],
                ["Difficulty", maxDifficulty  ? String(maxDifficulty) : "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5 rounded-xl bg-[var(--color-bg-light)] px-3 py-2">
                  <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">{label}</span>
                  <span className="text-sm font-semibold font-mono">{value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          {phase === "idle" && (
            <div className="flex gap-2">
              <button onClick={reset} className={BTN_SECONDARY}>Clear</button>
              <button onClick={handleSave}
                disabled={!nameEn || !selectedIds.length}
                className={BTN_PRIMARY}>
                <CheckCircle className="w-4 h-4" /> Save Route
              </button>
            </div>
          )}
        </>
      )}

      {(phase === "saving" || phase === "done" || phase === "error") && (
        <div className="flex flex-col gap-3">
          <Alert
            type={phase === "saving" ? "loading" : phase === "done" ? "success" : "error"}
            message={phase === "saving" ? "Saving route…" : msg}
          />
          {(phase === "done" || phase === "error") && (
            <button onClick={reset} className={`${BTN_SECONDARY} flex-none w-full`}>
              {phase === "done" ? "Build Another Route" : "Back"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
