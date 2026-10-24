-- 初期データの写真を投稿に付ける（scripts/seed-photos.mjs sql で自動生成。直接編集しない）。
-- 画像はアプリの public/seed/photos/ にあり、作者・ライセンスは src/lib/seed-photos.json と /credits に表示する。
-- kanazawa.sql・ishikawa.sql のあとに実行する。何度実行しても同じ写真は重複しない。

-- 金沢21世紀美術館（4枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/21st-century-museum/01.jpg', 'seed/photos/21st-century-museum/01_t.jpg', 1280, 960, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '金沢21世紀美術館' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/21st-century-museum/01.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/21st-century-museum/02.jpg', 'seed/photos/21st-century-museum/02_t.jpg', 1280, 854, (1 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '金沢21世紀美術館' and sp.source = 'seed'
) p
where p.idx = 1 % p.n and 1 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/21st-century-museum/02.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/21st-century-museum/03.jpg', 'seed/photos/21st-century-museum/03_t.jpg', 1280, 836, (2 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '金沢21世紀美術館' and sp.source = 'seed'
) p
where p.idx = 2 % p.n and 2 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/21st-century-museum/03.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/21st-century-museum/04.jpg', 'seed/photos/21st-century-museum/04_t.jpg', 1280, 720, (3 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '金沢21世紀美術館' and sp.source = 'seed'
) p
where p.idx = 3 % p.n and 3 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/21st-century-museum/04.jpg');

-- 金沢市民芸術村（1枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/art-village/01.jpg', 'seed/photos/art-village/01_t.jpg', 1280, 960, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '金沢市民芸術村' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/art-village/01.jpg');

-- 千里浜なぎさドライブウェイ（4枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/chirihama/01.jpg', 'seed/photos/chirihama/01_t.jpg', 1280, 720, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '千里浜なぎさドライブウェイ' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/chirihama/01.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/chirihama/02.jpg', 'seed/photos/chirihama/02_t.jpg', 1280, 853, (1 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '千里浜なぎさドライブウェイ' and sp.source = 'seed'
) p
where p.idx = 1 % p.n and 1 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/chirihama/02.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/chirihama/03.jpg', 'seed/photos/chirihama/03_t.jpg', 1280, 960, (2 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '千里浜なぎさドライブウェイ' and sp.source = 'seed'
) p
where p.idx = 2 % p.n and 2 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/chirihama/03.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/chirihama/04.jpg', 'seed/photos/chirihama/04_t.jpg', 1280, 960, (3 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '千里浜なぎさドライブウェイ' and sp.source = 'seed'
) p
where p.idx = 3 % p.n and 3 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/chirihama/04.jpg');

-- 玉泉園（4枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/gyokusenen/01.jpg', 'seed/photos/gyokusenen/01_t.jpg', 1280, 854, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '玉泉園' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/gyokusenen/01.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/gyokusenen/02.jpg', 'seed/photos/gyokusenen/02_t.jpg', 854, 1280, (1 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '玉泉園' and sp.source = 'seed'
) p
where p.idx = 1 % p.n and 1 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/gyokusenen/02.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/gyokusenen/03.jpg', 'seed/photos/gyokusenen/03_t.jpg', 854, 1280, (2 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '玉泉園' and sp.source = 'seed'
) p
where p.idx = 2 % p.n and 2 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/gyokusenen/03.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/gyokusenen/04.jpg', 'seed/photos/gyokusenen/04_t.jpg', 1280, 854, (3 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '玉泉園' and sp.source = 'seed'
) p
where p.idx = 3 % p.n and 3 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/gyokusenen/04.jpg');

-- 箔座ひかり藏（1枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/hakuza/01.jpg', 'seed/photos/hakuza/01_t.jpg', 1280, 851, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '箔座ひかり藏' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/hakuza/01.jpg');

