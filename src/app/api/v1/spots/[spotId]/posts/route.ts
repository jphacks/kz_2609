import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, getUser, handle, parseWith } from "@/lib/api";
import { isSupabaseConfigured } from "@/lib/env";
import { publicImageUrl } from "@/lib/storage";

const PAGE = 20;

type Author = { display_name: string; avatar_url: string | null } | null;

// F-3-2：スポットの投稿一覧（新着順・20件ずつ）
export async function GET(request: NextRequest, ctx: RouteContext<"/api/v1/spots/[spotId]/posts">) {
  if (!isSupabaseConfigured()) return Response.json({ posts: [], nextCursor: null, demo: true });
  return handle(async () => {
    const { spotId } = await ctx.params;
    parseWith(z.string().uuid(), spotId);
    const cursor = request.nextUrl.searchParams.get("cursor");
    const { supabase, user } = await getUser();

    let query = supabase
      .from("posts")
      .select(
        // posts と profiles は likes・reports 経由でもつながるため、投稿者の外部キーを名前で指定する
        "id,user_id,comment,category,stay_duration,like_count,created_at,author:profiles!posts_user_id_fkey(display_name,avatar_url),post_images(id,full_path,thumb_path,width,height,sort_order)",
      )
      .eq("spot_id", spotId)
      .eq("status", "public")
      .order("created_at", { ascending: false })
      .limit(PAGE + 1);
    if (cursor) query = query.lt("created_at", cursor);
    const { data, error } = await query;
    dbError(error);

    const rows = data ?? [];
    const page = rows.slice(0, PAGE);
    let liked = new Set<string>();
    if (user && page.length > 0) {
      const { data: likes } = await supabase
        .from("likes")
        .select("post_id")
        .eq("user_id", user.id)
        .in(
          "post_id",
          page.map((p) => p.id),
        );
      liked = new Set((likes ?? []).map((l) => l.post_id));
    }

    return Response.json({
      posts: page.map((p) => {
        const author = p.author as unknown as Author;
        return {
          id: p.id,
          comment: p.comment,
          category: p.category,
          stayDuration: p.stay_duration,
          likeCount: p.like_count,
          likedByMe: liked.has(p.id),
          mine: user?.id === p.user_id,
          createdAt: p.created_at,
          author: { displayName: author?.display_name ?? "退会したユーザー", avatarUrl: author?.avatar_url ?? null },
          images: [...(p.post_images ?? [])]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((i) => ({
              id: i.id,
              url: publicImageUrl(i.full_path),
              thumbUrl: publicImageUrl(i.thumb_path),
              width: i.width,
              height: i.height,
            })),
        };
      }),
      nextCursor: rows.length > PAGE ? page[page.length - 1].created_at : null,
    });
  });
}
