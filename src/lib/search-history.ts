// F-1-11：地図の検索の履歴（この端末のブラウザにだけ保存する。サーバーには送らない）
export type SearchHistoryItem = { id: string; name: string; address: string | null; lat: number; lng: number };

export const SEARCH_HISTORY_KEY = "tabi-dokoikou.search-history";
export const SEARCH_HISTORY_MAX = 10;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function store(): Store | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readHistory(s: Store | null = store()): SearchHistoryItem[] {
  try {
    const raw = s?.getItem(SEARCH_HISTORY_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list)
      ? list.filter((x): x is SearchHistoryItem => typeof x?.id === "string" && typeof x?.name === "string").slice(0, SEARCH_HISTORY_MAX)
      : [];
  } catch {
    return [];
  }
}

// 新しいものを先頭に入れ、同じ場所は1つにまとめる
export function addHistory(item: SearchHistoryItem, s: Store | null = store()): SearchHistoryItem[] {
  const next = [item, ...readHistory(s).filter((h) => h.id !== item.id)].slice(0, SEARCH_HISTORY_MAX);
  try {
    s?.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
  } catch {
    // 保存できない（プライベートブラウズなど）ときは履歴なしで動く
  }
  return next;
}

export function clearHistory(s: Store | null = store()) {
  try {
    s?.removeItem(SEARCH_HISTORY_KEY);
  } catch {
    // 何もしない
  }
}

// 候補の名前のうち、入力した文字の部分を分ける（入力した部分は薄く、残りを濃く表示する）
export function splitMatch(name: string, query: string): { text: string; typed: boolean }[] {
  const q = query.trim();
  if (!q) return [{ text: name, typed: false }];
  const i = name.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return [{ text: name, typed: false }];
  return [
    { text: name.slice(0, i), typed: false },
    { text: name.slice(i, i + q.length), typed: true },
    { text: name.slice(i + q.length), typed: false },
  ].filter((p) => p.text !== "");
}
