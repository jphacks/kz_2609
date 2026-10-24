// 毎日の運用処理（.github/workflows/daily-maintenance.yml から実行）
// 1. posts/tmp/ にある24時間以上前の一時ファイルを削除する（投稿されなかった写真）
// 2. DB に軽い問い合わせをして、無料プランの一時停止を防ぐ
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const bucket = supabase.storage.from("post-images");
const cutoff = Date.now() - 24 * 60 * 60 * 1000;

const { data: users, error: listError } = await bucket.list("posts/tmp", { limit: 1000 });
if (listError) throw listError;

let removed = 0;
for (const dir of users ?? []) {
  const prefix = `posts/tmp/${dir.name}`;
  const { data: files, error } = await bucket.list(prefix, { limit: 1000 });
  if (error) throw error;
  const old = (files ?? []).filter((f) => f.created_at && new Date(f.created_at).getTime() < cutoff);
  if (old.length > 0) {
    const { error: rmError } = await bucket.remove(old.map((f) => `${prefix}/${f.name}`));
    if (rmError) throw rmError;
    removed += old.length;
  }
}
console.log(`一時ファイルを ${removed} 件削除しました`);

const { error: pingError } = await supabase.from("system_flags").select("key").limit(1);
if (pingError) throw pingError;
console.log("DB への問い合わせに成功しました");
