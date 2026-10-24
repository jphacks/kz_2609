import "server-only";

import { ApiError } from "@/lib/api";
import type { TravelMode } from "@/lib/constants";
import { serverEnv } from "@/lib/env";
import { distanceM } from "@/lib/geo";
import { UNREACHABLE_MIN } from "@/lib/planner";
import type { LegOverride, TravelMatrix } from "@/lib/planner/types";
import { consumeQuota } from "@/lib/quota";
import { quotas } from "@/lib/external/quotas";

// 移動時間は Google Routes API（Essentials）だけで取得する（ADR-0019）。
// - 計画（順番と時刻）にだけ使い、経路の形は取得しない。地図には訪問順を結んだ線を描く
// - Essentials に収めるため、車は渋滞を考えない計算（TRAFFIC_UNAWARE）にし、返してもらう項目は所要時間・距離・状態だけにする
// - Google の利用規約に合わせ、取得した結果はその計画の間だけ使い、DB に保存しない
// - 公共交通が取得できない区間は概算で補う

export type MatrixPoint = { key: string; lat: number; lng: number };
type Pt = { lat: number; lng: number };

const DETOUR = 1.3; // 直線距離から道のりへの換算
const WALK_KMH = 4.8;
const DRIVE_KMH = 30;
const TRANSIT_KMH = 15; // 金沢は路線バス中心
const TRANSIT_WAIT_MIN = 10;
const TRANSIT_ACCESS_WALK_M = 400; // 公共交通の区間に含まれる徒歩（駅・バス停まで）の目安

const MODE: Record<TravelMode, "WALK" | "DRIVE" | "TRANSIT"> = {
  walking: "WALK",
  driving: "DRIVE",
  transit: "TRANSIT",
};

// 直線距離からの概算（開発用のモックと、公共交通が取れないときの代わり）
export function estimateLeg(a: Pt, b: Pt, mode: TravelMode): LegOverride {
  const straight = distanceM(a, b);
  const road = straight * DETOUR;
  const walkMin = (road / 1000 / WALK_KMH) * 60;
  if (mode === "walking") return { mode, travelMin: walkMin, distM: Math.round(road), walkM: road, estimated: true };
  if (mode === "driving") {
    return { mode, travelMin: (road / 1000 / DRIVE_KMH) * 60 + 5, distM: Math.round(road), walkM: 0, estimated: true };
  }
  // 近い区間は歩いた方が早いので徒歩の時間を使う
  const transitMin = (straight / 1000 / TRANSIT_KMH) * 60 + TRANSIT_WAIT_MIN;
  if (walkMin <= transitMin) return { mode, travelMin: walkMin, distM: Math.round(road), walkM: road, estimated: true };
  return { mode, travelMin: transitMin, distM: Math.round(road), walkM: TRANSIT_ACCESS_WALK_M, estimated: true };
}

const walkFor = (mode: TravelMode, distM: number) =>
  mode === "walking" ? distM : mode === "transit" ? TRANSIT_ACCESS_WALK_M : 0;

const location = (p: Pt) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });

// 公共交通だけ出発時刻を渡す（車・徒歩に渡すと Essentials の条件から外れるため渡さない）
function timingFields(mode: TravelMode, departIso: string) {
  if (mode === "transit") return { departureTime: departIso };
  if (mode === "driving") return { routingPreference: "TRAFFIC_UNAWARE" };
  return {};
}

function parseSeconds(d: string | undefined) {
  if (!d) return null;
  const sec = Number.parseInt(d.replace("s", ""), 10);
  return Number.isFinite(sec) ? sec : null;
}

async function googleMatrix(points: MatrixPoint[], mode: TravelMode, departIso: string, apiKey: string) {
  const res = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "originIndex,destinationIndex,duration,distanceMeters,condition",
    },
    body: JSON.stringify({
      origins: points.map((p) => ({ waypoint: location(p) })),
      destinations: points.map((p) => ({ waypoint: location(p) })),
      travelMode: MODE[mode],
      ...timingFields(mode, departIso),
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`google route matrix ${res.status}: ${await res.text()}`);
  const elements = (await res.json()) as Array<{
    originIndex?: number;
    destinationIndex?: number;
    duration?: string;
    distanceMeters?: number;
    condition?: string;
  }>;
  const result = new Map<string, { sec: number; distM: number }>();
  for (const el of elements) {
    const sec = parseSeconds(el.duration);
    if (el.condition !== "ROUTE_EXISTS" || sec === null) continue;
    result.set(`${el.originIndex ?? 0}:${el.destinationIndex ?? 0}`, { sec, distM: el.distanceMeters ?? 0 });
  }
  return result;
}

