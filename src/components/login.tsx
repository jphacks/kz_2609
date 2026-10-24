"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Card, Field, Notice, PageHeader, inputClass } from "@/components/ui";
import { DEV_LOGIN_ENABLED } from "@/lib/env";
import { getBrowserSupabase } from "@/lib/supabase/client";

// ログイン後の戻り先は、このサイト内のパスだけ受け付ける
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

// ローカルのテストユーザーでのログイン（NEXT_PUBLIC_ENABLE_DEV_LOGIN=true のときだけ）
function DevLogin({ next, onError }: { next: string; onError: (message: string | null) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setBusy(true);
    onError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      onError("テストユーザーでログインできませんでした");
      setBusy(false);
      return;
    }
    window.location.href = next;
  };

  return (
    <Card className="mt-4 p-5">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-sm font-medium">開発用ログイン（ローカルのテストユーザー）</p>
        <Field label="メールアドレス">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} autoComplete="username" />
        </Field>
        <Field label="パスワード">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            autoComplete="current-password"
          />
        </Field>
        <Button type="submit" variant="secondary" loading={busy}>
          テストユーザーでログイン
        </Button>
      </form>
    </Card>
  );
}

// S-13 ログイン（F-6-1：Googleログインのみ）
export function Login() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState<string | null>(params.get("error") ? "ログインに失敗しました。もう一度試してください" : null);
  const [busy, setBusy] = useState(false);
  const supabase = getBrowserSupabase();

  const google = async () => {
    if (!supabase) return;
    setBusy(true);
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (e) {
      setError("ログインを開始できませんでした。設定を確認してください");
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
          投稿・いいね・行きたい場所リスト・経路作成にはログインが必要です。地図とスポットはログインしなくても見られます。
        </p>
        <Button icon={LogIn} onClick={google} loading={busy} disabled={!supabase}>
          Googleでログイン
        </Button>
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

      {DEV_LOGIN_ENABLED && supabase && <DevLogin next={next} onError={setError} />}
    </div>
  );
}
