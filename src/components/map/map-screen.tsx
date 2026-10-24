"use client";

import { Camera, Gem, LocateFixed, Mic, Search, X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAddToList } from "@/components/add-to-list";
import { useApp } from "@/components/app-context";
import { CATEGORY_ICONS } from "@/components/category";
import { SearchScreen, demoSearch, type SearchHit } from "@/components/map/search-screen";
import { SpotSheet } from "@/components/map/spot-sheet";
import { locateMe, type MapSpot, type MapViewInfo } from "@/components/map/spot-map";
import { useCanVoice } from "@/components/map/voice-search";
import { Chip, Notice } from "@/components/ui";
import { api } from "@/lib/client-api";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/constants";
import type { LatLng } from "@/lib/geo";
import { addHistory, type SearchHistoryItem } from "@/lib/search-history";

// 地図はブラウザでだけ描く
const SpotMap = dynamic(() => import("@/components/map/spot-map").then((m) => m.SpotMap), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-surface-muted" />,
});

type ListSummary = { id: string; name: string; spotIds: string[] };
type ListDetail = { id: string; base: { label: string; lat: number; lng: number } | null; spots: { id: string }[] };

// S-01 マップ（トップ）
export function MapScreen() {
  const { me, configured } = useApp();
  const [categories, setCategories] = useState<Category[]>([]);
  const [hiddenGemsOnly, setHiddenGemsOnly] = useState(false);
  const [selected, setSelected] = useState<MapSpot | null>(null);
  const [info, setInfo] = useState<MapViewInfo>({ zoom: 5, visibleSpots: 0, loading: true, demo: false });
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom: number; key: number } | null>(null);
  const [searching, setSearching] = useState<"text" | "voice" | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [myPos, setMyPos] = useState<LatLng | null>(null);
  const canVoice = useCanVoice();
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

  // 位置情報をすでに許可している端末では、検索候補に距離を出すため現在地を黙って取得する
  useEffect(() => {
    if (!("permissions" in navigator)) return;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((p) => {
        if (p.state !== "granted") return;
        locateMe()
          .then((pos) => setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }))
          .catch(() => undefined);
      })
      .catch(() => undefined);
  }, []);

  const locate = async () => {
    setError(null);
    try {
      const pos = await locateMe();
      setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setFlyTo({ lat: pos.coords.latitude, lng: pos.coords.longitude, zoom: 14, key: Date.now() });
    } catch {
      setError("現在地を取得できませんでした");
    }
  };

  // F-1-11：検索で選んだ場所へ移動してボトムシートを開き、履歴に残す
  const pickHit = (hit: SearchHit) => {
    addHistory({ id: hit.id, name: hit.name, address: hit.address, lat: hit.lat, lng: hit.lng });
    setSearching(null);
    setPicked(hit.name);
    setFlyTo({ lat: hit.lat, lng: hit.lng, zoom: 16, key: Date.now() });
    setSelected(hit);
  };

  // 履歴には地図表示に必要な項目だけを保存しているので、最新の情報を取り直す
  const pickHistory = async (item: SearchHistoryItem) => {
    setSearching(null);
    setPicked(item.name);
    setFlyTo({ lat: item.lat, lng: item.lng, zoom: 16, key: Date.now() });
    addHistory(item);
    try {
      const hits = configured
        ? (await api<{ spots: SearchHit[] }>(`/spots/search?q=${encodeURIComponent(item.name)}`)).spots
        : demoSearch(item.name);
      const hit = hits.find((s) => s.id === item.id);
      if (hit) setSelected(hit);
    } catch {
      // 地図の移動はできているので、シートを開けなくても止めない
    }
  };

  const clearPicked = () => {
    setPicked(null);
    setSelected(null);
  };

  const showEmpty = !info.loading && info.visibleSpots === 0;

  return (
    <div className="relative h-[calc(100dvh-4rem)] lg:h-[calc(100dvh-3.5rem)]">
      <div className="absolute inset-0">
        <SpotMap categories={categories} hiddenGemsOnly={hiddenGemsOnly} onSelect={setSelected} onViewInfo={setInfo} flyTo={flyTo} highlight={highlight} />
      </div>

      {/* 上部：検索・カテゴリ（F-1-7・F-1-8） */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3 lg:max-w-xl">
        {/* F-1-11：Google マップのような丸い検索バー。押すと全画面の検索を開く */}
        <div role="search" className="pointer-events-auto flex h-12 items-center rounded-full bg-surface shadow-md">
          <button
            type="button"
            onClick={() => setSearching("text")}
            className="flex h-full min-w-0 flex-1 items-center gap-3 rounded-full pl-4 text-left"
          >
            <Search size={20} strokeWidth={2} className="shrink-0 text-muted" aria-hidden />
            <span className={picked ? "truncate" : "truncate text-muted"}>{picked ?? "ここで検索"}</span>
          </button>
          {picked ? (
            <button
              type="button"
              onClick={clearPicked}
              aria-label="検索をやめる"
              className="mr-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-surface-muted"
            >
              <X size={20} strokeWidth={2} aria-hidden />
            </button>
          ) : (
            canVoice && (
              <button
                type="button"
                onClick={() => setSearching("voice")}
                aria-label="音声で検索"
                className="mr-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-surface-muted"
              >
                <Mic size={20} strokeWidth={2} aria-hidden />
              </button>
            )
          )}
        </div>

        <div className="no-scrollbar pointer-events-auto flex gap-2 overflow-x-auto pb-1">
          {/* F-1-12：隠れた名所だけを表示する */}
          <Chip icon={Gem} selected={hiddenGemsOnly} onClick={() => setHiddenGemsOnly((v) => !v)} className="shrink-0 shadow-sm">
            隠れた名所
          </Chip>
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
        {hiddenGemsOnly && !selected && !info.loading && info.visibleSpots === 0 && (
          <Notice tone="info" className="pointer-events-auto">
            このあたりにはまだ隠れた名所（投稿は少ないけれど、いいねの多いスポット）がありません。いいねが集まると表示されます
          </Notice>
        )}
        {showEmpty && !hiddenGemsOnly && !selected && (
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

      {!selected && (
        <button
          type="button"
          onClick={locate}
          aria-label="現在地に移動"
          className="absolute bottom-6 right-3 z-10 inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface text-primary shadow-md"
        >
          <LocateFixed size={22} strokeWidth={2} aria-hidden />
        </button>
      )}

      {selected && (
        <SpotSheet
          spot={selected}
          demo={info.demo}
          onClose={clearPicked}
          onAdd={() => addToList.open({ id: selected.id, name: selected.name })}
        />
      )}
      {searching && (
        <SearchScreen
          configured={configured}
          myPos={myPos}
          initialVoice={searching === "voice"}
          onPick={pickHit}
          onPickHistory={pickHistory}
          onClose={() => setSearching(null)}
        />
      )}
      {addToList.dialog}
    </div>
  );
}
