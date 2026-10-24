// 公共交通の区間の経路探索（ADR-0026）。
// スポット → 徒歩 → 乗り場 → 乗車（乗り換えあり）→ 降り場 → 徒歩 → スポット のうち、合計時間が最も短い行き方を探す。
// 外部APIを呼ばない純粋な計算なので、経路案の比較（全スポットの組み合わせ）にも使える
import { distanceM, type LatLng } from "@/lib/geo";
import {
  ACCESS_MAX_M,
  DETOUR,
  NETWORK,
  TRANSFER_MAX_M,
  TRANSFER_PENALTY_MIN,
  WALK_KMH,
  getStop,
  waitMinutes,
  walkMinutes,
  type RideTimes,
  type TransitLine,
  type TransitNetwork,
} from "./network";

// 区間の中の手順。徒歩の to が null なら行き先のスポット
export type TransitStep =
  | { kind: "walk"; min: number; distM: number; to: string | null }
  | {
      kind: "ride";
      vehicle: "bus" | "rail";
      line: string;
      // 行き先（鉄道は終点の駅名、周遊バスは路線名に方向が入っているので null）
      toward: string | null;
      from: string;
      to: string;
      waitMin: number;
      rideMin: number;
      stops: number;
    };

export type TransitRoute = {
  totalMin: number;
  walkM: number;
  distM: number;
  steps: TransitStep[];
  // 最初に乗る乗り場と最後に降りる乗り場（徒歩を Google で直すときに使う）
  firstStop: LatLng;
  lastStop: LatLng;
};

type Board = { line: TransitLine; dir: 1 | -1; idx: number };

// 状態：乗り場にいる（スポットから歩いて来た／降りた直後／乗り換えで歩いて来た）／路線に乗っている
type Via = "spot" | "ride" | "walk";
type State =
  | { t: "at"; stop: string; via: Via }
  // moved：乗った乗り場から1つ以上進んだか（乗ってすぐ同じ乗り場で降りる経路を作らないため）
  | { t: "on"; line: string; dir: 1 | -1; idx: number; moved: boolean }
  | { t: "end" };

const keyOf = (s: State) => (s.t === "at" ? `a:${s.stop}:${s.via}` : s.t === "on" ? `o:${s.line}:${s.dir}:${s.idx}:${s.moved ? 1 : 0}` : "end");

type Edge =
  | { kind: "access"; stop: string; min: number; distM: number }
  | { kind: "board"; line: string; dir: 1 | -1; idx: number; waitMin: number }
  | { kind: "ride"; min: number }
  | { kind: "alight" }
  | { kind: "transfer"; to: string; min: number; distM: number }
  | { kind: "egress"; min: number; distM: number };

function buildIndex(net: TransitNetwork) {
  const boards = new Map<string, Board[]>();
  for (const line of net.lines) {
    const n = line.stopIds.length;
    line.stopIds.forEach((id, idx) => {
      const list = boards.get(id) ?? [];
      // 終点からは乗らない
      if (idx < n - 1) list.push({ line, dir: 1, idx });
      if (line.bidirectional && idx > 0) list.push({ line, dir: -1, idx });
      boards.set(id, list);
    });
  }
  // 乗り換えで歩ける乗り場どうし
  const near = new Map<string, { id: string; m: number }[]>();
  for (const a of net.stops) {
    near.set(
      a.id,
      net.stops.flatMap((b) => {
        const m = distanceM(a, b);
        return b.id !== a.id && m <= TRANSFER_MAX_M ? [{ id: b.id, m }] : [];
      }),
    );
  }
  return { boards, near, lineById: new Map(net.lines.map((l) => [l.id, l])) };
}

const INDEX = buildIndex(NETWORK);

// 区間 idx → idx+dir の乗車時間
function segMin(rides: RideTimes, line: TransitLine, dir: 1 | -1, idx: number) {
  const segs = rides.get(line.id)!;
  return dir === 1 ? segs[idx] : segs[idx - 1];
}

