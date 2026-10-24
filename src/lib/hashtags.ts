import type { Category } from "@/lib/constants";

// F-1-13：ハッシュタグ。投稿のコメントに「#夜景」のように書いたタグと、
// カテゴリ・隠れた名所に対応する最初から用意したタグで、スポットを探せるようにする
export const HASHTAG_MAX_LENGTH = 20;

export type BuiltinTag = { tag: string; category?: Category; hiddenGem?: true };

// 「界隈」は SNS で「〜好きの集まり」の意味で使われる言い方
export const BUILTIN_TAGS: BuiltinTag[] = [
  { tag: "自然界隈", category: "nature" },
  { tag: "グルメ界隈", category: "gourmet" },
  { tag: "歴史界隈", category: "history" },
  { tag: "映え界隈", category: "photogenic" },
  { tag: "隠れた名所", hiddenGem: true },
];

// タグに使える文字：空白・記号・句読点以外（日本語・英数字・アンダースコア・長音）
// （検索の問い合わせ文を壊す * : ; | とバックスラッシュも使えない）
const TAG_BODY = `[^\\s#＃.,、。!！?？()（）「」『』【】\\[\\]{}<>"'\`*:;|\\\\]{1,${HASHTAG_MAX_LENGTH}}`;

// コメントの中のタグを、書かれた順に重複なく取り出す（全角の＃も使える）
export function parseHashtags(text: string): string[] {
  const seen = new Set<string>();
  for (const m of text.matchAll(new RegExp(`[#＃](${TAG_BODY})`, "gu"))) seen.add(m[1]);
  return [...seen];
}

// 検索欄の入力が「#タグ」ならタグ名を返す。ふつうの検索なら null
export function tagFromQuery(query: string): string | null {
  const m = new RegExp(`^[#＃](${TAG_BODY})$`, "u").exec(query.trim());
  return m ? m[1] : null;
}

export function builtinTag(tag: string): BuiltinTag | undefined {
  return BUILTIN_TAGS.find((t) => t.tag === tag);
}

// コメントを「文字」と「タグ」に分けて、タグだけリンクにできるようにする
export function splitHashtags(text: string): { text: string; tag?: string }[] {
  const parts: { text: string; tag?: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(new RegExp(`[#＃](${TAG_BODY})`, "gu"))) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ text: m[0], tag: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
