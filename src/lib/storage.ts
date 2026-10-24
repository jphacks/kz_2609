import { STORAGE_BUCKET } from "@/lib/constants";
import { SUPABASE_URL } from "@/lib/env";

// Storage の公開URL（バケットは公開読み取り。10.4）
// 初期データの写真（"seed/..."）は Storage ではなく、アプリの public/ に置いたものを使う（src/lib/photo-credits.ts）
export function publicImageUrl(path: string | null | undefined): string | null {
  if (path?.startsWith("seed/")) return `/${path}`;
  if (!path || !SUPABASE_URL) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
}
