import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SEED_PHOTOS, photoCredit, seedPhotosOf } from "@/lib/photo-credits";
import { publicImageUrl } from "@/lib/storage";

// CC BY / CC BY-SA は作者名・ライセンス・出典の表示が条件。登録した写真に欠けがないことを確かめる
describe("初期データの写真とクレジット", () => {
  it("すべての写真に画像ファイルと作者・ライセンス・出典がある", () => {
    expect(SEED_PHOTOS.length).toBeGreaterThan(0);
    for (const p of SEED_PHOTOS) {
      expect(existsSync(path.join("public", p.full)), p.full).toBe(true);
      expect(existsSync(path.join("public", p.thumb)), p.thumb).toBe(true);
      expect(p.artist.trim(), p.full).not.toBe("");
      expect(p.page, p.full).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File/);
      // 商用利用可で、縮小して使えるライセンスだけ（NC・ND は使わない）
      expect(p.license, p.full).toMatch(/^(CC0|Public domain|PD|CC BY(-SA)? [\d.]+)/i);
      expect(p.license, p.full).not.toMatch(/\b(NC|ND)\b/);
    }
  });

  it("同じ写真を二重に登録していない", () => {
    expect(new Set(SEED_PHOTOS.map((p) => p.full)).size).toBe(SEED_PHOTOS.length);
    expect(new Set(SEED_PHOTOS.map((p) => p.page)).size).toBe(SEED_PHOTOS.length);
  });

  it("パスから作者を引け、初期データの写真はアプリの public から配信する", () => {
    const p = seedPhotosOf("兼六園")[0];
    expect(p).toBeDefined();
    expect(photoCredit(p.full)?.artist).toBe(p.artist);
    expect(photoCredit(p.thumb)?.license).toBe(p.license);
    expect(photoCredit("posts/u1/abc.webp")).toBeNull();
    expect(publicImageUrl(p.full)).toBe(`/${p.full}`);
  });
});
