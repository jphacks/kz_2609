"use client";

import { ChevronLeft, CircleAlert, Route, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/app-context";
import { LazyMiniMap } from "@/components/map/mini-map-lazy";
import { Timeline } from "@/components/timeline";
import { Badge, Button, Card, Notice, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/client-api";
import type { Category, TravelMode } from "@/lib/constants";
import { formatClock, legKey, recomputeCandidate, type LegOverrides } from "@/lib/planner";
import type { LegOverride, PlanCandidate, PlanInput, TravelMatrix } from "@/lib/planner/types";
import type { ComputePlanRequest } from "@/lib/validation";

export type PlanRequest = ComputePlanRequest;
export type ComputeResponse = {
  candidates: PlanCandidate[];
  input: PlanInput;
  matrix: TravelMatrix;
  notes: string[];
  spots: { id: string; name: string; lat: number; lng: number; category: Category; coverThumbUrl: string | null }[];
};

type Pt = { lat: number; lng: number };

function staysOf(c: PlanCandidate) {
  return new Map(c.items.flatMap((it) => (it.type === "spot" ? [[it.spotId, it.stayMin] as [string, number]] : [])));
}

// 区間 k の移動手段と出発時刻（= 次の到着時刻 − 所要時間）。
// suggested：公共交通を選んだ区間を、自動で徒歩・車にしたもの（計算し直すときに、もう一度自動で決め直す）
function legDepartures(c: PlanCandidate) {
  const legs = c.items.flatMap((it) => ((it.type === "origin" || it.type === "spot") && it.next ? [it.next] : []));
  const arrivals = c.items.flatMap((it) => (it.type === "spot" || it.type === "destination" ? [it.arrive] : []));
  return legs.map((l, k) => ({
    mode: l.mode,
    depart: arrivals[k] - l.travelMin,
    suggested: Boolean(l.walkSuggested || l.carSuggested),
  }));
}

// 「公共交通の乗り換えを計算し直す」を続けて押せない時間（ミリ秒）
const REFINE_COOLDOWN_MS = 10_000;

function CandidateCard({ candidate, recommended, onChoose }: { candidate: PlanCandidate; recommended: boolean; onChoose: () => void }) {
  const s = candidate.stats;
  const rows: [string, string][] = [
    ["回れる場所", `${s.spotCount}か所`],
    ["合計移動", `${s.totalTravelMin}分`],
    ["歩く距離", `${(s.walkM / 1000).toFixed(1)}km`],
    ["終了時刻", formatClock(s.endAt)],
    ["時間帯が合う", `${s.bestTimeHits}か所`],
    ["入らなかった", `${candidate.skipped.length}か所`],
  ];
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-center gap-2">
        <Route size={20} strokeWidth={2} className="text-primary" aria-hidden />
        <h2 className="font-bold">{candidate.label}</h2>
      </div>
      {recommended && <Badge tone="primary">あなたの優先することに合う案</Badge>}
      <p className="text-sm text-muted">{candidate.reason}</p>
      <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-sm">
        {rows.map(([dt, dd]) => (
          <div key={dt} className="contents">
            <dt className="text-muted">{dt}</dt>
            <dd className="text-right font-medium">{dd}</dd>
          </div>
        ))}
      </dl>
      <Button className="mt-auto" onClick={onChoose}>
        この案を見る
      </Button>
    </Card>
  );
}

// S-11 経路案の比較と、選んだ案の調整・保存（F-5-7〜F-5-11）
export function PlanResult({
  listId,
  request,
  result,
  spotNames,
  mustVisit,
  onBack,
}: {
  listId: string;
  request: PlanRequest;
  result: ComputeResponse;
  spotNames: Map<string, string>;
  mustVisit: Set<string>;
  onBack: () => void;
}) {
  const router = useRouter();
  const { status } = useApp();
  const [chosen, setChosen] = useState<PlanCandidate | null>(null);
  const [overrides, setOverrides] = useState<LegOverrides>(new Map());
  const [legBusy, setLegBusy] = useState(false);
  const [legNotes, setLegNotes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // ユーザーが自分で公共交通を選んだ区間（legKey）。計算し直しても、乗り物の経路を優先する
  const [forced, setForced] = useState<Set<string>>(new Set());
  const [cooldown, setCooldown] = useState(false);

  const { origin, destination, date } = request;
  // 行列の添字：0 = 出発地、1..n = スポット、n+1 = 到着地
  const n = result.input.spots.length;
  const indexOf = new Map(result.input.spots.map((s, i) => [s.id, i + 1]));
  const pointOf = (i: number): Pt => (i === 0 ? origin : i === n + 1 && destination ? destination : result.spots[i - 1]);
  const legPairs = (c: PlanCandidate) => {
    const idx = [0, ...c.order.map((id) => indexOf.get(id)!), ...(destination ? [n + 1] : [])];
    return idx.slice(1).map((to, k) => [idx[k], to] as const);
  };
  const isoAt = (min: number) => {
    const m = Math.max(0, Math.min(23 * 60 + 59, Math.round(min)));
    return `${date}T${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00+09:00`;
  };
  const recompute = (c: PlanCandidate, order: string[], stays: Map<string, number>, legs: LegOverrides) =>
    recomputeCandidate(result.input, result.matrix, c, order, stays, legs);

  // 指定した区間だけ Google Routes API で取り直し、時刻を計算し直す（ADR-0019）
  const refetchLegs = async (
    c: PlanCandidate,
    targets: { k: number; mode: TravelMode; force?: boolean }[],
    base: LegOverrides,
  ) => {
    if (targets.length === 0) return;
    setLegBusy(true);
    setError(null);
    try {
      const pairs = legPairs(c);
      const departs = legDepartures(c);
      const r = await api<{ legs: LegOverride[]; notes: string[] }>("/plans/legs", {
        method: "POST",
        json: {
          legs: targets.map(({ k, mode, force }) => ({
            from: pointOf(pairs[k][0]),
            to: pointOf(pairs[k][1]),
            mode,
            departAt: isoAt(departs[k]?.depart ?? result.input.startMin),
            ...(force ? { force } : {}),
          })),
        },
      });
      const next = new Map(base);
      targets.forEach(({ k }, i) => next.set(legKey(pairs[k][0], pairs[k][1]), r.legs[i]));
      setOverrides(next);
      setLegNotes(r.notes);
      setChosen(recompute(c, c.order, staysOf(c), next));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLegBusy(false);
    }
  };

  // 公共交通の区間の乗り換え（乗り場・路線）を計算し、乗り場までの徒歩を Google で取り直す（ADR-0026）。
  // 自動で徒歩・車にした区間も決め直す。ユーザーが自分で公共交通を選んだ区間は、乗り物の経路を優先する
  const refineTransit = (c: PlanCandidate, base: LegOverrides, forcedKeys: Set<string> = forced) => {
    const pairs = legPairs(c);
    return refetchLegs(
      c,
      legDepartures(c).flatMap((l, k) =>
        l.mode === "transit" || l.suggested
          ? [{ k, mode: "transit" as const, force: forcedKeys.has(legKey(pairs[k][0], pairs[k][1])) }]
          : [],
      ),
      base,
    );
  };

  // 区間の移動手段をユーザーが変えた（公共交通を選んだら、乗り物の経路を優先する）
  const changeLegMode = (c: PlanCandidate, k: number, mode: TravelMode) => {
    const [from, to] = legPairs(c)[k];
    const key = legKey(from, to);
    const next = new Set(forced);
    if (mode === "transit") next.add(key);
    else next.delete(key);
    setForced(next);
    void refetchLegs(c, [{ k, mode, force: mode === "transit" }], overrides);
  };

  const refineAgain = (c: PlanCandidate) => {
    setCooldown(true);
    setTimeout(() => setCooldown(false), REFINE_COOLDOWN_MS);
    void refineTransit(c, overrides);
  };

  // 案を選んだら、公共交通の区間だけ乗り換えの手順を計算する
  const choose = (c: PlanCandidate) => {
    const empty: LegOverrides = new Map();
    setOverrides(empty);
    setLegNotes([]);
    setForced(new Set());
    setChosen(c);
    void refineTransit(c, empty, new Set());
  };

  const save = async (c: PlanCandidate) => {
    setSaving(true);
    setError(null);
    try {
      const res = await api<{ id: string }>("/plans", {
        method: "POST",
        json: {
          listId,
          method: request.method,
          params: request,
          candidate: c,
          spots: result.spots.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng })),
        },
      });
      router.push(`/plans/${res.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  // 注意書きは上に1回だけ出す（経路案を作ったときと、区間を取り直したときで同じ文が重なるため）
  const noteList = [...new Set([...result.notes, ...(chosen ? legNotes : [])])];
  const notices = (
    <>
      {noteList.map((note) => (
        <Notice key={note} tone="info" className="mb-2">
          {note}
        </Notice>
      ))}
      {error && (
        <Notice tone="error" className="mb-2">
          {error}
        </Notice>
      )}
    </>
  );

  if (!chosen) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pb-8">
        <div className="flex items-center gap-2 py-3">
          <Button variant="ghost" icon={ChevronLeft} onClick={onBack}>
            条件を変える
          </Button>
        </div>
        {notices}
        <h1 className="mb-3 text-lg font-bold">経路案（{result.candidates.length}案）</h1>
        <div className="grid gap-3 sm:grid-cols-3">
          {result.candidates.map((c, i) => (
            <CandidateCard key={c.id} candidate={c} recommended={i === 0} onChoose={() => choose(c)} />
          ))}
        </div>
      </div>
    );
  }

  const current = chosen;
  const ordered = current.order.map((id) => result.spots.find((s) => s.id === id)!);
  const routePoints: Pt[] = [origin, ...ordered, ...(destination ? [destination] : [])];
  const hasTransit = current.items.some(
    (it) => (it.type === "origin" || it.type === "spot") && (it.next?.mode === "transit" || it.next?.walkSuggested || it.next?.carSuggested),
  );

  const move = (spotId: string, dir: -1 | 1) => {
    const order = [...current.order];
    const i = order.indexOf(spotId);
    [order[i], order[i + dir]] = [order[i + dir], order[i]];
    setChosen(recompute(current, order, staysOf(current), overrides));
  };
  const changeStay = (spotId: string, stayMin: number) => {
    const stays = staysOf(current);
    stays.set(spotId, stayMin);
    setChosen(recompute(current, current.order, stays, overrides));
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-8">
      <div className="flex items-center gap-2 py-3">
        <Button variant="ghost" icon={ChevronLeft} onClick={() => setChosen(null)}>
          案の比較に戻る
        </Button>
      </div>
      {notices}
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h1 className="mb-1 text-lg font-bold">{current.label}</h1>
          <p className="mb-3 text-sm text-muted">{current.reason}</p>
          {current.overTime && (
            <Notice tone="warning" className="mb-3">
              終了時刻（{request.endTime}）を過ぎます。順番や滞在時間を見直してください
            </Notice>
          )}
          <Timeline
            items={current.items}
            spotNames={spotNames}
            mustVisit={mustVisit}
            originLabel={origin.label}
            destinationLabel={destination?.label}
            editable
            onMove={move}
            onStay={changeStay}
            onLegMode={(k, mode) => changeLegMode(current, k, mode)}
            legBusy={legBusy}
          />
          {legBusy && <Spinner label="所要時間と乗り換えを確認中" />}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>所要時間：{status?.mockExternalApis ? "直線距離からの概算（開発用）" : "Google マップ（Routes API）"}</span>
            {hasTransit && (
              <Button
                variant="secondary"
                className="min-h-9 px-3 text-xs"
                onClick={() => refineAgain(current)}
                loading={legBusy}
                disabled={cooldown}
              >
                {cooldown ? "少し待ってから押せます" : "公共交通の乗り換えを計算し直す"}
              </Button>
            )}
          </div>
          {current.skipped.length > 0 && (
            <Card className="mt-3 p-3">
              <p className="mb-1 flex items-center gap-1 text-sm font-medium">
                <CircleAlert size={16} strokeWidth={2} aria-hidden />
                時間が足りず入らなかった場所
              </p>
              <ul className="text-sm text-muted">
                {current.skipped.map((s) => (
                  <li key={s.spotId}>
                    {spotNames.get(s.spotId)}
                    {s.reason === "unreachable" && "（移動時間を取得できませんでした）"}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Button icon={Save} className="mt-4 w-full" onClick={() => save(current)} loading={saving} disabled={legBusy}>
            この案を保存する
          </Button>
          <p className="mt-2 text-xs text-muted">保存すると、各区間の「ナビ開始」から Googleマップで道案内を開けます</p>
        </div>
        <div className="lg:sticky lg:top-16 lg:self-start">
          <LazyMiniMap className="h-80" spots={ordered} base={origin} route={routePoints} />
        </div>
      </div>
    </div>
  );
}
