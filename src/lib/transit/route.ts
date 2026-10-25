// 公共交通の区間の経路探索（ADR-0026・ADR-0027）。
// スポット → 徒歩 → 乗り場 → 乗車（乗り換えは1回まで）→ 降り場 → 徒歩 → スポット のうち、合計時間が最も短い行き方を探す。
// 乗り物は、停まる順番がわかる路線（周遊バス・鉄道）と、石川県の路線バスの系統（同じ系統の停留所どうしは直接行けるとみなす）。
// 外部APIを呼ばない純粋な計算なので、経路案の比較（全スポットの組み合わせ）にも使える
import { distanceM, type LatLng } from "@/lib/geo";
import {
  ACCESS_CANDIDATES,
  ACCESS_MAX_M,
  DETOUR,
  MAX_BOARDINGS,
  MAX_WALK_MIN,
  NETWORK,
  ROUTE_BUS_WAIT_MIN,
  TRANSFER_MAX_M,
  TRANSFER_PENALTY_MIN,
  getStop,
  prefersTransit,
  routeBusRideEstimate,
  waitMinutes,
  walkMinutes,
  type BusRoute,
  type RideTimes,
  type TransitLine,
  type TransitNetwork,
  type TransitStop,
} from "./network";

// 区間の中の手順。徒歩の to が null なら行き先のスポット
export type TransitStep =
  | { kind: "walk"; min: number; distM: number; to: string | null }
  | {
      kind: "ride";
      vehicle: "bus" | "rail";
      line: string;
      // 行き先（鉄道は終点の駅名。周遊バスは路線名に方向が入っており、路線バスは向きのデータがないため null）
      toward: string | null;
      from: string;
      to: string;
      waitMin: number;
      rideMin: number;
      // いくつ先で降りるか（路線バスは停まる順番のデータがないため null）
      stops: number | null;
    };

// 路線バスの乗車（案を選んだあとに Google の車の所要時間で乗車時間を直すため、乗り降りの位置を持つ）
export type RouteBusRide = { stepIndex: number; from: LatLng; to: LatLng };

export type TransitRoute = {
  totalMin: number;
  walkM: number;
  walkMin: number;
  distM: number;
  steps: TransitStep[];
  // 最初に乗る乗り場と最後に降りる乗り場（徒歩を Google で直すときに使う）
  firstStop: LatLng;
  lastStop: LatLng;
  routeBusRides: RouteBusRide[];
};

// 状態：乗り場にいる（via：スポットから歩いて来た／降りた直後／乗り換えで歩いて来た。n：乗った回数）／順番のある路線に乗っている／終わり
type Via = "spot" | "ride" | "walk";
type State =
  | { t: "at"; stop: string; via: Via; n: number }
  // moved：乗った乗り場から1つ以上進んだか（乗ってすぐ同じ乗り場で降りる経路を作らないため）
  | { t: "on"; line: string; dir: 1 | -1; idx: number; moved: boolean; n: number }
  | { t: "end" };

const keyOf = (s: State) =>
  s.t === "at" ? `a:${s.stop}:${s.via}:${s.n}` : s.t === "on" ? `o:${s.line}:${s.dir}:${s.idx}:${s.moved ? 1 : 0}:${s.n}` : "end";

type Edge =
  | { kind: "access"; stop: string; min: number; distM: number }
  | { kind: "board"; line: string; dir: 1 | -1; idx: number; waitMin: number }
  | { kind: "ride"; min: number }
  | { kind: "alight" }
  | { kind: "routeBus"; route: string; from: string; to: string; waitMin: number; rideMin: number }
  | { kind: "transfer"; to: string; min: number; distM: number }
  | { kind: "egress"; min: number; distM: number };

type Board = { line: TransitLine; dir: 1 | -1; idx: number };

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
  const routesAt = new Map<string, BusRoute[]>();
  for (const r of net.routes) for (const id of r.stopIds) routesAt.set(id, [...(routesAt.get(id) ?? []), r]);

  // 乗り換えで歩ける乗り場どうし。路線バスどうしの乗り換えは扱わず、
  // 「順番のある路線（周遊バス・鉄道）の乗り場」と、その近くの乗り場の間だけを結ぶ（数千か所どうしの計算を避ける）
  const ordered = new Set(net.lines.flatMap((l) => l.stopIds));
  const near = new Map<string, { id: string; m: number }[]>();
  const link = (a: string, b: string, m: number) => near.set(a, [...(near.get(a) ?? []), { id: b, m }]);
  for (const id of ordered) {
    const a = net.stops.find((s) => s.id === id)!;
    for (const b of net.stops) {
      if (b.id === a.id) continue;
      const m = distanceM(a, b);
      if (m > TRANSFER_MAX_M) continue;
      link(a.id, b.id, m);
      if (!ordered.has(b.id)) link(b.id, a.id, m);
    }
  }
  // 路線バスを降りてよい乗り場：行き先の近くか、順番のある路線に乗り換えられる乗り場
  const hubs = new Set([...near.keys()].filter((id) => !ordered.has(id)));
  return {
    boards,
    routesAt,
    near,
    hubs,
    lineById: new Map(net.lines.map((l) => [l.id, l])),
    routeById: new Map(net.routes.map((r) => [r.id, r])),
  };
}