-- ひがし茶屋街（4枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/higashi-chaya/01.jpg', 'seed/photos/higashi-chaya/01_t.jpg', 1280, 853, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = 'ひがし茶屋街' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/higashi-chaya/01.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/higashi-chaya/02.jpg', 'seed/photos/higashi-chaya/02_t.jpg', 1280, 758, (1 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = 'ひがし茶屋街' and sp.source = 'seed'
) p
where p.idx = 1 % p.n and 1 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/higashi-chaya/02.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/higashi-chaya/03.jpg', 'seed/photos/higashi-chaya/03_t.jpg', 1280, 960, (2 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = 'ひがし茶屋街' and sp.source = 'seed'
) p
where p.idx = 2 % p.n and 2 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/higashi-chaya/03.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/higashi-chaya/04.jpg', 'seed/photos/higashi-chaya/04_t.jpg', 1280, 853, (3 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = 'ひがし茶屋街' and sp.source = 'seed'
) p
where p.idx = 3 % p.n and 3 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/higashi-chaya/04.jpg');

-- 本多の森公園（3枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/honda-forest/01.jpg', 'seed/photos/honda-forest/01_t.jpg', 1280, 962, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '本多の森公園' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/honda-forest/01.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/honda-forest/02.jpg', 'seed/photos/honda-forest/02_t.jpg', 1024, 1280, (1 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '本多の森公園' and sp.source = 'seed'
) p
where p.idx = 1 % p.n and 1 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/honda-forest/02.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/honda-forest/03.jpg', 'seed/photos/honda-forest/03_t.jpg', 1280, 960, (2 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '本多の森公園' and sp.source = 'seed'
) p
where p.idx = 2 % p.n and 2 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/honda-forest/03.jpg');

-- いもり堀（3枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/imoribori/01.jpg', 'seed/photos/imoribori/01_t.jpg', 1280, 960, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = 'いもり堀' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/imoribori/01.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/imoribori/02.jpg', 'seed/photos/imoribori/02_t.jpg', 1280, 960, (1 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = 'いもり堀' and sp.source = 'seed'
) p
where p.idx = 1 % p.n and 1 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/imoribori/02.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/imoribori/03.jpg', 'seed/photos/imoribori/03_t.jpg', 1280, 960, (2 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = 'いもり堀' and sp.source = 'seed'
) p
where p.idx = 2 % p.n and 2 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/imoribori/03.jpg');

-- 石川県立美術館（2枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/ishikawa-art-museum/01.jpg', 'seed/photos/ishikawa-art-museum/01_t.jpg', 1280, 960, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '石川県立美術館' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/ishikawa-art-museum/01.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/ishikawa-art-museum/02.jpg', 'seed/photos/ishikawa-art-museum/02_t.jpg', 1280, 854, (1 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '石川県立美術館' and sp.source = 'seed'
) p
where p.idx = 1 % p.n and 1 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/ishikawa-art-museum/02.jpg');

-- 鶴仙渓（4枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/kakusenkei/01.jpg', 'seed/photos/kakusenkei/01_t.jpg', 1200, 900, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '鶴仙渓' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/kakusenkei/01.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/kakusenkei/02.jpg', 'seed/photos/kakusenkei/02_t.jpg', 853, 1280, (1 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '鶴仙渓' and sp.source = 'seed'
) p
where p.idx = 1 % p.n and 1 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/kakusenkei/02.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/kakusenkei/03.jpg', 'seed/photos/kakusenkei/03_t.jpg', 1280, 853, (2 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '鶴仙渓' and sp.source = 'seed'
) p
where p.idx = 2 % p.n and 2 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/kakusenkei/03.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/kakusenkei/04.jpg', 'seed/photos/kakusenkei/04_t.jpg', 853, 1280, (3 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '鶴仙渓' and sp.source = 'seed'
) p
where p.idx = 3 % p.n and 3 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/kakusenkei/04.jpg');

