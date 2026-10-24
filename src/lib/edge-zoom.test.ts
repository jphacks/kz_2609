import { describe, expect, it } from "vitest";
import { EDGE_ZOOM_PX_PER_LEVEL, edgeWavePath, smoothToward, zoomFromEdgeDrag } from "@/lib/edge-zoom";

describe("zoomFromEdgeDrag（F-1-10）", () => {
  it("上へなぞると拡大、下へなぞると縮小する", () => {
    expect(zoomFromEdgeDrag(12, -EDGE_ZOOM_PX_PER_LEVEL, 0, 20)).toBe(13);
    expect(zoomFromEdgeDrag(12, EDGE_ZOOM_PX_PER_LEVEL * 2, 0, 20)).toBe(10);
    expect(zoomFromEdgeDrag(12, 0, 0, 20)).toBe(12);
  });

  it("地図の最小・最大ズームを超えない", () => {
    expect(zoomFromEdgeDrag(19.5, -EDGE_ZOOM_PX_PER_LEVEL * 3, 0, 20)).toBe(20);
    expect(zoomFromEdgeDrag(1, EDGE_ZOOM_PX_PER_LEVEL * 5, 0, 20)).toBe(0);
  });
});

describe("smoothToward（F-1-10 の滑らかなズーム）", () => {
  it("目標へ少しずつ近づき、時間がたつほど近くなる", () => {
    const a = smoothToward(10, 12, 16);
    const b = smoothToward(10, 12, 100);
    expect(a).toBeGreaterThan(10);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(12);
  });

  it("ほぼ追いついたら目標そのものを返し、時間0なら動かない", () => {
    expect(smoothToward(11.999, 12, 16)).toBe(12);
    expect(smoothToward(10, 12, 0)).toBe(10);
  });
});

describe("edgeWavePath（端からせり出す波）", () => {
  it("右端なら頂点が指の高さで、端から bulge だけ内側にある", () => {
    const d = edgeWavePath("right", 400, 800, 300, 120, 200);
    expect(d.startsWith("M 400 0")).toBe(true);
    expect(d).toContain("280 300");
    expect(d.endsWith("L 400 800 Z")).toBe(true);
  });

  it("左端なら左からふくらむ", () => {
    const d = edgeWavePath("left", 400, 800, 300, 120, 200);
    expect(d.startsWith("M 0 0")).toBe(true);
    expect(d).toContain("120 300");
  });
});
