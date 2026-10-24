"use client";

import { Columns3, Flame } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { CATEGORY_ICONS } from "@/components/category";
import { Badge, EmptyState, PageHeader, Spinner } from "@/components/ui";
import { formatMinutes, useList, type ListSpot } from "@/components/use-list";
import { CATEGORY_LABELS, POPULARITY_LABELS } from "@/lib/constants";
import { distanceM, formatDistance } from "@/lib/geo";

// S-08 スポット比較（F-4-10）：2〜3件を横並びで比べる
export function ListCompare() {
  const { listId } = useParams<{ listId: string }>();
  const ids = (useSearchParams().get("ids") ?? "").split(",").filter(Boolean).slice(0, 3);
  const { list, error } = useList(listId);

  if (error) return <EmptyState icon={Columns3} title={error} />;
  if (!list) return <Spinner />;
  const spots = ids.map((id) => list.spots.find((s) => s.id === id)).filter((s): s is ListSpot => Boolean(s));

  const rows: { label: string; render: (s: ListSpot) => ReactNode }[] = [
    { label: "カテゴリ", render: (s) => <Badge icon={CATEGORY_ICONS[s.category]}>{CATEGORY_LABELS[s.category]}</Badge> },
    {
      label: "人気度",
      render: (s) => (
        <Badge icon={s.popularity === "very_popular" ? Flame : undefined} tone={s.popularity === "normal" ? "neutral" : s.popularity}>
          {POPULARITY_LABELS[s.popularity]}
        </Badge>
      ),
    },
    { label: "いいね", render: (s) => `${s.likeCount}` },
    { label: "滞在時間", render: (s) => formatMinutes(s.stayMinutes) },
    { label: "多い時間帯", render: (s) => (s.bestHours.length ? s.bestHours.map((h) => `${h}時`).join("・") : "情報不足") },
    { label: "拠点から", render: (s) => (list.base ? formatDistance(distanceM(list.base, s)) : "拠点未設定") },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-8">
      <PageHeader title="スポットを比較" backHref={`/lists/${listId}`} />
      {spots.length < 2 ? (
        <EmptyState icon={Columns3} title="比較するスポットを2〜3件選んでください" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] table-fixed border-separate border-spacing-2 text-sm">
            <thead>
              <tr>
                <th className="w-24" />
                {spots.map((s) => {
                  const Icon = CATEGORY_ICONS[s.category];
                  return (
                    <th key={s.id} className="align-top font-medium">
                      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-surface-muted">
                        {s.coverThumbUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.coverThumbUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Icon size={32} strokeWidth={2} className="text-primary" aria-hidden />
                        )}
                      </div>
                      <p className="mt-1 text-left">{s.name}</p>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row" className="text-left text-xs font-normal text-muted">
                    {r.label}
                  </th>
                  {spots.map((s) => (
                    <td key={s.id} className="rounded-xl bg-surface p-2">
                      {r.render(s)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
