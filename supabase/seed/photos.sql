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
