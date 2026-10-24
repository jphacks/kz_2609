"use client";

import { Map as MapIcon, Route, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/app-context";
import { LazyMiniMap } from "@/components/map/mini-map-lazy";
import { Timeline } from "@/components/timeline";
import { Button, EmptyState, Notice, PageHeader, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/client-api";
import { TRAVEL_MODE_LABELS, type TravelMode } from "@/lib/constants";
import type { PlanItem } from "@/lib/planner/types";

type Pt = { label: string; lat: number; lng: number };
type Plan = {
  id: string;
  listId: string;
  listName: string;
  label: string;
  reason: string;
  items: PlanItem[];
  skipped: { spotId: string; reason: string }[];
  spots: { id: string; name: string; lat: number; lng: number }[];
  params: { date: string; mode: TravelMode; origin: Pt; destination: Pt | null };
  navLinks: string[];
  fullRoute: { url: string; stopCount: number } | null;
};

// スマホのブラウザで開くと、Googleマップの立ち寄り先は3か所まで（アプリなら9か所まで）
const MOBILE_BROWSER_WAYPOINTS = 3;

// S-12 経路プラン（保存済み）。各区間の「ナビ開始」と全体の経路で Googleマップを開く（F-5-12・F-5-13）
export function PlanDetail() {
  const { planId } = useParams<{ planId: string }>();
  const router = useRouter();
  const { me, meLoaded, configured, requireLogin } = useApp();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (meLoaded && configured && !me) requireLogin();
  }, [me, meLoaded, configured, requireLogin]);

  useEffect(() => {
    if (!me) return;
    api<Plan>(`/plans/${planId}`)
      .then(setPlan)
      .catch((e) => setError(errorMessage(e)));
  }, [me, planId]);

  const spotNames = useMemo(() => new Map((plan?.spots ?? []).map((s) => [s.id, s.name])), [plan]);

  if (error) return <EmptyState icon={Route} title={error} />;
  if (!plan) return <Spinner />;

  const ordered = plan.items.flatMap((i) => {
    const s = i.type === "spot" ? plan.spots.find((x) => x.id === i.spotId) : undefined;
    return s ? [{ ...s, category: "other" as const, coverThumbUrl: null }] : [];
  });
  const route = [plan.params.origin, ...ordered, ...(plan.params.destination ? [plan.params.destination] : [])];

  const remove = async () => {
    if (!window.confirm("この経路プランを削除しますか")) return;
    try {
      await api(`/plans/${plan.id}`, { method: "DELETE" });
      router.push(`/lists/${plan.listId}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-8">
      <PageHeader title={plan.label} backHref={`/lists/${plan.listId}`} />
      <p className="mb-1 text-sm text-muted">
        {plan.listName}・{plan.params.date}・{TRAVEL_MODE_LABELS[plan.params.mode]}
      </p>
      <p className="mb-3 text-sm text-muted">{plan.reason}</p>
      <Notice tone="info" className="mb-3">
        所要時間は計画時点の Google マップの情報です。当日は「ナビ開始」から Googleマップで最新の経路を確認してください
      </Notice>
      {plan.fullRoute && (
        <div className="mb-4 flex flex-col gap-1">
          <a
            href={plan.fullRoute.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-medium text-primary hover:bg-surface-muted"
          >
            <MapIcon size={20} strokeWidth={2} aria-hidden />
            全体の経路を Googleマップで開く
          </a>
          <p className="text-xs text-muted">
            {plan.params.mode === "transit"
              ? "Googleマップは公共交通の経路に立ち寄り先を入れられないため、全体は徒歩の経路で開きます。バスや電車は各区間の「ナビ開始」で確認してください。"
              : "訪問する順番どおりに、すべての場所を立ち寄り先として開きます。"}
            {plan.fullRoute.stopCount - 2 > MOBILE_BROWSER_WAYPOINTS &&
              "スマホでは Googleマップのアプリで開くと、すべての立ち寄り先が入ります。"}
          </p>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Timeline
          items={plan.items}
          spotNames={spotNames}
          originLabel={plan.params.origin.label}
          destinationLabel={plan.params.destination?.label}
          navLinks={plan.navLinks}
        />
        <div className="lg:sticky lg:top-16 lg:self-start">
          <LazyMiniMap className="h-80" spots={ordered} base={plan.params.origin} route={route} />
        </div>
      </div>
      <Button variant="danger" icon={Trash2} className="mt-6 w-full" onClick={remove}>
        この経路プランを削除
      </Button>
    </div>
  );
}
