import "server-only";

import { getAdminSupabase } from "@/lib/supabase/server";

// 無料枠の管理（F-8）。呼び出す前に件数を確認し、80%を超えるなら false（停止中）
export type QuotaKey = { provider: string; sku: string; daily?: boolean; limit: number };

function period(daily: boolean) {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000); // 日本時間
  return daily ? now.toISOString().slice(0, 10) : now.toISOString().slice(0, 7);
}

export async function consumeQuota(key: QuotaKey, units: number): Promise<boolean> {
  const admin = getAdminSupabase();
  const { data, error } = await admin.rpc("consume_api_quota", {
    p_provider: key.provider,
    p_sku: key.sku,
    p_period: period(key.daily ?? false),
    p_units: units,
    p_limit: key.limit,
  });
  if (error) {
    console.error("consume_api_quota failed", error);
    return false;
  }
  if (data === false) {
    console.warn(`[quota] ${key.provider}/${key.sku} は無料枠の80%に達したため停止中`);
  }
  return data === true;
}

export async function isSuspended(key: QuotaKey): Promise<boolean> {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("api_usage")
    .select("suspended_at")
    .eq("provider", key.provider)
    .eq("sku", key.sku)
    .eq("period", period(key.daily ?? false))
    .maybeSingle();
  return Boolean(data?.suspended_at);
}
