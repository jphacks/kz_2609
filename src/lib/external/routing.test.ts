import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/quota", () => ({ consumeQuota: async () => true }));

const { estimateLeg } = await import("./routing");

// 初期データのスポットと、石川県外の地点
const kanazawaStation = { lat: 36.5781, lng: 136.648 };
const kenrokuen = { lat: 36.5621, lng: 136.6626 };
const castle = { lat: 36.565, lng: 136.6595 };
const shirakawago = { lat: 36.2577, lng: 136.906 };

describe("公共交通の区間の決め方（ADR-0027）", () => {
  it("歩いた方が早い区間は徒歩にし、公共交通も選べる（経路はある）", () => {
    const leg = estimateLeg(kenrokuen, castle, "transit");
    expect(leg).toMatchObject({ mode: "walking", walkSuggested: true });
    expect(leg.noTransitRoute).toBeUndefined();
  });

  it("ユーザーが公共交通を選んだら、徒歩より遅くても乗り物の経路を使う", () => {
    const leg = estimateLeg(kanazawaStation, kenrokuen, "transit", undefined, true);
    expect(leg.mode).toBe("transit");
    expect(leg.steps?.some((s) => s.kind === "ride")).toBe(true);
  });

  it("近くに公共交通の経路がない区間は車をすすめ、公共交通を選んでも選べない区間として返す", () => {
    for (const force of [false, true]) {
      const leg = estimateLeg(kanazawaStation, shirakawago, "transit", undefined, force);
      expect(leg).toMatchObject({ mode: "driving", carSuggested: true, noTransitRoute: true });
    }
  });
});
