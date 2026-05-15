"use client";

import { useState, useRef } from "react";
import { Upload, CheckCircle, AlertCircle, ArrowRight, Save, Eye } from "lucide-react";
import { parseTrackFile, type TrackPoint } from "@/lib/parseGpx";
import { trackDistanceKm } from "@/lib/geo";

const INPUT     = "rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm bg-[var(--color-bg-light)] focus:outline-none focus:ring-2 focus:ring-primary/40 w-full";
const INPUT_NUM = "rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm bg-[var(--color-bg-light)] focus:outline-none focus:ring-2 focus:ring-primary/40 w-24 text-center font-num";
const BTN_PRIMARY = "flex items-center justify-center gap-2 rounded-xl bg-primary text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed";
const BTN_GHOST   = "flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-bg-light)] transition-colors";
const CARD  = "rounded-2xl bg-white border border-[var(--color-border)] p-5 flex flex-col gap-4";
const LABEL = "text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]";

const SEG_TYPES = ["APPROACH", "ASCENT", "DESCENT", "RETURN"] as const;
type SegType = typeof SEG_TYPES[number];

const SEG_META: Record<SegType, { label: string; color: string }> = {
  APPROACH: { label: "Approach", color: "bg-blue-50 text-blue-700 border-blue-200" },
  ASCENT:   { label: "Ascent",   color: "bg-orange-50 text-orange-700 border-orange-200" },
  DESCENT:  { label: "Descent",  color: "bg-amber-50 text-amber-700 border-amber-200" },
  RETURN:   { label: "Return",   color: "bg-purple-50 text-purple-700 border-purple-200" },
};

type Waypoint = { id: number; name: { en?: string; ko?: string }; type: string };

type SegSlot = {
  segType:        SegType;
  source:         "existing" | "new";
  existingId?:    number;
  startWpId?:     number;
  endWpId?:       number;
  durationMin?:   number;
  isBusCombined?: boolean;
  midWpId?:       number;   // 버스 승차 정류장 (GPS 종료점)
  busNumber?:     string;
  busDurationMin?: number;
};

type PreviewSeg = {
  segType: string;
  startWpName: string;
  endWpName: string;
  distanceM: number;
  durationMin: number;
};

const BOUNDARY_TYPES = new Set(["STATION", "BUS_STOP", "TRAILHEAD", "JUNCTION", "SUMMIT", "PEAK", "SHELTER"]);

