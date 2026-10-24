import type { NextRequest } from "next/server";
import { ApiError, dbError, handle } from "@/lib/api";
import { CATEGORIES } from "@/lib/constants";
import { DEMO_SPOTS, demoPopularity } from "@/lib/demo";
import { seedPhotosOf } from "@/lib/photo-credits";
import { isSupabaseConfigured } from "@/lib/env";
import { tileToBBox } from "@/lib/geo";
import { publicImageUrl } from "@/lib/storage";
import { getAdminSupabase } from "@/lib/supabase/server";

type Row = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  post_count: number;
  like_count: number;
  popularity: string;
  cover_thumb_path: string | null;
};

// Supabase 未接続のときはデモデータを返す（画面の確認用）
function demoResponse(z: number, x: number, y: number) {
  const bbox = tileToBBox(z, x, y);
  const inside = DEMO_SPOTS.filter(
    (s) => s.lng >= bbox.minLng && s.lng <= bbox.maxLng && s.lat >= bbox.minLat && s.lat <= bbox.maxLat,
  );
  return Response.json({
    mode: "spots",
    demo: true,
    spots: inside.map((s) => ({
      id: s.id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      category: s.category,
      postCount: s.postCount,
      likeCount: 0,
      popularity: demoPopularity(s),
      coverThumbUrl: seedPhotosOf(s.name)[0] ? `/${seedPhotosOf(s.name)[0].thumb}` : null,
    })),
  });
}

// F-1-2：区画（タイル）内のスポット。z5（日本全体）・z9・z13 のどれもスポットを返し、画面側で写真の束にまとめる
export async function GET(request: NextRequest, ctx: RouteContext<"/api/v1/spots/tiles/[z]/[x]/[y]">) {
  const { z, x, y } = await ctx.params;
  const zi = Number(z);
  const xi = Number(x);
  const yi = Number(y);
  if (!isSupabaseConfigured()) return demoResponse(zi, xi, yi);
  return handle(async () => {
    if (![5, 9, 13].includes(zi) || !Number.isInteger(xi) || !Number.isInteger(yi) || xi < 0 || yi < 0) {
      throw new ApiError("VALIDATION_ERROR", "区画の指定が正しくありません");
    }
    const categoryParam = request.nextUrl.searchParams.get("category");
    const categories = categoryParam
      ? categoryParam.split(",").filter((c) => (CATEGORIES as readonly string[]).includes(c))
      : null;

    const bbox = tileToBBox(zi, xi, yi);
    const { data, error } = await getAdminSupabase().rpc("spots_in_bbox", {
      p_min_lng: bbox.minLng,
      p_min_lat: bbox.minLat,
      p_max_lng: bbox.maxLng,
      p_max_lat: bbox.maxLat,
      p_categories: categories && categories.length > 0 ? categories : null,
      p_limit: zi === 5 ? 1000 : 500,
    });
    dbError(error);
    const rows = (data ?? []) as Row[];

    const headers = { "Cache-Control": "public, max-age=60" };
    return Response.json(
      {
        mode: "spots",
        spots: rows.map((r) => ({
          id: r.id,
          name: r.name,
          lat: r.lat,
          lng: r.lng,
          category: r.category,
          postCount: r.post_count,
          likeCount: r.like_count,
          popularity: r.popularity,
          coverThumbUrl: publicImageUrl(r.cover_thumb_path),
        })),
      },
      { headers },
    );
  });
}
