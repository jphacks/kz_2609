// 経路案の計算（要件定義書 11章、ADR-0017）。外部APIは使わない純粋な計算なので、画面でも再計算に使う
import {
  CATEGORY_DEFAULT_STAY_MIN,
  PACE_MULTIPLIER,
  PRIORITY_WEIGHTS,
  type Category,
  type Pace,
  type Priority,
} from "@/lib/constants";
import type {
  CandidateKind,
  Leg,
  LegOverride,
  OrderHint,
  PlanCandidate,
  PlanInput,
  PlanItem,
  PlanSpot,
  PlanStats,
  TravelMatrix,
} from "@/lib/planner/types";

const LUNCH_FROM = 11 * 60 + 30;
const LUNCH_UNTIL = 13 * 60 + 30;
const LUNCH_MIN = 60;

// 経路がない区間（離島など）の移動時間。JSON で送れるよう Infinity の代わりに大きな値を使う
export const UNREACHABLE_MIN = 1e7;

// 11.2-1：滞在時間
export function computeStayMin(
  spot: { category: Category; stayMinutesMedian: number | null },
  pace: Pace,
  interests: Category[],
): number {
  let min = spot.stayMinutesMedian ?? CATEGORY_DEFAULT_STAY_MIN[spot.category];
  if (interests.includes(spot.category)) min *= 1.2;
  min *= PACE_MULTIPLIER[pace];
  return Math.max(10, Math.round(min / 5) * 5);
}

// 11.2-2：おすすめ時間帯（投稿5件以上のスポットのみ）
export function bestHoursFromHistogram(hist: number[]): number[] {
  const total = hist.reduce((a, b) => a + b, 0);
  if (total < 5) return [];
  const max = Math.max(...hist);
  return hist.flatMap((n, h) => (n > 0 && n >= max * 0.6 ? [h] : []));
}

// おすすめ時間帯からどれだけずれているか（分）。重なっていれば 0
function timeGap(arrive: number, stay: number, bestHours: number[]): number {
  if (bestHours.length === 0) return 0;
  let best = Number.POSITIVE_INFINITY;
  for (const h of bestHours) {
    const from = h * 60;
    const to = from + 60;
    if (arrive < to && arrive + stay > from) return 0;
    best = Math.min(best, Math.abs(arrive - to), Math.abs(arrive + stay - from));
  }
  return best;
}

type Simulation = {
  items: PlanItem[];
  stats: PlanStats;
  timeGapTotal: number;
  feasible: boolean;
};

// 区間ごとの上書き（F-5-10）。キーは「出発の添字:到着の添字」（行列の添字）
export type LegOverrides = Map<string, LegOverride>;
export const legKey = (from: number, to: number) => `${from}:${to}`;

