import { describe, expect, it } from "vitest";
import {
  bestHoursFromHistogram,
  computeCandidates,
  computeStayMin,
  legKey,
  recomputeCandidate,
  satisfiesOrderHints,
  simulate,
} from "@/lib/planner";
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

  it("昼食の時間帯と長さを選べる（13:00以降に30分）", () => {
    const lunch = { from: 13 * 60, until: 14 * 60, min: 30 };
    // a のあと（11:40）はまだ時間帯の前なので入れず、b のあと（12:50 → 13:00 より前）も入れず、c のあとに入れる
    const sim = simulate(
      input([spot("a", 150), spot("b", 60), spot("c", 30), spot("d", 30)], { lunchBreak: true, lunch }),
      lineMatrix(4),
      [1, 2, 3, 4],
    );
    const item = sim.items.find((i) => i.type === "lunch");
    expect(item).toMatchObject({ stayMin: 30 });
    expect(item && item.type === "lunch" && item.arrive).toBeGreaterThanOrEqual(13 * 60);
  });

  it("次のスポットまで回ると時間帯の中で食べ終われないときは、時間帯の始まりまで待って昼食を入れる", () => {
    // a は 11:40 に終わる。次の b まで回ると 12:50 になり、12:00〜13:00 に60分の昼食が入らないので 12:00 に入れる
    const lunch = { from: 12 * 60, until: 13 * 60, min: 60 };
    const sim = simulate(input([spot("a", 150), spot("b", 60)], { lunchBreak: true, lunch }), lineMatrix(2), [1, 2]);
    const item = sim.items.find((i) => i.type === "lunch");
    expect(item).toMatchObject({ arrive: 12 * 60, stayMin: 60, depart: 13 * 60 });
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

describe("AIと相談の条件（時刻の指定・順番の希望。F-5-5）", () => {
  it("時刻の指定より早く着いたら待ち、指定の時間帯に着く順番を選ぶ", () => {
    const spots = [spot("a", 30), spot("b", 30), spot("c", 30)];
    // c は 16:00〜17:30 に着きたい
    const res = computeCandidates(
      input(spots, { timeWindows: [{ spotId: "c", from: 16 * 60, to: 17 * 60 + 30 }] }),
      lineMatrix(3),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    for (const c of res.candidates) {
      const item = c.items.find((i) => i.type === "spot" && i.spotId === "c");
      expect(item && item.type === "spot" && item.arrive >= 16 * 60 && item.arrive <= 17 * 60 + 30).toBe(true);
    }
  });

  it("指定の時間帯に間に合わないスポットは外れる（必ず行きたいでなければ）", () => {
    const spots = [spot("a", 30), spot("b", 30)];
    // b は 9:05 までに着きたいが、出発地から 20 分かかる
    const res = computeCandidates(input(spots, { timeWindows: [{ spotId: "b", from: 9 * 60, to: 9 * 60 + 5 }] }), lineMatrix(2));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.candidates[0].order).toEqual(["a"]);
    expect(res.candidates[0].skipped.map((s) => s.spotId)).toEqual(["b"]);
  });

  it("順番の希望を満たす順番だけを使う", () => {
    const spots = [spot("a", 30), spot("b", 30), spot("c", 30)];
    const res = computeCandidates(
      input(spots, {
        orderHints: [
          { spotId: "c", position: "first" },
          { spotId: "a", position: "after", relativeTo: "b" },
        ],
      }),
      lineMatrix(3),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    for (const c of res.candidates) expect(c.order).toEqual(["c", "b", "a"]);
  });

  it("satisfiesOrderHints：順番に入っていないスポットの希望は問わない", () => {
    expect(satisfiesOrderHints(["a", "b"], [{ spotId: "x", position: "first" }])).toBe(true);
    expect(satisfiesOrderHints(["a", "b"], [{ spotId: "b", position: "last" }])).toBe(true);
    expect(satisfiesOrderHints(["a", "b"], [{ spotId: "a", position: "last" }])).toBe(false);
    expect(satisfiesOrderHints(["a", "b"], [{ spotId: "a", position: "before", relativeTo: "b" }])).toBe(true);
    expect(satisfiesOrderHints(["b", "a"], [{ spotId: "a", position: "before", relativeTo: "b" }])).toBe(false);
  });
});