const INDEX = buildIndex(NETWORK);

// 区間 idx → idx+dir の乗車時間
function segMin(rides: RideTimes, line: TransitLine, dir: 1 | -1, idx: number) {
  const segs = rides.get(line.id)!;
  return dir === 1 ? segs[idx] : segs[idx - 1];
}

// 近い順に、上限の距離までの乗り場（鉄道の駅は数が少ないので、少し遠くても必ず候補に入れる）
function nearbyStops(net: TransitNetwork, p: LatLng) {
  const all = net.stops.map((s) => ({ s, m: distanceM(p, s) })).filter((x) => x.m <= ACCESS_MAX_M);
  all.sort((a, b) => a.m - b.m);
  const picked = all.slice(0, ACCESS_CANDIDATES);
  const rail = all.filter((x) => x.s.kind === "rail" && !picked.includes(x)).slice(0, 4);
  return [...picked, ...rail].map((x) => x.s);
}

// 公共交通の区間の決め方（ADR-0027）：乗り物を使う経路（歩く時間の合計が1時間未満）と、全部歩く場合を比べる。
// どちらも1時間以上歩くなら、公共交通では難しいとして車（タクシーなど）をすすめる
export function decideTransit(route: TransitRoute | null, walk: { min: number }): "transit" | "walk" | "car" {
  const usable = route && route.walkMin < MAX_WALK_MIN ? route : null;
  if (usable && (walk.min >= MAX_WALK_MIN || prefersTransit(usable.totalMin, walk.min))) return "transit";
  return walk.min < MAX_WALK_MIN ? "walk" : "car";
}

// 最小のものを取り出せる優先度つきキュー（二分ヒープ）
class Heap {
  private items: { key: string; d: number }[] = [];
  push(key: string, d: number) {
    const a = this.items;
    a.push({ key, d });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].d <= a[i].d) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].d < a[m].d) m = l;
        if (r < a.length && a[r].d < a[m].d) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
  get size() {
    return this.items.length;
  }
}

