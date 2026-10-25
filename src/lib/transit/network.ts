// 公共交通の停留所・駅と路線（ADR-0026・ADR-0027）。データは scripts/build-transit-data.mjs で国土数値情報から作る。
// 時刻表は持たない。乗車時間はバスが Google の車の所要時間、鉄道が線路の道のりと路線ごとの平均の速さから計算し、待ち時間は目安を使う
import data from "./data.json";
import { distanceM, type LatLng } from "@/lib/geo";

export type TransitStop = { id: string; name: string; kind: "bus" | "rail"; lat: number; lng: number };
export type RailKind = "shinkansen" | "local" | "private";
// 停まる順番がわかる路線（周遊バス・鉄道）
export type TransitLine = {
  id: string;
  name: string;
  kind: "bus" | "rail";
  railKind?: RailKind;
  stopIds: string[];
  // 鉄道は上り・下りの両方向。周遊バスは一方向の環状
  bidirectional: boolean;
  // 鉄道の駅間の線路の道のり（m）
  trackM?: number[];
};
// 路線バスの系統（ADR-0027）。停まる順番はデータにないため、同じ系統の停留所どうしは乗り換えなしで行けるとみなす
export type BusRoute = { id: string; name: string; operator: string; stopIds: string[] };
export type TransitNetwork = { stops: TransitStop[]; lines: TransitLine[]; routes: BusRoute[] };

export const NETWORK = data as TransitNetwork;
export const TRANSIT_SOURCE = (data as { source: string }).source;

// 徒歩（直線距離からの目安。スポット⇔乗り場の徒歩は、案を選んだあとに Google の徒歩ルートで直す）
export const DETOUR = 1.3;
export const WALK_KMH = 4.8;
export const walkMinutes = (a: LatLng, b: LatLng) => (distanceM(a, b) * DETOUR) / 1000 / (WALK_KMH / 60);

// 歩く時間の合計がこの分数以上かかる区間は、公共交通では難しいとして車をすすめる（ADR-0027）
export const MAX_WALK_MIN = 60;
// 乗り場まで歩く距離の上限（直線）。歩いて約1時間
export const ACCESS_MAX_M = 3700;
// 出発・到着のスポットの近くで候補にする乗り場の数（近い順）
export const ACCESS_CANDIDATES = 25;
// 乗り換えで歩く距離の上限
export const TRANSFER_MAX_M = 350;
// 乗り換え1回ごとに足す時間（ホームの移動・案内を探す時間）
export const TRANSFER_PENALTY_MIN = 2;
// 乗る回数の上限（乗り換えは1回まで）
export const MAX_BOARDINGS = 2;
// 乗り物を使うかどうか：歩く時間がこの分数以下の区間は、乗り物が3分以上早いときだけ乗る。
// それより長く歩く区間は、乗り物が徒歩より遅くなければ乗る（公共交通を選んだ人は、歩く距離が短い方を好むため）
export const SHORT_WALK_MIN = 15;
export const PREFER_WALK_MARGIN_MIN = 3;
export const prefersTransit = (transitMin: number, walkMin: number) =>
  walkMin <= SHORT_WALK_MIN ? transitMin < walkMin - PREFER_WALK_MARGIN_MIN : transitMin <= walkMin;

// 待ち時間の目安（本数のデータがないため。分）
export const BUS_WAIT_MIN = 8;
export const ROUTE_BUS_WAIT_MIN = 10;
const RAIL: Record<RailKind, { kmh: number; dwellMin: number; waitMin: number }> = {
  // 停車時間を除いた走る速さ。駅に止まるたびに停車時間を足す
  shinkansen: { kmh: 150, dwellMin: 1, waitMin: 15 },
  local: { kmh: 60, dwellMin: 0.5, waitMin: 15 },
  private: { kmh: 40, dwellMin: 0.5, waitMin: 12 },
};

// バス：Google の車の所要時間（渋滞なし）に掛ける倍率と、停留所ごとの停車時間
export const BUS_DRIVE_FACTOR = 1.2;
export const BUS_DWELL_MIN = 0.5;
// 路線バスは停まる順番がわからないため、停車時間を道のり1kmあたりで足す（約400mごとに停留所がある想定）
export const ROUTE_BUS_DWELL_PER_KM = 1.25;
// Google を使えないときのバスの目安（直線距離から）
const BUS_FALLBACK_KMH = 18;
const BUS_FALLBACK_DETOUR = 1.4;

export const waitMinutes = (line: TransitLine) => (line.kind === "bus" ? BUS_WAIT_MIN : RAIL[line.railKind ?? "local"].waitMin);

const stopById = new Map(NETWORK.stops.map((s) => [s.id, s]));
export const getStop = (id: string) => stopById.get(id)!;

// 路線ごとの、順方向の各区間（i → i+1）の乗車時間（分）
export type RideTimes = Map<string, number[]>;

// 鉄道は線路の道のりと平均の速さから、周遊バスは直線距離から乗車時間を出す（周遊バスは Google の結果があれば置き換える）
export function estimateRideTimes(net: TransitNetwork = NETWORK): RideTimes {
  const out: RideTimes = new Map();
  for (const line of net.lines) {
    const pts = line.stopIds.map(getStop);
    out.set(
      line.id,
      pts.slice(1).map((b, i) => {
        if (line.kind === "bus") return busRideEstimate(pts[i], b) + BUS_DWELL_MIN;
        const r = RAIL[line.railKind ?? "local"];
        const m = line.trackM?.[i] ?? distanceM(pts[i], b) * 1.1;
        return (m / 1000 / r.kmh) * 60 + r.dwellMin;
      }),
    );
  }
  return out;
}

// バスの乗車時間の直線距離からの目安（停車時間を含まない）
export const busRideEstimate = (a: LatLng, b: LatLng) => ((distanceM(a, b) * BUS_FALLBACK_DETOUR) / 1000 / BUS_FALLBACK_KMH) * 60;

// 路線バスの乗車時間の目安（停車時間を含む）
export const routeBusRideEstimate = (a: LatLng, b: LatLng) =>
  busRideEstimate(a, b) + ((distanceM(a, b) * BUS_FALLBACK_DETOUR) / 1000) * ROUTE_BUS_DWELL_PER_KM;

// Google の車の所要時間（秒）から、周遊バスの停留所間の乗車時間（分）にする
export const busRideFromDriveSec = (sec: number) => (sec / 60) * BUS_DRIVE_FACTOR + BUS_DWELL_MIN;

// Google の車の所要時間（秒）と道のり（m）から、路線バスの乗車時間（分）にする
export const routeBusRideFromDrive = (sec: number, roadM: number) =>
  (sec / 60) * BUS_DRIVE_FACTOR + (roadM / 1000) * ROUTE_BUS_DWELL_PER_KM;
