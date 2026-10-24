import "server-only";

import { ApiError } from "@/lib/api";
import type { TravelMode } from "@/lib/constants";
import { serverEnv } from "@/lib/env";
import { distanceM } from "@/lib/geo";
import { UNREACHABLE_MIN } from "@/lib/planner";
import type { LegOverride, TravelMatrix } from "@/lib/planner/types";
import { consumeQuota } from "@/lib/quota";
import { quotas } from "@/lib/external/quotas";
import {
  NETWORK,
  busRideFromDriveSec,
  estimateRideTimes,
  getStop,
  prefersTransit,
  type RideTimes,
} from "@/lib/transit/network";
import { findTransitRoute, type TransitRoute, type TransitStep } from "@/lib/transit/route";

// 移動時間は Google Routes API（Essentials）で取得する（ADR-0019）。
// - 計画（順番と時刻）にだけ使い、経路の形は取得しない。地図には訪問順を結んだ線を描く
// - Essentials に収めるため、車は渋滞を考えない計算（TRAFFIC_UNAWARE）にし、返してもらう項目は所要時間・距離・状態だけにする
// - Google の利用規約に合わせ、取得した結果はその計画の間だけ使い、DB に保存しない
// 公共交通（ADR-0026）：Routes API は日本の電車・バスを返さないため、国土数値情報の停留所・駅と路線から
// 「徒歩 → 乗り場 → 乗車 → 降り場 → 徒歩」を自分で探す（src/lib/transit）。徒歩は Google、バスの乗車時間は
// Google の車の所要時間から、鉄道は平均の速さから計算し、待ち時間は目安を使う

export type MatrixPoint = { key: string; lat: number; lng: number };
type Pt = { lat: number; lng: number };

const DETOUR = 1.3; // 直線距離から道のりへの換算
const WALK_KMH = 4.8;
const DRIVE_KMH = 30;
const TRANSIT_KMH = 15; // 対応する路線がない区間の概算（金沢は路線バス中心）
const TRANSIT_WAIT_MIN = 10;
const TRANSIT_ACCESS_WALK_M = 400; // 概算の公共交通に含まれる徒歩（駅・バス停まで）の目安
// 対応する路線がない区間で、これより短ければ徒歩にする（分）
const WALK_INSTEAD_MAX_MIN = 45;

const MODE: Record<TravelMode, "WALK" | "DRIVE" | "TRANSIT"> = {
  walking: "WALK",
  driving: "DRIVE",
  transit: "TRANSIT",
};

const walkEstimate = (a: Pt, b: Pt) => {
  const road = distanceM(a, b) * DETOUR;
  return { min: (road / 1000 / WALK_KMH) * 60, distM: road };
};

// 対応する路線がない区間の公共交通の概算（旧 ADR-0018 の考え方）
function roughTransit(a: Pt, b: Pt): LegOverride {
  const straight = distanceM(a, b);
  return {
    mode: "transit",
    travelMin: (straight / 1000 / TRANSIT_KMH) * 60 + TRANSIT_WAIT_MIN,
    distM: Math.round(straight * DETOUR),
    walkM: TRANSIT_ACCESS_WALK_M,
    estimated: true,
  };
}

const walkSteps = (min: number, distM: number): TransitStep[] => [{ kind: "walk", min: Math.max(1, Math.round(min)), distM: Math.round(distM), to: null }];

// 表示する手順の分数を整数にし、区間の合計を手順の合計にそろえる
function roundSteps(steps: TransitStep[]) {
  const out = steps.map((s): TransitStep =>
    s.kind === "walk"
      ? { ...s, min: Math.max(1, Math.round(s.min)), distM: Math.round(s.distM) }
      : { ...s, waitMin: Math.round(s.waitMin), rideMin: Math.max(1, Math.round(s.rideMin)) },
  );
  const total = out.reduce((t, s) => t + (s.kind === "walk" ? s.min : s.waitMin + s.rideMin), 0);
  return { steps: out, total };
}

