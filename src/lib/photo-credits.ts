// 初期データの写真（Wikimedia Commons のクリエイティブ・コモンズ等の画像）と、その作者・ライセンス。
// 写真は public/seed/photos/ に置き、DB の post_images には "seed/photos/..." のパスで登録する（supabase/seed/photos.sql）。
// CC BY / CC BY-SA は作者名・ライセンス・出典の表示が条件のため、写真の下とクレジット一覧（/credits）に表示する。
import seedPhotos from "@/lib/seed-photos.json";

export type SeedPhoto = {
  spot: string;
  full: string;
  thumb: string;
  width: number;
  height: number;
  label: string;
  title: string;
  artist: string;
  license: string;
  page: string;
};

export type PhotoCredit = { artist: string; license: string; page: string; label: string };

export const SEED_PHOTOS = seedPhotos as SeedPhoto[];

const byPath = new Map<string, SeedPhoto>();
for (const p of SEED_PHOTOS) {
  byPath.set(p.full, p);
  byPath.set(p.thumb, p);
}

// 画像のパスから作者・ライセンスを引く。チームが投稿した写真は null
export function photoCredit(path: string | null | undefined): PhotoCredit | null {
  const p = path ? byPath.get(path) : undefined;
  return p ? { artist: p.artist, license: p.license, page: p.page, label: p.label } : null;
}

// スポット名ごとの初期データの写真（Supabase 未接続のデモ表示用）
export function seedPhotosOf(spotName: string): SeedPhoto[] {
  return SEED_PHOTOS.filter((p) => p.spot === spotName);
}
