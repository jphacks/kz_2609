// 入力チェック（クライアントとサーバーで同じルールを使う。9.1）
import { z } from "zod";
import {
  CATEGORIES,
  COMMENT_MAX,
  LIST_NAME_MAX,
  LUNCH_DEFAULT,
  LUNCH_DURATIONS,
  MAX_IMAGES,
  MAX_PLAN_SPOTS,
  MAX_UPLOAD_BYTES,
  PACES,
  PRIORITIES,
  SPOT_NAME_MAX,
  STAY_DURATIONS,
  TRAVEL_MODES,
} from "@/lib/constants";
import { CHAT_MAX_TURNS, CHAT_MESSAGE_MAX } from "@/lib/plan-chat";

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

// 「AIと相談」で読み取った条件（F-5-5）。おまかせ・選択式では空のまま
const spotWindow = z
  .object({ spotId: id, from: clock, to: clock })
  .refine((w) => w.from < w.to, { message: "時刻の範囲が正しくありません" });
const orderHint = z.object({
  spotId: id,
  position: z.enum(["first", "last", "before", "after"]),
  relativeTo: id.optional(),
});

export const chatConditionsSchema = z.object({
  pace: z.enum(PACES),
  interests: z.array(z.enum(CATEGORIES)).max(CATEGORIES.length),
  priority: z.enum(PRIORITIES),
  timeWindows: z.array(spotWindow).max(MAX_PLAN_SPOTS).default([]),
  orderHints: z.array(orderHint).max(MAX_PLAN_SPOTS * 2).default([]),
  exclude: z.array(id).max(MAX_PLAN_SPOTS).default([]),
});

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
  // 昼食休憩の時間帯と長さ（F-5-2。v0.28）。古い画面から送られた場合は初期値
  lunchFrom: clock.default(LUNCH_DEFAULT.from),
  lunchUntil: clock.default(LUNCH_DEFAULT.until),
  lunchMin: z
    .number()
    .int()
    .refine((m) => (LUNCH_DURATIONS as readonly number[]).includes(m), { message: "昼食の長さを選び直してください" })
    .default(LUNCH_DEFAULT.min),
  method: z.enum(["auto", "preferences", "chat"], { message: "この作り方は現在利用できません" }),
  preferences: chatConditionsSchema,
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
  method: z.enum(["auto", "preferences", "chat"]),
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

// POST /plans/chat（AIと相談。F-5-5）。会話は保存しない
export const planChatSchema = z.object({
  listId: id,
  spotIds: z
    .array(id)
    .min(1, { message: "スポットを1か所以上選んでください" })
    .max(MAX_PLAN_SPOTS, { message: `経路を作れるのは${MAX_PLAN_SPOTS}か所までです` }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: clock,
  endTime: clock,
  mode: z.enum(TRAVEL_MODES),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z
          .string()
          .trim()
          .min(1, { message: "メッセージを入力してください" })
          .max(CHAT_MESSAGE_MAX, { message: `メッセージは${CHAT_MESSAGE_MAX}文字以内で入力してください` }),
      }),
    )
    .min(1, { message: "メッセージを入力してください" })
    .max(CHAT_MAX_TURNS * 2, { message: `会話は${CHAT_MAX_TURNS}往復までです` }),
  conditions: chatConditionsSchema.optional(),
});
