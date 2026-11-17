-- V9_28: Update Crave vendor plan entitlements to include Food Drops
-- Per updated plan limits: Crave vendors now get Food Drops (2 per day).
begin;

update public.vendor_plans
set entitlements = jsonb_set(entitlements, '{food_drops}', 'true'::jsonb)
where code = 'crave';

commit;
