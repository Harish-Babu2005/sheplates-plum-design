-- V9_30_GUEST_VENDOR_STORE_ACCESS.sql
-- Guest Vendor Store Access through QR Code
-- Allows anonymous (guest) visitors to browse verified, active, marketplace-visible vendors
-- and their active products without exposing private vendor or customer data.

-- 1. Grant table select permissions to anon (guest)
grant select on public.vendors to anon;
grant select on public.vendor_menu_items to anon;
grant select on public.vendor_item_markups to anon;
grant select on public.food_drops to anon;
grant select on public.vendor_plans to anon;

-- 2. Ensure RLS on vendors permits anon to read ONLY verified, active, marketplace_visible vendors
drop policy if exists vendors_guest_public_read on public.vendors;
create policy vendors_guest_public_read on public.vendors for select to anon using (
  (vendor_kind = 'subscription' and verification_status = 'verified' and operational_status = 'active' and marketplace_visible = true)
  or
  (vendor_kind = 'p0_connect' and verification_status = 'verified' and operational_status = 'active' and connect_enabled = true)
);

-- 3. RLS on vendor_menu_items: anon can read ONLY active items from verified, active, marketplace_visible subscription vendors
drop policy if exists menu_items_guest_public_read on public.vendor_menu_items;
create policy menu_items_guest_public_read on public.vendor_menu_items for select to anon using (
  active = true and exists (
    select 1 from public.vendors v
    where v.id = vendor_id
      and v.vendor_kind = 'subscription'
      and v.verification_status = 'verified'
      and v.operational_status = 'active'
      and v.marketplace_visible = true
  )
);

-- 4. RLS on vendor_item_markups: anon can read markup percent to calculate final selling prices
drop policy if exists markups_guest_public_read on public.vendor_item_markups;
create policy markups_guest_public_read on public.vendor_item_markups for select to anon using (
  exists (
    select 1 from public.vendor_menu_items i
    join public.vendors v on v.id = i.vendor_id
    where i.id = menu_item_id
      and i.active = true
      and v.vendor_kind = 'subscription'
      and v.verification_status = 'verified'
      and v.operational_status = 'active'
      and v.marketplace_visible = true
  )
);

-- 5. RLS on food_drops: anon can read active/live/scheduled drops from verified vendors
drop policy if exists food_drops_guest_public_read on public.food_drops;
create policy food_drops_guest_public_read on public.food_drops for select to anon using (
  status in ('active', 'live', 'scheduled') and exists (
    select 1 from public.vendors v
    where v.id = vendor_id
      and v.vendor_kind = 'subscription'
      and v.verification_status = 'verified'
      and v.operational_status = 'active'
      and v.marketplace_visible = true
  )
);

-- 6. RLS on vendor_plans: anon can read plan details
drop policy if exists plans_guest_public_read on public.vendor_plans;
create policy plans_guest_public_read on public.vendor_plans for select to anon using (true);

-- 7. Grant execute on marketplace_menu_nearby to anon as well
grant execute on function public.marketplace_menu_nearby(double precision, double precision) to anon, authenticated;

-- 8. Dedicated Security Definer RPC for guest store access:
-- Strictly returns public-safe vendor profile and active menu items with calculated customer prices.
-- Sensitive fields (owner_id, owner_email, phone, banking, internal audit) are never exposed.
create or replace function public.get_guest_vendor_store(p_vendor_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare
  v_vendor record;
  v_items jsonb;
  v_drops jsonb;
begin
  select id, name, category, description, logo_url, banner_url, locality, address,
         latitude, longitude, service_radius_km, delivery_enabled, pickup_enabled,
         store_open_today, verification_status, operational_status, owner_name, owner_role,
         fssai_number, expiry_date, plan_id, gst_mode, delivery_fee_override
  into v_vendor
  from public.vendors
  where id = p_vendor_id
    and vendor_kind = 'subscription'
    and verification_status = 'verified'
    and operational_status = 'active'
    and marketplace_visible = true;

  if not found then
    return null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'vendor_id', i.vendor_id,
    'name', i.name,
    'category', i.category,
    'description', i.description,
    'unit', i.unit,
    'vendor_base_price', i.vendor_base_price,
    'customer_price', round(i.vendor_base_price * (1 + coalesce(m.markup_percent, 0) / 100), 2),
    'markup_percent', coalesce(m.markup_percent, 0),
    'stock_quantity', i.stock_quantity,
    'quantity_step', i.quantity_step,
    'image_url', i.image_url,
    'calories_per_unit', i.calories_per_unit,
    'protein_g', i.protein_g,
    'carbs_g', i.carbs_g,
    'fat_g', i.fat_g,
    'fibre_g', i.fibre_g,
    'dietary_tags', i.dietary_tags,
    'pack_amount', i.pack_amount,
    'pack_measure', i.pack_measure,
    'active', i.active
  )), '[]'::jsonb)
  into v_items
  from public.vendor_menu_items i
  left join public.vendor_item_markups m on m.menu_item_id = i.id
  where i.vendor_id = p_vendor_id and i.active = true;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id,
    'vendor_id', d.vendor_id,
    'product_id', d.product_id,
    'title', d.title,
    'original_price', d.original_price,
    'drop_price', d.drop_price,
    'total_quantity', d.total_quantity,
    'remaining_quantity', d.remaining_quantity,
    'starts_at', d.starts_at,
    'ends_at', d.ends_at,
    'status', d.status
  )), '[]'::jsonb)
  into v_drops
  from public.food_drops d
  where d.vendor_id = p_vendor_id and d.status in ('active', 'live', 'scheduled');

  return jsonb_build_object(
    'vendor', to_jsonb(v_vendor),
    'items', v_items,
    'food_drops', v_drops
  );
end;
$$;

grant execute on function public.get_guest_vendor_store(uuid) to anon, authenticated;
