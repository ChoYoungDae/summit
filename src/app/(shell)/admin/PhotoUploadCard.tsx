"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Camera, CheckCircle, AlertCircle, Trash2, Save, X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, RefreshCw } from "lucide-react";
import { Icon } from "@iconify/react";

// ── Shared style tokens ───────────────────────────────────────────────────────
const CARD        = "rounded-2xl bg-card border border-[var(--color-border)] p-5 flex flex-col gap-4";
const INPUT       = "rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm bg-[var(--color-bg-light)] focus:outline-none focus:ring-2 focus:ring-primary/40";
const BTN_PRIMARY = "flex items-center justify-center gap-2 rounded-xl bg-primary text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed";

// ── Types ─────────────────────────────────────────────────────────────────────
type Mountain = { id: number; name: { en?: string; ko?: string } };
type RouteItem = { id: number; name: { en?: string; ko?: string } };
type Segment   = { id: number; segment_type: string };

interface PhotoEntry {
  /** Unique key within the upload session */
  key:           string;
  file:          File;
  previewUrl:    string;
  /** GPS coords extracted client-side from EXIF */
  lat:           number | null;
  lon:           number | null;
  hasGps:        boolean;
  /** Set after server responds */
  id?:           number;
  url?:          string;
  segmentId:     number | null;
  /** Was the segment auto-mapped by the server? */
  autoMapped:    boolean;
  /** Cumulative metres from route start — used for sort order */
  orderIndex:    number;
  descriptionEn: string;
  descriptionKo: string;
  state: "pending" | "uploading" | "uploaded" | "saving" | "saved" | "error";
  errorMsg?: string;
}

/** Keep saved photos sorted by trail position; in-progress ones stay at the end */
function sortPhotos(photos: PhotoEntry[]): PhotoEntry[] {
  return [...photos].sort((a, b) => {
    const aInProgress = a.state === "pending" || a.state === "uploading";
    const bInProgress = b.state === "pending" || b.state === "uploading";
    if (aInProgress !== bInProgress) return aInProgress ? 1 : -1;
    return a.orderIndex - b.orderIndex;
  });
}

// ── Client-side helpers ───────────────────────────────────────────────────────

/** Resize image to maxPx and encode as WebP at quality 0.8 using Canvas API. */
async function processImage(file: File, maxPx = 1200): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const { width, height } = img;
      const scale  = Math.min(1, maxPx / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(width  * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context unavailable"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("toBlob failed")),
        "image/webp",
        0.8,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Image load failed")); };
    img.src = objectUrl;
  });
}

/** Extract GPS lat/lon from image EXIF using the exifr library (browser). */
async function extractGps(file: File): Promise<{ lat: number; lon: number } | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const exifr = await import("exifr");
    const gps = await exifr.gps(file);
    if (gps?.latitude != null && gps?.longitude != null) {
      return { lat: gps.latitude, lon: gps.longitude };
    }
  } catch { /* no EXIF */ }
  return null;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
      {children}
    </p>
  );
}

function StatusPill({ state, errorMsg }: { state: PhotoEntry["state"]; errorMsg?: string }) {
  if (state === "uploading" || state === "saving") {
    return (
      <span className="flex items-center gap-1 text-[10px] font-medium text-[var(--color-text-muted)]">
        <div className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
        {state === "uploading" ? "Uploading…" : "Saving…"}
      </span>
    );
  }
  if (state === "saved" || state === "uploaded") {
    return (
      <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
        <CheckCircle className="w-3 h-3" />
        {state === "saved" ? "Saved" : "Uploaded"}
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="flex items-center gap-1 text-[10px] font-medium text-red-500">
        <AlertCircle className="w-3 h-3" />
        {errorMsg ?? "Error"}
      </span>
    );
  }
  return null;
}

