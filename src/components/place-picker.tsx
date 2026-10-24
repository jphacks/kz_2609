"use client";

import { Check, LocateFixed, MapPin, Plus, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useApp } from "@/components/app-context";
import { locateMe } from "@/components/map/spot-map";
import { Button, Chip, Notice, Spinner, cn, inputClass } from "@/components/ui";
import { api, errorMessage } from "@/lib/client-api";
import { SPOT_NAME_MAX } from "@/lib/constants";
import { formatDistance } from "@/lib/geo";

export type PickedPlace =
  | { kind: "spot"; spotId: string; name: string; lat: number; lng: number }
  | {
      kind: "new";
      name: string;
      lat: number;
      lng: number;
      source: "gps" | "search_external";
      accuracyM?: number;
      externalRef?: string;
      address?: string | null;
      prefecture?: string | null;
      city?: string | null;
    };

type DbSpot = { id: string; name: string; lat: number; lng: number; address?: string | null; distanceM?: number };
type ExtPlace = {
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  prefecture: string | null;
  city: string | null;
  externalRef: string;
};
type Nearby = { spots: DbSpot[]; canCreate: boolean; lat: number; lng: number; accuracy: number };

function PlaceRow({ title, sub, onPick }: { title: string; sub: string | null; onPick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className="flex min-h-12 w-full items-center gap-2 rounded-xl px-3 text-left hover:bg-surface-muted"
      >
        <MapPin size={16} strokeWidth={2} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{title}</span>
          {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
        </span>
        <Check size={16} strokeWidth={2} className="text-muted" aria-hidden />
      </button>
    </li>
  );
}

// F-2-5〜F-2-7：場所の指定（スポット名検索 / GPS）。地図タップ・EXIF は使わない（ADR-0006）
export function PlacePicker({
  value,
  onChange,
  allowNew = true,
}: {
  value: PickedPlace | null;
  onChange: (p: PickedPlace | null) => void;
  allowNew?: boolean;
}) {
  const { status } = useApp();
  const [mode, setMode] = useState<"gps" | "search">("gps");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nearby, setNearby] = useState<Nearby | null>(null);
  const [newName, setNewName] = useState("");
  const [query, setQuery] = useState("");
  const [dbResults, setDbResults] = useState<DbSpot[] | null>(null);
  const [extResults, setExtResults] = useState<ExtPlace[] | null>(null);

  const pickSpot = (s: DbSpot) => onChange({ kind: "spot", spotId: s.id, name: s.name, lat: s.lat, lng: s.lng });

  const useGps = async () => {
    setBusy(true);
    setError(null);
    try {
      const pos = await locateMe();
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      const r = await api<{ canCreate: boolean; spots: DbSpot[] }>(
        `/spots/nearby?lat=${lat}&lng=${lng}&accuracy=${Math.round(accuracy)}`,
      );
      setNearby({ ...r, lat, lng, accuracy });
      if (!r.canCreate) setError("位置の誤差が大きいため、候補から選んでください");
    } catch (e) {
      if (e instanceof GeolocationPositionError || (e instanceof Error && e.message === "unsupported")) {
        setError("現在地を取得できませんでした。スポット名で検索してください");
        setMode("search");
      } else {
        setError(errorMessage(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const searchDb = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    setExtResults(null);
    try {
      const r = await api<{ spots: DbSpot[] }>(`/spots/search?q=${encodeURIComponent(query.trim())}`);
      setDbResults(r.spots);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // 外部検索はボタンを押したときだけ（Nominatim の利用規約）
  const searchExternal = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ places: ExtPlace[] }>(`/places/search?q=${encodeURIComponent(query.trim())}`);
      setExtResults(r.places);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-primary bg-primary-soft p-3">
        <MapPin size={20} strokeWidth={2} className="text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{value.name}</p>
          <p className="text-xs text-muted">{value.kind === "spot" ? "登録済みのスポット" : "新しいスポットとして登録"}</p>
        </div>
        <Button variant="secondary" onClick={() => onChange(null)}>
          変更
        </Button>
      </div>
    );
  }

  const placeSearchSuspended = Boolean(status?.suspended.placeSearch);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2" role="tablist" aria-label="場所の指定方法">
        <Chip icon={LocateFixed} selected={mode === "gps"} onClick={() => setMode("gps")} role="tab" aria-selected={mode === "gps"}>
          現在地（GPS）
        </Chip>
        <Chip icon={Search} selected={mode === "search"} onClick={() => setMode("search")} role="tab" aria-selected={mode === "search"}>
          スポット名で検索
        </Chip>
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      {mode === "gps" ? (
        <div className="flex flex-col gap-3">
          <Button icon={LocateFixed} variant="secondary" onClick={useGps} loading={busy}>
            現在地の近くのスポットを探す
          </Button>
          {nearby && (
            <>
              {nearby.spots.length > 0 ? (
                <ul className="rounded-xl border border-border bg-surface">
                  {nearby.spots.map((s) => (
                    <PlaceRow
                      key={s.id}
                      title={s.name}
                      sub={s.distanceM !== undefined ? `ここから${formatDistance(s.distanceM)}` : null}
                      onPick={() => pickSpot(s)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">近くに登録済みのスポットはありません</p>
              )}
              {allowNew && nearby.canCreate && (
                <div className="flex gap-2">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    maxLength={SPOT_NAME_MAX}
                    placeholder="新しいスポットの名前"
                    aria-label="新しいスポットの名前"
                    className={inputClass}
                  />
                  <Button
                    icon={Plus}
                    disabled={newName.trim() === ""}
                    onClick={() =>
                      onChange({
                        kind: "new",
                        name: newName.trim(),
                        lat: nearby.lat,
                        lng: nearby.lng,
                        source: "gps",
                        accuracyM: nearby.accuracy,
                      })
                    }
                  >
                    登録
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <form onSubmit={searchDb} className="flex gap-2" role="search">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="例：兼六園"
              aria-label="スポット名"
              className={inputClass}
            />
            <Button icon={Search} type="submit" loading={busy && !extResults}>
              検索
            </Button>
          </form>
          {busy && !dbResults && <Spinner label="検索中" />}
          {dbResults && (
            <>
              {dbResults.length > 0 ? (
                <ul className="rounded-xl border border-border bg-surface">
                  {dbResults.map((s) => (
                    <PlaceRow key={s.id} title={s.name} sub={s.address ?? null} onPick={() => pickSpot(s)} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">登録済みのスポットには見つかりませんでした</p>
              )}
              {allowNew && (
                <Button
                  variant="secondary"
                  icon={Search}
                  onClick={searchExternal}
                  disabled={placeSearchSuspended}
                  loading={busy && dbResults !== null}
                >
                  {placeSearchSuspended ? "外部の場所検索は現在利用できません" : "地図データから探す（OpenStreetMap）"}
                </Button>
              )}
            </>
          )}
          {extResults && (
            <ul className={cn("rounded-xl border border-border bg-surface", extResults.length === 0 && "p-3")}>
              {extResults.length === 0 ? (
                <li className="text-sm text-muted">見つかりませんでした。名前を変えて試してください</li>
              ) : (
                extResults.map((p) => (
                  <PlaceRow
                    key={p.externalRef}
                    title={p.name}
                    sub={p.address}
                    onPick={() =>
                      onChange({
                        kind: "new",
                        name: p.name,
                        lat: p.lat,
                        lng: p.lng,
                        source: "search_external",
                        externalRef: p.externalRef,
                        address: p.address,
                        prefecture: p.prefecture,
                        city: p.city,
                      })
                    }
                  />
                ))
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
