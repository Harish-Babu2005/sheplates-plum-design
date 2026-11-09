-- V9_25: home-food weekly menu. What a home chef cooks on each weekday, per meal, as separate veg and non-veg plans.
-- The plan PRICE stays on the catalogue product (vendor_menu_items) named e.g. "Veg lunch plan"; this table holds the DISHES per day.
-- Safe to run more than once.
create table if not exists public.home_menu_days (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  weekday text not null check (weekday in ('Mon','Tue','Wed','Thu','Fri','Sat','Sun')),
  meal text not null check (meal in ('breakfast','lunch','dinner')),
  diet text not null check (diet in ('veg','non_veg')),
  dishes text[] not null default '{}' check (cardinality(dishes) <= 12),
  is_open boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (vendor_id, weekday, meal, diet)
);
create index if not exists home_menu_days_vendor_idx on public.home_menu_days(vendor_id);
alter table public.home_menu_days enable row level security;

drop policy if exists home_menu_days_read on public.home_menu_days;
create policy home_menu_days_read on public.home_menu_days for select using (
  exists (select 1 from public.vendors v where v.id = vendor_id and (v.owner_id = auth.uid() or (v.verification_status = 'verified' and coalesce(v.marketplace_visible, true))))
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('operations','admin')));

drop policy if exists home_menu_days_write on public.home_menu_days;
create policy home_menu_days_write on public.home_menu_days for all using (
  exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('operations','admin'))
) with check (
  exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('operations','admin')));
