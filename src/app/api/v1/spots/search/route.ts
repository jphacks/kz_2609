import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { ApiError, dbError, handle } from "@/lib/api";
import { builtinTag, tagFromQuery } from "@/lib/hashtags";
import { HIDDEN_GEM_MAX_POSTS, HIDDEN_GEM_MIN_LIKES, isHiddenGem } from "@/lib/hidden-gem";
import { publicImageUrl } from "@/lib/storage";
import { getServerSupabase } from "@/lib/supabase/server";

const SPOT_COLUMNS =
  "id,name,lat,lng,address,category,post_count,like_count,popularity,cover:post_images!spots_cover_image_fk(thumb_path)";
const TAG_RESULT_MAX = 30;

type SpotRow = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  category: string;
  post_count: number;
  like_count: number;
  popularity: string;
  cover: unknown;
};

function toHit(s: SpotRow) {
  const cover = s.cover as { thumb_path: string } | null;
  return {
    id: s.id,
    name: s.name,
    lat: s.lat,
    lng: s.lng,
    address: s.address,
    category: s.category,
    postCount: s.post_count,
    likeCount: s.like_count,
    popularity: s.popularity,
    coverThumbUrl: publicImageUrl(cover?.thumb_path),
  };
}

// PostgREST の like ではワイルドカードを文字として扱う
const escapeLike = (s: string) => s.replace(/[%_\\]/g, (c) => `\\${c}`);

// F-1-13：「#タグ」の検索。用意したタグはカテゴリ・隠れた名所に、
// それ以外は公開中の投稿のコメントに「#タグ」が書かれたスポットに当てはめる
async function searchByTag(supabase: SupabaseClient, tag: string) {
  const builtin = builtinTag(tag);
  const found = new Map<string, SpotRow>();

  if (builtin?.category) {
    const { data, error } = await supabase
      .from("spots")
      .select(SPOT_COLUMNS)
      .eq("category", builtin.category)
      .gt("post_count", 0)
      .order("post_count", { ascending: false })
      .limit(TAG_RESULT_MAX);
    dbError(error);
    for (const s of (data ?? []) as SpotRow[]) found.set(s.id, s);
  }
  if (builtin?.hiddenGem) {
    const { data, error } = await supabase
      .from("spots")
      .select(SPOT_COLUMNS)
      .eq("popularity", "normal")
      .gt("post_count", 0)
      .lte("post_count", HIDDEN_GEM_MAX_POSTS)
      .gte("like_count", HIDDEN_GEM_MIN_LIKES)
      .order("like_count", { ascending: false })
      .limit(200);
    dbError(error);
    for (const s of (data ?? []) as SpotRow[]) {
      if (isHiddenGem({ postCount: s.post_count, likeCount: s.like_count, popularity: s.popularity })) found.set(s.id, s);
    }
  }

  // コメントのタグ（全角の＃で書かれたものも探す）。タグに or() 構文を壊す文字は入らない（hashtags.ts）
  const like = escapeLike(tag);
  const { data: posts, error: postsError } = await supabase
    .from("posts")
    .select("spot_id")
    .eq("status", "public")
    .or(`comment.ilike.%#${like}%,comment.ilike.%＃${like}%`)
    .limit(200);
  dbError(postsError);
  const ids = [...new Set((posts ?? []).map((p) => p.spot_id as string))].filter((id) => !found.has(id));
  if (ids.length > 0) {
    const { data, error } = await supabase
      .from("spots")
      .select(SPOT_COLUMNS)
      .in("id", ids.slice(0, TAG_RESULT_MAX))
      .gt("post_count", 0);
    dbError(error);
    for (const s of (data ?? []) as SpotRow[]) found.set(s.id, s);
  }

  return [...found.values()]
    .sort((a, b) => b.post_count + b.like_count - (a.post_count + a.like_count))
    .slice(0, TAG_RESULT_MAX)
    .map(toHit);
}

// F-2-7・F-1-11・F-1-13：自前DBのスポット検索（地図の検索、投稿・拠点の指定で使う。検索画面 F-3-6 はβ版）。
// 「#タグ」だけの入力はタグ検索にする
export async function GET(request: NextRequest) {
  return handle(async () => {
    const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length === 0 || q.length > 50) throw new ApiError("VALIDATION_ERROR", "検索するスポット名を入力してください");
    const supabase = await getServerSupabase();

    const tag = tagFromQuery(q);
    if (tag) return Response.json({ tag, spots: await searchByTag(supabase, tag) });

    // PostgREST の or() 構文を壊す文字は空白にする
    const pattern = `%${escapeLike(q.replace(/[,()"]/g, " "))}%`;
    const { data, error } = await supabase
      .from("spots")
      .select(SPOT_COLUMNS)
      .or(`name.ilike.${pattern},address.ilike.${pattern}`)
      .order("post_count", { ascending: false })
      .limit(10);
    dbError(error);
    return Response.json({ spots: ((data ?? []) as SpotRow[]).map(toHit) });
  });
}
