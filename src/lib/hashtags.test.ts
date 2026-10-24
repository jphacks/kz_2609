import { describe, expect, it } from "vitest";
import { builtinTag, parseHashtags, splitHashtags, tagFromQuery } from "@/lib/hashtags";

describe("ハッシュタグ（F-1-13）", () => {
  it("コメントからタグを重複なく取り出す（全角の＃も使える）", () => {
    expect(parseHashtags("朝の河童橋がきれい #自然界隈 ＃絶景、#自然界隈")).toEqual(["自然界隈", "絶景"]);
    expect(parseHashtags("タグなし")).toEqual([]);
  });

  it("句読点や記号の手前でタグが終わる", () => {
    expect(parseHashtags("#夜景。また来たい")).toEqual(["夜景"]);
    expect(parseHashtags("(#カフェ)")).toEqual(["カフェ"]);
  });

  it("検索欄の「#タグ」だけをタグ検索として扱う", () => {
    expect(tagFromQuery("#自然界隈")).toBe("自然界隈");
    expect(tagFromQuery(" ＃グルメ界隈 ")).toBe("グルメ界隈");
    expect(tagFromQuery("上高地")).toBeNull();
    expect(tagFromQuery("#")).toBeNull();
    expect(tagFromQuery("#自然 界隈")).toBeNull();
  });

  it("用意したタグはカテゴリ・隠れた名所に対応する", () => {
    expect(builtinTag("自然界隈")?.category).toBe("nature");
    expect(builtinTag("隠れた名所")?.hiddenGem).toBe(true);
    expect(builtinTag("夜景")).toBeUndefined();
  });

  it("コメントを文字とタグに分ける", () => {
    expect(splitHashtags("きれい #夜景 だった")).toEqual([
      { text: "きれい " },
      { text: "#夜景", tag: "夜景" },
      { text: " だった" },
    ]);
  });
});

describe("検索の問い合わせ文を壊す文字（F-1-13）", () => {
  it("* : ; | \\ はタグに含めない", () => {
    expect(parseHashtags("#a*b #c:d #e;f #g|h #i\\j")).toEqual(["a", "c", "e", "g", "i"]);
    expect(tagFromQuery("#a*b")).toBeNull();
  });
});
