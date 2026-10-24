import { describe, expect, it } from "vitest";
import { isHiddenGem } from "@/lib/hidden-gem";

describe("隠れた名所（F-1-12）", () => {
  it("投稿が少なく、投稿1件あたりのいいねが3以上なら隠れた名所", () => {
    expect(isHiddenGem({ postCount: 2, likeCount: 6, popularity: "normal" })).toBe(true);
    expect(isHiddenGem({ postCount: 1, likeCount: 5, popularity: "normal" })).toBe(true);
  });

  it("いいねの割合が低い・いいねが少なすぎるときは対象外", () => {
    expect(isHiddenGem({ postCount: 4, likeCount: 11, popularity: "normal" })).toBe(false);
    expect(isHiddenGem({ postCount: 1, likeCount: 4, popularity: "normal" })).toBe(false);
  });

  it("投稿が多い場所や、すでに人気・大人気の場所は対象外", () => {
    expect(isHiddenGem({ postCount: 11, likeCount: 100, popularity: "normal" })).toBe(false);
    expect(isHiddenGem({ postCount: 3, likeCount: 30, popularity: "popular" })).toBe(false);
    expect(isHiddenGem({ postCount: 3, likeCount: 30, popularity: "very_popular" })).toBe(false);
    expect(isHiddenGem({ postCount: 0, likeCount: 0, popularity: "normal" })).toBe(false);
  });
});
