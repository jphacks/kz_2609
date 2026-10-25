// 公共交通の経路計算に使う停留所・駅のデータを作る（ADR-0026）。
// 入力は国土数値情報（国土交通省、CC BY 4.0）の2つのファイル：
//   バス停留所データ P11-22_17（石川県）  https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P11-2022.html
//   鉄道データ N02-24（全国）            https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-2024.html
// 使い方：node scripts/build-transit-data.mjs <P11-22_17.geojson> <N02-24_Station.geojson> <N02-24_RailroadSection.geojson>
// 出力：src/lib/transit/data.json（時刻表は含めない）
//   lines：停まる順番がわかる路線（周遊バス・鉄道）。鉄道は駅間の線路の道のり（m）も持つ
//   routes：石川県の路線バスの系統（停まる順番はデータにないため、止まる停留所の集まりとして持つ。ADR-0027）
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [p11Path, n02Path, n02SectionPath] = process.argv.slice(2);
if (!p11Path || !n02Path || !n02SectionPath) {
  console.error(
    "使い方：node scripts/build-transit-data.mjs <P11-22_17.geojson> <N02-24_Station.geojson> <N02-24_RailroadSection.geojson>",
  );
  process.exit(1);
}
const round = (v) => Math.round(v * 1e5) / 1e5;

// --- バス：城下まち金沢周遊バス ---
// 停まる順番は現地の路線（2026年4月）。位置は国土数値情報（2022年）の同じ停留所を使う。
// 停留所名が2022年から変わったものは、位置を取る国土数値情報の名前を2つ目に書く。
// 北陸鉄道の時刻表（ダイヤ情報）は使わない（同社サイトの利用条件のため。乗車時間は Google の車の所要時間から計算する）
const LOOP_OPERATOR = "北陸鉄道（株）";
const LOOP_ROUTE = "城下町金沢周遊バス";
const BUS_LINES = [
  {
    id: "kanazawa-loop-right",
    name: "城下まち金沢周遊バス 右回り",
    stops: [
      ["金沢駅東口"],
      ["武蔵ヶ辻・近江町市場（金澤表参道口）", "武蔵ヶ辻・近江町市場（金沢エムザ黒門小路前）"],
      ["瓢箪町"],
      ["森山一丁目"],
      ["橋場町（ひがし・主計町茶屋街）"],
      ["橋場町（金城樓前）", "橋場町（金城棲前）"],
      ["兼六園下・金沢城（石川門向い）"],
      ["広坂・21世紀美術館（しいのき迎賓館向い）", "広坂・21世紀美術館（石浦神社前）"],
      ["香林坊（旧日銀前）", "香林坊（日銀前）"],
      ["南町・尾山神社"],
      ["武蔵ヶ辻・近江町市場（エムザ黒門小路前）", "武蔵ヶ辻・近江町市場（金沢エムザ黒門小路前）"],
      ["金沢駅東口"],
    ],
  },
  {
    id: "kanazawa-loop-left",
    name: "城下まち金沢周遊バス 左回り",
    stops: [
      ["金沢駅東口"],
      ["武蔵ヶ辻・近江町市場（いちば館前）"],
      ["南町・尾山神社"],
      ["香林坊（アトリオ前）"],
      ["片町（パシオン前）"],
      ["広小路（寺町寺院群・にし茶屋街）"],
      ["桜橋"],
      ["本多町（金沢歌劇座前）", "本多町（金沢歌舞伎座前）"],
      ["広坂・21世紀美術館（石浦神社向い）"],
      ["兼六園下・金沢城（白鳥路前）"],
      ["橋場町（金城樓向い）", "橋場町（金城棲向い）"],
      ["武蔵ヶ辻・近江町市場（近江町ふれあい館駐車場口）", "武蔵ヶ辻・近江町市場（いちば館前）"],
      ["金沢駅東口"],
    ],
  },
];

const p11 = JSON.parse(readFileSync(p11Path, "utf8"));
const routesOf = (p) =>
  Object.entries(p)
    .filter(([k, v]) => k.startsWith("P11_003") && v)
    .flatMap(([, v]) => v.split(","));
