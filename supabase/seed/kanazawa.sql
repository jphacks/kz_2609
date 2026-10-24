-- 金沢市の初期データ（要件定義書 10.5）。写真なしの仮データ。
-- 写真はあとでチームが用意して追加する（写真のないスポットは地図でカテゴリのアイコンになる）。
-- 緯度経度はおおよその値なので、写真を入れるときに確認・修正すること。
--
-- 投稿者：ローカルではテストユーザー3人に順番に割り当てる。
-- 本番の Supabase で使う場合は、メンバーが一度ログインしてから SQL エディタでこのファイルを実行する
-- （ログイン済みのユーザーに順番に割り当てられる）。何度実行しても同じスポットは重複しない。

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
    raise notice 'profiles が空のため、金沢の初期データは入れませんでした。先に一度ログインしてください。';
    return;
  end if;

  for s in
    select * from (values
      -- 名前, 緯度, 経度, 住所, カテゴリ, 滞在時間, 投稿数, 投稿が多い時刻, コメント
      ('金沢駅 鼓門', 36.5781, 136.6480, '石川県金沢市木ノ新保町', 'photogenic', 'lt30', 5, array[9, 10, 17, 18, 19], array['駅を出てすぐ。夜のライトアップも見に行く価値あり', '朝は人が少なくて正面から撮りやすい']),
      ('近江町市場', 36.5716, 136.6566, '石川県金沢市上近江町', 'gourmet', 'lt60', 6, array[10, 11, 11, 12, 12, 13], array['海鮮丼は昼前に行くと並ばずに入れた', '食べ歩きできるお店が多い。現金があると安心']),
      ('兼六園', 36.5621, 136.6626, '石川県金沢市兼六町', 'nature', 'lt120', 8, array[8, 8, 9, 9, 10, 14, 15, 16], array['開園直後は人が少なくて、霞ヶ池の灯籠がきれいに撮れます', '園内は広いので2時間くらいみておくと安心']),
      ('金沢城公園', 36.5650, 136.6595, '石川県金沢市丸の内', 'history', 'lt60', 3, array[10, 11, 15], array['兼六園から歩いてすぐ。石垣がいろいろあって面白い', '広くて歩きやすい']),
      ('金沢21世紀美術館', 36.5609, 136.6582, '石川県金沢市広坂', 'photogenic', 'lt120', 6, array[10, 11, 13, 14, 15, 16], array['無料ゾーンだけでも楽しめる', '人気の展示は時間で整理券が出ることがあるので早めがおすすめ']),
      ('石川県立美術館', 36.5594, 136.6614, '石川県金沢市出羽町', 'history', 'lt60', 2, array[13, 14], array['静かでゆっくり見られる。併設のカフェもおすすめ']),
      ('鈴木大拙館', 36.5583, 136.6636, '石川県金沢市本多町', 'photogenic', 'lt60', 3, array[10, 14, 15], array['水鏡の庭がとても落ち着く。静かに過ごしたい人向け']),
      ('ひがし茶屋街', 36.5725, 136.6667, '石川県金沢市東山', 'history', 'lt120', 7, array[9, 10, 10, 11, 15, 16, 17], array['朝早い時間は人が少なく、町並みをゆっくり撮れる', '金箔のお店が多くて見て回るだけで楽しい']),
      ('箔座ひかり藏', 36.5724, 136.6664, '石川県金沢市東山', 'photogenic', 'lt30', 2, array[11, 15], array['金色の蔵は一度見ておきたい']),
      ('宇多須神社', 36.5730, 136.6680, '石川県金沢市東山', 'history', 'lt30', 1, array[10], array['ひがし茶屋街から少し歩くだけ。落ち着いた雰囲気']),
      ('主計町茶屋街', 36.5713, 136.6630, '石川県金沢市主計町', 'history', 'lt30', 3, array[16, 17, 18], array['夕方から灯りがついて雰囲気がよくなる', 'ひがし茶屋街よりこぢんまりしていて静か']),
      ('主計町緑水苑', 36.5705, 136.6620, '石川県金沢市尾張町', 'nature', 'lt30', 1, array[14], array['小さな庭園。休憩にちょうどいい']),
      ('浅野川 梅ノ橋', 36.5733, 136.6644, '石川県金沢市東山', 'photogenic', 'lt30', 3, array[16, 17, 17], array['川沿いの景色がきれい。夕方の光がおすすめ']),
      ('卯辰山公園 望湖台', 36.5737, 136.6810, '石川県金沢市卯辰町', 'nature', 'lt60', 2, array[17, 19], array['金沢の街を見下ろせる。夜景もきれい', '坂がきついのでバスかタクシーが楽']),
      ('長町武家屋敷跡', 36.5627, 136.6500, '石川県金沢市長町', 'history', 'lt60', 4, array[9, 10, 14, 15], array['土塀の路地を歩くだけでも雰囲気がある', '野村家の庭園は見ごたえあり']),
      ('尾山神社', 36.5655, 136.6550, '石川県金沢市尾山町', 'history', 'lt30', 4, array[10, 16, 18, 19], array['神門のステンドグラスが珍しい。夜のライトアップもきれい']),
      ('いもり堀', 36.5625, 136.6600, '石川県金沢市広坂', 'history', 'lt30', 1, array[15], array['兼六園と21世紀美術館の間。歩く途中に寄れる']),
      ('しいのき迎賓館', 36.5630, 136.6585, '石川県金沢市広坂', 'other', 'lt30', 2, array[12, 15], array['石垣側の眺めがいい。休憩スポットとして便利']),
      ('本多の森公園', 36.5580, 136.6640, '石川県金沢市出羽町', 'nature', 'lt30', 1, array[11], array['美術館めぐりの合間に散歩できる']),
      ('香林坊', 36.5620, 136.6540, '石川県金沢市香林坊', 'other', 'lt60', 2, array[13, 18], array['買い物と食事ならここ。バスの乗り換えにも便利']),
      ('にし茶屋街', 36.5535, 136.6505, '石川県金沢市野町', 'history', 'lt30', 2, array[11, 14], array['ひがし茶屋街より人が少なく、ゆっくり見られる']),
      ('妙立寺（忍者寺）', 36.5530, 136.6487, '石川県金沢市野町', 'history', 'lt60', 3, array[10, 13, 14], array['からくりの説明が面白い。見学は予約がおすすめ']),
      ('寺町寺院群', 36.5505, 136.6475, '石川県金沢市寺町', 'history', 'lt30', 1, array[15], array['お寺が並ぶ通りを散策できる']),
      ('犀川 桜橋', 36.5530, 136.6560, '石川県金沢市寺町', 'nature', 'lt30', 2, array[8, 17], array['川沿いの散歩道が気持ちいい。春は桜がきれい']),
      ('金沢港クルーズターミナル', 36.6083, 136.6040, '石川県金沢市無量寺町', 'photogenic', 'lt60', 3, array[16, 17, 17], array['日本海に沈む夕日がきれい。夕方に合わせて行くのがおすすめ', '駅から離れているのでバスの時間を確認しておく']),
      ('金沢海みらい図書館', 36.5913, 136.6200, '石川県金沢市寺中町', 'photogenic', 'lt60', 2, array[11, 14], array['白い壁の丸い窓がたくさん並んでいて、写真映えする']),
      ('金沢市民芸術村', 36.5810, 136.6370, '石川県金沢市大和町', 'other', 'lt30', 1, array[15], array['レンガの倉庫が並ぶ広い公園。のんびりできる']),
      ('玉泉園', 36.5640, 136.6630, '石川県金沢市小将町', 'nature', 'lt30', 1, array[10], array['兼六園の近くにある静かな庭園'])
    ) as t(name, lat, lng, address, category, stay, n_posts, hours, comments)
  loop
    if exists (select 1 from public.spots where name = s.name and source = 'seed') then
      continue;
    end if;

    insert into public.spots (name, lat, lng, address, prefecture, city, category, source, created_by)
    values (s.name, s.lat, s.lng, s.address, '石川県', '金沢市', s.category, 'seed', authors[1])
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
        -- 投稿時刻（日本時間）を投稿が多い時刻にそろえる。日付は過去30日に散らす
        (date_trunc('day', now() at time zone 'Asia/Tokyo') - make_interval(days => i * 3) + make_interval(hours => v_hour, mins => (i * 7) % 60))
          at time zone 'Asia/Tokyo',
        now()
      );
    end loop;
  end loop;

  perform public.refresh_popularity();
end;
$$;