-- 金沢城公園（4枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/kanazawa-castle/01.jpg', 'seed/photos/kanazawa-castle/01_t.jpg', 1280, 720, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '金沢城公園' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/kanazawa-castle/01.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/kanazawa-castle/02.jpg', 'seed/photos/kanazawa-castle/02_t.jpg', 1280, 891, (1 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '金沢城公園' and sp.source = 'seed'
) p
where p.idx = 1 % p.n and 1 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/kanazawa-castle/02.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/kanazawa-castle/03.jpg', 'seed/photos/kanazawa-castle/03_t.jpg', 1280, 960, (2 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '金沢城公園' and sp.source = 'seed'
) p
where p.idx = 2 % p.n and 2 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/kanazawa-castle/03.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/kanazawa-castle/04.jpg', 'seed/photos/kanazawa-castle/04_t.jpg', 1280, 853, (3 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '金沢城公園' and sp.source = 'seed'
) p
where p.idx = 3 % p.n and 3 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/kanazawa-castle/04.jpg');

-- 金沢港クルーズターミナル（4枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/kanazawa-port/01.jpg', 'seed/photos/kanazawa-port/01_t.jpg', 1280, 960, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '金沢港クルーズターミナル' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/kanazawa-port/01.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/kanazawa-port/02.jpg', 'seed/photos/kanazawa-port/02_t.jpg', 1280, 854, (1 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '金沢港クルーズターミナル' and sp.source = 'seed'
) p
where p.idx = 1 % p.n and 1 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/kanazawa-port/02.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/kanazawa-port/03.jpg', 'seed/photos/kanazawa-port/03_t.jpg', 1280, 854, (2 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '金沢港クルーズターミナル' and sp.source = 'seed'
) p
where p.idx = 2 % p.n and 2 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/kanazawa-port/03.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/kanazawa-port/04.jpg', 'seed/photos/kanazawa-port/04_t.jpg', 1280, 853, (3 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '金沢港クルーズターミナル' and sp.source = 'seed'
) p
where p.idx = 3 % p.n and 3 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/kanazawa-port/04.jpg');

-- 金沢駅 鼓門（4枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/kanazawa-station/01.jpg', 'seed/photos/kanazawa-station/01_t.jpg', 1280, 960, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '金沢駅 鼓門' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/kanazawa-station/01.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/kanazawa-station/02.jpg', 'seed/photos/kanazawa-station/02_t.jpg', 1280, 853, (1 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '金沢駅 鼓門' and sp.source = 'seed'
) p
where p.idx = 1 % p.n and 1 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/kanazawa-station/02.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/kanazawa-station/03.jpg', 'seed/photos/kanazawa-station/03_t.jpg', 1280, 853, (2 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '金沢駅 鼓門' and sp.source = 'seed'
) p
where p.idx = 2 % p.n and 2 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/kanazawa-station/03.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/kanazawa-station/04.jpg', 'seed/photos/kanazawa-station/04_t.jpg', 1280, 960, (3 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '金沢駅 鼓門' and sp.source = 'seed'
) p
where p.idx = 3 % p.n and 3 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/kanazawa-station/04.jpg');

-- 主計町茶屋街（4枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/kazuemachi/01.jpg', 'seed/photos/kazuemachi/01_t.jpg', 854, 1280, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '主計町茶屋街' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/kazuemachi/01.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/kazuemachi/02.jpg', 'seed/photos/kazuemachi/02_t.jpg', 1280, 854, (1 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '主計町茶屋街' and sp.source = 'seed'
) p
where p.idx = 1 % p.n and 1 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/kazuemachi/02.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/kazuemachi/03.jpg', 'seed/photos/kazuemachi/03_t.jpg', 1280, 854, (2 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '主計町茶屋街' and sp.source = 'seed'
) p
where p.idx = 2 % p.n and 2 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/kazuemachi/03.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/kazuemachi/04.jpg', 'seed/photos/kazuemachi/04_t.jpg', 1280, 854, (3 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '主計町茶屋街' and sp.source = 'seed'
) p
where p.idx = 3 % p.n and 3 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/kazuemachi/04.jpg');