// 決まった順番で時刻を計算する（11.2-5）。順番の入れ替え・滞在時間・移動手段の変更後の再計算にも使う
export function simulate(
  input: PlanInput,
  matrix: TravelMatrix,
  order: number[],
  stayOverride?: Map<string, number>,
  legOverride?: LegOverrides,
): Simulation {
  const items: PlanItem[] = [];
  const destIdx = input.spots.length + 1;
  let t = input.startMin;
  let travel = 0;
  let walkM = 0;
  let gap = 0;
  let hits = 0;
  let lunchTaken = !input.lunchBreak;
  const lunch = input.lunch ?? { from: LUNCH_FROM, until: LUNCH_UNTIL, min: LUNCH_MIN };
  let prev = 0;

  // 区間の移動手段・所要時間。上書きがあればそちらを使う
  const leg = (from: number, to: number): LegOverride =>
    legOverride?.get(legKey(from, to)) ?? {
      mode: input.mode,
      travelMin: matrix.minutes[from][to],
      distM: Math.round(matrix.distances[from][to]),
      walkM: matrix.walk[from][to],
      estimated: matrix.estimated[from][to],
    };
  const shown = (l: LegOverride): Leg => ({
    mode: l.mode,
    travelMin: Math.round(l.travelMin),
    distM: l.distM,
    estimated: l.estimated,
    ...(l.steps ? { steps: l.steps } : {}),
  });

  const windows = new Map((input.timeWindows ?? []).map((w) => [w.spotId, w]));
  let windowMissed = false;

  const origin: PlanItem = { type: "origin", depart: t, next: null };
  items.push(origin);
  let lastWithNext: { next: Leg | null } = origin;

  for (let k = 0; k < order.length; k++) {
    const idx = order[k];
    const spot = input.spots[idx - 1];
    const l = leg(prev, idx);
    lastWithNext.next = shown(l);
    t += l.travelMin;
    travel += l.travelMin;
    walkM += l.walkM;
    // 時刻の指定（AIと相談）：早く着いたら指定の時刻まで待つ。遅れたらこの順番は使えない
    const w = windows.get(spot.id);
    if (w && t < w.from) t = w.from;
    if (w && t > w.to) windowMissed = true;
    const arrive = Math.round(t);
    const stay = stayOverride?.get(spot.id) ?? spot.stayMin;
    const g = timeGap(arrive, stay, spot.bestHours);
    const inBestTime = spot.bestHours.length > 0 && g === 0;
    gap += g;
    if (inBestTime) hits++;
    t += stay;
    const item: PlanItem = { type: "spot", spotId: spot.id, arrive, stayMin: stay, depart: Math.round(t), inBestTime, next: null };
    items.push(item);
    lastWithNext = item;
    prev = idx;

    // 昼食休憩：選んだ時間帯（初期値 11:30〜13:30）の開始以降の最初の空き時間に、選んだ長さ（初期値60分）（11.2-6）
    const hasNext = k < order.length - 1;
    if (!lunchTaken && t >= lunch.from && (hasNext || t <= lunch.until)) {
      items.push({ type: "lunch", arrive: Math.round(t), stayMin: lunch.min, depart: Math.round(t + lunch.min) });
      t += lunch.min;
      lunchTaken = true;
    }
  }

  if (input.hasDestination && order.length > 0) {
    const l = leg(prev, destIdx);
    lastWithNext.next = shown(l);
    t += l.travelMin;
    travel += l.travelMin;
    walkM += l.walkM;
    items.push({ type: "destination", arrive: Math.round(t) });
  }

  const endAt = Math.round(t);
  return {
    items,
    stats: { spotCount: order.length, totalTravelMin: Math.round(travel), walkM: Math.round(walkM), endAt, bestTimeHits: hits },
    timeGapTotal: gap,
    feasible: Number.isFinite(t) && t <= input.endMin && !windowMissed,
  };
}

// 行く順番の希望（AIと相談）を満たすか。順番に入っていないスポットの希望は問わない
export function satisfiesOrderHints(orderIds: string[], hints: OrderHint[] | undefined): boolean {
  if (!hints || hints.length === 0) return true;
  const pos = new Map(orderIds.map((id, i) => [id, i]));
  for (const h of hints) {
    const i = pos.get(h.spotId);
    if (i === undefined) continue;
    if (h.position === "first" && i !== 0) return false;
    if (h.position === "last" && i !== orderIds.length - 1) return false;
    if ((h.position === "before" || h.position === "after") && h.relativeTo) {
      const j = pos.get(h.relativeTo);
      if (j === undefined) continue;
      if (h.position === "before" && i > j) return false;
      if (h.position === "after" && i < j) return false;
    }
  }
  return true;
}

// 11.3：点数（小さいほどよい）
function score(sim: Simulation, priority: Priority): number {
  const w = PRIORITY_WEIGHTS[priority];
  return (
    sim.stats.totalTravelMin * w.travel +
    sim.timeGapTotal * w.timeGap +
    (sim.stats.walkM / 1000) * w.walkKm -
    sim.stats.spotCount * w.spots
  );
}

const KIND_LABELS: Record<CandidateKind, string> = {
  fewer_moves: "移動が最も少ない案",
  more_spots: "回れる場所が最も多い案",
  best_time: "おすすめの時間帯に最も合う案",
  less_walking: "歩く距離が最も少ない案",
};

function reasonFor(kind: CandidateKind, sim: Simulation, skippedCount: number): string {
  const s = sim.stats;
  switch (kind) {
    case "fewer_moves":
      return `近い場所どうしをまとめ、移動を合計${s.totalTravelMin}分に抑えました`;
    case "more_spots":
      return skippedCount > 0
        ? `${s.spotCount}か所を回れる順番です（${skippedCount}か所は時間が足りず入りませんでした）`
        : `選んだ${s.spotCount}か所をすべて回れる順番です`;
    case "best_time":
      return s.bestTimeHits > 0
        ? `${s.bestTimeHits}か所で、投稿が多い時間帯に着くようにしました`
        : "おすすめの時間帯がわかるスポットが少ないため、移動の少なさを優先しました";
    case "less_walking":
      return `歩く距離を合計${(s.walkM / 1000).toFixed(1)}kmに抑えました`;
  }
}

