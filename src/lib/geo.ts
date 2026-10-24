// 距離・タイルの計算（外部APIを使わず端末内やサーバーで計算する）

export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_M = 6371000;

export function distanceM(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

// Web メルカトルのタイル番号 → 緯度経度の範囲
export function tileToBBox(z: number, x: number, y: number) {
  const n = 2 ** z;
  const lng = (xx: number) => (xx / n) * 360 - 180;
  const lat = (yy: number) => {
    const r = Math.PI - (2 * Math.PI * yy) / n;
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(r) - Math.exp(-r)));
  };
  return { minLng: lng(x), maxLng: lng(x + 1), maxLat: lat(y), minLat: lat(y + 1) };
}

export function lngLatToTile(lng: number, lat: number, z: number) {
  const n = 2 ** z;
  const clampedLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const x = Math.floor(((lng + 180) / 360) * n);
  const rad = (clampedLat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return { x: Math.min(n - 1, Math.max(0, x)), y: Math.min(n - 1, Math.max(0, y)) };
}

// 取得用のズーム段階（F-1-2・9.3）。ヒートマップは z5、写真の束は z9、写真ピンは z13 の区画で取得する
export function fetchZoomFor(mapZoom: number): number {
  if (mapZoom < 9) return 5;
  if (mapZoom < 14) return 9;
  return 13;
}
