"use client";

import { Map as MlMap, Marker, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Supercluster from "supercluster";
import { EdgeZoom } from "@/components/map/edge-zoom";
import { createBaseMarker, createPinMarker, createStackMarker } from "@/components/map/markers";
import type { Category, Popularity } from "@/lib/constants";
import { ZOOM_PIN_MIN } from "@/lib/constants";
import { fetchZoomFor, lngLatToTile } from "@/lib/geo";
import { isHiddenGem } from "@/lib/hidden-gem";

// MapLibre 6 のワーカーは public/maplibre/ に置いたものを使う（scripts/copy-maplibre-worker.mjs）
if (typeof window !== "undefined") setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

// 背景地図は OpenFreeMap（ADR-0020）
export const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
export const JAPAN_VIEW = { center: [137.5, 37.0] as [number, number], zoom: 5 };

export type MapSpot = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: Category;
  postCount: number;
  likeCount: number;
  popularity: Popularity;
  coverThumbUrl: string | null;
};

type TileData = { mode: "spots"; spots: MapSpot[] };
// lat・lng は束の表紙にしたスポットの位置（束のピンはそのスポットを指す）
type ClusterProps = { postCount: number; coverThumbUrl: string | null; category: Category; best: number; name: string; lat: number; lng: number };
type ClusterInfo = { cluster: true; cluster_id: number; point_count: number };

export type MapViewInfo = { zoom: number; visibleSpots: number; loading: boolean; demo: boolean };