async function googleRoute(from: Pt, to: Pt, mode: TravelMode, departIso: string, apiKey: string) {
  const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
    },
    body: JSON.stringify({
      origin: location(from),
      destination: location(to),
      travelMode: MODE[mode],
      ...timingFields(mode, departIso),
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`google routes ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { routes?: Array<{ duration?: string; distanceMeters?: number }> };
  const r = body.routes?.[0];
  const sec = parseSeconds(r?.duration);
  return sec === null ? null : { sec, distM: r?.distanceMeters ?? 0 };
}

export function isMockMode(): boolean {
  const env = serverEnv();
  return env.useMockExternalApis || env.googleRoutesApiKey === "";
}

const MOCK_NOTE = "移動時間は直線距離からの概算（開発用）です";
const TRANSIT_FALLBACK_NOTE = "公共交通の移動時間を取得できなかった区間は、概算で計算しています";

// 計画用の移動時間の行列（経路作成1回につき1回。F-5-3・F-5-4）
export async function getTravelMatrix(
  points: MatrixPoint[],
  mode: TravelMode,
  date: string,
  startTime: string,
): Promise<TravelMatrix & { notes: string[] }> {
  const n = points.length;
  const notes: string[] = [];
  const grid = <T,>(v: T) => Array.from({ length: n }, () => Array<T>(n).fill(v));
  const minutes = grid(0);
  const distances = grid(0);
  const walk = grid(0);
  const estimated = grid(false);

  let fetched: Map<string, { sec: number; distM: number }> | null = null;
  if (isMockMode()) {
    notes.push(MOCK_NOTE);
  } else {
    if (!(await consumeQuota(quotas().googleRouteMatrix, n * n))) {
      throw new ApiError("FEATURE_SUSPENDED", "現在、経路の作成は利用できません", { feature: "route_matrix" });
    }
    try {
      const departIso = new Date(`${date}T${startTime}:00+09:00`).toISOString();
      fetched = await googleMatrix(points, mode, departIso, serverEnv().googleRoutesApiKey);
    } catch (e) {
      console.error(e);
      if (mode !== "transit") {
        throw new ApiError("UPSTREAM_ERROR", "移動時間を取得できませんでした。少し待ってから試してください");
      }
    }
  }

  let fallback = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const hit = fetched?.get(`${i}:${j}`);
      if (hit) {
        minutes[i][j] = hit.sec / 60;
        distances[i][j] = hit.distM;
        walk[i][j] = walkFor(mode, hit.distM);
      } else if (fetched && mode !== "transit") {
        // 徒歩・車で経路がない区間（離島など）は通れないものとして扱う
        minutes[i][j] = UNREACHABLE_MIN;
      } else {
        const leg = estimateLeg(points[i], points[j], mode);
        minutes[i][j] = leg.travelMin;
        distances[i][j] = leg.distM;
        walk[i][j] = leg.walkM;
        estimated[i][j] = true;
        fallback++;
      }
    }
  }
  if (!isMockMode() && fallback > 0) notes.push(TRANSIT_FALLBACK_NOTE);
  return { minutes, distances, walk, estimated, notes };
}

export type LegRequest = { from: Pt; to: Pt; mode: TravelMode; departAt: string };

// 区間ごとの所要時間（F-5-10：移動手段の変更、公共交通の実際の出発時刻での取り直し）
export async function getLegs(legs: LegRequest[]): Promise<{ legs: LegOverride[]; notes: string[] }> {
  if (isMockMode()) {
    return { legs: legs.map((l) => estimateLeg(l.from, l.to, l.mode)), notes: [MOCK_NOTE] };
  }
  if (!(await consumeQuota(quotas().googleRoutes, legs.length))) {
    throw new ApiError("FEATURE_SUSPENDED", "現在、移動時間の再計算は利用できません", { feature: "routes" });
  }
  const apiKey = serverEnv().googleRoutesApiKey;
  const out = await Promise.all(
    legs.map(async (l): Promise<LegOverride> => {
      try {
        const r = await googleRoute(l.from, l.to, l.mode, l.departAt, apiKey);
        if (r) {
          return { mode: l.mode, travelMin: r.sec / 60, distM: r.distM, walkM: walkFor(l.mode, r.distM), estimated: false };
        }
      } catch (e) {
        console.error(e);
        if (l.mode !== "transit") {
          throw new ApiError("UPSTREAM_ERROR", "移動時間を取得できませんでした。少し待ってから試してください");
        }
      }
      if (l.mode !== "transit") return { mode: l.mode, travelMin: UNREACHABLE_MIN, distM: 0, walkM: 0, estimated: false };
      return estimateLeg(l.from, l.to, l.mode);
    }),
  );
  const fallback = out.some((l) => l.estimated);
  return { legs: out, notes: fallback ? [TRANSIT_FALLBACK_NOTE] : [] };
}
