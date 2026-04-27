"use client";

import { useState, useEffect, useRef } from "react";
import { Route, CheckCircle, AlertCircle, ChevronRight, RotateCcw, Upload, Pencil, Trash2, X } from "lucide-react";
import { parseTrackFile, type ParseGpxResult } from "@/lib/parseGpx";
import { buildSegmentSlug, toSlug } from "@/lib/slug";

const CARD  = "rounded-2xl bg-card border border-[var(--color-border)] p-5 flex flex-col gap-4";
const INPUT = "rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm bg-[var(--color-bg-light)] focus:outline-none focus:ring-2 focus:ring-primary/40";
const BTN_SECONDARY = "flex-1 rounded-xl border-2 border-primary text-primary py-2.5 text-sm font-semibold hover:bg-primary/5 active:bg-primary/10 transition-colors";
const BTN_PRIMARY   = "flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary text-white py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed";

type Mountain  = { id: number; slug: string; name: { en?: string; ko?: string } };
type Waypoint  = { id: number; slug?: string | null; name: { en: string; ko?: string }; type: string; ars_id?: string | null; };
type SegType   = "APPROACH" | "ASCENT" | "DESCENT" | "RETURN";
type Segment   = {
  id: number;
  segment_type: string;
  start_waypoint_id: number;
  end_waypoint_id: number;
  name?: { en?: string; ko?: string } | null;
  difficulty?: number | null;
  estimated_time_min?: number | null;
  is_bus_combined?: boolean;
  bus_details?: {
    bus_stop_id_key?: string;
    bus_numbers?: string[];
    route_color?: string;
    station_bus_stop_name?: string;
    bus_duration_min?: number;
  } | null;
};
type Phase     = "input" | "preview" | "uploading" | "done" | "error";

const SEG_TYPE_LABELS: Record<SegType, string> = {
  APPROACH: "Approach (Station → Trailhead)",
  ASCENT:   "Ascent (Trailhead → Summit)",
  DESCENT:  "Descent (Summit → Trailhead)",
  RETURN:   "Return (Trailhead → Station)",
};

const BUS_COLORS: Record<string, string> = {
  BLUE: "#0068B7",
  GREEN: "#00A84D",
  RED: "#F33535",
  YELLOW: "#FFB300",
};

