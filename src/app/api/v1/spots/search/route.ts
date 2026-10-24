import type { NextRequest } from "next/server";
import { ApiError, dbError, handle } from "@/lib/api";
import { publicImageUrl } from "@/lib/storage";
import { getServerSupabase } from "@/lib/supabase/server";

// F-2-7・F-1-11：自前DBのスポット名検索（地図の検索、投稿・拠点の指定で使う。検索画面 F-3-6 はβ版）
export async function GET(request: NextRequest) {
  return handle(async () => {
    const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length === 0 || q.length > 50) throw new ApiError("VALIDATION_ERROR", "検索するスポット名を入力してください");
    // PostgREST の or() 構文を壊す文字は空白にし、ワイルドカードは文字として扱う
    const safe = q.replace(/[,()"]/g, " ").replace(/[%_\\]/g, (c) => `\\${c}`);
    const pattern = `%${safe}%`;
    const supabase = await getServerSupabase();
    const { data, error } = await supabase
      .from("spots")
      .select("id,name,lat,lng,address,category,post_count,like_count,popularity,cover:post_images!spots_cover_image_fk(thumb_path)")
      .or(`name.ilike.${pattern},address.ilike.${pattern}`)
      .order("post_count", { ascending: false })
      .limit(10);
    dbError(error);
    return Response.json({
      spots: (data ?? []).map((s) => {
        const cover = s.cover as unknown as { thumb_path: string } | null;
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
      }),
    });
  });
}
