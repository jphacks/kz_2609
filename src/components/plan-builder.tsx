"use client";

import { Coffee, House, ListChecks, LocateFixed, Route, Star, WandSparkles } from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useApp } from "@/components/app-context";
import { CATEGORY_ICONS } from "@/components/category";
import { locateMe } from "@/components/map/spot-map";
import { PlacePicker } from "@/components/place-picker";
import { PlanResult, type ComputeResponse, type PlanRequest } from "@/components/plan-result";
import { MODE_ICON } from "@/components/timeline";
import { Badge, Button, Card, Chip, Field, Notice, PageHeader, Spinner, cn, inputClass } from "@/components/ui";
import { useList, type ListSpot } from "@/components/use-list";
import { api, errorMessage } from "@/lib/client-api";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  MAX_PLAN_SPOTS,
  PACES,
  PACE_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  TRAVEL_MODES,
  TRAVEL_MODE_LABELS,
  type Category,
  type Pace,
  type Priority,
  type TravelMode,
} from "@/lib/constants";

type Place = { label: string; lat: number; lng: number };

const METHODS = [
  { key: "auto", icon: WandSparkles, title: "おまかせ", desc: "追加の入力なし。移動の負担が少ない案を作ります" },
  { key: "preferences", icon: ListChecks, title: "重視するものを選ぶ", desc: "ペースや優先することを選んで作ります" },
] as const;

function today() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

// 初期値：スポットは「必ず行きたい」を優先して8か所まで（F-5-1）
function defaultSelection(spots: ListSpot[]) {
  return [...spots.filter((s) => s.mustVisit), ...spots.filter((s) => !s.mustVisit)].slice(0, MAX_PLAN_SPOTS).map((s) => s.id);
}

