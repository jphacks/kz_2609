import { dbError, getUser, handle, parseJson, requireUser } from "@/lib/api";
import { STORAGE_BUCKET } from "@/lib/constants";
import { getAdminSupabase } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/validation";

// F-6：自分のプロフィール（未ログインなら user: null）
export async function GET() {
  return handle(async () => {
    const { supabase, user } = await getUser();
    if (!user) return Response.json({ user: null });
    const { data, error } = await supabase
      .from("profiles")
      .select("id,display_name,avatar_url,onboarded")
      .eq("id", user.id)
      .maybeSingle();
    dbError(error);
    return Response.json({
      user: {
        id: user.id,
        displayName: data?.display_name ?? "",
        avatarUrl: data?.avatar_url ?? null,
        onboarded: data?.onboarded ?? false,
      },
    });
  });
}

// F-6-2・F-6-3：表示名の変更（初回プロフィール設定を含む）
export async function PATCH(request: Request) {
  return handle(async () => {
    const { supabase, user } = await requireUser();
    const body = await parseJson(request, profileSchema);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: body.displayName, onboarded: true })
      .eq("id", user.id);
    dbError(error, "プロフィールの更新に失敗しました");
    return Response.json({ ok: true });
  });
}

// F-6-4：退会。投稿・いいね・リスト・経路プラン・写真を削除する
export async function DELETE() {
  return handle(async () => {
    const { supabase, user } = await requireUser();
    const admin = getAdminSupabase();
    const { data: posts } = await admin.from("posts").select("post_images(full_path,thumb_path)").eq("user_id", user.id);
    const paths = (posts ?? []).flatMap((p) =>
      ((p.post_images ?? []) as Array<{ full_path: string; thumb_path: string }>).flatMap((i) => [i.full_path, i.thumb_path]),
    );
    if (paths.length > 0) {
      const { error } = await admin.storage.from(STORAGE_BUCKET).remove(paths);
      if (error) console.error("storage remove failed", error);
    }
    // auth.users を消すと、profiles 以下は外部キーの cascade でまとめて消える
    const { error } = await admin.auth.admin.deleteUser(user.id);
    dbError(error ? { message: error.message } : null, "退会に失敗しました");
    await supabase.auth.signOut();
    return Response.json({ ok: true });
  });
}
