"use client";

import { Camera, Check, Heart, LogIn, LogOut, Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app-context";
import { Badge, Button, Card, EmptyState, IconButton, Notice, PageHeader, Spinner, inputClass } from "@/components/ui";
import { api, errorMessage } from "@/lib/client-api";
import { getBrowserSupabase } from "@/lib/supabase/client";

type MyPost = {
  id: string;
  spotId: string;
  spotName: string;
  comment: string;
  likeCount: number;
  hidden: boolean;
  createdAt: string;
  thumbUrl: string | null;
};

function MyPostRow({ post }: { post: MyPost }) {
  return (
    <Card className="flex items-center gap-3 p-2">
      <Link href={`/spots/${post.spotId}`} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-muted">
          {post.thumbUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.thumbUrl} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{post.spotName}</p>
          <p className="flex items-center gap-2 text-xs text-muted">
            {new Date(post.createdAt).toLocaleDateString("ja-JP")}
            <span className="inline-flex items-center gap-0.5">
              <Heart size={12} strokeWidth={2} aria-hidden />
              {post.likeCount}
            </span>
            {post.hidden && <Badge tone="warning">非表示</Badge>}
          </p>
        </div>
      </Link>
      <Link
        href={`/posts/${post.id}/edit`}
        aria-label="編集"
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border"
      >
        <Pencil size={20} strokeWidth={2} aria-hidden />
      </Link>
    </Card>
  );
}

// S-15 マイページ（F-6-3・F-6-4）
export function MyPage() {
  const { me, meLoaded, configured, refreshMe } = useApp();
  const router = useRouter();
  const [posts, setPosts] = useState<MyPost[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    api<{ posts: MyPost[] }>("/me/posts")
      .then((r) => setPosts(r.posts))
      .catch((e) => setError(errorMessage(e)));
  }, [me]);

  if (!configured) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4">
        <PageHeader title="マイページ" />
        <Notice tone="warning">Supabase に接続するとログインできます（docs/セットアップ手順.md）</Notice>
      </div>
    );
  }
  if (!meLoaded) return <Spinner />;
  if (!me) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4">
        <PageHeader title="マイページ" />
        <EmptyState icon={LogIn} title="ログインしていません">
          <Link href="/login?next=/me" className="text-primary underline">
            ログインする
          </Link>
        </EmptyState>
      </div>
    );
  }

  const saveName = async () => {
    setError(null);
    try {
      await api("/me", { method: "PATCH", json: { displayName: editing } });
      setEditing(null);
      await refreshMe();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const signOutAndLeave = async () => {
    await getBrowserSupabase()?.auth.signOut();
    await refreshMe();
    router.replace("/");
  };

  const withdraw = async () => {
    if (!window.confirm("退会すると、投稿・写真・いいね・リスト・経路プランがすべて削除され、元に戻せません。退会しますか。")) return;
    try {
      await api("/me", { method: "DELETE" });
      await signOutAndLeave();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-8">
      <PageHeader title="マイページ" />
      {error && (
        <Notice tone="error" className="mb-3">
          {error}
        </Notice>
      )}
      <Card className="mb-4 flex items-center gap-3 p-4">
        {editing === null ? (
          <>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">表示名</p>
              <p className="truncate font-bold">{me.displayName}</p>
            </div>
            <IconButton icon={Pencil} label="表示名を変更" onClick={() => setEditing(me.displayName)} />
          </>
        ) : (
          <>
            <input
              value={editing}
              onChange={(e) => setEditing(e.target.value)}
              maxLength={20}
              aria-label="表示名"
              className={inputClass}
              autoFocus
            />
            <IconButton icon={Check} label="保存" onClick={saveName} disabled={editing.trim() === ""} />
            <IconButton icon={X} label="やめる" onClick={() => setEditing(null)} />
          </>
        )}
      </Card>

      <h2 className="mb-2 font-bold">自分の投稿</h2>
      {!posts ? (
        <Spinner />
      ) : posts.length === 0 ? (
        <EmptyState icon={Camera} title="まだ投稿がありません">
          <Link href="/posts/new" className="text-primary underline">
            投稿する
          </Link>
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {posts.map((p) => (
            <li key={p.id}>
              <MyPostRow post={p} />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 flex flex-col gap-2">
        <Button variant="secondary" icon={LogOut} onClick={signOutAndLeave}>
          ログアウト
        </Button>
        <Button variant="danger" icon={Trash2} onClick={withdraw}>
          退会する
        </Button>
        <p className="text-center text-xs text-muted">
          <Link href="/terms" className="underline">
            利用規約
          </Link>
          ・
          <Link href="/privacy" className="underline">
            プライバシーポリシー
          </Link>
        </p>
      </div>
    </div>
  );
}
