import { describe, expect, it } from "vitest";
import { NETWORK, estimateRideTimes, prefersTransit } from "./network";
import { findTransitRoute, type TransitStep } from "./route";

// 初期データのスポット（supabase/seed/kanazawa.sql）
const P = {
  kanazawaStation: { lat: 36.5781, lng: 136.648 },
  kenrokuen: { lat: 36.5621, lng: 136.6626 },
  museum21: { lat: 36.5609, lng: 136.6582 },
  higashi: { lat: 36.5725, lng: 136.6667 },
  nishi: { lat: 36.5535, lng: 136.6505 },
  komatsuStation: { lat: 36.403, lng: 136.4535 },
};
const rides = estimateRideTimes();
const ridesOf = (steps: TransitStep[]) => steps.filter((s) => s.kind === "ride");

describe("公共交通の経路探索（ADR-0026）", () => {
  it("データの路線は2か所以上の乗り場を持ち、乗車時間はすべて正の値", () => {
    for (const line of NETWORK.lines) {
      expect(line.stopIds.length).toBeGreaterThan(1);
      expect(rides.get(line.id)!.every((m) => m > 0)).toBe(true);
    }
  });

  it("金沢駅 → ひがし茶屋街は、周遊バス右回りで橋場町まで乗る", () => {
    const r = findTransitRoute(P.kanazawaStation, P.higashi, rides)!;
    const [ride] = ridesOf(r.steps);
    expect(ride).toMatchObject({ kind: "ride", line: "城下まち金沢周遊バス 右回り", from: "金沢駅東口" });
    expect(ride.kind === "ride" && ride.to).toMatch(/^橋場町/);
    // 手順は 徒歩 → 乗車 → 徒歩（行き先）
    expect(r.steps[0].kind).toBe("walk");
    expect(r.steps.at(-1)).toMatchObject({ kind: "walk", to: null });
  });

  it("21世紀美術館 → ひがし茶屋街は、左回りに乗る（右回りだと遠回り）", () => {
    const r = findTransitRoute(P.museum21, P.higashi, rides)!;
    expect(ridesOf(r.steps)[0]).toMatchObject({ line: "城下まち金沢周遊バス 左回り" });
  });

  it("乗ってすぐ同じ乗り場で降りる経路は作らない", () => {
    for (const [a, b] of [
      [P.kenrokuen, P.museum21],
      [P.higashi, P.nishi],
      [P.nishi, P.kanazawaStation],
    ]) {
      const r = findTransitRoute(a, b, rides);
      for (const s of ridesOf(r?.steps ?? [])) {
        expect(s.kind === "ride" && s.stops).toBeGreaterThan(0);
        expect(s.kind === "ride" && s.from !== s.to).toBe(true);
      }
    }
  });

  it("金沢駅 → 小松駅は鉄道に乗り、方面（終点の駅）を出す", () => {
    const r = findTransitRoute(P.kanazawaStation, P.komatsuStation, rides)!;
    const [ride] = ridesOf(r.steps);
    expect(ride).toMatchObject({ vehicle: "rail", from: "金沢駅", to: "小松駅" });
    expect(ride.kind === "ride" && ride.toward).toMatch(/駅$/);
  });

  it("近くに乗り場がない地点は経路なし", () => {
    expect(findTransitRoute({ lat: 37.0, lng: 136.0 }, P.kenrokuen, rides)).toBeNull();
  });

  it("合計時間は手順の時間の合計と一致する", () => {
    const r = findTransitRoute(P.kanazawaStation, P.nishi, rides)!;
    const sum = r.steps.reduce((t, s) => t + (s.kind === "walk" ? s.min : s.waitMin + s.rideMin), 0);
    expect(sum).toBeCloseTo(r.totalMin, 5);
  });

  it("短い区間は乗り物が3分以上早いときだけ、長い区間は徒歩より遅くなければ乗り物を使う", () => {
    expect(prefersTransit(10, 12)).toBe(false);
    expect(prefersTransit(8, 12)).toBe(true);
    expect(prefersTransit(27, 29)).toBe(true);
    expect(prefersTransit(30, 29)).toBe(false);
  });
});
