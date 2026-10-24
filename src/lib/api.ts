import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { getServerSupabase } from "@/lib/supabase/server";

// API の共通仕様（要件定義書 9.1）
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "FEATURE_SUSPENDED"
  | "NOT_CONFIGURED"
  | "INTERNAL_ERROR";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  UPSTREAM_ERROR: 502,
  FEATURE_SUSPENDED: 503,
  NOT_CONFIGURED: 503,
};

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function errorResponse(code: ErrorCode, message: string, details?: unknown) {
  return Response.json({ error: { code, message, details } }, { status: STATUS[code] });
}

// ルートハンドラの共通ラッパー。投げられた ApiError をエラー形式に変換する
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    if (!isSupabaseConfigured()) {
      throw new ApiError("NOT_CONFIGURED", "Supabase が設定されていません。.env.local を確認してください");
    }
    return await fn();
  } catch (e) {
    if (e instanceof ApiError) return errorResponse(e.code, e.message, e.details);
    if (e instanceof Error && e.message === "SUPABASE_NOT_CONFIGURED") {
      return errorResponse("NOT_CONFIGURED", "SUPABASE_SERVICE_ROLE_KEY が設定されていません");
    }
    console.error(e);
    return errorResponse("INTERNAL_ERROR", "サーバーでエラーが発生しました");
  }
}

export async function parseJson<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError("VALIDATION_ERROR", "リクエストの形式が正しくありません");
  }
  return parseWith(schema, body);
}

export function parseWith<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new ApiError(
      "VALIDATION_ERROR",
      first?.message ?? "入力値が正しくありません",
      result.error.issues.map((i) => ({ field: i.path.join("."), reason: i.code })),
    );
  }
  return result.data;
}

export async function getUser(): Promise<{ supabase: SupabaseClient; user: User | null }> {
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user ?? null };
}

export async function requireUser(): Promise<{ supabase: SupabaseClient; user: User }> {
  const { supabase, user } = await getUser();
  if (!user) throw new ApiError("UNAUTHORIZED", "ログインしてください");
  return { supabase, user };
}

export function dbError(error: { message: string; code?: string } | null, fallback = "データの処理に失敗しました") {
  if (!error) return;
  console.error(error);
  if (error.code === "23505") throw new ApiError("CONFLICT", "すでに登録されています");
  if (error.code === "23514") throw new ApiError("VALIDATION_ERROR", "入力値が正しくありません");
  throw new ApiError("INTERNAL_ERROR", fallback);
}

// 同じサーバー内での簡易な回数制限（9.1 の利用制限）
const buckets = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    throw new ApiError("RATE_LIMITED", "短い時間に操作が集中しています。少し待ってから試してください");
  }
  hits.push(now);
  buckets.set(key, hits);
}
