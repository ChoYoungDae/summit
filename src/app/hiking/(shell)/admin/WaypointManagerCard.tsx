"use client";

import { useState, useEffect } from "react";
import { MapPin, Plus, Pencil, Trash2, CheckCircle, AlertCircle, X, ChevronDown, RefreshCw } from "lucide-react";
import { toSlug } from "@/lib/slug";

const CARD          = "rounded-2xl bg-card border border-[var(--color-border)] p-5 flex flex-col gap-4";
const INPUT         = "rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm bg-[var(--color-bg-light)] focus:outline-none focus:ring-2 focus:ring-primary/40";
const BTN_PRIMARY   = "flex items-center justify-center gap-2 rounded-xl bg-primary text-white px-4 py-2 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed";
const BTN_SECONDARY = "flex items-center justify-center gap-2 rounded-xl border-2 border-primary text-primary px-4 py-2 text-sm font-semibold hover:bg-primary/5 transition-colors";
const BTN_DANGER    = "flex items-center justify-center gap-1 rounded-lg border border-red-200 text-red-600 px-2 py-1 text-xs hover:bg-red-50 transition-colors disabled:opacity-30";

type Mountain = { id: number; name: { en?: string; ko?: string } };

type WaypointType = "STATION" | "TRAILHEAD" | "SUMMIT" | "JUNCTION" | "SHELTER" | "BUS_STOP";

type Waypoint = {
  id: number;
  mountain_id: number;
  slug?: string | null;
  name: { en: string; ko?: string };
  type: WaypointType;
  lat: number;
  lon: number;
  elevation_m?: number;
  image_url?: string | null;
  description?: { en?: string; ko?: string } | null;
  exit_number?: string | null;
  subway_line?: string | null;
  subway_station?: string | null;
  ars_id?: string | null;
  bus_numbers?: string | null;
};

type FormState = {
  nameEn: string; nameKo: string; type: WaypointType;
  lat: string; lon: string; elevation_m: string;
  descEn: string; descKo: string;
  slug: string;
  exitNumber: string;
  subwayLine: string;
  subwayStation: string;
  arsId: string;
  busNumbers: string;
};

const EMPTY_FORM: FormState = {
  nameEn: "", nameKo: "", type: "JUNCTION",
  lat: "", lon: "", elevation_m: "",
  descEn: "", descKo: "",
  slug: "",
  exitNumber: "",
  subwayLine: "",
  subwayStation: "",
  arsId: "",
  busNumbers: "",
};

const TYPE_LABELS: Record<WaypointType, string> = {
  STATION:  "Station",
  TRAILHEAD: "Trailhead",
  SUMMIT:   "Summit",
  JUNCTION: "Junction",
  SHELTER:  "Shelter",
  BUS_STOP: "Bus Stop",
};

