-- 金沢市外の石川県の初期データ（白米千枚田・千里浜なぎさドライブウェイ・那谷寺・鶴仙渓）。
-- kanazawa.sql と同じ考え方で、投稿者はログイン済みのユーザーに順番に割り当てる。何度実行しても同じスポットは重複しない。
-- 緯度経度はおおよその値なので、写真を入れるときに確認・修正すること。
-- 写真は supabase/seed/photos.sql で付ける（このファイルのあとに実行する）。

do $$
declare
  authors uuid[];
  s record;
  v_spot uuid;
  i integer;
  v_hour integer;
begin
  select array_agg(id order by created_at) into authors from public.profiles;
  if authors is null then
    raise notice 'profiles が空のため、石川県の初期データは入れませんでした。先に一度ログインしてください。';
    return;
  end if;

  for s in
    select * from (values
      -- 名前, 緯度, 経度, 住所, 市町, カテゴリ, 滞在時間, 投稿数, 投稿が多い時刻, コメント
      ('白米千枚田', 37.3926, 136.9067, '石川県輪島市白米町', '輪島市', 'nature', 'lt60', 4, array[10, 14, 17, 18], array['海に向かって小さな田んぼが段々に続く景色に圧倒される', '夕方は日本海に沈む夕日と田んぼが一緒に見られる', '金沢から車で2時間以上かかるので、時間に余裕をもって', '駐車場から棚田の下まで降りられる。帰りの坂は少しきつい']),
      ('千里浜なぎさドライブウェイ', 36.8838, 136.7629, '石川県羽咋市千里浜町', '羽咋市', 'nature', 'lt60', 4, array[11, 15, 17, 18], array['砂浜を車で走れる珍しい道。波打ち際がすぐ近く', '夕日の時間がいちばんきれい', '天気や波の状態で通行止めになることがあるので、行く前に確認を', '浜焼きのお店で一休みできる']),
      ('那谷寺', 36.3463, 136.5243, '石川県小松市那谷町', '小松市', 'history', 'lt60', 4, array[10, 11, 14, 15], array['奇岩遊仙境の岩肌と緑のコントラストがすごい', '紅葉の時期は境内全体が色づいて人も多い', '三重塔まで石段を上るので歩きやすい靴で', '広い境内をゆっくり回ると1時間くらい']),
      ('鶴仙渓', 36.2436, 136.3755, '石川県加賀市山中温泉', '加賀市', 'nature', 'lt60', 4, array[10, 11, 14, 15], array['川沿いの遊歩道が気持ちいい。こおろぎ橋からあやとり橋まで歩ける', '夏は川床でお茶と甘味を楽しめる', '山中温泉の温泉街から歩いてすぐ', '雨の翌日は足元がすべりやすいので注意'])
    ) as t(name, lat, lng, address, city, category, stay, n_posts, hours, comments)
  loop
    if exists (select 1 from public.spots where name = s.name and source = 'seed') then
      continue;
    end if;

    insert into public.spots (name, lat, lng, address, prefecture, city, category, source, created_by)
    values (s.name, s.lat, s.lng, s.address, '石川県', s.city, s.category, 'seed', authors[1])
    returning id into v_spot;

    for i in 1..s.n_posts loop
      v_hour := s.hours[i];
      insert into public.posts (user_id, spot_id, comment, category, stay_duration, created_at, updated_at)
      values (
        authors[1 + ((i - 1) % array_length(authors, 1))],
        v_spot,
        coalesce(s.comments[i], ''),
        s.category,
        case when i <= 3 or i % 2 = 0 then s.stay else null end,
        (date_trunc('day', now() at time zone 'Asia/Tokyo') - make_interval(days => i * 3) + make_interval(hours => v_hour, mins => (i * 7) % 60))
          at time zone 'Asia/Tokyo',
        now()
      );
    end loop;
  end loop;

  perform public.refresh_popularity();
end;
$$;
