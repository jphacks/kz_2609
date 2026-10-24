import { NextResponse, type NextRequest } from "next/server";
import { afterSignInPath, safeNext } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";

// Googleログインの戻り先。認可コードをセッションに交換し、元の画面へ戻す
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (code) {
    const supabase = await getServerSupabase();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      return NextResponse.redirect(new URL(await afterSignInPath(supabase, data.user.id, next), url.origin));
    }
  }
  return NextResponse.redirect(new URL("/login?error=1", url.origin));
}