const TYPE_COLORS: Record<WaypointType, string> = {
  STATION:  "bg-blue-100 text-blue-700",
  TRAILHEAD: "bg-green-100 text-green-700",
  SUMMIT:   "bg-amber-100 text-amber-700",
  JUNCTION: "bg-purple-100 text-purple-700",
  SHELTER:  "bg-gray-100 text-gray-600",
  BUS_STOP: "bg-teal-100 text-teal-700",
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

function WaypointForm({
  initial,
  onSave, onCancel, saving, error,
}: {
  initial: FormState;
  onSave: (f: FormState) => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
}) {
  const [f, setF] = useState<FormState>(initial);

  const set = (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setF(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-bg-light)]">
      {/* Name */}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--color-text-muted)]">Name (EN) *</span>
          <input type="text" placeholder="Summit" value={f.nameEn} onChange={set("nameEn")} className={INPUT} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--color-text-muted)]">Name (KO)</span>
          <input type="text" placeholder="정상" value={f.nameKo} onChange={set("nameKo")}
            className={INPUT} style={{ fontFamily: "var(--font-ko)" }} />
        </label>
      </div>

      {/* Slug */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-[var(--color-text-muted)]">Slug *</span>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="sadang-station"
            value={f.slug}
            onChange={e => setF(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") }))}
            className={`${INPUT} flex-1 font-mono text-xs`}
          />
          <button
            type="button"
            title="Auto-generate from English name"
            onClick={() => setF(prev => ({ ...prev, slug: toSlug(prev.nameEn) }))}
            disabled={!f.nameEn}
            className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2.5 py-2 text-xs text-[var(--color-text-muted)] hover:text-primary hover:border-primary transition-colors disabled:opacity-30"
          >
            <RefreshCw className="w-3 h-3" /> Auto
          </button>
        </div>
      </div>

      {/* Type */}
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[var(--color-text-muted)]">Type</span>
        <select value={f.type} onChange={set("type")} className={INPUT}>
          <option value="STATION">Station</option>
          <option value="TRAILHEAD">Trailhead</option>
          <option value="SUMMIT">Summit</option>
          <option value="JUNCTION">Junction</option>
          <option value="SHELTER">Shelter</option>
          <option value="BUS_STOP">Bus Stop</option>
        </select>
      </label>

      {/* Subway Info — only for Stations */}
      {f.type === "STATION" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
             <span className="text-xs text-[var(--color-text-muted)]">Station Name (e.g. 사당 / Sadang)</span>
             <input type="text" placeholder="사당 (Sadang)" value={f.subwayStation} onChange={set("subwayStation")} className={INPUT} />
          </label>
          <label className="flex flex-col gap-1">
             <span className="text-xs text-[var(--color-text-muted)]">Subway Line (e.g. 2,4)</span>
             <input type="text" placeholder="2, 4" value={f.subwayLine} onChange={set("subwayLine")} className={INPUT} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[var(--color-text-muted)]">Exit (e.g. 4)</span>
            <div className="flex items-center gap-2">
              <div className="w-[36px] h-[36px] rounded-lg bg-[#2D2D2D] flex items-center justify-center text-[#FFCE00] font-black text-[16px] flex-shrink-0">
                {f.exitNumber || "?"}
              </div>
              <input type="text" placeholder="4" value={f.exitNumber} onChange={set("exitNumber")} className={`${INPUT} flex-1 min-w-0`} />
            </div>
          </label>
        </div>
      )}

      {/* ARS ID & Bus Numbers — only for Bus Stops */}
      {f.type === "BUS_STOP" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[var(--color-text-muted)]">ARS ID (e.g. 22194)</span>
            <div className="flex items-center gap-2">
              <div className="w-[36px] h-[36px] rounded-lg bg-[#2D2D2D] flex items-center justify-center text-teal-400 font-black text-[12px] flex-shrink-0">
                ID
              </div>
              <input type="text" placeholder="22194" value={f.arsId} onChange={set("arsId")} className={`${INPUT} flex-1`} />
            </div>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[var(--color-text-muted)]">Bus Numbers (e.g. 704, 34)</span>
            <div className="flex items-center gap-2">
              <div className="w-[36px] h-[36px] rounded-lg bg-[#2D2D2D] flex items-center justify-center text-teal-200 font-black text-[10px] flex-shrink-0">
                BUS
              </div>
              <input type="text" placeholder="704, 34" value={f.busNumbers} onChange={set("busNumbers")} className={`${INPUT} flex-1`} />
            </div>
          </label>
        </div>
      )}

      {/* Coordinates */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-text-muted)]">
            Lat / Lon / Elevation (m){f.type === "SUMMIT" ? " *" : ""}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input type="text" inputMode="decimal" placeholder="37.123456" value={f.lat} onChange={set("lat")}
            className={`${INPUT} font-mono`} />
          <input type="text" inputMode="decimal" placeholder="126.987654" value={f.lon} onChange={set("lon")}
            className={`${INPUT} font-mono`} />
          <input type="text" inputMode="decimal" placeholder="0" value={f.elevation_m} onChange={set("elevation_m")}
            className={`${INPUT} font-mono`} />
        </div>
      </div>

      {/* Description */}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--color-text-muted)]">Description (EN)</span>
          <textarea rows={2} placeholder="Brief description…" value={f.descEn} onChange={set("descEn")}
            className={`${INPUT} resize-none`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--color-text-muted)]">Description (KO)</span>
          <textarea rows={2} placeholder="간단한 설명…" value={f.descKo} onChange={set("descKo")}
            className={`${INPUT} resize-none`} style={{ fontFamily: "var(--font-ko)" }} />
        </label>
      </div>

      {error && <Alert type="error" message={error} />}

      <div className="flex gap-2">
        <button onClick={onCancel} className={BTN_SECONDARY} disabled={saving}>
          <X className="w-4 h-4" /> Cancel
        </button>
        <button onClick={() => onSave(f)}
          disabled={saving || !f.nameEn || !f.lat || !f.lon || !f.slug || (f.type === "SUMMIT" && !f.elevation_m)}
          className={BTN_PRIMARY}>
          {saving
            ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            : <CheckCircle className="w-4 h-4" />}
          Save
        </button>
      </div>
    </div>
  );
}

