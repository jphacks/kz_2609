"use client";

// 画面から /api/v1 を呼ぶための共通関数。エラー形式（9.1）を ApiClientError にする
export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(`/api/v1${path}`, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) {
    let body: { error?: { code?: string; message?: string; details?: unknown } } = {};
    try {
      body = await res.json();
    } catch {
      // 本文がない場合
    }
    throw new ApiClientError(
      res.status,
      body.error?.code ?? "UNKNOWN",
      body.error?.message ?? "通信に失敗しました。もう一度試してください",
      body.error?.details,
    );
  }
  return res.json() as Promise<T>;
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiClientError) return e.message;
  return "通信に失敗しました。もう一度試してください";
}