export default function ResegmentPage() {
  const [allRoutes,   setAllRoutes]   = useState<{ id: number; name: any; mountain_id: number }[]>([]);
  const [routesLoaded, setRoutesLoaded] = useState(false);
  const [routeId,     setRouteId]     = useState("");
  const [route,       setRoute]       = useState<{ id: number; name: any; mountain_id: number } | null>(null);
  const [waypoints,   setWaypoints]   = useState<Waypoint[]>([]);
  const [slots,       setSlots]       = useState<SegSlot[]>(
    SEG_TYPES.map((t) => ({ segType: t, source: "new" }))
  );
  const [trackPoints, setTrackPoints] = useState<TrackPoint[] | null>(null);
  const [trackName,   setTrackName]   = useState("");
  const [isDragging,  setIsDragging]  = useState(false);
  const [preview,     setPreview]     = useState<PreviewSeg[] | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");
  const [success,     setSuccess]     = useState(false);
  const gpxRef = useRef<HTMLInputElement>(null);

  // ── Load all routes (lazy, on dropdown focus) ─────────────────────────────
  async function loadAllRoutes() {
    if (routesLoaded) return;
    try {
      const res = await fetch("/api/admin/routes");
      const data = await res.json();
      setAllRoutes(Array.isArray(data) ? data : []);
      setRoutesLoaded(true);
    } catch { /* silent */ }
  }

  // ── Select route from dropdown ─────────────────────────────────────────────
  async function selectRoute(id: number) {
    setRouteId(String(id));
    setError("");
    setRoute(null);
    setWaypoints([]);
    setSlots(SEG_TYPES.map((t) => ({ segType: t, source: "new" })));
    setPreview(null);
    if (!id) return;

    setLoading(true);
    try {
      const selected = allRoutes.find((r) => r.id === id);
      if (!selected) throw new Error("Route not found");
      setRoute(selected);

      const wpRes = await fetch(`/api/admin/waypoints?mountainId=${selected.mountain_id}`);
      const wps = await wpRes.json();
      setWaypoints(Array.isArray(wps) ? wps : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  // ── GPX ────────────────────────────────────────────────────────────────────
  async function handleGpx(file: File) {
    try {
      const result = await parseTrackFile(file);
      setTrackPoints(result.points);
      setTrackName(result.name || file.name);
      setPreview(null);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "GPX parse failed");
    }
  }

  // ── Slot update ─────────────────────────────────────────────────────────────
  function updateSlot(type: SegType, patch: Partial<SegSlot>) {
    setSlots((prev) => prev.map((s) => s.segType === type ? { ...s, ...patch } : s));
    setPreview(null);
  }

  // ── Build payload ────────────────────────────────────────────────────────────
  function buildPayload(isPreview: boolean) {
    // For bus-combined slots: GPS ends at the bus stop (midWpId), not the station (endWpId)
    const gpsEnd = (s: SegSlot) => (s.isBusCombined && s.midWpId) ? s.midWpId : s.endWpId;

    const ids: number[] = [];
    for (const s of slots) {
      if (s.source !== "new") continue;
      if (s.startWpId != null && !ids.includes(s.startWpId)) ids.push(s.startWpId);
      const end = gpsEnd(s);
      if (end != null && !ids.includes(end)) ids.push(end);
    }

    const segmentOverrides = slots.map((s) =>
      s.source === "existing" && s.existingId ? s.existingId : null
    );
    const segmentWpOverrides = slots.map((s) => {
      if (s.source === "existing") return null;
      const si = s.startWpId != null ? ids.indexOf(s.startWpId) : -1;
      const ei = gpsEnd(s)   != null ? ids.indexOf(gpsEnd(s)!)  : -1;
      if (si < 0 || ei < 0 || si >= ei) return null;
      return { startWpIdx: si, endWpIdx: ei };
    });
    // For bus-combined: store station (endWpId) as the segment's actual end_waypoint_id
    const segmentEndWpOverrides = slots.map((s) => {
      if (s.source === "existing") return null;
      return (s.isBusCombined && s.midWpId && s.endWpId) ? s.endWpId : null;
    });
    const segmentSpecs = slots.map((s) => ({
      segment_type:       s.segType,
      estimated_time_min: s.durationMin,
      is_bus_combined:    s.isBusCombined ?? false,
      bus_duration_min:   s.busDurationMin,
      bus_numbers:        s.busNumber,
    }));

    return {
      routeId: route!.id,
      trackPoints,
      waypointIds: ids,
      segmentOverrides,
      segmentWpOverrides,
      segmentEndWpOverrides,
      segmentSpecs,
      preview: isPreview,
    };
  }

  async function handlePreview() {
    if (!route || !trackPoints) { setError("GPX 파일을 먼저 업로드하세요"); return; }
    setLoading(true); setError("");
    try {
      const res  = await fetch("/api/admin/resegment-route", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(true)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview failed");
      setPreview(data.segments);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!route || !trackPoints) return;
    setSaving(true); setError("");
    try {
      const res  = await fetch("/api/admin/resegment-route", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(false)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const boundaryWps = waypoints.filter((w) =>
    BOUNDARY_TYPES.has(w.type) && (w.name.ko || w.name.en)
  );
  const wpLabel = (id?: number) => {
    if (!id) return "—";
    const wp = waypoints.find((w) => w.id === id);
    return wp ? `${wp.name.ko || wp.name.en} [${wp.type}]` : `WP${id}`;
  };

  if (success) {
    return (
      <div className="flex flex-col items-center gap-6 py-16 px-6 text-center">
        <CheckCircle size={56} className="text-primary" />
        <h2 className="text-lg font-bold">완료!</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Route {route?.id} segment이 교체됐습니다.<br />
          사진·이름·설명은 그대로 유지됩니다.
        </p>
        <button onClick={() => { setSuccess(false); setPreview(null); }} className={BTN_GHOST}>
          다시 하기
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <div className="rounded-2xl bg-primary p-5 text-white">
        <p className="font-semibold text-[1.125rem]">Resegment Route</p>
        <p className="text-white/70 text-sm mt-1">
          Segment만 교체 — 사진·이름·설명은 그대로 유지
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm bg-red-50 text-red-600">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* ── Route 선택 ── */}
      <div className={CARD}>
        <p className={LABEL}>Route 선택</p>
        <select
          className={INPUT}
          value={routeId}
          onFocus={loadAllRoutes}
          onChange={(e) => selectRoute(parseInt(e.target.value) || 0)}
        >
          <option value="">— 루트를 선택하세요 —</option>
          {allRoutes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name?.ko || r.name?.en}  (ID: {r.id})
            </option>
          ))}
        </select>
        {loading && <p className="text-xs text-[var(--color-text-muted)]">불러오는 중...</p>}
      </div>

      {route && (
        <>
          {/* ── GPX ── */}
          <div className={CARD}>
            <p className={LABEL}>GPS 파일 (GPX / GeoJSON)</p>
            <input
              ref={gpxRef}
              type="file"
              accept=".gpx,.geojson"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleGpx(e.target.files[0]); }}
            />
            {trackPoints ? (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center gap-3">
                <CheckCircle size={18} className="text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{trackName}</p>
                  <p className="text-xs text-[var(--color-text-muted)] font-num">
                    {trackPoints.length.toLocaleString()} pts · {trackDistanceKm(trackPoints)} km
                  </p>
                </div>
                <button onClick={() => gpxRef.current?.click()} className="text-xs text-primary underline shrink-0">
                  교체
                </button>
              </div>
            ) : (
              <div
                onClick={() => gpxRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault(); setIsDragging(false);
                  if (e.dataTransfer.files[0]) handleGpx(e.dataTransfer.files[0]);
                }}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed py-8 cursor-pointer transition-colors ${
                  isDragging ? "border-primary text-primary bg-primary/5" : "border-[var(--color-border)] text-[var(--color-text-muted)]"
                }`}
              >
                <Upload size={28} />
                <span className="text-sm font-medium">GPX / GeoJSON 업로드</span>
              </div>
            )}
          </div>

          {/* ── Segments ── */}
          <div className={CARD}>
            <p className={LABEL}>Segment 설정</p>
            <div className="flex flex-col gap-3">
              {slots.map((slot) => {
                const meta  = SEG_META[slot.segType];
                const isNew = slot.source === "new";
                return (
                  <div key={slot.segType} className="rounded-xl border border-[var(--color-border)] p-4 flex flex-col gap-3">
                    <span className={`text-[10px] font-bold self-start px-2 py-0.5 rounded-full border ${meta.color}`}>
                      {meta.label}
                    </span>

                    {/* Existing / New 토글 */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateSlot(slot.segType, { source: "new", existingId: undefined })}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                          isNew ? "bg-primary text-white border-primary" : "border-[var(--color-border)] text-[var(--color-text-muted)]"
                        }`}
                      >
                        New (GPS)
                      </button>
                      <button
                        onClick={() => updateSlot(slot.segType, { source: "existing" })}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                          !isNew ? "bg-primary text-white border-primary" : "border-[var(--color-border)] text-[var(--color-text-muted)]"
                        }`}
                      >
                        Existing
                      </button>
                    </div>

                    {/* Existing: segment ID */}
                    {!isNew && (
                      <div>
                        <p className={LABEL}>기존 Segment ID</p>
                        <input
                          type="number"
                          className={INPUT_NUM + " w-full"}
                          placeholder="5"
                          value={slot.existingId ?? ""}
                          onChange={(e) => updateSlot(slot.segType, { existingId: parseInt(e.target.value) || undefined })}
                        />
                      </div>
                    )}

                    {/* New: 시작 / 종료 waypoint */}
                    {isNew && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className={LABEL}>시작</p>
                            <select
                              className={INPUT}
                              value={slot.startWpId ?? ""}
                              onChange={(e) => updateSlot(slot.segType, { startWpId: parseInt(e.target.value) || undefined })}
                            >
                              <option value="">— 선택 —</option>
                              {boundaryWps.map((wp) => (
                                <option key={wp.id} value={wp.id}>
                                  {wp.name.ko || wp.name.en} [{wp.type}]
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <p className={LABEL}>종료</p>
                            <select
                              className={INPUT}
                              value={slot.endWpId ?? ""}
                              onChange={(e) => updateSlot(slot.segType, { endWpId: parseInt(e.target.value) || undefined })}
                            >
                              <option value="">— 선택 —</option>
                              {boundaryWps.map((wp) => (
                                <option key={wp.id} value={wp.id}>
                                  {wp.name.ko || wp.name.en} [{wp.type}]
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {slot.startWpId && slot.endWpId && (
                          <div className="flex items-center gap-1 text-[11px] text-primary font-medium">
                            <span className="truncate">{wpLabel(slot.startWpId)}</span>
                            <ArrowRight size={10} className="shrink-0" />
                            <span className="truncate">{wpLabel(slot.endWpId)}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border)]">
                          <span className="text-xs text-[var(--color-text-muted)]">도보 소요시간 (분, 선택)</span>
                          <input
                            type="number"
                            className={INPUT_NUM}
                            placeholder="자동"
                            value={slot.durationMin ?? ""}
                            onChange={(e) => updateSlot(slot.segType, { durationMin: parseInt(e.target.value) || undefined })}
                            min="1"
                          />
                        </div>

                        {(slot.segType === "APPROACH" || slot.segType === "RETURN") && (
                          <div className="flex flex-col gap-2 pt-1 border-t border-[var(--color-border)]">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={slot.isBusCombined ?? false}
                                onChange={(e) => updateSlot(slot.segType, { isBusCombined: e.target.checked })}
                                className="w-4 h-4 rounded"
                              />
                              <span className="text-xs font-semibold text-[#0068B7]">버스 구간 포함</span>
                            </label>
                            {slot.isBusCombined && (
                              <div className="flex flex-col gap-2 pl-6">
                                <div>
                                  <p className={LABEL}>버스 승차 정류장 (GPS 종료점)</p>
                                  <select
                                    className={INPUT}
                                    value={slot.midWpId ?? ""}
                                    onChange={(e) => updateSlot(slot.segType, { midWpId: parseInt(e.target.value) || undefined })}
                                  >
                                    <option value="">— 선택 —</option>
                                    {waypoints.filter((w) => w.type === "BUS_STOP" && (w.name.ko || w.name.en)).map((wp) => (
                                      <option key={wp.id} value={wp.id}>
                                        {wp.name.ko || wp.name.en} [BUS_STOP]
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <p className={LABEL}>버스 번호</p>
                                    <input
                                      type="text"
                                      className={INPUT}
                                      placeholder="관악02-1"
                                      value={slot.busNumber ?? ""}
                                      onChange={(e) => updateSlot(slot.segType, { busNumber: e.target.value || undefined })}
                                    />
                                  </div>
                                  <div>
                                    <p className={LABEL}>버스 탑승시간 (분)</p>
                                    <input
                                      type="number"
                                      className={INPUT_NUM + " w-full"}
                                      placeholder="20"
                                      value={slot.busDurationMin ?? ""}
                                      onChange={(e) => updateSlot(slot.segType, { busDurationMin: parseInt(e.target.value) || undefined })}
                                      min="1"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Preview 결과 */}
          {preview && (
            <div className={CARD}>
              <p className={LABEL}>Preview</p>
              <div className="flex flex-col gap-1">
                {preview.map((seg, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${SEG_META[seg.segType as SegType]?.color ?? ""}`}>
                        {seg.segType}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)] truncate">
                        {seg.startWpName} → {seg.endWpName}
                      </span>
                    </div>
                    <span className="text-xs font-num text-[var(--color-text-muted)] shrink-0 ml-2">
                      {(seg.distanceM / 1000).toFixed(2)} km · {seg.durationMin}분
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3">
            <button
              onClick={handlePreview}
              disabled={loading || !trackPoints}
              className={BTN_GHOST + " flex-1"}
            >
              <Eye size={16} />
              {loading ? "계산 중..." : "Preview"}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !trackPoints}
              className={BTN_PRIMARY + " flex-1"}
            >
              <Save size={16} />
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] text-center">
            사진·이름·설명은 영향 없습니다.
          </p>
        </>
      )}
    </div>
  );
}