// 公共交通の区間を1つ決める：乗り物を使う経路と、全部歩く場合を比べて早い方。どちらも無理なら概算
function chooseTransit(a: Pt, b: Pt, route: TransitRoute | null, walk: { min: number; distM: number }, rough: boolean): LegOverride {
  if (route && prefersTransit(route.totalMin, walk.min)) {
    const { steps, total } = roundSteps(route.steps);
    return { mode: "transit", travelMin: total, distM: route.distM, walkM: route.walkM, estimated: true, steps };
  }
  if (route || walk.min <= WALK_INSTEAD_MAX_MIN) {
    return { mode: "transit", travelMin: walk.min, distM: Math.round(walk.distM), walkM: walk.distM, estimated: rough, steps: walkSteps(walk.min, walk.distM) };
  }
  return roughTransit(a, b);
}

// 直線距離からの概算（開発用のモックと、Google を使えないときの代わり）
export function estimateLeg(a: Pt, b: Pt, mode: TravelMode, rides: RideTimes = estimateRideTimes()): LegOverride {
  const walk = walkEstimate(a, b);
  if (mode === "walking") return { mode, travelMin: walk.min, distM: Math.round(walk.distM), walkM: walk.distM, estimated: true };
  if (mode === "driving") {
    return { mode, travelMin: (walk.distM / 1000 / DRIVE_KMH) * 60 + 5, distM: Math.round(walk.distM), walkM: 0, estimated: true };
  }
  return chooseTransit(a, b, findTransitRoute(a, b, rides), walk, true);
}

const walkFor = (mode: TravelMode, distM: number) => (mode === "walking" ? distM : 0);

const location = (p: Pt) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });

// 車は渋滞を考えない計算にする（渋滞を考えると Essentials の条件から外れるため）
function timingFields(mode: TravelMode) {
  return mode === "driving" ? { routingPreference: "TRAFFIC_UNAWARE" } : {};
}

function parseSeconds(d: string | undefined) {
  if (!d) return null;
  const sec = Number.parseInt(d.replace("s", ""), 10);
  return Number.isFinite(sec) ? sec : null;
}

