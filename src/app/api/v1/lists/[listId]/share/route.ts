import { dbError, handle, requireUser } from "@/lib/api";
import { loadList } from "@/lib/lists";
import { newShareToken } from "@/lib/share-token";

// F-4-6：共有URLを発行する（すでに発行済みなら同じURLを返す）。本人のリストだけ（RLS でも守る）
export async function POST(_req: Request, ctx: RouteContext<"/api/v1/lists/[listId]/share">) {
  return handle(async () => {
    const { listId } = await ctx.params;
    const { supabase } = await requireUser();
    const list = await loadList(supabase, listId);
    if (list.shareToken) return Response.json({ shareToken: list.shareToken });
    const shareToken = newShareToken();
    const { error } = await supabase.from("wishlists").update({ share_token: shareToken }).eq("id", listId);
    dbError(error, "共有URLの発行に失敗しました");
    return Response.json({ shareToken });
  });
}

// F-4-6：共有を停止する。以前のURLは見られなくなり、もう一度発行すると別のURLになる
export async function DELETE(_req: Request, ctx: RouteContext<"/api/v1/lists/[listId]/share">) {
  return handle(async () => {
    const { listId } = await ctx.params;
    const { supabase } = await requireUser();
    await loadList(supabase, listId);
    const { error } = await supabase.from("wishlists").update({ share_token: null }).eq("id", listId);
    dbError(error, "共有の停止に失敗しました");
    return Response.json({ ok: true });
  });
}
