"use client";

import { useState, useEffect } from "react";
import { BookOpen, CheckCircle, AlertCircle, Plus, Trash2, ChevronUp, ChevronDown, Pencil, X } from "lucide-react";
import { tDB, type SupportedLocale } from "@/lib/i18n";

const CARD  = "rounded-2xl bg-card border border-[var(--color-border)] p-5 flex flex-col gap-4";
const INPUT = "rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm bg-[var(--color-bg-light)] focus:outline-none focus:ring-2 focus:ring-primary/40";
const BTN_SECONDARY = "flex-1 rounded-xl border-2 border-primary text-primary py-2.5 text-sm font-semibold hover:bg-primary/5 transition-colors";
const BTN_PRIMARY   = "flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary text-white py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed";

type Mountain = { id: number; name: { en?: string; ko?: string } };

type Waypoint = { id: number; name: { en: string; ko?: string }; type: string };

const BUS_COLORS: Record<string, string> = {
  BLUE: "#0068B7", GREEN: "#00A84D", RED: "#F33535", YELLOW: "#FFB300",
};

const SEG_TYPE_PRIORITY: Record<string, number> = {
  APPROACH: 1,
  ASCENT: 2,
  DESCENT: 3,
  RETURN: 4,
};

type BusDetails = {
  bus_stop_id_key?: string;
  bus_numbers?: string[];
  route_color?: string;
  bus_track_data?: unknown;
  bus_duration_min?: number;
};

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
  is_bus_combined?: boolean;
  bus_details?: BusDetails | null;
  name?: { en?: string; ko?: string } | null;
};

type Route = {
  id: number;
  name: { en?: string; ko?: string };
  segment_ids: number[];
  total_duration_min?: number | null;
  total_distance_m?: number | null;
  total_difficulty?: number | null;
  is_oneway?: boolean | null;
  hide_safe_start?: boolean | null;
};

