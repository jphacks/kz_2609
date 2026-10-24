"use client";

import { CirclePause, Coffee, House, ListChecks, LocateFixed, MessageCircle, Route, Star, WandSparkles } from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useApp } from "@/components/app-context";
import { CATEGORY_ICONS } from "@/components/category";
import { locateErrorMessage, locateMe } from "@/components/map/spot-map";
import { PlacePicker } from "@/components/place-picker";
import { ChatConditionsList, PlanChat } from "@/components/plan-chat";
import { PlanResult, type ComputeResponse, type PlanRequest } from "@/components/plan-result";
import { MODE_ICON } from "@/components/timeline";
import { Badge, Button, Card, Chip, Field, Notice, PageHeader, Spinner, cn, inputClass } from "@/components/ui";
import { useList, type ListSpot } from "@/components/use-list";
import { api, errorMessage } from "@/lib/client-api";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  LUNCH_DEFAULT,
  LUNCH_DURATIONS,
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
import type { ChatConditions } from "@/lib/planner/types";

type Place = { label: string; lat: number; lng: number };

const METHODS = [
  { key: "auto", icon: WandSparkles, title: "おまかせ", desc: "追加の入力なし。移動の負担が少ない案を作ります" },
  { key: "preferences", icon: ListChecks, title: "重視するものを選ぶ", desc: "ペースや優先することを選んで作ります" },
  { key: "chat", icon: MessageCircle, title: "AIと相談", desc: "時間帯や順番の希望を話して条件を決めます" },
] as const;

