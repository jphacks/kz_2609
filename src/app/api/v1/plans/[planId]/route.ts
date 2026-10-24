import { z } from "zod";
import { ApiError, dbError, handle, parseWith, requireUser } from "@/lib/api";
import type { TravelMode } from "@/lib/constants";
import type { PlanItem } from "@/lib/planner/types";

type Pt = { lat: number; lng: number; label?: string; name?: string };

// F-5-12・ADR-0019：当日の道案内は Googleマップの URL で開く（APIキー不要・無料）
function navUrl(from: Pt, to: Pt, mode: TravelMode) {
  const params = new URLSearchParams({
    api: "1",
    origin: `${from.lat},${from.lng}`,
    destination: `${to.lat},${to.lng}`,
    travelmode: mode,
  });
  return `https://www.google.com/maps/dir/?${params}`;
}

// F-5-13：出発地から到着地までを訪問順の立ち寄り先（waypoints）でつないだ1本の経路。
// Googleマップは公共交通の経路に立ち寄り先を入れられないため、公共交通のプランは徒歩で開く
function fullRouteUrl(stops: Pt[], mode: TravelMode) {
  const at = (p: Pt) => `${p.lat},${p.lng}`;
  const params = new URLSearchParams({
    api: "1",
    origin: at(stops[0]),
    destination: at(stops[stops.length - 1]),
    travelmode: mode === "transit" ? "walking" : mode,
  });
  const waypoints = stops.slice(1, -1).map(at);
  if (waypoints.length > 0) params.set("waypoints", waypoints.join("|"));
  return `https://www.google.com/maps/dir/?${params}`;
}

async function loadPlan(planId: string) {
  parseWith(z.string().uuid({ message: "経路プランが見つかりませんでした" }), planId);
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("plans")
    .select("id,wishlist_id,method,params,result,total_travel_min,created_at,wishlists(name)")
    .eq("id", planId)
    .maybeSingle();
  dbError(error);
  if (!data) throw new ApiError("NOT_FOUND", "経路プランが見つかりませんでした");
  return { supabase, plan: data };
}

// F-5-11〜F-5-13：保存済みプラン（各区間と全体のナビ用URL付き）
export async function GET(_req: Request, ctx: RouteContext<"/api/v1/plans/[planId]">) {
  return handle(async () => {
    const { planId } = await ctx.params;
    const { plan } = await loadPlan(planId);
    const params = plan.params as { mode: TravelMode; date: string; origin: Pt; destination: Pt | null };
    const result = plan.result as {
      label: string;
      reason: string;
      items: PlanItem[];
      skipped: { spotId: string; reason: string }[];
      stats: Record<string, number>;
      spots: Array<{ id: string; name: string; lat: number; lng: number }>;
    };
    const spotById = new Map(result.spots.map((s) => [s.id, s]));

    // 区間ごとに出発点と到着点を並べ、ナビのURLを作る
    const stops: Pt[] = [params.origin];
    for (const item of result.items) {
      if (item.type !== "spot") continue;
      const s = spotById.get(item.spotId);
      if (s) stops.push(s);
    }
    if (params.destination) stops.push(params.destination);
    // 区間ごとの移動手段（F-5-10 で変更した場合はそちら）で URL を作る
    const legModes = result.items.flatMap((item) =>
      (item.type === "origin" || item.type === "spot") && item.next ? [item.next.mode] : [],
    );
    const navLinks = stops.slice(1).map((to, i) => navUrl(stops[i], to, legModes[i] ?? params.mode));
    const fullRoute = stops.length >= 2 ? { url: fullRouteUrl(stops, params.mode), stopCount: stops.length } : null;

    const list = plan.wishlists as unknown as { name: string } | null;
    return Response.json({
      id: plan.id,
      listId: plan.wishlist_id,
      listName: list?.name ?? "",
      method: plan.method,
      params: plan.params,
      label: result.label,
      reason: result.reason,
      items: result.items,
      skipped: result.skipped,
      stats: result.stats,
      spots: result.spots,
      navLinks,
      fullRoute,
      createdAt: plan.created_at,
    });
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/v1/plans/[planId]">) {
  return handle(async () => {
    const { planId } = await ctx.params;
    const { supabase } = await loadPlan(planId);
    const { error } = await supabase.from("plans").delete().eq("id", planId);
    dbError(error, "経路プランの削除に失敗しました");
    return Response.json({ ok: true });
  });
}
