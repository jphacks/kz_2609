"use client";

import dynamic from "next/dynamic";

// 地図はブラウザでだけ描く（サーバー側では読み込まない）
export const LazyMiniMap = dynamic(() => import("@/components/map/mini-map").then((m) => m.MiniMap), {
  ssr: false,
  loading: () => <div className="h-64 w-full rounded-xl bg-surface-muted" />,
});
