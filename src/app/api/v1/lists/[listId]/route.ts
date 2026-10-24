import { dbError, handle, parseJson, requireUser } from "@/lib/api";
import { loadList } from "@/lib/lists";
import { updateListSchema } from "@/lib/validation";

// F-4：リスト詳細（スポット・拠点・保存済みプラン）
export async function GET(_req: Request, ctx: RouteContext<"/api/v1/lists/[listId]">) {
  return handle(async () => {
    const { listId } = await ctx.params;
    const { supabase } = await requireUser();
    const list = await loadList(supabase, listId);
    const { data: plans } = await supabase
      .from("plans")
      .select("id,method,result,total_travel_min,created_at")
      .eq("wishlist_id", listId)
      .order("created_at", { ascending: false });
    return Response.json({
      ...list,
      plans: (plans ?? []).map((p) => {
        const r = p.result as { label?: string; stats?: { spotCount?: number } };
        return {
          id: p.id,
          label: r.label ?? "経路プラン",
          spotCount: r.stats?.spotCount ?? 0,
          totalTravelMin: p.total_travel_min,
          createdAt: p.created_at,
        };
      }),
    });
  });
}

// F-4-1・F-4-8：リスト名・拠点の変更
export async function PATCH(request: Request, ctx: RouteContext<"/api/v1/lists/[listId]">) {
  return handle(async () => {
    const { listId } = await ctx.params;
    const { supabase } = await requireUser();
    await loadList(supabase, listId);
    const body = await parseJson(request, updateListSchema);
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.base !== undefined) {
      patch.base_label = body.base?.label ?? null;
      patch.base_lat = body.base?.lat ?? null;
      patch.base_lng = body.base?.lng ?? null;
    }
    const { error } = await supabase.from("wishlists").update(patch).eq("id", listId);
    dbError(error, "リストの更新に失敗しました");
    return Response.json({ ok: true });
  });
}

// F-4-1：リスト削除（中のスポット・経路プランも消える）
export async function DELETE(_req: Request, ctx: RouteContext<"/api/v1/lists/[listId]">) {
  return handle(async () => {
    const { listId } = await ctx.params;
    const { supabase } = await requireUser();
    await loadList(supabase, listId);
    const { error } = await supabase.from("wishlists").delete().eq("id", listId);
    dbError(error, "リストの削除に失敗しました");
    return Response.json({ ok: true });
  });
}
