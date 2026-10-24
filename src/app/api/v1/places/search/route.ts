import type { NextRequest } from "next/server";
import { ApiError, handle, rateLimit, requireUser } from "@/lib/api";
import { searchPlaces } from "@/lib/external/nominatim";

// F-2-7：外部の場所検索（Nominatim）。「検索」ボタンを押したときだけ呼ぶ
export async function GET(request: NextRequest) {
  return handle(async () => {
    const { user } = await requireUser();
    rateLimit(`places:${user.id}`, 1, 1000);
    const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length === 0 || q.length > 100) throw new ApiError("VALIDATION_ERROR", "検索する場所の名前を入力してください");
    return Response.json({ places: await searchPlaces(q) });
  });
}
