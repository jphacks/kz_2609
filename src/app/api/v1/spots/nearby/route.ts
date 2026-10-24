import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, handle, parseWith, requireUser } from "@/lib/api";
import { GPS_MAX_ACCURACY_M, NEARBY_RADIUS_M } from "@/lib/constants";
import { publicImageUrl } from "@/lib/storage";

const schema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  accuracy: z.coerce.number().nonnegative().default(0),
  radius: z.coerce.number().positive().max(300).default(NEARBY_RADIUS_M),
});

type Row = { id: string; name: string; lat: number; lng: number; distance_m: number; cover_thumb_path: string | null };

// F-2-6：現在地の近くのスポット候補
export async function GET(request: NextRequest) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const q = parseWith(schema, Object.fromEntries(request.nextUrl.searchParams));
    const { data, error } = await supabase.rpc("spots_nearby", { p_lat: q.lat, p_lng: q.lng, p_radius_m: q.radius });
    dbError(error);
    return Response.json({
      // 誤差が100m以上のときは新しいスポットを作らせない
      canCreate: q.accuracy < GPS_MAX_ACCURACY_M,
      spots: ((data ?? []) as Row[]).map((r) => ({
        id: r.id,
        name: r.name,
        lat: r.lat,
        lng: r.lng,
        distanceM: Math.round(r.distance_m),
        coverThumbUrl: publicImageUrl(r.cover_thumb_path),
      })),
    });
  });
}
