// 地図マーカーの DOM（F-1-4・F-1-5）。MapLibre のマーカーは DOM 要素なので、Lucide の素の SVG を使う
import { Aperture, createElement, Flame, Gem, House, Landmark, MapPin, Trees, Utensils, type IconNode } from "lucide";
import type { Category, Popularity } from "@/lib/constants";

const CATEGORY_ICON: Record<Category, IconNode> = {
  nature: Trees,
  gourmet: Utensils,
  history: Landmark,
  photogenic: Aperture,
  other: MapPin,
};

const PRIMARY = "#1f6f5c";

function icon(node: IconNode, size: number) {
  return createElement(node, { width: size, height: size, "stroke-width": 2, "aria-hidden": "true" });
}

// 写真ピンの枠（リング）。人気度・隠れた名所は色だけでなく「人気」「大人気」「隠れた名所」の文字でも示す（8.2）
export type PinRing = "normal" | "popular" | "very_popular" | "hidden_gem" | "highlight";

const RING: Record<PinRing, { background: string; tip: string }> = {
  normal: { background: "#ffffff", tip: "#ffffff" },
  popular: { background: "#d9822b", tip: "#d9822b" },
  very_popular: { background: "conic-gradient(from 200deg, #f59e0b, #e11d48, #c2410c, #f59e0b)", tip: "#e11d48" },
  hidden_gem: { background: "#6d28d9", tip: "#6d28d9" },
  highlight: { background: PRIMARY, tip: PRIMARY },
};

const PIN_SIZE = 48;
const RING_WIDTH = 3;
const TIP_HEIGHT = 8;

// 丸い写真（読み込みに失敗したらカテゴリのアイコン。F-1 の例外）
function roundPhoto(url: string | null, category: Category, size: number) {
  const box = document.createElement("div");
  Object.assign(box.style, {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "9999px",
    border: "2px solid #ffffff",
    background: "#ffffff",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: PRIMARY,
    boxSizing: "border-box",
  });
  const fallback = () => box.appendChild(icon(CATEGORY_ICON[category], size * 0.45));
  if (!url) {
    fallback();
    return box;
  }
  const img = document.createElement("img");
  img.src = url;
  img.alt = "";
  img.loading = "lazy";
  img.draggable = false;
  Object.assign(img.style, { width: "100%", height: "100%", objectFit: "cover" });
  img.onerror = () => {
    img.remove();
    fallback();
  };
  box.appendChild(img);
  return box;
}

