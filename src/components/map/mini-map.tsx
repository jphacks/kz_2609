"use client";

import { LngLatBounds, Map as MlMap, Marker, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useRef } from "react";
import { createBaseMarker, createNumberMarker, createPinMarker } from "@/components/map/markers";
import { MAP_STYLE } from "@/components/map/spot-map";
import type { Category, Popularity } from "@/lib/constants";

if (typeof window !== "undefined") setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export type MiniMapSpot = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: Category;
  popularity?: Popularity;
  coverThumbUrl: string | null;
};

type Pt = { lat: number; lng: number };

// リストのスポット一括表示（F-4-5）と経路の線（F-5-8：訪問順に結んだ線。道路に沿った線は描かない）
export function MiniMap({
  spots,
  base,
  route,
  onSelect,
  className = "h-64",
}: {
  spots: MiniMapSpot[];
  base?: { label: string; lat: number; lng: number } | null;
  route?: Pt[] | null;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const ready = useRef(false);

  const draw = useCallback(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    for (const m of markers.current) m.remove();
    markers.current = [];

    const bounds = new LngLatBounds();
    // 経路があるときは訪問順の番号、ないときは写真ピン
    const numbered = Boolean(route && route.length > 0);
    spots.forEach((s, i) => {
      const el = numbered
        ? createNumberMarker(i + 1)
        : createPinMarker({ coverUrl: s.coverThumbUrl, category: s.category, popularity: s.popularity ?? "normal", label: s.name });
      if (onSelect) el.addEventListener("click", () => onSelect(s.id));
      markers.current.push(
        new Marker({ element: el, anchor: numbered ? "center" : "bottom" }).setLngLat([s.lng, s.lat]).addTo(map),
      );
      bounds.extend([s.lng, s.lat]);
    });
    if (base) {
      markers.current.push(new Marker({ element: createBaseMarker(base.label) }).setLngLat([base.lng, base.lat]).addTo(map));
      bounds.extend([base.lng, base.lat]);
    }

    const coords = (route ?? []).map((p) => [p.lng, p.lat]);
    const data: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features:
        coords.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }] : [],
    };
    const src = map.getSource("route") as GeoJSONSource | undefined;
    if (src) {
      src.setData(data);
    } else {
      map.addSource("route", { type: "geojson", data });
      map.addLayer({
        id: "route",
        type: "line",
        source: "route",
        paint: { "line-color": "#1f6f5c", "line-width": 4, "line-opacity": 0.8, "line-dasharray": [2, 1] },
      });
    }
    for (const p of route ?? []) bounds.extend([p.lng, p.lat]);
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });
  }, [spots, base, route, onSelect]);

  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
    draw();
  }, [draw]);

  useEffect(() => {
    if (!ref.current) return;
    const map = new MlMap({
      container: ref.current,
      style: MAP_STYLE,
      center: [136.66, 36.57],
      zoom: 12,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.once("style.load", () => {
      ready.current = true;
      drawRef.current();
    });
    return () => {
      map.remove();
      mapRef.current = null;
      ready.current = false;
    };
  }, []);

  return <div ref={ref} className={`w-full overflow-hidden rounded-xl border border-border ${className}`} />;
}
