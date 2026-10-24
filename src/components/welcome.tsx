"use client";

import { Check } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useApp } from "@/components/app-context";
import { Button, Card, Field, Notice, PageHeader, Spinner, inputClass } from "@/components/ui";
import { api, errorMessage } from "@/lib/client-api";

// S-14 初回プロフィール設定（F-6-2）。Google の名前を初期値にして、表示名を確認してもらう
export function Welcome() {
  const { me, refreshMe } = useApp();
  const router = useRouter();
  const raw = useSearchParams().get("next") ?? "/";
  const next = raw.startsWith("/") && !raw.startsWith("//") && raw !== "/welcome" ? raw : "/";
  const [edited, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!me) return <Spinner />;
  const name = edited ?? me.displayName;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/me", { method: "PATCH", json: { displayName: name } });
      await refreshMe();
      router.replace(next);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-8">
      <PageHeader title="ようこそ" />
      <Card className="p-5">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <p className="text-sm">投稿に表示される名前を確認してください。あとからマイページで変更できます。</p>
          {error && <Notice tone="error">{error}</Notice>}
          <Field label="表示名（20文字まで）">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} className={inputClass} required />
          </Field>
          <Button icon={Check} type="submit" loading={busy} disabled={name.trim() === ""}>
            はじめる
          </Button>
        </form>
      </Card>
    </div>
  );
}