// しずく形のピンの中に丸い写真を入れ、下にスポット名を出す。
// ピンの先（要素の下端）が地点を指すので、Marker は anchor: "bottom" で置く。名前は下にはみ出して表示する
export function createPhotoPin(opts: {
  coverUrl: string | null;
  category: Category;
  ring: PinRing;
  name: string;
  sub?: string;
  label: string;
}) {
  const ring = RING[opts.ring];
  const outer = PIN_SIZE + RING_WIDTH * 2;
  const root = document.createElement("button");
  root.type = "button";
  root.className = "map-marker";
  root.setAttribute("aria-label", opts.label);
  Object.assign(root.style, {
    position: "relative",
    width: `${outer}px`,
    height: `${outer + TIP_HEIGHT - 2}px`,
    background: "transparent",
    border: "none",
    padding: "0",
    filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.35))",
  });

  const circle = document.createElement("div");
  Object.assign(circle.style, {
    position: "absolute",
    left: "0",
    top: "0",
    width: `${outer}px`,
    height: `${outer}px`,
    borderRadius: "9999px",
    background: ring.background,
    padding: `${RING_WIDTH}px`,
    boxSizing: "border-box",
  });
  circle.appendChild(roundPhoto(opts.coverUrl, opts.category, PIN_SIZE));
  root.appendChild(circle);

  // ピンの先（下向きの三角）
  const tip = document.createElement("div");
  Object.assign(tip.style, {
    position: "absolute",
    left: `${outer / 2 - 7}px`,
    top: `${outer - 3}px`,
    width: "0",
    height: "0",
    borderLeft: "7px solid transparent",
    borderRight: "7px solid transparent",
    borderTop: `${TIP_HEIGHT + 1}px solid ${ring.tip}`,
  });
  root.appendChild(tip);

  // スポット名（地図の上でも読めるよう白い縁取り）
  const caption = document.createElement("div");
  Object.assign(caption.style, {
    position: "absolute",
    top: "100%",
    left: "50%",
    transform: "translateX(-50%)",
    marginTop: "2px",
    width: "max-content",
    maxWidth: "140px",
    textAlign: "center",
    color: "#1c1c1a",
    fontSize: "12px",
    fontWeight: "700",
    lineHeight: "1.3",
    textShadow: "0 0 3px #ffffff, 0 0 3px #ffffff, 0 0 3px #ffffff, 0 0 2px #ffffff",
  });
  const name = document.createElement("div");
  name.textContent = opts.name;
  Object.assign(name.style, { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });
  caption.appendChild(name);
  if (opts.ring === "popular" || opts.ring === "very_popular") {
    const tag = document.createElement("div");
    Object.assign(tag.style, {
      display: "inline-flex",
      alignItems: "center",
      gap: "2px",
      color: opts.ring === "very_popular" ? "#c2410c" : "#b45309",
      fontSize: "11px",
    });
    if (opts.ring === "very_popular") tag.appendChild(icon(Flame, 12));
    tag.appendChild(document.createTextNode(opts.ring === "very_popular" ? "大人気" : "人気"));
    caption.appendChild(tag);
  }
  if (opts.ring === "hidden_gem") {
    const tag = document.createElement("div");
    Object.assign(tag.style, { display: "inline-flex", alignItems: "center", gap: "2px", color: "#6d28d9", fontSize: "11px" });
    tag.appendChild(icon(Gem, 12));
    tag.appendChild(document.createTextNode("隠れた名所"));
    caption.appendChild(tag);
  }
  if (opts.sub) {
    const sub = document.createElement("div");
    sub.textContent = opts.sub;
    Object.assign(sub.style, { fontSize: "11px", fontWeight: "600", color: "#4b4b47" });
    caption.appendChild(sub);
  }
  root.appendChild(caption);
  return root;
}

// 写真の束：まとめたスポットのうち投稿数が最も多い場所の写真と名前に「+その他N件」を添える。
// 人気度は1つのスポットの順位なので、束では表さない（リングは白。リストの強調だけ色を変える）
export function createStackMarker(opts: {
  coverUrl: string | null;
  category: Category;
  postCount: number;
  name: string;
  others: number;
  label: string;
  highlighted?: boolean;
}) {
  return createPhotoPin({
    coverUrl: opts.coverUrl,
    category: opts.category,
    ring: opts.highlighted ? "highlight" : "normal",
    name: opts.name,
    sub: opts.others > 0 ? `+その他${opts.others}件` : undefined,
    label: opts.label,
  });
}

// 写真ピン：代表写真を丸く切り抜いてピンに入れる。人気度でリングの色を変え、人気・大人気は文字も添える（F-1-5）。
// 隠れた名所（F-1-12）は紫のリングと「隠れた名所」の文字
export function createPinMarker(opts: {
  coverUrl: string | null;
  category: Category;
  popularity: Popularity;
  hiddenGem?: boolean;
  label: string;
  highlighted?: boolean;
}) {
  return createPhotoPin({
    coverUrl: opts.coverUrl,
    category: opts.category,
    ring: opts.highlighted ? "highlight" : opts.hiddenGem ? "hidden_gem" : opts.popularity,
    name: opts.label,
    label: opts.label,
  });
}

// リストの拠点（F-1-9・F-4-8）
export function createBaseMarker(label: string) {
  const root = document.createElement("div");
  root.setAttribute("aria-label", `拠点：${label}`);
  Object.assign(root.style, {
    width: "40px",
    height: "40px",
    borderRadius: "9999px",
    background: PRIMARY,
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "3px solid #ffffff",
    boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
  });
  root.appendChild(icon(House, 20));
  return root;
}

// 経路の訪問順の番号
export function createNumberMarker(n: number) {
  const root = document.createElement("div");
  Object.assign(root.style, {
    width: "30px",
    height: "30px",
    borderRadius: "9999px",
    background: PRIMARY,
    color: "#ffffff",
    border: "3px solid #ffffff",
    fontSize: "13px",
    fontWeight: "700",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
  });
  root.textContent = String(n);
  return root;
}
