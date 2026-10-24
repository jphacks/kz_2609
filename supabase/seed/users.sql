-- ローカル開発専用のテストユーザー（supabase db reset のときだけ読み込まれる）。
-- 本番の Supabase には入れないこと。ログインは画面の「開発用ログイン」から行う
-- （NEXT_PUBLIC_ENABLE_DEV_LOGIN=true のときだけ表示）。
-- パスワードはすべて tabi-dev-pass-2026

do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('11111111-1111-4111-8111-111111111111'::uuid, 'kazuya@example.test', 'かずや'),
      ('22222222-2222-4222-8222-222222222222'::uuid, 'zenki@example.test', 'ぜんき'),
      ('33333333-3333-4333-8333-333333333333'::uuid, 'kotaro@example.test', 'kotaro')
    ) as t(id, email, name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('tabi-dev-pass-2026', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', u.name), now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', u.id::text, now(), now(), now());
    update public.profiles set onboarded = true where id = u.id;
  end loop;
end;
$$;