// F-1：写真付きピンの地図。移動・ズーム中も区画ごとに取得して描画し続ける（F-1-2）
export function SpotMap({
  categories,
  onSelect,
  highlight,
  onViewInfo,
  flyTo,
  hiddenGemsOnly = false,
}: {
  categories: Category[];
  hiddenGemsOnly?: boolean;
  onSelect: (spot: MapSpot) => void;
  highlight?: { spotIds: Set<string>; base: { label: string; lat: number; lng: number } | null } | null;
  onViewInfo?: (info: MapViewInfo) => void;
  flyTo?: { lat: number; lng: number; zoom: number; key: number } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const tileCache = useRef(new Map<string, TileData>());
  const inflight = useRef(new Set<string>());
  const markers = useRef(new Map<string, Marker>());
  const baseMarker = useRef<Marker | null>(null);
  const indexRef = useRef<Supercluster<MapSpot, ClusterProps> | null>(null);
  const demoRef = useRef(false);
  const lastFetch = useRef(0);
  const loadedRef = useRef(false);
  const [failed, setFailed] = useState(false);
  const categoryKey = categories.join(",");

  // 地図のイベントからは ref 経由で最新の値・関数を使う
  const onSelectRef = useRef(onSelect);
  const onViewInfoRef = useRef(onViewInfo);
  const highlightRef = useRef(highlight);
  const renderRef = useRef<() => void>(() => undefined);
  const fetchRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    onSelectRef.current = onSelect;
    onViewInfoRef.current = onViewInfo;
    highlightRef.current = highlight;
  });

  // ---- 描画 ----
  const render = useCallback(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const zoom = map.getZoom();

    // 写真の束・写真ピン（v0.17 でヒートマップをやめ、日本全体を見ているときも写真の束で表す）
    const next = new Map<string, { at: [number, number]; build: () => HTMLElement }>();
    let visible = 0;
    if (indexRef.current) {
      const b = map.getBounds();
      const w = (b.getEast() - b.getWest()) * 0.2;
      const h = (b.getNorth() - b.getSouth()) * 0.2;
      const features = indexRef.current.getClusters(
        [b.getWest() - w, b.getSouth() - h, b.getEast() + w, b.getNorth() + h],
        Math.floor(zoom),
      );
      const hl = highlightRef.current;
      for (const f of features) {
        const at = f.geometry.coordinates as [number, number];
        const props = f.properties as Partial<ClusterInfo> & (ClusterProps | MapSpot);
        if ("cluster" in props && props.cluster) {
          const p = props as ClusterInfo & ClusterProps;
          visible += p.point_count;
          // 束の中心（全スポットの平均）ではなく、名前と写真を出しているスポットの場所を指す。
          // 平均の位置だと、金沢と東京がまとまったときに群馬に「兼六園」と出てしまう
          next.set(`c:${p.cluster_id}:${p.postCount}`, {
            at: [p.lng, p.lat],
            build: () => {
              const el = createStackMarker({
                coverUrl: p.coverThumbUrl,
                category: p.category,
                postCount: p.postCount,
                name: p.name,
                others: p.point_count - 1,
                label: `${p.name}ほか${p.point_count}か所・${p.postCount}件の投稿。タップして拡大`,
              });
              el.addEventListener("click", (e) => {
                e.stopPropagation();
                const z = indexRef.current?.getClusterExpansionZoom(p.cluster_id) ?? zoom + 2;
                map.easeTo({ center: at, zoom: Math.min(z, 17) });
              });
              return el;
            },
          });
        } else {
          const s = props as MapSpot;
          visible += 1;
          const pin = zoom >= ZOOM_PIN_MIN;
          const hlOn = Boolean(hl?.spotIds.has(s.id));
          next.set(`s:${s.id}:${pin ? "pin" : "stack"}:${hlOn ? 1 : 0}`, {
            at,
            build: () => {
              const el = pin
                ? createPinMarker({
                    coverUrl: s.coverThumbUrl,
                    category: s.category,
                    popularity: s.popularity,
                    hiddenGem: isHiddenGem(s),
                    label: s.name,
                    highlighted: hlOn,
                  })
                : createStackMarker({
                    coverUrl: s.coverThumbUrl,
                    category: s.category,
                    postCount: s.postCount,
                    name: s.name,
                    others: 0,
                    label: s.name,
                    highlighted: hlOn,
                  });
              el.addEventListener("click", (e) => {
                e.stopPropagation();
                onSelectRef.current(s);
              });
              return el;
            },
          });
        }
      }
    }

    // 差分だけ入れ替える（前のピンは新しいデータが届くまで残す）
    for (const [key, marker] of markers.current) {
      if (next.has(key)) continue;
      marker.remove();
      markers.current.delete(key);
    }
    for (const [key, { at, build }] of next) {
      if (markers.current.has(key)) continue;
      // ピンの先が地点を指すよう、写真ピン・写真の束とも下端で置く
      const marker = new Marker({ element: build(), anchor: "bottom" }).setLngLat(at).addTo(map);
      markers.current.set(key, marker);
    }

    onViewInfoRef.current?.({ zoom, visibleSpots: visible, loading: inflight.current.size > 0, demo: demoRef.current });
  }, [categoryKey]);

  // 取得済みの区画から写真の束（クラスタ）の索引を作り直す
  const rebuildIndex = useCallback(() => {
    const all = new Map<string, MapSpot>();
    for (const [key, data] of tileCache.current) {
      if (!key.startsWith(`${categoryKey}|`) || data.mode !== "spots") continue;
      // F-1-12：「隠れた名所」の絞り込み中は、隠れた名所だけで束を作る
      for (const s of data.spots) if (!hiddenGemsOnly || isHiddenGem(s)) all.set(s.id, s);
    }
    const index = new Supercluster<MapSpot, ClusterProps>({
      radius: 70,
      maxZoom: ZOOM_PIN_MIN - 1,
      map: (p) => ({
        postCount: p.postCount,
        coverThumbUrl: p.coverThumbUrl,
        category: p.category,
        best: p.coverThumbUrl ? p.postCount : -1,
        name: p.name,
        lat: p.lat,
        lng: p.lng,
      }),
      // 束の表紙は、写真がある中で投稿数が最も多いスポットの写真
      reduce: (acc, p) => {
        acc.postCount += p.postCount;
        if (p.best > acc.best) {
          acc.best = p.best;
          acc.coverThumbUrl = p.coverThumbUrl;
          acc.category = p.category;
          acc.name = p.name;
          acc.lat = p.lat;
          acc.lng = p.lng;
        }
      },
    });
    index.load(
      [...all.values()].map((s) => ({
        type: "Feature" as const,
        properties: s,
        geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] },
      })),
    );
    indexRef.current = index;
  }, [categoryKey, hiddenGemsOnly]);

  // ---- 取得（F-1-2）：表示範囲＋外側1画面分の区画のうち、まだ取得していないものだけ ----
  const fetchTiles = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const z = fetchZoomFor(map.getZoom());
    const b = map.getBounds();
    const w = b.getEast() - b.getWest();
    const h = b.getNorth() - b.getSouth();
    const nw = lngLatToTile(b.getWest() - w, b.getNorth() + h, z);
    const se = lngLatToTile(b.getEast() + w, b.getSouth() - h, z);
    const tiles: string[] = [];
    for (let x = nw.x; x <= se.x; x++) for (let y = nw.y; y <= se.y; y++) tiles.push(`${z}/${x}/${y}`);
    if (tiles.length > 64) tiles.length = 64;

    const qs = categoryKey ? `?category=${categoryKey}` : "";
    for (const t of tiles) {
      const key = `${categoryKey}|${t}`;
      if (tileCache.current.has(key) || inflight.current.has(key)) continue;
      inflight.current.add(key);
      fetch(`/api/v1/spots/tiles/${t}${qs}`)
        .then(async (res) => {
          if (!res.ok) throw new Error(String(res.status));
          const data = (await res.json()) as TileData & { demo?: boolean };
          demoRef.current = Boolean(data.demo);
          tileCache.current.set(key, data);
          if (data.mode === "spots") rebuildIndex();
        })
        .catch(() => {
          // 取得に失敗しても表示中のピンは残す。次の移動で取り直す（F-1 の例外）
        })
        .finally(() => {
          inflight.current.delete(key);
          render();
        });
    }
  }, [categoryKey, rebuildIndex, render]);

  useEffect(() => {
    renderRef.current = render;
    fetchRef.current = fetchTiles;
  }, [render, fetchTiles]);

  // ---- 地図の初期化（1回だけ） ----
  useEffect(() => {
    if (!containerRef.current) return;
    // URL の #ズーム/緯度/経度 で初期位置を指定できる（例：#15/36.562/136.662）
    const hash = /^#(\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/.exec(window.location.hash);
    const initial = hash ? { center: [Number(hash[3]), Number(hash[2])] as [number, number], zoom: Number(hash[1]) } : JAPAN_VIEW;
    const map = new MlMap({
      container: containerRef.current,
      style: MAP_STYLE,
      center: initial.center,
      zoom: initial.zoom,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.on("error", (e) => {
      // スタイル（地図そのもの）が読み込めなかったときだけエラー表示にする
      if (!loadedRef.current && String(e.error?.message ?? "").length > 0) setFailed(true);
    });
    // 地図タイルがそろうのを待たず、スタイルが読めた時点でピンを描き始める
    map.once("style.load", () => {
      loadedRef.current = true;
      fetchRef.current();
      renderRef.current();
    });

    // 移動中も最大300msに1回取得し、描画は毎フレーム更新する
    let raf = 0;
    map.on("move", () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => renderRef.current());
      const now = Date.now();
      if (now - lastFetch.current > 300) {
        lastFetch.current = now;
        fetchRef.current();
      }
    });
    map.on("moveend", () => {
      fetchRef.current();
      renderRef.current();
    });

    // 初期表示：位置情報が許可されていれば現在地周辺（F-1-1）
    if (!hash && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => map.jumpTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 13 }),
        () => undefined,
        { timeout: 8000, maximumAge: 600000 },
      );
    }

    const markerMap = markers.current;
    return () => {
      cancelAnimationFrame(raf);
      for (const m of markerMap.values()) m.remove();
      markerMap.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // カテゴリが変わったら取り直す
  useEffect(() => {
    rebuildIndex();
    fetchTiles();
    render();
  }, [categoryKey, fetchTiles, rebuildIndex, render]);

  // リストの強調表示と拠点（F-1-9）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    baseMarker.current?.remove();
    baseMarker.current = null;
    if (highlight?.base) {
      baseMarker.current = new Marker({ element: createBaseMarker(highlight.base.label) })
        .setLngLat([highlight.base.lng, highlight.base.lat])
        .addTo(map);
    }
    render();
  }, [highlight, render]);

  useEffect(() => {
    if (flyTo && mapRef.current) mapRef.current.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: flyTo.zoom });
  }, [flyTo]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {!failed && <EdgeZoom getMap={() => mapRef.current} />}
      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface p-6 text-center">
          <p className="font-medium">地図を読み込めませんでした</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm"
          >
            <RefreshCw size={20} strokeWidth={2} aria-hidden />
            再読み込み
          </button>
        </div>
      )}
    </div>
  );
}

