import { ApiError, dbError, handle, parseJson, requireUser } from "@/lib/api";
import { loadList } from "@/lib/lists";
import { savePlanSchema } from "@/lib/validation";

// F-5-11：選んだ経路案を経路プランとして保存
export async function POST(request: Request) {
  return handle(async () => {
    const { supabase, user } = await requireUser();
    const body = await parseJson(request, savePlanSchema);
    const list = await loadList(supabase, body.listId);
    const inList = new Set(list.spots.map((s) => s.id));
    if (body.candidate.order.some((id) => !inList.has(id))) {
      throw new ApiError("VALIDATION_ERROR", "リストにないスポットが含まれています");
    }
    const { data, error } = await supabase
      .from("plans")
      .insert({
        wishlist_id: body.listId,
        user_id: user.id,
        method: body.method,
        params: body.params,
        result: { ...body.candidate, spots: body.spots },
        total_travel_min: Math.round(body.candidate.stats.totalTravelMin),
      })
      .select("id")
      .single();
    dbError(error, "経路プランの保存に失敗しました");
    return Response.json({ id: data!.id }, { status: 201 });
  });
}