-- 兼六園（4枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/kenrokuen/01.jpg', 'seed/photos/kenrokuen/01_t.jpg', 960, 1280, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '兼六園' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/kenrokuen/01.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/kenrokuen/02.jpg', 'seed/photos/kenrokuen/02_t.jpg', 1280, 907, (1 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '兼六園' and sp.source = 'seed'
) p
where p.idx = 1 % p.n and 1 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/kenrokuen/02.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/kenrokuen/03.jpg', 'seed/photos/kenrokuen/03_t.jpg', 1280, 960, (2 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '兼六園' and sp.source = 'seed'
) p
where p.idx = 2 % p.n and 2 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/kenrokuen/03.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/kenrokuen/04.jpg', 'seed/photos/kenrokuen/04_t.jpg', 1280, 960, (3 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '兼六園' and sp.source = 'seed'
) p
where p.idx = 3 % p.n and 3 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/kenrokuen/04.jpg');

-- 香林坊（3枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/korinbo/01.jpg', 'seed/photos/korinbo/01_t.jpg', 1280, 956, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '香林坊' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/korinbo/01.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/korinbo/02.jpg', 'seed/photos/korinbo/02_t.jpg', 960, 1280, (1 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '香林坊' and sp.source = 'seed'
) p
where p.idx = 1 % p.n and 1 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/korinbo/02.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/korinbo/03.jpg', 'seed/photos/korinbo/03_t.jpg', 1280, 920, (2 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '香林坊' and sp.source = 'seed'
) p
where p.idx = 2 % p.n and 2 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/korinbo/03.jpg');

-- 妙立寺（忍者寺）（4枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/myoryuji/01.jpg', 'seed/photos/myoryuji/01_t.jpg', 1280, 960, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '妙立寺（忍者寺）' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/myoryuji/01.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/myoryuji/02.jpg', 'seed/photos/myoryuji/02_t.jpg', 1280, 960, (1 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '妙立寺（忍者寺）' and sp.source = 'seed'
) p
where p.idx = 1 % p.n and 1 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/myoryuji/02.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/myoryuji/03.jpg', 'seed/photos/myoryuji/03_t.jpg', 1280, 950, (2 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '妙立寺（忍者寺）' and sp.source = 'seed'
) p
where p.idx = 2 % p.n and 2 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/myoryuji/03.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/myoryuji/04.jpg', 'seed/photos/myoryuji/04_t.jpg', 1280, 960, (3 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '妙立寺（忍者寺）' and sp.source = 'seed'
) p
where p.idx = 3 % p.n and 3 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/myoryuji/04.jpg');

-- 長町武家屋敷跡（4枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/nagamachi/01.jpg', 'seed/photos/nagamachi/01_t.jpg', 1280, 960, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '長町武家屋敷跡' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/nagamachi/01.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/nagamachi/02.jpg', 'seed/photos/nagamachi/02_t.jpg', 1280, 960, (1 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '長町武家屋敷跡' and sp.source = 'seed'
) p
where p.idx = 1 % p.n and 1 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/nagamachi/02.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/nagamachi/03.jpg', 'seed/photos/nagamachi/03_t.jpg', 1280, 960, (2 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '長町武家屋敷跡' and sp.source = 'seed'
) p
where p.idx = 2 % p.n and 2 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/nagamachi/03.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/nagamachi/04.jpg', 'seed/photos/nagamachi/04_t.jpg', 1280, 854, (3 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '長町武家屋敷跡' and sp.source = 'seed'
) p
where p.idx = 3 % p.n and 3 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/nagamachi/04.jpg');

-- 那谷寺（4枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/natadera/01.jpg', 'seed/photos/natadera/01_t.jpg', 853, 1280, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '那谷寺' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/natadera/01.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/natadera/02.jpg', 'seed/photos/natadera/02_t.jpg', 853, 1280, (1 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '那谷寺' and sp.source = 'seed'
) p
where p.idx = 1 % p.n and 1 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/natadera/02.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/natadera/03.jpg', 'seed/photos/natadera/03_t.jpg', 1280, 960, (2 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '那谷寺' and sp.source = 'seed'
) p
where p.idx = 2 % p.n and 2 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/natadera/03.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/natadera/04.jpg', 'seed/photos/natadera/04_t.jpg', 1280, 720, (3 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '那谷寺' and sp.source = 'seed'
) p
where p.idx = 3 % p.n and 3 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/natadera/04.jpg');

