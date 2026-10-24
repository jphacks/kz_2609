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

    const list = await loadList(supabase, body.listId);
    const byId = new Map(list.spots.map((s) => [s.id, s]));
    const selected = body.spotIds.map((id) => byId.get(id));
    if (selected.some((s) => !s || s.deleted)) {
      throw new ApiError("VALIDATION_ERROR", "リストにないスポット、または削除されたスポットが含まれています");
    }
    const chosen = selected as NonNullable<(typeof selected)[number]>[];

    // おまかせは「ふつう・興味なし・移動を少なく」（F-5-3）
    const prefs =
      body.method === "auto"
        ? { pace: "normal" as const, interests: [], priority: "fewer_moves" as const }
        : body.preferences;

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

    const matrix = await getTravelMatrix(points, body.mode, body.date, body.startTime);
    const input: PlanInput = {
      spots,
      hasDestination: Boolean(body.destination),
      startMin,
      endMin,
      lunchBreak: body.lunchBreak,
      mode: body.mode,
      priority: prefs.priority,
    };
    const result = computeCandidates(input, matrix);
    if (!result.ok) {
      throw new ApiError(
        "VALIDATION_ERROR",
        result.reason === "must_visit_overflow"
          ? "時間内に回りきれません。終了時刻を延ばすか、スポットを減らしてください"
          : "スポットを選んでください",
      );
    }

    // 行列は画面での再計算（F-5-10）に使う。保存はしない（ADR-0019）
    return Response.json({
      candidates: result.candidates,
      input,
      matrix: { minutes: matrix.minutes, distances: matrix.distances, walk: matrix.walk, estimated: matrix.estimated },
      notes: matrix.notes,
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
