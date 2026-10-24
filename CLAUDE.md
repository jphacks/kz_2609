@AGENTS.md

# このリポジトリでの作業

- 仕様は `docs/要件定義書.md`、設計判断は `docs/ADR.md`。決定を変えるときは既存の ADR を書き換えず、新しい ADR を追加して古い方を「書き換え済み」にする。
- コミットは README.md の「コミットのルール」に従う。特に **1つの機能・1つの修正を1コミット** にし、画面・API・DB・テスト・資料の変更はその機能のコミットにまとめる。
- コミットの前に `npm run typecheck`・`npm run lint`・`npm test` を通す。
- main への push で Vercel（アプリ）と Supabase（`supabase/migrations/`）に自動で反映される。キーや `.env.local` はコミットしない（公開リポジトリ）。
