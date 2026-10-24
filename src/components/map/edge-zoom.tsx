"use client";

import type { Map as MlMap } from "maplibre-gl";
import { useEffect, useRef, type PointerEvent } from "react";
import { cn } from "@/components/ui";
import { edgeWavePath, smoothToward, zoomFromEdgeDrag } from "@/lib/edge-zoom";

type Side = "left" | "right";

// 波の大きさ（px）。押した瞬間に WAVE_BULGE までせり出し、なぞった距離に応じて少し大きくなる
const WAVE_BULGE = 56;
const WAVE_BULGE_MAX = 96;
const WAVE_SPREAD = 220;

// F-1-10：スマホで画面の左右の端を上下になぞると、地図を拡大・縮小する（片手の親指で操作できるように）。
// whoo のように、端から指の高さを頂点にした半透明の波がせり出し、ズームは目標へ毎フレーム少しずつ近づけて滑らかにする。
// 指で操作する端末（pointer: coarse）だけに出す。ピンチ操作やふつうのドラッグはそのまま使える
export function EdgeZoom({ getMap }: { getMap: () => MlMap | null }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  // 毎フレーム変わる値は ref に置き、React の再描画を起こさない
  const state = useRef({
    pointer: null as number | null,
    side: "right" as Side,
    startY: 0,
    startZoom: 0,
    y: 0,
    targetZoom: null as number | null,
    bulge: 0,
    raf: 0,
    last: 0,
  });
  const tickRef = useRef<(now: number) => void>(() => undefined);
  const getMapRef = useRef(getMap);
  useEffect(() => {
    getMapRef.current = getMap;
  });

  useEffect(() => {
    const s = state.current;
    // 1フレーム分：ズームを目標へ近づけ、波の形を描き直す。動くものがなくなったら止まる
    tickRef.current = (now: number) => {
      const map = getMapRef.current();
      const root = rootRef.current;
      const dt = s.last ? Math.min(now - s.last, 64) : 16;
      s.last = now;
      let moving = false;

      if (map && s.targetZoom !== null) {
        const current = map.getZoom();
        const next = smoothToward(current, s.targetZoom, dt);
        if (next !== current) map.jumpTo({ zoom: next });
        if (next === s.targetZoom && s.pointer === null) s.targetZoom = null;
        else moving = true;
      }

      const pressed = s.pointer !== null;
      const wantBulge = pressed ? Math.min(WAVE_BULGE_MAX, WAVE_BULGE + Math.abs(s.y - s.startY) * 0.15) : 0;
      s.bulge = smoothToward(s.bulge, wantBulge, dt, pressed ? 70 : 110);
      if (s.bulge > 0.5 || pressed) moving = true;
      else s.bulge = 0;

      if (root && svgRef.current && pathRef.current) {
        const { width, height } = root.getBoundingClientRect();
        svgRef.current.setAttribute("viewBox", `0 0 ${width} ${height}`);
        pathRef.current.setAttribute("d", s.bulge > 0 ? edgeWavePath(s.side, width, height, s.y, s.bulge, WAVE_SPREAD) : "");
      }

      if (moving) s.raf = requestAnimationFrame((t) => tickRef.current(t));
      else {
        s.raf = 0;
        s.last = 0;
      }
    };
    return () => {
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, []);

  const run = () => {
    const s = state.current;
    if (!s.raf) s.raf = requestAnimationFrame((t) => tickRef.current(t));
  };

  const localY = (e: PointerEvent<HTMLDivElement>) => e.clientY - (rootRef.current?.getBoundingClientRect().top ?? 0);

  const start = (side: Side) => (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") return;
    const map = getMap();
    if (!map) return;
    try {
      // 指が端の帯から外れても、なぞり続けている間はズームを続ける
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // 取得できない環境でも、帯の上でなぞる分には動く
    }
    map.stop();
    const s = state.current;
    s.pointer = e.pointerId;
    s.side = side;
    s.startY = s.y = localY(e);
    s.startZoom = map.getZoom();
    s.targetZoom = s.startZoom;
    run();
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const s = state.current;
    const map = getMap();
    if (!map || e.pointerId !== s.pointer) return;
    s.y = localY(e);
    s.targetZoom = zoomFromEdgeDrag(s.startZoom, s.y - s.startY, map.getMinZoom(), map.getMaxZoom());
    run();
  };
  const end = (e: PointerEvent<HTMLDivElement>) => {
    if (state.current.pointer !== e.pointerId) return;
    // 指を離しても、目標のズームまでは滑らかに進み、波は引っ込む
    state.current.pointer = null;
    run();
  };

  return (
    <div ref={rootRef} aria-hidden className="pointer-events-none absolute inset-0 z-10 hidden pointer-coarse:block">
      <svg ref={svgRef} className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <path ref={pathRef} fill="rgba(0, 0, 0, 0.22)" />
      </svg>
      {(["left", "right"] as const).map((side) => (
        <div
          key={side}
          data-testid={`edge-zoom-${side}`}
          onPointerDown={start(side)}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          className={cn(
            "pointer-events-auto absolute inset-y-0 w-7 touch-none select-none",
            side === "left" ? "left-0" : "right-0",
          )}
        />
      ))}
    </div>
  );
}
