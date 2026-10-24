"use client";

import { Map as MlMap, Marker, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Supercluster from "supercluster";
import { createBaseMarker, createPinMarker, createStackMarker } from "@/components/map/markers";
import type { Category, Popularity } from "@/lib/constants";
import { ZOOM_HEATMAP_MAX, ZOOM_PIN_MIN } from "@/lib/constants";
import { fetchZoomFor, lngLatToTile } from "@/lib/geo";

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

type HeatPoint = { id: string; lat: number; lng: number; weight: number };
type TileData = { mode: "heatmap"; points: HeatPoint[] } | { mode: "spots"; spots: MapSpot[] };
type ClusterProps = { postCount: number; coverThumbUrl: string | null; category: Category; best: number; name: string };
type ClusterInfo = { cluster: true; cluster_id: number; point_count: number };

export type MapViewInfo = { zoom: number; visibleSpots: number; loading: boolean; demo: boolean };

const HEAT_LAYER = {
  id: "heat",
  type: "heatmap" as const,
  source: "heat",
  maxzoom: ZOOM_HEATMAP_MAX + 1,
  paint: {
    "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 0, 0, 20, 1],
    "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 4, 1, 9, 3],
    "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 4, 12, 9, 30],
    // ズームに合わせて透明度を連続的に変え、写真の束へ自然に切り替える（F-1-3）
    "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], ZOOM_HEATMAP_MAX, 0.85, ZOOM_HEATMAP_MAX + 1, 0],
    "heatmap-color": [
      "interpolate",
      ["linear"],
      ["heatmap-density"],
      0,
      "rgba(255,237,160,0)",
      0.3,
      "rgb(254,217,118)",
      0.6,
      "rgb(253,141,60)",
      0.85,
      "rgb(240,59,32)",
      1,
      "rgb(189,0,38)",
    ],
  },
};

// F-1：写真付きピンの地図。移動・ズーム中も区画ごとに取得して描画し続ける（F-1-2）
export function SpotMap({
  categories,
  onSelect,
  highlight,
  onViewInfo,
  flyTo,
}: {
  categories: Category[];
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

    // ヒートマップ（ズーム8以下）
    const heat: HeatPoint[] = [];
    for (const [key, data] of tileCache.current) {
      if (key.startsWith(`${categoryKey}|5/`) && data.mode === "heatmap") heat.push(...data.points);
    }
    (map.getSource("heat") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: heat.map((p) => ({
        type: "Feature",
        properties: { weight: p.weight },
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      })),
    });

    // 写真の束・写真ピン（ズーム9以上）
    const next = new Map<string, { at: [number, number]; build: () => HTMLElement }>();
    let visible = 0;
    if (zoom > ZOOM_HEATMAP_MAX && indexRef.current) {
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
          next.set(`c:${p.cluster_id}:${p.postCount}`, {
            at,
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
      for (const s of data.spots) all.set(s.id, s);
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
      }),
      // 束の表紙は、写真がある中で投稿数が最も多いスポットの写真
      reduce: (acc, p) => {
        acc.postCount += p.postCount;
        if (p.best > acc.best) {
          acc.best = p.best;
          acc.coverThumbUrl = p.coverThumbUrl;
          acc.category = p.category;
          acc.name = p.name;
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
  }, [categoryKey]);

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
      map.addSource("heat", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer(HEAT_LAYER as Parameters<MlMap["addLayer"]>[0]);
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

export function locateMe(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
  });
}
