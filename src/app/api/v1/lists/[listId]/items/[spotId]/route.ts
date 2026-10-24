import { z } from "zod";
import { dbError, handle, parseJson, parseWith, requireUser } from "@/lib/api";
import { loadList } from "@/lib/lists";

// F-4-4：必ず行きたいの切り替え
export async function PATCH(request: Request, ctx: RouteContext<"/api/v1/lists/[listId]/items/[spotId]">) {
  return handle(async () => {
    const { listId, spotId } = await ctx.params;
    parseWith(z.string().uuid(), spotId);
    const { supabase } = await requireUser();
    await loadList(supabase, listId);
    const body = await parseJson(request, z.object({ mustVisit: z.boolean() }));
    const { error } = await supabase
      .from("wishlist_items")
      .update({ must_visit: body.mustVisit })
      .eq("wishlist_id", listId)
      .eq("spot_id", spotId);
    dbError(error, "更新に失敗しました");
    return Response.json({ ok: true });
  });
}

// リストからスポットを外す
export async function DELETE(_req: Request, ctx: RouteContext<"/api/v1/lists/[listId]/items/[spotId]">) {
  return handle(async () => {
    const { listId, spotId } = await ctx.params;
    parseWith(z.string().uuid(), spotId);
    const { supabase } = await requireUser();
    await loadList(supabase, listId);
    const { error } = await supabase.from("wishlist_items").delete().eq("wishlist_id", listId).eq("spot_id", spotId);
    dbError(error, "削除に失敗しました");
    return Response.json({ ok: true });
  });
}
