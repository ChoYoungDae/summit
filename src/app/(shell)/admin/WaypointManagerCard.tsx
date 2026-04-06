"use client";

import { useState, useEffect, useRef } from "react";
import exifr from "exifr";
import { MapPin, Plus, Pencil, Trash2, CheckCircle, AlertCircle, X, ChevronDown, ImageIcon, RefreshCw } from "lucide-react";
import { toSlug } from "@/lib/slug";

const CARD          = "rounded-2xl bg-card border border-[var(--color-border)] p-5 flex flex-col gap-4";
const INPUT         = "rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm bg-[var(--color-bg-light)] focus:outline-none focus:ring-2 focus:ring-primary/40";
const BTN_PRIMARY   = "flex items-center justify-center gap-2 rounded-xl bg-primary text-white px-4 py-2 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed";
const BTN_SECONDARY = "flex items-center justify-center gap-2 rounded-xl border-2 border-primary text-primary px-4 py-2 text-sm font-semibold hover:bg-primary/5 transition-colors";
const BTN_DANGER    = "flex items-center justify-center gap-1 rounded-lg border border-red-200 text-red-600 px-2 py-1 text-xs hover:bg-red-50 transition-colors disabled:opacity-30";

type Mountain = { id: number; name: { en?: string; ko?: string } };

type WaypointType = "STATION" | "TRAILHEAD" | "SUMMIT" | "JUNCTION" | "SHELTER";

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
};

type FormState = {
  nameEn: string; nameKo: string; type: WaypointType;
  lat: string; lon: string; elevation_m: string;
  descEn: string; descKo: string;
  slug: string;
  exitNumber: string;
  imageFile: File | null; imagePreview: string;
};

const EMPTY_FORM: FormState = {
  nameEn: "", nameKo: "", type: "JUNCTION",
  lat: "", lon: "", elevation_m: "",
  descEn: "", descKo: "",
  slug: "",
  exitNumber: "",
  imageFile: null, imagePreview: "",
};

const TYPE_LABELS: Record<WaypointType, string> = {
  STATION:  "Station",
  TRAILHEAD: "Trailhead",
  SUMMIT:   "Summit",
  JUNCTION: "Junction",
  SHELTER:  "Shelter",
};

const TYPE_COLORS: Record<WaypointType, string> = {
  STATION:  "bg-blue-100 text-blue-700",
  TRAILHEAD: "bg-green-100 text-green-700",
  SUMMIT:   "bg-amber-100 text-amber-700",
  JUNCTION: "bg-purple-100 text-purple-700",
  SHELTER:  "bg-gray-100 text-gray-600",
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
  initial, existingImage, mountainSlug,
  onSave, onCancel, saving, error,
}: {
  initial: FormState;
  existingImage?: string | null;
  mountainSlug: string;
  onSave: (f: FormState) => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
}) {
  const [f, setF]         = useState<FormState>(initial);
  const [exifHit, setExifHit] = useState<boolean | null>(null);
  const photoRef          = useRef<HTMLInputElement>(null);

  const set = (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setF(prev => ({ ...prev, [k]: e.target.value }));

  async function handleImageChange(file: File | null) {
    if (!file) {
      setF(prev => ({ ...prev, imageFile: null, imagePreview: "" }));
      setExifHit(null);
      return;
    }
    const preview = URL.createObjectURL(file);
    setF(prev => ({ ...prev, imageFile: file, imagePreview: preview }));
    try {
      const tags = await exifr.parse(file, { gps: true }) as Record<string, number> | null;
      const lat  = tags?.latitude  ?? tags?.GPSLatitude;
      const lon  = tags?.longitude ?? tags?.GPSLongitude;
      const alt  = tags?.altitude  ?? tags?.GPSAltitude;
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        setF(prev => ({
          ...prev,
          lat: (lat as number).toFixed(6),
          lon: (lon as number).toFixed(6),
          ...(Number.isFinite(alt) ? { elevation_m: String(Math.round(alt as number)) } : {}),
        }));
        setExifHit(true);
      } else {
        setExifHit(false);
      }
    } catch {
      setExifHit(false);
    }
  }

  const displayImage = f.imagePreview || existingImage || null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-bg-light)]">
      {/* Image — top so EXIF fills coords before user touches other fields */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-[var(--color-text-muted)]">
          Photo <span className="text-[10px]">(GPS auto-filled from EXIF)</span>
        </span>
        <div className="flex items-center gap-3">
          {displayImage ? (
            <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-[var(--color-border)] flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={displayImage} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => { handleImageChange(null); if (photoRef.current) photoRef.current.value = ""; }}
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ) : (
            <div className="w-16 h-16 rounded-lg border-2 border-dashed border-[var(--color-border)] flex items-center justify-center flex-shrink-0">
              <ImageIcon className="w-5 h-5 text-[var(--color-text-muted)]" />
            </div>
          )}
          <input ref={photoRef} type="file" accept="image/*"
            onChange={e => handleImageChange(e.target.files?.[0] ?? null)}
            className="text-sm file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:bg-primary file:text-white file:text-xs file:cursor-pointer" />
        </div>
      </div>

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
        </select>
      </label>

      {/* Exit Number — only for Stations */}
      {f.type === "STATION" && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--color-text-muted)]">Subway Exit Number (e.g. 4)</span>
          <div className="flex items-center gap-2">
            <div className="w-[30px] h-[30px] rounded-lg bg-[#2D2D2D] flex items-center justify-center text-[#FFCE00] font-black text-[16px]">
              {f.exitNumber || "?"}
            </div>
            <input
              type="text"
              placeholder="4"
              value={f.exitNumber}
              onChange={set("exitNumber")}
              className={`${INPUT} flex-1`}
            />
          </div>
        </label>
      )}

      {/* Coordinates */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-text-muted)]">Lat / Lon / Elevation (m) *</span>
          {exifHit === true  && <span className="text-[10px] bg-[#EEF5F1] text-[#2E5E4A] px-1.5 py-0.5 rounded-full">GPS from EXIF</span>}
          {exifHit === false && <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full">No GPS — enter manually</span>}
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
          disabled={saving || !f.nameEn || !f.lat || !f.lon || !f.slug}
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
    if (f.imageFile)    form.append("image", f.imageFile);

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
      imageFile: null, imagePreview: "",
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
              mountainSlug={mountainSlug}
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
                      existingImage={w.image_url}
                      mountainSlug={mountainSlug}
                      onSave={handleSave}
                      onCancel={() => setMode("none")}
                      saving={saving}
                      error={formErr}
                    />
                  ) : (
                    <div className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] px-3 py-2.5">
                      {w.image_url ? (
                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-[var(--color-border)] flex-shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={w.image_url} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-light)] border border-dashed border-[var(--color-border)] flex items-center justify-center flex-shrink-0">
                          <ImageIcon className="w-4 h-4 text-[var(--color-text-muted)]" />
                        </div>
                      )}

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
                          {w.type === "STATION" && w.exit_number && (
                            <span className="text-[10px] bg-[#1A1A1A] text-[#F5C842] px-1.5 py-0.5 rounded-md font-black border border-[#F5C842]/40">
                              Exit {w.exit_number}
                            </span>
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
