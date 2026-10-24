-- 定期処理（要件定義書 12章）。Supabase の pg_cron で実行する
create extension if not exists pg_cron with schema pg_catalog;

-- 人気度の更新：1時間ごと
select cron.schedule('refresh-popularity', '5 * * * *', $$select public.refresh_popularity()$$);

-- Supabase使用量の確認：1時間ごと（80%で新規投稿を停止。F-8-7）
select cron.schedule('check-supabase-usage', '15 * * * *', $$select public.check_supabase_usage()$$);

-- 移動時間キャッシュは v0.6 から使わない（ADR-0019）ため、削除の定期処理は登録しない
