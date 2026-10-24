import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { dbError, handle, parseWith, rateLimit, requireUser } from "@/lib/api";

async function likeCount(supabase: SupabaseClient, postId: string) {
  const { data } = await supabase.from("posts").select("like_count").eq("id", postId).maybeSingle();
  return data?.like_count ?? 0;
}

// F-3-3：いいね
export async function PUT(_req: Request, ctx: RouteContext<"/api/v1/posts/[postId]/like">) {
  return handle(async () => {
    const { postId } = await ctx.params;
    parseWith(z.string().uuid(), postId);
    const { supabase, user } = await requireUser();
    rateLimit(`like:${user.id}`, 30, 60_000);
    const { error } = await supabase
      .from("likes")
      .upsert({ user_id: user.id, post_id: postId }, { onConflict: "user_id,post_id", ignoreDuplicates: true });
    dbError(error, "いいねに失敗しました");
    return Response.json({ liked: true, likeCount: await likeCount(supabase, postId) });
  });
}

// F-3-3：いいね取り消し
export async function DELETE(_req: Request, ctx: RouteContext<"/api/v1/posts/[postId]/like">) {
  return handle(async () => {
    const { postId } = await ctx.params;
    parseWith(z.string().uuid(), postId);
    const { supabase, user } = await requireUser();
    const { error } = await supabase.from("likes").delete().eq("user_id", user.id).eq("post_id", postId);
    dbError(error, "いいねの取り消しに失敗しました");
    return Response.json({ liked: false, likeCount: await likeCount(supabase, postId) });
  });
}
