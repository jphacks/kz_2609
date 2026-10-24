"use client";

import { LogIn, MailCheck, RefreshCw, UserPlus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Card, Chip, Field, Notice, PageHeader, inputClass } from "@/components/ui";
import { PASSWORD_MIN } from "@/lib/constants";
import { GOOGLE_LOGIN_ENABLED } from "@/lib/env";
import { getBrowserSupabase } from "@/lib/supabase/client";

type Mode = "login" | "signup";

// ログイン後の戻り先は、このサイト内のパスだけ受け付ける
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

const URL_ERRORS: Record<string, string> = {
  "1": "ログインに失敗しました。もう一度試してください",
  confirm: "確認リンクが無効か、期限切れです。ログインして確認メールを送り直してください",
};

// Supabase Auth のエラーを画面の文言にする
function authMessage(code: string | undefined, fallback: string) {
  switch (code) {
    case "invalid_credentials":
      return "メールアドレスかパスワードが違います";
    case "email_not_confirmed":
      return "メールアドレスの確認がまだです。届いたメールのリンクを開いてください";
    case "user_already_exists":
      return "このメールアドレスはすでに登録されています。ログインしてください";
    case "weak_password":
      return `パスワードは${PASSWORD_MIN}文字以上にしてください`;
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "操作が集中しています。少し待ってから試してください";
    default:
      return fallback;
  }
}

// S-13 ログイン（F-6-1：メールアドレス＋パスワード。確認メールあり。ADR-0021）
export function Login() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const supabase = getBrowserSupabase();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(URL_ERRORS[params.get("error") ?? ""] ?? null);
  // 確認メールを送ったアドレス（送り直しに使う）
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setSentTo(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setError(null);
    if (mode === "signup" && password !== confirm) {
      setError("確認用のパスワードが一致しません");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) {
          if (err.code === "email_not_confirmed") setSentTo(email);
          setError(authMessage(err.code, "ログインできませんでした。もう一度試してください"));
          return;
        }
        // 初回は表示名の確認へ（OnboardingRedirect）
        window.location.href = next;
        return;
      }
      const { data, error: err } = await supabase.auth.signUp({ email, password });
      if (err) {
        setError(authMessage(err.code, "登録できませんでした。もう一度試してください"));
        return;
      }
      // 確認メールがオフの設定なら、そのままログインした状態になる
      if (data.session) {
        window.location.href = next;
        return;
      }
      // 登録済みのアドレスでは、確認メールは送られず identities が空になる
      if (data.user && data.user.identities?.length === 0) {
        setError(authMessage("user_already_exists", ""));
        return;
      }
      setSentTo(email);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!supabase || !sentTo) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.resend({ type: "signup", email: sentTo });
    setBusy(false);
    if (err) setError(authMessage(err.code, "確認メールを送り直せませんでした"));
    else setResent(true);
  };

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
      <PageHeader title={mode === "login" ? "ログイン" : "新規登録"} backHref="/" />
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

      {mode === "signup" && sentTo && !error ? (
        <Card className="flex flex-col items-center gap-3 p-6 text-center">
          <MailCheck size={32} strokeWidth={2} className="text-primary" aria-hidden />
          <p className="font-bold">確認メールを送りました</p>
          <p className="text-sm">
            {sentTo} に届いたメールのリンクを開くと、登録が完了します。届かないときは迷惑メールのフォルダも確認してください。
          </p>
          <Button variant="secondary" icon={RefreshCw} onClick={resend} loading={busy} disabled={resent}>
            {resent ? "送り直しました" : "確認メールを送り直す"}
          </Button>
          <Button variant="ghost" onClick={() => switchMode("login")}>
            ログイン画面へ
          </Button>
        </Card>
      ) : (
        <Card className="flex flex-col gap-4 p-5">
          <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="ログインか新規登録か">
            <Chip selected={mode === "login"} onClick={() => switchMode("login")} role="tab" aria-selected={mode === "login"} className="justify-center">
              ログイン
            </Chip>
            <Chip selected={mode === "signup"} onClick={() => switchMode("signup")} role="tab" aria-selected={mode === "signup"} className="justify-center">
              新規登録
            </Chip>
          </div>
          <p className="text-sm">
            投稿・いいね・行きたい場所リスト・経路作成にはログインが必要です。地図とスポットはログインしなくても見られます。
          </p>
          <form onSubmit={submit} className="flex flex-col gap-3">
            <Field label="メールアドレス">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                autoComplete="email"
                required
              />
            </Field>
            <Field label="パスワード" hint={mode === "signup" ? `${PASSWORD_MIN}文字以上` : undefined}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={mode === "signup" ? PASSWORD_MIN : undefined}
                required
              />
            </Field>
            {mode === "signup" && (
              <Field label="パスワード（確認用）">
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={inputClass}
                  autoComplete="new-password"
                  minLength={PASSWORD_MIN}
                  required
                />
              </Field>
            )}
            <Button type="submit" icon={mode === "login" ? LogIn : UserPlus} loading={busy} disabled={!supabase}>
              {mode === "login" ? "ログイン" : "登録して確認メールを受け取る"}
            </Button>
          </form>
          {mode === "login" && sentTo && (
            <Button variant="secondary" icon={RefreshCw} onClick={resend} loading={busy} disabled={resent}>
              {resent ? "確認メールを送り直しました" : "確認メールを送り直す"}
            </Button>
          )}
          {GOOGLE_LOGIN_ENABLED && (
            <Button variant="secondary" icon={LogIn} onClick={google} disabled={!supabase || busy}>
              Googleでログイン
            </Button>
          )}
          <p className="text-xs text-muted">
            {mode === "login" ? "ログイン" : "登録"}すると
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
      )}
    </div>
  );
}
