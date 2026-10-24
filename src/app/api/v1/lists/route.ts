import { z } from "zod";
import { ApiError, dbError, handle, parseJson, requireUser } from "@/lib/api";
import { MAX_LISTS } from "@/lib/constants";
import { publicImageUrl } from "@/lib/storage";
import { listNameSchema } from "@/lib/validation";

type ItemRow = { spot_id: string; spots: { cover: { thumb_path: string } | null } | null };

// F-4：リスト一覧（スポット数と代表写真付き）
export async function GET() {
  return handle(async () => {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase
      .from("wishlists")
      .select("id,name,base_label,created_at,wishlist_items(spot_id,spots(cover:post_images!spots_cover_image_fk(thumb_path)))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    dbError(error);
    return Response.json({
      lists: (data ?? []).map((l) => {
        const items = (l.wishlist_items ?? []) as unknown as ItemRow[];
        return {
          id: l.id,
          name: l.name,
          baseLabel: l.base_label,
          spotCount: items.length,
          spotIds: items.map((i) => i.spot_id),
          thumbUrls: items
            .map((i) => publicImageUrl(i.spots?.cover?.thumb_path))
            .filter(Boolean)
            .slice(0, 3),
        };
      }),
    });
  });
}

// F-4-1：リスト作成（1ユーザー最大20リスト）
export async function POST(request: Request) {
  return handle(async () => {
    const { supabase, user } = await requireUser();
    const body = await parseJson(request, z.object({ name: listNameSchema }));
    const { count } = await supabase
      .from("wishlists")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count ?? 0) >= MAX_LISTS) throw new ApiError("VALIDATION_ERROR", `リストは${MAX_LISTS}個までです`);
    const { data, error } = await supabase
      .from("wishlists")
      .insert({ user_id: user.id, name: body.name })
      .select("id,name")
      .single();
    dbError(error, "リストの作成に失敗しました");
    return Response.json(data, { status: 201 });
  });
}