// 周遊バスが止まる停留所を優先し、なければ同じ名前のほかの停留所を使う
function findBusStop(name) {
  const same = p11.features.filter((f) => f.properties.P11_001 === name);
  const loop = same.find((f) => f.properties.P11_002 === LOOP_OPERATOR && routesOf(f.properties).includes(LOOP_ROUTE));
  return loop ?? same[0] ?? null;
}

const stops = new Map();
const lines = [];
for (const line of BUS_LINES) {
  const ids = line.stops.map(([name, source]) => {
    const f = findBusStop(source ?? name);
    if (!f) throw new Error(`国土数値情報に停留所がありません：${source ?? name}`);
    const [lng, lat] = f.geometry.coordinates;
    const id = `bus:${name}`;
    stops.set(id, { id, name, kind: "bus", lat: round(lat), lng: round(lng) });
    return id;
  });
  lines.push({ id: line.id, name: line.name, kind: "bus", stopIds: ids, bidirectional: false });
}

// --- 鉄道：石川県内の路線 ---
// 停まる順番は、路線の端の駅から近い順にたどって決める（どの路線も枝分かれがないため）
const RAIL_LINES = [
  { id: "ir-ishikawa", operator: "IRいしかわ鉄道", line: "IRいしかわ鉄道線", name: "IRいしかわ鉄道線", kind: "local" },
  { id: "hokutetsu-ishikawa", operator: "北陸鉄道", line: "石川線", name: "北陸鉄道 石川線", kind: "private" },
  { id: "hokutetsu-asanogawa", operator: "北陸鉄道", line: "浅野川線", name: "北陸鉄道 浅野川線", kind: "private" },
  { id: "jr-nanao", operator: "西日本旅客鉄道", line: "七尾線", name: "JR七尾線", kind: "local" },
  { id: "noto", operator: "のと鉄道", line: "七尾線", name: "のと鉄道 七尾線", kind: "local" },
  { id: "hokuriku-shinkansen", operator: "西日本旅客鉄道", line: "北陸新幹線", name: "北陸新幹線", kind: "shinkansen" },
];
// 石川県のおおよその範囲（新幹線などの県外の駅を除く）
const inIshikawa = ({ lat, lng }) => lat > 36.05 && lat < 37.6 && lng > 136.2 && lng < 137.4;

const n02 = JSON.parse(readFileSync(n02Path, "utf8"));
const n02Sections = JSON.parse(readFileSync(n02SectionPath, "utf8"));
const center = (coords) => {
  const mid = coords[Math.floor(coords.length / 2)];
  return { lng: mid[0], lat: mid[1] };
};
const dist = (a, b) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 91);
// 2点間の距離（m）
const meters = (a, b) => {
  const r = (d) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};

// 線路の道のり：路線の区間（線）をつないだグラフで、駅に最も近い点どうしの最短距離を求める
function trackGraph(rl) {
  const nodes = new Map();
  const node = ([lng, lat]) => {
    const key = `${lng.toFixed(6)},${lat.toFixed(6)}`;
    if (!nodes.has(key)) nodes.set(key, { lat, lng, edges: [] });
    return nodes.get(key);
  };
  for (const f of n02Sections.features) {
    const p = f.properties;
    if (p.N02_004 !== rl.operator || p.N02_003 !== rl.line) continue;
    const cs = f.geometry.coordinates;
    for (let i = 1; i < cs.length; i++) {
      const a = node(cs[i - 1]);
      const b = node(cs[i]);
      const m = meters(a, b);
      a.edges.push([b, m]);
      b.edges.push([a, m]);
    }
  }
  return [...nodes.values()];
}
function trackMeters(graph, from, to) {
  const nearest = (p) => graph.reduce((best, n) => (meters(n, p) < meters(best, p) ? n : best));
  const start = nearest(from);
  const goal = nearest(to);
  const d = new Map([[start, 0]]);
  const open = new Set([start]);
  while (open.size > 0) {
    let cur = null;
    for (const n of open) if (!cur || d.get(n) < d.get(cur)) cur = n;
    open.delete(cur);
    if (cur === goal) return d.get(cur);
    for (const [nb, m] of cur.edges) {
      const nd = d.get(cur) + m;
      if (nd < (d.get(nb) ?? Infinity)) {
        d.set(nb, nd);
        open.add(nb);
      }
    }
  }
  return null;
}

