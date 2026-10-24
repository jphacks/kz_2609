import { ApiError, handle, parseJson, rateLimit, requireUser } from "@/lib/api";
import { askConditions } from "@/lib/external/gemini";
import { loadList } from "@/lib/lists";
import { CHAT_MAX_TURNS, EMPTY_CONDITIONS } from "@/lib/plan-chat";
import { planChatSchema } from "@/lib/validation";

// F-5-5：AIと相談。会話を経路作成の条件に変換するだけで、経路は /plans/compute で計算する。
// AIに送るのは会話・リスト内のスポット名・共通の条件だけ。会話は保存しない
export async function POST(request: Request) {
  return handle(async () => {
    const { supabase, user } = await requireUser();
    rateLimit(`chat:${user.id}`, 5, 60_000);
    const body = await parseJson(request, planChatSchema);

    const turns = body.messages.filter((m) => m.role === "user").length;
    if (turns > CHAT_MAX_TURNS) throw new ApiError("VALIDATION_ERROR", `会話は${CHAT_MAX_TURNS}往復までです`);
    if (body.messages[body.messages.length - 1].role !== "user") {
      throw new ApiError("VALIDATION_ERROR", "メッセージを入力してください");
    }
    if (body.startTime >= body.endTime) throw new ApiError("VALIDATION_ERROR", "終了時刻は開始時刻より後にしてください");

    // 本人のリストか、選んだスポットがリストに入っているかを確かめる
    const list = await loadList(supabase, body.listId);
    const byId = new Map(list.spots.map((s) => [s.id, s]));
    const spots = body.spotIds.map((id) => byId.get(id));
    if (spots.some((s) => !s || s.deleted)) {
      throw new ApiError("VALIDATION_ERROR", "リストにないスポット、または削除されたスポットが含まれています");
    }

    const result = await askConditions(
      body.messages,
      spots.map((s) => ({ id: s!.id, name: s!.name, category: s!.category })),
      { date: body.date, startTime: body.startTime, endTime: body.endTime, mode: body.mode },
      body.conditions ?? EMPTY_CONDITIONS,
    );
    return Response.json(result);
  });
}
