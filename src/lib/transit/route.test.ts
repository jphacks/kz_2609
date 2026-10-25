import { describe, expect, it } from "vitest";
import { NETWORK, estimateRideTimes, prefersTransit } from "./network";
import { decideTransit, findTransitRoute, type TransitRoute, type TransitStep } from "./route";

// 初期データのスポット（supabase/seed/kanazawa.sql）
const P = {
  kanazawaStation: { lat: 36.5781, lng: 136.648 },
  kenrokuen: { lat: 36.5621, lng: 136.6626 },
  museum21: { lat: 36.5609, lng: 136.6582 },
  higashi: { lat: 36.5725, lng: 136.6667 },
  nishi: { lat: 36.5535, lng: 136.6505 },
  komatsuStation: { lat: 36.403, lng: 136.4535 },
  port: { lat: 36.6083, lng: 136.604 },
  tsurugi: { lat: 36.444, lng: 136.629 },
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
        // 路線バスは停まる順番のデータがないため stops は null
        if (s.kind === "ride" && s.stops !== null) expect(s.stops).toBeGreaterThan(0);
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

  it("周遊バスや駅から遠いスポット（金沢港）は、路線バスの系統で行く（ADR-0027）", () => {
    const r = findTransitRoute(P.kanazawaStation, P.port, rides)!;
    const [ride] = ridesOf(r.steps);
    // 路線バスは停まる順番のデータがないため、いくつ先かと方面は出さない
    expect(ride).toMatchObject({ vehicle: "bus", toward: null, stops: null });
    expect(r.routeBusRides).toHaveLength(1);
  });

  it("鉄道どうしの乗り換えもできる（金沢駅 → 鶴来は IR から北陸鉄道 石川線）", () => {
    const r = findTransitRoute(P.kanazawaStation, P.tsurugi, rides)!;
    const lines = ridesOf(r.steps).map((s) => s.kind === "ride" && s.line);
    expect(lines.at(-1)).toBe("北陸鉄道 石川線");
    expect(lines.length).toBeLessThanOrEqual(2);
  });

  it("歩く時間が1時間以上になるなら車をすすめ、1時間未満なら乗り物か徒歩の早い方", () => {
    const route = (totalMin: number, walkMin: number) => ({ totalMin, walkMin }) as TransitRoute;
    expect(decideTransit(null, { min: 70 })).toBe("car");
    expect(decideTransit(route(80, 65), { min: 90 })).toBe("car");
    expect(decideTransit(route(80, 20), { min: 90 })).toBe("transit");
    expect(decideTransit(route(30, 10), { min: 25 })).toBe("walk");
    expect(decideTransit(null, { min: 40 })).toBe("walk");
  });
});