for (const rl of RAIL_LINES) {
  const byName = new Map();
  for (const f of n02.features) {
    const p = f.properties;
    if (p.N02_004 !== rl.operator || p.N02_003 !== rl.line) continue;
    const pt = center(f.geometry.coordinates);
    if (!inIshikawa(pt)) continue;
    // 同じ駅が複数の区間に分かれていることがあるので、名前でまとめる
    if (!byName.has(p.N02_005)) byName.set(p.N02_005, { name: p.N02_005, ...pt });
  }
  const list = [...byName.values()];
  if (list.length < 2) throw new Error(`駅が足りません：${rl.name}`);
  // 端の駅：ほかの駅の重心から最も遠い駅
  const c = { lat: list.reduce((s, x) => s + x.lat, 0) / list.length, lng: list.reduce((s, x) => s + x.lng, 0) / list.length };
  let cur = list.reduce((a, b) => (dist(a, c) >= dist(b, c) ? a : b));
  const ordered = [cur];
  const rest = new Set(list.filter((x) => x !== cur));
  while (rest.size > 0) {
    let best = null;
    for (const x of rest) if (!best || dist(cur, x) < dist(cur, best)) best = x;
    rest.delete(best);
    ordered.push(best);
    cur = best;
  }
  const ids = ordered.map((s) => {
    const id = `rail:${rl.id}:${s.name}`;
    stops.set(id, { id, name: `${s.name}駅`, kind: "rail", lat: round(s.lat), lng: round(s.lng) });
    return id;
  });
  // 駅間の線路の道のり。線路のデータでつながらない区間は直線距離の1.1倍
  const graph = trackGraph(rl);
  const trackM = ordered.slice(1).map((b, i) => {
    const m = graph.length > 0 ? trackMeters(graph, ordered[i], b) : null;
    return Math.round(m ?? meters(ordered[i], b) * 1.1);
  });
  lines.push({ id: rl.id, name: rl.name, kind: "rail", railKind: rl.kind, stopIds: ids, bidirectional: true, trackM });
  console.log(
    `${rl.name}：${ordered.map((s, i) => (i === 0 ? s.name : `-(${(trackM[i - 1] / 1000).toFixed(1)}km)- ${s.name}`)).join(" ")}`,
  );
}

// --- 路線バス：石川県のすべての系統（周遊バスは上の lines で扱う） ---
const routes = new Map();
p11.features.forEach((f, i) => {
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  const id = `stop:${i}`;
  let used = false;
  for (const name of routesOf(p)) {
    if (name === LOOP_ROUTE) continue;
    const key = `${p.P11_002}|${name}`;
    if (!routes.has(key)) routes.set(key, { id: `route:${routes.size}`, name, operator: p.P11_002, stopIds: [] });
    routes.get(key).stopIds.push(id);
    used = true;
  }
  if (used) stops.set(id, { id, name: p.P11_001, kind: "bus", lat: round(lat), lng: round(lng) });
});
// 停留所が1つだけの系統は乗り降りできないので除く
const busRoutes = [...routes.values()].filter((r) => r.stopIds.length >= 2);

const out = {
  source:
    "国土数値情報（バス停留所データ 2022年、鉄道データ 2024年）（国土交通省）を加工して作成。周遊バスの停まる順番は2026年4月の路線",
  stops: [...stops.values()],
  lines,
  routes: busRoutes,
};
const dest = join(root, "src", "lib", "transit", "data.json");
writeFileSync(dest, `${JSON.stringify(out)}
`);
console.log(
  `停留所・駅 ${out.stops.length} か所、順番のわかる路線 ${out.lines.length} 本、路線バスの系統 ${busRoutes.length} 本を ${dest} に書き出しました`,
);