export function findTransitRoute(from: LatLng, to: LatLng, rides: RideTimes, net: TransitNetwork = NETWORK): TransitRoute | null {
  const index = net === NETWORK ? INDEX : buildIndex(net);
  const access = net.stops.filter((s) => distanceM(from, s) <= ACCESS_MAX_M);
  const egress = new Map(net.stops.filter((s) => distanceM(to, s) <= ACCESS_MAX_M).map((s) => [s.id, s]));
  if (access.length === 0 || egress.size === 0) return null;

  // ダイクストラ法（状態は数百なので単純な配列で十分）
  const dist = new Map<string, number>();
  const prev = new Map<string, { from: string; edge: Edge }>();
  const states = new Map<string, State>();
  const open = new Set<string>();
  const relax = (fromKey: string, s: State, cost: number, edge: Edge) => {
    const k = keyOf(s);
    if (cost < (dist.get(k) ?? Infinity)) {
      dist.set(k, cost);
      prev.set(k, { from: fromKey, edge });
      states.set(k, s);
      open.add(k);
    }
  };
  for (const s of access) {
    const min = walkMinutes(from, s);
    relax("start", { t: "at", stop: s.id, via: "spot" }, min, { kind: "access", stop: s.id, min, distM: distanceM(from, s) * DETOUR });
  }

  while (open.size > 0) {
    let k = "";
    let best = Infinity;
    for (const o of open) {
      const d = dist.get(o)!;
      if (d < best) {
        best = d;
        k = o;
      }
    }
    open.delete(k);
    if (k === "end") break;
    const s = states.get(k)!;
    if (s.t === "at") {
      for (const b of index.boards.get(s.stop) ?? []) {
        // 2本目からは乗り換えの時間を足す
        const waitMin = waitMinutes(b.line) + (s.via === "spot" ? 0 : TRANSFER_PENALTY_MIN);
        relax(k, { t: "on", line: b.line.id, dir: b.dir, idx: b.idx, moved: false }, best + waitMin, {
          kind: "board",
          line: b.line.id,
          dir: b.dir,
          idx: b.idx,
          waitMin,
        });
      }
      if (s.via === "ride") {
        // 降りたあとに歩いて別の乗り場へ（乗り換え）
        for (const n of index.near.get(s.stop) ?? []) {
          const min = (n.m * DETOUR) / 1000 / (WALK_KMH / 60);
          relax(k, { t: "at", stop: n.id, via: "walk" }, best + min, { kind: "transfer", to: n.id, min, distM: n.m * DETOUR });
        }
        const e = egress.get(s.stop);
        if (e) {
          const min = walkMinutes(e, to);
          relax(k, { t: "end" }, best + min, { kind: "egress", min, distM: distanceM(e, to) * DETOUR });
        }
      }
    } else if (s.t === "on") {
      const line = index.lineById.get(s.line)!;
      const next = s.idx + s.dir;
      if (next >= 0 && next < line.stopIds.length) {
        relax(k, { t: "on", line: s.line, dir: s.dir, idx: next, moved: true }, best + segMin(rides, line, s.dir, s.idx), {
          kind: "ride",
          min: segMin(rides, line, s.dir, s.idx),
        });
      }
      if (s.moved) relax(k, { t: "at", stop: line.stopIds[s.idx], via: "ride" }, best, { kind: "alight" });
    }
  }

  const total = dist.get("end");
  if (total === undefined) return null;

  // たどった辺を出発から順に並べる
  const path: { edge: Edge; state: State }[] = [];
  for (let k = "end"; k !== "start"; ) {
    const p = prev.get(k)!;
    path.unshift({ edge: p.edge, state: states.get(k)! });
    k = p.from;
  }
  return toRoute(path, total, index.lineById);
}

function toRoute(path: { edge: Edge; state: State }[], total: number, lineById: Map<string, TransitLine>): TransitRoute {
  const steps: TransitStep[] = [];
  let walkM = 0;
  let distM = 0;
  let firstStop: LatLng | null = null;
  let lastStop: LatLng | null = null;
  let ride: Extract<TransitStep, { kind: "ride" }> | null = null;
  let rideLine: TransitLine | null = null;
  let rideDir: 1 | -1 = 1;
  let rideIdx = 0;

  for (const { edge } of path) {
    if (edge.kind === "access") {
      const stop = getStop(edge.stop);
      firstStop = stop;
      walkM += edge.distM;
      distM += edge.distM;
      steps.push({ kind: "walk", min: edge.min, distM: edge.distM, to: stop.name });
    } else if (edge.kind === "board") {
      rideLine = lineById.get(edge.line)!;
      rideDir = edge.dir;
      rideIdx = edge.idx;
      const ids = rideLine.stopIds;
      ride = {
        kind: "ride",
        vehicle: rideLine.kind,
        line: rideLine.name,
        toward: rideLine.bidirectional ? getStop(ids[edge.dir === 1 ? ids.length - 1 : 0]).name : null,
        from: getStop(ids[edge.idx]).name,
        to: getStop(ids[edge.idx]).name,
        waitMin: edge.waitMin,
        rideMin: 0,
        stops: 0,
      };
    } else if (edge.kind === "ride" && ride && rideLine) {
      const a = getStop(rideLine.stopIds[rideIdx]);
      rideIdx += rideDir;
      const b = getStop(rideLine.stopIds[rideIdx]);
      ride.rideMin += edge.min;
      ride.stops += 1;
      ride.to = b.name;
      distM += distanceM(a, b);
      lastStop = b;
    } else if (edge.kind === "alight" && ride) {
      steps.push(ride);
      ride = null;
    } else if (edge.kind === "transfer") {
      walkM += edge.distM;
      distM += edge.distM;
      steps.push({ kind: "walk", min: edge.min, distM: edge.distM, to: getStop(edge.to).name });
    } else if (edge.kind === "egress") {
      walkM += edge.distM;
      distM += edge.distM;
      steps.push({ kind: "walk", min: edge.min, distM: edge.distM, to: null });
    }
  }
  return { totalMin: total, walkM, distM: Math.round(distM), steps, firstStop: firstStop!, lastStop: lastStop! };
}
