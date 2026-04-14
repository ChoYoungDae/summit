"use client";

import { useState, useEffect, useRef } from "react";
import { Camera, CheckCircle, AlertCircle, Trash2, Save } from "lucide-react";
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
  descriptionEn: string;
  descriptionKo: string;
  state: "pending" | "uploading" | "uploaded" | "saving" | "saved" | "error";
  errorMsg?: string;
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

// ── Main component ────────────────────────────────────────────────────────────

export default function PhotoUploadCard() {
  const [mountains, setMountains]   = useState<Mountain[]>([]);
  const [mountainId, setMountainId] = useState("");
  const [routes, setRoutes]         = useState<RouteItem[]>([]);
  const [routeId, setRouteId]       = useState("");
  const [segments, setSegments]     = useState<Segment[]>([]);
  const [photos, setPhotos]         = useState<PhotoEntry[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          segmentId: number | null; descriptionEn: string | null; descriptionKo: string | null;
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
          descriptionEn: p.descriptionEn ?? "",
          descriptionKo: p.descriptionKo ?? "",
          state:         "saved" as const,
        }));
        setPhotos(existing);
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
      descriptionEn: "",
      descriptionKo: "",
      state:         "pending",
    }));

    setPhotos(prev => [...prev, ...newEntries]);

    // Process + upload each file
    for (const entry of newEntries) {
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
          id: number; url: string; segmentId: number | null; autoMapped: boolean;
        }[] };
        const up = uploaded[0];

        setPhotos(prev => prev.map(p =>
          p.key !== entry.key ? p : {
            ...p,
            lat:        gps?.lat ?? null,
            lon:        gps?.lon ?? null,
            hasGps:     gps != null,
            id:         up.id,
            url:        up.url,
            segmentId:  up.segmentId,
            autoMapped: up.autoMapped,
            state:      "uploaded",
          }
        ));
      } catch (err) {
        setPhotos(prev => prev.map(p =>
          p.key !== entry.key ? p : {
            ...p,
            state:    "error",
            errorMsg: err instanceof Error ? err.message : "Upload failed",
          }
        ));
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
          id:             entry.id,
          description_en: entry.descriptionEn || null,
          description_ko: entry.descriptionKo || null,
          segment_id:     entry.segmentId,
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
          <div
            className="border-2 border-dashed border-[var(--color-border)] rounded-xl p-6 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
            onClick={() => fileInputRef.current?.click()}
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
                Or drag &amp; drop — WebP ·  max 1200px · GPS auto-mapped
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
          </div>

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
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
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
                        <button
                          onClick={() => deletePhoto(entry)}
                          className="flex-shrink-0 p-1 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Delete photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
                              <span className={SEG_TYPE_COLORS[s.segment_type]}>{s.segment_type}</span>
                              {" "}#{s.id}
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
                      <button
                        onClick={() => saveDescription(entry)}
                        disabled={entry.state === "saving" || entry.state === "uploading"}
                        className={BTN_PRIMARY + " w-full"}
                      >
                        <Save className="w-3.5 h-3.5" />
                        Save Description
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