type Method = (typeof METHODS)[number]["key"];
type ChatExtras = Pick<ChatConditions, "timeWindows" | "orderHints" | "exclude">;
const NO_EXTRAS: ChatExtras = { timeWindows: [], orderHints: [], exclude: [] };

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
  onLocating,
}: {
  label: string;
  value: Place | null;
  emptyText: string;
  onChange: (p: Place | null) => void;
  extra?: { label: string; place: Place } | null;
  // 現在地を取得している間は、経路の作成を押せないようにする
  onLocating: (locating: boolean) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const useCurrent = async () => {
    setLocating(true);
    onLocating(true);
    setError(null);
    try {
      const pos = await locateMe();
      onChange({ label: "現在地", lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch (e) {
      setError(locateErrorMessage(e));
    } finally {
      setLocating(false);
      onLocating(false);
    }
  };
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      <div className="flex items-center gap-2">
        <div className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3">
          <House size={16} strokeWidth={2} className="shrink-0" aria-hidden />
          <span className="truncate text-sm">{locating ? "現在地を取得中…" : (value?.label ?? emptyText)}</span>
        </div>
        <Button variant="secondary" icon={LocateFixed} onClick={useCurrent} loading={locating}>
          現在地
        </Button>
        <Button variant="secondary" onClick={() => setPicking((v) => !v)}>
          検索
        </Button>
      </div>
      {error && (
        <Notice tone="error" className="mt-2">
          {error}
        </Notice>
      )}
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
  const [lunchFrom, setLunchFrom] = useState<string>(LUNCH_DEFAULT.from);
  const [lunchUntil, setLunchUntil] = useState<string>(LUNCH_DEFAULT.until);
  const [lunchMin, setLunchMin] = useState<number>(LUNCH_DEFAULT.min);
  const [method, setMethod] = useState<Method>("auto");
  const [pace, setPace] = useState<Pace>("normal");
  const [interests, setInterests] = useState<Category[]>([]);
  const [priority, setPriority] = useState<Priority>("fewer_moves");
  // AIと相談で読み取った「時刻の指定・順番の希望・除外」（F-5-5）
  const [extras, setExtras] = useState<ChatExtras>(NO_EXTRAS);

  const [computing, setComputing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [locatingOrigin, setLocatingOrigin] = useState(false);
  const [locatingDestination, setLocatingDestination] = useState(false);
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
  const aiOff = Boolean(suspended?.ai);
  const conditions: ChatConditions = { pace, interests, priority, ...extras };
  const setConditions = (c: ChatConditions) => {
    setPace(c.pace);
    setInterests(c.interests);
    setPriority(c.priority);
    setExtras({ timeWindows: c.timeWindows, orderHints: c.orderHints, exclude: c.exclude });
  };

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
      lunchFrom,
      lunchUntil,
      lunchMin,
      method,
      preferences: { pace, interests, priority, ...(method === "chat" ? extras : NO_EXTRAS) },
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
        <PlaceField label="出発地" value={origin} emptyText="未設定" onChange={setOrigin} onLocating={setLocatingOrigin} />
        <div>
          <PlaceField
            label="到着地（任意）"
            value={destination}
            emptyText="指定しない（最後のスポットで終わる）"
            onChange={setDestination}
            extra={origin ? { label: "出発地に戻る", place: origin } : null}
            onLocating={setLocatingDestination}
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
        <div className="flex flex-col gap-2">
          <Chip icon={Coffee} selected={lunchBreak} onClick={() => setLunchBreak((v) => !v)} className="self-start">
            昼食休憩を入れる
          </Chip>
          {lunchBreak && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Field label="昼食 から">
                <input type="time" value={lunchFrom} onChange={(e) => setLunchFrom(e.target.value)} className={inputClass} />
              </Field>
              <Field label="まで">
                <input type="time" value={lunchUntil} onChange={(e) => setLunchUntil(e.target.value)} className={inputClass} />
              </Field>
              <Field label="昼食の長さ">
                <select value={lunchMin} onChange={(e) => setLunchMin(Number(e.target.value))} className={inputClass}>
                  {LUNCH_DURATIONS.map((m) => (
                    <option key={m} value={m}>
                      {m}分
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
          {lunchBreak && (
            <p className="text-xs text-muted">
              {lunchFrom}〜{lunchUntil}の間に{lunchMin}分の昼食休憩を入れます（スポットの見学の合間に入れます）。
            </p>
          )}
        </div>
      </section>

      <section className="mb-6 flex flex-col gap-3">
        <h2 className="font-bold">作り方</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {METHODS.map(({ key, icon: Icon, title, desc }) => {
            // AIが停止中・未設定なら「AIと相談」だけ使えない（F-5 例外）
            const off = key === "chat" && aiOff;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={method === key}
                onClick={() => setMethod(key)}
                disabled={off}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3 text-left disabled:cursor-not-allowed disabled:opacity-60",
                  method === key ? "border-primary bg-primary-soft" : "border-border bg-surface",
                )}
              >
                <Icon size={20} strokeWidth={2} className="mt-0.5 text-primary" aria-hidden />
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="text-xs text-muted">{desc}</span>
                  {off && (
                    <span className="mt-1 flex items-center gap-1 text-xs text-muted">
                      <CirclePause size={14} strokeWidth={2} aria-hidden />
                      停止中のため使えません
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        {method === "chat" && !aiOff && (
          <PlanChat
            listId={listId}
            spots={active.filter((s) => selected.includes(s.id)).map((s) => ({ id: s.id, name: s.name }))}
            common={{ date, startTime, endTime, mode }}
            conditions={conditions}
            onConditions={setConditions}
            onSwitchToPreferences={() => setMethod("preferences")}
          />
        )}
        {(method === "preferences" || method === "chat") && (
          <Card className="flex flex-col gap-4 p-4">
            {method === "chat" && (
              <p className="text-sm font-medium">AIが読み取った条件（作る前に確認・修正できます）</p>
            )}
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
            {method === "chat" && <ChatConditionsList conditions={conditions} spotNames={spotNames} onChange={setConditions} />}
          </Card>
        )}
      </section>

      <Button
        icon={Route}
        className="w-full"
        onClick={compute}
        loading={computing}
        disabled={
          selected.length === 0 || !origin || locatingOrigin || locatingDestination || suspended?.[mode] || (method === "chat" && aiOff)
        }
      >
        経路案を作る
      </Button>
      {!origin && (
        <p className="mt-2 text-center text-xs text-muted">出発地を指定してください（リストに拠点を設定すると自動で入ります）</p>
      )}
    </div>
  );
}
