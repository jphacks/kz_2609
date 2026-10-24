import { describe, expect, it } from "vitest";
import {
  EMPTY_CONDITIONS,
  UNCLEAR_REPLY,
  buildResponseSchema,
  buildSystemPrompt,
  mockReply,
  sanitizeReply,
  stripEmoji,
  type ChatSpot,
} from "@/lib/plan-chat";
import { computePlanSchema, planChatSchema } from "@/lib/validation";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const OUTSIDE = "99999999-9999-4999-8999-999999999999";
const spots: ChatSpot[] = [
  { id: A, name: "兼六園", category: "history" },
  { id: B, name: "金沢港", category: "nature" },
];
const common = { date: "2026-11-03", startTime: "09:00", endTime: "18:00", mode: "transit" as const };

describe("sanitizeReply（AIの返答の検証。F-5-5）", () => {
  it("リスト外のスポット・おかしな時刻・選べない値を捨て、絵文字を取り除く", () => {
    const res = sanitizeReply(
      {
        reply: "金沢港に夕方着くようにします🌅",
        unclear: false,
        conditions: {
          pace: "relaxed",
          interests: ["photogenic", "other", "unknown"],
          priority: "less_walking",
          timeWindows: [
            { spotId: B, from: "16:00", to: "17:30" },
            { spotId: OUTSIDE, from: "10:00", to: "11:00" },
            { spotId: A, from: "25:00", to: "26:00" },
            { spotId: A, from: "12:00", to: "11:00" },
          ],
          orderHints: [
            { spotId: A, position: "first" },
            { spotId: B, position: "before" },
            { spotId: B, position: "after", relativeTo: A },
            { spotId: OUTSIDE, position: "last" },
          ],
          exclude: [OUTSIDE, A, A],
        },
      },
      [A, B],
      EMPTY_CONDITIONS,
    );
    expect(res.unclear).toBe(false);
    expect(res.reply).toBe("金沢港に夕方着くようにします");
    expect(res.conditions).toEqual({
      pace: "relaxed",
      interests: ["photogenic"],
      priority: "less_walking",
      timeWindows: [{ spotId: B, from: "16:00", to: "17:30" }],
      orderHints: [
        { spotId: A, position: "first" },
        { spotId: B, position: "after", relativeTo: A },
      ],
      exclude: [A],
    });
  });

  it("JSON の形が違うときは前回の条件のまま、聞き返す", () => {
    const prev = { ...EMPTY_CONDITIONS, pace: "packed" as const };
    expect(sanitizeReply("not json", [A], prev)).toEqual({ reply: UNCLEAR_REPLY, conditions: prev, unclear: true });
    expect(sanitizeReply({ reply: "🙂" }, [A], prev).unclear).toBe(true);
  });

  it("条件の一部が無いときは前回の値を引き継ぐ", () => {
    const prev = { ...EMPTY_CONDITIONS, priority: "best_time" as const, exclude: [A] };
    const res = sanitizeReply({ reply: "了解です", conditions: { pace: "relaxed" } }, [A, B], prev);
    expect(res.conditions).toEqual({ ...prev, pace: "relaxed" });
  });
});

describe("stripEmoji", () => {
  it("絵文字・国旗・異体字セレクタを取り除く", () => {
    expect(stripEmoji("いいですね👍🏻 金沢🇯🇵へ❤️")).toBe("いいですね 金沢へ");
  });
});

describe("指示文とJSONの形（AIに送る情報）", () => {
  it("スポット名と共通の条件だけを含み、スポット ID は一覧に限定する", () => {
    const prompt = buildSystemPrompt(spots, common, EMPTY_CONDITIONS);
    expect(prompt).toContain(`${A}：兼六園`);
    expect(prompt).toContain("09:00〜18:00");
    const schema = buildResponseSchema([A, B]);
    expect(schema.properties.conditions.properties.exclude.items.enum).toEqual([A, B]);
  });
});

describe("mockReply（キーなしで試すためのモック）", () => {
  it("よくある言い回しから条件を読み取る", () => {
    const res = mockReply(
      [{ role: "user", content: "夕日は金沢港で見たい。のんびり回りたいし、歩くのは少なめがいい" }],
      spots,
      common,
      EMPTY_CONDITIONS,
    );
    expect(res.unclear).toBe(false);
    expect(res.conditions.pace).toBe("relaxed");
    expect(res.conditions.priority).toBe("less_walking");
    expect(res.conditions.timeWindows).toEqual([{ spotId: B, from: "16:00", to: "17:30" }]);
  });

  it("読み取れなければ聞き返し、条件は変えない", () => {
    const res = mockReply([{ role: "user", content: "こんにちは" }], spots, common, EMPTY_CONDITIONS);
    expect(res).toEqual({ reply: UNCLEAR_REPLY, conditions: EMPTY_CONDITIONS, unclear: true });
  });
});

describe("入力チェック", () => {
  const base = {
    listId: A,
    spotIds: [A, B],
    origin: { lat: 36.578, lng: 136.648, label: "金沢駅" },
    destination: null,
    date: "2026-11-03",
    startTime: "09:00",
    endTime: "18:00",
    mode: "transit",
    lunchBreak: true,
  };

  it("経路作成は method=chat と時刻・順番の希望を受け付け、既存の形（希望なし）も通る", () => {
    const old = computePlanSchema.parse({
      ...base,
      method: "preferences",
      preferences: { pace: "normal", interests: [], priority: "fewer_moves" },
    });
    expect(old.preferences.timeWindows).toEqual([]);
    const chat = computePlanSchema.safeParse({
      ...base,
      method: "chat",
      preferences: {
        pace: "relaxed",
        interests: [],
        priority: "less_walking",
        timeWindows: [{ spotId: B, from: "16:00", to: "17:30" }],
        orderHints: [{ spotId: A, position: "first" }],
        exclude: [],
      },
    });
    expect(chat.success).toBe(true);
    const bad = computePlanSchema.safeParse({
      ...base,
      method: "chat",
      preferences: { ...old.preferences, timeWindows: [{ spotId: B, from: "17:30", to: "16:00" }] },
    });
    expect(bad.success).toBe(false);
  });

  it("相談は11往復目（21件目）を受け付けない", () => {
    const msg = (i: number) => ({ role: i % 2 === 0 ? "user" : "assistant", content: "こんにちは" });
    const req = { listId: A, spotIds: [A], date: "2026-11-03", startTime: "09:00", endTime: "18:00", mode: "walking" };
    expect(planChatSchema.safeParse({ ...req, messages: Array.from({ length: 19 }, (_, i) => msg(i)) }).success).toBe(true);
    expect(planChatSchema.safeParse({ ...req, messages: Array.from({ length: 21 }, (_, i) => msg(i)) }).success).toBe(false);
  });
});
