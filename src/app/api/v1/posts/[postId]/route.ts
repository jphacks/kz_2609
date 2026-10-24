import { z } from "zod";
import { ApiError, dbError, handle, parseJson, parseWith, requireUser } from "@/lib/api";
import { STORAGE_BUCKET } from "@/lib/constants";
import { publicImageUrl } from "@/lib/storage";
import { getAdminSupabase } from "@/lib/supabase/server";
import { updatePostSchema } from "@/lib/validation";

async function loadOwnPost(postId: string) {
  parseWith(z.string().uuid(), postId);
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("posts")
    .select("id,user_id,spot_id,comment,category,stay_duration,spots(name),post_images(id,full_path,thumb_path,sort_order)")
    .eq("id", postId)
    .maybeSingle();
  dbError(error);
  if (!data) throw new ApiError("NOT_FOUND", "投稿が見つかりませんでした");
  if (data.user_id !== user.id) throw new ApiError("FORBIDDEN", "自分の投稿だけ編集できます");
  return { supabase, post: data };
}

// S-05 用：自分の投稿を取得
export async function GET(_req: Request, ctx: RouteContext<"/api/v1/posts/[postId]">) {
  return handle(async () => {
    const { postId } = await ctx.params;
    const { post } = await loadOwnPost(postId);
    const spot = post.spots as unknown as { name: string } | null;
    return Response.json({
      id: post.id,
      spotId: post.spot_id,
      spotName: spot?.name ?? "",
      comment: post.comment,
      category: post.category,
      stayDuration: post.stay_duration,
      images: [...(post.post_images ?? [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((i) => ({ id: i.id, thumbUrl: publicImageUrl(i.thumb_path) })),
    });
  });
}

// F-2-12：投稿の編集（コメント・カテゴリ・滞在時間）
export async function PATCH(request: Request, ctx: RouteContext<"/api/v1/posts/[postId]">) {
  return handle(async () => {
    const { postId } = await ctx.params;
    const { supabase } = await loadOwnPost(postId);
    const body = await parseJson(request, updatePostSchema);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.comment !== undefined) patch.comment = body.comment;
    if (body.category !== undefined) patch.category = body.category;
    if (body.stayDuration !== undefined) patch.stay_duration = body.stayDuration;
    const { error } = await supabase.from("posts").update(patch).eq("id", postId);
    dbError(error, "投稿の更新に失敗しました");
    return Response.json({ ok: true });
  });
}

// F-2-12：投稿の削除（写真も消す）
export async function DELETE(_req: Request, ctx: RouteContext<"/api/v1/posts/[postId]">) {
  return handle(async () => {
    const { postId } = await ctx.params;
    const { supabase, post } = await loadOwnPost(postId);
    const paths = (post.post_images ?? []).flatMap((i) => [i.full_path, i.thumb_path]);
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    dbError(error, "投稿の削除に失敗しました");
    if (paths.length > 0) {
      const { error: rmError } = await getAdminSupabase().storage.from(STORAGE_BUCKET).remove(paths);
      if (rmError) console.error("storage remove failed", rmError);
    }
    return Response.json({ ok: true });
  });
}
