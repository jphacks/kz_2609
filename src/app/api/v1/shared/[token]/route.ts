import { ApiError, handle } from "@/lib/api";
import { loadSharedList } from "@/lib/lists";
import { isShareToken } from "@/lib/share-token";
import { getAdminSupabase } from "@/lib/supabase/server";

// F-4-6：共有URLで開いたリスト（ログイン不要・閲覧のみ。変更する API はない）
export async function GET(_req: Request, ctx: RouteContext<"/api/v1/shared/[token]">) {
  return handle(async () => {
    const { token } = await ctx.params;
    if (!isShareToken(token)) throw new ApiError("NOT_FOUND", "このリストは共有されていないか、共有が停止されました");
    const list = await loadSharedList(getAdminSupabase(), token);
    return Response.json(list, { headers: { "Cache-Control": "private, no-store" } });
  });
}
