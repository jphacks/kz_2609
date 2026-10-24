import { ApiError, handle, parseJson, rateLimit, requireUser } from "@/lib/api";
import { STORAGE_BUCKET } from "@/lib/constants";
import { getAdminSupabase } from "@/lib/supabase/server";
import { uploadRequestSchema } from "@/lib/validation";

// F-2-4：写真アップロード用の署名付きURL。一時フォルダに置き、投稿作成時に本来の場所へ移す
export async function POST(request: Request) {
  return handle(async () => {
    const { user } = await requireUser();
    rateLimit(`uploads:${user.id}`, 10, 60_000);
    const body = await parseJson(request, uploadRequestSchema);
    const admin = getAdminSupabase();

    const { data: flag } = await admin.from("system_flags").select("value").eq("key", "posting_suspended").maybeSingle();
    if (flag?.value) {
      throw new ApiError("FEATURE_SUSPENDED", "現在、新しい投稿を受け付けていません", { feature: "posting" });
    }

    const uploads = [];
    for (const file of body.files) {
      const ext = file.contentType === "image/webp" ? "webp" : "jpg";
      const path = `posts/tmp/${user.id}/${crypto.randomUUID()}${file.kind === "thumb" ? "_t" : ""}.${ext}`;
      const { data, error } = await admin.storage.from(STORAGE_BUCKET).createSignedUploadUrl(path);
      if (error || !data) throw new ApiError("INTERNAL_ERROR", "アップロードの準備に失敗しました");
      uploads.push({ kind: file.kind, path: data.path, token: data.token, signedUrl: data.signedUrl });
    }
    return Response.json({ uploads });
  });
}
