"use client";

import { BookmarkPlus, Camera, Flame, Heart, LocateFixed, MapPin, Search, X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAddToList } from "@/components/add-to-list";
import { useApp } from "@/components/app-context";
import { CATEGORY_ICONS } from "@/components/category";
import { locateMe, type MapSpot, type MapViewInfo } from "@/components/map/spot-map";
import { Badge, Chip, IconButton, Notice } from "@/components/ui";
import { api, errorMessage } from "@/lib/client-api";
import { CATEGORIES, CATEGORY_LABELS, POPULARITY_LABELS, ZOOM_HEATMAP_MAX, type Category } from "@/lib/constants";

// 地図はブラウザでだけ描く
const SpotMap = dynamic(() => import("@/components/map/spot-map").then((m) => m.SpotMap), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-surface-muted" />,
});

type ListSummary = { id: string; name: string; spotIds: string[] };
type ListDetail = { id: string; base: { label: string; lat: number; lng: number } | null; spots: { id: string }[] };
type SearchHit = { id: string; name: string; lat: number; lng: number; address: string | null };

// S-01 マップ（トップ）
export function MapScreen() {
  const { me, configured } = useApp();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<MapSpot | null>(null);
  const [info, setInfo] = useState<MapViewInfo>({ zoom: 5, visibleSpots: 0, loading: true, demo: false });
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom: number; key: number } | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lists, setLists] = useState<ListSummary[]>([]);
  const [listId, setListId] = useState("");
  const [listDetail, setListDetail] = useState<ListDetail | null>(null);
  const addToList = useAddToList();

  useEffect(() => {
    if (!me) return;
    api<{ lists: ListSummary[] }>("/lists")
      .then((r) => setLists(r.lists))
      .catch(() => setLists([]));
  }, [me]);

  useEffect(() => {
    if (!listId) return;
    api<ListDetail>(`/lists/${listId}`)
      .then(setListDetail)
      .catch(() => setListDetail(null));
  }, [listId]);

  // F-1-9：選んだリストのスポットを強調し、拠点を表示する
  const highlight = useMemo(
    () => (listId && listDetail ? { spotIds: new Set(listDetail.spots.map((s) => s.id)), base: listDetail.base } : null),
    [listId, listDetail],
  );

  const toggleCategory = (c: Category) =>
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const search = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!query.trim()) return;
    if (!configured) {
      setError("Supabase に接続すると検索できます");
      return;
    }
    try {
      const r = await api<{ spots: SearchHit[] }>(`/spots/search?q=${encodeURIComponent(query.trim())}`);
      setResults(r.spots);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const locate = async () => {
    setError(null);
    try {
      const pos = await locateMe();
      setFlyTo({ lat: pos.coords.latitude, lng: pos.coords.longitude, zoom: 14, key: Date.now() });
    } catch {
      setError("現在地を取得できませんでした");
    }
  };

  const showEmpty = !info.loading && info.zoom > ZOOM_HEATMAP_MAX && info.visibleSpots === 0;

  return (
    <div className="relative h-[calc(100dvh-4rem)] lg:h-[calc(100dvh-3.5rem)]">
      <div className="absolute inset-0">
        <SpotMap categories={categories} onSelect={setSelected} onViewInfo={setInfo} flyTo={flyTo} highlight={highlight} />
      </div>

      {/* 上部：検索・カテゴリ（F-1-7・F-1-8） */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3 lg:max-w-xl">
        <form onSubmit={search} className="pointer-events-auto flex gap-2" role="search">
          <div className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3 shadow-sm">
            <Search size={20} strokeWidth={2} className="text-muted" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="スポット名で探す"
              aria-label="スポット名で探す"
              className="min-w-0 flex-1 bg-transparent outline-none"
            />
            {query && (
              <button
                type="button"
                aria-label="検索をクリア"
                onClick={() => {
                  setQuery("");
                  setResults(null);
                }}
              >
                <X size={16} strokeWidth={2} aria-hidden />
              </button>
            )}
          </div>
          <IconButton icon={LocateFixed} label="現在地に移動" type="button" onClick={locate} className="shadow-sm" />
        </form>

        {results && (
          <div className="pointer-events-auto max-h-64 overflow-y-auto rounded-xl border border-border bg-surface shadow-sm">
            {results.length === 0 ? (
              <p className="p-3 text-sm text-muted">見つかりませんでした。条件を変えて検索してください</p>
            ) : (
              results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setFlyTo({ lat: r.lat, lng: r.lng, zoom: 15, key: Date.now() });
                    setResults(null);
                  }}
                  className="flex min-h-12 w-full items-center gap-2 px-3 text-left hover:bg-surface-muted"
                >
                  <MapPin size={16} strokeWidth={2} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.name}</span>
                    {r.address && <span className="block truncate text-xs text-muted">{r.address}</span>}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        <div className="no-scrollbar pointer-events-auto flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              icon={CATEGORY_ICONS[c]}
              selected={categories.includes(c)}
              onClick={() => toggleCategory(c)}
              className="shrink-0 shadow-sm"
            >
              {CATEGORY_LABELS[c]}
            </Chip>
          ))}
          {me && lists.length > 0 && (
            <select
              value={listId}
              onChange={(e) => {
                setListId(e.target.value);
                if (!e.target.value) setListDetail(null);
              }}
              aria-label="リストのスポットを強調表示"
              className="min-h-11 shrink-0 rounded-full border border-border bg-surface px-3 text-sm shadow-sm"
            >
              <option value="">リストを表示しない</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {error && (
          <Notice tone="error" className="pointer-events-auto">
            {error}
          </Notice>
        )}
        {info.demo && (
          <Notice tone="warning" className="pointer-events-auto">
            Supabase に接続していないため、金沢のデモデータを表示しています
          </Notice>
        )}
        {showEmpty && !selected && (
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-border bg-surface p-3 text-sm shadow-sm">
            <span className="flex-1">このエリアにはまだ投稿がありません</span>
            <Link
              href="/posts/new"
              className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-primary px-3 text-primary-foreground"
            >
              <Camera size={16} strokeWidth={2} aria-hidden />
              投稿する
            </Link>
          </div>
        )}
      </div>

      {selected && (
        <SpotSheet
          spot={selected}
          demo={info.demo}
          onClose={() => setSelected(null)}
          onAdd={() => addToList.open({ id: selected.id, name: selected.name })}
        />
      )}
      {addToList.dialog}
    </div>
  );
}

// F-1-6：ピンを選んだときのボトムシート
function SpotSheet({ spot, demo, onClose, onAdd }: { spot: MapSpot; demo: boolean; onClose: () => void; onAdd: () => void }) {
  const Icon = CATEGORY_ICONS[spot.category];
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 p-3 lg:left-3 lg:right-auto lg:w-96">
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-lg">
        <div className="flex gap-3">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-muted">
            {spot.coverThumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={spot.coverThumbUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Icon size={32} strokeWidth={2} className="text-primary" aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h2 className="min-w-0 flex-1 truncate text-base font-bold">{spot.name}</h2>
              <button
                type="button"
                aria-label="閉じる"
                onClick={onClose}
                className="-mr-2 -mt-2 inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-surface-muted"
              >
                <X size={20} strokeWidth={2} aria-hidden />
              </button>
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge icon={Icon}>{CATEGORY_LABELS[spot.category]}</Badge>
              {spot.popularity !== "normal" && (
                <Badge icon={spot.popularity === "very_popular" ? Flame : undefined} tone={spot.popularity}>
                  {POPULARITY_LABELS[spot.popularity]}
                </Badge>
              )}
            </div>
            <p className="mt-1 flex items-center gap-3 text-sm text-muted">
              <span className="inline-flex items-center gap-1">
                <Camera size={16} strokeWidth={2} aria-hidden />
                投稿 {spot.postCount}件
              </span>
              <span className="inline-flex items-center gap-1">
                <Heart size={16} strokeWidth={2} aria-hidden />
                {spot.likeCount}
              </span>
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            href={`/spots/${spot.id}`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            詳細を見る
          </Link>
          <button
            type="button"
            onClick={onAdd}
            disabled={demo}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-50"
          >
            <BookmarkPlus size={20} strokeWidth={2} aria-hidden />
            リストに追加
          </button>
        </div>
      </div>
    </div>
  );
}
