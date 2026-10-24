"use client";

import { BookmarkPlus, Camera, Clock, Flame, Heart, MapPin, Pencil } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAddToList } from "@/components/add-to-list";
import { useApp } from "@/components/app-context";
import { CATEGORY_ICONS } from "@/components/category";
import { Badge, Button, Card, EmptyState, Notice, PageHeader, Spinner, cn } from "@/components/ui";
import { api, errorMessage } from "@/lib/client-api";
import { CATEGORY_LABELS, POPULARITY_LABELS, STAY_LABELS, type Category, type Popularity, type StayDuration } from "@/lib/constants";

type Image = { id: string; url: string | null; thumbUrl: string | null; width: number; height: number };
type Spot = {
  id: string;
  name: string;
  address: string | null;
  category: Category;
  postCount: number;
  likeCount: number;
  popularity: Popularity;
  stayMinutes: number;
  stayIsDefault: boolean;
  hourHistogram: number[];
  bestHours: number[];
  images: Image[];
  demo?: boolean;
};
type Post = {
  id: string;
  comment: string;
  category: Category;
  stayDuration: StayDuration | null;
  likeCount: number;
  likedByMe: boolean;
  mine: boolean;
  createdAt: string;
  author: { displayName: string };
  images: Image[];
};
type PostsPage = { posts: Post[]; nextCursor: string | null };

function formatStay(min: number) {
  if (min >= 60) return `約${Math.floor(min / 60)}時間${min % 60 ? `${min % 60}分` : ""}`;
  return `約${min}分`;
}

