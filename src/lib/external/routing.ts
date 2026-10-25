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
  routeBusRideFromDrive,
  type RideTimes,
} from "@/lib/transit/network";
import { decideTransit, findTransitRoute, type TransitRoute, type TransitStep } from "@/lib/transit/route";

// 移動時間は Google Routes API（Essentials）で取得する（ADR-0019）。
// - 計画（順番と時刻）にだけ使い、経路の形は取得しない。地図には訪問順を結んだ線を描く
// - Essentials に収めるため、車は渋滞を考えない計算（TRAFFIC_UNAWARE）にし、返してもらう項目は所要時間・距離・状態だけにする
// - Google の利用規約に合わせ、取得した結果はその計画の間だけ使い、DB に保存しない
// 公共交通（ADR-0026・ADR-0027）：Routes API は日本の電車・バスを返さないため、国土数値情報の停留所・駅と路線から
// 「徒歩 → 乗り場 → 乗車 → 降り場 → 徒歩」を自分で探す（src/lib/transit）。徒歩は Google、バスの乗車時間は
// Google の車の所要時間から、鉄道は線路の道のりと平均の速さから計算し、待ち時間は目安を使う。
// 歩く時間が1時間以上になる区間は、公共交通では難しいとして車（タクシーなど）の時間にする

export type MatrixPoint = { key: string; lat: number; lng: number };
type Pt = { lat: number; lng: number };

const DETOUR = 1.3; // 直線距離から道のりへの換算
const WALK_KMH = 4.8;
const DRIVE_KMH = 30;

const MODE: Record<TravelMode, "WALK" | "DRIVE" | "TRANSIT"> = {
  walking: "WALK",
  driving: "DRIVE",
  transit: "TRANSIT",
};

const walkEstimate = (a: Pt, b: Pt) => {
  const road = distanceM(a, b) * DETOUR;
  return { min: (road / 1000 / WALK_KMH) * 60, distM: road };
};

const driveEstimate = (a: Pt, b: Pt) => {
  const road = distanceM(a, b) * DETOUR;
  return { min: (road / 1000 / DRIVE_KMH) * 60 + 5, distM: road };
};

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

type Minutes = { min: number; distM: number };

function transitLegOf(
  decision: "transit" | "walk" | "car",
  route: TransitRoute | null,
  walk: Minutes,
  car: Minutes,
  estimated: boolean,
): LegOverride {
  if (decision === "transit" && route) {
    const { steps, total } = roundSteps(route.steps);
    return { mode: "transit", travelMin: total, distM: route.distM, walkM: route.walkM, estimated: true, steps };
  }
  // 乗り物より歩いた方が早いので、区間の移動手段を徒歩にする（タイムラインでも徒歩が選ばれた状態になる）
  if (decision === "walk") {
    return { mode: "walking", travelMin: walk.min, distM: Math.round(walk.distM), walkM: walk.distM, estimated, walkSuggested: true };
  }
  // 公共交通では歩く時間が1時間以上になるため、車（タクシーなど）の時間にする
  return { mode: "driving", travelMin: car.min, distM: Math.round(car.distM), walkM: 0, estimated, carSuggested: true };
}

// 直線距離からの概算（開発用のモックと、Google を使えないときの代わり）
export function estimateLeg(a: Pt, b: Pt, mode: TravelMode, rides: RideTimes = estimateRideTimes()): LegOverride {
  const walk = walkEstimate(a, b);
  if (mode === "walking") return { mode, travelMin: walk.min, distM: Math.round(walk.distM), walkM: walk.distM, estimated: true };
  const car = driveEstimate(a, b);
  if (mode === "driving") return { mode, travelMin: car.min, distM: Math.round(car.distM), walkM: 0, estimated: true };
  const route = findTransitRoute(a, b, rides);
  return transitLegOf(decideTransit(route, walk), route, walk, car, true);
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
  "公共交通は、石川県のバス（周遊バス・路線バス）と鉄道で計算しています。乗り場までの徒歩は Google マップの時間、待ち時間と乗車時間は時刻表を使わない目安です";
const CAR_NOTE = "公共交通では歩く時間が1時間以上になる区間は、車（タクシーなど）の時間で計算しています";

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

  let car = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const hit = fetched?.get(`${i}:${j}`);
      let leg: LegOverride;
      if (mode === "transit") {
        const w = hit ? { min: hit.sec / 60, distM: hit.distM } : walkEstimate(points[i], points[j]);
        const route = findTransitRoute(points[i], points[j], rides!);
        leg = transitLegOf(decideTransit(route, w), route, w, driveEstimate(points[i], points[j]), !hit);
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
      if (leg.carSuggested) car++;
    }
  }
  if (mode === "transit" && !isMockMode()) notes.push(TRANSIT_NOTE);
  if (car > 0) notes.push(CAR_NOTE);
  return { minutes, distances, walk, estimated, notes };
}

