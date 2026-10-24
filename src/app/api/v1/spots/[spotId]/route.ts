import { z } from "zod";
import { ApiError, dbError, errorResponse, handle, parseWith } from "@/lib/api";
import { CATEGORY_DEFAULT_STAY_MIN, type Category } from "@/lib/constants";
import { DEMO_SPOTS, demoHistogram, demoPopularity } from "@/lib/demo";
import { isSupabaseConfigured } from "@/lib/env";
import { bestHoursFromHistogram } from "@/lib/planner";
import { photoCredit, seedPhotosOf } from "@/lib/photo-credits";
import { publicImageUrl } from "@/lib/storage";
import { getServerSupabase } from "@/lib/supabase/server";

type ImagePost = { like_count: number; created_at: string };

// Supabase 未接続のときはデモデータ（画面の確認用）
function demoSpot(spotId: string) {
  const s = DEMO_SPOTS.find((d) => d.id === spotId);
  if (!s) return errorResponse("NOT_FOUND", "このスポットは見つかりませんでした");
  const hist = demoHistogram(s);
  return Response.json({
    id: s.id,
    name: s.name,
    lat: s.lat,
    lng: s.lng,
    address: `石川県${s.city}`,
    prefecture: "石川県",
    city: s.city,
    category: s.category,
    postCount: s.postCount,
    likeCount: 0,
    popularity: demoPopularity(s),
    stayMinutes: s.stay,
    stayIsDefault: false,
    hourHistogram: hist,
    bestHours: bestHoursFromHistogram(hist),
    images: seedPhotosOf(s.name).map((p) => ({
      id: p.full,
      url: `/${p.full}`,
      thumbUrl: `/${p.thumb}`,
      width: p.width,
      height: p.height,
      credit: photoCredit(p.full),
    })),
    demo: true,
  });
}

// F-3-1：スポット詳細
export async function GET(_req: Request, ctx: RouteContext<"/api/v1/spots/[spotId]">) {
  if (!isSupabaseConfigured()) return demoSpot((await ctx.params).spotId);
  return handle(async () => {
    const { spotId } = await ctx.params;
    parseWith(z.string().uuid(), spotId);
    const supabase = await getServerSupabase();
    const { data: spot, error } = await supabase
      .from("spots")
      .select("id,name,lat,lng,address,prefecture,city,category,post_count,like_count,popularity,stay_minutes_median,hour_histogram")
      .eq("id", spotId)
      .maybeSingle();
    dbError(error);
    // 投稿がすべて消えたスポットは表示しない（F-2-12）
    if (!spot || spot.post_count === 0) throw new ApiError("NOT_FOUND", "このスポットは見つかりませんでした");

    const { data: images } = await supabase
      .from("post_images")
      .select("id,full_path,thumb_path,width,height,sort_order,posts!inner(spot_id,status,like_count,created_at)")
      .eq("posts.spot_id", spotId)
      .eq("posts.status", "public")
      .limit(40);

    // いいねが多い投稿の写真から並べる
    const sorted = (images ?? []).sort((a, b) => {
      const pa = a.posts as unknown as ImagePost;
      const pb = b.posts as unknown as ImagePost;
      return pb.like_count - pa.like_count || pb.created_at.localeCompare(pa.created_at) || a.sort_order - b.sort_order;
    });

    const hist = (spot.hour_histogram as number[]) ?? [];
    return Response.json({
      id: spot.id,
      name: spot.name,
      lat: spot.lat,
      lng: spot.lng,
      address: spot.address,
      prefecture: spot.prefecture,
      city: spot.city,
      category: spot.category,
      postCount: spot.post_count,
      likeCount: spot.like_count,
      popularity: spot.popularity,
      stayMinutes: spot.stay_minutes_median ?? CATEGORY_DEFAULT_STAY_MIN[spot.category as Category],
      stayIsDefault: spot.stay_minutes_median === null,
      hourHistogram: hist,
      bestHours: bestHoursFromHistogram(hist),
      images: sorted.map((i) => ({
        id: i.id,
        url: publicImageUrl(i.full_path),
        thumbUrl: publicImageUrl(i.thumb_path),
        width: i.width,
        height: i.height,
        credit: photoCredit(i.full_path),
      })),
    });
  });
}
