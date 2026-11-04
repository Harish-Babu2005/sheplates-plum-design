-- Food Drops can be kept in the normal customer cart and converted into
-- vendor-specific orders at checkout. Apply after V9_12 Food Drops.
begin;

alter table public.commerce_cart_items
  add column if not exists food_drop_id uuid
  references public.food_drops(id) on delete cascade;

create index if not exists commerce_cart_items_food_drop_idx
  on public.commerce_cart_items(food_drop_id)
  where food_drop_id is not null;

create or replace function public.claim_food_drops(p_drop_ids uuid[], p_quantities int[])
returns setof public.food_drop_claims
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := coalesce(array_length(p_drop_ids, 1), 0);
  v_index int;
  v_drop public.food_drops;
  v_claim public.food_drop_claims;
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '28000';
  end if;
  if v_count <> coalesce(array_length(p_quantities, 1), 0) then
    raise exception 'Drop IDs and quantities must have the same length' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_quantities) as q(quantity) where q.quantity is null or q.quantity <= 0) then
    raise exception 'Quantity must be positive' using errcode = '22023';
  end if;

  for v_index in 1..v_count loop
    v_drop := null;
    update public.food_drops
      set remaining_quantity = remaining_quantity - p_quantities[v_index], updated_at = now()
      where id = p_drop_ids[v_index]
        and status = 'active'
        and clock_timestamp() >= starts_at
        and clock_timestamp() < ends_at
        and remaining_quantity >= p_quantities[v_index]
      returning * into v_drop;

    if v_drop.id is null then
      raise exception 'Food Drops are no longer available' using errcode = 'P0001';
    end if;

    insert into public.food_drop_claims (drop_id, customer_id, quantity, unit_price, total_price)
    values (p_drop_ids[v_index], auth.uid(), p_quantities[v_index], v_drop.drop_price, v_drop.drop_price * p_quantities[v_index])
    returning * into v_claim;
    return next v_claim;
  end loop;
  return;
end;
$$;

revoke all on function public.claim_food_drops(uuid[], int[]) from public, anon;
grant execute on function public.claim_food_drops(uuid[], int[]) to authenticated;

notify pgrst, 'reload schema';

commit;
