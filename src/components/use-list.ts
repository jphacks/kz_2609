"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/app-context";
import { api, errorMessage } from "@/lib/client-api";
import type { Category, Popularity } from "@/lib/constants";

export type ListSpot = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: Category;
  postCount: number;
  likeCount: number;
  popularity: Popularity;
  stayMinutes: number;
  stayMinutesMedian: number | null;
  hourHistogram: number[];
  bestHours: number[];
  coverThumbUrl: string | null;
  mustVisit: boolean;
  addedAt: string;
  deleted: boolean;
};

export type ListData = {
  id: string;
  name: string;
  base: { label: string; lat: number; lng: number } | null;
  shareToken: string | null;
  spots: ListSpot[];
  plans: { id: string; label: string; spotCount: number; totalTravelMin: number; createdAt: string }[];
};

// リスト詳細・比較・経路作成で共通の読み込み。未ログインならログイン画面へ
export function useList(listId: string) {
  const { me, meLoaded, configured, requireLogin } = useApp();
  const [list, setList] = useState<ListData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    () =>
      api<ListData>(`/lists/${listId}`)
        .then(setList)
        .catch((e) => setError(errorMessage(e))),
    [listId],
  );

  useEffect(() => {
    if (meLoaded && configured && !me) requireLogin();
  }, [me, meLoaded, configured, requireLogin]);

  useEffect(() => {
    if (me) void reload();
  }, [me, reload]);

  return { list, setList, error, reload };
}

export function formatMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `約${h}時間${m ? `${m}分` : ""}` : `約${m}分`;
}