type Phase = "idle" | "saving" | "done" | "error" | "deleting";

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
  const [routes, setRoutes]         = useState<Route[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [locale, setLocale]         = useState<SupportedLocale>("ko");

  const [nameEn, setNameEn]         = useState("");
  const [nameKo, setNameKo]         = useState("");

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [addingId, setAddingId]       = useState("");

  // null = create mode, number = edit mode
  const [editingRouteId, setEditingRouteId] = useState<number | null>(null);

  const [phase, setPhase]           = useState<Phase>("idle");
  const [msg, setMsg]               = useState("");
  const [isOneway, setIsOneway]     = useState(false);
  const [hideSafeStart, setHideSafeStart] = useState(false);

  useEffect(() => {
    fetch("/api/admin/mountains").then(r => r.json())
      .then(data => { if (Array.isArray(data)) setMountains(data as Mountain[]); })
      .catch(() => {});
  }, []);

  async function handleMountainChange(mid: string) {
    setMountainId(mid);
    setSegments([]); setWaypoints([]); setRoutes([]);
    setSelectedIds([]); setAddingId("");
    setEditingRouteId(null);
    setNameEn(""); setNameKo("");
    setIsOneway(false);
    setPhase("idle"); setMsg("");
    if (!mid) return;
    setLoadingData(true);
    try {
      const [segRes, wpRes, routeRes] = await Promise.all([
        fetch(`/api/admin/segments?mountainId=${mid}`).then(r => r.json()),
        fetch(`/api/admin/waypoints?mountainId=${mid}`).then(r => r.json()),
        fetch(`/api/admin/routes?mountainId=${mid}`).then(r => r.json()),
      ]);
      if (Array.isArray(segRes))   setSegments(segRes   as Segment[]);
      if (Array.isArray(wpRes))    setWaypoints(wpRes   as Waypoint[]);
      if (Array.isArray(routeRes)) setRoutes(routeRes   as Route[]);
    } catch { /* non-critical */ }
    finally { setLoadingData(false); }
  }

  function loadRouteForEdit(route: Route) {
    setEditingRouteId(route.id);
    setNameEn(route.name.en ?? "");
    setNameKo(route.name.ko ?? "");
    setSelectedIds(route.segment_ids ?? []);
    setIsOneway(!!route.is_oneway);
    setHideSafeStart(!!route.hide_safe_start);
    setAddingId("");
    setPhase("idle");
    setMsg("");
  }

  async function handleDelete(route: Route) {
    if (!confirm(`Delete route "${route.name.en ?? route.id}"? This cannot be undone.`)) return;
    setPhase("deleting");
    try {
      const res = await fetch(`/api/admin/routes?id=${route.id}`, { method: "DELETE" });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error);
      }
      setRoutes(prev => prev.filter(r => r.id !== route.id));
      if (editingRouteId === route.id) reset();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Delete failed");
      setPhase("error");
      return;
    }
    setPhase("idle");
  }

  // Aggregate totals from selected segments
  const selectedSegments = selectedIds
    .map(id => segments.find(s => s.id === id))
    .filter(Boolean) as Segment[];

  const totalDurationMin = selectedSegments.reduce((acc, s) => {
    const walk = s.estimated_time_min ?? 0;
    // user explicitly requested to exclude bus duration from total
    return acc + walk;
  }, 0) || null;
  const totalDistanceM   = selectedSegments.reduce((acc, s) => acc + (s.distance_m ?? 0), 0) || null;
  const maxDifficulty    = selectedSegments.reduce((acc, s) => Math.max(acc, s.difficulty ?? 0), 0) || null;

  function addSegment() {
    const id = parseInt(addingId);
    if (!id || selectedIds.includes(id)) return;
    setSelectedIds(prev => [...prev, id]);
    setAddingId("");
    // Reset phase so "Update Route" button reappears
    setPhase("idle");
    setMsg("");
  }

  function removeSegment(idx: number) {
    setSelectedIds(prev => prev.filter((_, i) => i !== idx));
    setPhase("idle");
    setMsg("");
  }

  function moveSegment(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    setSelectedIds(prev => {
      const arr = [...prev];
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return arr;
    });
    setPhase("idle");
    setMsg("");
  }

  function waypointName(id: number) {
    const w = waypoints.find(w => w.id === id);
    if (!w) return `WP#${id}`;
    return w.name.ko ? `${w.name.ko}${w.name.en ? ` (${w.name.en})` : ""}` : w.name.en;
  }

  function segmentName(s: Segment): string | null {
    if (!s.name) return null;
    const name = s.name as { en?: string; ko?: string };
    return name.ko ? `${name.ko}${name.en ? ` (${name.en})` : ""}` : (name.en || null);
  }

  async function handleSave() {
    const en = nameEn.trim();
    const ko = nameKo.trim();
    if (!mountainId || !en || !selectedIds.length) return;
    setPhase("saving");

    try {
      const isEdit = editingRouteId !== null;
      const res = await fetch("/api/admin/routes", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit
          ? {
              id:              editingRouteId,
              nameEn:          en,
              nameKo:          ko || en,
              segmentIds:      selectedIds,
              isOneway,
              hideSafeStart,
              totalDurationMin,
              totalDistanceM,
              totalDifficulty: maxDifficulty,
            }
          : {
              mountainId:      parseInt(mountainId),
              nameEn:          en,
              nameKo:          ko || en,
              segmentIds:      selectedIds,
              isOneway,
              hideSafeStart,
              totalDurationMin,
              totalDistanceM,
              totalDifficulty: maxDifficulty,
            }
        ),
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error);
      }

      if (isEdit) {
        setRoutes(prev => prev.map(r => r.id === editingRouteId
          ? { ...r, name: { en, ko: ko || en }, segment_ids: selectedIds, is_oneway: isOneway, hide_safe_start: hideSafeStart }
          : r
        ));
        setMsg(`Route #${editingRouteId} "${en}" updated`);
      } else {
        const { id } = await res.json() as { id: number };
        setRoutes(prev => [...prev, {
          id,
          name: { en, ko: ko || en },
          segment_ids: selectedIds,
          is_oneway: isOneway,
          hide_safe_start: hideSafeStart,
          total_duration_min: totalDurationMin,
          total_distance_m: totalDistanceM,
          total_difficulty: maxDifficulty,
        }]);
        setMsg(`Route #${id} "${en}" saved with ${selectedIds.length} segment${selectedIds.length !== 1 ? "s" : ""}`);
      }
      setPhase("done");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
      setPhase("error");
    }
  }

  function reset() {
    setNameEn(""); setNameKo(""); setSelectedIds([]); setAddingId("");
    setIsOneway(false);
    setHideSafeStart(false);
    setMsg(""); setPhase("idle"); setEditingRouteId(null);
  }

  // ── Segment inline edit ──────────────────────────────────────────────────
  const [editingSegId, setEditingSegId] = useState<number | null>(null);
  const [segEditType, setSegEditType]   = useState("");
  const [segEditStartWp, setSegEditStartWp] = useState("");
  const [segEditEndWp, setSegEditEndWp]     = useState("");
  const [segEditTime, setSegEditTime]   = useState("");
  const [segEditDiff, setSegEditDiff]   = useState("");
  const [segEditGpx, setSegEditGpx]         = useState<File | null>(null);
  const [segEditIsBus, setSegEditIsBus]     = useState(false);
  const [segEditBusType, setSegEditBusType] = useState("GREEN");
  const [segEditBusNumber, setSegEditBusNumber] = useState("");
  const [segEditMidWp, setSegEditMidWp]     = useState("");
  const [segEditNameEn, setSegEditNameEn]   = useState("");
  const [segEditNameKo, setSegEditNameKo]   = useState("");
  const [segEditBusGpx, setSegEditBusGpx]   = useState<File | null>(null);
  const [segEditBusDurationMin, setSegEditBusDurationMin] = useState("");
  const [segSaving, setSegSaving]           = useState(false);

  function openSegEdit(seg: Segment) {
    setEditingSegId(seg.id);
    setSegEditType(seg.segment_type);
    setSegEditStartWp(String(seg.start_waypoint_id));
    setSegEditEndWp(String(seg.end_waypoint_id));
    setSegEditNameEn(seg.name?.en ?? "");
    setSegEditNameKo(seg.name?.ko ?? "");
    setSegEditTime(seg.estimated_time_min != null ? String(seg.estimated_time_min) : "");
    setSegEditDiff(seg.difficulty != null ? String(seg.difficulty) : "");
    setSegEditGpx(null);
    // Bus fields
    const bd = seg.bus_details;
    setSegEditIsBus(seg.is_bus_combined ?? false);
    setSegEditBusNumber(bd?.bus_numbers?.[0] ?? "");
    setSegEditMidWp(bd?.bus_stop_id_key ?? "");
    setSegEditBusDurationMin(bd?.bus_duration_min != null ? String(bd.bus_duration_min) : "");
    setSegEditBusGpx(null);
    // Reverse-map color → type
    const colorEntry = Object.entries(BUS_COLORS).find(([, v]) => v === bd?.route_color);
    setSegEditBusType(colorEntry?.[0] ?? "GREEN");
  }

  function closeSegEdit() {
    setEditingSegId(null);
    setSegEditGpx(null);
    setSegEditBusGpx(null);
  }

  async function saveSegEdit(segId: number) {
    setSegSaving(true);
    try {
      const fd = new FormData();
      fd.append("id",              String(segId));
      fd.append("segmentType",     segEditType);
      fd.append("startWaypointId", segEditStartWp);
      fd.append("endWaypointId",   segEditEndWp);
      fd.append("estimatedTimeMin", segEditTime);
      fd.append("difficulty",       segEditDiff);
      if (segEditGpx) fd.append("gpx", segEditGpx);
      fd.append("nameEn", segEditNameEn);
      fd.append("nameKo", segEditNameKo);

      const isBusApplicable = segEditType === "APPROACH" || segEditType === "RETURN";
      fd.append("isBusCombined", String(isBusApplicable && segEditIsBus));
      if (isBusApplicable && segEditIsBus) {
        fd.append("midWaypointId", segEditMidWp);
        fd.append("busType",       segEditBusType);
        fd.append("busNumber",     segEditBusNumber);
        fd.append("busColor",      BUS_COLORS[segEditBusType] ?? "#00A84D");
        if (segEditBusDurationMin) fd.append("busDurationMin", segEditBusDurationMin);
        if (segEditBusGpx) fd.append("busGpx", segEditBusGpx);
      }

      const res = await fetch("/api/admin/segments", { method: "PATCH", body: fd });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error);
      }
      
      // Force re-fetch all segments for this mountain to ensure total accuracy
      const segRes = await fetch(`/api/admin/segments?mountainId=${mountainId}`);
      const latestSegments = await segRes.json();
      if (Array.isArray(latestSegments)) {
        setSegments(latestSegments);
      }
      
      setEditingSegId(null);
      setSegEditGpx(null);
      setSegEditBusGpx(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSegSaving(false);
    }
  }

  // ────────────────────────────────────────────────────────────────────────

  const availableToAdd = segments.filter(s => !selectedIds.includes(s.id));
  
  // Group available segments by start waypoint
  const availableGroups = availableToAdd.reduce((acc, s) => {
    const wpId = s.start_waypoint_id;
    if (!acc[wpId]) acc[wpId] = [];
    acc[wpId].push(s);
    return acc;
  }, {} as Record<number, Segment[]>);

  // Sort waypoint IDs by their localized name
  const sortedWpIds = Object.keys(availableGroups)
    .map(Number)
    .sort((a, b) => {
      const getPriority = (wpId: number) => {
        const types = availableGroups[wpId].map(s => s.segment_type);
        return Math.min(...types.map(t => SEG_TYPE_PRIORITY[t] ?? 5));
      };
      const pa = getPriority(a);
      const pb = getPriority(b);
      if (pa !== pb) return pa - pb;
      return waypointName(a).localeCompare(waypointName(b));
    });

  const isEditMode = editingRouteId !== null;

  return (
    <div className={CARD}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#EEF5F1] flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-4 h-4 text-[#2E5E4A]" />
        </div>
        <span className="font-medium text-[1rem]" style={{ fontFamily: "var(--font-en)" }}>Build Route</span>
        <select value={locale} onChange={e => setLocale(e.target.value as SupportedLocale)}
          className="ml-auto text-xs rounded-lg border border-[var(--color-border)] px-2 py-1 bg-[var(--color-bg-light)] focus:outline-none">
          <option value="ko">KO</option>
          <option value="en">EN</option>
        </select>
      </div>

      {/* Mountain */}
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[var(--color-text-muted)]">Mountain *</span>
        <select value={mountainId} onChange={e => handleMountainChange(e.target.value)} className={INPUT}>
          <option value="">— Select mountain —</option>
          {mountains.map(m => (
            <option key={m.id} value={m.id}>
              {m.name.ko ? `${m.name.ko}${m.name.en ? ` (${m.name.en})` : ""}` : m.name.en}
            </option>
          ))}
        </select>
      </label>

      {loadingData && <Alert type="loading" message="Loading data…" />}

      {mountainId && !loadingData && (
        <>
          {/* Existing routes list */}
          {routes.length > 0 && (
            <div className="flex flex-col gap-2">
              <SectionLabel>Existing Routes</SectionLabel>
              {routes.map(route => (
                <div key={route.id}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors ${
                    editingRouteId === route.id
                      ? "border-primary bg-[#EEF5F1]"
                      : "border-[var(--color-border)] bg-[var(--color-bg-light)]"
                  }`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{route.name.en}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)] font-mono">
                      #{route.id} · {route.segment_ids?.length ?? 0} segments
                      {route.total_distance_m ? ` · ${(route.total_distance_m / 1000).toFixed(1)}km` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => loadRouteForEdit(route)}
                    disabled={editingRouteId === route.id}
                    className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-muted)] hover:border-primary hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <Pencil className="w-3 h-3" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(route)}
                    disabled={phase === "deleting"}
                    className="flex items-center rounded-lg border border-red-200 text-red-500 px-2 py-1 text-xs hover:bg-red-50 disabled:opacity-40 transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Divider when editing */}
          {isEditMode && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-[var(--color-border)]" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                Editing Route #{editingRouteId}
              </span>
              <div className="flex-1 h-px bg-[var(--color-border)]" />
            </div>
          )}

          {/* Route name */}
          <div className="flex flex-col gap-3">
            <SectionLabel>{isEditMode ? "Edit Route Name" : "New Route Name"}</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--color-text-muted)]">Name (KO)</span>
                <input type="text" placeholder="관악산 클래식" value={nameKo}
                  onChange={e => setNameKo(e.target.value)} className={INPUT}
                  style={{ fontFamily: "var(--font-ko)" }} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--color-text-muted)]">Name (EN) *</span>
                <input type="text" placeholder="Gwanaksan Classic" value={nameEn}
                  onChange={e => setNameEn(e.target.value)} className={INPUT} />
              </label>
            </div>
            <div className="flex flex-wrap gap-4 px-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isOneway} onChange={e => setIsOneway(e.target.checked)} className="w-4 h-4 rounded text-primary focus:ring-primary/40 border-[var(--color-border)]" />
                <span className="text-sm font-medium">Is One-Way</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={hideSafeStart} onChange={e => setHideSafeStart(e.target.checked)} className="w-4 h-4 rounded text-primary focus:ring-primary/40 border-[var(--color-border)]" />
                <span className="text-sm font-medium">Hide Safety Alert (Safe Start Time)</span>
              </label>
            </div>
          </div>

          {/* Segment ordering */}
          <div className="flex flex-col gap-3">
            <SectionLabel>Segments (in order)</SectionLabel>

            {selectedSegments.length > 0 && (
              <div className="flex flex-col gap-2">
                {selectedSegments.map((seg, i) => (
                  <div key={seg.id} className={`flex flex-col rounded-xl border bg-[var(--color-bg-light)] transition-colors ${
                    editingSegId === seg.id ? "border-primary" : "border-[var(--color-border)]"
                  }`}>
                    {/* Row */}
                    <div className="flex items-center gap-2 px-3 py-2.5">
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
                          {segmentName(seg) && (
                            <span className="text-xs truncate font-semibold">
                              {segmentName(seg)}
                            </span>
                          )}
                          <span className="text-xs truncate text-[var(--color-text-muted)]">
                            {waypointName(seg.start_waypoint_id)} → {waypointName(seg.end_waypoint_id)}
                          </span>
                        </div>
                        <div className="text-[10px] text-[var(--color-text-muted)] font-mono mt-0.5">
                          {seg.distance_m        ? `${(seg.distance_m / 1000).toFixed(1)}km · ` : ""}
                          {seg.estimated_time_min ? `${seg.estimated_time_min}min` : ""}
                          {seg.total_ascent_m    ? ` · +${seg.total_ascent_m}m` : ""}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => openSegEdit(seg)}
                          className="flex items-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] px-2 py-1 text-xs hover:border-primary hover:text-primary transition-colors">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => removeSegment(i)}
                          className="flex items-center rounded-lg border border-red-200 text-red-500 px-2 py-1 text-xs hover:bg-red-50 transition-colors"
                          title="코스에서 제외">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Inline Edit Form */}
                    {editingSegId === seg.id && (
                      <div className="px-3 pb-3 border-t border-[var(--color-border)] pt-3 flex flex-col gap-3 bg-white rounded-b-xl">
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase text-[var(--color-text-muted)]">Type</span>
                            <select value={segEditType} onChange={e => {
                              const t = e.target.value;
                              setSegEditType(t);
                              if (t !== "APPROACH" && t !== "RETURN") setSegEditIsBus(false);
                            }} className={INPUT}>
                              {Object.keys(SEG_TYPE_COLORS).map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </label>
                          <label className="flex items-center gap-2 mt-5 cursor-pointer">
                            {(segEditType === "APPROACH" || segEditType === "RETURN") && (
                              <>
                                <input type="checkbox" checked={segEditIsBus} onChange={e => setSegEditIsBus(e.target.checked)} className="w-4 h-4 rounded text-primary border-[var(--color-border)]" />
                                <span className="text-xs font-medium">Add Bus</span>
                              </>
                            )}
                          </label>
                        </div>

                        <div className={`grid gap-2 ${segEditIsBus ? "grid-cols-3" : "grid-cols-2"}`}>
                          <label className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase text-[var(--color-text-muted)]">Start</span>
                            <select value={segEditStartWp} onChange={e => setSegEditStartWp(e.target.value)} className={INPUT}>
                              {waypoints.map(w => <option key={w.id} value={w.id}>{waypointName(w.id)}</option>)}
                            </select>
                          </label>
                          {segEditIsBus && (
                            <label className="flex flex-col gap-1">
                              <span className="text-[10px] uppercase text-[var(--color-text-muted)]">Bus Stop</span>
                              <select value={segEditMidWp} onChange={e => setSegEditMidWp(e.target.value)} className={INPUT}>
                                <option value="">— Select —</option>
                                {waypoints.map(w => <option key={w.id} value={w.id}>{waypointName(w.id)}</option>)}
                              </select>
                            </label>
                          )}
                          <label className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase text-[var(--color-text-muted)]">End</span>
                            <select value={segEditEndWp} onChange={e => setSegEditEndWp(e.target.value)} className={INPUT}>
                              {waypoints.map(w => <option key={w.id} value={w.id}>{waypointName(w.id)}</option>)}
                            </select>
                          </label>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase text-[var(--color-text-muted)]">Name (KO)</span>
                            <input value={segEditNameKo} onChange={e => setSegEditNameKo(e.target.value)} className={INPUT} />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase text-[var(--color-text-muted)]">Name (EN)</span>
                            <input value={segEditNameEn} onChange={e => setSegEditNameEn(e.target.value)} className={INPUT} />
                          </label>
                        </div>

                        <div className="flex flex-col gap-2 bg-[var(--color-bg-light)] p-2 rounded-lg">
                          {!segEditIsBus ? (
                            <label className="flex flex-col gap-1">
                              <span className="text-[10px] uppercase text-[var(--color-text-muted)]">Duration (min)</span>
                              <input type="number" value={segEditTime} onChange={e => setSegEditTime(e.target.value)} className={INPUT} />
                            </label>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              <label className="flex flex-col gap-1">
                                <span className="text-[10px] uppercase text-[#2E5E4A]">Bus Time</span>
                                <input type="number" value={segEditBusDurationMin} onChange={e => setSegEditBusDurationMin(e.target.value)} className={INPUT} />
                              </label>
                              <label className="flex flex-col gap-1">
                                <span className="text-[10px] uppercase text-[#2E5E4A]">Walking Time</span>
                                <input type="number" value={segEditTime} onChange={e => setSegEditTime(e.target.value)} className={INPUT} />
                              </label>
                            </div>
                          )}
                        </div>

                        {/* GPS File Upload */}
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase text-[var(--color-text-muted)]">Walk GPS File (.gpx, .geojson)</span>
                            <input type="file" accept=".gpx,.geojson" onChange={e => setSegEditGpx(e.target.files?.[0] || null)}
                              className="text-[10px] border border-dashed border-[var(--color-border)] rounded-lg p-2" />
                          </label>
                          {segEditIsBus && (
                            <label className="flex flex-col gap-1">
                              <span className="text-[10px] uppercase text-[#2E5E4A]">Bus GPS File (.gpx, .geojson)</span>
                              <input type="file" accept=".gpx,.geojson" onChange={e => setSegEditBusGpx(e.target.files?.[0] || null)}
                                className="text-[10px] border border-dashed border-[#2E5E4A]/30 rounded-lg p-2" />
                            </label>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <button onClick={closeSegEdit} className="flex-1 py-2 text-xs font-semibold border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-light)] transition-colors">Cancel</button>
                          <button onClick={() => saveSegEdit(seg.id)} disabled={segSaving} className="flex-1 py-2 text-xs font-semibold bg-primary text-white rounded-lg disabled:opacity-40">
                            {segSaving ? "Saving..." : "Save Segment"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add segment */}
            {availableToAdd.length > 0 && (
              <div className="flex gap-2 min-w-0">
                <select value={addingId} onChange={e => setAddingId(e.target.value)}
                  className={`${INPUT} flex-1 min-w-0`}>
                  <option value="">— Add existing segment from this mountain —</option>
                  {sortedWpIds.map(wpId => (
                    <optgroup key={wpId} label={waypointName(wpId)}>
                      {availableGroups[wpId]
                        .sort((a, b) => (SEG_TYPE_PRIORITY[a.segment_type] ?? 5) - (SEG_TYPE_PRIORITY[b.segment_type] ?? 5))
                        .map((s, idx) => (
                        <option key={s.id} value={s.id}>
                          [{s.segment_type}] #{idx + 1} {segmentName(s) ? ` — ${segmentName(s)}` : ""} → {waypointName(s.end_waypoint_id)} (ID: {s.id})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button onClick={addSegment} disabled={!addingId} className="flex-none flex items-center justify-center rounded-xl bg-primary text-white px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed">
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
          {(phase === "idle" || phase === "deleting") && (
            <div className="flex gap-2">
              {isEditMode
                ? <button onClick={reset} className={BTN_SECONDARY}>Cancel</button>
                : <button onClick={reset} className={BTN_SECONDARY}>Clear</button>
              }
              <button onClick={handleSave}
                disabled={!nameEn.trim() || !selectedIds.length || phase === "deleting"}
                className={BTN_PRIMARY}>
                <CheckCircle className="w-4 h-4" />
                {isEditMode ? "Update Route" : "Save Route"}
              </button>
            </div>
          )}
        </>
      )}

      {(phase === "saving" || phase === "done" || phase === "error") && (
        <div className="flex flex-col gap-3">
          <Alert
            type={phase === "saving" ? "loading" : phase === "done" ? "success" : "error"}
            message={phase === "saving" ? (isEditMode ? "Updating route…" : "Saving route…") : msg}
          />
          {(phase === "done" || phase === "error") && (
            <button onClick={reset} className={`${BTN_SECONDARY} flex-none w-full`}>
              {phase === "done" ? (isEditMode ? "Back to Routes" : "Build Another Route") : "Back"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
