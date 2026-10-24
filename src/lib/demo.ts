// Supabase に接続していないときだけ使う、金沢のデモデータ（読み取り専用）。
// 地図・スポット詳細の見た目を、キーがそろう前に確認するためのもの。
// 本来のデータは supabase/seed/kanazawa.sql（こちらとは別管理）。
import type { Category, Popularity } from "@/lib/constants";

export type DemoSpot = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: Category;
  postCount: number;
  stay: number;
  hours: number[];
};

const RAW: Array<[string, number, number, Category, number, number, number[]]> = [
  ["金沢駅 鼓門", 36.5781, 136.648, "photogenic", 5, 30, [9, 10, 17, 18, 19]],
  ["近江町市場", 36.5716, 136.6566, "gourmet", 6, 60, [10, 11, 11, 12, 12, 13]],
  ["兼六園", 36.5621, 136.6626, "nature", 8, 120, [8, 8, 9, 9, 10, 14, 15, 16]],
  ["金沢城公園", 36.565, 136.6595, "history", 3, 60, [10, 11, 15]],
  ["金沢21世紀美術館", 36.5609, 136.6582, "photogenic", 6, 120, [10, 11, 13, 14, 15, 16]],
  ["石川県立美術館", 36.5594, 136.6614, "history", 2, 60, [13, 14]],
  ["鈴木大拙館", 36.5583, 136.6636, "photogenic", 3, 60, [10, 14, 15]],
  ["ひがし茶屋街", 36.5725, 136.6667, "history", 7, 120, [9, 10, 10, 11, 15, 16, 17]],
  ["主計町茶屋街", 36.5713, 136.663, "history", 3, 30, [16, 17, 18]],
  ["浅野川 梅ノ橋", 36.5733, 136.6644, "photogenic", 3, 30, [16, 17, 17]],
  ["卯辰山公園 望湖台", 36.5737, 136.681, "nature", 2, 60, [17, 19]],
  ["長町武家屋敷跡", 36.5627, 136.65, "history", 4, 60, [9, 10, 14, 15]],
  ["尾山神社", 36.5655, 136.655, "history", 4, 30, [10, 16, 18, 19]],
  ["香林坊", 36.562, 136.654, "other", 2, 60, [13, 18]],
  ["にし茶屋街", 36.5535, 136.6505, "history", 2, 30, [11, 14]],
  ["妙立寺（忍者寺）", 36.553, 136.6487, "history", 3, 60, [10, 13, 14]],
  ["金沢港クルーズターミナル", 36.6083, 136.604, "photogenic", 3, 60, [16, 17, 17]],
  ["金沢海みらい図書館", 36.5913, 136.62, "photogenic", 2, 60, [11, 14]],
];

export const DEMO_SPOTS: DemoSpot[] = RAW.map(([name, lat, lng, category, postCount, stay, hours], i) => ({
  id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  name,
  lat,
  lng,
  category,
  postCount,
  stay,
  hours,
}));

// 人気度（F-1-5 と同じ考え方：上位10%＝大人気、上位10〜30%＝人気、投稿1件は通常）
export function demoPopularity(spot: DemoSpot): Popularity {
  const sorted = [...DEMO_SPOTS].sort((a, b) => b.postCount - a.postCount);
  const pos = sorted.findIndex((s) => s.id === spot.id) + 1;
  const ratio = pos / sorted.length;
  if (spot.postCount < 2) return "normal";
  if (ratio <= 0.1) return "very_popular";
  if (ratio <= 0.3) return "popular";
  return "normal";
}

export function demoHistogram(spot: DemoSpot): number[] {
  const hist = Array<number>(24).fill(0);
  for (const h of spot.hours) hist[h]++;
  return hist;
}
