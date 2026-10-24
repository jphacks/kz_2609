"use client";

import { Bookmark, Camera, Flame, Gem, Heart, Info, Share2, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { MapSpot } from "@/components/map/spot-map";
import { PhotoViewer } from "@/components/photo-viewer";
import { PhotoCredit, type Credit } from "@/components/spot-detail";
import { cn } from "@/components/ui";
import { api } from "@/lib/client-api";
import { CATEGORY_LABELS, POPULARITY_LABELS } from "@/lib/constants";
import { isHiddenGem } from "@/lib/hidden-gem";

type SheetImage = { id: string; url: string | null; thumbUrl: string | null; credit?: Credit | null };
type SheetDetail = { address: string | null; stayMinutes: number; images: SheetImage[] };

// シートの右上に並べる丸いボタン（Google マップの保存・共有・閉じる）
function RoundButton({ icon: Icon, label, onClick, disabled }: { icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-muted hover:brightness-95 disabled:opacity-50"
    >
      <Icon size={20} strokeWidth={2} aria-hidden />
    </button>
  );
}

// 横にスクロールする丸いチップ。最初の1つ（詳細を見る）だけ塗りつぶす
function ActionChip({ icon: Icon, filled, children }: { icon: LucideIcon; filled?: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium",
        filled ? "bg-primary text-primary-foreground" : "border border-border bg-surface text-primary",
      )}
    >
      <Icon size={18} strokeWidth={2} aria-hidden />
      {children}
    </span>
  );
}

// F-1-6：ピンや検索結果を選んだときの、Google マップのようなボトムシート
export function SpotSheet({ spot, demo, onClose, onAdd }: { spot: MapSpot; demo: boolean; onClose: () => void; onAdd: () => void }) {
  const [loaded, setLoaded] = useState<{ id: string; detail: SheetDetail | null } | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);

  // 住所・写真はシートを開いてから取得する（地図のタイルには含めない）
  useEffect(() => {
    let active = true;
    api<SheetDetail>(`/spots/${spot.id}`)
      .then((d) => active && setLoaded({ id: spot.id, detail: d }))
      .catch(() => active && setLoaded({ id: spot.id, detail: null }));
    return () => {
      active = false;
    };
  }, [spot.id]);
  const detail = loaded?.id === spot.id ? loaded.detail : null;
  const loading = loaded?.id !== spot.id;

  // 端末の共有シート（LINE など）を開き、使えないブラウザではリンクをコピーする
  const share = async () => {
    const url = `${window.location.origin}/spots/${spot.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: spot.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareNote("リンクをコピーしました");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setShareNote("共有できませんでした");
    }
  };

  const images = detail?.images.filter((i) => i.thumbUrl || i.url) ?? [];
  const meta = [CATEGORY_LABELS[spot.category], `投稿 ${spot.postCount}件`];
  if (detail) meta.push(`滞在 約${detail.stayMinutes}分`);

  return (
    <section
      aria-label={`${spot.name}の情報`}
      className="absolute inset-x-0 bottom-0 z-20 max-h-[70%] overflow-y-auto rounded-t-3xl bg-surface pb-4 shadow-[0_-4px_16px_rgba(0,0,0,0.12)] lg:bottom-3 lg:left-3 lg:right-auto lg:w-[26rem] lg:rounded-3xl"
    >
      <div className="flex justify-center pt-2 pb-1" aria-hidden>
        <span className="h-1 w-9 rounded-full bg-border" />
      </div>

      <div className="flex items-start gap-2 px-4">
        <h2 className="min-w-0 flex-1 pt-1 text-2xl leading-tight font-bold">{spot.name}</h2>
        <RoundButton icon={Bookmark} label="リストに追加" onClick={onAdd} disabled={demo} />
        <RoundButton icon={Share2} label="共有" onClick={share} />
        <RoundButton icon={X} label="閉じる" onClick={onClose} />
      </div>

      <div className="mt-1 space-y-0.5 px-4 text-sm text-muted">
        <p className="flex flex-wrap items-center gap-x-1.5">
          {meta.map((m, i) => (
            <span key={m} className="inline-flex items-center gap-1.5">
              {i > 0 && <span aria-hidden>·</span>}
              {m}
            </span>
          ))}
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-0.5">
            <Heart size={14} strokeWidth={2} aria-hidden />
            <span className="sr-only">いいね</span>
            {spot.likeCount}
          </span>
        </p>
        {spot.popularity !== "normal" && (
          <p className={cn("inline-flex items-center gap-1 font-medium", spot.popularity === "very_popular" ? "text-very-popular" : "text-popular")}>
            {spot.popularity === "very_popular" && <Flame size={14} strokeWidth={2} aria-hidden />}
            {POPULARITY_LABELS[spot.popularity]}のスポット
          </p>
        )}
        {isHiddenGem(spot) && (
          <p className="inline-flex items-center gap-1 font-medium text-hidden-gem">
            <Gem size={14} strokeWidth={2} aria-hidden />
            隠れた名所（投稿は少ないけれど、いいねの多いスポット）
          </p>
        )}
        {detail?.address && <p className="truncate">{detail.address}</p>}
      </div>

      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-4">
        <Link href={`/spots/${spot.id}`} className="shrink-0 rounded-full">
          <ActionChip icon={Info} filled>
            詳細を見る
          </ActionChip>
        </Link>
        <button type="button" onClick={onAdd} disabled={demo} className="shrink-0 rounded-full disabled:opacity-50">
          <ActionChip icon={Bookmark}>リストに追加</ActionChip>
        </button>
        <Link href={`/posts/new?spotId=${spot.id}`} className="shrink-0 rounded-full">
          <ActionChip icon={Camera}>ここに投稿</ActionChip>
        </Link>
        <button type="button" onClick={share} className="shrink-0 rounded-full">
          <ActionChip icon={Share2}>共有</ActionChip>
        </button>
      </div>
      {shareNote && (
        <p role="status" className="mt-2 px-4 text-sm text-muted">
          {shareNote}
        </p>
      )}

      {/* 写真は横にスクロール。Wikimedia Commons の写真は作者とライセンスを写真の下に出す */}
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-4">
        {loading && !spot.coverThumbUrl
          ? [0, 1, 2].map((i) => <div key={i} className="h-36 w-48 shrink-0 animate-pulse rounded-2xl bg-surface-muted" />)
          : images.length > 0
            ? images.slice(0, 10).map((img, i) => (
                <figure key={img.id} className="w-48 shrink-0">
                  <button type="button" onClick={() => setViewing(i)} aria-label={`写真${i + 1}を大きく表示`} className="block rounded-2xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.thumbUrl ?? img.url ?? ""}
                      alt={img.credit?.label ?? ""}
                      loading="lazy"
                      className="h-36 w-48 rounded-2xl bg-surface-muted object-cover"
                    />
                  </button>
                  {img.credit && <PhotoCredit credit={img.credit} className="mt-1 line-clamp-2" />}
                </figure>
              ))
            : spot.coverThumbUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={spot.coverThumbUrl} alt="" className="h-36 w-48 shrink-0 rounded-2xl bg-surface-muted object-cover" />
              )}
      </div>
      {viewing !== null && <PhotoViewer images={images.slice(0, 10)} start={viewing} onClose={() => setViewing(null)} />}
    </section>
  );
}
