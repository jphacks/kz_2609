import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// ログイン後の戻り先は、このサイト内のパスだけ受け付ける
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

// ログイン・メール確認のあとの移動先。初回は表示名の確認（F-6-2）へ
export async function afterSignInPath(supabase: SupabaseClient, userId: string, next: string): Promise<string> {
  const { data: profile } = await supabase.from("profiles").select("onboarded").eq("id", userId).maybeSingle();
  return profile?.onboarded ? next : `/welcome?next=${encodeURIComponent(next)}`;
}
