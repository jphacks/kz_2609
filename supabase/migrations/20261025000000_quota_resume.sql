-- 無料枠（F-8）：停止したあとに上限の設定を上げたら、同じ期間内でも再開できるようにする。
-- これまでは一度停止すると、上限を直しても期間（日・月）が変わるまで止まったままだった
-- （空の環境変数で上限が0として記録され、「AIと相談」がその日ずっと止まる不具合の対策）
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

  if v_row.count + p_units > floor(p_limit * 0.8) then
    update public.api_usage
       set suspended_at = coalesce(suspended_at, now())
     where provider = p_provider and sku = p_sku and period = p_period;
    return false;
  end if;

  update public.api_usage
     set count = count + p_units,
         suspended_at = null
   where provider = p_provider and sku = p_sku and period = p_period;
  return true;
end;
$$;
