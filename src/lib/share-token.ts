import { randomBytes } from "node:crypto";

// F-4-6：リストの共有URLに入れる合言葉。推測できない長さ（192ビット）の乱数にする
export const SHARE_TOKEN_LENGTH = 32;

export function newShareToken(): string {
  return randomBytes(24).toString("base64url");
}

// 形の違う値は DB に問い合わせる前に「見つからない」として扱う
export function isShareToken(value: string): boolean {
  return value.length === SHARE_TOKEN_LENGTH && /^[A-Za-z0-9_-]+$/.test(value);
}