// F-3-1：投稿が多い時間帯（24時間の棒グラフ）
function HourChart({ hist, best }: { hist: number[]; best: number[] }) {
  const max = Math.max(1, ...hist);
  const label = best.length ? best.map((h) => `${h}時`).join("、") : "情報が少ないためまだわかりません";
  return (
    <figure>
      <div className="flex h-20 gap-0.5" role="img" aria-label={`投稿が多い時間帯：${label}`}>
        {hist.map((n, h) => (
          <div key={h} className="flex flex-1 flex-col items-center justify-end">
            <div
              className={cn("w-full rounded-t-sm", best.includes(h) ? "bg-primary" : "bg-border")}
              style={{ height: `${(n / max) * 100}%`, minHeight: n > 0 ? 2 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        <span>0時</span>
        <span>6時</span>
        <span>12時</span>
        <span>18時</span>
        <span>23時</span>
      </div>
    </figure>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Camera; value: string | number; label: string }) {
  return (
    <Card className="p-3">
      <Icon size={16} strokeWidth={2} className="mx-auto text-muted" aria-hidden />
      <p className="mt-1 text-lg font-bold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </Card>
  );
}

// F-3-2：投稿1件
function PostCard({ post, onLike }: { post: Post; onLike: () => void }) {
  return (
    <Card className="overflow-hidden">
      {post.images.length > 0 && (
        <div className="no-scrollbar flex snap-x overflow-x-auto">
          {post.images.map((img) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={img.id} src={img.url ?? ""} alt="" loading="lazy" className="aspect-[4/3] w-full shrink-0 snap-start object-cover" />
          ))}
        </div>
      )}
      <div className="p-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{post.author.displayName}</span>
          <span className="text-xs text-muted">{new Date(post.createdAt).toLocaleDateString("ja-JP")}</span>
          {post.stayDuration && <Badge icon={Clock}>{STAY_LABELS[post.stayDuration]}</Badge>}
        </div>
        {post.comment && <p className="mt-1 whitespace-pre-wrap text-sm">{post.comment}</p>}
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={onLike}
            aria-pressed={post.likedByMe}
            aria-label={post.likedByMe ? "いいねを取り消す" : "いいね"}
            className={cn("inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm", post.likedByMe ? "text-danger" : "text-muted")}
          >
            <Heart size={20} strokeWidth={2} fill={post.likedByMe ? "currentColor" : "none"} aria-hidden />
            {post.likeCount}
          </button>
          {post.mine && (
            <Link
              href={`/posts/${post.id}/edit`}
              className="ml-auto inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm text-muted"
            >
              <Pencil size={16} strokeWidth={2} aria-hidden />
              編集
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}

// S-02 スポット詳細（F-3）
export function SpotDetail() {
  const { spotId } = useParams<{ spotId: string }>();
  const { requireLogin, status } = useApp();
  const [spot, setSpot] = useState<Spot | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const addToList = useAddToList();

  useEffect(() => {
    api<Spot>(`/spots/${spotId}`)
      .then(setSpot)
      .catch((e) => setError(errorMessage(e)));
    api<PostsPage>(`/spots/${spotId}/posts`)
      .then((r) => {
        setPosts(r.posts);
        setCursor(r.nextCursor);
      })
      .catch(() => undefined);
  }, [spotId]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await api<PostsPage>(`/spots/${spotId}/posts?cursor=${encodeURIComponent(cursor)}`);
      setPosts((p) => [...p, ...r.posts]);
      setCursor(r.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, spotId]);

  // F-3-3：押した直後に見た目を切り替え、失敗したら元に戻す
  const toggleLike = async (post: Post) => {
    if (!requireLogin()) return;
    const liked = !post.likedByMe;
    const replace = (next: Post) => setPosts((ps) => ps.map((p) => (p.id === post.id ? next : p)));
    replace({ ...post, likedByMe: liked, likeCount: post.likeCount + (liked ? 1 : -1) });
    try {
      const r = await api<{ liked: boolean; likeCount: number }>(`/posts/${post.id}/like`, { method: liked ? "PUT" : "DELETE" });
      replace({ ...post, likedByMe: r.liked, likeCount: r.likeCount });
    } catch {
      replace(post);
    }
  };

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4">
        <PageHeader title="スポット" backHref="/" />
        <EmptyState icon={MapPin} title={error} />
      </div>
    );
  }
  if (!spot) return <Spinner />;

  const CategoryIcon = CATEGORY_ICONS[spot.category];
  const postDisabled = Boolean(status?.suspended.posting || spot.demo);
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-8">
      <PageHeader title={spot.name} backHref="/" />

      {spot.demo && (
        <Notice tone="warning" className="mb-3">
          デモデータです（Supabase 未接続）
        </Notice>
      )}

      {/* 写真ギャラリー */}
      {spot.images.length > 0 ? (
        <div className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4">
          {spot.images.map((img) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={img.id}
              src={img.url ?? ""}
              alt=""
              className="h-56 w-auto shrink-0 snap-start rounded-xl object-cover"
              loading="lazy"
            />
          ))}
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-xl bg-surface-muted">
          <CategoryIcon size={40} strokeWidth={2} className="text-primary" aria-hidden />
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge icon={CategoryIcon}>{CATEGORY_LABELS[spot.category]}</Badge>
        {spot.popularity !== "normal" && (
          <Badge icon={spot.popularity === "very_popular" ? Flame : undefined} tone={spot.popularity}>
            {POPULARITY_LABELS[spot.popularity]}
          </Badge>
        )}
      </div>
      {spot.address && (
        <p className="mt-2 flex items-center gap-1 text-sm text-muted">
          <MapPin size={16} strokeWidth={2} aria-hidden />
          {spot.address}
        </p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat icon={Camera} value={spot.postCount} label="投稿" />
        <Stat icon={Heart} value={spot.likeCount} label="いいね" />
        <Stat icon={Clock} value={formatStay(spot.stayMinutes)} label={spot.stayIsDefault ? "滞在の目安" : "平均的な滞在"} />
      </div>

      <Card className="mt-3 p-4">
        <h2 className="mb-2 text-sm font-bold">投稿が多い時間帯</h2>
        <HourChart hist={spot.hourHistogram} best={spot.bestHours} />
        {spot.bestHours.length === 0 && (
          <p className="mt-2 text-xs text-muted">投稿が5件以上になると、おすすめの時間帯がわかります</p>
        )}
      </Card>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          icon={BookmarkPlus}
          variant="secondary"
          disabled={spot.demo}
          onClick={() => addToList.open({ id: spot.id, name: spot.name })}
        >
          リストに追加
        </Button>
        <Link
          href={`/posts/new?spotId=${spot.id}`}
          aria-disabled={postDisabled}
          className={cn(
            "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground",
            postDisabled && "pointer-events-none opacity-50",
          )}
        >
          <Camera size={20} strokeWidth={2} aria-hidden />
          ここに投稿
        </Link>
      </div>

      <h2 className="mb-2 mt-6 font-bold">投稿</h2>
      {posts.length === 0 ? (
        <EmptyState icon={Camera} title="まだ投稿がありません" />
      ) : (
        <ul className="flex flex-col gap-3">
          {posts.map((p) => (
            <li key={p.id}>
              <PostCard post={p} onLike={() => toggleLike(p)} />
            </li>
          ))}
        </ul>
      )}
      {cursor && (
        <Button variant="secondary" className="mt-3 w-full" onClick={loadMore} loading={loadingMore}>
          もっと見る
        </Button>
      )}
      {addToList.dialog}
    </div>
  );
}
