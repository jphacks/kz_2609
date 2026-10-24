-- 旅行どこいこう 初期スキーマ（要件定義書 10章）
create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- profiles（auth.users と1対1）
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 20),
  avatar_url text,
  is_admin boolean not null default false,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

-- ログインしたら profiles を自動で作る。表示名は Google の名前（20文字まで）
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'ゲスト'
  );
  if v_name = '' then
    v_name := 'ゲスト';
  end if;
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, left(v_name, 20), new.raw_user_meta_data ->> 'avatar_url');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- spots
-- ---------------------------------------------------------------------------
create table public.spots (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 50),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  location extensions.geography (Point, 4326)
    generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  address text,
  prefecture text,
  city text,
  category text not null default 'other'
    check (category in ('nature', 'gourmet', 'history', 'photogenic', 'other')),
  source text not null default 'gps'
    check (source in ('gps', 'search_db', 'search_external', 'seed')),
  external_ref text,
  post_count integer not null default 0,
  like_count integer not null default 0,
  popularity text not null default 'normal'
    check (popularity in ('normal', 'popular', 'very_popular')),
  cover_image_id uuid,
  stay_minutes_median integer,
  hour_histogram integer[] not null default array_fill(0, array[24]),
  opening_hours jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index spots_location_idx on public.spots using gist (location);
create index spots_lat_lng_idx on public.spots (lat, lng);
create index spots_name_idx on public.spots (name);

-- ---------------------------------------------------------------------------
-- posts / post_images / likes
-- ---------------------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  spot_id uuid not null references public.spots (id) on delete cascade,
  comment text not null default '' check (char_length(comment) <= 150),
  category text not null
    check (category in ('nature', 'gourmet', 'history', 'photogenic', 'other')),
  stay_duration text check (stay_duration in ('lt30', 'lt60', 'lt120', 'half_day')),
  like_count integer not null default 0,
  status text not null default 'public' check (status in ('public', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_spot_idx on public.posts (spot_id, created_at desc);
create index posts_user_idx on public.posts (user_id, created_at desc);

create table public.post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  full_path text not null,
  thumb_path text not null,
  width integer not null,
  height integer not null,
  sort_order smallint not null default 0 check (sort_order between 0 and 3)
);

create index post_images_post_idx on public.post_images (post_id, sort_order);

alter table public.spots
  add constraint spots_cover_image_fk
  foreign key (cover_image_id) references public.post_images (id) on delete set null;

create table public.likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- ---------------------------------------------------------------------------
-- 行きたい場所リスト・経路プラン
-- ---------------------------------------------------------------------------
create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  base_label text check (base_label is null or char_length(base_label) <= 50),
  base_lat double precision,
  base_lng double precision,
  share_token text unique,
  created_at timestamptz not null default now()
);

create index wishlists_user_idx on public.wishlists (user_id, created_at desc);

create table public.wishlist_items (
  wishlist_id uuid not null references public.wishlists (id) on delete cascade,
  spot_id uuid not null references public.spots (id) on delete cascade,
  must_visit boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (wishlist_id, spot_id)
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  method text not null check (method in ('auto', 'preferences', 'chat')),
  params jsonb not null,
  result jsonb not null,
  total_travel_min integer not null,
  created_at timestamptz not null default now()
);

create index plans_wishlist_idx on public.plans (wishlist_id, created_at desc);

-- ---------------------------------------------------------------------------
-- サーバー専用：移動時間キャッシュ・無料枠・システム状態・通報
-- travel_time_cache は v0.6 から使わない（Google から取得した移動時間は保存しない。ADR-0019）
-- ---------------------------------------------------------------------------
create table public.travel_time_cache (
  from_key text not null,
  to_key text not null,
  mode text not null check (mode in ('transit', 'walking', 'driving')),
  time_bucket text not null default 'any',
  duration_sec integer not null,
  distance_m integer not null,
  fetched_at timestamptz not null default now(),
  primary key (from_key, to_key, mode, time_bucket)
);

create table public.api_usage (
  provider text not null,
  sku text not null,
  period text not null,
  count integer not null default 0,
  "limit" integer not null,
  suspended_at timestamptz,
  primary key (provider, sku, period)
);

create table public.system_flags (
  key text primary key,
  value boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.system_flags (key, value) values ('posting_suspended', false);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('inappropriate', 'wrong_place', 'spam', 'other')),
  note text check (note is null or char_length(note) <= 100),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);

