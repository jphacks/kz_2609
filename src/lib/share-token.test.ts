import { describe, expect, it } from "vitest";
import { SHARE_TOKEN_LENGTH, isShareToken, newShareToken } from "@/lib/share-token";

describe("リスト共有の合言葉（F-4-6）", () => {
  it("URL にそのまま入れられる32文字で、毎回ちがう値になる", () => {
    const a = newShareToken();
    const b = newShareToken();
    expect(a).toHaveLength(SHARE_TOKEN_LENGTH);
    expect(isShareToken(a)).toBe(true);
    expect(a).not.toBe(b);
  });

  it("長さや文字が違う値は合言葉として扱わない", () => {
    expect(isShareToken("")).toBe(false);
    expect(isShareToken("short")).toBe(false);
    expect(isShareToken("a".repeat(31) + "%")).toBe(false);
    expect(isShareToken("a".repeat(33))).toBe(false);
  });
});
