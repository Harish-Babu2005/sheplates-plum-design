-- V9.20 Food Drops Stock Reservation and Concurrency Guard
-- Enforces that a vendor cannot create or edit a Food Drop with units exceeding current stock.
-- Atomically reserves units from vendor_menu_items.stock_quantity on create/increase,
-- and refunds unsold units on edit/decrease or cancel.

-- 1. Create Food Drop with atomic stock check and reservation
create or replace function public.create_food_drop_with_stock(
  p_vendor_id uuid,
  p_product_id uuid,
  p_title text,
  p_drop_price numeric,
  p_original_price numeric,
  p_total_quantity int,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_description text default null
)
returns public.food_drops
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prod record;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_drop public.food_drops;
begin
  if p_total_quantity is null then
    raise exception 'Please enter the number of units available.' using errcode = '22023';
  end if;
  if p_total_quantity < 0 then
    raise exception 'Units available cannot be negative.' using errcode = '22023';
  end if;
  if p_total_quantity = 0 then
    raise exception 'Units available must be at least 1.' using errcode = '22023';
  end if;

  -- Lock product row to prevent concurrent drops / edits race conditions
  select id, name, stock_quantity, active into v_prod
  from public.vendor_menu_items
  where id = p_product_id and vendor_id = p_vendor_id
  for update;

  if v_prod.id is null then
    raise exception 'Product not found.' using errcode = 'P0002';
  end if;

  if coalesce(v_prod.stock_quantity, 0) <= 0 then
    raise exception 'This product is out of stock. Add stock first.' using errcode = 'P0001';
  end if;

  if p_total_quantity > v_prod.stock_quantity then
    raise exception 'You entered % units, but only % are in stock for %. Please enter % or fewer, or update your stock first.',
      p_total_quantity, v_prod.stock_quantity, v_prod.name, v_prod.stock_quantity
      using errcode = 'P0001';
  end if;

  -- Atomically reserve stock from regular inventory
  update public.vendor_menu_items
  set stock_quantity = stock_quantity - p_total_quantity,
      updated_at = now()
  where id = p_product_id;

  v_starts_at := coalesce(p_starts_at, now());
  v_ends_at := coalesce(p_ends_at, now() + interval '6 hours');

  insert into public.food_drops (
    vendor_id, product_id, title, description, drop_price, original_price,
    total_quantity, remaining_quantity, starts_at, ends_at, status
  )
  values (
    p_vendor_id, p_product_id, trim(p_title), p_description, p_drop_price, p_original_price,
    p_total_quantity, p_total_quantity, v_starts_at, v_ends_at, 'active'
  )
  returning * into v_drop;

  return v_drop;
end;
$$;

-- 2. Update Food Drop with atomic stock check and adjustment
create or replace function public.update_food_drop_with_stock(
  p_drop_id uuid,
  p_title text default null,
  p_drop_price numeric default null,
  p_new_quantity int default null
)
returns public.food_drops
language plpgsql
security definer
set search_path = public
as $$
declare
  v_drop public.food_drops;
  v_prod record;
  v_claimed int;
  v_diff int;
  v_new_remaining int;
begin
  -- Lock drop
  select * into v_drop
  from public.food_drops
  where id = p_drop_id
  for update;

  if v_drop.id is null then
    raise exception 'Food Drop not found.' using errcode = 'P0002';
  end if;

  if p_new_quantity is not null then
    if p_new_quantity < 0 then
      raise exception 'Units available cannot be negative.' using errcode = '22023';
    end if;
    if p_new_quantity = 0 then
      raise exception 'Units available must be at least 1.' using errcode = '22023';
    end if;

    v_claimed := v_drop.total_quantity - v_drop.remaining_quantity;
    if p_new_quantity < v_claimed then
      raise exception 'Cannot reduce units below % already claimed by customers.', v_claimed using errcode = 'P0001';
    end if;

    -- Lock product row
    select id, name, stock_quantity into v_prod
    from public.vendor_menu_items
    where id = v_drop.product_id
    for update;

    v_diff := p_new_quantity - v_drop.total_quantity;
    if v_diff > 0 then
      if v_diff > coalesce(v_prod.stock_quantity, 0) then
        raise exception 'You entered % units, but only % more are in stock for %. Please enter % or fewer, or update your stock first.',
          p_new_quantity, coalesce(v_prod.stock_quantity, 0), v_prod.name, (v_drop.total_quantity + coalesce(v_prod.stock_quantity, 0))
          using errcode = 'P0001';
      end if;
      -- Reserve extra stock
      update public.vendor_menu_items
      set stock_quantity = stock_quantity - v_diff,
          updated_at = now()
      where id = v_drop.product_id;
    elsif v_diff < 0 then
      -- Return excess back to stock
      update public.vendor_menu_items
      set stock_quantity = stock_quantity + (-v_diff),
          updated_at = now()
      where id = v_drop.product_id;
    end if;

    v_new_remaining := v_drop.remaining_quantity + v_diff;
  else
    v_new_remaining := v_drop.remaining_quantity;
    p_new_quantity := v_drop.total_quantity;
  end if;

  update public.food_drops
  set title = coalesce(trim(p_title), title),
      drop_price = coalesce(p_drop_price, drop_price),
      total_quantity = p_new_quantity,
      remaining_quantity = v_new_remaining,
      updated_at = now()
  where id = p_drop_id
  returning * into v_drop;

  return v_drop;
end;
$$;

-- 3. Cancel Food Drop and refund remaining units back to product stock
create or replace function public.cancel_food_drop_with_stock(p_drop_id uuid)
returns public.food_drops
language plpgsql
security definer
set search_path = public
as $$
declare
  v_drop public.food_drops;
begin
  select * into v_drop
  from public.food_drops
  where id = p_drop_id
  for update;

  if v_drop.id is null then
    raise exception 'Food Drop not found.' using errcode = 'P0002';
  end if;

  if v_drop.status = 'cancelled' then
    return v_drop;
  end if;

  if v_drop.remaining_quantity > 0 then
    -- Lock and refund to product
    update public.vendor_menu_items
    set stock_quantity = stock_quantity + v_drop.remaining_quantity,
        updated_at = now()
    where id = v_drop.product_id;
  end if;

  update public.food_drops
  set status = 'cancelled',
      updated_at = now()
  where id = p_drop_id
  returning * into v_drop;

  return v_drop;
end;
$$;

grant execute on function public.create_food_drop_with_stock(uuid, uuid, text, numeric, numeric, int, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.update_food_drop_with_stock(uuid, text, numeric, int) to authenticated;
grant execute on function public.cancel_food_drop_with_stock(uuid) to authenticated;
