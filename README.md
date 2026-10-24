# 旅行

テストコミット

[![IMAGE ALT TEXT HERE](https://jphacks.com/wp-content/uploads/2026/07/IMG_5316.png)](https://www.youtube.com/watch?v=piaNsc6ilBI)

<!-- デモ動画ができたら、上の画像とリンクを差し替える -->

## 製品概要

現地の写真が集まる地図で行き先を探し、行きたい場所リストから1日の回り方を自動で作る、大学生向けの旅行計画サービスです。

### 背景(製品開発のきっかけ、課題等）

旅行を考えるとき、どこに行けばいいか、どう回ればいいかがわかりにくいという課題があります。観光サイトの情報は文字が中心で、現地の写真が少なく、行く前に雰囲気をイメージしにくいです。国内旅行で「失敗・やらかし」を経験した人は約76%、計画段階でストレス（計画疲れ）を感じている人は約7割にのぼります（[出典](https://prtimes.jp/main/html/rd/p/000000001.000034728.html)）。

### 製品説明（具体的な製品の説明）

1. 地図を開くと、投稿が多いエリアがヒートマップで光り、近づくと写真の束、さらに近づくと写真のピンに切り替わります。
2. ピンを選ぶと、実際に行った人の写真・コメント・投稿が多い時間帯・滞在時間の目安が見られます。
3. 気になったスポットを「行きたい場所リスト」に集め、拠点（ホテル・駅など）からの距離で並べ替えたり、2〜3件を比較したりできます。
4. リストから「経路を作成」を押すと、滞在時間・おすすめの時間帯・昼食休憩を考えた1日の回り方を最大3案作ります。
5. 細かい希望があるときは「AIと相談」で「夕日は金沢港で見たい」「歩くのは少なめがいい」のように話すと、AIが条件（時刻の指定・順番・ペースなど）に置き換え、それを満たす回り方を作ります。
6. 選んだ案は区間ごとに移動手段（徒歩・車・公共交通）を変えられ、保存すると区間ごとの「ナビ開始」から Google マップの道案内を開けます。
7. 旅行中は、写真とコメントをその場で投稿して、次の旅行者のための地図を育てます。

### 特長

#### 1. 写真で「人気」がひと目でわかる地図

投稿の多さを、広域ではヒートマップ、中域では写真の束の厚み、詳細では「人気」「大人気」の枠で表します。数字ではなく写真で、観光地として有名でない「隠れた名所」も見つけられます。

#### 2. 行きたい場所から、無理のない1日の回り方を自動で作成

訪問順を全通り調べ、移動の少なさ・回れる数・おすすめの時間帯の3つの観点で特徴の違う案を出します。滞在時間は投稿の中央値、おすすめの時間帯は投稿時刻の分布から決めます。

#### 3. 当日の道案内まで迷わない

所要時間は Google Routes API で実際の道路・公共交通を考えて計算します。当日は「ナビ開始」から Google マップに引き継ぎます。

### 解決出来ること

- 行き先を決める段階：写真と投稿の多さで、行き先を直感的に選べます。
- 計画する段階：回る順番や時間配分を自動で作るため、計画疲れを減らせます。
- 当日：区間ごとに Google マップの道案内を開けるため、現地で迷いません。

### 今後の展望

- スポット検索画面、通報機能、リストの共有
- 営業時間を考えた経路作成
- 金沢以外の地域への展開

### 注力したこと（こだわり等）

- 地図を動かしている間も、区画ごとにデータを取りながらピンを描き続け、表示が途切れないようにしました。
- 外部サービスはすべて無料枠の中で使い、80%に達したら自動で止める仕組みを入れました。
- 写真はブラウザで縮小し、位置情報などの EXIF をすべて消してからアップロードします。
- 絵文字を使わず Lucide アイコンでそろえ、スマホの片手操作（44px以上のタップ領域）を基本にしました。

## 開発技術

### 活用した技術

#### API・データ

- Google Routes API（Compute Route Matrix / Compute Routes の Essentials）：徒歩・車・公共交通の所要時間
- Google マップ URL：当日の道案内（「ナビ開始」）
- Gemini API（無料枠）：「AIと相談」で会話を経路の条件に置き換える
- OpenFreeMap：背景地図
- OpenStreetMap Nominatim：スポット名から場所を検索
- Supabase（PostgreSQL・PostGIS・Auth・Storage・pg_cron）
- 石川県の32スポットの初期データ（金沢市28・市外4。`supabase/seed/kanazawa.sql`・`ishikawa.sql`）と、Wikimedia Commons のクリエイティブ・コモンズ等の写真40枚（作者・ライセンスは `/credits` と各写真の下に表示。`src/lib/seed-photos.json`）

#### フレームワーク・ライブラリ・モジュール

- Next.js 16（App Router）、React 19、TypeScript、Tailwind CSS v4
- MapLibre GL JS、Supercluster（写真の束のまとめ）
- zod（入力チェック）、Lucide（アイコン）、heic2any（iPhone の写真の変換）
- Vitest（経路計算のテスト）
- Vercel（公開）、GitHub Actions・Cloudflare R2（バックアップ）

#### デバイス

- スマートフォンのブラウザ（GPS・カメラロール）
- PC のブラウザ

### 独自技術

#### ハッカソンで開発した独自機能・技術

- 経路案の計算：スポットの選び方と訪問順を全通り調べ、時間内に回れる数が最も多い順番の中から、観点の違う3案を選びます（[src/lib/planner/index.ts](src/lib/planner/index.ts)、テストは [planner.test.ts](src/lib/planner/planner.test.ts)）。
- AIと相談：AIには会話を条件（時刻の指定・順番の希望・除外・ペースなど）に置き換えることだけを任せ、経路は自前の全探索で計算します。AIの返答はリスト内のスポットと決まった値だけに絞って検証し、絵文字も取り除きます（[src/lib/plan-chat.ts](src/lib/plan-chat.ts)、[src/app/api/v1/plans/chat/route.ts](src/app/api/v1/plans/chat/route.ts)）。
- 区間ごとの移動手段の変更と再計算：区間だけ Google Routes API で取り直し、それ以降の時刻を画面で計算し直します（[src/components/plan-result.tsx](src/components/plan-result.tsx)、[src/lib/external/routing.ts](src/lib/external/routing.ts)）。
- ズームに応じてヒートマップ・写真の束・写真ピンを切り替える地図（[src/components/map/spot-map.tsx](src/components/map/spot-map.tsx)、[markers.ts](src/components/map/markers.ts)）。
- 投稿から人気度・代表写真・滞在時間の中央値・時間帯の分布を集計する DB の関数と、無料枠の80%で止める仕組み（[supabase/migrations/20261024000000_init.sql](supabase/migrations/20261024000000_init.sql)）。

#### 事前に準備したもの

- 要件定義書・ADR・PDR（[docs/](docs/)）

## 動かし方

```bash
npm install
```

```bash
npm run dev
```

http://localhost:3000 を開きます。Supabase のキーがなくても、地図とスポット詳細は金沢のデモデータで確認できます。ログイン・投稿・リスト・経路作成には [セットアップ手順](docs/セットアップ手順.md) の設定が必要です。

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー |
| `npm run build` | 本番ビルド |
| `npm run typecheck` | 型チェック |
| `npm run lint` | ESLint |
| `npm test` | 経路計算のテスト |

## 資料

| 資料 | 内容 |
| --- | --- |
| [docs/要件定義書.md](docs/要件定義書.md) | 機能要件・画面・API・データ設計 |
| [docs/ADR.md](docs/ADR.md) | 設計判断の記録（変えるときは新しいADRを追加） |
| [docs/PDR_v3.md](docs/PDR_v3.md) | プロダクトの要求 |
| [docs/セットアップ手順.md](docs/セットアップ手順.md) | Supabase・Googleログイン・APIキーなど、チームで設定するもの |

## 構成

| 場所 | 内容 |
| --- | --- |
| `src/app/` | 画面（S-01〜S-17）と API（`src/app/api/v1/`） |
| `src/components/` | 画面の部品。地図は `components/map/` |
| `src/lib/planner/` | 経路作成の計算（要件定義書 11章）。画面とサーバーで共通 |
| `src/lib/external/` | 外部サービス（移動時間・場所検索）と無料枠の管理 |
| `supabase/migrations/` | DB のテーブル・権限・集計・定期処理 |
| `supabase/seed/` | テストユーザー（ローカル専用）と石川県の初期データ・写真の登録 |
| `public/seed/photos/` | 初期データの写真（`npm run seed:photos -- fetch` で足りない写真を追加） |
| `.github/workflows/` | バックアップ・毎日の運用処理（Secrets が未登録の間は何もしない） |

## 開発のルール

- アイコンは Lucide だけを使い、絵文字は使わない（要件定義書 8.1）。
- 片側だけに色の線を付けるカード（border-left のアクセント）は使わない（8.2）。
- APIキーはサーバー側の環境変数だけに置き、リポジトリに入れない。
- 開発中は `USE_MOCK_EXTERNAL_APIS=true` にして、外部APIの無料枠を使わない。
- Next.js 16 を使っているため、書き方は `node_modules/next/dist/docs/` を確認する（AGENTS.md）。