function Lightbox({
  photos,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  photos: PhotoEntry[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const entry = photos[index];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape")     onClose();
      if (e.key === "ArrowLeft")  onPrev();
      if (e.key === "ArrowRight") onNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      {/* Close */}
      <button
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        onClick={onClose}
      >
        <X className="w-5 h-5" />
      </button>

      {/* Prev */}
      {photos.length > 1 && (
        <button
          className="absolute left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          onClick={e => { e.stopPropagation(); onPrev(); }}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={entry.previewUrl}
        alt=""
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={e => e.stopPropagation()}
      />

      {/* Next */}
      {photos.length > 1 && (
        <button
          className="absolute right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          onClick={e => { e.stopPropagation(); onNext(); }}
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Counter */}
      {photos.length > 1 && (
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/60 font-num">
          {index + 1} / {photos.length}
        </p>
      )}
    </div>,
    document.body,
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PhotoUploadCard() {
  const [mountains, setMountains]   = useState<Mountain[]>([]);
  const [mountainId, setMountainId] = useState("");
  const [routes, setRoutes]         = useState<RouteItem[]>([]);
  const [routeId, setRouteId]       = useState("");
  const [segments, setSegments]     = useState<Segment[]>([]);
  const [photos, setPhotos]         = useState<PhotoEntry[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const uploadingKeys = useRef(new Set<string>());

  // Load mountains on mount
  useEffect(() => {
    fetch("/api/admin/mountains").then(r => r.json())
      .then(data => { if (Array.isArray(data)) setMountains(data as Mountain[]); })
      .catch(() => {});
  }, []);

  async function handleMountainChange(mid: string) {
    setMountainId(mid);
    setRouteId("");
    setRoutes([]);
    setSegments([]);
    setPhotos([]);
    if (!mid) return;
    setLoadingRoutes(true);
    try {
      const [routeRes, segRes] = await Promise.all([
        fetch(`/api/admin/routes?mountainId=${mid}`).then(r => r.json()),
        fetch(`/api/admin/segments?mountainId=${mid}`).then(r => r.json()),
      ]);
      if (Array.isArray(routeRes)) setRoutes(routeRes as RouteItem[]);
      if (Array.isArray(segRes))   setSegments(segRes as Segment[]);
    } catch { /* ignore */ }
    finally { setLoadingRoutes(false); }
  }

  async function handleRouteChange(rid: string) {
    setRouteId(rid);
    setPhotos([]);
    if (!rid) return;
    // Load existing photos for this route
    try {
      const data = await fetch(`/api/admin/route-photos?routeId=${rid}`).then(r => r.json());
      if (Array.isArray(data)) {
        const existing: PhotoEntry[] = data.map((p: {
          id: number; url: string; lat: number | null; lon: number | null;
          segmentId: number | null; orderIndex: number | null;
          description: Record<string, string> | null;
        }) => ({
          key:           `existing-${p.id}`,
          file:          new File([], ""),
          previewUrl:    p.url,
          lat:           p.lat,
          lon:           p.lon,
          hasGps:        p.lat != null && p.lon != null,
          id:            p.id,
          url:           p.url,
          segmentId:     p.segmentId,
          autoMapped:    false,
          orderIndex:    p.orderIndex ?? 999_999,
          descriptionEn: p.description?.en ?? "",
          descriptionKo: p.description?.ko ?? "",
          state:         "saved" as const,
        }));
        setPhotos(existing); // API already returns them ordered by order_index
      }
    } catch { /* ignore */ }
  }

  async function handleFiles(files: FileList) {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (!imageFiles.length) return;

    // Add pending entries immediately so the user sees thumbnails
    const newEntries: PhotoEntry[] = imageFiles.map(file => ({
      key:           `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      previewUrl:    URL.createObjectURL(file),
      lat:           null,
      lon:           null,
      hasGps:        false,
      segmentId:     null,
      autoMapped:    false,
      orderIndex:    999_999,
      descriptionEn: "",
      descriptionKo: "",
      state:         "pending",
    }));

    setPhotos(prev => [...prev, ...newEntries]);

    // Process + upload each file
    for (const entry of newEntries) {
      if (uploadingKeys.current.has(entry.key)) continue;
      uploadingKeys.current.add(entry.key);
      // Mark uploading
      setPhotos(prev => prev.map(p => p.key === entry.key ? { ...p, state: "uploading" } : p));

      try {
        // 1. Extract EXIF GPS from original (before WebP conversion strips it)
        const gps = await extractGps(entry.file);

        // 2. Resize + convert to WebP client-side
        const webpBlob = await processImage(entry.file);

        // 3. Build FormData for server
        const fd = new FormData();
        fd.append("routeId",  routeId);
        fd.append("photo_0",  new File([webpBlob], entry.file.name, { type: "image/webp" }));
        fd.append("name_0",   entry.file.name);
        if (gps) {
          fd.append("lat_0", String(gps.lat));
          fd.append("lon_0", String(gps.lon));
        }

        // 4. Upload to server
        const res = await fetch("/api/admin/route-photos", { method: "POST", body: fd });
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(error);
        }
        const { photos: uploaded } = await res.json() as { photos: {
          id: number; url: string; segmentId: number | null; autoMapped: boolean; orderIndex: number;
        }[] };
        const up = uploaded[0];

        setPhotos(prev => sortPhotos(prev.map(p =>
          p.key !== entry.key ? p : {
            ...p,
            lat:        gps?.lat ?? null,
            lon:        gps?.lon ?? null,
            hasGps:     gps != null,
            id:         up.id,
            url:        up.url,
            segmentId:  up.segmentId,
            autoMapped: up.autoMapped,
            orderIndex: up.orderIndex ?? 999_999,
            state:      "uploaded",
          }
        )));
      } catch (err) {
        setPhotos(prev => prev.map(p =>
          p.key !== entry.key ? p : {
            ...p,
            state:    "error",
            errorMsg: err instanceof Error ? err.message : "Upload failed",
          }
        ));
      } finally {
        uploadingKeys.current.delete(entry.key);
      }
    }
  }

  async function saveDescription(entry: PhotoEntry) {
    if (!entry.id) return;
    setPhotos(prev => prev.map(p => p.key === entry.key ? { ...p, state: "saving" } : p));
    try {
      const res = await fetch("/api/admin/route-photos", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id:          entry.id,
          description: (entry.descriptionEn || entry.descriptionKo) ? {
            ...(entry.descriptionEn ? { en: entry.descriptionEn } : {}),
            ...(entry.descriptionKo ? { ko: entry.descriptionKo } : {}),
          } : null,
          segment_id: entry.segmentId,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error);
      }
      setPhotos(prev => prev.map(p => p.key === entry.key ? { ...p, state: "saved" } : p));
    } catch (err) {
      setPhotos(prev => prev.map(p =>
        p.key === entry.key
          ? { ...p, state: "error", errorMsg: err instanceof Error ? err.message : "Save failed" }
          : p
      ));
    }
  }

  async function deletePhoto(entry: PhotoEntry) {
    if (!entry.id) {
      // Not yet uploaded — just remove from local list
      URL.revokeObjectURL(entry.previewUrl);
      setPhotos(prev => prev.filter(p => p.key !== entry.key));
      return;
    }
    if (!confirm("Delete this photo? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/admin/route-photos?id=${entry.id}`, { method: "DELETE" });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error);
      }
      URL.revokeObjectURL(entry.previewUrl);
      setPhotos(prev => prev.filter(p => p.key !== entry.key));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }

  function updateField(key: string, field: "descriptionEn" | "descriptionKo" | "segmentId", value: string | number | null) {
    setPhotos(prev => prev.map(p =>
      p.key !== key ? p : { ...p, [field]: value, state: p.state === "saved" ? "uploaded" : p.state }
    ));
  }

  async function movePhoto(index: number, direction: -1 | 1) {
    const j = index + direction;
    if (j < 0 || j >= photos.length) return;

    const newPhotos = [...photos];
    // Swap positions
    [newPhotos[index], newPhotos[j]] = [newPhotos[newPhotos.length > j ? j : index], newPhotos[index]];
    // To fix out of bounds if j was bad, but we checked.
    // Re-index all to be safe and ensure unique orderIndex
    const payload = newPhotos
      .map((p, i) => ({ ...p, orderIndex: i * 100 }));
    
    setPhotos(payload);

    // Save strictly to DB
    const dbPayload = payload
      .filter(p => p.id)
      .map(p => ({ id: p.id, order_index: p.orderIndex }));
    
    if (dbPayload.length) {
      fetch("/api/admin/route-photos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dbPayload),
      }).catch(console.error);
    }
  }

  async function recalculateOrder(entry: PhotoEntry) {
    if (!entry.id) return;
    setPhotos(prev => prev.map(p => p.id === entry.id ? { ...p, state: "saving" } : p));
    try {
      const res = await fetch("/api/admin/route-photos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id, recalculate: true }),
      });
      if (!res.ok) throw new Error("Recalculate failed");
      const updated = await res.json();
      setPhotos(prev => sortPhotos(prev.map(p => p.id === entry.id ? {
        ...p,
        orderIndex: updated.orderIndex,
        segmentId:  updated.segmentId,
        state:      "saved",
      } : p)));
    } catch (err) {
      setPhotos(prev => prev.map(p => p.id === entry.id ? { ...p, state: "error", errorMsg: "Recalculate failed" } : p));
    }
  }

  const SEG_TYPE_COLORS: Record<string, string> = {
    APPROACH: "text-blue-600", ASCENT: "text-emerald-600",
    DESCENT: "text-purple-600", RETURN: "text-gray-500",
  };

  const canUpload = !!routeId;

  return (
    <div className={CARD}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#EEF5F1] flex items-center justify-center flex-shrink-0">
          <Camera className="w-4 h-4 text-[#2E5E4A]" />
        </div>
        <div>
          <span className="font-medium text-[1rem]" style={{ fontFamily: "var(--font-en)" }}>
            Photo Upload
          </span>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Upload trail photos — WebP conversion &amp; GPS mapping happen automatically.
          </p>
        </div>
      </div>

      {/* Mountain selector */}
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

      {/* Route selector */}
      {mountainId && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--color-text-muted)]">Route *</span>
          <select
            value={routeId}
            onChange={e => handleRouteChange(e.target.value)}
            disabled={loadingRoutes}
            className={INPUT}
          >
            <option value="">— Select route —</option>
            {routes.map(r => (
              <option key={r.id} value={r.id}>
                #{r.id} {r.name.en}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Upload area */}
      {canUpload && (
        <>
          <label
            className="border-2 border-dashed border-[var(--color-border)] rounded-xl p-6 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={e => {
              e.preventDefault();
              if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
            }}
          >
            <Icon icon="ph:camera-plus" width={32} height={32} className="text-[var(--color-text-muted)]" />
            <div className="text-center">
              <p className="text-sm font-medium">Tap to select photos</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Or drag &amp; drop — WebP · max 1200px · GPS auto-mapped
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ""; }}
            />
          </label>

          {/* Photo list */}
          {photos.length > 0 && (
            <div className="flex flex-col gap-3">
              <SectionLabel>{photos.length} photo{photos.length !== 1 ? "s" : ""}</SectionLabel>

              {photos.map(entry => (
                <div
                  key={entry.key}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-light)] overflow-hidden"
                >
                  {/* Top row: thumbnail + GPS info + status */}
                  <div className="flex gap-3 p-3">
                    {/* Thumbnail */}
                    <div
                      className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 cursor-pointer"
                      onClick={() => setLightboxIndex(photos.indexOf(entry))}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={entry.previewUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      {(entry.state === "uploading" || entry.state === "saving") && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium truncate">{entry.file.name || "Photo"}</p>
                        <div className="flex items-center gap-0.5">
                          <div className="flex flex-col">
                            <button
                              onClick={() => movePhoto(photos.indexOf(entry), -1)}
                              disabled={photos.indexOf(entry) <= 0}
                              className="p-0.5 text-[var(--color-text-muted)] hover:text-primary disabled:opacity-20"
                              title="Move up"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => movePhoto(photos.indexOf(entry), 1)}
                              disabled={photos.indexOf(entry) >= photos.length - 1}
                              className="p-0.5 text-[var(--color-text-muted)] hover:text-primary disabled:opacity-20"
                              title="Move down"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <button
                            onClick={() => deletePhoto(entry)}
                            className="flex-shrink-0 p-1 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Delete photo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* GPS badge */}
                      {entry.hasGps ? (
                        <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 rounded px-1.5 py-0.5 self-start">
                          GPS {entry.lat?.toFixed(5)}, {entry.lon?.toFixed(5)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-[var(--color-text-muted)] bg-gray-100 rounded px-1.5 py-0.5 self-start">
                          No GPS data
                        </span>
                      )}

                      <StatusPill state={entry.state} errorMsg={entry.errorMsg} />
                    </div>
                  </div>

                  {/* Description + segment — only shown once uploaded */}
                  {(entry.id != null) && (
                    <div className="border-t border-[var(--color-border)] p-3 flex flex-col gap-2.5">
                      {/* Segment selector */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                          Segment
                          {entry.autoMapped && (
                            <span className="ml-1 text-emerald-600 normal-case tracking-normal">
                              · auto-mapped
                            </span>
                          )}
                        </span>
                        <select
                          value={entry.segmentId ?? ""}
                          onChange={e => updateField(entry.key, "segmentId", e.target.value ? parseInt(e.target.value) : null)}
                          className={INPUT + " text-xs py-1.5"}
                        >
                          <option value="">— None —</option>
                          {segments.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.segment_type} #{s.id}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Description EN */}
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                          Description (EN)
                        </span>
                        <textarea
                          rows={2}
                          placeholder="e.g. View from the ridge looking north toward Dobongsan…"
                          value={entry.descriptionEn}
                          onChange={e => updateField(entry.key, "descriptionEn", e.target.value)}
                          className={INPUT + " resize-none text-xs"}
                        />
                      </label>

                      {/* Description KO */}
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                          설명 (KO)
                        </span>
                        <textarea
                          rows={2}
                          placeholder="예) 능선에서 북쪽 도봉산 방향 전경…"
                          value={entry.descriptionKo}
                          onChange={e => updateField(entry.key, "descriptionKo", e.target.value)}
                          className={INPUT + " resize-none text-xs"}
                          style={{ fontFamily: "var(--font-ko)" }}
                        />
                      </label>

                      {/* Save button */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => recalculateOrder(entry)}
                          disabled={!entry.hasGps || entry.state === "saving"}
                          className="flex-none flex items-center justify-center rounded-xl bg-[var(--color-bg-light)] border border-[var(--color-border)] text-[var(--color-text-muted)] px-3 py-2 text-xs hover:border-primary hover:text-primary transition-colors disabled:opacity-30"
                          title="GPS 기반 순서 재계산"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${entry.state === "saving" ? "animate-spin" : ""}`} />
                        </button>
                        <button
                          onClick={() => saveDescription(entry)}
                          disabled={entry.state === "saving" || entry.state === "uploading" || entry.state === "saved"}
                          className={BTN_PRIMARY + " flex-1"}
                        >
                          <Save className="w-3.5 h-3.5" />
                          Save Info
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

      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex(i => i !== null ? (i - 1 + photos.length) % photos.length : null)}
          onNext={() => setLightboxIndex(i => i !== null ? (i + 1) % photos.length : null)}
        />
      )}
    </div>
  );
}
