"use client";

import {
  ArrowUpDown,
  Bookmark,
  Check,
  Clock,
  Columns3,
  Copy,
  Flame,
  House,
  Map as MapIcon,
  Pencil,
  Route,
  Ruler,
  Share2,
  Star,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CATEGORY_ICONS } from "@/components/category";
import { LazyMiniMap } from "@/components/map/mini-map-lazy";
import { PlacePicker } from "@/components/place-picker";
import { Badge, Button, Card, EmptyState, IconButton, Notice, PageHeader, Spinner, cn, inputClass } from "@/components/ui";
import { formatMinutes, useList, type ListData, type ListSpot } from "@/components/use-list";
import { api, errorMessage } from "@/lib/client-api";
import { CATEGORIES, CATEGORY_LABELS, LIST_NAME_MAX, POPULARITY_LABELS } from "@/lib/constants";
import { distanceM, formatDistance } from "@/lib/geo";

type Sort = "distance" | "popular" | "category" | "added";
const SORT_LABELS: Record<Sort, string> = {
  distance: "拠点から近い順",
  popular: "人気順",
  category: "カテゴリ別",
  added: "追加順",
};
const MAX_COMPARE = 3;
const DAY_MINUTES = 8 * 60;

// 拠点（F-4-8）。距離の並べ替えと経路作成の出発地に使う
function BaseCard({ base, onSave }: { base: ListData["base"]; onSave: (body: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="mb-3 p-3">
      <div className="flex items-center gap-2">
        <House size={20} strokeWidth={2} className="text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">拠点（ホテル・駅など）</p>
          <p className="truncate font-medium">{base?.label ?? "未設定"}</p>
        </div>
        <Button variant="secondary" onClick={() => setOpen((v) => !v)}>
          {base ? "変更" : "設定"}
        </Button>
        {base && <IconButton icon={X} label="拠点を外す" onClick={() => onSave({ base: null })} />}
      </div>
      {open && (
        <div className="mt-3">
          <PlacePicker
            value={null}
            onChange={async (p) => {
              if (!p) return;
              await onSave({ base: { label: p.name, lat: p.lat, lng: p.lng } });
              setOpen(false);
            }}
          />
        </div>
      )}
    </Card>
  );
}

function SpotRow({
  spot,
  distance,
  compared,
  compareFull,
  onCompare,
  onMust,
  onRemove,
}: {
  spot: ListSpot;
  distance: number | null;
  compared: boolean;
  compareFull: boolean;
  onCompare: () => void;
  onMust: () => void;
  onRemove: () => void;
}) {
  const Icon = CATEGORY_ICONS[spot.category];
  return (
    <Card className={cn("flex items-center gap-3 p-2", spot.deleted && "opacity-60")}>
      <input
        type="checkbox"
        checked={compared}
        onChange={onCompare}
        disabled={spot.deleted || (!compared && compareFull)}
        aria-label={`${spot.name}を比較に入れる`}
        className="h-5 w-5 accent-[var(--primary)]"
      />
      <Link href={`/spots/${spot.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-muted">
          {spot.coverThumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={spot.coverThumbUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Icon size={24} strokeWidth={2} className="text-primary" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{spot.name}</p>
          {spot.deleted ? (
            <p className="text-xs text-danger">このスポットは削除されました</p>
          ) : (
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              <Badge icon={Icon}>{CATEGORY_LABELS[spot.category]}</Badge>
              {spot.popularity !== "normal" && (
                <Badge icon={spot.popularity === "very_popular" ? Flame : undefined} tone={spot.popularity}>
                  {POPULARITY_LABELS[spot.popularity]}
                </Badge>
              )}
              {distance !== null ? (
                <Badge icon={Ruler}>{formatDistance(distance)}</Badge>
              ) : (
                <span className="text-xs text-muted">拠点を設定すると距離が表示されます</span>
              )}
            </div>
          )}
        </div>
      </Link>
      <IconButton
        icon={Star}
        label={spot.mustVisit ? "必ず行きたいを外す" : "必ず行きたい"}
        active={spot.mustVisit}
        onClick={onMust}
        disabled={spot.deleted}
      />
      <IconButton icon={Trash2} label="リストから外す" onClick={onRemove} />
    </Card>
  );
}

// F-4-6：共有URL。リストは本人しか見られないが、発行したURLを LINE などで送ると、
// 受け取った人はログインなしで閲覧だけできる（編集はできない）
function ShareCard({ listId, token, onChange }: { listId: string; token: string | null; onChange: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const url = token ? `${window.location.origin}/shared/${token}` : null;

  const run = async (fn: () => Promise<unknown>, done: string | null) => {
    setBusy(true);
    setNote(null);
    try {
      await fn();
      await onChange();
      setNote(done);
    } catch (e) {
      setNote(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!url) return;
    try {
      if (navigator.share) await navigator.share({ title: "行きたい場所リスト", url });
      else {
        await navigator.clipboard.writeText(url);
        setNote("URLをコピーしました");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setNote("共有できませんでした。URLをコピーして送ってください");
    }
  };

  return (
    <Card className="mb-3 p-3">
      <h2 className="flex items-center gap-2 font-bold">
        <Share2 size={20} strokeWidth={2} className="text-primary" aria-hidden />
        友達と共有
      </h2>
      {url ? (
        <>
          <p className="mt-1 text-sm text-muted">このURLを知っている人は、ログインなしでこのリストを見られます（編集はできません）。</p>
          <input readOnly value={url} aria-label="共有URL" onFocus={(e) => e.currentTarget.select()} className={cn(inputClass, "mt-2 text-sm")} />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button icon={Share2} onClick={send}>
              LINE などで送る
            </Button>
            <Button
              variant="secondary"
              icon={Copy}
              onClick={() =>
                navigator.clipboard
                  .writeText(url)
                  .then(() => setNote("URLをコピーしました"))
                  .catch(() => setNote("コピーできませんでした。URLを長押ししてコピーしてください"))
              }
            >
              コピー
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                if (!window.confirm("共有を停止しますか。送ったURLは見られなくなります。")) return;
                void run(() => api(`/lists/${listId}/share`, { method: "DELETE" }), "共有を停止しました");
              }}
            >
              共有を停止
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            このリストは今はあなただけが見られます。共有URLを発行すると、URLを受け取った人がリスト名・スポット・拠点を閲覧できます。
          </p>
          <Button
            icon={Share2}
            className="mt-2"
            disabled={busy}
            onClick={() => run(() => api(`/lists/${listId}/share`, { method: "POST" }), null)}
          >
            共有URLを発行
          </Button>
        </>
      )}
      {note && (
        <p role="status" className="mt-2 text-sm text-muted">
          {note}
        </p>
      )}
    </Card>
  );
}

// S-07 リスト詳細（F-4）
export function ListDetail() {
  const { listId } = useParams<{ listId: string }>();
  const router = useRouter();
  const { list, setList, error, reload } = useList(listId);
  const [sort, setSort] = useState<Sort>("added");
  const [compare, setCompare] = useState<string[]>([]);
  const [showMap, setShowMap] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // F-4-6：並べ替え
  const sorted = useMemo(() => {
    if (!list) return [];
    const arr = list.spots.map((s) => ({ spot: s, distance: list.base ? distanceM(list.base, s) : null }));
    if (sort === "distance") arr.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    if (sort === "popular") arr.sort((a, b) => b.spot.postCount + b.spot.likeCount - (a.spot.postCount + a.spot.likeCount));
    if (sort === "category") arr.sort((a, b) => CATEGORIES.indexOf(a.spot.category) - CATEGORIES.indexOf(b.spot.category));
    return arr;
  }, [list, sort]);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4">
        <PageHeader title="リスト" backHref="/lists" />
        <EmptyState icon={Bookmark} title={error} />
      </div>
    );
  }
  if (!list) return <Spinner />;

  const active = list.spots.filter((s) => !s.deleted);
  const totalStay = active.reduce((sum, s) => sum + s.stayMinutes, 0);

  const patch = async (body: Record<string, unknown>) => {
    setMessage(null);
    try {
      await api(`/lists/${list.id}`, { method: "PATCH", json: body });
      await reload();
    } catch (e) {
      setMessage(errorMessage(e));
    }
  };

  // F-4-4：押した直後に切り替え、失敗したら読み直す
  const toggleMust = async (s: ListSpot) => {
    setList({ ...list, spots: list.spots.map((x) => (x.id === s.id ? { ...x, mustVisit: !x.mustVisit } : x)) });
    try {
      await api(`/lists/${list.id}/items/${s.id}`, { method: "PATCH", json: { mustVisit: !s.mustVisit } });
    } catch (e) {
      setMessage(errorMessage(e));
      await reload();
    }
  };

  const removeSpot = async (s: ListSpot) => {
    if (!window.confirm(`「${s.name}」をリストから外しますか`)) return;
    try {
      await api(`/lists/${list.id}/items/${s.id}`, { method: "DELETE" });
      setCompare((c) => c.filter((id) => id !== s.id));
      await reload();
    } catch (e) {
      setMessage(errorMessage(e));
    }
  };

  const deleteList = async () => {
    if (!window.confirm(`リスト「${list.name}」を削除しますか。保存した経路プランも削除されます。`)) return;
    try {
      await api(`/lists/${list.id}`, { method: "DELETE" });
      router.push("/lists");
    } catch (e) {
      setMessage(errorMessage(e));
    }
  };

  const toggleCompare = (id: string) =>
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= MAX_COMPARE ? c : [...c, id]));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-8">
      {editingName === null ? (
        <PageHeader
          title={list.name}
          backHref="/lists"
          action={<IconButton icon={Pencil} label="リスト名を変更" onClick={() => setEditingName(list.name)} />}
        />
      ) : (
        <form
          className="flex items-center gap-2 py-3"
          onSubmit={async (e) => {
            e.preventDefault();
            await patch({ name: editingName });
            setEditingName(null);
          }}
        >
          <input
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            maxLength={LIST_NAME_MAX}
            aria-label="リスト名"
            className={inputClass}
            autoFocus
          />
          <IconButton icon={Check} label="保存" type="submit" />
          <IconButton icon={X} label="やめる" type="button" onClick={() => setEditingName(null)} />
        </form>
      )}

      {message && (
        <Notice tone="error" className="mb-3">
          {message}
        </Notice>
      )}

      <BaseCard base={list.base} onSave={patch} />
      <ShareCard listId={list.id} token={list.shareToken} onChange={reload} />

      {/* 合計滞在時間の目安（F-4-11） */}
      {active.length > 0 && (
        <p className="mb-3 flex flex-wrap items-center gap-1 text-sm text-muted">
          <Clock size={16} strokeWidth={2} aria-hidden />
          {active.length}か所・合計 {formatMinutes(totalStay)}＋移動
          {totalStay > DAY_MINUTES && <Badge tone="warning">1日では回りきれない可能性があります</Badge>}
        </p>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1 text-sm">
          <ArrowUpDown size={16} strokeWidth={2} aria-hidden />
          <span className="sr-only">並べ替え</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="min-h-11 rounded-xl border border-border bg-surface px-2"
          >
            {(Object.keys(SORT_LABELS) as Sort[]).map((k) => (
              <option key={k} value={k} disabled={k === "distance" && !list.base}>
                {SORT_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <Button variant="secondary" icon={MapIcon} onClick={() => setShowMap((v) => !v)} disabled={active.length === 0}>
          {showMap ? "地図を閉じる" : "地図で見る"}
        </Button>
        <Link
          href={`/lists/${list.id}/compare?ids=${compare.join(",")}`}
          aria-disabled={compare.length < 2}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-medium",
            compare.length < 2 && "pointer-events-none opacity-50",
          )}
        >
          <Columns3 size={20} strokeWidth={2} aria-hidden />
          比較（{compare.length}/{MAX_COMPARE}）
        </Link>
      </div>

      {showMap && (
        <div className="mb-3">
          <LazyMiniMap spots={active} base={list.base} onSelect={(id) => router.push(`/spots/${id}`)} />
        </div>
      )}

      {list.spots.length === 0 ? (
        <EmptyState icon={Bookmark} title="まだスポットがありません">
          <Link href="/" className="text-primary underline">
            地図からスポットを追加する
          </Link>
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map(({ spot, distance }) => (
            <li key={spot.id}>
              <SpotRow
                spot={spot}
                distance={distance}
                compared={compare.includes(spot.id)}
                compareFull={compare.length >= MAX_COMPARE}
                onCompare={() => toggleCompare(spot.id)}
                onMust={() => toggleMust(spot)}
                onRemove={() => removeSpot(spot)}
              />
            </li>
          ))}
        </ul>
      )}

      <Link
        href={`/lists/${list.id}/plan`}
        aria-disabled={active.length === 0}
        className={cn(
          "mt-4 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-medium text-primary-foreground",
          active.length === 0 && "pointer-events-none opacity-50",
        )}
      >
        <Route size={20} strokeWidth={2} aria-hidden />
        経路を作成
      </Link>

      {list.plans.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 font-bold">保存した経路プラン</h2>
          <ul className="flex flex-col gap-2">
            {list.plans.map((p) => (
              <li key={p.id}>
                <Link href={`/plans/${p.id}`}>
                  <Card className="flex items-center gap-3 p-3 hover:bg-surface-muted">
                    <Route size={20} strokeWidth={2} className="text-primary" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.label}</p>
                      <p className="text-xs text-muted">
                        {p.spotCount}か所・移動 合計{p.totalTravelMin}分・{new Date(p.createdAt).toLocaleDateString("ja-JP")}
                      </p>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Button variant="danger" icon={Trash2} className="mt-8 w-full" onClick={deleteList}>
        このリストを削除
      </Button>
    </div>
  );
}
