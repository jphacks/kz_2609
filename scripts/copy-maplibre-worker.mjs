// MapLibre GL JS 6 のワーカーを public/maplibre/ にコピーする（npm install の後に自動で実行）。
// 地図はこのファイルを /maplibre/maplibre-gl-worker.mjs から読み込む（spot-map.tsx の setWorkerUrl）。
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "maplibre-gl", "dist");
const dest = join(root, "public", "maplibre");

if (!existsSync(src)) {
  console.warn("maplibre-gl が見つからないため、ワーカーのコピーを省略しました");
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(src, file), join(dest, file));
}
console.log("MapLibre のワーカーを public/maplibre/ にコピーしました");
