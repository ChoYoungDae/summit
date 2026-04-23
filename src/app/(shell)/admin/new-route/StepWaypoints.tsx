"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, MapPin, CheckCircle } from "lucide-react";
import { Icon } from "@iconify/react";
import type { PhotoItem, WaypointSlot, ExistingWaypoint } from "./types";

const INPUT = "rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm bg-[var(--color-bg-light)] focus:outline-none focus:ring-2 focus:ring-primary/40 w-full";
const LABEL = "text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]";

type WaypointType = "STATION" | "TRAILHEAD" | "SUMMIT" | "JUNCTION" | "SHELTER" | "BUS_STOP";

const TYPE_LABELS: Record<WaypointType, string> = {
  STATION:   "Station",
  TRAILHEAD: "Trailhead",
  SUMMIT:    "Summit",
  JUNCTION:  "Junction",
  SHELTER:   "Shelter",
  BUS_STOP:  "Bus Stop",
};

const TYPE_COLORS: Record<WaypointType, string> = {
  STATION:   "bg-blue-100 text-blue-700",
  TRAILHEAD: "bg-green-100 text-green-700",
  SUMMIT:    "bg-amber-100 text-amber-700",
  JUNCTION:  "bg-purple-100 text-purple-700",
  SHELTER:   "bg-gray-100 text-gray-600",
  BUS_STOP:  "bg-teal-100 text-teal-700",
};

const BUS_COLORS = [
  { label: "Blue (간선)",   value: "#0068B7" },
  { label: "Green (지선/마을)", value: "#53B332" },
  { label: "Red (광역)",    value: "#D31145" },
  { label: "Yellow (순환)", value: "#F5A200" },
];

// ── Photo picker overlay ──────────────────────────────────────────────────────

