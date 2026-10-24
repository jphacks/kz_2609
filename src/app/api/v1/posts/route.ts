import { ApiError, dbError, handle, parseJson, rateLimit, requireUser } from "@/lib/api";
import { GPS_MAX_ACCURACY_M, SAME_SPOT_RADIUS_M, STORAGE_BUCKET } from "@/lib/constants";
import { reverseGeocode } from "@/lib/external/nominatim";
import { getAdminSupabase } from "@/lib/supabase/server";
import { createPostSchema } from "@/lib/validation";

const normalize = (s: string) => s.normalize("NFKC").replace(/\s+/g, "").toLowerCase();

// F-2：投稿作成（新規スポットの作成を含む）
export async function POST(request: Request) {
  return handle(async () => {
    const { supabase, user } = await requireUser();
    rateLimit(`posts:${user.id}`, 5, 60_000);
    const body = await parseJson(request, createPostSchema);
    const admin = getAdminSupabase();

    const { data: flag } = await admin.from("system_flags").select("value").eq("key", "posting_suspended").maybeSingle();
    if (flag?.value) {
      throw new ApiError("FEATURE_SUSPENDED", "現在、新しい投稿を受け付けていません", { feature: "posting" });
    }

    // 写真は本人の一時フォルダにあるものだけ受け付ける
    const tmpPrefix = `posts/tmp/${user.id}/`;
    for (const img of body.images) {
      if (!img.fullPath.startsWith(tmpPrefix) || !img.thumbPath.startsWith(tmpPrefix)) {
        throw new ApiError("FORBIDDEN", "写真の指定が正しくありません");
      }
    }

    // スポットを決める
    let spotId = body.spotId;
    if (spotId) {
      const { data } = await admin.from("spots").select("id").eq("id", spotId).maybeSingle();
      if (!data) throw new ApiError("NOT_FOUND", "このスポットは見つかりませんでした");
    } else if (body.newSpot) {
      const ns = body.newSpot;
      if (ns.source === "gps" && (ns.accuracyM ?? Number.POSITIVE_INFINITY) >= GPS_MAX_ACCURACY_M) {
        throw new ApiError("VALIDATION_ERROR", "位置の誤差が大きいため、候補から選んでください");
      }
      // 半径50m以内に同じ名前のスポットがあれば、それを使ってもらう
      const { data: near } = await admin.rpc("spots_nearby", { p_lat: ns.lat, p_lng: ns.lng, p_radius_m: SAME_SPOT_RADIUS_M });
      const same = ((near ?? []) as Array<{ id: string; name: string }>).filter((s) => normalize(s.name) === normalize(ns.name));
      if (same.length > 0) {
        throw new ApiError("CONFLICT", "近くに同じ名前のスポットがあります。そちらを選んでください", {
          candidates: same.map((s) => ({ id: s.id, name: s.name })),
        });
      }
      const addr =
        ns.source === "gps"
          ? await reverseGeocode(ns.lat, ns.lng)
          : { address: ns.address ?? null, prefecture: ns.prefecture ?? null, city: ns.city ?? null };
      const { data: created, error } = await admin
        .from("spots")
        .insert({
          name: ns.name,
          lat: ns.lat,
          lng: ns.lng,
          address: addr?.address ?? null,
          prefecture: addr?.prefecture ?? null,
          city: addr?.city ?? null,
          category: body.category,
          source: ns.source,
          external_ref: ns.externalRef ?? null,
          created_by: user.id,
        })
        .select("id")
        .single();
      dbError(error, "スポットの登録に失敗しました");
      spotId = created!.id as string;
    }

    // 投稿を作る（RLS で本人の投稿としてのみ作れる）
    const { data: post, error: postError } = await supabase
      .from("posts")
      .insert({
        user_id: user.id,
        spot_id: spotId,
        comment: body.comment,
        category: body.category,
        stay_duration: body.stayDuration,
      })
      .select("id")
      .single();
    dbError(postError, "投稿に失敗しました");
    const postId = post!.id as string;

    // 一時フォルダの写真を posts/{postId}/ へ移す。失敗したら投稿ごと取り消す
    try {
      const storage = admin.storage.from(STORAGE_BUCKET);
      const rows = [];
      for (const [i, img] of body.images.entries()) {
        const imageId = crypto.randomUUID();
        const ext = img.fullPath.endsWith(".webp") ? "webp" : "jpg";
        const fullPath = `posts/${postId}/${imageId}.${ext}`;
        const thumbPath = `posts/${postId}/${imageId}_t.${ext}`;
        const m1 = await storage.move(img.fullPath, fullPath);
        const m2 = await storage.move(img.thumbPath, thumbPath);
        if (m1.error || m2.error) throw new Error(m1.error?.message ?? m2.error?.message);
        rows.push({
          id: imageId,
          post_id: postId,
          full_path: fullPath,
          thumb_path: thumbPath,
          width: img.width,
          height: img.height,
          sort_order: i,
        });
      }
      const { error } = await supabase.from("post_images").insert(rows);
      if (error) throw new Error(error.message);
    } catch (e) {
      console.error(e);
      await admin.from("posts").delete().eq("id", postId);
      throw new ApiError("INTERNAL_ERROR", "写真の保存に失敗しました。もう一度試してください");
    }

    return Response.json({ postId, spotId }, { status: 201 });
  });
}
