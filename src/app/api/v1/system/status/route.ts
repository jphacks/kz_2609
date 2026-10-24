import { handle } from "@/lib/api";
import { isAiAvailable } from "@/lib/external/gemini";
import { isMockMode } from "@/lib/external/routing";
import { quotas } from "@/lib/external/quotas";
import { isSuspended } from "@/lib/quota";
import { getAdminSupabase } from "@/lib/supabase/server";

// F-8-5：停止中の機能一覧。移動時間は徒歩・車・公共交通とも Google Routes API（ADR-0019）
export async function GET() {
  return handle(async () => {
    const q = quotas();
    const [matrix, routes, nominatim, ai, flag] = await Promise.all([
      isSuspended(q.googleRouteMatrix),
      isSuspended(q.googleRoutes),
      isSuspended(q.nominatim),
      isSuspended(q.gemini),
      getAdminSupabase().from("system_flags").select("value").eq("key", "posting_suspended").maybeSingle(),
    ]);
    return Response.json({
      suspended: {
        transit: matrix,
        walking: matrix,
        driving: matrix,
        legs: routes,
        placeSearch: nominatim,
        posting: Boolean(flag.data?.value),
        // AIと相談（F-5-5）。キーが未設定のときも使えない
        ai: ai || !isAiAvailable(),
      },
      mockExternalApis: isMockMode(),
    });
  });
}
