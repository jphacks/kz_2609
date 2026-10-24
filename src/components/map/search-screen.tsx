"use client";

import {
  ArrowUpLeft,
  ChevronLeft,
  CircleX,
  Clock,
  Hash,
  MapPin,
  Mic,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { MapSpot } from "@/components/map/spot-map";
import { VoiceSearch, useCanVoice } from "@/components/map/voice-search";
import { Notice, Spinner, cn } from "@/components/ui";
import { api, errorMessage } from "@/lib/client-api";
import { DEMO_SPOTS, demoPopularity } from "@/lib/demo";
import { distanceM, formatDistance, type LatLng } from "@/lib/geo";
import { BUILTIN_TAGS, builtinTag, tagFromQuery } from "@/lib/hashtags";
import {
  clearHistory,
  readHistory,
  splitMatch,
  type SearchHistoryItem,
} from "@/lib/search-history";

export type SearchHit = MapSpot & { address: string | null };

// Supabase 未接続のデモ表示では、金沢のデモデータから探す（タグは用意したカテゴリのタグだけ）
export function demoSearch(q: string): SearchHit[] {
  const tag = tagFromQuery(q);
  const category = tag ? builtinTag(tag)?.category : undefined;
  const match = tag
    ? (s: (typeof DEMO_SPOTS)[number]) => s.category === category
    : (s: (typeof DEMO_SPOTS)[number]) => s.name.includes(q);
  return DEMO_SPOTS.filter(match).map((s) => ({
    id: s.id,
    name: s.name,
    lat: s.lat,
    lng: s.lng,
    category: s.category,
    postCount: s.postCount,
    likeCount: 0,
    popularity: demoPopularity(s),
    coverThumbUrl: null,
    address: `石川県${s.city}`,
  }));
}

// F-1-11：Google マップのような全画面の検索。何も入力していないときはタグと履歴、入力中は候補を出す。
// 「#自然界隈」のように # で始めるとタグ検索になる（F-1-13）
export function SearchScreen({
  configured,
  myPos,
  initialVoice,
  initialQuery = "",
  onPick,
  onPickHistory,
  onClose,
}: {
  configured: boolean;
  myPos: LatLng | null;
  initialVoice: boolean;
  initialQuery?: string;
  onPick: (hit: SearchHit) => void;
  onPickHistory: (item: SearchHistoryItem) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchHit[] | null>(null);
  const [loading, setLoading] = useState(initialQuery.trim().length > 0);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<SearchHistoryItem[]>(() =>
    readHistory(),
  );
  const [voice, setVoice] = useState(initialVoice);
  const canVoice = useCanVoice();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);

  // 入力が止まって 0.25 秒後に候補を取得する（古い応答は捨てる）
  useEffect(() => {
    const q = query.trim();
    const id = ++requestId.current;
    if (!q) return;
    const timer = setTimeout(async () => {
      try {
        const hits = configured
          ? (
              await api<{ spots: SearchHit[] }>(
                `/spots/search?q=${encodeURIComponent(q)}`,
              )
            ).spots
          : demoSearch(q);
        if (id !== requestId.current) return;
        setResults(hits);
        setError(null);
      } catch (e) {
        if (id === requestId.current) setError(errorMessage(e));
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, configured]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && !voice && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, voice]);

  const changeQuery = (q: string) => {
    setQuery(q);
    setLoading(q.trim().length > 0);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (results?.[0]) onPick(results[0]);
  };
  const tag = tagFromQuery(query);
  const distanceOf = (p: { lat: number; lng: number }) =>
    myPos ? formatDistance(distanceM(myPos, p)) : null;

  return (
    <div
      role="dialog"
      aria-label="スポットを検索"
      className="fixed inset-0 z-40 flex flex-col bg-surface"
    >
      <form onSubmit={submit} role="search" className="p-3">
        <div className="flex h-14 items-center gap-1 rounded-full bg-surface-muted px-1 shadow-sm">
          <button
            type="button"
            onClick={onClose}
            aria-label="戻る"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-surface"
          >
            <ChevronLeft size={24} strokeWidth={2} aria-hidden />
          </button>
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => changeQuery(e.target.value)}
            placeholder="ここで検索"
            aria-label="スポット名・住所で検索"
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent text-base outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                changeQuery("");
                inputRef.current?.focus();
              }}
              aria-label="入力を消す"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-surface"
            >
              <CircleX size={22} strokeWidth={2} aria-hidden />
            </button>
          ) : (
            canVoice && (
              <button
                type="button"
                onClick={() => setVoice(true)}
                aria-label="音声で検索"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-surface"
              >
                <Mic size={22} strokeWidth={2} aria-hidden />
              </button>
            )
          )}
        </div>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        {error && (
          <Notice tone="error" className="mx-3 mb-2">
            {error}
          </Notice>
        )}

        {!query.trim() ? (
          <>
            <section aria-label="タグで探す" className="px-4 pb-2">
              <h2 className="py-2 text-sm font-medium">タグで探す</h2>
              <div className="flex flex-wrap gap-2">
                {BUILTIN_TAGS.map((t) => (
                  <button
                    key={t.tag}
                    type="button"
                    onClick={() => changeQuery(`#${t.tag}`)}
                    className="inline-flex min-h-10 items-center gap-1 rounded-full border border-border px-3 text-sm text-primary hover:bg-surface-muted"
                  >
                    <Hash size={16} strokeWidth={2} aria-hidden />
                    {t.tag}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">
                投稿のコメントに「#夜景」のように書いたタグでも探せます
              </p>
            </section>
            <section aria-label="履歴">
              <div className="flex items-center justify-between px-4 py-2">
                <h2 className="text-sm font-medium">履歴</h2>
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      clearHistory();
                      setHistory([]);
                    }}
                    className="min-h-11 px-2 text-sm text-primary"
                  >
                    履歴を消去
                  </button>
                )}
              </div>
              {history.length === 0 ? (
                <p className="px-4 text-sm text-muted">
                  検索して選んだ場所がここに表示されます（この端末にだけ保存します）
                </p>
              ) : (
                <ul>
                  {history.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        onClick={() => onPickHistory(h)}
                        className="flex w-full items-center gap-4 px-4 text-left hover:bg-surface-muted"
                      >
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                          <Clock size={20} strokeWidth={2} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1 border-b border-border py-3">
                          <span className="block truncate">{h.name}</span>
                          {h.address && (
                            <span className="block truncate text-sm text-muted">
                              {h.address}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : loading && !results ? (
          <Spinner label="探しています" />
        ) : results && results.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted">
            {tag
              ? `「#${tag}」のついたスポットはまだありません。投稿のコメントに「#${tag}」と書くと、ここに出るようになります`
              : `「${query.trim()}」に一致するスポットはありません`}
          </p>
        ) : (
          <>
            {tag && results && (
              <h2 className="px-4 py-2 text-sm font-medium">
                #{tag} のスポット {results.length}件
              </h2>
            )}
            <ul aria-label="候補">
              {(results ?? []).map((r) => {
                const dist = distanceOf(r);
                return (
                  <li key={r.id} className="flex items-stretch">
                    <button
                      type="button"
                      onClick={() => onPick(r)}
                      className="flex min-w-0 flex-1 items-center gap-4 pl-4 text-left hover:bg-surface-muted"
                    >
                      <span className="flex w-12 shrink-0 flex-col items-center gap-0.5">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted">
                          <MapPin size={20} strokeWidth={2} aria-hidden />
                        </span>
                        {dist && (
                          <span className="text-xs text-muted">{dist}</span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1 border-b border-border py-3">
                        <span className="block truncate">
                          {splitMatch(r.name, tag ? "" : query).map((p, i) => (
                            <span
                              key={i}
                              className={cn(p.typed && "text-muted")}
                            >
                              {p.text}
                            </span>
                          ))}
                        </span>
                        {r.address && (
                          <span className="block truncate text-sm text-muted">
                            {r.address}
                          </span>
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        changeQuery(r.name);
                        inputRef.current?.focus();
                      }}
                      aria-label={`「${r.name}」を検索欄に入れる`}
                      className="inline-flex w-14 shrink-0 items-center justify-center border-b border-border text-muted hover:bg-surface-muted"
                    >
                      <ArrowUpLeft size={22} strokeWidth={2} aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {voice && (
        <VoiceSearch
          onClose={() => setVoice(false)}
          onResult={(t) => {
            setVoice(false);
            changeQuery(t);
          }}
        />
      )}
    </div>
  );
}
