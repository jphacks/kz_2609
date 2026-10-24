import { handle, parseJson, rateLimit, requireUser } from "@/lib/api";
import { getLegs } from "@/lib/external/routing";
import { legsSchema } from "@/lib/validation";

// F-5-10：区間ごとの所要時間を取り直す（移動手段の変更、公共交通の実際の出発時刻での確認）
// Google Routes API の Compute Routes（Essentials）を1区間1回使う（ADR-0019）
export async function POST(request: Request) {
  return handle(async () => {
    const { user } = await requireUser();
    rateLimit(`legs:${user.id}`, 20, 60_000);
    const body = await parseJson(request, legsSchema);
    return Response.json(await getLegs(body.legs));
  });
}
