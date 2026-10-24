import { z } from "zod";
import { ApiError, dbError, handle, parseJson, requireUser } from "@/lib/api";
import { MAX_LIST_ITEMS } from "@/lib/constants";
import { loadList } from "@/lib/lists";

// F-4-2・F-4-3：リストにスポットを追加（最大30。重複は409）
export async function POST(request: Request, ctx: RouteContext<"/api/v1/lists/[listId]/items">) {
  return handle(async () => {
    const { listId } = await ctx.params;
    const { supabase } = await requireUser();
    const list = await loadList(supabase, listId);
    const body = await parseJson(request, z.object({ spotId: z.string().uuid() }));
    if (list.spots.some((s) => s.id === body.spotId)) throw new ApiError("CONFLICT", "追加済みです");
    if (list.spots.length >= MAX_LIST_ITEMS) {
      throw new ApiError("VALIDATION_ERROR", `1つのリストに入れられるのは${MAX_LIST_ITEMS}か所までです`);
    }
    const { data: spot } = await supabase.from("spots").select("id").eq("id", body.spotId).maybeSingle();
    if (!spot) throw new ApiError("NOT_FOUND", "このスポットは見つかりませんでした");
    const { error } = await supabase.from("wishlist_items").insert({ wishlist_id: listId, spot_id: body.spotId });
    dbError(error, "リストへの追加に失敗しました");
    return Response.json({ ok: true }, { status: 201 });
  });
}