// 出発地・到着地の指定（拠点・現在地・スポット名検索）
function PlaceField({
  label,
  value,
  emptyText,
  onChange,
  extra,
  onError,
}: {
  label: string;
  value: Place | null;
  emptyText: string;
  onChange: (p: Place | null) => void;
  extra?: { label: string; place: Place } | null;
  onError: (message: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  const useCurrent = async () => {
    try {
      const pos = await locateMe();
      onChange({ label: "現在地", lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      onError("現在地を取得できませんでした");
    }
  };
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      <div className="flex items-center gap-2">
        <div className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3">
          <House size={16} strokeWidth={2} className="shrink-0" aria-hidden />
          <span className="truncate text-sm">{value?.label ?? emptyText}</span>
        </div>
        <Button variant="secondary" icon={LocateFixed} onClick={useCurrent}>
          現在地
        </Button>
        <Button variant="secondary" onClick={() => setPicking((v) => !v)}>
          検索
        </Button>
      </div>
      {picking && (
        <div className="mt-2 flex flex-col gap-2">
          {extra && (
            <Button
              variant="secondary"
              onClick={() => {
                onChange(extra.place);
                setPicking(false);
              }}
            >
              {extra.label}
            </Button>
          )}
          <PlacePicker
            value={null}
            onChange={(p) => {
              if (!p) return;
              onChange({ label: p.name, lat: p.lat, lng: p.lng });
              setPicking(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

// S-09 経路作成（条件入力）。案ができたら S-11 経路案の比較（PlanResult）を表示する（F-5）
export function PlanBuilder() {
  const { listId } = useParams<{ listId: string }>();
  const { status } = useApp();
  const { list, error } = useList(listId);

  const [selectedState, setSelected] = useState<string[] | null>(null);
  const [originState, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [date, setDate] = useState(today());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [mode, setMode] = useState<TravelMode>("transit");
  const [lunchBreak, setLunchBreak] = useState(true);
  const [method, setMethod] = useState<"auto" | "preferences">("auto");
  const [pace, setPace] = useState<Pace>("normal");
  const [interests, setInterests] = useState<Category[]>([]);
  const [priority, setPriority] = useState<Priority>("fewer_moves");

  const [computing, setComputing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<{ request: PlanRequest; response: ComputeResponse } | null>(null);

  const spotNames = useMemo(() => new Map((list?.spots ?? []).map((s) => [s.id, s.name])), [list]);
  const mustSet = useMemo(() => new Set((list?.spots ?? []).filter((s) => s.mustVisit).map((s) => s.id)), [list]);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!list) return <Spinner />;

  const active = list.spots.filter((s) => !s.deleted);
  const selected = selectedState ?? defaultSelection(active);
  // 出発地の初期値はリストの拠点
  const origin = originState ?? list.base ?? null;
  const suspended = status?.suspended;
  const full = selected.length >= MAX_PLAN_SPOTS;

  if (result) {
    return (
      <PlanResult
        listId={listId}
        request={result.request}
        result={result.response}
        spotNames={spotNames}
        mustVisit={mustSet}
        onBack={() => setResult(null)}
      />
    );
  }

  const toggleSpot = (id: string) =>
    setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : full ? selected : [...selected, id]);

  const compute = async () => {
    if (!origin) return setFormError("出発地を指定してください");
    setComputing(true);
    setFormError(null);
    const request: PlanRequest = {
      listId,
      spotIds: selected,
      origin,
      destination,
      date,
      startTime,
      endTime,
      mode,
      lunchBreak,
      method,
      preferences: { pace, interests, priority },
    };
    try {
      const response = await api<ComputeResponse>("/plans/compute", { method: "POST", json: request });
      setResult({ request, response });
      window.scrollTo({ top: 0 });
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setComputing(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-8">
      <PageHeader title="経路を作成" backHref={`/lists/${listId}`} />
      {formError && (
        <Notice tone="error" className="mb-3">
          {formError}
        </Notice>
      )}

      <section className="mb-6">
        <h2 className="mb-1 font-bold">回るスポット</h2>
        <p className="mb-2 text-xs text-muted">
          {selected.length}/{MAX_PLAN_SPOTS}か所。経路を作れるのは{MAX_PLAN_SPOTS}か所までです
        </p>
        <ul className="flex flex-col gap-1">
          {active.map((s) => {
            const on = selected.includes(s.id);
            const Icon = CATEGORY_ICONS[s.category];
            return (
              <li key={s.id}>
                <label
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-xl border px-3",
                    on ? "border-primary bg-primary-soft" : "border-border bg-surface",
                    !on && full && "opacity-50",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleSpot(s.id)}
                    disabled={!on && full}
                    className="h-5 w-5 accent-[var(--primary)]"
                  />
                  <Icon size={16} strokeWidth={2} aria-hidden />
                  <span className="flex-1 truncate text-sm">{s.name}</span>
                  {s.mustVisit && <Badge icon={Star}>必ず行きたい</Badge>}
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mb-6 flex flex-col gap-4">
        <h2 className="font-bold">共通の条件</h2>
        <PlaceField label="出発地" value={origin} emptyText="未設定" onChange={setOrigin} onError={setFormError} />
        <div>
          <PlaceField
            label="到着地（任意）"
            value={destination}
            emptyText="指定しない（最後のスポットで終わる）"
            onChange={setDestination}
            extra={origin ? { label: "出発地に戻る", place: origin } : null}
            onError={setFormError}
          />
          {destination && (
            <Button variant="ghost" className="mt-1" onClick={() => setDestination(null)}>
              到着地を外す
            </Button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="日付">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="開始">
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
          </Field>
          <Field label="終了">
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">移動手段（経路案を作ったあと、区間ごとに変えられます）</legend>
          <div className="flex flex-wrap gap-2">
            {TRAVEL_MODES.map((m) => (
              <Chip key={m} icon={MODE_ICON[m]} selected={mode === m} onClick={() => setMode(m)} disabled={suspended?.[m]}>
                {TRAVEL_MODE_LABELS[m]}
                {suspended?.[m] && "（停止中）"}
              </Chip>
            ))}
          </div>
        </fieldset>
        <Chip icon={Coffee} selected={lunchBreak} onClick={() => setLunchBreak((v) => !v)} className="self-start">
          昼食休憩を入れる（11:30〜13:30に60分）
        </Chip>
      </section>

      <section className="mb-6 flex flex-col gap-3">
        <h2 className="font-bold">作り方</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {METHODS.map(({ key, icon: Icon, title, desc }) => (
            <button
              key={key}
              type="button"
              aria-pressed={method === key}
              onClick={() => setMethod(key)}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3 text-left",
                method === key ? "border-primary bg-primary-soft" : "border-border bg-surface",
              )}
            >
              <Icon size={20} strokeWidth={2} className="mt-0.5 text-primary" aria-hidden />
              <span>
                <span className="block font-medium">{title}</span>
                <span className="text-xs text-muted">{desc}</span>
              </span>
            </button>
          ))}
        </div>
        {method === "preferences" && (
          <Card className="flex flex-col gap-4 p-4">
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">旅行のペース</legend>
              <div className="flex flex-wrap gap-2">
                {PACES.map((p) => (
                  <Chip key={p} selected={pace === p} onClick={() => setPace(p)}>
                    {PACE_LABELS[p]}
                  </Chip>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">重視するもの（複数選択）</legend>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.filter((c) => c !== "other").map((c) => (
                  <Chip
                    key={c}
                    icon={CATEGORY_ICONS[c]}
                    selected={interests.includes(c)}
                    onClick={() => setInterests((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))}
                  >
                    {CATEGORY_LABELS[c]}
                  </Chip>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">優先すること</legend>
              <div className="flex flex-wrap gap-2">
                {PRIORITIES.map((p) => (
                  <Chip key={p} selected={priority === p} onClick={() => setPriority(p)}>
                    {PRIORITY_LABELS[p]}
                  </Chip>
                ))}
              </div>
            </fieldset>
          </Card>
        )}
      </section>

      <Button
        icon={Route}
        className="w-full"
        onClick={compute}
        loading={computing}
        disabled={selected.length === 0 || !origin || suspended?.[mode]}
      >
        経路案を作る
      </Button>
      {!origin && (
        <p className="mt-2 text-center text-xs text-muted">出発地を指定してください（リストに拠点を設定すると自動で入ります）</p>
      )}
    </div>
  );
}
