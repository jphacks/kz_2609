"use client";

import {
  ArrowDown,
  ArrowUp,
  Car,
  Clock,
  Coffee,
  Footprints,
  House,
  MapPin,
  Navigation,
  Star,
  TrainFront,
  type LucideIcon,
} from "lucide-react";
import { Badge, IconButton, cn } from "@/components/ui";
import { TRAVEL_MODE_LABELS, type TravelMode } from "@/lib/constants";
import { formatClock, UNREACHABLE_MIN } from "@/lib/planner";
import type { Leg, PlanItem } from "@/lib/planner/types";

export const MODE_ICON: Record<TravelMode, LucideIcon> = { transit: TrainFront, walking: Footprints, driving: Car };
const LEG_MODES: TravelMode[] = ["walking", "driving", "transit"];
const STAY_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240];

// 区間の行：移動手段と所要時間。編集中は移動手段を切り替えられ（F-5-10）、保存後は「ナビ開始」を出す（F-5-12）
function LegRow({
  leg,
  navUrl,
  onMode,
  busy,
}: {
  leg: Leg;
  navUrl?: string;
  onMode?: (mode: TravelMode) => void;
  busy?: boolean;
}) {
  const Icon = MODE_ICON[leg.mode];
  const unreachable = leg.travelMin >= UNREACHABLE_MIN / 10;
  return (
    <div className="ml-4 flex flex-wrap items-center gap-2 py-1 pl-6 text-sm text-muted">
      <Icon size={16} strokeWidth={2} aria-hidden />
      <span>
        {TRAVEL_MODE_LABELS[leg.mode]} {unreachable ? "経路が見つかりません" : `約${leg.travelMin}分`}
        {!unreachable && leg.estimated && "（目安）"}
      </span>
      {onMode && (
        <span className="ml-auto inline-flex rounded-xl border border-border bg-surface p-0.5" role="group" aria-label="この区間の移動手段">
          {LEG_MODES.map((m) => {
            const MIcon = MODE_ICON[m];
            return (
              <button
                key={m}
                type="button"
                aria-pressed={leg.mode === m}
                disabled={busy}
                onClick={() => m !== leg.mode && onMode(m)}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs",
                  leg.mode === m ? "bg-primary-soft text-primary" : "text-muted",
                )}
              >
                <MIcon size={14} strokeWidth={2} aria-hidden />
                {TRAVEL_MODE_LABELS[m]}
              </button>
            );
          })}
        </span>
      )}
      {navUrl && (
        <a
          href={navUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex min-h-11 items-center gap-1 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-primary"
        >
          <Navigation size={16} strokeWidth={2} aria-hidden />
          ナビ開始
        </a>
      )}
    </div>
  );
}

