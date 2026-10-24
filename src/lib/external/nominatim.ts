import "server-only";

import { ApiError } from "@/lib/api";
import { serverEnv } from "@/lib/env";
import { consumeQuota } from "@/lib/quota";
import { quotas } from "@/lib/external/quotas";

// Nominatim（OpenStreetMap）の場所検索。公開サーバーの利用規約に従い、1秒に1回まで・自動補完には使わない
const BASE = "https://nominatim.openstreetmap.org";
let lastCallAt = 0;

export type Place = {
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  prefecture: string | null;
  city: string | null;
  externalRef: string;
};

type NominatimItem = {
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: Record<string, string | undefined>;
};

async function call(path: string): Promise<unknown> {
  const env = serverEnv();
  const wait = 1000 - (Date.now() - lastCallAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();

  if (!(await consumeQuota(quotas().nominatim, 1))) {
    throw new ApiError("FEATURE_SUSPENDED", "現在、外部の場所検索は利用できません", { feature: "place_search" });
  }
  const res = await fetch(`${BASE}${path}`, {
    headers: { "User-Agent": env.nominatimUserAgent, "Accept-Language": "ja" },
    cache: "no-store",
  });
  if (!res.ok) throw new ApiError("UPSTREAM_ERROR", "場所検索に失敗しました");
  return res.json();
}

function toPlace(item: NominatimItem): Place {
  const a = item.address ?? {};
  const name = item.name || item.display_name.split(",")[0]?.trim() || "名称不明";
  return {
    name: name.slice(0, 50),
    lat: Number(item.lat),
    lng: Number(item.lon),
    address: item.display_name ?? null,
    prefecture: a.province ?? a.state ?? null,
    city: a.city ?? a.town ?? a.village ?? a.county ?? null,
    externalRef: `${item.osm_type}/${item.osm_id}`,
  };
}

export async function searchPlaces(q: string): Promise<Place[]> {
  const params = new URLSearchParams({
    q,
    format: "jsonv2",
    addressdetails: "1",
    countrycodes: "jp",
    limit: "10",
  });
  const data = (await call(`/search?${params}`)) as NominatimItem[];
  return data.map(toPlace);
}

export async function reverseGeocode(lat: number, lng: number): Promise<Omit<Place, "name" | "externalRef"> | null> {
  try {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lng), format: "jsonv2", addressdetails: "1" });
    const item = (await call(`/reverse?${params}`)) as NominatimItem;
    const p = toPlace(item);
    return { lat, lng, address: p.address, prefecture: p.prefecture, city: p.city };
  } catch {
    // 住所が取れなくてもスポットは作れるようにする
    return null;
  }
}