// 現在地を取る。まず精度の高い位置（1分以内に取った位置も使う）を試し、建物の中などで取れなければ
// 精度の低い位置（10分以内に取った位置も使う）で取り直す。許可されていない場合は取り直さない
export async function locateMe(): Promise<GeolocationPosition> {
  if (!("geolocation" in navigator)) throw new Error("unsupported");
  const get = (options: PositionOptions) =>
    new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, options));
  try {
    return await get({ enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  } catch (e) {
    if (e instanceof GeolocationPositionError && e.code === e.PERMISSION_DENIED) throw e;
    return get({ enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
  }
}

// 現在地を取れなかった理由を、直し方と一緒に伝える
export function locateErrorMessage(e: unknown): string {
  if (e instanceof Error && e.message === "unsupported") return "このブラウザでは現在地を使えません。検索で指定してください";
  if (e instanceof GeolocationPositionError && e.code === e.PERMISSION_DENIED) {
    return "位置情報の利用が許可されていません。ブラウザのサイトの設定（アドレスバーの左のマーク）と、端末の位置情報サービスの設定で、このサイトに位置情報を許可してください。LINE などのアプリの中で開いている場合は、Safari や Chrome で開き直してください";
  }
  return "現在地を取得できませんでした。電波の届きやすい場所でもう一度押すか、検索で指定してください";
}