function PhotoPicker({
  photos,
  onPick,
  onClose,
}: {
  photos: PhotoItem[];
  onPick: (idx: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      <div
        className="w-full bg-white rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-[var(--color-text-body)] mb-3">
          Pick the photo taken at this waypoint
        </p>
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p, idx) => (
            <button
              key={p.key}
              className="relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-colors"
              onClick={() => onPick(idx)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.previewUrl} alt="" className="w-full h-full object-cover" />
              {p.lat != null && (
                <span className="absolute bottom-1 left-1 text-[9px] font-semibold bg-black/60 text-white px-1 rounded">
                  GPS
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 text-sm text-[var(--color-text-muted)] border border-[var(--color-border)] rounded-xl"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Single waypoint slot card ─────────────────────────────────────────────────

function WaypointSlotCard({
  slot,
  index,
  total,
  photos,
  existingWaypoints,
  onChange,
  onMove,
  onDelete,
}: {
  slot:               WaypointSlot;
  index:              number;
  total:              number;
  photos:             PhotoItem[];
  existingWaypoints:  ExistingWaypoint[];
  onChange:           (updated: WaypointSlot) => void;
  onMove:             (dir: "up" | "down") => void;
  onDelete:           () => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const isNew = slot.source === "new";
  const data  = slot.data;

  function setField<K extends keyof typeof slot.data>(key: K, value: (typeof slot.data)[K]) {
    onChange({ ...slot, data: { ...slot.data, [key]: value } });
  }

  function handlePickPhoto(photoIdx: number) {
    const photo = photos[photoIdx];
    setShowPicker(false);
    onChange({
      ...slot,
      sourcePhotoIdx: photoIdx,
      data: {
        ...slot.data,
        lat:         photo.lat  ?? slot.data.lat,
        lon:         photo.lon  ?? slot.data.lon,
        elevationM:  photo.ele  ?? slot.data.elevationM,
      },
    });
  }

  function handleExistingSelect(id: number) {
    const wp = existingWaypoints.find((w) => w.id === id);
    if (!wp) return;
    onChange({
      ...slot,
      source:     "existing",
      existingId: id,
      data: {
        ...slot.data,
        nameEn:     wp.name.en  ?? "",
        nameKo:     wp.name.ko  ?? "",
        type:       wp.type as WaypointType,
        lat:        wp.lat,
        lon:        wp.lon,
        elevationM: wp.elevation_m ?? undefined,
        arsId:      wp.ars_id      ?? "",
        busNumbers: wp.bus_numbers ?? "",
        subwayLine: wp.subway_line ?? "",
        exitNumber: wp.exit_number ?? "",
      },
    });
  }

  const pickedPhoto = slot.sourcePhotoIdx != null ? photos[slot.sourcePhotoIdx] : null;

  return (
    <>
      {showPicker && (
        <PhotoPicker
          photos={photos}
          onPick={handlePickPhoto}
          onClose={() => setShowPicker(false)}
        />
      )}

      <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4 flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-center gap-2">
          <span className="flex-none w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
            {index + 1}
          </span>
          {data.type && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[data.type as WaypointType] ?? ""}`}>
              {TYPE_LABELS[data.type as WaypointType] ?? data.type}
            </span>
          )}
          <div className="flex-1" />
          <button onClick={() => onMove("up")}   disabled={index === 0}         className="p-1 disabled:opacity-30"><ChevronUp   size={14} /></button>
          <button onClick={() => onMove("down")}  disabled={index === total - 1} className="p-1 disabled:opacity-30"><ChevronDown size={14} /></button>
          <button onClick={onDelete} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
        </div>

        {/* Source toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => onChange({ ...slot, source: "new", existingId: undefined })}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
              isNew ? "bg-primary text-white border-primary" : "border-[var(--color-border)] text-[var(--color-text-muted)]"
            }`}
          >
            New waypoint
          </button>
          <button
            onClick={() => onChange({ ...slot, source: "existing" })}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
              !isNew ? "bg-primary text-white border-primary" : "border-[var(--color-border)] text-[var(--color-text-muted)]"
            }`}
          >
            Existing
          </button>
        </div>

        {/* Existing waypoint selector */}
        {!isNew && (
          <div>
            <p className={LABEL}>Select waypoint</p>
            <select
              className={INPUT}
              value={slot.existingId ?? ""}
              onChange={(e) => handleExistingSelect(Number(e.target.value))}
            >
              <option value="">— pick one —</option>
              {existingWaypoints.map((wp) => (
                <option key={wp.id} value={wp.id}>
                  [{TYPE_LABELS[wp.type as WaypointType] ?? wp.type}] {wp.name.en}
                </option>
              ))}
            </select>
            {slot.existingId && (
              <p className="mt-1 text-[11px] text-[var(--color-text-muted)] flex items-center gap-1">
                <CheckCircle size={11} className="text-green-500" />
                {data.lat.toFixed(5)}, {data.lon.toFixed(5)}
              </p>
            )}
          </div>
        )}

        {/* New waypoint form */}
        {isNew && (
          <>
            {/* Photo picker */}
            <div>
              <p className={LABEL}>GPS from photo <span className="font-normal normal-case">(optional)</span></p>
              <button
                onClick={() => setShowPicker(true)}
                className="flex items-center gap-2 w-full rounded-xl border border-dashed border-[var(--color-border)] p-2 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg-light)] transition-colors"
              >
                {pickedPhoto ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pickedPhoto.previewUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-none" />
                    <span className="text-xs text-[var(--color-text-body)]">
                      {pickedPhoto.lat != null
                        ? `${pickedPhoto.lat.toFixed(5)}, ${pickedPhoto.lon?.toFixed(5)}${pickedPhoto.ele != null ? ` · ${Math.round(pickedPhoto.ele)} m` : ""}`
                        : "No EXIF GPS — coordinates set manually"}
                    </span>
                  </>
                ) : (
                  <>
                    <Icon icon="ph:image" width={20} height={20} />
                    <span>Pick a photo to get GPS coordinates</span>
                  </>
                )}
              </button>
            </div>

            {/* Type */}
            <div>
              <p className={LABEL}>Type</p>
              <select
                className={INPUT}
                value={data.type ?? ""}
                onChange={(e) => setField("type", e.target.value as WaypointType)}
              >
                <option value="">— select type —</option>
                {(Object.keys(TYPE_LABELS) as WaypointType[]).map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>

            {/* Name — hidden for STATION (derived from subwayStation) */}
            {data.type !== "STATION" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className={LABEL}>Name (EN)</p>
                  <input className={INPUT} value={data.nameEn} onChange={(e) => setField("nameEn", e.target.value)} placeholder="Dobongsan Trailhead" />
                </div>
                <div>
                  <p className={LABEL}>Name (KO)</p>
                  <input className={INPUT} value={data.nameKo} onChange={(e) => setField("nameKo", e.target.value)} placeholder="도봉산 등산로 입구" />
                </div>
              </div>
            )}

            {/* GPS coords */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className={LABEL}>Lat</p>
                <input className={INPUT} type="number" step="0.000001" value={data.lat || ""} onChange={(e) => setField("lat", parseFloat(e.target.value) || 0)} placeholder="37.689" />
              </div>
              <div>
                <p className={LABEL}>Lon</p>
                <input className={INPUT} type="number" step="0.000001" value={data.lon || ""} onChange={(e) => setField("lon", parseFloat(e.target.value) || 0)} placeholder="127.047" />
              </div>
              <div>
                <p className={LABEL}>Ele (m)</p>
                <input className={INPUT} type="number" value={data.elevationM ?? ""} onChange={(e) => setField("elevationM", e.target.value ? parseFloat(e.target.value) : undefined)} placeholder="820" />
              </div>
            </div>

            {/* STATION-specific fields */}
            {data.type === "STATION" && (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className={LABEL}>Line(s)</p>
                    <input className={INPUT} value={data.subwayLine ?? ""} onChange={(e) => setField("subwayLine", e.target.value)} placeholder="1, 7" />
                  </div>
                  <div>
                    <p className={LABEL}>Exit</p>
                    <input className={INPUT} value={data.exitNumber ?? ""} onChange={(e) => setField("exitNumber", e.target.value)} placeholder="2" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className={LABEL}>Station name (EN)</p>
                    <input
                      className={INPUT}
                      value={data.subwayStationEn ?? ""}
                      onChange={(e) => {
                        const en = e.target.value;
                        onChange({ ...slot, data: { ...slot.data, subwayStationEn: en, nameEn: en ? `${en} Station` : "" } });
                      }}
                      placeholder="Dobongsan"
                    />
                  </div>
                  <div>
                    <p className={LABEL}>Station name (KO)</p>
                    <input
                      className={INPUT}
                      value={data.subwayStation ?? ""}
                      onChange={(e) => {
                        const ko = e.target.value;
                        onChange({ ...slot, data: { ...slot.data, subwayStation: ko, nameKo: ko ? `${ko}역` : "" } });
                      }}
                      placeholder="도봉산"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* BUS_STOP-specific fields */}
            {data.type === "BUS_STOP" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className={LABEL}>ARS ID</p>
                    <input className={INPUT} value={data.arsId ?? ""} onChange={(e) => setField("arsId", e.target.value)} placeholder="22194" />
                  </div>
                  <div>
                    <p className={LABEL}>Bus number(s)</p>
                    <input className={INPUT} value={data.busNumbers ?? ""} onChange={(e) => setField("busNumbers", e.target.value)} placeholder="704, 34" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className={LABEL}>Bus color</p>
                    <select
                      className={INPUT}
                      value={data.busColor ?? ""}
                      onChange={(e) => setField("busColor", e.target.value)}
                    >
                      <option value="">— select —</option>
                      {BUS_COLORS.map((bc) => (
                        <option key={bc.value} value={bc.value}>{bc.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className={LABEL}>Bus duration (min)</p>
                    <input className={INPUT} type="number" value={data.busDurationMin ?? ""} onChange={(e) => setField("busDurationMin", e.target.value ? parseInt(e.target.value) : undefined)} placeholder="20" />
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* GPS summary for existing */}
        {!isNew && slot.existingId && (
          <div className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
            <MapPin size={11} />
            {data.lat.toFixed(5)}, {data.lon.toFixed(5)}
            {data.elevationM ? ` · ${data.elevationM} m` : ""}
          </div>
        )}
      </div>
    </>
  );
}

// ── Main exported component ───────────────────────────────────────────────────

export default function StepWaypoints({
  photos,
  existingWaypoints,
  slots,
  onChange,
}: {
  photos:            PhotoItem[];
  existingWaypoints: ExistingWaypoint[];
  slots:             WaypointSlot[];
  onChange:          (slots: WaypointSlot[]) => void;
}) {
  function addSlot() {
    const blank: WaypointSlot = {
      source: "new",
      data: {
        nameEn: "", nameKo: "", type: "JUNCTION",
        lat: 0, lon: 0,
      },
    };
    onChange([...slots, blank]);
  }

  function updateSlot(idx: number, updated: WaypointSlot) {
    const next = [...slots];
    next[idx] = updated;
    onChange(next);
  }

  function moveSlot(idx: number, dir: "up" | "down") {
    const next = [...slots];
    const target = dir === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  }

  function deleteSlot(idx: number) {
    onChange(slots.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
        Add waypoints in trail order — start station first, end station last.
        For each, pick a photo (EXIF GPS auto-fills coordinates) or enter manually.
        The track will be auto-split at these points.
      </p>

      {slots.map((slot, idx) => (
        <WaypointSlotCard
          key={idx}
          slot={slot}
          index={idx}
          total={slots.length}
          photos={photos}
          existingWaypoints={existingWaypoints}
          onChange={(updated) => updateSlot(idx, updated)}
          onMove={(dir) => moveSlot(idx, dir)}
          onDelete={() => deleteSlot(idx)}
        />
      ))}

      <button
        onClick={addSlot}
        className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--color-border)] py-3 text-sm font-semibold text-[var(--color-text-muted)] hover:border-primary hover:text-primary transition-colors"
      >
        <Plus size={16} />
        Add waypoint
      </button>
    </div>
  );
}
