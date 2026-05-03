"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronLeft, CheckCircle, AlertCircle, Mountain, Upload, Camera, Route, Save, Trash2 } from "lucide-react";
import { Icon } from "@iconify/react";
import { parseTrackFile, type TrackPoint } from "@/lib/parseGpx";
import { trackDistanceKm } from "@/lib/geo";

/** Find nearest track-point index for a GPS coord — used to sort photos by trail order */
function trackIndexForCoord(lat: number, lon: number, track: TrackPoint[]): number {
  let best = 0, bestDist = Infinity;
  for (let i = 0; i < track.length; i++) {
    const [tLon, tLat] = track[i];
    const d = (tLat - lat) ** 2 + (tLon - lon) ** 2; // squared OK for comparison
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}
import StepWaypoints from "./StepWaypoints";
import StepSegments from "./StepSegments";
import type { PhotoItem, WaypointSlot, WaypointType, ExistingWaypoint, SegmentPreview, ExistingSegment } from "./types";

// ── Waypoint type labels / colors (Korean admin UI) ───────────────────────────

const WP_TYPE_KO: Record<WaypointType, string> = {
  STATION:   "역",
  BUS_STOP:  "버스",
  TRAILHEAD: "입구",
  SUMMIT:    "정상",
  PEAK:      "봉우리",
  JUNCTION:  "갈림길",
  SHELTER:   "쉼터",
  VIEW:      "전망",
  LANDMARK:  "랜드마크",
  CAUTION:   "주의",
};

const WP_TYPE_BADGE: Record<WaypointType, string> = {
  STATION:   "bg-blue-500/80 text-white",
  BUS_STOP:  "bg-teal-500/80 text-white",
  TRAILHEAD: "bg-green-500/80 text-white",
  SUMMIT:    "bg-amber-500/80 text-white",
  PEAK:      "bg-orange-500/80 text-white",
  JUNCTION:  "bg-purple-500/80 text-white",
  SHELTER:   "bg-gray-500/80 text-white",
  VIEW:      "bg-cyan-500/80 text-white",
  LANDMARK:  "bg-indigo-500/80 text-white",
  CAUTION:   "bg-red-500/80 text-white",
};

// ── Style tokens ──────────────────────────────────────────────────────────────

const INPUT       = "rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm bg-[var(--color-bg-light)] focus:outline-none focus:ring-2 focus:ring-primary/40 w-full";
const BTN_PRIMARY = "flex items-center justify-center gap-2 rounded-xl bg-primary text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed";
const BTN_GHOST   = "flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-bg-light)] transition-colors";
const LABEL       = "text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]";
const CARD        = "rounded-2xl bg-white border border-[var(--color-border)] p-5 flex flex-col gap-4";

// ── Client-side image helpers (reused from PhotoUploadCard) ───────────────────

async function processImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1200;
      const scale  = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/webp", 0.8,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

async function extractGps(file: File): Promise<{ lat: number; lon: number; ele?: number } | null> {
  try {
    const exifr = await import("exifr");
    const result = await exifr.parse(file, { gps: true });
    if (result?.latitude != null && result?.longitude != null) {
      return { lat: result.latitude, lon: result.longitude, ele: result.altitude ?? result.GPSAltitude };
    }
  } catch { /* no EXIF */ }
  return null;
}

// ── Step indicator ────────────────────────────────────────────────────────────

const STEPS = [
  { label: "산 선택", icon: Mountain },
  { label: "GPS",    icon: Route },
  { label: "사진",   icon: Camera },
  { label: "지점",   icon: Mountain },
  { label: "구간",   icon: Route },
  { label: "저장",   icon: Save },
];

function StepBar({ current, onStepClick }: { current: number; onStepClick?: (step: number) => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-nowrap">
      {STEPS.map((s, i) => {
        const isPast = i < current;
        const isCurrent = i === current;
        const isClickable = isPast && onStepClick;

        return (
          <div key={i} className="flex items-center gap-1.5 flex-none">
            <button
              onClick={() => isClickable && onStepClick(i)}
              disabled={!isClickable}
              className={`flex items-center gap-1.5 transition-all group ${isClickable ? "cursor-pointer" : "cursor-default"}`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold transition-colors ${
                isPast    ? "bg-primary text-white group-hover:bg-primary/80" :
                isCurrent ? "bg-primary text-white ring-2 ring-primary/30" :
                "bg-[var(--color-bg-light)] text-[var(--color-text-muted)] border border-[var(--color-border)]"
              }`}>
                {isPast ? <CheckCircle size={13} /> : i + 1}
              </div>
              <span className={`text-[13px] font-medium ${
                isCurrent ? "text-primary" :
                isPast    ? "text-[var(--color-text-body)] group-hover:text-primary" :
                "text-[var(--color-text-muted)]"
              }`}>
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && <ChevronRight size={12} className="text-[var(--color-border)] flex-none" />}
          </div>
        );
      })}
    </div>
  );
}

// ── localStorage persistence ──────────────────────────────────────────────────

const STORAGE_KEY = "summit-new-route-wizard-v1";

type SavedState = {
  step: number;
  mountainId: number | null;
  trackPoints: TrackPoint[] | null;
  trackName: string;
  waypointSlots: WaypointSlot[];
  segments: SegmentPreview[];
  routeNameEn: string;
  routeNameKo: string;
  routeDifficulty: number;
  tags: { en: string; ko: string }[];
  highlights: { type: "highlight" | "pro_tip" | "warning"; en: string; ko: string }[];
  routeDescriptionEn: string;
  routeDescriptionKo: string;
};

function loadDraft(): Partial<SavedState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<SavedState>) : {};
  } catch { return {}; }
}

function clearDraft() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

// ── Main page component ───────────────────────────────────────────────────────

type Mountain = { id: number; name: { en?: string; ko?: string }; slug?: string };

export default function NewRoutePage() {
  const router = useRouter();

  // ── Restore from localStorage on first render ────────────────────────────
  const [draft] = useState<Partial<SavedState>>(loadDraft);

  // ── Global wizard state (initialised from draft if available) ────────────
  const [step, setStep] = useState(draft.step ?? 0);

  // Step 0: Mountain
  const [mountains,    setMountains]    = useState<Mountain[]>([]);
  const [mountainId,   setMountainId]   = useState<number | null>(draft.mountainId ?? null);
  const [mountainsLoaded, setMountainsLoaded] = useState(false);

  // Step 1: GPS
  const [trackPoints,  setTrackPoints]  = useState<TrackPoint[] | null>(draft.trackPoints ?? null);
  const [trackName,    setTrackName]    = useState(draft.trackName ?? "");

  // Step 2: Photos  (File objects can't be serialised — photos always start empty)
  const [photos,       setPhotos]       = useState<PhotoItem[]>([]);
  const [photoLoading, setPhotoLoading] = useState(false);

  // Step 3: Waypoints
  const [waypointSlots,     setWaypointSlots]     = useState<WaypointSlot[]>(draft.waypointSlots ?? []);
  const [existingWaypoints, setExistingWaypoints] = useState<ExistingWaypoint[]>([]);

  // Step 4: Segments
  const [segments,         setSegments]         = useState<SegmentPreview[]>(draft.segments ?? []);
  const [existingSegments, setExistingSegments] = useState<ExistingSegment[]>([]);
  const [segmentLoading,   setSegmentLoading]   = useState(false);

  // Step 5: Route meta + save
  const [routeNameEn,   setRouteNameEn]   = useState(draft.routeNameEn ?? "");
  const [routeNameKo,   setRouteNameKo]   = useState(draft.routeNameKo ?? "");
  const [routeDifficulty, setRouteDifficulty] = useState<number>(draft.routeDifficulty ?? 3);
  const [tags,       setTags]       = useState<{ en: string; ko: string }[]>(draft.tags ?? [{ en: "", ko: "" }]);
  const [highlights, setHighlights] = useState<{ type: "highlight" | "pro_tip" | "warning"; en: string; ko: string }[]>(draft.highlights ?? [{ type: "highlight", en: "", ko: "" }]);
  const [routeDescriptionEn, setRouteDescriptionEn] = useState(draft.routeDescriptionEn ?? "");
  const [routeDescriptionKo, setRouteDescriptionKo] = useState(draft.routeDescriptionKo ?? "");

  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);

  // ── Load existing waypoints + segments if mountainId is already set (e.g. from localStorage) ──
  useEffect(() => {
    if (mountainId) {
      loadExistingWaypoints(mountainId);
      loadExistingSegments(mountainId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount

  // ── Auto-save all serialisable state to localStorage ─────────────────────
  useEffect(() => {
    if (success) { clearDraft(); return; }
    const toSave: SavedState = {
      step, mountainId, trackPoints, trackName,
      waypointSlots, segments,
      routeNameEn, routeNameKo, routeDifficulty,
      tags, highlights, routeDescriptionEn, routeDescriptionKo,
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave)); } catch { /* quota */ }
  }, [
    step, mountainId, trackPoints, trackName,
    waypointSlots, segments,
    routeNameEn, routeNameKo, routeDifficulty,
    tags, highlights, routeDescriptionEn, routeDescriptionKo,
    success,
  ]);

  // ── Prevent accidental data loss ─────────────────────────────────────────
  useEffect(() => {
    const hasData = step > 0 || mountainId != null || waypointSlots.length > 0;
    if (!hasData || success) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [step, mountainId, waypointSlots.length, success]);

  const [isDraggingGpx,   setIsDraggingGpx]   = useState(false);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);

  const gpxInputRef   = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ── Load mountains (lazy on step 0 mount) ────────────────────────────────
  async function loadMountains() {
    if (mountainsLoaded) return;
    const res  = await fetch("/api/admin/mountains");
    const data = await res.json();
    setMountains(data ?? []);
    setMountainsLoaded(true);
  }

  // ── Load existing waypoints for this mountain ────────────────────────────
  async function loadExistingWaypoints(mid: number) {
    const res  = await fetch(`/api/admin/waypoints?mountainId=${mid}`);
    const data = await res.json();
    setExistingWaypoints(data ?? []);
  }

  // ── Load existing segments for this mountain ──────────────────────────────
  async function loadExistingSegments(mid: number) {
    const res  = await fetch(`/api/admin/segments?mountainId=${mid}`);
    const data = await res.json();
    setExistingSegments(Array.isArray(data) ? data : []);
  }

  // ── GPX parsing ──────────────────────────────────────────────────────────
  async function handleGpxFile(file: File) {
    try {
      const result = await parseTrackFile(file);
      setTrackPoints(result.points);
      setTrackName(result.name || file.name);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse GPS file");
    }
  }

  // ── Photo processing ─────────────────────────────────────────────────────
  async function handlePhotoFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!arr.length) return;
    setPhotoLoading(true);
    const processed: PhotoItem[] = [];
    for (const f of arr) {
      try {
        const [webpBlob, gps] = await Promise.all([processImage(f), extractGps(f)]);
        const webpFile = new File([webpBlob], f.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" });
        processed.push({
          key:          `${f.name}-${Date.now()}-${Math.random()}`,
          file:         webpFile,
          originalName: f.name,
          previewUrl:   URL.createObjectURL(webpBlob),
          lat:          gps?.lat,
          lon:          gps?.lon,
          ele:          gps?.ele,
          descEn:       "",
          descKo:       "",
        });
      } catch { /* skip broken images */ }
    }
    setPhotos((prev) => [...prev, ...processed]);
    setPhotoLoading(false);
  }

  // ── Navigation helpers ────────────────────────────────────────────────────
  async function next() {
    if (step === 0 && mountainId) {
      loadExistingWaypoints(mountainId);
      loadExistingSegments(mountainId);
    }

    // Step 2→3: 태깅된 사진으로 웨이포인트 슬롯 자동 생성 (슬롯이 비어있을 때만)
    if (step === 2 && waypointSlots.length === 0) {
      const tagged = photos.filter((p) => p.waypointType);
      if (tagged.length > 0) {
        setWaypointSlots(
          tagged.map((p) => ({
            source: "new" as const,
            sourcePhotoIdx: photos.indexOf(p),
            data: {
              nameEn:      "",
              nameKo:      "",
              type:        p.waypointType!,
              lat:         p.lat ?? 0,
              lon:         p.lon ?? 0,
              elevationM:  p.ele,
            },
          })),
        );
      }
    }

    // Moving from Waypoints (3) to Segments (4)
    if (step === 3) {
      setSegmentLoading(true);
      setError("");
      try {
        const waypointSpecs = waypointSlots.map((slot) => {
          if (slot.source === "existing" && slot.existingId) return { existingId: slot.existingId };
          return {
            nameEn: slot.data.nameEn,
            nameKo: slot.data.nameKo,
            type:   slot.data.type,
            lat:    slot.data.lat,
            lon:    slot.data.lon,
          };
        });

        const res = await fetch("/api/admin/create-route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mountainId,
            routeNameEn: "PREVIEW", // dummy
            trackPoints,
            waypointSpecs,
            preview: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to infer segments");
        setSegments(data.segments || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Segment inference failed");
        setSegmentLoading(false);
        return; // stay on current step
      }
      setSegmentLoading(false);
    }

    setError("");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function back() { setError(""); setStep((s) => Math.max(s - 1, 0)); }

  // ── Validation per step ───────────────────────────────────────────────────
  function canProceed(): boolean {
    switch (step) {
      case 0: return mountainId != null;
      case 1: return trackPoints != null && trackPoints.length > 0;
      case 2: return photos.length > 0;
      case 3: return waypointSlots.length >= 2 && waypointSlots.every((s) => {
        if (s.source === "existing") return !!s.existingId;
        // Types where nameEn is hidden in the UI — name is optional or auto-derived
        const noNameTypes = ["STATION", "JUNCTION", "PEAK", "VIEW", "LANDMARK", "SHELTER", "CAUTION"];
        const needsName = !noNameTypes.includes(s.data.type);
        return !!(s.data.type && s.data.lat && s.data.lon && (!needsName || s.data.nameEn));
      });
      case 4: return segments.length > 0;
      case 5: return !!routeNameEn;
      default: return true;
    }
  }

  // ── Final save ────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!mountainId || !trackPoints || !routeNameEn) return;
    setSaving(true);
    setError("");

    try {
      // Build waypoint specs for the API
      const waypointSpecs = waypointSlots.map((slot) => {
        if (slot.source === "existing" && slot.existingId) {
          return { existingId: slot.existingId };
        }
        const d = slot.data;
        return {
          nameEn:        d.nameEn,
          nameKo:        d.nameKo || undefined,
          type:          d.type,
          lat:           d.lat,
          lon:           d.lon,
          elevationM:    d.elevationM,
          exitNumber:    d.exitNumber   || undefined,
          subwayLine:    d.subwayLine   || undefined,
          subwayStation: d.subwayStation || undefined,
          arsId:         d.arsId        || undefined,
          busNumbers:    d.busNumbers   || undefined,
          busColor:      d.busColor     || undefined,
          busDurationMin: d.busDurationMin,
        };
      });

      const segmentSpecs = segments.map((s) => ({
        estimated_time_min:    s.durationMin,
        is_bus_combined:       s.isBusCombined ?? false,
        bus_duration_min:      s.busDurationMin,
        bus_color:             s.busColor,
        bus_numbers:           s.busNumbers,
        station_bus_stop_name: s.stationBusStopName,
      }));
      // null = create new from GPS; number = reuse existing segment ID
      const segmentOverrides = segments.map((s) =>
        s.source === "existing" && s.existingId ? s.existingId : null
      );
      // Waypoint boundary overrides for GPS re-slicing
      const segmentWpOverrides = segments.map((s) =>
        s.source === "new" && s.startWpIdx != null && s.endWpIdx != null
          ? { startWpIdx: s.startWpIdx, endWpIdx: s.endWpIdx }
          : null
      );

      // 1. Create waypoints + segments + route
      const createRes = await fetch("/api/admin/create-route", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mountainId,
          routeNameEn,
          routeNameKo:      routeNameKo || undefined,
          routeDifficulty:  routeDifficulty || undefined,
          trackPoints,
          waypointSpecs,
          segmentSpecs,
          segmentOverrides,
          segmentWpOverrides,
          tags:       tags.filter((t) => t.en || t.ko),
          highlights: highlights.filter((h) => h.en || h.ko),
          description: (routeDescriptionEn || routeDescriptionKo)
            ? { en: routeDescriptionEn, ko: routeDescriptionKo }
            : undefined,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error ?? "Route creation failed");

      const routeId: number = createData.routeId;

      // 2. Upload photos (if any) to the existing route-photos API
      if (photos.length > 0) {
        const form = new FormData();
        form.append("routeId", String(routeId));
        photos.forEach((p, i) => {
          form.append(`photo_${i}`, p.file, p.file.name);
          form.append(`lat_${i}`,  p.lat  != null ? String(p.lat)  : "");
          form.append(`lon_${i}`,  p.lon  != null ? String(p.lon)  : "");
          form.append(`name_${i}`, p.originalName);
        });
        const photoRes = await fetch("/api/admin/route-photos", { method: "POST", body: form });
        if (!photoRes.ok) {
          const pd = await photoRes.json();
          throw new Error(pd.error ?? "Photo upload failed");
        }

        // Save descriptions if any were entered
        const photoData = await photoRes.json() as { photos: { id: number }[] };
        const withDesc  = photos.filter((p, i) => (photoData.photos[i]?.id) && (p.descEn || p.descKo));
        for (let i = 0; i < withDesc.length; i++) {
          const p   = withDesc[i];
          const pid = photoData.photos[i]?.id;
          if (!pid) continue;
          await fetch("/api/admin/route-photos", {
            method:  "PATCH",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ id: pid, description_en: p.descEn || null, description_ko: p.descKo || null }),
          });
        }
      }

      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16 px-6 text-center">
        <CheckCircle size={56} className="text-primary" />
        <h2 className="text-lg font-bold text-[var(--color-text-body)]">Route created!</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Waypoints, segments, and photos have been saved.
        </p>
        <div className="flex gap-3">
          <button onClick={() => router.push("/admin")} className={BTN_GHOST}>
            Back to Admin
          </button>
          <button onClick={() => { clearDraft(); setSuccess(false); setStep(0); setMountainId(null); setTrackPoints(null); setTrackName(""); setPhotos([]); setWaypointSlots([]); setSegments([]); setRouteNameEn(""); setRouteNameKo(""); setRouteDifficulty(3); setTags([{ en: "", ko: "" }]); setHighlights([{ type: "highlight", en: "", ko: "" }]); setRouteDescriptionEn(""); setRouteDescriptionKo(""); }} className={BTN_PRIMARY}>
            Create another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="rounded-2xl bg-primary p-5 text-white">
        <p className="font-semibold text-[1.125rem]">New Route</p>
        <p className="text-white/70 text-sm mt-1">GPS → Photos → Waypoints → Segments → Save</p>
      </div>

      {/* Step bar */}
      <StepBar current={step} onStepClick={setStep} />

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm bg-red-50 text-red-600">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {/* ── Step 0: Mountain ── */}
      {step === 0 && (
        <div className={CARD}>
          <p className="text-sm font-semibold text-[var(--color-text-body)]">Select mountain</p>
          <select
            className={INPUT}
            value={mountainId ?? ""}
            onFocus={loadMountains}
            onChange={(e) => setMountainId(Number(e.target.value) || null)}
          >
            <option value="">— pick a mountain —</option>
            {mountains.map((m) => (
              <option key={m.id} value={m.id}>{m.name.ko ?? m.name.en}{m.name.ko && m.name.en ? ` (${m.name.en})` : ""}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Step 1: GPS ── */}
      {step === 1 && (
        <div className={CARD}>
          <p className="text-sm font-semibold text-[var(--color-text-body)]">Upload full GPS track</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            One GPX or GeoJSON file covering the entire hike — from station to station.
          </p>

          <input
            ref={gpxInputRef}
            type="file"
            accept=".gpx,.geojson"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleGpxFile(e.target.files[0]); }}
          />

          {trackPoints ? (
            <div
              className={`rounded-xl border-2 border-dashed p-3 flex flex-col gap-1 transition-colors ${
                isDraggingGpx
                  ? "border-primary bg-primary/5"
                  : "border-[var(--color-border)] bg-[var(--color-bg-light)]"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingGpx(true); }}
              onDragEnter={(e) => { e.preventDefault(); setIsDraggingGpx(true); }}
              onDragLeave={() => setIsDraggingGpx(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingGpx(false);
                const file = e.dataTransfer.files[0];
                if (file) handleGpxFile(file);
              }}
            >
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-body)]">
                <CheckCircle size={16} className="text-green-500" />
                {trackName}
              </div>
              <p className="text-sm text-[var(--color-text-muted)] font-num">
                {trackPoints.length.toLocaleString()} points · {trackDistanceKm(trackPoints)} km
              </p>
              <button
                onClick={() => gpxInputRef.current?.click()}
                className="mt-1 text-xs text-primary underline self-start"
              >
                Replace file
              </button>
            </div>
          ) : (
            <div
              onClick={() => gpxInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingGpx(true); }}
              onDragEnter={(e) => { e.preventDefault(); setIsDraggingGpx(true); }}
              onDragLeave={() => setIsDraggingGpx(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingGpx(false);
                const file = e.dataTransfer.files[0];
                if (file) handleGpxFile(file);
              }}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed py-8 cursor-pointer transition-colors ${
                isDraggingGpx
                  ? "border-primary text-primary bg-primary/5"
                  : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-primary hover:text-primary"
              }`}
            >
              <Upload size={28} />
              <span className="text-sm font-medium">
                {isDraggingGpx ? "Drop to upload" : "Tap or drop GPX / GeoJSON"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Photos ── */}
      {step === 2 && (
        <div className={CARD}>
          <p className="text-sm font-semibold text-[var(--color-text-body)]">Upload trail photos</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            All photos from this hike. EXIF GPS is extracted automatically.
            Photos will be resized and saved as WebP.
          </p>

          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files) handlePhotoFiles(e.target.files); }}
          />

          <div
            onClick={() => !photoLoading && photoInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); if (!photoLoading) setIsDraggingPhoto(true); }}
            onDragEnter={(e) => { e.preventDefault(); if (!photoLoading) setIsDraggingPhoto(true); }}
            onDragLeave={() => setIsDraggingPhoto(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingPhoto(false);
              if (!photoLoading && e.dataTransfer.files.length > 0) handlePhotoFiles(e.dataTransfer.files);
            }}
            className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed py-6 transition-colors ${
              photoLoading
                ? "border-primary/50 text-primary/50 cursor-wait"
                : isDraggingPhoto
                ? "border-primary text-primary bg-primary/5 cursor-copy"
                : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-primary hover:text-primary cursor-pointer"
            }`}
          >
            {photoLoading ? (
              <>
                <div className="w-6 h-6 rounded-full border-2 border-current border-t-transparent animate-spin" />
                <span className="text-sm font-medium">Processing…</span>
              </>
            ) : (
              <>
                <Camera size={28} />
                <span className="text-sm font-medium">
                  {isDraggingPhoto
                    ? "Drop to add photos"
                    : photos.length > 0
                    ? `${photos.length} photos — tap or drop to add more`
                    : "Tap or drop photos"}
                </span>
              </>
            )}
          </div>

          {photos.length > 0 && (
            <>
              <p className="text-sm text-[var(--color-text-muted)]">
                웨이포인트 사진은 유형을 선택하세요. 설명은 하이커 화면에 표시됩니다.
                {trackPoints && <span className="ml-1 text-primary font-medium">· GPS 기준 경로 순 정렬</span>}
              </p>
              <div className="flex flex-col gap-2">
                {[...photos]
                  .map((p) => ({
                    p,
                    order: (p.lat != null && p.lon != null && trackPoints)
                      ? trackIndexForCoord(p.lat, p.lon, trackPoints)
                      : Infinity,
                  }))
                  .sort((a, b) => a.order - b.order)
                  .map(({ p }) => {
                  const idx = photos.indexOf(p);
                  return (
                  <div key={p.key} className="flex gap-3 items-start rounded-xl border border-[var(--color-border)] p-2 bg-white">
                    {/* Thumbnail */}
                    <div className="relative w-36 h-36 rounded-lg overflow-hidden flex-none">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.previewUrl} alt="" className="w-full h-full object-cover" />
                      {p.lat != null && (
                        <span className="absolute top-0.5 left-0.5 text-[8px] font-bold bg-black/60 text-white px-0.5 rounded">GPS</span>
                      )}
                      {p.waypointType && (
                        <div className={`absolute bottom-0 left-0 right-0 text-[9px] font-bold text-center py-0.5 ${WP_TYPE_BADGE[p.waypointType]}`}>
                          {WP_TYPE_KO[p.waypointType]}
                        </div>
                      )}
                    </div>

                    {/* Fields */}
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <select
                        className={INPUT}
                        value={p.waypointType ?? ""}
                        onChange={(e) => {
                          const t = e.target.value as WaypointType | "";
                          setPhotos((prev) => prev.map((x) => x.key === p.key ? { ...x, waypointType: t || undefined } : x));
                        }}
                      >
                        <option value="">— 일반 사진</option>
                        <option value="STATION">역 (Station)</option>
                        <option value="BUS_STOP">버스 (Bus Stop)</option>
                        <option value="TRAILHEAD">등산로 입구 (Trailhead)</option>
                        <option value="SUMMIT">정상 (Summit)</option>
                        <option value="PEAK">봉우리 (Peak)</option>
                        <option value="JUNCTION">갈림길 (Junction)</option>
                        <option value="SHELTER">쉼터 (Shelter)</option>
                        <option value="VIEW">전망 (View)</option>
                        <option value="LANDMARK">랜드마크·바위 (Landmark)</option>
                        <option value="CAUTION">주의구간 (Caution)</option>
                      </select>
                      <textarea
                        rows={3}
                        className={INPUT + " resize-none"}
                        placeholder="설명 (KO)"
                        value={p.descKo}
                        onChange={(e) => { const next = [...photos]; next[idx] = { ...next[idx], descKo: e.target.value }; setPhotos(next); }}
                      />
                      <textarea
                        rows={3}
                        className={INPUT + " resize-none"}
                        placeholder="Description (EN)"
                        value={p.descEn}
                        onChange={(e) => { const next = [...photos]; next[idx] = { ...next[idx], descEn: e.target.value }; setPhotos(next); }}
                      />
                    </div>

                    {/* Delete */}
                    <button
                      onClick={() => { URL.revokeObjectURL(p.previewUrl); setPhotos((prev) => prev.filter((x) => x.key !== p.key)); }}
                      className="p-1 text-[var(--color-text-muted)] hover:text-red-500 transition-colors flex-none mt-0.5"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  );
                })}
              </div>
              {photos.some((p) => p.waypointType) && (
                <p className="text-sm text-primary font-medium">
                  웨이포인트 {photos.filter((p) => p.waypointType).length}개 태깅됨 — 다음 단계에서 이름을 확인·입력하세요
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Step 3: Waypoints ── */}
      {step === 3 && (
        <StepWaypoints
          photos={photos}
          existingWaypoints={existingWaypoints}
          slots={waypointSlots}
          onChange={setWaypointSlots}
        />
      )}

      {/* ── Step 4: Segments ── */}
      {step === 4 && (
        <>
          {segmentLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              <p className="text-sm font-medium text-[var(--color-text-muted)]">Inferring segments…</p>
            </div>
          ) : (
            <StepSegments
              segments={segments}
              existingSegments={existingSegments}
              waypointSlots={waypointSlots}
              existingWaypoints={existingWaypoints}
              onChange={setSegments}
            />
          )}
        </>
      )}

      {/* ── Step 5: Route meta + save ── */}
      {step === 5 && (
        <div className={CARD}>
          <p className="text-sm font-semibold text-[var(--color-text-body)]">Route details</p>

          <div>
            <p className={LABEL}>Route name (KO)</p>
            <input
              className={INPUT}
              placeholder="북한산 백운대 초보 코스"
              value={routeNameKo}
              onChange={(e) => setRouteNameKo(e.target.value)}
            />
          </div>
          <div>
            <p className={LABEL}>Route name (EN) *</p>
            <input
              className={INPUT}
              placeholder="Bukhansan Baegundae Beginner"
              value={routeNameEn}
              onChange={(e) => setRouteNameEn(e.target.value)}
            />
          </div>
          <div>
            <p className={LABEL}>Difficulty (1–5)</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((d) => (
                <button
                  key={d}
                  onClick={() => setRouteDifficulty(d)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    routeDifficulty === d
                      ? "bg-primary text-white border-primary"
                      : "border-[var(--color-border)] text-[var(--color-text-muted)]"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className={LABEL}>Route description (KO)</p>
            <textarea
              className={`${INPUT} min-h-[80px] resize-y`}
              placeholder="경로에 대한 상세 설명..."
              value={routeDescriptionKo}
              onChange={(e) => setRouteDescriptionKo(e.target.value)}
            />
          </div>
          <div>
            <p className={LABEL}>Route description (EN)</p>
            <textarea
              className={`${INPUT} min-h-[80px] resize-y`}
              placeholder="Detailed description of the route..."
              value={routeDescriptionEn}
              onChange={(e) => setRouteDescriptionEn(e.target.value)}
            />
          </div>

          {/* Tags */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className={LABEL}>Hashtags (optional)</p>
              {tags.length < 3 && (
                <button
                  onClick={() => setTags((prev) => [...prev, { en: "", ko: "" }])}
                  className="text-sm text-primary font-semibold"
                >
                  + Add
                </button>
              )}
            </div>
            {tags.map((tag, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <input
                  className={INPUT}
                  placeholder="지하철 접근"
                  value={tag.ko}
                  onChange={(e) => {
                    const next = [...tags];
                    next[i] = { ...next[i], ko: e.target.value };
                    setTags(next);
                  }}
                />
                <input
                  className={INPUT}
                  placeholder="Subway Access"
                  value={tag.en}
                  onChange={(e) => {
                    const next = [...tags];
                    next[i] = { ...next[i], en: e.target.value };
                    setTags(next);
                  }}
                />
                {tags.length > 1 && (
                  <button
                    onClick={() => setTags((prev) => prev.filter((_, j) => j !== i))}
                    className="text-[var(--color-text-muted)] hover:text-red-500 flex-none"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Highlights */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className={LABEL}>Highlights (optional)</p>
              <button
                onClick={() => setHighlights((prev) => [...prev, { type: "highlight", en: "", ko: "" }])}
                className="text-sm text-primary font-semibold"
              >
                + Add
              </button>
            </div>
            {highlights.map((h, i) => (
              <div key={i} className="flex flex-col gap-1.5 rounded-xl border border-[var(--color-border)] p-3">
                <div className="flex items-center gap-2">
                  <select
                    className="rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-sm bg-[var(--color-bg-light)] focus:outline-none flex-none"
                    value={h.type}
                    onChange={(e) => {
                      const next = [...highlights];
                      next[i] = { ...next[i], type: e.target.value as "highlight" | "pro_tip" | "warning" };
                      setHighlights(next);
                    }}
                  >
                    <option value="highlight">Highlight</option>
                    <option value="pro_tip">Pro Tip</option>
                    <option value="warning">Warning</option>
                  </select>
                  {highlights.length > 1 && (
                    <button
                      onClick={() => setHighlights((prev) => prev.filter((_, j) => j !== i))}
                      className="ml-auto text-[var(--color-text-muted)] hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <input
                  className={INPUT}
                  placeholder="이 산에서 지하철 접근성이 가장 좋습니다."
                  value={h.ko}
                  onChange={(e) => {
                    const next = [...highlights];
                    next[i] = { ...next[i], ko: e.target.value };
                    setHighlights(next);
                  }}
                />
                <input
                  className={INPUT}
                  placeholder="Best subway access on this mountain."
                  value={h.en}
                  onChange={(e) => {
                    const next = [...highlights];
                    next[i] = { ...next[i], en: e.target.value };
                    setHighlights(next);
                  }}
                />
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="rounded-xl bg-[var(--color-bg-light)] p-3 text-sm text-[var(--color-text-muted)] flex flex-col gap-1">
            <p>
              <span className="font-semibold text-[var(--color-text-body)]">Track:</span>{" "}
              <span className="font-num">{trackPoints ? `${trackDistanceKm(trackPoints)} km · ${trackPoints.length.toLocaleString()} pts` : "—"}</span>
            </p>
            <p>
              <span className="font-semibold text-[var(--color-text-body)]">Waypoints:</span>{" "}
              {waypointSlots.length} ({waypointSlots.filter((s) => s.source === "new").length} new,{" "}
              {waypointSlots.filter((s) => s.source === "existing").length} existing)
            </p>
            <p>
              <span className="font-semibold text-[var(--color-text-body)]">Duration:</span>{" "}
              <span className="font-num">{segments.reduce((sum, s) => sum + s.durationMin, 0)} min</span>
            </p>
            <p>
              <span className="font-semibold text-[var(--color-text-body)]">Photos:</span>{" "}
              {photos.length} (
              {photos.filter((p) => p.lat != null).length} with GPS)
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !routeNameEn}
            className={BTN_PRIMARY}
          >
            {saving ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Icon icon="ph:mountains" width={18} height={18} />
                Create Route
              </>
            )}
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        {step > 0 && (
          <button onClick={back} className={BTN_GHOST}>
            <ChevronLeft size={16} />
            Back
          </button>
        )}
        {step < STEPS.length - 1 && (
          <button onClick={next} disabled={!canProceed()} className={`${BTN_PRIMARY} flex-1`}>
            Next
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
