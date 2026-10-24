// 「AIと相談」（F-5-5）の共通処理。AIの呼び出し以外（指示文・返答の検証・モック）は純粋な関数にしてテストする
import { z } from "zod";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  PACES,
  PACE_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  TRAVEL_MODE_LABELS,
  type Category,
  type TravelMode,
} from "@/lib/constants";
import type { ChatConditions, OrderHint } from "@/lib/planner/types";

// 会話は最大10往復（F-5-5）
export const CHAT_MAX_TURNS = 10;
export const CHAT_MESSAGE_MAX = 500;
export const CHAT_REPLY_MAX = 300;

export const UNCLEAR_REPLY = "うまく読み取れませんでした。もう少し具体的に教えてください";

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ChatSpot = { id: string; name: string; category: Category };
export type ChatCommon = { date: string; startTime: string; endTime: string; mode: TravelMode };
export type ChatReply = { reply: string; conditions: ChatConditions; unclear: boolean };

export const EMPTY_CONDITIONS: ChatConditions = {
  pace: "normal",
  interests: [],
  priority: "fewer_moves",
  timeWindows: [],
  orderHints: [],
  exclude: [],
};

// 8.1：絵文字は使わない。AIの返答に含まれていたら表示前に取り除く
export function stripEmoji(text: string): string {
  return text
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const clockRe = /^([01]\d|2[0-3]):[0-5]\d$/;

// AIの返答（JSON）。形が違う・値がおかしいものは捨てて、リスト内のスポットだけを残す
const looseReply = z.object({
  reply: z.string(),
  unclear: z.boolean().optional(),
  conditions: z
    .object({
      pace: z.string().optional(),
      interests: z.array(z.string()).optional(),
      priority: z.string().optional(),
      timeWindows: z.array(z.object({ spotId: z.string(), from: z.string(), to: z.string() })).optional(),
      orderHints: z
        .array(z.object({ spotId: z.string(), position: z.string(), relativeTo: z.string().nullish() }))
        .optional(),
      exclude: z.array(z.string()).optional(),
    })
    .optional(),
});

export function sanitizeReply(raw: unknown, spotIds: string[], previous: ChatConditions): ChatReply {
  const parsed = looseReply.safeParse(raw);
  if (!parsed.success) return { reply: UNCLEAR_REPLY, conditions: previous, unclear: true };
  const allowed = new Set(spotIds);
  const c = parsed.data.conditions ?? {};
  const conditions: ChatConditions = {
    pace: (PACES as readonly string[]).includes(c.pace ?? "") ? (c.pace as ChatConditions["pace"]) : previous.pace,
    interests: c.interests
      ? [...new Set(c.interests.filter((i): i is Category => (CATEGORIES as readonly string[]).includes(i) && i !== "other"))]
      : previous.interests,
    priority: (PRIORITIES as readonly string[]).includes(c.priority ?? "")
      ? (c.priority as ChatConditions["priority"])
      : previous.priority,
    timeWindows: c.timeWindows
      ? dedupe(
          c.timeWindows.filter((w) => allowed.has(w.spotId) && clockRe.test(w.from) && clockRe.test(w.to) && w.from < w.to),
          (w) => w.spotId,
        )
      : previous.timeWindows,
    orderHints: c.orderHints
      ? c.orderHints.flatMap((h): OrderHint[] => {
          if (!allowed.has(h.spotId)) return [];
          if (h.position === "first" || h.position === "last") return [{ spotId: h.spotId, position: h.position }];
          if ((h.position === "before" || h.position === "after") && h.relativeTo && allowed.has(h.relativeTo) && h.relativeTo !== h.spotId) {
            return [{ spotId: h.spotId, position: h.position, relativeTo: h.relativeTo }];
          }
          return [];
        })
      : previous.orderHints,
    exclude: c.exclude ? [...new Set(c.exclude.filter((id) => allowed.has(id)))] : previous.exclude,
  };
  const reply = stripEmoji(parsed.data.reply).slice(0, CHAT_REPLY_MAX);
  const unclear = Boolean(parsed.data.unclear) || reply === "";
  return { reply: reply || UNCLEAR_REPLY, conditions, unclear };
}

function dedupe<T>(items: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((t) => (seen.has(key(t)) ? false : (seen.add(key(t)), true)));
}

// AIへの指示。送るのは会話・リスト内のスポット名・共通の条件だけ（F-5-5。ユーザー名やメールは送らない）
export function buildSystemPrompt(spots: ChatSpot[], common: ChatCommon, current: ChatConditions): string {
  const spotLines = spots.map((s) => `- ${s.id}：${s.name}（${CATEGORY_LABELS[s.category]}）`).join("\n");
  return [
    "あなたは旅行の計画を手伝うアシスタントです。ユーザーの希望を、経路を作るための条件に変換するのが仕事です。",
    "経路そのもの（回る順番や時刻表）は別のプログラムが計算するので、あなたは作らないでください。",
    "",
    "# ルール",
    "- 必ず決められた JSON の形だけで答える。",
    "- reply は日本語で2文以内。読み取った条件を短く伝え、必要なら1つだけ質問する。絵文字は使わない。",
    "- スポットは下の一覧の ID だけを使う。一覧にない場所の希望は reply で「リストにないため扱えません」と伝える。",
    `- 時刻は HH:MM（24時間表記）。${common.startTime}〜${common.endTime} の範囲に収める。`,
    "- 「夕日」は 16:00〜17:30、「朝」「午前」は開始時刻〜11:30、「混む前」は開始時刻から1時間以内を目安にする。",
    "- 前回までの条件のうち、ユーザーが変えていないものはそのまま残す。",
    "- 希望が読み取れないときは unclear を true にし、reply で具体的に聞き返す。",
    "",
    "# 選べる値",
    `- pace（ペース）：${PACES.map((p) => `${p}=${PACE_LABELS[p]}`).join(" / ")}`,
    `- interests（重視するもの。複数可）：${CATEGORIES.filter((c) => c !== "other").map((c) => `${c}=${CATEGORY_LABELS[c]}`).join(" / ")}`,
    `- priority（優先すること）：${PRIORITIES.map((p) => `${p}=${PRIORITY_LABELS[p]}`).join(" / ")}`,
    "- timeWindows：スポットごとの到着時刻の範囲 { spotId, from, to }",
    "- orderHints：行く順番の希望 { spotId, position: first|last|before|after, relativeTo }（before/after は relativeTo が必要）",
    "- exclude：今回は行かないスポットの ID",
    "",
    "# 回るスポット",
    spotLines,
    "",
    "# 共通の条件",
    `- 日付：${common.date}、時間：${common.startTime}〜${common.endTime}、移動手段：${TRAVEL_MODE_LABELS[common.mode]}`,
    "",
    "# 前回までの条件",
    JSON.stringify(current),
  ].join("\n");
}

// Gemini の responseSchema（OpenAPI 3.0 の一部）。スポット ID は一覧の値に限定する
export function buildResponseSchema(spotIds: string[]) {
  const spotId = { type: "STRING", enum: spotIds };
  return {
    type: "OBJECT",
    properties: {
      reply: { type: "STRING" },
      unclear: { type: "BOOLEAN" },
      conditions: {
        type: "OBJECT",
        properties: {
          pace: { type: "STRING", enum: [...PACES] },
          interests: { type: "ARRAY", items: { type: "STRING", enum: CATEGORIES.filter((c) => c !== "other") } },
          priority: { type: "STRING", enum: [...PRIORITIES] },
          timeWindows: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { spotId, from: { type: "STRING" }, to: { type: "STRING" } },
              required: ["spotId", "from", "to"],
            },
          },
          orderHints: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                spotId,
                position: { type: "STRING", enum: ["first", "last", "before", "after"] },
                relativeTo: spotId,
              },
              required: ["spotId", "position"],
            },
          },
          exclude: { type: "ARRAY", items: spotId },
        },
        required: ["pace", "interests", "priority", "timeWindows", "orderHints", "exclude"],
      },
    },
    required: ["reply", "unclear", "conditions"],
  };
}

