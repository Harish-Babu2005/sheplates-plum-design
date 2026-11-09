-- V9_26: each weekday of a home-food plan has its own price (what the chef earns for that day, before Sheplates' markup).
-- Safe to run more than once. Days without a price keep selling at the plan's catalogue price.
alter table public.home_menu_days add column if not exists price numeric(10,2);
alter table public.home_menu_days drop constraint if exists home_menu_days_price_check;
alter table public.home_menu_days add constraint home_menu_days_price_check check (price is null or (price >= 10 and price <= 5000));
