import { describe, expect, it } from "vitest";
import { bestHoursFromHistogram, computeCandidates, computeStayMin, legKey, recomputeCandidate, simulate } from "@/lib/planner";
import type { PlanInput, PlanSpot, TravelMatrix } from "@/lib/planner/types";

// 一直線に並んだ地点（0 = 出発地、1..n = スポット）。隣どうしは step 分
function lineMatrix(n: number, step = 10): TravelMatrix {
  const size = n + 1;
  const m = <T,>(f: (i: number, j: number) => T) =>
    Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) => f(i, j)));
  return {
    minutes: m((i, j) => Math.abs(i - j) * step),
    distances: m((i, j) => Math.abs(i - j) * 800),
    walk: m((i, j) => Math.abs(i - j) * 800),
    estimated: m(() => false),
  };
}

function spot(id: string, stayMin: number, extra: Partial<PlanSpot> = {}): PlanSpot {
  return { id, name: id, category: "history", stayMin, bestHours: [], mustVisit: false, ...extra };
}

function input(spots: PlanSpot[], over: Partial<PlanInput> = {}): PlanInput {
  return {
    spots,
    hasDestination: false,
    startMin: 9 * 60,
    endMin: 18 * 60,
    lunchBreak: false,
    mode: "walking",
    priority: "fewer_moves",
    ...over,
  };
}

describe("computeStayMin（11.2-1）", () => {
  it("中央値がなければカテゴリの標準値を使い、ペースと興味で調整して5分単位に丸める", () => {
    expect(computeStayMin({ category: "history", stayMinutesMedian: null }, "normal", [])).toBe(45);
    // 45 × 1.2（興味あり）× 1.3（ゆったり）= 70.2 → 70
    expect(computeStayMin({ category: "history", stayMinutesMedian: null }, "relaxed", ["history"])).toBe(70);
    // 120 × 0.8（たくさん回りたい）= 96 → 95
    expect(computeStayMin({ category: "nature", stayMinutesMedian: 120 }, "packed", [])).toBe(95);
  });
});

describe("bestHoursFromHistogram（11.2-2）", () => {
  it("投稿5件未満はおすすめ時間帯なし", () => {
    const h = Array(24).fill(0);
    h[17] = 4;
    expect(bestHoursFromHistogram(h)).toEqual([]);
  });

  it("多い時間帯（最大の6割以上）を返す", () => {
    const h = Array(24).fill(0);
    h[16] = 2;
    h[17] = 5;
    h[9] = 1;
    expect(bestHoursFromHistogram(h)).toEqual([17]);
  });
});