// F-5-8：タイムライン（到着時刻・滞在時間・次までの移動手段と移動時間）
export function Timeline({
  items,
  spotNames,
  mustVisit,
  originLabel,
  destinationLabel,
  navLinks,
  editable,
  onMove,
  onStay,
  onLegMode,
  legBusy,
}: {
  items: PlanItem[];
  spotNames: Map<string, string>;
  mustVisit?: Set<string>;
  originLabel: string;
  destinationLabel?: string | null;
  navLinks?: string[];
  editable?: boolean;
  onMove?: (spotId: string, dir: -1 | 1) => void;
  onStay?: (spotId: string, stayMin: number) => void;
  // 区間の移動手段を変える（F-5-10）。legIndex は出発地からの区間の番号（0始まり）
  onLegMode?: (legIndex: number, mode: TravelMode) => void;
  legBusy?: boolean;
}) {
  const spotCount = items.filter((i) => i.type === "spot").length;
  // 各行の後ろにある区間の番号と、スポットの訪問順を先に数えておく
  let legCounter = 0;
  let spotCounter = 0;
  const rows = items.map((item) => {
    const hasLeg = (item.type === "origin" || item.type === "spot") && item.next !== null;
    return {
      item,
      legIndex: hasLeg ? legCounter++ : -1,
      spotPos: item.type === "spot" ? spotCounter++ : -1,
    };
  });

  const legRow = (leg: Leg | null, i: number) =>
    leg && (
      <LegRow
        leg={leg}
        navUrl={navLinks?.[i]}
        busy={legBusy}
        onMode={onLegMode ? (m) => onLegMode(i, m) : undefined}
      />
    );

  return (
    <ol className="flex flex-col">
      {rows.map(({ item, legIndex, spotPos }, idx) => {
        if (item.type === "origin") {
          return (
            <li key="origin">
              <div className="flex items-center gap-3 rounded-xl bg-surface-muted p-3">
                <House size={20} strokeWidth={2} className="text-primary" aria-hidden />
                <span className="w-12 font-bold tabular-nums">{formatClock(item.depart)}</span>
                <span className="min-w-0 flex-1 truncate">{originLabel} を出発</span>
              </div>
              {legRow(item.next, legIndex)}
            </li>
          );
        }
        if (item.type === "lunch") {
          return (
            <li key={`lunch-${idx}`} className="my-1 flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
              <Coffee size={20} strokeWidth={2} className="text-muted" aria-hidden />
              <span className="w-12 font-bold tabular-nums">{formatClock(item.arrive)}</span>
              <span className="flex-1">昼食休憩（{item.stayMin}分）</span>
            </li>
          );
        }
        if (item.type === "destination") {
          return (
            <li key="dest" className="flex items-center gap-3 rounded-xl bg-surface-muted p-3">
              <MapPin size={20} strokeWidth={2} className="text-primary" aria-hidden />
              <span className="w-12 font-bold tabular-nums">{formatClock(item.arrive)}</span>
              <span className="min-w-0 flex-1 truncate">{destinationLabel ?? "到着地"} に到着</span>
            </li>
          );
        }
        const name = spotNames.get(item.spotId) ?? "スポット";
        return (
          <li key={item.spotId}>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {spotPos + 1}
              </span>
              <span className="w-12 font-bold tabular-nums">{formatClock(item.arrive)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{name}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1">
                  {editable ? (
                    <label className="inline-flex items-center gap-1 text-xs text-muted">
                      <Clock size={14} strokeWidth={2} aria-hidden />
                      滞在
                      <select
                        value={item.stayMin}
                        onChange={(e) => onStay?.(item.spotId, Number(e.target.value))}
                        className="min-h-8 rounded-lg border border-border bg-surface px-1"
                        aria-label={`${name}の滞在時間`}
                      >
                        {Array.from(new Set([item.stayMin, ...STAY_OPTIONS]))
                          .sort((a, b) => a - b)
                          .map((m) => (
                            <option key={m} value={m}>
                              {m}分
                            </option>
                          ))}
                      </select>
                    </label>
                  ) : (
                    <Badge icon={Clock}>滞在 {item.stayMin}分</Badge>
                  )}
                  {item.inBestTime && <Badge tone="primary">おすすめの時間帯</Badge>}
                  {mustVisit?.has(item.spotId) && <Badge icon={Star}>必ず行きたい</Badge>}
                </div>
              </div>
              {editable && (
                <div className="flex flex-col gap-1">
                  <IconButton
                    icon={ArrowUp}
                    label="1つ前にする"
                    className="h-9 w-9"
                    disabled={spotPos === 0}
                    onClick={() => onMove?.(item.spotId, -1)}
                  />
                  <IconButton
                    icon={ArrowDown}
                    label="1つ後にする"
                    className="h-9 w-9"
                    disabled={spotPos === spotCount - 1}
                    onClick={() => onMove?.(item.spotId, 1)}
                  />
                </div>
              )}
            </div>
            {legRow(item.next, legIndex)}
          </li>
        );
      })}
    </ol>
  );
}
