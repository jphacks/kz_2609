// 画面とAPIで共通に使う定数（要件定義書 5章・11章）

export const CATEGORIES = ["nature", "gourmet", "history", "photogenic", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  nature: "自然",
  gourmet: "グルメ",
  history: "歴史・文化",
  photogenic: "写真映え",
  other: "その他",
};

// 滞在時間の標準値（11.2）
export const CATEGORY_DEFAULT_STAY_MIN: Record<Category, number> = {
  nature: 60,
  gourmet: 60,
  history: 45,
  photogenic: 30,
  other: 45,
};

export const STAY_DURATIONS = ["lt30", "lt60", "lt120", "half_day"] as const;
export type StayDuration = (typeof STAY_DURATIONS)[number];

export const STAY_LABELS: Record<StayDuration, string> = {
  lt30: "〜30分",
  lt60: "〜1時間",
  lt120: "〜2時間",
  half_day: "半日以上",
};

export const STAY_MINUTES: Record<StayDuration, number> = {
  lt30: 30,
  lt60: 60,
  lt120: 120,
  half_day: 240,
};

export const POPULARITY_LABELS = {
  normal: "通常",
  popular: "人気",
  very_popular: "大人気",
} as const;
export type Popularity = keyof typeof POPULARITY_LABELS;

// 移動手段は Google Routes API の徒歩・車・公共交通（ADR-0019）
export const TRAVEL_MODES = ["transit", "walking", "driving"] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];

export const TRAVEL_MODE_LABELS: Record<TravelMode, string> = {
  transit: "公共交通",
  walking: "徒歩",
  driving: "車",
};

export const PACES = ["relaxed", "normal", "packed"] as const;
export type Pace = (typeof PACES)[number];

export const PACE_LABELS: Record<Pace, string> = {
  relaxed: "ゆったり",
  normal: "ふつう",
  packed: "たくさん回りたい",
};

export const PACE_MULTIPLIER: Record<Pace, number> = {
  relaxed: 1.3,
  normal: 1.0,
  packed: 0.8,
};

export const PRIORITIES = ["fewer_moves", "more_spots", "best_time", "less_walking"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  fewer_moves: "移動を少なく",
  more_spots: "たくさん回る",
  best_time: "おすすめの時間帯に合わせる",
  less_walking: "歩く距離を少なく",
};

// 点数の重み（11.3。初期値。金沢のデータで試しながら調整する）
export const PRIORITY_WEIGHTS: Record<Priority, { travel: number; timeGap: number; walkKm: number; spots: number }> = {
  fewer_moves: { travel: 1.0, timeGap: 0.3, walkKm: 5, spots: 30 },
  more_spots: { travel: 0.5, timeGap: 0.3, walkKm: 3, spots: 90 },
  best_time: { travel: 0.7, timeGap: 1.0, walkKm: 3, spots: 30 },
  less_walking: { travel: 0.7, timeGap: 0.3, walkKm: 20, spots: 30 },
};

// 経路作成の上限（ADR-0017）
export const MAX_PLAN_SPOTS = 8;

// 入力の上限（F-2・F-4）
export const COMMENT_MAX = 150;
export const SPOT_NAME_MAX = 50;
export const LIST_NAME_MAX = 30;
export const MAX_LISTS = 20;
export const MAX_LIST_ITEMS = 30;
export const MAX_IMAGES = 4;
export const MAX_SOURCE_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

// ログイン（F-6-1）。Supabase の「Minimum password length」と同じ値にする
export const PASSWORD_MIN = 6; // ADR-0022

// GPS（F-2-6）
export const NEARBY_RADIUS_M = 100;
export const GPS_MAX_ACCURACY_M = 100;
export const SAME_SPOT_RADIUS_M = 50;

// 地図のズーム切り替え（F-1-3）
export const ZOOM_HEATMAP_MAX = 8;
export const ZOOM_PIN_MIN = 14;

export const STORAGE_BUCKET = "post-images";