-- にし茶屋街（4枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/nishi-chaya/01.jpg', 'seed/photos/nishi-chaya/01_t.jpg', 1280, 854, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = 'にし茶屋街' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/nishi-chaya/01.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/nishi-chaya/02.jpg', 'seed/photos/nishi-chaya/02_t.jpg', 1280, 960, (1 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = 'にし茶屋街' and sp.source = 'seed'
) p
where p.idx = 1 % p.n and 1 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/nishi-chaya/02.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/nishi-chaya/03.jpg', 'seed/photos/nishi-chaya/03_t.jpg', 1280, 960, (2 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = 'にし茶屋街' and sp.source = 'seed'
) p
where p.idx = 2 % p.n and 2 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/nishi-chaya/03.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/nishi-chaya/04.jpg', 'seed/photos/nishi-chaya/04_t.jpg', 1280, 854, (3 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = 'にし茶屋街' and sp.source = 'seed'
) p
where p.idx = 3 % p.n and 3 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/nishi-chaya/04.jpg');

-- 近江町市場（4枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/omicho/01.jpg', 'seed/photos/omicho/01_t.jpg', 1280, 851, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '近江町市場' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/omicho/01.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/omicho/02.jpg', 'seed/photos/omicho/02_t.jpg', 1164, 1280, (1 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '近江町市場' and sp.source = 'seed'
) p
where p.idx = 1 % p.n and 1 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/omicho/02.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/omicho/03.jpg', 'seed/photos/omicho/03_t.jpg', 1280, 960, (2 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '近江町市場' and sp.source = 'seed'
) p
where p.idx = 2 % p.n and 2 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/omicho/03.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/omicho/04.jpg', 'seed/photos/omicho/04_t.jpg', 1280, 720, (3 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '近江町市場' and sp.source = 'seed'
) p
where p.idx = 3 % p.n and 3 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/omicho/04.jpg');

-- 尾山神社（4枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/oyama-jinja/01.jpg', 'seed/photos/oyama-jinja/01_t.jpg', 949, 1280, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '尾山神社' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/oyama-jinja/01.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/oyama-jinja/02.jpg', 'seed/photos/oyama-jinja/02_t.jpg', 1280, 960, (1 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '尾山神社' and sp.source = 'seed'
) p
where p.idx = 1 % p.n and 1 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/oyama-jinja/02.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/oyama-jinja/03.jpg', 'seed/photos/oyama-jinja/03_t.jpg', 1280, 960, (2 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '尾山神社' and sp.source = 'seed'
) p
where p.idx = 2 % p.n and 2 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/oyama-jinja/03.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/oyama-jinja/04.jpg', 'seed/photos/oyama-jinja/04_t.jpg', 1280, 854, (3 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '尾山神社' and sp.source = 'seed'
) p
where p.idx = 3 % p.n and 3 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/oyama-jinja/04.jpg');

-- 犀川 桜橋（4枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/sakurabashi/01.jpg', 'seed/photos/sakurabashi/01_t.jpg', 1000, 667, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '犀川 桜橋' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/sakurabashi/01.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/sakurabashi/02.jpg', 'seed/photos/sakurabashi/02_t.jpg', 1280, 854, (1 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '犀川 桜橋' and sp.source = 'seed'
) p
where p.idx = 1 % p.n and 1 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/sakurabashi/02.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/sakurabashi/03.jpg', 'seed/photos/sakurabashi/03_t.jpg', 1280, 854, (2 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '犀川 桜橋' and sp.source = 'seed'
) p
where p.idx = 2 % p.n and 2 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/sakurabashi/03.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/sakurabashi/04.jpg', 'seed/photos/sakurabashi/04_t.jpg', 1280, 962, (3 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '犀川 桜橋' and sp.source = 'seed'
) p
where p.idx = 3 % p.n and 3 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/sakurabashi/04.jpg');

