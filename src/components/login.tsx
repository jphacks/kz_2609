"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Card, Notice, PageHeader } from "@/components/ui";
import { getBrowserSupabase } from "@/lib/supabase/client";

// ログイン後の戻り先は、このサイト内のパスだけ受け付ける
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

const URL_ERRORS: Record<string, string> = {
  "1": "ログインに失敗しました。もう一度試してください",
};

// Google のロゴ（Google のブランドガイドラインに沿ったログインボタンのため、ここだけ Lucide 以外を使う。ADR-0024）
function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

// S-14 ログイン（F-6-1：Google アカウントだけでログイン・新規登録する。ADR-0024）
export function Login() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const supabase = getBrowserSupabase();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(URL_ERRORS[params.get("error") ?? ""] ?? null);

  const google = async () => {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (e) {
      setError("ログインを開始できませんでした。時間をおいてもう一度試してください");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-8">
      <PageHeader title="ログイン" backHref="/" />
      {!supabase && (
        <Notice tone="warning" className="mb-3">
          Supabase が設定されていません（docs/セットアップ手順.md）
        </Notice>
      )}
      {error && (
        <Notice tone="error" className="mb-3">
          {error}
        </Notice>
      )}

      <Card className="flex flex-col gap-4 p-5">
        <p className="text-sm">
          ログイン・新規登録は <span className="font-bold">Google アカウント</span>で行います。はじめての方も、下のボタンからそのまま登録できます。
        </p>
        <button
          type="button"
          onClick={google}
          disabled={!supabase || busy}
          className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full border border-border bg-surface px-5 font-medium shadow-sm hover:bg-surface-muted disabled:opacity-50"
        >
          <GoogleLogo />
          {busy ? "Google に移動しています…" : "Google でログイン"}
        </button>
        <p className="text-sm text-muted">
          投稿・いいね・行きたい場所リスト・経路作成にはログインが必要です。地図とスポットはログインしなくても見られます。
        </p>
        <p className="text-xs text-muted">
          ログインすると
          <Link href="/terms" className="underline">
            利用規約
          </Link>
          と
          <Link href="/privacy" className="underline">
            プライバシーポリシー
          </Link>
          に同意したものとみなします。
        </p>
      </Card>
    </div>
  );
}