export type LegRequest = { from: Pt; to: Pt; mode: TravelMode; departAt: string };

// 公共交通の区間を、Google の徒歩（全部歩く・乗り場まで・降り場から）と、路線バスの車の所要時間で直して決める。
// 呼ぶ回数は、徒歩の3回＋路線バスの乗車ごとに1回＋車をすすめる場合に1回
async function transitLeg(l: LegRequest, rides: RideTimes, apiKey: string): Promise<LegOverride> {
  const route = findTransitRoute(l.from, l.to, rides);
  // Google で取れなかったときは直線距離からの目安で続ける
  const routeOf = async (a: Pt, b: Pt, mode: "walking" | "driving"): Promise<Minutes | null> => {
    try {
      const r = await googleRoute([a, b], mode, apiKey);
      if (r) return { min: r.sec / 60, distM: r.distM };
    } catch (e) {
      console.error(e);
    }
    return null;
  };
  const busRideCount = route?.routeBusRides.length ?? 0;
  const canFixBus = busRideCount > 0 && (await consumeQuota(quotas().googleRoutes, busRideCount));
  const [direct, access, egress, ...busDrives] = await Promise.all([
    routeOf(l.from, l.to, "walking"),
    route ? routeOf(l.from, route.firstStop, "walking") : null,
    route ? routeOf(route.lastStop, l.to, "walking") : null,
    ...(route && canFixBus ? route.routeBusRides.map((r) => routeOf(r.from, r.to, "driving")) : []),
  ]);
  const walk = direct ?? walkEstimate(l.from, l.to);

  let fixed: TransitRoute | null = null;
  if (route) {
    const steps = route.steps.map((s) => ({ ...s }));
    const first = steps[0];
    const last = steps[steps.length - 1];
    if (first.kind === "walk" && access) Object.assign(first, access);
    if (last.kind === "walk" && egress) Object.assign(last, egress);
    route.routeBusRides.forEach((r, i) => {
      const step = steps[r.stepIndex];
      const drive = busDrives[i];
      if (step.kind === "ride" && drive) step.rideMin = routeBusRideFromDrive(drive.min * 60, drive.distM);
    });
    const sum = (f: (s: TransitStep) => number) => steps.reduce((t, s) => t + f(s), 0);
    fixed = {
      ...route,
      steps,
      totalMin: sum((s) => (s.kind === "walk" ? s.min : s.waitMin + s.rideMin)),
      walkM: sum((s) => (s.kind === "walk" ? s.distM : 0)),
      walkMin: sum((s) => (s.kind === "walk" ? s.min : 0)),
    };
  }
  const decision = decideTransit(fixed, walk);
  let car = driveEstimate(l.from, l.to);
  if (decision === "car" && (await consumeQuota(quotas().googleRoutes, 1))) car = (await routeOf(l.from, l.to, "driving")) ?? car;
  return transitLegOf(decision, fixed, walk, car, false);
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
    if (out.some((l) => l.carSuggested)) notes.push(CAR_NOTE);
    return { legs: out, notes };
  } catch (e) {
    console.error(e);
    throw new ApiError("UPSTREAM_ERROR", "移動時間を取得できませんでした。少し待ってから試してください");
  }
}
