import { ApiError, handle, parseJson, rateLimit, requireUser } from "@/lib/api";
import { getTravelMatrix, type MatrixPoint } from "@/lib/external/routing";
import { loadList } from "@/lib/lists";
import { computeCandidates, computeStayMin, parseClock } from "@/lib/planner";
import type { PlanInput, PlanSpot } from "@/lib/planner/types";
import { computePlanSchema } from "@/lib/validation";

const pointKey = (lat: number, lng: number) => `pt:${lat.toFixed(4)},${lng.toFixed(4)}`;

// F-5：経路案の作成（保存しない・最大3案）。外部APIは移動時間の行列を1回だけ呼ぶ
export async function POST(request: Request) {
  return handle(async () => {
    const { supabase, user } = await requireUser();
    rateLimit(`plan:${user.id}`, 3, 60_000);
    const body = await parseJson(request, computePlanSchema);

    const startMin = parseClock(body.startTime);
    const endMin = parseClock(body.endTime);
    if (endMin <= startMin) throw new ApiError("VALIDATION_ERROR", "終了時刻は開始時刻より後にしてください");
    const lunch = { from: parseClock(body.lunchFrom), until: parseClock(body.lunchUntil), min: body.lunchMin };
    if (body.lunchBreak && lunch.until <= lunch.from) {
      throw new ApiError("VALIDATION_ERROR", "昼食の時間帯は、終わりを始まりより後にしてください");
    }

    const list = await loadList(supabase, body.listId);
    const byId = new Map(list.spots.map((s) => [s.id, s]));
    const selected = body.spotIds.map((id) => byId.get(id));
    if (selected.some((s) => !s || s.deleted)) {
      throw new ApiError("VALIDATION_ERROR", "リストにないスポット、または削除されたスポットが含まれています");
    }
    // おまかせは「ふつう・興味なし・移動を少なく」（F-5-3）。時刻の指定などは AIと相談のときだけ使う（F-5-5）
    const prefs =
      body.method === "auto"
        ? { pace: "normal" as const, interests: [], priority: "fewer_moves" as const }
        : body.preferences;
    const chat = body.method === "chat" ? body.preferences : null;

    // AIと相談で「行かない」としたスポットは対象から外す
    const excluded = new Set(chat?.exclude ?? []);
    const chosen = (selected as NonNullable<(typeof selected)[number]>[]).filter((s) => !excluded.has(s.id));
    if (chosen.length === 0) throw new ApiError("VALIDATION_ERROR", "すべてのスポットが除外されています。条件を見直してください");
    const chosenIds = new Set(chosen.map((s) => s.id));

    const spots: PlanSpot[] = chosen.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      stayMin: computeStayMin({ category: s.category, stayMinutesMedian: s.stayMinutesMedian }, prefs.pace, prefs.interests),
      bestHours: s.bestHours,
      mustVisit: s.mustVisit,
    }));

    const points: MatrixPoint[] = [
      { key: pointKey(body.origin.lat, body.origin.lng), lat: body.origin.lat, lng: body.origin.lng },
      ...chosen.map((s) => ({ key: s.id, lat: s.lat, lng: s.lng })),
    ];
    if (body.destination) {
      const d = body.destination;
      points.push({ key: pointKey(d.lat, d.lng), lat: d.lat, lng: d.lng });
    }

    const matrix = await getTravelMatrix(points, body.mode);
    const input: PlanInput = {
      spots,
      hasDestination: Boolean(body.destination),
      startMin,
      endMin,
      lunchBreak: body.lunchBreak,
      lunch,
      mode: body.mode,
      priority: prefs.priority,
      timeWindows: (chat?.timeWindows ?? [])
        .filter((w) => chosenIds.has(w.spotId))
        .map((w) => ({ spotId: w.spotId, from: parseClock(w.from), to: parseClock(w.to) })),
      orderHints: (chat?.orderHints ?? []).filter(
        (h) => chosenIds.has(h.spotId) && (!h.relativeTo || chosenIds.has(h.relativeTo)),
      ),
    };
    const result = computeCandidates(input, matrix);
    if (!result.ok) {
      throw new ApiError(
        "VALIDATION_ERROR",
        result.reason === "must_visit_overflow"
          ? chat && (input.timeWindows?.length || input.orderHints?.length)
            ? "時刻や順番の希望をすべて満たす回り方が見つかりません。希望を減らすか、終了時刻を延ばしてください"
            : "時間内に回りきれません。終了時刻を延ばすか、スポットを減らしてください"
          : "スポットを選んでください",
      );
    }

    // 行列は画面での再計算（F-5-10）に使う。保存はしない（ADR-0019）
    return Response.json({
      candidates: result.candidates,
      input,
      matrix: { minutes: matrix.minutes, distances: matrix.distances, walk: matrix.walk, estimated: matrix.estimated },
      notes: matrix.notes,
      excluded: [...excluded].filter((id) => byId.has(id)),
      spots: chosen.map((s) => ({
        id: s.id,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        category: s.category,
        coverThumbUrl: s.coverThumbUrl,
      })),
    });
  });
}
