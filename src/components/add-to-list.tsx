"use client";

import { BookmarkPlus, Check, Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/app-context";
import { Button, Notice, Spinner, inputClass } from "@/components/ui";
import { api, ApiClientError, errorMessage } from "@/lib/client-api";
import { LIST_NAME_MAX } from "@/lib/constants";

type ListSummary = { id: string; name: string; spotCount: number; spotIds: string[] };

// F-4-3：どのリストに追加するかを選ぶ。その場で新しいリストも作れる
export function AddToListDialog({ spotId, spotName, onClose }: { spotId: string; spotName: string; onClose: () => void }) {
  const [lists, setLists] = useState<ListSummary[] | null>(null);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const load = useCallback(
    () =>
      api<{ lists: ListSummary[] }>("/lists")
        .then((r) => setLists(r.lists))
        .catch((e) => setMessage({ tone: "error", text: errorMessage(e) })),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const add = async (listId: string) => {
    setBusy(listId);
    setMessage(null);
    try {
      await api(`/lists/${listId}/items`, { method: "POST", json: { spotId } });
      setMessage({ tone: "info", text: "リストに追加しました" });
      await load();
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "CONFLICT") setMessage({ tone: "info", text: "追加済みです" });
      else setMessage({ tone: "error", text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  const create = async () => {
    setBusy("new");
    setMessage(null);
    try {
      const created = await api<{ id: string }>("/lists", { method: "POST", json: { name: newName } });
      setNewName("");
      await add(created.id);
    } catch (e) {
      setMessage({ tone: "error", text: errorMessage(e) });
      setBusy(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="リストに追加"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <BookmarkPlus size={20} strokeWidth={2} aria-hidden />
          <h2 className="flex-1 font-bold">「{spotName}」をリストに追加</h2>
          <button
            type="button"
            aria-label="閉じる"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-surface-muted"
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>
        {message && (
          <Notice tone={message.tone} className="mb-3">
            {message.text}
          </Notice>
        )}
        {!lists ? (
          <Spinner />
        ) : (
          <ul className="flex flex-col gap-2">
            {lists.map((l) => {
              const added = l.spotIds.includes(spotId);
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    disabled={added || busy !== null}
                    onClick={() => add(l.id)}
                    className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-border px-3 text-left hover:bg-surface-muted disabled:opacity-70"
                  >
                    <span className="flex-1">
                      <span className="block font-medium">{l.name}</span>
                      <span className="text-xs text-muted">{l.spotCount}か所</span>
                    </span>
                    {added ? (
                      <span className="inline-flex items-center gap-1 text-sm text-primary">
                        <Check size={16} strokeWidth={2} aria-hidden />
                        追加済み
                      </span>
                    ) : (
                      <Plus size={20} strokeWidth={2} aria-hidden />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-4 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={LIST_NAME_MAX}
            placeholder="新しいリスト名（例：金沢旅行）"
            aria-label="新しいリスト名"
            className={inputClass}
          />
          <Button icon={Plus} onClick={create} disabled={newName.trim() === ""} loading={busy === "new"}>
            作成
          </Button>
        </div>
      </div>
    </div>
  );
}

// 「リストに追加」ボタンから使う。未ログインならログイン画面へ
export function useAddToList() {
  const { requireLogin } = useApp();
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  return {
    open: (spot: { id: string; name: string }) => {
      if (requireLogin()) setTarget(spot);
    },
    dialog: target ? <AddToListDialog spotId={target.id} spotName={target.name} onClose={() => setTarget(null)} /> : null,
  };
}