-- しいのき迎賓館（4枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/shiinoki/01.jpg', 'seed/photos/shiinoki/01_t.jpg', 1280, 960, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = 'しいのき迎賓館' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/shiinoki/01.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/shiinoki/02.jpg', 'seed/photos/shiinoki/02_t.jpg', 1280, 960, (1 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = 'しいのき迎賓館' and sp.source = 'seed'
) p
where p.idx = 1 % p.n and 1 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/shiinoki/02.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/shiinoki/03.jpg', 'seed/photos/shiinoki/03_t.jpg', 1280, 960, (2 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = 'しいのき迎賓館' and sp.source = 'seed'
) p
where p.idx = 2 % p.n and 2 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/shiinoki/03.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/shiinoki/04.jpg', 'seed/photos/shiinoki/04_t.jpg', 1280, 960, (3 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = 'しいのき迎賓館' and sp.source = 'seed'
) p
where p.idx = 3 % p.n and 3 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/shiinoki/04.jpg');

-- 白米千枚田（4枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/shiroyone-senmaida/01.jpg', 'seed/photos/shiroyone-senmaida/01_t.jpg', 1280, 851, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '白米千枚田' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/shiroyone-senmaida/01.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/shiroyone-senmaida/02.jpg', 'seed/photos/shiroyone-senmaida/02_t.jpg', 1280, 853, (1 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '白米千枚田' and sp.source = 'seed'
) p
where p.idx = 1 % p.n and 1 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/shiroyone-senmaida/02.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/shiroyone-senmaida/03.jpg', 'seed/photos/shiroyone-senmaida/03_t.jpg', 1280, 851, (2 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '白米千枚田' and sp.source = 'seed'
) p
where p.idx = 2 % p.n and 2 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/shiroyone-senmaida/03.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/shiroyone-senmaida/04.jpg', 'seed/photos/shiroyone-senmaida/04_t.jpg', 1280, 960, (3 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '白米千枚田' and sp.source = 'seed'
) p
where p.idx = 3 % p.n and 3 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/shiroyone-senmaida/04.jpg');

-- 鈴木大拙館（4枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/suzuki-daisetz/01.jpg', 'seed/photos/suzuki-daisetz/01_t.jpg', 1280, 960, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '鈴木大拙館' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/suzuki-daisetz/01.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/suzuki-daisetz/02.jpg', 'seed/photos/suzuki-daisetz/02_t.jpg', 960, 1280, (1 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '鈴木大拙館' and sp.source = 'seed'
) p
where p.idx = 1 % p.n and 1 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/suzuki-daisetz/02.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/suzuki-daisetz/03.jpg', 'seed/photos/suzuki-daisetz/03_t.jpg', 1280, 854, (2 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '鈴木大拙館' and sp.source = 'seed'
) p
where p.idx = 2 % p.n and 2 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/suzuki-daisetz/03.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/suzuki-daisetz/04.jpg', 'seed/photos/suzuki-daisetz/04_t.jpg', 1280, 854, (3 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '鈴木大拙館' and sp.source = 'seed'
) p
where p.idx = 3 % p.n and 3 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/suzuki-daisetz/04.jpg');

-- 寺町寺院群（4枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/teramachi/01.jpg', 'seed/photos/teramachi/01_t.jpg', 1280, 850, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '寺町寺院群' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/teramachi/01.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/teramachi/02.jpg', 'seed/photos/teramachi/02_t.jpg', 1280, 960, (1 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '寺町寺院群' and sp.source = 'seed'
) p
where p.idx = 1 % p.n and 1 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/teramachi/02.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/teramachi/03.jpg', 'seed/photos/teramachi/03_t.jpg', 1280, 960, (2 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '寺町寺院群' and sp.source = 'seed'
) p
where p.idx = 2 % p.n and 2 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/teramachi/03.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/teramachi/04.jpg', 'seed/photos/teramachi/04_t.jpg', 1280, 852, (3 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '寺町寺院群' and sp.source = 'seed'
) p
where p.idx = 3 % p.n and 3 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/teramachi/04.jpg');

