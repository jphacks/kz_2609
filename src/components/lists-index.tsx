"use client";

import { Bookmark, ChevronRight, House, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useApp } from "@/components/app-context";
import { Button, Card, EmptyState, Notice, PageHeader, Spinner, inputClass } from "@/components/ui";
import { api, errorMessage } from "@/lib/client-api";
import { LIST_NAME_MAX } from "@/lib/constants";

type ListSummary = { id: string; name: string; baseLabel: string | null; spotCount: number; thumbUrls: string[] };

function ListRow({ list }: { list: ListSummary }) {
  return (
    <Link href={`/lists/${list.id}`}>
      <Card className="flex items-center gap-3 p-3 hover:bg-surface-muted">
        <div className="flex -space-x-3">
          {list.thumbUrls.length > 0 ? (
            list.thumbUrls.map((u) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={u} src={u} alt="" className="h-12 w-12 rounded-xl border-2 border-surface object-cover" />
            ))
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-muted">
              <Bookmark size={20} strokeWidth={2} className="text-muted" aria-hidden />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{list.name}</p>
          <p className="flex items-center gap-2 text-xs text-muted">
            {list.spotCount}か所
            {list.baseLabel && (
              <span className="inline-flex items-center gap-1">
                <House size={14} strokeWidth={2} aria-hidden />
                {list.baseLabel}
              </span>
            )}
          </p>
        </div>
        <ChevronRight size={20} strokeWidth={2} className="text-muted" aria-hidden />
      </Card>
    </Link>
  );
}

// S-06 リスト一覧（F-4-1）
export function ListsIndex() {
  const { me, meLoaded, configured, requireLogin } = useApp();
  const [lists, setLists] = useState<ListSummary[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      api<{ lists: ListSummary[] }>("/lists")
        .then((r) => setLists(r.lists))
        .catch((e) => setError(errorMessage(e))),
    [],
  );

  useEffect(() => {
    if (meLoaded && configured && !me) requireLogin();
  }, [me, meLoaded, configured, requireLogin]);

  useEffect(() => {
    if (me) void load();
  }, [me, load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/lists", { method: "POST", json: { name } });
      setName("");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!configured) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4">
        <PageHeader title="行きたい場所リスト" />
        <Notice tone="warning">Supabase に接続するとリストを使えます（docs/セットアップ手順.md）</Notice>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-8">
      <PageHeader title="行きたい場所リスト" />
      <form onSubmit={create} className="mb-4 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={LIST_NAME_MAX}
          placeholder="新しいリスト（例：金沢旅行）"
          aria-label="新しいリスト名"
          className={inputClass}
        />
        <Button icon={Plus} type="submit" disabled={name.trim() === ""} loading={busy}>
          作成
        </Button>
      </form>
      {error && (
        <Notice tone="error" className="mb-3">
          {error}
        </Notice>
      )}
      {!lists ? (
        <Spinner />
      ) : lists.length === 0 ? (
        <EmptyState icon={Bookmark} title="まだリストがありません">
          地図で気になったスポットを「リストに追加」すると、ここに集まります
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {lists.map((l) => (
            <li key={l.id}>
              <ListRow list={l} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
