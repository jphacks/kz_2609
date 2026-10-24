// 初期データの写真の管理（Wikimedia Commons のクリエイティブ・コモンズ等の画像）。Node.js 22 以上、追加のパッケージ不要。
//
//   node scripts/seed-photos.mjs sql
//     src/lib/seed-photos.json から supabase/seed/photos.sql を作り直す（写真を初期データの投稿に付ける SQL）
//
//   node scripts/seed-photos.mjs fetch [--min 2] [--spot 名前] [--dry-run]
//     写真が min 枚より少ない初期データのスポットについて、Commons をスポットの位置の近く（なければ名前）で検索し、
//     商用利用可のライセンス（CC0・パブリックドメイン・CC BY・CC BY-SA。NC と ND は除く）の写真だけを保存して登録する。
//     保存先は public/seed/photos/<スポット>/、作者・ライセンスは src/lib/seed-photos.json。最後に photos.sql も作り直す。
//
// 自動検索は別の場所の写真を拾うことがあるため、fetch のあとは必ず /credits の画面で写真を目で確認し、
// 合わない写真は seed-photos.json から行を消して画像ファイルも消し、`sql` を実行し直すこと。
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JSON_PATH = path.join(ROOT, "src/lib/seed-photos.json");
const SQL_PATH = path.join(ROOT, "supabase/seed/photos.sql");
const SEED_FILES = ["supabase/seed/kanazawa.sql", "supabase/seed/ishikawa.sql"];
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
// Wikimedia の利用規約で、連絡先のわかる User-Agent が必要
const USER_AGENT = "tabi-dokoikou-seed-photos/1.0 (https://github.com/jphacks/kz_2609)";
const MAX_PER_SPOT = 4;

const sqlText = (s) => `'${String(s).replace(/'/g, "''")}'`;

export async function loadPhotos() {
  return JSON.parse(await readFile(JSON_PATH, "utf8"));
}

// 写真を、そのスポットの初期データの投稿へ順番に付ける（投稿1件に最大4枚）。何度実行しても重複しない
export function buildSql(photos) {
  const lines = [
    "-- 初期データの写真を投稿に付ける（scripts/seed-photos.mjs sql で自動生成。直接編集しない）。",
    "-- 画像はアプリの public/seed/photos/ にあり、作者・ライセンスは src/lib/seed-photos.json と /credits に表示する。",
    "-- kanazawa.sql・ishikawa.sql のあとに実行する。何度実行しても同じ写真は重複しない。",
    "",
  ];
  const bySpot = new Map();
  for (const p of photos) bySpot.set(p.spot, [...(bySpot.get(p.spot) ?? []), p]);
  for (const [spot, list] of bySpot) {
    lines.push(`-- ${spot}（${list.length}枚）`);
    list.forEach((p, k) => {
      lines.push(
        "insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)",
        `select p.id, ${sqlText(p.full)}, ${sqlText(p.thumb)}, ${p.width}, ${p.height}, (${k} / p.n)::smallint`,
        "from (",
        "  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n",
        "  from public.posts po join public.spots sp on sp.id = po.spot_id",
        `  where sp.name = ${sqlText(spot)} and sp.source = 'seed'`,
        ") p",
        `where p.idx = ${k} % p.n and ${k} / p.n < ${MAX_PER_SPOT}`,
        `  and not exists (select 1 from public.post_images where full_path = ${sqlText(p.full)});`,
      );
    });
    lines.push("");
  }
  return lines.join("\n");
}

// 初期データの SQL からスポット名と緯度経度を読む
export function parseSeedSpots(sql) {
  const spots = [];
  for (const m of sql.matchAll(/^\s*\('([^']+)', ([\d.]+), ([\d.]+), '/gm)) {
    spots.push({ name: m[1], lat: Number(m[2]), lng: Number(m[3]) });
  }
  return spots;
}

// 商用利用可で、改変（縮小）して使えるライセンスだけを通す
export function isAllowedLicense(short) {
  if (!short) return false;
  if (/\b(NC|ND)\b/i.test(short)) return false;
  return /^(CC0|Public domain|PD|CC BY(-SA)? [\d.]+)/i.test(short.trim());
}