describe("computeCandidates（11.2-4〜8）", () => {
  it("一直線に並んだスポットは、出発地から近い順に回る", () => {
    // 行列の並びは入力の並び（c=1, a=2, b=3）なので、近い順は c→a→b
    const r = computeCandidates(input([spot("c", 30), spot("a", 30), spot("b", 30)]), lineMatrix(3));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.candidates[0].order).toEqual(["c", "a", "b"]);
    expect(r.candidates[0].stats.totalTravelMin).toBe(30);
  });

  it("終了時刻を超える案は出さず、入らなかったスポットを返す", () => {
    const spots = [spot("a", 120), spot("b", 120), spot("c", 120)];
    const r = computeCandidates(input(spots, { endMin: 9 * 60 + 300 }), lineMatrix(3));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const c of r.candidates) {
      expect(c.stats.endAt).toBeLessThanOrEqual(9 * 60 + 300);
      expect(c.skipped.length).toBeGreaterThan(0);
    }
  });

  it("回れる数が最も多い案だけを出す", () => {
    const spots = [spot("a", 60), spot("b", 60), spot("c", 60)];
    const r = computeCandidates(input(spots, { endMin: 9 * 60 + 150 }), lineMatrix(3));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const c of r.candidates) expect(c.stats.spotCount).toBe(2);
  });

  it("必ず行きたいスポットは外さない", () => {
    const spots = [spot("a", 120), spot("b", 120), spot("c", 120, { mustVisit: true })];
    const r = computeCandidates(input(spots, { endMin: 9 * 60 + 200 }), lineMatrix(3));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const c of r.candidates) expect(c.order).toContain("c");
  });

  it("必ず行きたいだけでも時間内に入らなければ失敗を返す", () => {
    const spots = [spot("a", 300, { mustVisit: true }), spot("b", 300, { mustVisit: true })];
    expect(computeCandidates(input(spots), lineMatrix(2))).toEqual({ ok: false, reason: "must_visit_overflow" });
  });

  it("おすすめの時間帯に合う案では、夕方が人気のスポットを夕方に回す", () => {
    const spots = [spot("sunset", 30, { bestHours: [17] }), spot("x", 60), spot("y", 60)];
    const r = computeCandidates(input(spots, { priority: "best_time", startMin: 13 * 60 }), lineMatrix(3, 20));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const best = r.candidates.find((c) => c.kind === "best_time")!;
    const item = best.items.find((i) => i.type === "spot" && i.spotId === "sunset");
    expect(item && item.type === "spot" && item.inBestTime).toBe(true);
    // 選んだ「優先すること」に合う案が先頭
    expect(r.candidates[0].kind).toBe("best_time");
  });

  it("昼食休憩を11:30以降の最初の空き時間に60分入れる", () => {
    const sim = simulate(input([spot("a", 150), spot("b", 60)], { lunchBreak: true }), lineMatrix(2), [1, 2]);
    const lunch = sim.items.find((i) => i.type === "lunch");
    expect(lunch).toMatchObject({ arrive: 9 * 60 + 10 + 150, stayMin: 60 });
  });

  it("8か所の全通り（約11万通り）を1秒以内に計算できる", () => {
    const spots = Array.from({ length: 8 }, (_, i) => spot(`s${i}`, 30));
    const t = performance.now();
    const r = computeCandidates(input(spots), lineMatrix(8, 7));
    expect(r.ok).toBe(true);
    expect(performance.now() - t).toBeLessThan(1000);
  });
});

describe("recomputeCandidate（F-5-10）", () => {
  it("順番と滞在時間を変えると時刻を計算し直し、終了時刻を超えたら印を付ける", () => {
    const inp = input([spot("a", 30), spot("b", 30)], { endMin: 9 * 60 + 100 });
    const r = computeCandidates(inp, lineMatrix(2));
    if (!r.ok) throw new Error("unexpected");
    const changed = recomputeCandidate(inp, lineMatrix(2), r.candidates[0], ["b", "a"], new Map([["a", 90]]));
    expect(changed.order).toEqual(["b", "a"]);
    expect(changed.overTime).toBe(true);
  });
});

describe("区間ごとの移動手段（F-5-10・ADR-0019）", () => {
  it("上書きした区間だけ移動手段と所要時間が変わり、以降の時刻もずれる", () => {
    const inp = input([spot("a", 30), spot("b", 30)]);
    const base = simulate(inp, lineMatrix(2), [1, 2]);
    const overrides = new Map([
      [legKey(1, 2), { mode: "driving" as const, travelMin: 25, distM: 5000, walkM: 0, estimated: false }],
    ]);
    const sim = simulate(inp, lineMatrix(2), [1, 2], undefined, overrides);
    const first = sim.items.find((i) => i.type === "spot" && i.spotId === "a");
    const second = sim.items.find((i) => i.type === "spot" && i.spotId === "b");
    expect(first && first.type === "spot" && first.next?.mode).toBe("driving");
    expect(first && first.type === "spot" && first.next?.travelMin).toBe(25);
    expect(second && second.type === "spot" && second.arrive).toBe(9 * 60 + 10 + 30 + 25);
    expect(sim.stats.totalTravelMin).toBe(base.stats.totalTravelMin + 15);
  });
});
