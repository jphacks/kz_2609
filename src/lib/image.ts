"use client";

import { MAX_SOURCE_IMAGE_BYTES, MAX_UPLOAD_BYTES } from "@/lib/constants";

// F-2-4：ブラウザで本画像（長辺1600px）とサムネイル（長辺400px）に変換する。
// canvas で描き直すため EXIF（位置情報・撮影機器など）はすべて消える。
// WebP にできないブラウザ（一部の Safari）では JPEG にする。

export type ProcessedImage = {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
  contentType: "image/webp" | "image/jpeg";
  previewUrl: string;
};

const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

function isHeic(file: File) {
  return /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

async function toBitmapSource(file: File): Promise<Blob> {
  if (!isHeic(file)) return file;
  const heic2any = (await import("heic2any")).default;
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  return Array.isArray(out) ? out[0] : out;
}

async function encode(bitmap: ImageBitmap, longEdge: number, quality: number) {
  const scale = Math.min(1, longEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const toBlob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  let blob = await toBlob("image/webp");
  if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg");
  if (!blob) throw new Error("encode");
  return { blob, width: w, height: h };
}

export function validateSourceImage(file: File): string | null {
  if (!ACCEPT.includes(file.type) && !isHeic(file)) return "JPEG / PNG / HEIC / WebP の写真を選んでください";
  if (file.size > MAX_SOURCE_IMAGE_BYTES) return "写真は1枚10MBまでです";
  return null;
}

export async function processImage(file: File): Promise<ProcessedImage> {
  const source = await toBitmapSource(file);
  const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  try {
    let full = await encode(bitmap, 1600, 0.82);
    if (full.blob.size > MAX_UPLOAD_BYTES) full = await encode(bitmap, 1600, 0.6);
    if (full.blob.size > MAX_UPLOAD_BYTES) throw new Error("too-large");
    const thumb = await encode(bitmap, 400, 0.75);
    const contentType = full.blob.type === "image/webp" ? "image/webp" : "image/jpeg";
    return {
      full: full.blob,
      thumb: thumb.blob,
      width: full.width,
      height: full.height,
      contentType,
      previewUrl: URL.createObjectURL(thumb.blob),
    };
  } finally {
    bitmap.close();
  }
}
