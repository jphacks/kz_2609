import { describe, expect, it } from "vitest";
import { SEARCH_HISTORY_MAX, addHistory, clearHistory, readHistory, splitMatch } from "@/lib/search-history";

function memoryStore() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}
const item = (id: string) => ({ id, name: `スポット${id}`, address: null, lat: 36.5, lng: 136.6 });

describe("検索の履歴（F-1-11）", () => {
  it("新しいものを先頭にし、同じ場所は1つにまとめ、最大件数で切る", () => {
    const s = memoryStore();
    addHistory(item("a"), s);
    addHistory(item("b"), s);
    addHistory(item("a"), s);
    expect(readHistory(s).map((h) => h.id)).toEqual(["a", "b"]);
    for (let i = 0; i < 15; i++) addHistory(item(`x${i}`), s);
    expect(readHistory(s)).toHaveLength(SEARCH_HISTORY_MAX);
    clearHistory(s);
    expect(readHistory(s)).toEqual([]);
  });

  it("保存できない・壊れた値でも落ちない", () => {
    const broken = { getItem: () => "{oops", setItem: () => { throw new Error("quota"); }, removeItem: () => {} };
    expect(readHistory(broken)).toEqual([]);
    expect(addHistory(item("a"), broken).map((h) => h.id)).toEqual(["a"]);
    expect(readHistory(null)).toEqual([]);
  });
});

describe("splitMatch", () => {
  it("入力した文字の部分を分ける", () => {
    expect(splitMatch("金沢21世紀美術館", "21世紀")).toEqual([
      { text: "金沢", typed: false },
      { text: "21世紀", typed: true },
      { text: "美術館", typed: false },
    ]);
    expect(splitMatch("兼六園", "")).toEqual([{ text: "兼六園", typed: false }]);
    expect(splitMatch("兼六園", "城")).toEqual([{ text: "兼六園", typed: false }]);
  });
});
