// F-1-10：画面の左右の端を上下になぞったときのズームの計算（画面とテストで共通）
// 上へなぞると拡大、下へなぞると縮小。120px でズーム1段階
export const EDGE_ZOOM_PX_PER_LEVEL = 120;

export function zoomFromEdgeDrag(startZoom: number, dy: number, minZoom: number, maxZoom: number): number {
  const z = startZoom - dy / EDGE_ZOOM_PX_PER_LEVEL;
  return Math.min(maxZoom, Math.max(minZoom, z));
}
