"use client";

import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Credit } from "@/components/spot-detail";

export type ViewerImage = { id: string; url: string | null; thumbUrl?: string | null; credit?: Credit | null };

// F-3-1：写真をタップすると、写真だけを黒い背景の全画面で大きく表示する。
// 左右にスワイプ（PC は矢印・キーボードの ← →）で前後の写真へ移り、× か Esc で閉じる
export function PhotoViewer({ images, start, onClose }: { images: ViewerImage[]; start: number; onClose: () => void }) {
  const [index, setIndex] = useState(start);
  const scroller = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  // 開いた写真の位置までスクロールしておく
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = start * el.clientWidth;
  }, [start]);

  // 開いている間は後ろのページをスクロールさせない
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const go = (i: number) => {
    const el = scroller.current;
    if (!el) return;
    const next = Math.max(0, Math.min(images.length - 1, i));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const credit = images[index]?.credit;
  // ボトムシートなど重なり順の決まった要素の中から開いても、下のメニューより手前に出す
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="写真" className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex items-center justify-between p-2">
        <button
          ref={closeButton}
          type="button"
          onClick={onClose}
          aria-label="写真を閉じる"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"
        >
          <X size={24} strokeWidth={2} aria-hidden />
        </button>
        {images.length > 1 && (
          <p className="pr-4 text-sm tabular-nums" aria-live="polite">
            {index + 1} / {images.length}
          </p>
        )}
      </div>

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.clientWidth > 0) setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="no-scrollbar flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto"
      >
        {images.map((img) => (
          <div key={img.id} className="flex h-full w-full shrink-0 snap-center items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url ?? img.thumbUrl ?? ""} alt={img.credit?.label ?? ""} className="max-h-full max-w-full object-contain" />
          </div>
        ))}
      </div>

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            aria-label="前の写真"
            className="absolute top-1/2 left-3 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 disabled:invisible pointer-fine:inline-flex"
          >
            <ChevronLeft size={24} strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            disabled={index === images.length - 1}
            aria-label="次の写真"
            className="absolute top-1/2 right-3 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 disabled:invisible pointer-fine:inline-flex"
          >
            <ChevronRight size={24} strokeWidth={2} aria-hidden />
          </button>
        </>
      )}

      {/* 初期データの写真は全画面でも作者とライセンスを出す */}
      <p className="min-h-12 px-4 py-3 text-xs text-white/80">
        {credit && (
          <>
            写真：{credit.artist}（{credit.license}）
            <a href={credit.page} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex items-center gap-0.5 underline">
              出典
              <ExternalLink size={12} strokeWidth={2} aria-hidden />
              <span className="sr-only">（Wikimedia Commons を新しいタブで開く）</span>
            </a>
          </>
        )}
      </p>
    </div>,
    document.body,
  );
}
