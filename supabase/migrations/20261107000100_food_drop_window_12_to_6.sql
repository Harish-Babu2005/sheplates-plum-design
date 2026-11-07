-- Food Drops now run from 12:00 PM to 6:00 PM IST (they used to run 8:00 PM to midnight).
--
-- Safe to re-run. This replaces only the two database functions that fix the window and guard the stock; it does not touch the
-- plan prices that V9_12 sets, and V9_12 should not be run again just for this. A new drop opens at 12 PM IST (or at once, if it is
-- created between 12 PM and 6 PM) and closes at 6 PM IST the same day. A drop created after 6 PM is created already ended, so the
-- vendor sees it as Ended and customers cannot buy it. The stock is still taken by one conditional UPDATE, so two customers can
-- never take the last unit.

create or replace function public.set_food_drop_daily_window()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_local_now timestamp without time zone := now() at time zone 'Asia/Kolkata';
  v_local_open timestamp without time zone := date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '12 hours';
  v_local_close timestamp without time zone := date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '18 hours';
begin
  if v_local_now >= v_local_open and v_local_now < v_local_close then
    new.starts_at := now();
  else
    new.starts_at := v_local_open at time zone 'Asia/Kolkata';
  end if;
  new.ends_at := v_local_close at time zone 'Asia/Kolkata';
  return new;
end;
$$;

drop trigger if exists food_drops_daily_window on public.food_drops;
create trigger food_drops_daily_window
before insert on public.food_drops
for each row execute function public.set_food_drop_daily_window();

create or replace function public.claim_food_drop(p_drop_id uuid, p_quantity int)
returns public.food_drop_claims
language plpgsql
security definer
set search_path = public
as $$
declare
  v_drop public.food_drops;
  v_claim public.food_drop_claims;
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '28000';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be positive' using errcode = '22023';
  end if;

  update public.food_drops
    set remaining_quantity = remaining_quantity - p_quantity, updated_at = now()
    where id = p_drop_id
      and status = 'active'
      and clock_timestamp() >= starts_at
      and clock_timestamp() < ends_at
      and remaining_quantity >= p_quantity
    returning * into v_drop;

  if v_drop.id is null then
    raise exception 'Food Drops are claimable from 12:00 PM to 6:00 PM IST, while stock lasts' using errcode = 'P0001';
  end if;

  insert into public.food_drop_claims (drop_id, customer_id, quantity, unit_price, total_price)
  values (p_drop_id, auth.uid(), p_quantity, v_drop.drop_price, v_drop.drop_price * p_quantity)
  returning * into v_claim;

  return v_claim;
end;
$$;

revoke all on function public.claim_food_drop(uuid, int) from public, anon;
grant execute on function public.claim_food_drop(uuid, int) to authenticated;

-- A drop that is live under the old 8 PM window is moved to the new 12 PM to 6 PM window of its day, so nothing created before
-- this update stays claimable until midnight (after 6 PM that means it ends now). Drops that already ended are left alone.
update public.food_drops
set starts_at = (date_trunc('day', starts_at at time zone 'Asia/Kolkata') + interval '12 hours') at time zone 'Asia/Kolkata',
    ends_at   = (date_trunc('day', starts_at at time zone 'Asia/Kolkata') + interval '18 hours') at time zone 'Asia/Kolkata',
    updated_at = now()
where status = 'active'
  and ends_at > now()
  and (starts_at at time zone 'Asia/Kolkata')::time >= time '18:00';

notify pgrst, 'reload schema';
