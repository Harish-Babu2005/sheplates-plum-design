-- A vendor can delete one of their own products from the catalogue.
--
-- Safe to re-run. A product that sits in a customer's basket cannot be deleted by the table alone (the basket row
-- points at it and the vendor is not allowed to touch other people's baskets), so this function removes the product
-- from baskets first and then deletes it. Food drops, schedules and quote rows that point at it are removed by the
-- database's own cascade rules; stories, posts and Food Shorts keep their content and simply lose the product link.
-- Orders already placed keep their own copy of the product name and price, so history is not changed.
--
-- Only the owner of the store (or Operations / Super Admin) may delete. Returns the number of baskets it was removed from.

create or replace function public.vendor_delete_menu_item(p_item_id uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_vendor uuid;
  v_baskets integer := 0;
begin
  select vendor_id into v_vendor from public.vendor_menu_items where id = p_item_id;
  if v_vendor is null then
    raise exception 'That product no longer exists.' using errcode = 'P0002';
  end if;
  if not (public.owns_vendor(v_vendor) or public.current_app_role() in ('operations', 'admin')) then
    raise exception 'You can only delete products from your own store.' using errcode = '42501';
  end if;

  if to_regclass('public.commerce_cart_items') is not null then
    delete from public.commerce_cart_items where menu_item_id = p_item_id;
    get diagnostics v_baskets = row_count;
  end if;

  delete from public.vendor_menu_items where id = p_item_id;
  return v_baskets;
end;
$$;

revoke all on function public.vendor_delete_menu_item(uuid) from public;
grant execute on function public.vendor_delete_menu_item(uuid) to authenticated;
