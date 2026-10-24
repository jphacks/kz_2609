import { dbError, handle, requireUser } from "@/lib/api";
import { publicImageUrl } from "@/lib/storage";

// F-6-3：自分の投稿一覧
export async function GET() {
  return handle(async () => {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase
      .from("posts")
      .select("id,spot_id,comment,category,like_count,status,created_at,spots(name),post_images(thumb_path,sort_order)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    dbError(error);
    return Response.json({
      posts: (data ?? []).map((p) => {
        const spot = p.spots as unknown as { name: string } | null;
        const first = [...(p.post_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
        return {
          id: p.id,
          spotId: p.spot_id,
          spotName: spot?.name ?? "",
          comment: p.comment,
          category: p.category,
          likeCount: p.like_count,
          hidden: p.status === "hidden",
          createdAt: p.created_at,
          thumbUrl: publicImageUrl(first?.thumb_path),
        };
      }),
    });
  });
}
