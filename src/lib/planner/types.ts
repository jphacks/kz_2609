import type { Category, Pace, Priority, TravelMode } from "@/lib/constants";

// 行列の添字：0 = 出発地、1..n = スポット、n+1 = 到着地（ある場合）
export type TravelMatrix = {
  minutes: number[][];
  distances: number[][];
  walk: number[][];
  estimated: boolean[][];
};

export type PlanSpot = {
  id: string;
  name: string;
  category: Category;
  stayMin: number;
  bestHours: number[];
  mustVisit: boolean;
};

// 「AIと相談」で読み取った細かい希望（F-5-5）。時刻は分（0:00 からの経過分）
export type TimeWindow = { spotId: string; from: number; to: number };
export type OrderHint = { spotId: string; position: "first" | "last" | "before" | "after"; relativeTo?: string };

export type PlanInput = {
  spots: PlanSpot[];
  hasDestination: boolean;
  startMin: number;
  endMin: number;
  lunchBreak: boolean;
  mode: TravelMode;
  priority: Priority;
  // スポットごとの到着時刻の範囲。早く着いたら開始まで待ち、遅れる順番は使わない
  timeWindows?: TimeWindow[];
  // 行く順番の希望。満たさない順番は使わない
  orderHints?: OrderHint[];
};

export type Leg = { mode: TravelMode; travelMin: number; distM: number; estimated: boolean };

// 区間ごとに取り直した所要時間（F-5-10）。歩く距離も持つ
export type LegOverride = Leg & { walkM: number };

export type PlanItem =
  | { type: "origin"; depart: number; next: Leg | null }
  | { type: "spot"; spotId: string; arrive: number; stayMin: number; depart: number; inBestTime: boolean; next: Leg | null }
  | { type: "lunch"; arrive: number; stayMin: number; depart: number }
  | { type: "destination"; arrive: number };

export type CandidateKind = "fewer_moves" | "more_spots" | "best_time" | "less_walking";

export type PlanStats = {
  spotCount: number;
  totalTravelMin: number;
  walkM: number;
  endAt: number;
  bestTimeHits: number;
};

export type PlanCandidate = {
  id: string;
  kind: CandidateKind;
  label: string;
  reason: string;
  order: string[];
  items: PlanItem[];
  skipped: { spotId: string; reason: "time_limit" | "unreachable" }[];
  stats: PlanStats;
  overTime: boolean;
};

export type PlanPreferences = {
  pace: Pace;
  interests: Category[];
  priority: Priority;
};

// AIが会話から読み取る条件（POST /plans/chat の conditions。時刻は "HH:MM"）
export type ChatConditions = PlanPreferences & {
  timeWindows: { spotId: string; from: string; to: string }[];
  orderHints: OrderHint[];
  exclude: string[];
};