-- ---------------------------------------------------------------------------
-- 集計（F-2-13）：投稿数・いいね合計・代表写真・滞在時間の中央値・時間帯の分布・カテゴリ
-- ---------------------------------------------------------------------------
create or replace function public.refresh_spot_stats(p_spot_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post_count integer;
  v_like_count integer;
  v_cover uuid;
  v_median integer;
  v_hist integer[];
  v_category text;
begin
  select count(*), coalesce(sum(like_count), 0)
    into v_post_count, v_like_count
    from public.posts
   where spot_id = p_spot_id and status = 'public';

  -- 代表写真：いいね数が最も多い投稿（同数なら新しい方）の1枚目
  select pi.id into v_cover
    from public.posts p
    join public.post_images pi on pi.post_id = p.id
   where p.spot_id = p_spot_id and p.status = 'public'
   order by p.like_count desc, p.created_at desc, pi.sort_order asc
   limit 1;

  -- 滞在時間の中央値（3件以上）
  select case when count(*) >= 3 then
           (percentile_cont(0.5) within group (order by
              case stay_duration when 'lt30' then 30 when 'lt60' then 60
                                 when 'lt120' then 120 when 'half_day' then 240 end))::integer
         end
    into v_median
    from public.posts
   where spot_id = p_spot_id and status = 'public' and stay_duration is not null;

  -- 投稿時刻（日本時間）の分布
  select array_agg(coalesce(c.n, 0) order by h.hour)
    into v_hist
    from generate_series(0, 23) as h(hour)
    left join (
      select extract(hour from created_at at time zone 'Asia/Tokyo')::integer as hour, count(*)::integer as n
        from public.posts
       where spot_id = p_spot_id and status = 'public'
       group by 1
    ) c on c.hour = h.hour;

  -- 投稿で最も多いカテゴリ
  select category into v_category
    from public.posts
   where spot_id = p_spot_id and status = 'public'
   group by category
   order by count(*) desc, max(created_at) desc
   limit 1;

  update public.spots
     set post_count = v_post_count,
         like_count = v_like_count,
         cover_image_id = v_cover,
         stay_minutes_median = v_median,
         hour_histogram = v_hist,
         category = coalesce(v_category, category)
   where id = p_spot_id;
end;
$$;

create or replace function public.on_posts_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.refresh_spot_stats(old.spot_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.spot_id <> old.spot_id) then
    perform public.refresh_spot_stats(new.spot_id);
  end if;
  return null;
end;
$$;

create trigger posts_changed
  after insert or update or delete on public.posts
  for each row execute function public.on_posts_changed();

create or replace function public.on_post_images_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_spot uuid;
begin
  select spot_id into v_spot from public.posts where id = coalesce(new.post_id, old.post_id);
  if v_spot is not null then
    perform public.refresh_spot_stats(v_spot);
  end if;
  return null;
end;
$$;

create trigger post_images_changed
  after insert or delete on public.post_images
  for each row execute function public.on_post_images_changed();

create or replace function public.on_likes_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post uuid := coalesce(new.post_id, old.post_id);
begin
  update public.posts
     set like_count = (select count(*) from public.likes where post_id = v_post)
   where id = v_post;
  return null;
end;
$$;

create trigger likes_changed
  after insert or delete on public.likes
  for each row execute function public.on_likes_changed();

-- 人気度（F-1-5）：市区町村内の投稿数の順位。10件未満の市区町村は都道府県単位。投稿1件は通常
create or replace function public.refresh_popularity()
returns void
language sql
security definer
set search_path = ''
as $$
  with visible as (
    select s.id, s.post_count,
           coalesce(s.prefecture, '') as pref,
           coalesce(s.city, '') as city
      from public.spots s
     where s.post_count > 0
  ),
  city_sizes as (
    select pref, city, count(*) as n from visible group by pref, city
  ),
  grouped as (
    select v.id, v.post_count,
           case when cs.n >= 10 then v.pref || '/' || v.city else v.pref end as area
      from visible v
      join city_sizes cs on cs.pref = v.pref and cs.city = v.city
  ),
  ranked as (
    select id, post_count,
           row_number() over (partition by area order by post_count desc) as pos,
           count(*) over (partition by area) as total
      from grouped
  )
  update public.spots s
     set popularity = case
           when r.post_count < 2 then 'normal'
           when r.pos::numeric / r.total <= 0.1 then 'very_popular'
           when r.pos::numeric / r.total <= 0.3 then 'popular'
           else 'normal'
         end
    from ranked r
   where r.id = s.id;
$$;

-- ---------------------------------------------------------------------------
-- 地図用：区画内のスポット（F-1-2）
-- ---------------------------------------------------------------------------
create or replace function public.spots_in_bbox(
  p_min_lng double precision,
  p_min_lat double precision,
  p_max_lng double precision,
  p_max_lat double precision,
  p_categories text[] default null,
  p_limit integer default 500
)
returns table (
  id uuid,
  name text,
  lat double precision,
  lng double precision,
  category text,
  post_count integer,
  like_count integer,
  popularity text,
  cover_thumb_path text
)
language sql
stable
set search_path = ''
as $$
  select s.id, s.name, s.lat, s.lng, s.category, s.post_count, s.like_count, s.popularity,
         pi.thumb_path
    from public.spots s
    left join public.post_images pi on pi.id = s.cover_image_id
   where s.post_count > 0
     and s.lng between p_min_lng and p_max_lng
     and s.lat between p_min_lat and p_max_lat
     and (p_categories is null or s.category = any (p_categories))
   order by s.post_count desc
   limit p_limit;
$$;

-- 現在地近くのスポット（F-2-6）
create or replace function public.spots_nearby(
  p_lat double precision,
  p_lng double precision,
  p_radius_m double precision
)
returns table (
  id uuid,
  name text,
  lat double precision,
  lng double precision,
  distance_m double precision,
  cover_thumb_path text
)
language sql
stable
set search_path = ''
as $$
  select s.id, s.name, s.lat, s.lng,
         extensions.st_distance(s.location, extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography) as distance_m,
         pi.thumb_path
    from public.spots s
    left join public.post_images pi on pi.id = s.cover_image_id
   where extensions.st_dwithin(s.location, extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography, p_radius_m)
   order by distance_m
   limit 10;
$$;

-- ---------------------------------------------------------------------------
-- 無料枠（F-8）：呼び出し前に件数を確認し、80%を超えるなら停止にして false を返す
-- ---------------------------------------------------------------------------
create or replace function public.consume_api_quota(
  p_provider text,
  p_sku text,
  p_period text,
  p_units integer,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.api_usage;
begin
  insert into public.api_usage (provider, sku, period, count, "limit")
  values (p_provider, p_sku, p_period, 0, p_limit)
  on conflict (provider, sku, period) do update set "limit" = excluded."limit";

  select * into v_row from public.api_usage
   where provider = p_provider and sku = p_sku and period = p_period
   for update;

  if v_row.suspended_at is not null or v_row.count + p_units > floor(p_limit * 0.8) then
    update public.api_usage
       set suspended_at = coalesce(suspended_at, now())
     where provider = p_provider and sku = p_sku and period = p_period;
    return false;
  end if;

  update public.api_usage
     set count = count + p_units
   where provider = p_provider and sku = p_sku and period = p_period;
  return true;
end;
$$;

-- Supabase の使用量（F-8-7）：DB 500MB・Storage 1GB の80%で新規投稿を停止
create or replace function public.check_supabase_usage()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_db bigint := pg_database_size(current_database());
  v_storage bigint;
  v_suspend boolean;
begin
  select coalesce(sum((metadata ->> 'size')::bigint), 0) into v_storage from storage.objects;
  v_suspend := v_db > 500 * 1024 * 1024 * 0.8 or v_storage > 1024::bigint * 1024 * 1024 * 0.8;
  update public.system_flags
     set value = v_suspend, updated_at = now()
   where key = 'posting_suspended' and value is distinct from v_suspend;
end;
$$;

-- ---------------------------------------------------------------------------
-- 権限（RLS。10.3）
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.spots enable row level security;
alter table public.posts enable row level security;
alter table public.post_images enable row level security;
alter table public.likes enable row level security;
alter table public.wishlists enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.plans enable row level security;
alter table public.travel_time_cache enable row level security;
alter table public.api_usage enable row level security;
alter table public.system_flags enable row level security;
alter table public.reports enable row level security;

create policy "profiles are readable" on public.profiles for select using (true);
create policy "update own profile" on public.profiles for update
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "spots are readable" on public.spots for select using (true);

create policy "public posts are readable" on public.posts for select
  using (status = 'public' or (select auth.uid()) = user_id);
create policy "insert own posts" on public.posts for insert
  with check ((select auth.uid()) = user_id);
create policy "update own posts" on public.posts for update
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own posts" on public.posts for delete
  using ((select auth.uid()) = user_id);

create policy "post images are readable" on public.post_images for select using (true);
create policy "insert images of own posts" on public.post_images for insert
  with check (exists (select 1 from public.posts p where p.id = post_id and p.user_id = (select auth.uid())));
create policy "delete images of own posts" on public.post_images for delete
  using (exists (select 1 from public.posts p where p.id = post_id and p.user_id = (select auth.uid())));

create policy "likes are readable" on public.likes for select using (true);
create policy "insert own likes" on public.likes for insert with check ((select auth.uid()) = user_id);
create policy "delete own likes" on public.likes for delete using ((select auth.uid()) = user_id);

create policy "own wishlists" on public.wishlists for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own wishlist items" on public.wishlist_items for all
  using (exists (select 1 from public.wishlists w where w.id = wishlist_id and w.user_id = (select auth.uid())))
  with check (exists (select 1 from public.wishlists w where w.id = wishlist_id and w.user_id = (select auth.uid())));
create policy "own plans" on public.plans for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- travel_time_cache / api_usage / system_flags / reports はサーバー（service role）のみ

-- ---------------------------------------------------------------------------
-- Storage（10.4）
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', true, 2097152, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;
