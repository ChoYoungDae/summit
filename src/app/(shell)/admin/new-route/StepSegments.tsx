"use client";

import { useState } from "react";
import { Clock, ArrowRight, Info, Bus, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import type { SegmentPreview, ExistingSegment, WaypointSlot, ExistingWaypoint } from "./types";

const INPUT     = "rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm bg-[var(--color-bg-light)] focus:outline-none focus:ring-2 focus:ring-primary/40 w-full";
const INPUT_NUM = "rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm bg-[var(--color-bg-light)] focus:outline-none focus:ring-2 focus:ring-primary/40 w-24 text-center font-num";
const LABEL     = "text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]";
const CARD      = "rounded-2xl border border-[var(--color-border)] bg-white p-4 flex flex-col gap-3";

const SEG_TYPES = ["APPROACH", "ASCENT", "DESCENT", "RETURN"] as const;
type SegType = typeof SEG_TYPES[number];

const SEGMENT_META: Record<SegType, { label: string; labelKo: string; color: string }> = {
  APPROACH: { label: "Approach", labelKo: "접근",  color: "bg-blue-50   text-blue-600   border-blue-100"   },
  ASCENT:   { label: "Ascent",   labelKo: "상행",  color: "bg-orange-50 text-orange-600 border-orange-100" },
  DESCENT:  { label: "Descent",  labelKo: "하행",  color: "bg-amber-50  text-amber-600  border-amber-100"  },
  RETURN:   { label: "Return",   labelKo: "귀환",  color: "bg-teal-50   text-teal-600   border-teal-100"   },
};

const BUS_COLORS = [
  { label: "Blue (간선)",        value: "#0068B7" },
  { label: "Green (지선·마을)",  value: "#00A84D" },
  { label: "Red (광역)",         value: "#F33535" },
  { label: "Yellow (순환)",      value: "#FFB300" },
];

const HAS_BUS = (t: SegType) => t === "APPROACH" || t === "RETURN";

/** Only these types are meaningful GPS split points */
const BOUNDARY_TYPES = ["TRAILHEAD", "SUMMIT", "BUS_STOP", "STATION"];

/** Fallback Korean label when the waypoint has no name */
const TYPE_FALLBACK_KO: Partial<Record<string, string>> = {
  SUMMIT:    "정상",
  TRAILHEAD: "등산로 입구",
  BUS_STOP:  "버스 정류장",
  STATION:   "지하철역",
};

/** Combined waypoint option for pickers */
type WpOption = {
  label:    string;
  labelKo?: string;
  type:     string;
  specIdx?: number;  // index in waypointSpecs (for new WPs)
  dbId?:    number;  // DB id (for existing WPs)
};

function buildWpOptions(
  waypointSlots:     WaypointSlot[],
  existingWaypoints: ExistingWaypoint[],
): WpOption[] {
  const opts: WpOption[] = [];
  const coveredDbIds = new Set<number>();

  // 1. Waypoints from this route's slots
  waypointSlots.forEach((slot, idx) => {
    if (!BOUNDARY_TYPES.includes(slot.data.type)) return;

    if (slot.source === "existing" && slot.existingId) {
      coveredDbIds.add(slot.existingId);
      const wp = existingWaypoints.find((w) => w.id === slot.existingId);
      const fallback = TYPE_FALLBACK_KO[slot.data.type] ?? slot.data.type;
      opts.push({
        label:   wp?.name.en || wp?.name.ko || fallback,
        labelKo: wp?.name.ko || fallback,
        type:    slot.data.type,
        specIdx: idx,
        dbId:    slot.existingId,
      });
    } else {
      const nameKo = slot.data.nameKo || slot.data.subwayStation
        || TYPE_FALLBACK_KO[slot.data.type] || slot.data.type;
      const nameEn = slot.data.nameEn
        || (slot.data.subwayStation ? `${slot.data.subwayStation} Station` : "");
      opts.push({
        label:   nameEn || nameKo,
        labelKo: nameKo,
        type:    slot.data.type,
        specIdx: idx,
      });
    }
  });

  // 2. DB waypoints (same mountain) not already covered — useful as GPS split boundaries
  existingWaypoints.forEach((wp) => {
    if (!BOUNDARY_TYPES.includes(wp.type)) return;
    if (coveredDbIds.has(wp.id)) return; // already added via slot
    const fallback = TYPE_FALLBACK_KO[wp.type] ?? wp.type;
    opts.push({
      label:   wp.name.en || wp.name.ko || fallback,
      labelKo: wp.name.ko || fallback,
      type:    wp.type,
      dbId:    wp.id,
    });
  });

  return opts;
}

export default function StepSegments({
  segments,
  existingSegments,
  waypointSlots,
  existingWaypoints,
  onChange,
}: {
  segments:          SegmentPreview[];
  existingSegments:  ExistingSegment[];
  waypointSlots:     WaypointSlot[];
  existingWaypoints: ExistingWaypoint[];
  onChange:          (updated: SegmentPreview[]) => void;
}) {
  const [editOpen, setEditOpen] = useState<Partial<Record<SegType, boolean>>>({});

  const wpOptions = buildWpOptions(waypointSlots, existingWaypoints);

  // Index auto-inferred segments by type
  const inferred = Object.fromEntries(
    segments.filter((s) => s.source !== "existing").map((s) => [s.segType, s])
  ) as Partial<Record<SegType, SegmentPreview>>;

  function getSlot(type: SegType): SegmentPreview {
    return (
      segments.find((s) => s.segType === type) ?? {
        segType: type, source: "new",
        startWpName: "", endWpName: "", distanceM: 0, durationMin: 0,
      }
    );
  }

  function updateSlot(type: SegType, patch: Partial<SegmentPreview>) {
    const next = SEG_TYPES.map((t) => (t === type ? { ...getSlot(t), ...patch } : getSlot(t)));
    onChange(next);
  }

  function setExisting(type: SegType, id: number) {
    const seg = existingSegments.find((s) => s.id === id);
    if (!seg) return;
    updateSlot(type, {
      source:        "existing",
      existingId:    id,
      startWpName:   seg.start_wp_name    ?? "",
      startWpNameKo: seg.start_wp_name_ko ?? undefined,
      endWpName:     seg.end_wp_name      ?? "",
      endWpNameKo:   seg.end_wp_name_ko   ?? undefined,
      distanceM:     seg.distance_m       ?? 0,
      durationMin:   seg.estimated_time_min ?? 0,
      isBusCombined: seg.is_bus_combined  ?? false,
    });
  }

  function setNew(type: SegType) {
    const inf = inferred[type];
    updateSlot(type, inf
      ? { ...inf, source: "new", existingId: undefined }
      : { source: "new", existingId: undefined, isBusCombined: false }
    );
  }

  function setWpOverride(type: SegType, field: "startWpIdx" | "endWpIdx", opt: WpOption | undefined) {
    if (!opt) return;
    const isStart = field === "startWpIdx";
    updateSlot(type, {
      [field]:          opt.specIdx ?? opt.dbId,
      [isStart ? "startWpName" : "endWpName"]:   opt.label,
      [isStart ? "startWpNameKo" : "endWpNameKo"]: opt.labelKo,
    });
  }

  function toggleEdit(type: SegType) {
    setEditOpen((prev) => ({ ...prev, [type]: !prev[type] }));
  }

  const totalDuration = SEG_TYPES.reduce((sum, t) => sum + (getSlot(t).durationMin ?? 0), 0);
  const totalDistance = SEG_TYPES.reduce((sum, t) => sum + (getSlot(t).distanceM  ?? 0), 0);
  const byType = (type: SegType) => existingSegments.filter((s) => s.segment_type === type);

  if (segments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[var(--color-text-muted)] text-center gap-2">
        <Info size={32} strokeWidth={1.5} />
        <p className="text-sm">No segments inferred yet.<br />Make sure you have at least 2 waypoints.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Totals */}
      <div className="bg-primary/5 rounded-xl p-3 border border-primary/10 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold text-primary uppercase tracking-tight">Total Estimated Time</span>
          <div className="text-xl font-bold text-primary font-num">
            {Math.floor(totalDuration / 60)}h {totalDuration % 60}m
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-tight">Total Distance</span>
          <div className="text-sm font-semibold text-[var(--color-text-body)] font-num">
            {(totalDistance / 1000).toFixed(2)} km
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {SEG_TYPES.map((type) => {
          const meta     = SEGMENT_META[type];
          const slot     = getSlot(type);
          const isNew    = slot.source !== "existing";
          const pool     = byType(type);
          const hasNew   = true; // GPS data always available; inferred may be stale after switching to Existing
          const isEditing = editOpen[type] ?? false;

          // Current start/end option (for edit picker defaults)
          const currentStartOpt = wpOptions.find((o) =>
            slot.startWpIdx != null ? (o.specIdx === slot.startWpIdx || o.dbId === slot.startWpIdx) : o.label === slot.startWpName
          );
          const currentEndOpt = wpOptions.find((o) =>
            slot.endWpIdx != null ? (o.specIdx === slot.endWpIdx || o.dbId === slot.endWpIdx) : o.label === slot.endWpName
          );

          return (
            <div key={type} className={CARD}>
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.color}`}>
                    {meta.label} · {meta.labelKo}
                  </span>
                  {slot.isBusCombined && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                      <Bus size={10} /> 버스 복합
                    </span>
                  )}
                </div>
                {slot.distanceM > 0 && (
                  <span className="text-xs text-[var(--color-text-muted)] font-num">
                    {(slot.distanceM / 1000).toFixed(2)} km
                  </span>
                )}
              </div>

              {/* New / Existing toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setNew(type)}
                  disabled={!hasNew}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    isNew ? "bg-primary text-white border-primary" : "border-[var(--color-border)] text-[var(--color-text-muted)]"
                  }`}
                >
                  New (GPS)
                </button>
                <button
                  onClick={() => {
                    if (pool.length > 0) setExisting(type, pool[0].id);
                    else updateSlot(type, { source: "existing", existingId: undefined });
                  }}
                  disabled={pool.length === 0}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    !isNew ? "bg-primary text-white border-primary" : "border-[var(--color-border)] text-[var(--color-text-muted)]"
                  }`}
                >
                  Existing {pool.length > 0 ? `(${pool.length})` : "(없음)"}
                </button>
              </div>

              {/* Existing segment picker */}
              {!isNew && pool.length > 0 && (
                <div>
                  <p className={LABEL}>구간 선택</p>
                  <select
                    className={INPUT}
                    value={slot.existingId ?? ""}
                    onChange={(e) => setExisting(type, Number(e.target.value))}
                  >
                    {pool.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.start_wp_name_ko || s.start_wp_name || "?"} →{" "}
                        {s.end_wp_name_ko   || s.end_wp_name   || "?"}
                        {s.is_bus_combined ? " 🚌" : ""}
                        {s.estimated_time_min ? ` · ${s.estimated_time_min}min` : ""}
                        {s.distance_m ? ` · ${(s.distance_m / 1000).toFixed(1)}km` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Route display + edit toggle */}
              {isNew && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[var(--color-text-body)] truncate">
                      {slot.startWpName || "—"}
                    </p>
                    {slot.startWpNameKo && (
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate">{slot.startWpNameKo}</p>
                    )}
                  </div>
                  <ArrowRight size={14} className="text-[var(--color-border)] flex-none" />
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-sm font-bold text-[var(--color-text-body)] truncate">
                      {slot.endWpName || "—"}
                    </p>
                    {slot.endWpNameKo && (
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate">{slot.endWpNameKo}</p>
                    )}
                  </div>
                  {/* Edit toggle button */}
                  <button
                    onClick={() => toggleEdit(type)}
                    className="flex-none flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:text-primary hover:border-primary transition-colors"
                  >
                    <Pencil size={11} />
                    {isEditing ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  </button>
                </div>
              )}

              {/* Waypoint boundary editor */}
              {isNew && isEditing && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex flex-col gap-2">
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">
                    시작·종료 웨이포인트 편집 — GPS 분할 경계 변경
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className={LABEL}>시작 (Start)</p>
                      <select
                        className={INPUT + " border-amber-300"}
                        value={currentStartOpt ? (currentStartOpt.specIdx ?? currentStartOpt.dbId ?? "") : ""}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          const opt = wpOptions.find((o) => (o.specIdx ?? o.dbId) === v);
                          setWpOverride(type, "startWpIdx", opt);
                        }}
                      >
                        <option value="">— 선택 —</option>
                        {wpOptions.map((o, i) => (
                          <option key={i} value={o.specIdx ?? o.dbId ?? i}>
                            {o.labelKo || o.label}{o.labelKo && o.label ? ` (${o.label})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className={LABEL}>종료 (End)</p>
                      <select
                        className={INPUT + " border-amber-300"}
                        value={currentEndOpt ? (currentEndOpt.specIdx ?? currentEndOpt.dbId ?? "") : ""}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          const opt = wpOptions.find((o) => (o.specIdx ?? o.dbId) === v);
                          setWpOverride(type, "endWpIdx", opt);
                        }}
                      >
                        <option value="">— 선택 —</option>
                        {wpOptions.map((o, i) => (
                          <option key={i} value={o.specIdx ?? o.dbId ?? i}>
                            {o.labelKo || o.label}{o.labelKo && o.label ? ` (${o.label})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-600">
                    변경 시 해당 구간의 GPS 트랙이 선택한 웨이포인트 구간으로 재분할됩니다.
                  </p>
                </div>
              )}

              {/* ── Bus sub-segment (APPROACH / RETURN, New only) ── */}
              {isNew && HAS_BUS(type) && (
                <div className="border-t border-[var(--color-border)] pt-3 flex flex-col gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={slot.isBusCombined ?? false}
                      onChange={(e) => updateSlot(type, { isBusCombined: e.target.checked })}
                      className="w-4 h-4 rounded text-primary border-[var(--color-border)]"
                    />
                    <span className="text-sm font-medium text-[var(--color-text-body)]">
                      버스 구간 포함 (Add Bus Route)
                    </span>
                  </label>

                  {slot.isBusCombined && (
                    <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className={LABEL + " text-blue-700"}>버스 색상 (노선 종류)</p>
                          <select
                            className={INPUT + " border-blue-200"}
                            value={slot.busColor ?? ""}
                            onChange={(e) => updateSlot(type, { busColor: e.target.value })}
                          >
                            <option value="">— 선택 —</option>
                            {BUS_COLORS.map((bc) => (
                              <option key={bc.value} value={bc.value}>{bc.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <p className={LABEL + " text-blue-700"}>버스 번호</p>
                          <input
                            type="text"
                            className={INPUT + " border-blue-200"}
                            placeholder="704, 34"
                            value={slot.busNumbers ?? ""}
                            onChange={(e) => updateSlot(type, { busNumbers: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <p className={LABEL + " text-blue-700"}>
                          {type === "APPROACH" ? "승차 정류장명 (역 앞)" : "하차 정류장명 (역 앞)"}
                        </p>
                        <input
                          type="text"
                          className={INPUT + " border-blue-200"}
                          placeholder="e.g. 독바위역 1번 출구 앞"
                          value={slot.stationBusStopName ?? ""}
                          onChange={(e) => updateSlot(type, { stationBusStopName: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className={LABEL + " text-blue-700"}>버스 탑승 시간 (분)</p>
                          <input
                            type="number"
                            className={INPUT + " border-blue-200 font-num"}
                            placeholder="20"
                            value={slot.busDurationMin ?? ""}
                            onChange={(e) => updateSlot(type, { busDurationMin: parseInt(e.target.value) || 0 })}
                            min="1"
                          />
                        </div>
                        <div>
                          <p className={LABEL + " text-blue-700"}>도보 시간 (분)</p>
                          <input
                            type="number"
                            className={INPUT_NUM + " border-blue-200 w-full"}
                            placeholder="10"
                            value={slot.durationMin || ""}
                            onChange={(e) => updateSlot(type, { durationMin: parseInt(e.target.value) || 0 })}
                            min="1"
                          />
                        </div>
                      </div>
                      <p className="text-[11px] text-blue-600">
                        총 소요: {(slot.busDurationMin ?? 0) + (slot.durationMin ?? 0)}분
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Duration (non-bus or Existing) */}
              {(!HAS_BUS(type) || !slot.isBusCombined || !isNew) && (
                <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]">
                  <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                    <Clock size={14} />
                    <span className="text-xs font-medium">
                      {isNew ? "소요 시간 (분)" : "소요 시간 (기존 구간)"}
                    </span>
                  </div>
                  <input
                    type="number"
                    className={INPUT_NUM}
                    value={slot.durationMin || ""}
                    onChange={(e) => updateSlot(type, { durationMin: parseInt(e.target.value) || 0 })}
                    min="1"
                    readOnly={!isNew}
                    tabIndex={isNew ? undefined : -1}
                    style={isNew ? undefined : { opacity: 0.6, cursor: "default" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-[var(--color-text-muted)] leading-relaxed italic px-1">
        * New (GPS): Naismith 공식으로 예측. 표지판 기준으로 수정하세요.<br />
        * Existing: 기존 GPS 트랙·사진 그대로 재사용됩니다.
      </p>
    </div>
  );
}
