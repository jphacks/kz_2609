"use client";

import type { Map as MlMap } from "maplibre-gl";
import { Minus, Plus } from "lucide-react";
import { useRef, useState, type PointerEvent } from "react";
import { cn } from "@/components/ui";
import { zoomFromEdgeDrag } from "@/lib/edge-zoom";

type Side = "left" | "right";

// F-1-10：スマホで画面の左右の端を上下になぞると、地図を拡大・縮小する（片手の親指で操作できるように）。
// 指で操作する端末（pointer: coarse）だけに出す。ピンチ操作やふつうのドラッグはそのまま使える
export function EdgeZoom({ getMap }: { getMap: () => MlMap | null }) {
  const drag = useRef<{ id: number; y: number; zoom: number } | null>(null);
  const [active, setActive] = useState<Side | null>(null);

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
    drag.current = { id: e.pointerId, y: e.clientY, zoom: map.getZoom() };
    setActive(side);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const map = getMap();
    if (!d || !map || e.pointerId !== d.id) return;
    map.jumpTo({ zoom: zoomFromEdgeDrag(d.zoom, e.clientY - d.y, map.getMinZoom(), map.getMaxZoom()) });
  };
  const end = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    setActive(null);
  };

  return (
    <>
      {(["left", "right"] as const).map((side) => (
        <div
          key={side}
          aria-hidden
          data-testid={`edge-zoom-${side}`}
          onPointerDown={start(side)}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          className={cn(
            "absolute inset-y-0 z-10 hidden w-7 touch-none select-none pointer-coarse:block",
            side === "left" ? "left-0" : "right-0",
          )}
        >
          {active === side && (
            <div className="absolute inset-y-24 left-1 right-1 flex flex-col items-center justify-between rounded-full bg-black/15 py-2 text-white">
              <Plus size={16} strokeWidth={2} />
              <Minus size={16} strokeWidth={2} />
            </div>
          )}
        </div>
      ))}
    </>
  );
}
