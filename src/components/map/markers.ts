// 地図マーカーの DOM（F-1-4・F-1-5）。MapLibre のマーカーは DOM 要素なので、Lucide の素の SVG を使う
import { Aperture, createElement, Flame, House, Landmark, MapPin, Trees, Utensils, type IconNode } from "lucide";
import type { Category, Popularity } from "@/lib/constants";

const CATEGORY_ICON: Record<Category, IconNode> = {
  nature: Trees,
  gourmet: Utensils,
  history: Landmark,
  photogenic: Aperture,
  other: MapPin,
};

const PRIMARY = "#1f6f5c";
const SHADOW = "0 1px 4px rgba(0,0,0,0.18)";

function icon(node: IconNode, size: number) {
  return createElement(node, { width: size, height: size, "stroke-width": 2, "aria-hidden": "true" });
}

function photoBox(url: string | null, category: Category, size: number, borderColor: string) {
  const box = document.createElement("div");
  Object.assign(box.style, {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "10px",
    border: `3px solid ${borderColor}`,
    background: "#ffffff",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: PRIMARY,
    boxShadow: SHADOW,
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
  Object.assign(img.style, { width: "100%", height: "100%", objectFit: "cover" });
  // 写真の読み込みに失敗したらカテゴリのアイコンにする（F-1 の例外）
  img.onerror = () => {
    img.remove();
    fallback();
  };
  box.appendChild(img);
  return box;
}

const BORDER: Record<Popularity, string> = {
  normal: "#ffffff",
  popular: "#d9822b",
  very_popular: "#c2410c",
};

// 写真の束：投稿数に応じて重なり枚数（1〜3）とサイズ（48 / 64 / 80px）を3段階で変える
export function stackTier(postCount: number) {
  if (postCount >= 20) return { size: 80, layers: 3 };
  if (postCount >= 5) return { size: 64, layers: 2 };
  return { size: 48, layers: 1 };
}

export function createStackMarker(opts: { coverUrl: string | null; category: Category; postCount: number; label: string }) {
  const { size, layers } = stackTier(opts.postCount);
  const outer = size + (layers - 1) * 6;
  const root = document.createElement("button");
  root.type = "button";
  root.className = "map-marker";
  root.setAttribute("aria-label", opts.label);
  Object.assign(root.style, {
    position: "relative",
    width: `${outer}px`,
    height: `${outer}px`,
    background: "transparent",
    border: "none",
    padding: "0",
  });
  // 後ろの写真（重なりの厚み）
  for (let i = layers - 1; i >= 1; i--) {
    const back = document.createElement("div");
    Object.assign(back.style, {
      position: "absolute",
      left: `${i * 6}px`,
      top: `${i * 6}px`,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: "10px",
      border: "3px solid #ffffff",
      background: i === 1 ? "#e4f1ed" : "#cfe5de",
      boxShadow: SHADOW,
    });
    root.appendChild(back);
  }
  const front = photoBox(opts.coverUrl, opts.category, size, "#ffffff");
  Object.assign(front.style, { position: "absolute", left: "0", top: "0" });
  root.appendChild(front);

  // 投稿数のバッジ（補足表示）
  const badge = document.createElement("span");
  badge.textContent = String(opts.postCount);
  Object.assign(badge.style, {
    position: "absolute",
    right: "-6px",
    bottom: "-6px",
    minWidth: "22px",
    height: "22px",
    padding: "0 6px",
    borderRadius: "11px",
    background: "#1c1c1a",
    color: "#ffffff",
    fontSize: "12px",
    fontWeight: "600",
    lineHeight: "22px",
    textAlign: "center",
  });
  root.appendChild(badge);
  return root;
}

// 写真ピン：代表写真（48px）。人気度で枠の色を変え、大人気は炎のアイコンと文字を添える
export function createPinMarker(opts: {
  coverUrl: string | null;
  category: Category;
  popularity: Popularity;
  label: string;
  highlighted?: boolean;
}) {
  const root = document.createElement("button");
  root.type = "button";
  root.className = "map-marker";
  root.setAttribute("aria-label", opts.label);
  Object.assign(root.style, {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2px",
    background: "transparent",
    border: "none",
    padding: "0",
  });
  root.appendChild(photoBox(opts.coverUrl, opts.category, 48, opts.highlighted ? PRIMARY : BORDER[opts.popularity]));
  if (opts.popularity !== "normal") {
    const veryPopular = opts.popularity === "very_popular";
    const tag = document.createElement("span");
    Object.assign(tag.style, {
      display: "inline-flex",
      alignItems: "center",
      gap: "2px",
      padding: "1px 6px",
      borderRadius: "9999px",
      background: veryPopular ? "#c2410c" : "#d9822b",
      color: "#ffffff",
      fontSize: "11px",
      fontWeight: "600",
      whiteSpace: "nowrap",
    });
    if (veryPopular) tag.appendChild(icon(Flame, 12));
    tag.appendChild(document.createTextNode(veryPopular ? "大人気" : "人気"));
    root.appendChild(tag);
  }
  return root;
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