const SEG_TYPE_PRIORITY: Record<string, number> = {
  APPROACH: 1,
  ASCENT: 2,
  DESCENT: 3,
  RETURN: 4,
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
  const [segments, setSegments]         = useState<Segment[]>([]);
  const [loadingSeg, setLoadingSeg]     = useState(false);
  const [editingId, setEditingId]       = useState<number | null>(null);

  const [segType, setSegType]           = useState<SegType>("ASCENT");
  const [startWpId, setStartWpId]       = useState("");
  const [endWpId, setEndWpId]           = useState("");
  const [midWpId, setMidWpId]           = useState("");
  const [estimatedMin, setEstimatedMin] = useState("");
  const [difficulty, setDifficulty]     = useState("");

  const [isBusCombined, setIsBusCombined]         = useState(false);
  const [busType, setBusType]                     = useState("GREEN");
  const [busNumber, setBusNumber]                 = useState("");
  const [stationBusStopName, setStationBusStopName] = useState("");
  const [nameEn, setNameEn]             = useState("");
  const [nameKo, setNameKo]             = useState("");
  const [busDurationMin, setBusDurationMin] = useState("");

  const [file, setFile]                 = useState<File | null>(null);
  const [busFile, setBusFile]           = useState<File | null>(null);
  const [parsed, setParsed]             = useState<ParseGpxResult | null>(null);
  const [busParsed, setBusParsed]       = useState<ParseGpxResult | null>(null);
  const [parsing, setParsing]           = useState(false);
  const [parseErr, setParseErr]         = useState("");

  const [phase, setPhase]               = useState<Phase>("input");
  const [msg, setMsg]                   = useState("");
  const [isPending, setIsPending]       = useState(false);
  const fileRef                         = useRef<HTMLInputElement>(null);
  const busFileRef                      = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/mountains").then(r => r.json())
      .then(data => { if (Array.isArray(data)) setMountains(data as Mountain[]); })
      .catch(() => {});
  }, []);

  async function handleMountainChange(mid: string) {
    setMountainId(mid);
    setWaypoints([]);
    setStartWpId(""); setEndWpId(""); setMidWpId("");
    if (!mid) return;
    setLoadingWp(true);
    try {
      const res  = await fetch(`/api/admin/waypoints?mountainId=${mid}`);
      const data = await res.json() as Waypoint[];
      if (Array.isArray(data)) setWaypoints(data);
    } catch { /* non-critical */ }
    finally { setLoadingWp(false); }

    setLoadingSeg(true);
    try {
      const res = await fetch(`/api/admin/segments?mountainId=${mid}`);
      const data = await res.json() as Segment[];
      if (Array.isArray(data)) setSegments(data);
    } catch { /* non-critical */ }
    finally { setLoadingSeg(false); }
  }

  async function handleDeleteSegment(id: number) {
    if (!confirm(`[주의] 세그먼트 #${id}번을 데이터베이스에서 영구 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 이 구간을 포함하는 모든 코스(Route)에서 데이터가 사라집니다.\n정말로 삭제하시겠습니까?`)) return;
    setIsPending(true);
    try {
      const res = await fetch(`/api/admin/segments?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setSegments(prev => prev.filter(s => s.id !== id));
      setMsg(`Segment #${id} deleted from database.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setIsPending(false);
    }
  }

  function startEdit(s: Segment) {
    setEditingId(s.id);
    setSegType(s.segment_type as SegType);
    setStartWpId(String(s.start_waypoint_id));
    setEndWpId(String(s.end_waypoint_id));
    setNameEn(s.name?.en ?? "");
    setNameKo(s.name?.ko ?? "");
    setDifficulty(s.difficulty ? String(s.difficulty) : "");
    setEstimatedMin(s.estimated_time_min ? String(s.estimated_time_min) : "");
    
    // Bus fields
    const bd = s.bus_details;
    setIsBusCombined(!!s.is_bus_combined);
    setBusNumber(bd?.bus_numbers?.[0] ?? "");
    setMidWpId(bd?.bus_stop_id_key ?? "");
    setStationBusStopName(bd?.station_bus_stop_name ?? "");
    setBusDurationMin(bd?.bus_duration_min ? String(bd.bus_duration_min) : "");
    
    // Reverse-map color to type
    const color = bd?.route_color;
    const typeEntry = Object.entries(BUS_COLORS).find(([, v]) => v === color);
    setBusType(typeEntry?.[0] ?? "BLUE");
    // Note: We don't automatically fill GPX data because we don't have the File object.
    setParsed(null);
    setFile(null);
    setPhase("input");
  }

  function reset() {
    setEditingId(null);
    setPhase("input");
    setFile(null); setParsed(null); setBusFile(null); setBusParsed(null); setParsing(false); setParseErr("");
    setStartWpId(""); setEndWpId(""); setMidWpId(""); setEstimatedMin(""); setDifficulty("");
    setIsBusCombined(false); setBusNumber(""); setStationBusStopName(""); setBusDurationMin("");
    setNameEn(""); setNameKo("");
    setMsg("");
    if (fileRef.current) fileRef.current.value = "";
    if (busFileRef.current) busFileRef.current.value = "";
  }

  async function handleFileChange(f: File | null, isBus: boolean = false) {
    if (isBus) {
      setBusFile(f);
      setBusParsed(null);
    } else {
      setFile(f);
      setParsed(null);
    }
    setParseErr("");
    if (!f) return;
    setParsing(true);
    try {
      const result = await parseTrackFile(f);
      if (isBus) setBusParsed(result);
      else setParsed(result);
    } catch (e) {
      setParseErr(e instanceof Error ? e.message : "Parse failed");
    } finally {
      setParsing(false);
    }
  }

  async function handleUpload() {
    if (!mountainId || !startWpId || !endWpId) return;
    if (isBusCombined && !midWpId) return;

    setIsPending(true);
    setPhase("uploading");
    try {
      const form = new FormData();
      if (editingId) form.append("id", String(editingId));
      else           form.append("mountainId", mountainId);

      if (isBusCombined) {
        form.append("isBusCombined",   "true");
        form.append("midWaypointId",   midWpId);
        if (busDurationMin)            form.append("busDurationMin",     busDurationMin);
      }

      form.append("segmentType",     segType);
      form.append("startWaypointId", startWpId);
      form.append("endWaypointId",   endWpId);
      if (estimatedMin)              form.append("estimatedTimeMin", estimatedMin);
      if (nameEn.trim())             form.append("nameEn",           nameEn.trim());
      if (nameKo.trim())             form.append("nameKo",           nameKo.trim());
      if (segmentSlugPreview?.slug)  form.append("slug",             segmentSlugPreview.slug);

      const res = await fetch("/api/admin/segments", { 
        method: editingId ? "PATCH" : "POST", 
        body: form 
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error);
      }
      const { id, pointCount, distance_m, total_ascent_m, total_descent_m } = await res.json() as {
        id: number; pointCount: number; distance_m: number; total_ascent_m: number; total_descent_m: number;
      };
      setMsg(editingId 
        ? `Segment #${editingId} updated.`
        : `Segment #${id} saved — ${pointCount.toLocaleString()} pts · ${(distance_m / 1000).toFixed(1)} km · +${total_ascent_m}m / -${total_descent_m}m`
      );
      // Refetch segments to update management list
      fetch(`/api/admin/segments?mountainId=${mountainId}`)
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) setSegments(data); })
        .catch(() => {});
      setPhase("done");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Upload failed");
      setPhase("error");
    } finally {
      setIsPending(false);
    }
  }

  const stepNum = phase === "input" ? 1 : phase === "preview" ? 2 : 3;
  const canPreview = !!mountainId && !!startWpId && !!endWpId && !!nameKo && !!estimatedMin &&
    (!isBusCombined || (!!midWpId && !!busDurationMin));

  const eleRange = parsed
    ? (() => { const e = parsed.points.map(p => p[2]); return `${Math.min(...e).toFixed(0)}m — ${Math.max(...e).toFixed(0)}m`; })()
    : "—";

  const waypointLabel = (id: string) => {
    const w = waypoints.find(x => String(x.id) === id);
    if (!w) return "—";
    const name = w.name.ko ? `${w.name.ko}${w.name.en ? ` (${w.name.en})` : ""}` : w.name.en;
    return `${name} [${w.type}]`;
  };

  const mountainLabel = () => {
    const m = mountains.find(x => String(x.id) === mountainId);
    if (!m) return "—";
    return m.name.ko ? `${m.name.ko}${m.name.en ? ` (${m.name.en})` : ""}` : (m.name.en ?? "—");
  };

  const busInstructionPreview = (() => {
    if (!isBusCombined || !midWpId) return "";
    const transitName = waypoints.find(x => String(x.id) === midWpId)?.name.en ?? "";
    const endName     = waypoints.find(x => String(x.id) === endWpId)?.name.en  ?? "";
    const stationName = stationBusStopName.trim() || endName;
    const nearPart    = segType === "RETURN" && stationBusStopName.trim() && endName
      ? ` (Near ${endName})` : "";
    return segType === "APPROACH"
      ? `Board at ${stationName} → Alight at ${transitName}`
      : `Board at ${transitName} → Alight at ${stationName}${nearPart}`;
  })();

  const segmentSlugPreview = (() => {
    const m   = mountains.find(x => String(x.id) === mountainId);
    const sw  = waypoints.find(x => String(x.id) === startWpId);
    const ew  = waypoints.find(x => String(x.id) === endWpId);
    if (!m || !sw || !ew) return null;
    if (!sw.slug || !ew.slug) return { slug: null, missingSlug: true };
    return { slug: buildSegmentSlug(m.slug, segType, sw.slug, ew.slug, nameEn ? toSlug(nameEn) : null), missingSlug: false };
  })();


  return (
    <div className={CARD}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#EEF5F1] flex items-center justify-center flex-shrink-0">
            <Route className="w-4 h-4 text-[#2E5E4A]" />
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-[1rem]" style={{ fontFamily: "var(--font-en)" }}>
              {editingId ? `Edit Segment #${editingId}` : "Upload Segment"}
            </span>
            {editingId && <span className="text-[10px] text-[var(--color-text-muted)] mt-[-2px]">수정 모드</span>}
          </div>
        </div>
        {(phase !== "input" || !!file || !!editingId) && (
          <button onClick={reset} className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-primary">
            <RotateCcw className="w-3.5 h-3.5" /> {editingId ? "Cancel Edit" : "Reset"}
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

          {/* Segment Names (Internal) */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--color-text-muted)]">Segment Name (KO) *</span>
              <input type="text" placeholder="e.g. 북한산성 코스" value={nameKo}
                onChange={e => setNameKo(e.target.value)} className={INPUT}
                style={{ fontFamily: "var(--font-ko)" }} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--color-text-muted)]">Segment Name (EN)</span>
              <input type="text" placeholder="e.g. Bukhansanseong Trail" value={nameEn}
                onChange={e => setNameEn(e.target.value)} className={INPUT} />
            </label>
          </div>

          {/* Segment type */}
          <div className="flex items-center justify-between">
            <label className="flex flex-col gap-1 flex-1">
              <span className="text-xs text-[var(--color-text-muted)]">Segment Type *</span>
              <select value={segType} onChange={e => {
                const t = e.target.value as SegType;
                setSegType(t);
                if (t !== "APPROACH" && t !== "RETURN") setIsBusCombined(false);
              }} className={INPUT}>
                {(Object.keys(SEG_TYPE_LABELS) as SegType[]).map(t => (
                  <option key={t} value={t}>{SEG_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </label>
            {(segType === "APPROACH" || segType === "RETURN") && (
              <label className="flex items-center gap-2 mt-7 ml-4 cursor-pointer">
                <input type="checkbox" checked={isBusCombined} onChange={e => setIsBusCombined(e.target.checked)} className="w-4 h-4 rounded text-primary focus:ring-primary/40 border-[var(--color-border)]" />
                <span className="text-sm font-medium">Add Bus Route</span>
              </label>
            )}
          </div>

          {/* Waypoint pickers */}
          <div className={`grid gap-3 ${isBusCombined ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2"}`}>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--color-text-muted)]">Start Waypoint *</span>
              <select value={startWpId} onChange={e => setStartWpId(e.target.value)}
                disabled={!mountainId || loadingWp} className={INPUT}>
                <option value="">— Select —</option>
                {waypoints.map(w => (
                  <option key={w.id} value={w.id}>
                    [{w.type}] {w.name.ko || w.name.en}
                  </option>
                ))}
              </select>
            </label>
            
            {isBusCombined && (
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--color-text-muted)]">
                  {segType === "APPROACH" ? "Bus Stop (하차) *" : "Bus Stop (승차) *"}
                </span>
                <select value={midWpId} onChange={e => setMidWpId(e.target.value)}
                  disabled={!mountainId || loadingWp} className={INPUT}>
                  <option value="">— Select —</option>
                  {waypoints.map(w => (
                    <option key={w.id} value={w.id}>
                      [{w.type}] {w.name.ko || w.name.en} {w.ars_id ? `(${w.ars_id})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--color-text-muted)]">End Waypoint *</span>
              <select value={endWpId} onChange={e => setEndWpId(e.target.value)}
                disabled={!mountainId || loadingWp} className={INPUT}>
                <option value="">— Select —</option>
                {waypoints.map(w => (
                  <option key={w.id} value={w.id}>
                    [{w.type}] {w.name.ko || w.name.en}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-3 p-3 rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-light)]">
            <label className="flex flex-col gap-1 cursor-pointer">
              <span className="text-xs font-semibold">GPS File (.gpx, .geojson) *</span>
              <input type="file" ref={fileRef} accept=".gpx,.geojson"
                onChange={e => handleFileChange(e.target.files?.[0] || null)}
                className="text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
            </label>

            {isBusCombined && (
              <label className="flex flex-col gap-1 cursor-pointer border-t border-[var(--color-border)] pt-3">
                <span className="text-xs font-semibold text-[#2E5E4A]">GPS File (.gpx, .geojson)</span>
                <input type="file" ref={busFileRef} accept=".gpx,.geojson"
                  onChange={e => handleFileChange(e.target.files?.[0] || null, true)}
                  className="text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#2E5E4A]/10 file:text-[#2E5E4A] hover:file:bg-[#2E5E4A]/20" />
              </label>
            )}
          </div>

          {/* Estimated time */}
          {!isBusCombined ? (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--color-text-muted)]">Estimated Time (min) *</span>
              <input type="number" placeholder="45" value={estimatedMin}
                onChange={e => setEstimatedMin(e.target.value)} className={INPUT} />
            </label>
          ) : (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#EEF5F1] border border-[#2E5E4A]/20">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[#2E5E4A]">Bus Riding Time (min) *</span>
                <input type="number" placeholder="20" value={busDurationMin}
                  onChange={e => setBusDurationMin(e.target.value)} className={`${INPUT} border-[#2E5E4A]/30`} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[#2E5E4A]">Walking Time (min) *</span>
                <input type="number" placeholder="25" value={estimatedMin}
                  onChange={e => setEstimatedMin(e.target.value)} className={`${INPUT} border-[#2E5E4A]/30`} />
              </label>
              <div className="col-span-2 text-[10px] text-[#2E5E4A] opacity-70">
                Total: {Number(busDurationMin || 0) + Number(estimatedMin || 0)} min
              </div>
            </div>
          )}

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

          {/* Duplicate Detection Warning */}
          {(() => {
            if (editingId) return null;
            const duplicate = segments.find(s => 
              String(s.start_waypoint_id) === startWpId && 
              String(s.end_waypoint_id) === endWpId && 
              s.segment_type === segType
            );
            if (!duplicate) return null;
            return (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex flex-col gap-2">
                <div className="flex items-start gap-2 text-amber-700 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-1">
                    <span className="font-bold">Existing Segment Found</span>
                    <span>A segment with this route already exists (ID: {duplicate.id}). 
                    To avoid errors, edit the existing one instead of creating a duplicate.</span>
                  </div>
                </div>
                <button 
                  onClick={() => startEdit(duplicate)}
                  className="text-[10px] font-bold text-amber-800 bg-amber-200/50 hover:bg-amber-200 px-2 py-1.5 rounded-lg transition-colors self-end"
                >
                  Edit Existing Segment #{duplicate.id}
                </button>
              </div>
            );
          })()}

          {(parsed || phase === "input") && !parsing && (
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Points"    value={parsed ? parsed.points.length.toLocaleString() : "—"} />
              <Stat label="Elevation" value={eleRange} />
              <Stat label="Start"     value={parsed ? `${parsed.points[0][1].toFixed(4)}, ${parsed.points[0][0].toFixed(4)}` : "—"} />
            </div>
          )}

          <button onClick={() => setPhase("preview")} disabled={!canPreview}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#2E5E4A] text-white py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
            {editingId ? "Review Changes" : "Review"} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Step 2 ── */}
      {phase === "preview" && (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)] text-sm">
            {[
              ["Mountain",      mountainLabel()],
              ["Segment Type",  SEG_TYPE_LABELS[segType]],
              ["Trail Name",     nameEn || nameKo ? `${nameEn}${nameKo ? ` (${nameKo})` : ""}` : "—"],
              ["Start Waypoint", waypointLabel(startWpId)],
              ...(isBusCombined ? [[segType === "APPROACH" ? "Bus Drop-off Stop (하차)" : "Bus Boarding Stop (승차)", waypointLabel(midWpId)]] : []),
              ["End Waypoint",   waypointLabel(endWpId)],
              ...(isBusCombined ? [["Bus Info", `${busType} - ${busNumber}`]] : []),
              ...(isBusCombined ? [["Bus Riding Time", busDurationMin ? `${busDurationMin} min` : "—"]] : []),
              ...(isBusCombined && busInstructionPreview ? [["Bus Instruction", busInstructionPreview]] : []),
              ["Slug",           segmentSlugPreview?.slug ?? "—"],
              ["Est. Time",      estimatedMin ? `${estimatedMin} min` : "—"],
              ...(segType !== "APPROACH" && segType !== "RETURN" ? [["Difficulty", difficulty || "—"]] : []),
              ["GPX Points",     parsed?.points.length.toLocaleString() ?? "(Unchanged)"],
              ["Elevation Range", parsed ? eleRange : "(Unchanged)"],
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
      {/* ── Management List ── */}
      {mountainId && !loadingSeg && segments.length > 0 && phase === "input" && (() => {
        const grouped = segments.reduce((acc, s) => {
          const wpId = s.start_waypoint_id;
          if (!acc[wpId]) acc[wpId] = [];
          acc[wpId].push(s);
          return acc;
        }, {} as Record<number, Segment[]>);

        const sortedWpIds = Object.keys(grouped)
          .map(Number)
          .sort((a, b) => {
            const getPriority = (wpId: number) => {
              const types = grouped[wpId].map(s => s.segment_type);
              return Math.min(...types.map(t => SEG_TYPE_PRIORITY[t] ?? 5));
            };
            const pa = getPriority(a);
            const pb = getPriority(b);
            if (pa !== pb) return pa - pb;
            return waypointLabel(String(a)).localeCompare(waypointLabel(String(b)));
          });

        return (
          <div className="mt-4 flex flex-col gap-2 pt-4 border-t border-[var(--color-border)]">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
              Existing Segments for {mountainLabel()}
            </div>
            <div className="flex flex-col gap-4 max-h-[400px] overflow-y-auto pr-1 text-sm">
              {sortedWpIds.map(wpId => (
                <div key={wpId} className="flex flex-col gap-2">
                  <div className="text-[10px] text-primary font-bold bg-primary/5 px-2 py-1 rounded-md border border-primary/10">
                    {waypointLabel(String(wpId))}
                  </div>
                  <div className="flex flex-col gap-1.5 pl-1">
                    {grouped[wpId]
                      .sort((a, b) => (SEG_TYPE_PRIORITY[a.segment_type] ?? 5) - (SEG_TYPE_PRIORITY[b.segment_type] ?? 5))
                      .map((s, idx) => (
                      <div key={s.id} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm transition-colors ${
                        editingId === s.id ? "border-primary bg-primary/5" : "border-[var(--color-border)] bg-[var(--color-bg-light)]"
                      }`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{s.segment_type}</span>
                            <span className="text-[10px] font-bold text-[var(--color-text-muted)]">#{idx+1}</span>
                            <span className={`font-medium truncate ${editingId === s.id ? "text-primary" : ""}`}>
                              {s.name?.en || s.name?.ko ? `${s.name.en ?? ""}${s.name.ko ? ` (${s.name.ko})` : ""}` : `Segment ${s.id}`}
                            </span>
                            <span className="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-bg-light)] px-1.5 py-0.5 rounded border border-[var(--color-border)] font-mono">
                              {s.is_bus_combined ? (
                                <>
                                  <span className="text-[#2E5E4A] font-bold">Bus {s.bus_details?.bus_duration_min || 0}m</span>
                                  <span className="mx-1">+</span>
                                  <span>Walk {s.estimated_time_min || 0}m</span>
                                </>
                              ) : (
                                `${s.estimated_time_min}m`
                              )}
                            </span>
                          </div>
                          <div className="text-[10px] text-[var(--color-text-muted)] truncate mt-0.5">
                            → {waypointLabel(String(s.end_waypoint_id))}
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => startEdit(s)}
                            disabled={isPending}
                            className="flex items-center justify-center p-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-primary hover:border-primary transition-colors disabled:opacity-30"
                            title="Edit segment metadata"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSegment(s.id)}
                            disabled={isPending}
                            className="flex items-center justify-center p-1.5 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30"
                            title="Delete permanently"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

