// F-1-10：画面の左右の端を上下になぞったときのズームの計算（画面とテストで共通）
// 上へなぞると拡大、下へなぞると縮小。120px でズーム1段階
export const EDGE_ZOOM_PX_PER_LEVEL = 120;

export function zoomFromEdgeDrag(startZoom: number, dy: number, minZoom: number, maxZoom: number): number {
  const z = startZoom - dy / EDGE_ZOOM_PX_PER_LEVEL;
  return Math.min(maxZoom, Math.max(minZoom, z));
}

// 指の動きに地図をそのままつなぐとカクつくため、目標のズームへ毎フレーム少しずつ近づける。
// τ（ミリ秒）が小さいほど速く追いつく。ほぼ追いついたら目標そのものを返す
export const EDGE_ZOOM_SMOOTH_MS = 90;

export function smoothToward(current: number, target: number, dtMs: number, tauMs = EDGE_ZOOM_SMOOTH_MS): number {
  if (Math.abs(target - current) < 0.002) return target;
  const k = 1 - Math.exp(-Math.max(0, dtMs) / tauMs);
  return current + (target - current) * k;
}

// 端からせり出す波の形（SVG の path）。指の高さ y を頂点に、bulge の幅だけ内側へふくらむ
export function edgeWavePath(side: "left" | "right", width: number, height: number, y: number, bulge: number, spread: number): string {
  const edge = side === "right" ? width : 0;
  const peak = side === "right" ? width - bulge : bulge;
  const top = y - spread;
  const bottom = y + spread;
  const r = (n: number) => Math.round(n * 10) / 10;
  return [
    `M ${r(edge)} 0`,
    `L ${r(edge)} ${r(top)}`,
    `C ${r(edge)} ${r(top + spread * 0.5)} ${r(peak)} ${r(y - spread * 0.5)} ${r(peak)} ${r(y)}`,
    `C ${r(peak)} ${r(y + spread * 0.5)} ${r(edge)} ${r(bottom - spread * 0.5)} ${r(edge)} ${r(bottom)}`,
    `L ${r(edge)} ${r(height)}`,
    "Z",
  ].join(" ");
}