export function stripHtml(html) {
  return String(html ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function slugFor(spot, photos) {
  const known = photos.find((p) => p.spot === spot);
  if (known) return known.full.split("/")[2];
  return `spot-${createHash("sha1").update(spot).digest("hex").slice(0, 8)}`;
}

async function commons(params) {
  const url = `${COMMONS_API}?${new URLSearchParams({ format: "json", formatversion: "2", origin: "*", ...params })}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Commons API ${res.status}`);
  return res.json();
}

const IMAGEINFO = {
  prop: "imageinfo",
  iiprop: "url|size|mime|extmetadata",
  iiurlwidth: "1280",
  iiextmetadatafilter: "LicenseShortName|Artist|ObjectName",
};

// 位置の近く（300m）→ 名前の順で候補を探す
export async function searchCandidates(spot) {
  const near = await commons({
    action: "query",
    generator: "geosearch",
    ggscoord: `${spot.lat}|${spot.lng}`,
    ggsradius: "300",
    ggsnamespace: "6",
    ggslimit: "30",
    ...IMAGEINFO,
  });
  const byName = await commons({
    action: "query",
    generator: "search",
    gsrsearch: `${spot.name} filetype:bitmap`,
    gsrnamespace: "6",
    gsrlimit: "20",
    ...IMAGEINFO,
  });
  const pages = [...(near.query?.pages ?? []), ...(byName.query?.pages ?? [])];
  const seen = new Set();
  return pages.flatMap((pg) => {
    const ii = pg.imageinfo?.[0];
    if (!ii || seen.has(pg.title)) return [];
    seen.add(pg.title);
    const meta = ii.extmetadata ?? {};
    const license = meta.LicenseShortName?.value;
    if (ii.mime !== "image/jpeg" || ii.width < 1000 || !isAllowedLicense(license) || !ii.thumburl) return [];
    return [
      {
        title: pg.title.replace(/^File:/, ""),
        page: ii.descriptionurl,
        thumburl: ii.thumburl,
        width: ii.thumbwidth,
        height: ii.thumbheight,
        license: license.trim(),
        artist: stripHtml(meta.Artist?.value) || "不明",
        label: stripHtml(meta.ObjectName?.value) || pg.title.replace(/^File:/, "").replace(/\.[a-z]+$/i, ""),
      },
    ];
  });
}

async function download(url, file) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`download ${res.status}: ${url}`);
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchMissing(args) {
  const min = Number(args[args.indexOf("--min") + 1]) || 2;
  const only = args.includes("--spot") ? args[args.indexOf("--spot") + 1] : null;
  const dry = args.includes("--dry-run");
  const photos = await loadPhotos();
  const seedSql = (await Promise.all(SEED_FILES.map((f) => readFile(path.join(ROOT, f), "utf8")))).join("\n");
  const spots = parseSeedSpots(seedSql).filter((s) => !only || s.name === only);
  const known = new Set(photos.map((p) => p.page));
  let added = 0;

  for (const spot of spots) {
    const have = photos.filter((p) => p.spot === spot.name).length;
    if (have >= min) continue;
    const candidates = (await searchCandidates(spot)).filter((c) => !known.has(c.page)).slice(0, min - have);
    console.log(`${spot.name}：${have}枚 → 候補 ${candidates.length}件`);
    const slug = slugFor(spot.name, photos);
    await mkdir(path.join(ROOT, "public/seed/photos", slug), { recursive: true });
    for (const c of candidates) {
      const n = String(photos.filter((p) => p.spot === spot.name).length + 1).padStart(2, "0");
      const full = `seed/photos/${slug}/${n}.jpg`;
      const thumb = `seed/photos/${slug}/${n}_t.jpg`;
      console.log(`  ${dry ? "（試行）" : ""}${c.title}｜${c.artist}｜${c.license}`);
      if (dry) continue;
      await download(c.thumburl, path.join(ROOT, "public", full));
      // Commons の縮小画像の URL は「…/1280px-名前」なので、幅を変えるとサムネイルになる
      await download(c.thumburl.replace(/\/\d+px-/, "/320px-"), path.join(ROOT, "public", thumb));
      photos.push({ spot: spot.name, full, thumb, width: c.width, height: c.height, label: c.label.slice(0, 40), title: c.title, artist: c.artist.slice(0, 80), license: c.license, page: c.page });
      known.add(c.page);
      added++;
      await sleep(1000);
    }
  }
  if (dry) return;
  photos.sort((a, b) => a.full.localeCompare(b.full));
  await writeFile(JSON_PATH, JSON.stringify(photos, null, 2) + "\n");
  await writeFile(SQL_PATH, buildSql(photos));
  console.log(`\n${added}枚を追加しました。/credits で写真を確認し、合わない写真は seed-photos.json から消してください。`);
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === "sql") {
    await writeFile(SQL_PATH, buildSql(await loadPhotos()));
    console.log(`supabase/seed/photos.sql を作り直しました`);
  } else if (cmd === "fetch") {
    await fetchMissing(args);
  } else {
    console.log("使い方: node scripts/seed-photos.mjs sql | fetch [--min 2] [--spot 名前] [--dry-run]");
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
