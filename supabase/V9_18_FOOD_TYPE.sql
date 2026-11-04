-- Veg / Non-veg / Egg marks on products.
--
-- Additive and safe to re-run. Nothing is guessed: food_type stays null until the vendor chooses it, and products with
-- no food type simply show no mark. Existing products are not changed.
--
-- Customers cannot read vendor_menu_items directly (they use the marketplace function), so the marks are read through
-- product_food_types(), which returns the type only for products the caller may already see: the vendor's own,
-- all of them for Operations and Super Admin, and for everyone else only live items of verified, visible vendors.

alter table public.vendor_menu_items add column if not exists food_type text check (food_type in ('veg', 'non_veg', 'egg'));

create or replace function public.product_food_types(p_ids uuid[])
returns table (id uuid, food_type text)
language sql stable security definer set search_path = public as $$
  select m.id, m.food_type
  from public.vendor_menu_items m
  join public.vendors v on v.id = m.vendor_id
  where m.id = any(p_ids)
    and (
      public.owns_vendor(m.vendor_id)
      or public.current_app_role() in ('operations', 'admin')
      or (m.active and v.verification_status = 'verified' and v.marketplace_visible)
    );
$$;

revoke all on function public.product_food_types(uuid[]) from public;
grant execute on function public.product_food_types(uuid[]) to anon, authenticated;