export function findTransitRoute(from: LatLng, to: LatLng, rides: RideTimes, net: TransitNetwork = NETWORK): TransitRoute | null {
  const index = net === NETWORK ? INDEX : buildIndex(net);
  const access = nearbyStops(net, from);
  const egress = new Map(nearbyStops(net, to).map((s) => [s.id, s]));
  if (access.length === 0 || egress.size === 0) return null;

  // ダイクストラ法
  const dist = new Map<string, number>();
  const prev = new Map<string, { from: string; edge: Edge }>();
  const states = new Map<string, State>();
  const heap = new Heap();
  const relax = (fromKey: string, s: State, cost: number, edge: Edge) => {
    const k = keyOf(s);
    if (cost < (dist.get(k) ?? Infinity)) {
      dist.set(k, cost);
      prev.set(k, { from: fromKey, edge });
      states.set(k, s);
      heap.push(k, cost);
    }
  };
  for (const s of access) {
    const min = walkMinutes(from, s);
    relax("start", { t: "at", stop: s.id, via: "spot", n: 0 }, min, { kind: "access", stop: s.id, min, distM: distanceM(from, s) * DETOUR });
  }

  while (heap.size > 0) {
    const { key: k, d: best } = heap.pop();
    if (best > (dist.get(k) ?? Infinity)) continue;
    if (k === "end") break;
    const s = states.get(k)!;
    if (s.t === "at") {
      if (s.n < MAX_BOARDINGS) {
        // 2本目からは乗り換えの時間を足す
        const penalty = s.via === "spot" ? 0 : TRANSFER_PENALTY_MIN;
        for (const b of index.boards.get(s.stop) ?? []) {
          const waitMin = waitMinutes(b.line) + penalty;
          relax(k, { t: "on", line: b.line.id, dir: b.dir, idx: b.idx, moved: false, n: s.n + 1 }, best + waitMin, {
            kind: "board",
            line: b.line.id,
            dir: b.dir,
            idx: b.idx,
            waitMin,
          });
        }
        // 路線バス：同じ系統の、行き先の近くか乗り換えできる停留所まで直接行く
        const here = getStop(s.stop);
        for (const r of index.routesAt.get(s.stop) ?? []) {
          const waitMin = ROUTE_BUS_WAIT_MIN + penalty;
          for (const id of r.stopIds) {
            if (id === s.stop || (!egress.has(id) && !index.hubs.has(id))) continue;
            const there = getStop(id);
            // 同じ場所（道の反対側など）の停留所には乗らない
            if (distanceM(here, there) < TRANSFER_MAX_M) continue;
            const rideMin = routeBusRideEstimate(here, there);
            relax(k, { t: "at", stop: id, via: "ride", n: s.n + 1 }, best + waitMin + rideMin, {
              kind: "routeBus",
              route: r.id,
              from: s.stop,
              to: id,
              waitMin,
              rideMin,
            });
          }
        }
      }
      if (s.via === "ride") {
        // 降りたあとに歩いて別の乗り場へ（乗り換え）
        if (s.n < MAX_BOARDINGS) {
          for (const nb of index.near.get(s.stop) ?? []) {
            const min = walkMinutes(getStop(s.stop), getStop(nb.id));
            relax(k, { t: "at", stop: nb.id, via: "walk", n: s.n }, best + min, { kind: "transfer", to: nb.id, min, distM: nb.m * DETOUR });
          }
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
        const min = segMin(rides, line, s.dir, s.idx);
        relax(k, { ...s, idx: next, moved: true }, best + min, { kind: "ride", min });
      }
      if (s.moved) relax(k, { t: "at", stop: line.stopIds[s.idx], via: "ride", n: s.n }, best, { kind: "alight" });
    }
  }

  const total = dist.get("end");
  if (total === undefined) return null;

  // たどった辺を出発から順に並べる
  const path: Edge[] = [];
  for (let k = "end"; k !== "start"; ) {
    const p = prev.get(k)!;
    path.unshift(p.edge);
    k = p.from;
  }
  return toRoute(path, total, index.lineById, index.routeById);
}

function toRoute(
  path: Edge[],
  total: number,
  lineById: Map<string, TransitLine>,
  routeById: Map<string, BusRoute>,
): TransitRoute {
  const steps: TransitStep[] = [];
  const routeBusRides: RouteBusRide[] = [];
  let walkM = 0;
  let walkMin = 0;
  let distM = 0;
  let firstStop: TransitStop | null = null;
  let lastStop: TransitStop | null = null;
  let ride: Extract<TransitStep, { kind: "ride" }> | null = null;
  let rideLine: TransitLine | null = null;
  let rideDir: 1 | -1 = 1;
  let rideIdx = 0;
  const walk = (min: number, m: number, to: string | null) => {
    walkM += m;
    walkMin += min;
    distM += m;
    steps.push({ kind: "walk", min, distM: m, to });
  };

  for (const edge of path) {
    if (edge.kind === "access") {
      firstStop = getStop(edge.stop);
      walk(edge.min, edge.distM, firstStop.name);
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
      ride.stops = (ride.stops ?? 0) + 1;
      ride.to = b.name;
      distM += distanceM(a, b);
      lastStop = b;
    } else if (edge.kind === "alight" && ride) {
      steps.push(ride);
      ride = null;
    } else if (edge.kind === "routeBus") {
      const r = routeById.get(edge.route)!;
      const a = getStop(edge.from);
      const b = getStop(edge.to);
      routeBusRides.push({ stepIndex: steps.length, from: a, to: b });
      steps.push({
        kind: "ride",
        vehicle: "bus",
        line: `${r.name}（${r.operator.replace(/（株）$/, "")}）`,
        toward: null,
        from: a.name,
        to: b.name,
        waitMin: edge.waitMin,
        rideMin: edge.rideMin,
        stops: null,
      });
      distM += distanceM(a, b);
      lastStop = b;
    } else if (edge.kind === "transfer") {
      walk(edge.min, edge.distM, getStop(edge.to).name);
    } else if (edge.kind === "egress") {
      walk(edge.min, edge.distM, null);
    }
  }
  return { totalMin: total, walkM, walkMin, distM: Math.round(distM), steps, firstStop: firstStop!, lastStop: lastStop!, routeBusRides };
}
