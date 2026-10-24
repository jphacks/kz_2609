"use client";

import { Bookmark, Clock, Eye, Flame, House, Map as MapIcon, Ruler, Star } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CATEGORY_ICONS } from "@/components/category";
import { LazyMiniMap } from "@/components/map/mini-map-lazy";
import { Badge, Button, Card, EmptyState, Spinner } from "@/components/ui";
import { formatMinutes, type ListSpot } from "@/components/use-list";
import { api, errorMessage } from "@/lib/client-api";
import { CATEGORY_LABELS, POPULARITY_LABELS } from "@/lib/constants";
import { distanceM, formatDistance } from "@/lib/geo";

type SharedList = { name: string; base: { label: string; lat: number; lng: number } | null; spots: ListSpot[] };

// S-13 共有リスト（F-4-6）。ログインなしで見られるが、変更する操作は置かない
export function SharedListView() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [list, setList] = useState<SharedList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    api<SharedList>(`/shared/${encodeURIComponent(token)}`)
      .then(setList)
      .catch((e) => setError(errorMessage(e)));
  }, [token]);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <EmptyState icon={Bookmark} title={error}>
          <Link href="/" className="text-primary underline">
            地図を見る
          </Link>
        </EmptyState>
      </div>
    );
  }
  if (!list) return <Spinner />;

  const totalStay = list.spots.reduce((sum, s) => sum + s.stayMinutes, 0);
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-8">
      <header className="py-4">
        <p className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-3 py-1 text-xs text-muted">
          <Eye size={14} strokeWidth={2} aria-hidden />
          共有されたリスト（閲覧のみ）
        </p>
        <h1 className="mt-2 text-2xl font-bold">{list.name}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span>{list.spots.length}か所</span>
          {list.spots.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Clock size={14} strokeWidth={2} aria-hidden />
              合計 {formatMinutes(totalStay)}＋移動
            </span>
          )}
          {list.base && (
            <span className="inline-flex items-center gap-1">
              <House size={14} strokeWidth={2} aria-hidden />
              拠点：{list.base.label}
            </span>
          )}
        </p>
      </header>

      {list.spots.length === 0 ? (
        <EmptyState icon={Bookmark} title="このリストにはまだスポットがありません" />
      ) : (
        <>
          <Button variant="secondary" icon={MapIcon} onClick={() => setShowMap((v) => !v)} className="mb-3">
            {showMap ? "地図を閉じる" : "地図で見る"}
          </Button>
          {showMap && (
            <div className="mb-3">
              <LazyMiniMap spots={list.spots} base={list.base} onSelect={(id) => router.push(`/spots/${id}`)} />
            </div>
          )}
          <ul className="flex flex-col gap-2">
            {list.spots.map((spot) => {
              const Icon = CATEGORY_ICONS[spot.category];
              return (
                <li key={spot.id}>
                  <Link href={`/spots/${spot.id}`}>
                    <Card className="flex items-center gap-3 p-2 hover:bg-surface-muted">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-muted">
                        {spot.coverThumbUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={spot.coverThumbUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Icon size={24} strokeWidth={2} className="text-primary" aria-hidden />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1 truncate font-medium">
                          {spot.mustVisit && <Star size={16} strokeWidth={2} className="shrink-0 fill-current text-warning" aria-label="必ず行きたい" />}
                          {spot.name}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1">
                          <Badge icon={Icon}>{CATEGORY_LABELS[spot.category]}</Badge>
                          {spot.popularity !== "normal" && (
                            <Badge icon={spot.popularity === "very_popular" ? Flame : undefined} tone={spot.popularity}>
                              {POPULARITY_LABELS[spot.popularity]}
                            </Badge>
                          )}
                          {list.base && <Badge icon={Ruler}>{formatDistance(distanceM(list.base, spot))}</Badge>}
                        </div>
                      </div>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Link
        href="/lists"
        className="mt-6 flex min-h-12 items-center justify-center rounded-xl border border-border bg-surface px-4 text-sm font-medium"
      >
        自分のリストを作る
      </Link>
    </div>
  );
}
