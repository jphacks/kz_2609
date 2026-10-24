import "server-only";

import { serverEnv } from "@/lib/env";
import type { QuotaKey } from "@/lib/quota";

// 外部サービスごとの無料枠（14章）。80%で停止する
export function quotas() {
  const env = serverEnv();
  return {
    // Routes API Compute Route Matrix Essentials（組み合わせ1件ごとに数える）
    googleRouteMatrix: {
      provider: "google_routes",
      sku: "route_matrix_essentials",
      limit: env.googleRouteMatrixMonthlyFree,
    } satisfies QuotaKey,
    // Routes API Compute Routes Essentials（1回ごとに数える）
    googleRoutes: {
      provider: "google_routes",
      sku: "routes_essentials",
      limit: env.googleRoutesMonthlyFree,
    } satisfies QuotaKey,
    nominatim: { provider: "nominatim", sku: "search", daily: true, limit: env.nominatimDailyLimit } satisfies QuotaKey,
    // Gemini API（AIと相談）。1回の会話ごとに数える
    gemini: { provider: "gemini", sku: "generate_content", daily: true, limit: env.geminiDailyFree } satisfies QuotaKey,
  };
}
