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

export type PlanInput = {
  spots: PlanSpot[];
  hasDestination: boolean;
  startMin: number;
  endMin: number;
  lunchBreak: boolean;
  mode: TravelMode;
  priority: Priority;
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
