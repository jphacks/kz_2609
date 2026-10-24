import { describe, expect, it } from "vitest";
import { EDGE_ZOOM_PX_PER_LEVEL, zoomFromEdgeDrag } from "@/lib/edge-zoom";

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
