import type { Popularity } from "@/lib/constants";

// F-1-12：隠れた名所。投稿は少ないのに、投稿1件あたりのいいねが多い（見た人の満足度が高い）スポット。
// 人気・大人気の場所に人が集中しないよう、まだ知られていない良い場所を目立たせる
export const HIDDEN_GEM_MAX_POSTS = 10;
export const HIDDEN_GEM_MIN_LIKES = 5;
export const HIDDEN_GEM_MIN_LIKES_PER_POST = 3;

export function isHiddenGem(spot: { postCount: number; likeCount: number; popularity: Popularity | string }): boolean {
  if (spot.popularity !== "normal") return false;
  if (spot.postCount < 1 || spot.postCount > HIDDEN_GEM_MAX_POSTS) return false;
  if (spot.likeCount < HIDDEN_GEM_MIN_LIKES) return false;
  return spot.likeCount / spot.postCount >= HIDDEN_GEM_MIN_LIKES_PER_POST;
}
