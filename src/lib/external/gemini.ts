import "server-only";

import { ApiError } from "@/lib/api";
import { serverEnv } from "@/lib/env";
import { quotas } from "@/lib/external/quotas";
import {
  buildResponseSchema,
  buildSystemPrompt,
  mockReply,
  sanitizeReply,
  type ChatCommon,
  type ChatMessage,
  type ChatReply,
  type ChatSpot,
} from "@/lib/plan-chat";
import type { ChatConditions } from "@/lib/planner/types";
import { consumeQuota } from "@/lib/quota";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// 開発中（USE_MOCK_EXTERNAL_APIS=true）は Gemini を呼ばず、よくある言い回しだけを読み取るモックで答える（F-8-8）
export function isAiMock(): boolean {
  return serverEnv().useMockExternalApis;
}

// 「AIと相談」が使えるか（モック、またはキーが設定されている）
export function isAiAvailable(): boolean {
  return isAiMock() || serverEnv().geminiApiKey !== "";
}

// 会話を条件に変換する（F-5-5）。AIは条件を返すだけで、経路は 11章のロジックで計算する
export async function askConditions(
  messages: ChatMessage[],
  spots: ChatSpot[],
  common: ChatCommon,
  current: ChatConditions,
): Promise<ChatReply> {
  const env = serverEnv();
  if (isAiMock()) return mockReply(messages, spots, common, current);
  if (!env.geminiApiKey) throw new ApiError("FEATURE_SUSPENDED", "AIと相談は準備中です。ほかの作り方を使ってください", { feature: "ai" });

  // F-8：無料枠の80%に達していたら呼ばない
  if (!(await consumeQuota(quotas().gemini, 1))) {
    throw new ApiError("FEATURE_SUSPENDED", "AIと相談は、今日の利用上限に近づいたため停止中です。ほかの作り方を使ってください", {
      feature: "ai",
    });
  }

  const spotIds = spots.map((s) => s.id);
  const call = (withSchema: boolean) =>
    fetch(`${GEMINI_URL}/${encodeURIComponent(env.geminiModel)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.geminiApiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildSystemPrompt(spots, common, current) }] },
        contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        generationConfig: {
          responseMimeType: "application/json",
          ...(withSchema ? { responseSchema: buildResponseSchema(spotIds) } : {}),
          temperature: 0.2,
          maxOutputTokens: 4096,
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });

  let res: Response;
  try {
    res = await call(true);
    // モデルによっては JSON の形の指定（responseSchema）を受け付けないため、その場合は指示文だけで答えさせる。
    // どちらの場合も返答は sanitizeReply で検証する
    if (res.status === 400) res = await call(false);
  } catch {
    throw new ApiError("UPSTREAM_ERROR", "AIに接続できませんでした。少し待ってから試してください");
  }
  if (res.status === 429) {
    throw new ApiError("RATE_LIMITED", "AIが混み合っています。少し待ってから試してください");
  }
  if (!res.ok) {
    // 会話の内容はログに残さない（F-5-5）
    console.error(`[gemini] HTTP ${res.status}`);
    throw new ApiError("UPSTREAM_ERROR", "AIからの返答を受け取れませんでした。少し待ってから試してください");
  }

  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return sanitizeReply(json, spotIds, current);
}
