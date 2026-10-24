import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { afterSignInPath, safeNext } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";

// 確認メールのリンクの受け口（F-6-1・ADR-0021）。
// token_hash 方式なので、登録した端末と別の端末でリンクを開いても確認できる。
// Supabase の「Confirm signup」のメール文面で、リンク先をこのURLにしておく
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(url.searchParams.get("next"));

  if (tokenHash && type) {
    const supabase = await getServerSupabase();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error && data.user) {
      return NextResponse.redirect(new URL(await afterSignInPath(supabase, data.user.id, next), url.origin));
    }
  }
  return NextResponse.redirect(new URL("/login?error=confirm", url.origin));
}
