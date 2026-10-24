import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ApiError, dbError, parseWith } from "@/lib/api";
import { CATEGORY_DEFAULT_STAY_MIN, type Category } from "@/lib/constants";
import { bestHoursFromHistogram } from "@/lib/planner";
import { publicImageUrl } from "@/lib/storage";

export type ListSpot = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: Category;
  postCount: number;
  likeCount: number;
  popularity: string;
  stayMinutes: number;
  stayMinutesMedian: number | null;
  hourHistogram: number[];
  bestHours: number[];
  coverThumbUrl: string | null;
  mustVisit: boolean;
  addedAt: string;
  deleted: boolean;
};

type SpotRow = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: Category;
  post_count: number;
  like_count: number;
  popularity: string;
  stay_minutes_median: number | null;
  hour_histogram: number[];
  cover: { thumb_path: string } | null;
};

// 自分のリストを1件読み込む（本人以外は見つからない扱い。RLS でも守る）
export async function loadList(supabase: SupabaseClient, listId: string) {
  parseWith(z.string().uuid({ message: "リストが見つかりませんでした" }), listId);
  const { data: list, error } = await supabase
    .from("wishlists")
    .select("id,name,base_label,base_lat,base_lng,share_token,created_at")
    .eq("id", listId)
    .maybeSingle();
  dbError(error);
  if (!list) throw new ApiError("NOT_FOUND", "リストが見つかりませんでした");

  const { data: items, error: itemsError } = await supabase
    .from("wishlist_items")
    .select(
      "spot_id,must_visit,created_at,spots(id,name,lat,lng,category,post_count,like_count,popularity,stay_minutes_median,hour_histogram,cover:post_images!spots_cover_image_fk(thumb_path))",
    )
    .eq("wishlist_id", listId)
    .order("created_at", { ascending: true });
  dbError(itemsError);

  const spots: ListSpot[] = (items ?? []).map((it) => {
    const s = it.spots as unknown as SpotRow;
    const hist = s.hour_histogram ?? [];
    return {
      id: s.id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      category: s.category,
      postCount: s.post_count,
      likeCount: s.like_count,
      popularity: s.popularity,
      stayMinutes: s.stay_minutes_median ?? CATEGORY_DEFAULT_STAY_MIN[s.category],
      stayMinutesMedian: s.stay_minutes_median,
      hourHistogram: hist,
      bestHours: bestHoursFromHistogram(hist),
      coverThumbUrl: publicImageUrl(s.cover?.thumb_path),
      mustVisit: it.must_visit,
      addedAt: it.created_at,
      // 投稿がすべて消えたスポットは「削除されたスポット」として表示する（F-4）
      deleted: s.post_count === 0,
    };
  });

  return {
    id: list.id as string,
    name: list.name as string,
    base:
      list.base_lat !== null && list.base_lng !== null
        ? { label: list.base_label as string, lat: list.base_lat as number, lng: list.base_lng as number }
        : null,
    createdAt: list.created_at as string,
    spots,
  };
}
