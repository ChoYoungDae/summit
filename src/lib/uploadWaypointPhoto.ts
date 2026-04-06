/**
 * uploadWaypointPhoto
 * 1. Canvas API로 이미지 압축 (최대 1280px, JPEG quality 0.82)
 * 2. Supabase Storage `waypoints` 버킷에 업로드
 * 3. Public URL 반환
 *
 * 클라이언트 컴포넌트 전용 ("use client" 환경에서 호출)
 */

import { supabase } from "./supabase";

export interface UploadOptions {
  /** 긴 변 최대 픽셀 수. 기본 1280 */
  maxPx?: number;
  /** JPEG 품질 0~1. 기본 0.82 */
  quality?: number;
  /** 버킷 내 폴더 접두사. 기본 "photos" */
  folder?: string;
}

export interface UploadResult {
  publicUrl: string;
  /** Storage 내 경로 (버킷 기준 상대 경로) */
  storagePath: string;
  /** 압축 후 파일 크기 (bytes) */
  compressedSize: number;
}

// ── 1. 이미지 압축 ────────────────────────────────────────────────────────────

async function compressImage(
  file: File,
  maxPx: number,
  quality: number,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  const { width: origW, height: origH } = bitmap;
  const scale = origW > origH
    ? Math.min(1, maxPx / origW)
    : Math.min(1, maxPx / origH);

  const w = Math.round(origW * scale);
  const h = Math.round(origH * scale);

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return canvas.convertToBlob({ type: "image/jpeg", quality });
}

// ── 2. 고유 파일명 생성 ───────────────────────────────────────────────────────

function buildStoragePath(originalName: string, folder: string): string {
  const base = originalName
    .replace(/\.[^.]+$/, "")          // 확장자 제거
    .replace(/[^a-zA-Z0-9_\-]/g, "_") // 특수문자 → _
    .slice(0, 60);                     // 경로 길이 제한
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 7);
  return `${folder}/${base}_${ts}_${rand}.jpg`;
}

// ── 3. 업로드 + Public URL ────────────────────────────────────────────────────

export async function uploadWaypointPhoto(
  file: File,
  options: UploadOptions = {},
): Promise<UploadResult> {
  const { maxPx = 1280, quality = 0.82, folder = "photos" } = options;

  if (!file.type.startsWith("image/")) {
    throw new Error(`이미지 파일만 업로드할 수 있습니다. (받은 타입: ${file.type})`);
  }

  // 1. 압축
  const blob = await compressImage(file, maxPx, quality);

  // 2. Storage 경로 결정
  const storagePath = buildStoragePath(file.name, folder);

  // 3. 업로드
  const { error } = await supabase.storage
    .from("waypoints")
    .upload(storagePath, blob, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (error) throw new Error(`Storage 업로드 실패: ${error.message}`);

  // 4. Public URL
  const { data } = supabase.storage
    .from("waypoints")
    .getPublicUrl(storagePath);

  return {
    publicUrl: data.publicUrl,
    storagePath,
    compressedSize: blob.size,
  };
}