export default function WaypointManagerCard() {
  const [mountains, setMountains]   = useState<Mountain[]>([]);
  const [mountainId, setMountainId] = useState("");
  const [waypoints, setWaypoints]   = useState<Waypoint[]>([]);
  const [loading, setLoading]       = useState(false);
  const [loadErr, setLoadErr]       = useState("");

  const [mode, setMode]       = useState<"none" | "add" | number>("none");
  const [formInit, setFormInit] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]   = useState(false);
  const [formErr, setFormErr] = useState("");

  const [deleting, setDeleting] = useState<number | null>(null);
  const [toast, setToast]       = useState("");

  useEffect(() => {
    fetch("/api/admin/mountains").then(r => r.json())
      .then(data => { if (Array.isArray(data)) setMountains(data as Mountain[]); })
      .catch(() => {});
  }, []);

  async function loadWaypoints(mid: string) {
    setMountainId(mid);
    setMode("none");
    setLoadErr("");
    if (!mid) { setWaypoints([]); return; }
    setLoading(true);
    try {
      const res  = await fetch(`/api/admin/waypoints?mountainId=${mid}`);
      const data = await res.json() as Waypoint[] | { error: string };
      if (!Array.isArray(data)) throw new Error((data as { error: string }).error);
      setWaypoints(data);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }

  const selectedMountain = mountains.find(m => String(m.id) === mountainId);
  const mountainSlug     = selectedMountain
    ? (selectedMountain.name.en ?? String(selectedMountain.id)).toLowerCase().replace(/\s+/g, "-")
    : "unknown";

  async function handleSave(f: FormState) {
    setSaving(true);
    setFormErr("");
    const isEdit = typeof mode === "number";

    const form = new FormData();
    if (isEdit) {
      form.append("id", String(mode));
      form.append("mountainSlug", mountainSlug);
    } else {
      form.append("mountain_id", mountainId);
    }
    form.append("nameEn", f.nameEn);
    if (f.nameKo)       form.append("nameKo", f.nameKo);
    form.append("type",  f.type);
    if (f.slug)         form.append("slug",   f.slug);
    form.append("lat",   f.lat);
    form.append("lon",   f.lon);
    if (f.elevation_m)  form.append("elevation_m", f.elevation_m);
    if (f.descEn)       form.append("descEn", f.descEn);
    if (f.descKo)       form.append("descKo", f.descKo);
    if (f.exitNumber)   form.append("exit_number", f.exitNumber);
    if (f.subwayLine)   form.append("subway_line", f.subwayLine);
    if (f.subwayStation) form.append("subway_station", f.subwayStation);
    if (f.arsId)        form.append("ars_id", f.arsId);
    if (f.busNumbers)   form.append("bus_numbers", f.busNumbers);

    try {
      const res = await fetch("/api/admin/waypoints", {
        method: isEdit ? "PATCH" : "POST",
        body: form,
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error);
      }
      await loadWaypoints(mountainId);
      setMode("none");
      setToast(isEdit ? "Waypoint updated" : "Waypoint added");
      setTimeout(() => setToast(""), 3000);
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this waypoint?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/waypoints?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setWaypoints(prev => prev.filter(w => w.id !== id));
      setToast("Waypoint deleted");
      setTimeout(() => setToast(""), 3000);
    } catch {
      alert("Delete failed");
    } finally {
      setDeleting(null);
    }
  }

  function startEdit(w: Waypoint) {
    setFormInit({
      nameEn: w.name.en,
      nameKo: w.name.ko ?? "",
      type:   w.type,
      lat:    String(w.lat),
      lon:    String(w.lon),
      elevation_m: w.elevation_m != null ? String(w.elevation_m) : "",
      descEn: w.description?.en ?? "",
      descKo: w.description?.ko ?? "",
      slug:   w.slug ?? toSlug(w.name.en),
      exitNumber: w.exit_number ?? "",
      subwayLine: w.subway_line ?? "",
      subwayStation: w.subway_station ?? "",
      arsId: w.ars_id ?? "",
      busNumbers: w.bus_numbers ?? "",
    });
    setFormErr("");
    setMode(w.id);
  }

  return (
    <div className={CARD}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#EEF5F1] flex items-center justify-center flex-shrink-0">
          <MapPin className="w-4 h-4 text-[#2E5E4A]" />
        </div>
        <span className="font-medium text-[1rem]" style={{ fontFamily: "var(--font-en)" }}>
          Manage Waypoints
        </span>
      </div>

      {/* Mountain select */}
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[var(--color-text-muted)]">Select Mountain</span>
        <div className="relative">
          <select value={mountainId} onChange={e => loadWaypoints(e.target.value)}
            className={`${INPUT} w-full appearance-none pr-8`}>
            <option value="">— Choose a mountain —</option>
            {mountains.map(m => (
              <option key={m.id} value={m.id}>
                {m.name.en}{m.name.ko ? ` (${m.name.ko})` : ""}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
        </div>
      </label>

      {loadErr && <Alert type="error" message={loadErr} />}
      {loading  && <Alert type="loading" message="Loading waypoints…" />}

      {mountainId && !loading && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-muted)]">
              {waypoints.length} waypoint{waypoints.length !== 1 ? "s" : ""}
              {selectedMountain ? ` — ${selectedMountain.name.en}` : ""}
            </span>
            {mode === "none" && (
              <button onClick={() => { setFormInit(EMPTY_FORM); setFormErr(""); setMode("add"); }}
                className={BTN_PRIMARY}>
                <Plus className="w-4 h-4" /> Add Waypoint
              </button>
            )}
          </div>

          {mode === "add" && (
            <WaypointForm
              initial={formInit}
              onSave={handleSave}
              onCancel={() => setMode("none")}
              saving={saving}
              error={formErr}
            />
          )}

          {waypoints.length === 0 ? (
            mode !== "add" && (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-4">No waypoints yet.</p>
            )
          ) : (
            <div className="flex flex-col gap-2">
              {waypoints.map(w => (
                <div key={w.id}>
                  {mode === w.id ? (
                    <WaypointForm
                      initial={formInit}
                      onSave={handleSave}
                      onCancel={() => setMode("none")}
                      saving={saving}
                      error={formErr}
                    />
                  ) : (
                    <div className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">{w.name.en}</span>
                          {w.name.ko && (
                            <span className="text-xs text-[var(--color-text-muted)]" style={{ fontFamily: "var(--font-ko)" }}>
                              {w.name.ko}
                            </span>
                          )}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[w.type] ?? "bg-gray-100 text-gray-600"}`}>
                            {TYPE_LABELS[w.type] ?? w.type}
                          </span>
                          {w.type === "STATION" && (
                            <div className="flex gap-1 flex-wrap">
                              {w.subway_line && w.subway_line.split(",").map(line => (
                                <span key={line.trim()} className="text-[10px] bg-[#EEF5F1] text-[#2E5E4A] px-1.5 py-0.5 rounded-md font-black border border-[#2E5E4A]/30">
                                  {line.trim()}
                                </span>
                              ))}
                              {w.subway_station && (
                                <span className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-md font-medium border border-[var(--color-border)]">
                                  {w.subway_station}
                                </span>
                              )}
                              {w.exit_number && (
                                <span className="text-[10px] bg-[#1A1A1A] text-[#F5C842] px-1.5 py-0.5 rounded-md font-black border border-[#F5C842]/40">
                                  Exit {w.exit_number}
                                </span>
                              )}
                            </div>
                          )}
                          {w.type === "BUS_STOP" && (
                            <div className="flex gap-1 flex-wrap">
                              {w.bus_numbers && w.bus_numbers.split(",").map(num => (
                                <span key={num.trim()} className="text-[10px] bg-[#EEF5F1] text-teal-700 px-1.5 py-0.5 rounded-md font-black border border-teal-200">
                                  {num.trim()}
                                </span>
                              ))}
                              {w.ars_id && (
                                <span className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-md font-medium border border-[var(--color-border)]">
                                  ID: {w.ars_id}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-[10px] text-[var(--color-text-muted)] font-mono mt-0.5">
                          {w.lat.toFixed(5)}, {w.lon.toFixed(5)}
                          {w.elevation_m != null ? ` · ${w.elevation_m}m` : ""}
                        </div>
                        {w.slug && (
                          <div className="text-[10px] font-mono mt-0.5 text-primary/70">{w.slug}</div>
                        )}
                      </div>

                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => startEdit(w)} disabled={mode !== "none"}
                          className="flex items-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] px-2 py-1 text-xs hover:text-primary hover:border-primary transition-colors disabled:opacity-30">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleDelete(w.id)} disabled={deleting === w.id || mode !== "none"}
                          className={BTN_DANGER}>
                          {deleting === w.id
                            ? <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" />
                            : <Trash2 className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {toast && <Alert type="success" message={toast} />}
    </div>
  );
}
