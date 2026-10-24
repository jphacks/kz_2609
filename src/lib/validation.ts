// 入力チェック（クライアントとサーバーで同じルールを使う。9.1）
import { z } from "zod";
import {
  CATEGORIES,
  COMMENT_MAX,
  LIST_NAME_MAX,
  MAX_IMAGES,
  MAX_PLAN_SPOTS,
  MAX_UPLOAD_BYTES,
  PACES,
  PRIORITIES,
  SPOT_NAME_MAX,
  STAY_DURATIONS,
  TRAVEL_MODES,
} from "@/lib/constants";

const id = z.string().uuid({ message: "IDの形式が正しくありません" });
const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);

export const commentSchema = z
  .string()
  .max(COMMENT_MAX, { message: `コメントは${COMMENT_MAX}文字以内で入力してください` });

export const uploadRequestSchema = z.object({
  files: z
    .array(
      z.object({
        kind: z.enum(["full", "thumb"]),
        contentType: z.enum(["image/webp", "image/jpeg"]),
        size: z.number().int().positive().max(MAX_UPLOAD_BYTES, { message: "画像が大きすぎます（2MBまで）" }),
      }),
    )
    .min(1)
    .max(MAX_IMAGES * 2),
});

export const newSpotSchema = z.object({
  name: z.string().trim().min(1, { message: "スポット名を入力してください" }).max(SPOT_NAME_MAX, {
    message: `スポット名は${SPOT_NAME_MAX}文字以内で入力してください`,
  }),
  lat,
  lng,
  source: z.enum(["gps", "search_external"]),
  accuracyM: z.number().nonnegative().optional(),
  externalRef: z.string().max(100).optional(),
  address: z.string().max(300).nullable().optional(),
  prefecture: z.string().max(20).nullable().optional(),
  city: z.string().max(40).nullable().optional(),
});

export const createPostSchema = z
  .object({
    spotId: id.optional(),
    newSpot: newSpotSchema.optional(),
    images: z
      .array(
        z.object({
          fullPath: z.string().min(1),
          thumbPath: z.string().min(1),
          width: z.number().int().positive(),
          height: z.number().int().positive(),
        }),
      )
      .min(1, { message: "写真を1枚以上選んでください" })
      .max(MAX_IMAGES, { message: `写真は${MAX_IMAGES}枚までです` }),
    comment: commentSchema.default(""),
    category: z.enum(CATEGORIES, { message: "カテゴリを選んでください" }),
    stayDuration: z.enum(STAY_DURATIONS).nullable().default(null),
  })
  .refine((v) => Boolean(v.spotId) !== Boolean(v.newSpot), { message: "スポットを選んでください" });

export const updatePostSchema = z.object({
  comment: commentSchema.optional(),
  category: z.enum(CATEGORIES).optional(),
  stayDuration: z.enum(STAY_DURATIONS).nullable().optional(),
});

export const listNameSchema = z
  .string()
  .trim()
  .min(1, { message: "リスト名を入力してください" })
  .max(LIST_NAME_MAX, { message: `リスト名は${LIST_NAME_MAX}文字以内で入力してください` });

export const updateListSchema = z.object({
  name: listNameSchema.optional(),
  base: z
    .object({ label: z.string().trim().min(1).max(50), lat, lng })
    .nullable()
    .optional(),
});

export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, { message: "表示名を入力してください" })
    .max(20, { message: "表示名は20文字以内で入力してください" }),
});

const clock = z.string().regex(/^\d{2}:\d{2}$/, { message: "時刻の形式が正しくありません" });
const place = z.object({ lat, lng, label: z.string().min(1).max(50) });

export const computePlanSchema = z.object({
  listId: id,
  spotIds: z
    .array(id)
    .min(1, { message: "スポットを1か所以上選んでください" })
    .max(MAX_PLAN_SPOTS, { message: `経路を作れるのは${MAX_PLAN_SPOTS}か所までです` }),
  origin: place,
  destination: place.nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: clock,
  endTime: clock,
  mode: z.enum(TRAVEL_MODES),
  lunchBreak: z.boolean(),
  method: z.enum(["auto", "preferences"], { message: "この作り方は現在利用できません" }),
  preferences: z.object({
    pace: z.enum(PACES),
    interests: z.array(z.enum(CATEGORIES)).max(CATEGORIES.length),
    priority: z.enum(PRIORITIES),
  }),
});

export type ComputePlanRequest = z.infer<typeof computePlanSchema>;

// 区間ごとの所要時間の取り直し（F-5-10。ADR-0019）
export const legsSchema = z.object({
  legs: z
    .array(
      z.object({
        from: z.object({ lat, lng }),
        to: z.object({ lat, lng }),
        mode: z.enum(TRAVEL_MODES),
        departAt: z.string().datetime({ offset: true }),
      }),
    )
    .min(1)
    .max(MAX_PLAN_SPOTS + 2),
});

export const savePlanSchema = z.object({
  listId: id,
  method: z.enum(["auto", "preferences"]),
  params: computePlanSchema,
  candidate: z.object({
    kind: z.string(),
    label: z.string(),
    reason: z.string(),
    order: z.array(id).min(1).max(MAX_PLAN_SPOTS),
    items: z.array(z.record(z.string(), z.unknown())),
    skipped: z.array(z.object({ spotId: id, reason: z.string() })),
    stats: z.object({
      spotCount: z.number(),
      totalTravelMin: z.number(),
      walkM: z.number(),
      endAt: z.number(),
      bestTimeHits: z.number(),
    }),
  }),
  spots: z.array(z.object({ id, name: z.string(), lat, lng })).max(MAX_PLAN_SPOTS),
});