-- 浅野川 梅ノ橋（4枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/umenohashi/01.jpg', 'seed/photos/umenohashi/01_t.jpg', 1280, 960, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '浅野川 梅ノ橋' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/umenohashi/01.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/umenohashi/02.jpg', 'seed/photos/umenohashi/02_t.jpg', 1280, 854, (1 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '浅野川 梅ノ橋' and sp.source = 'seed'
) p
where p.idx = 1 % p.n and 1 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/umenohashi/02.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/umenohashi/03.jpg', 'seed/photos/umenohashi/03_t.jpg', 1280, 801, (2 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '浅野川 梅ノ橋' and sp.source = 'seed'
) p
where p.idx = 2 % p.n and 2 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/umenohashi/03.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/umenohashi/04.jpg', 'seed/photos/umenohashi/04_t.jpg', 1280, 959, (3 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '浅野川 梅ノ橋' and sp.source = 'seed'
) p
where p.idx = 3 % p.n and 3 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/umenohashi/04.jpg');

-- 金沢海みらい図書館（4枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/umimirai-library/01.jpg', 'seed/photos/umimirai-library/01_t.jpg', 1280, 960, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '金沢海みらい図書館' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/umimirai-library/01.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/umimirai-library/02.jpg', 'seed/photos/umimirai-library/02_t.jpg', 1280, 851, (1 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '金沢海みらい図書館' and sp.source = 'seed'
) p
where p.idx = 1 % p.n and 1 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/umimirai-library/02.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/umimirai-library/03.jpg', 'seed/photos/umimirai-library/03_t.jpg', 1280, 850, (2 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '金沢海みらい図書館' and sp.source = 'seed'
) p
where p.idx = 2 % p.n and 2 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/umimirai-library/03.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/umimirai-library/04.jpg', 'seed/photos/umimirai-library/04_t.jpg', 1280, 851, (3 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '金沢海みらい図書館' and sp.source = 'seed'
) p
where p.idx = 3 % p.n and 3 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/umimirai-library/04.jpg');

-- 宇多須神社（2枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/utasu-jinja/01.jpg', 'seed/photos/utasu-jinja/01_t.jpg', 1280, 854, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '宇多須神社' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/utasu-jinja/01.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/utasu-jinja/02.jpg', 'seed/photos/utasu-jinja/02_t.jpg', 1280, 960, (1 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '宇多須神社' and sp.source = 'seed'
) p
where p.idx = 1 % p.n and 1 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/utasu-jinja/02.jpg');

-- 卯辰山公園 望湖台（4枚）
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/utatsuyama/01.jpg', 'seed/photos/utatsuyama/01_t.jpg', 1280, 857, (0 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '卯辰山公園 望湖台' and sp.source = 'seed'
) p
where p.idx = 0 % p.n and 0 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/utatsuyama/01.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/utatsuyama/02.jpg', 'seed/photos/utatsuyama/02_t.jpg', 854, 1280, (1 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '卯辰山公園 望湖台' and sp.source = 'seed'
) p
where p.idx = 1 % p.n and 1 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/utatsuyama/02.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/utatsuyama/03.jpg', 'seed/photos/utatsuyama/03_t.jpg', 1280, 182, (2 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '卯辰山公園 望湖台' and sp.source = 'seed'
) p
where p.idx = 2 % p.n and 2 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/utatsuyama/03.jpg');
insert into public.post_images (post_id, full_path, thumb_path, width, height, sort_order)
select p.id, 'seed/photos/utatsuyama/04.jpg', 'seed/photos/utatsuyama/04_t.jpg', 1280, 854, (3 / p.n)::smallint
from (
  select po.id, row_number() over (order by po.created_at, po.id) - 1 as idx, count(*) over () as n
  from public.posts po join public.spots sp on sp.id = po.spot_id
  where sp.name = '卯辰山公園 望湖台' and sp.source = 'seed'
) p
where p.idx = 3 % p.n and 3 / p.n < 4
  and not exists (select 1 from public.post_images where full_path = 'seed/photos/utatsuyama/04.jpg');