async function googleMatrix(points: MatrixPoint[], mode: "walking" | "driving", apiKey: string) {
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
      ...timingFields(mode),
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

// 1区間の経路。経由地（intermediates）を渡すと、経由地ごとの区間（legs）の所要時間も返す
async function googleRoute(points: Pt[], mode: "walking" | "driving", apiKey: string) {
  const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.legs.duration",
    },
    body: JSON.stringify({
      origin: location(points[0]),
      destination: location(points[points.length - 1]),
      ...(points.length > 2 ? { intermediates: points.slice(1, -1).map(location) } : {}),
      travelMode: MODE[mode],
      ...timingFields(mode),
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`google routes ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as {
    routes?: Array<{ duration?: string; distanceMeters?: number; legs?: Array<{ duration?: string }> }>;
  };
  const r = body.routes?.[0];
  const sec = parseSeconds(r?.duration);
  return sec === null ? null : { sec, distM: r?.distanceMeters ?? 0, legSec: (r?.legs ?? []).map((l) => parseSeconds(l.duration)) };
}

// Compute Routes Essentials で使える経由地は10か所まで（11か所以上は Pro になる）
const MAX_INTERMEDIATES = 10;

// バスの停留所間の乗車時間を、Google の車の所要時間（渋滞なし）から出す。周遊バス1周で1〜2回呼ぶ
async function googleRideTimes(apiKey: string): Promise<{ rides: RideTimes; calls: number }> {
  const rides = estimateRideTimes();
  let calls = 0;
  await Promise.all(
    NETWORK.lines
      .filter((l) => l.kind === "bus")
      .map(async (line) => {
        const pts = line.stopIds.map(getStop);
        const segs = [...rides.get(line.id)!];
        const chunks: number[] = [];
        for (let start = 0; start < pts.length - 1; start += MAX_INTERMEDIATES + 1) chunks.push(start);
        calls += chunks.length;
        await Promise.all(
          chunks.map(async (start) => {
            const part = pts.slice(start, start + MAX_INTERMEDIATES + 2);
            const r = await googleRoute(part, "driving", apiKey);
            r?.legSec.forEach((sec, i) => {
              if (sec !== null) segs[start + i] = busRideFromDriveSec(sec);
            });
          }),
        );
        rides.set(line.id, segs);
      }),
  );
  return { rides, calls };
}

// 周遊バスの1周あたりの呼び出し回数（無料枠の確認用）
const RIDE_TIME_CALLS = NETWORK.lines
  .filter((l) => l.kind === "bus")
  .reduce((n, l) => n + Math.ceil((l.stopIds.length - 1) / (MAX_INTERMEDIATES + 1)), 0);

// バスの乗車時間。Google を使えないとき（モック・無料枠・エラー）は直線距離からの目安
async function rideTimes(): Promise<RideTimes> {
  if (isMockMode()) return estimateRideTimes();
  if (!(await consumeQuota(quotas().googleRoutes, RIDE_TIME_CALLS))) return estimateRideTimes();
  try {
    return (await googleRideTimes(serverEnv().googleRoutesApiKey)).rides;
  } catch (e) {
    console.error(e);
    return estimateRideTimes();
  }
}

export function isMockMode(): boolean {
  const env = serverEnv();
  return env.useMockExternalApis || env.googleRoutesApiKey === "";
}

const MOCK_NOTE = "移動時間は直線距離からの概算（開発用）です";
const TRANSIT_NOTE =
  "公共交通は、城下まち金沢周遊バスと石川県の鉄道で計算しています。乗り場までの徒歩は Google マップの時間、待ち時間と乗車時間は時刻表を使わない目安です";
const TRANSIT_ROUGH_NOTE = "対応する路線がない区間は、直線距離からの概算で計算しています";

// 計画用の移動時間の行列（経路作成1回につき1回。F-5-3・F-5-4）。
// 公共交通は、全部歩く時間（Google の徒歩の行列）と、乗り物を使う経路（ADR-0026）の早い方
export async function getTravelMatrix(
  points: MatrixPoint[],
  mode: TravelMode,
): Promise<TravelMatrix & { notes: string[] }> {
  const n = points.length;
  const notes: string[] = [];
  const grid = <T,>(v: T) => Array.from({ length: n }, () => Array<T>(n).fill(v));
  const minutes = grid(0);
  const distances = grid(0);
  const walk = grid(0);
  const estimated = grid(false);
  const googleMode = mode === "driving" ? "driving" : "walking";

  let fetched: Map<string, { sec: number; distM: number }> | null = null;
  if (isMockMode()) {
    notes.push(MOCK_NOTE);
  } else {
    if (!(await consumeQuota(quotas().googleRouteMatrix, n * n))) {
      throw new ApiError("FEATURE_SUSPENDED", "現在、経路の作成は利用できません", { feature: "route_matrix" });
    }
    try {
      fetched = await googleMatrix(points, googleMode, serverEnv().googleRoutesApiKey);
    } catch (e) {
      console.error(e);
      throw new ApiError("UPSTREAM_ERROR", "移動時間を取得できませんでした。少し待ってから試してください");
    }
  }
  const rides = mode === "transit" ? await rideTimes() : null;

  let rough = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const hit = fetched?.get(`${i}:${j}`);
      let leg: LegOverride;
      if (mode === "transit") {
        const w = hit ? { min: hit.sec / 60, distM: hit.distM } : walkEstimate(points[i], points[j]);
        leg = chooseTransit(points[i], points[j], findTransitRoute(points[i], points[j], rides!), w, !hit);
      } else if (hit) {
        leg = { mode, travelMin: hit.sec / 60, distM: hit.distM, walkM: walkFor(mode, hit.distM), estimated: false };
      } else if (fetched) {
        // 徒歩・車で経路がない区間（離島など）は通れないものとして扱う
        leg = { mode, travelMin: UNREACHABLE_MIN, distM: 0, walkM: 0, estimated: false };
      } else {
        leg = estimateLeg(points[i], points[j], mode);
      }
      minutes[i][j] = leg.travelMin;
      distances[i][j] = leg.distM;
      walk[i][j] = leg.walkM;
      estimated[i][j] = leg.estimated;
      if (mode === "transit" && !leg.steps) rough++;
    }
  }
  if (mode === "transit" && !isMockMode()) notes.push(TRANSIT_NOTE);
  if (rough > 0 && !isMockMode()) notes.push(TRANSIT_ROUGH_NOTE);
  return { minutes, distances, walk, estimated, notes };
}

export type LegRequest = { from: Pt; to: Pt; mode: TravelMode; departAt: string };

// 公共交通の区間を、Google の徒歩（全部歩く・乗り場まで・降り場から）で直して決める
async function transitLeg(l: LegRequest, rides: RideTimes, apiKey: string): Promise<LegOverride> {
  const route = findTransitRoute(l.from, l.to, rides);
  // 徒歩を取れなかったときは直線距離からの目安で続ける
  const walkOf = async (a: Pt, b: Pt) => {
    try {
      const r = await googleRoute([a, b], "walking", apiKey);
      if (r) return { min: r.sec / 60, distM: r.distM };
    } catch (e) {
      console.error(e);
    }
    return walkEstimate(a, b);
  };
  const [direct, access, egress] = await Promise.all([
    walkOf(l.from, l.to),
    route ? walkOf(l.from, route.firstStop) : null,
    route ? walkOf(route.lastStop, l.to) : null,
  ]);
  if (route && access && egress) {
    const steps = route.steps.map((s) => ({ ...s }));
    const first = steps[0];
    const last = steps[steps.length - 1];
    if (first.kind === "walk") Object.assign(first, access);
    if (last.kind === "walk") Object.assign(last, egress);
    const totalMin = steps.reduce((t, s) => t + (s.kind === "walk" ? s.min : s.waitMin + s.rideMin), 0);
    const walkM = steps.reduce((t, s) => t + (s.kind === "walk" ? s.distM : 0), 0);
    return chooseTransit(l.from, l.to, { ...route, steps, totalMin, walkM }, direct, false);
  }
  return chooseTransit(l.from, l.to, null, direct, false);
}

// 区間ごとの所要時間（F-5-10：移動手段の変更、公共交通の区間の取り直し）
export async function getLegs(legs: LegRequest[]): Promise<{ legs: LegOverride[]; notes: string[] }> {
  if (isMockMode()) {
    return { legs: legs.map((l) => estimateLeg(l.from, l.to, l.mode)), notes: [MOCK_NOTE] };
  }
  // 公共交通の区間は、全部歩く・乗り場まで・降り場からの3回
  const units = legs.reduce((t, l) => t + (l.mode === "transit" ? 3 : 1), 0);
  if (!(await consumeQuota(quotas().googleRoutes, units))) {
    throw new ApiError("FEATURE_SUSPENDED", "現在、移動時間の再計算は利用できません", { feature: "routes" });
  }
  const apiKey = serverEnv().googleRoutesApiKey;
  const rides = legs.some((l) => l.mode === "transit") ? await rideTimes() : null;
  try {
    const out = await Promise.all(
      legs.map(async (l): Promise<LegOverride> => {
        if (l.mode === "transit") return transitLeg(l, rides!, apiKey);
        const r = await googleRoute([l.from, l.to], l.mode, apiKey);
        if (r) return { mode: l.mode, travelMin: r.sec / 60, distM: r.distM, walkM: walkFor(l.mode, r.distM), estimated: false };
        return { mode: l.mode, travelMin: UNREACHABLE_MIN, distM: 0, walkM: 0, estimated: false };
      }),
    );
    const notes: string[] = [];
    if (out.some((l) => l.mode === "transit" && l.steps?.some((s) => s.kind === "ride"))) notes.push(TRANSIT_NOTE);
    if (out.some((l) => l.mode === "transit" && !l.steps)) notes.push(TRANSIT_ROUGH_NOTE);
    return { legs: out, notes };
  } catch (e) {
    console.error(e);
    throw new ApiError("UPSTREAM_ERROR", "移動時間を取得できませんでした。少し待ってから試してください");
  }
}