// 開発用のモック（F-8-8）。キーがなくても画面を試せるよう、よくある言い回しだけを読み取る
export function mockReply(messages: ChatMessage[], spots: ChatSpot[], common: ChatCommon, current: ChatConditions): ChatReply {
  const text = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const next: ChatConditions = structuredClone(current);
  const heard: string[] = [];

  if (/ゆっくり|のんびり|ゆったり/.test(text)) {
    next.pace = "relaxed";
    heard.push("ペースはゆったり");
  } else if (/たくさん|いっぱい|詰め/.test(text)) {
    next.pace = "packed";
    heard.push("たくさん回るペース");
  }
  if (/歩.*(少な|短|疲)|あまり歩/.test(text)) {
    next.priority = "less_walking";
    heard.push("歩く距離を少なく");
  } else if (/移動.*少な/.test(text)) {
    next.priority = "fewer_moves";
    heard.push("移動を少なく");
  }
  const interestWords: [Category, RegExp][] = [
    ["photogenic", /写真|映え|撮/],
    ["gourmet", /グルメ|食べ|ご飯|カフェ/],
    ["history", /歴史|文化|寺|城/],
    ["nature", /自然|庭|公園|海/],
  ];
  for (const [cat, re] of interestWords) {
    if (re.test(text) && !next.interests.includes(cat)) {
      next.interests.push(cat);
      heard.push(`${CATEGORY_LABELS[cat]}を重視`);
    }
  }
  for (const s of spots) {
    if (!text.includes(s.name)) continue;
    const window = /夕日|夕方/.test(text)
      ? { from: "16:00", to: "17:30" }
      : /朝|午前|混む前/.test(text)
        ? { from: common.startTime, to: "11:30" }
        : null;
    if (window) {
      next.timeWindows = [...next.timeWindows.filter((w) => w.spotId !== s.id), { spotId: s.id, ...window }];
      heard.push(`${s.name}は${window.from}〜${window.to}に到着`);
    }
    if (/行かない|外し|やめ/.test(text)) {
      next.exclude = [...new Set([...next.exclude, s.id])];
      heard.push(`${s.name}は外す`);
    }
    if (/最初/.test(text)) {
      next.orderHints = [...next.orderHints.filter((h) => h.spotId !== s.id), { spotId: s.id, position: "first" }];
      heard.push(`${s.name}を最初に`);
    } else if (/最後/.test(text)) {
      next.orderHints = [...next.orderHints.filter((h) => h.spotId !== s.id), { spotId: s.id, position: "last" }];
      heard.push(`${s.name}を最後に`);
    }
  }
  if (heard.length === 0) return { reply: UNCLEAR_REPLY, conditions: current, unclear: true };
  return { reply: `${heard.join("、")}にしました。ほかに希望はありますか。`, conditions: next, unclear: false };
}