export type ComputeResult =
  | { ok: true; candidates: PlanCandidate[] }
  | { ok: false; reason: "must_visit_overflow" | "no_spots" };

// 11.2-4〜8：訪問順を全通り（スポットの選び方も含めて）調べ、特徴の違う最大3案を選ぶ
export function computeCandidates(input: PlanInput, matrix: TravelMatrix): ComputeResult {
  const n = input.spots.length;
  if (n === 0) return { ok: false, reason: "no_spots" };

  const mustIdx = input.spots.flatMap((s, i) => (s.mustVisit ? [i + 1] : []));
  const kinds: CandidateKind[] = [
    input.priority === "less_walking" ? "less_walking" : "fewer_moves",
    "more_spots",
    "best_time",
  ];
  // スポットを外すのは時間内に回りきれないときだけ（11.2-7）。
  // そのため「回れる数が最も多い順番」だけを候補にし、その中で点数を比べる
  let maxCount = 0;
  let best = new Map<CandidateKind, { order: number[]; sim: Simulation; score: number; key: string }>();

  const order: number[] = [];
  const used = new Array<boolean>(n + 1).fill(false);

  const consider = () => {
    if (order.length === 0) return;
    for (const m of mustIdx) if (!used[m]) return;
    if (!satisfiesOrderHints(order.map((i) => input.spots[i - 1].id), input.orderHints)) return;
    const sim = simulate(input, matrix, order);
    if (!sim.feasible || order.length < maxCount) return;
    if (order.length > maxCount) {
      maxCount = order.length;
      best = new Map();
    }
    const key = order.join(",");
    for (const kind of kinds) {
      const sc = score(sim, kind);
      const cur = best.get(kind);
      // 同点なら順番の文字列で決め、毎回同じ結果になるようにする
      if (!cur || sc < cur.score - 1e-9 || (Math.abs(sc - cur.score) <= 1e-9 && key < cur.key)) {
        best.set(kind, { order: [...order], sim, score: sc, key });
      }
    }
  };

  // 途中で終了時刻を超えたら、それ以上スポットを足しても間に合わないので打ち切る
  const partialOk = () => {
    const sim = simulate({ ...input, hasDestination: false }, matrix, order);
    return sim.feasible;
  };

  const dfs = () => {
    consider();
    if (order.length === n) return;
    for (let i = 1; i <= n; i++) {
      if (used[i]) continue;
      used[i] = true;
      order.push(i);
      if (partialOk()) dfs();
      order.pop();
      used[i] = false;
    }
  };
  dfs();

  if (best.size === 0) return { ok: false, reason: "must_visit_overflow" };

  // 11.4：ユーザーが選んだ「優先すること」に合う案を先頭にする
  const ordered = [...kinds].sort((a, b) => Number(b === input.priority) - Number(a === input.priority));

  const seen = new Set<string>();
  const candidates: PlanCandidate[] = [];
  for (const kind of ordered) {
    const b = best.get(kind);
    if (!b || seen.has(b.key)) continue;
    seen.add(b.key);
    const inOrder = new Set(b.order);
    const skipped = input.spots.flatMap((s, i) => {
      if (inOrder.has(i + 1)) return [];
      const reachable = matrix.minutes[0][i + 1] < UNREACHABLE_MIN;
      return [{ spotId: s.id, reason: reachable ? ("time_limit" as const) : ("unreachable" as const) }];
    });
    candidates.push({
      id: `c${candidates.length + 1}`,
      kind,
      label: KIND_LABELS[kind],
      reason: reasonFor(kind, b.sim, skipped.length),
      order: b.order.map((i) => input.spots[i - 1].id),
      items: b.sim.items,
      skipped,
      stats: b.sim.stats,
      overTime: false,
    });
  }
  return { ok: true, candidates };
}

// 手動で順番・滞在時間・移動手段を変えたときの再計算（F-5-10）。外部APIは呼ばない
export function recomputeCandidate(
  input: PlanInput,
  matrix: TravelMatrix,
  base: PlanCandidate,
  orderIds: string[],
  stays: Map<string, number>,
  legOverride?: LegOverrides,
): PlanCandidate {
  const indexOf = new Map(input.spots.map((s, i) => [s.id, i + 1]));
  const order = orderIds.map((id) => indexOf.get(id)).filter((i): i is number => i !== undefined);
  const sim = simulate(input, matrix, order, stays, legOverride);
  return { ...base, order: orderIds, items: sim.items, stats: sim.stats, overTime: !sim.feasible };
}

export function formatClock(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function parseClock(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + (m || 0);
}

export type { PlanSpot };
