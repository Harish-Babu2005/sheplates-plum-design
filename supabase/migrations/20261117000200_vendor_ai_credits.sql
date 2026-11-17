-- Migration: 20261117000200_vendor_ai_credits.sql
-- Implements AI Credits System for SHE Plates vendors.
-- Vendors receive monthly plan credits and can purchase extra credit packs.
-- Plan included credits are used first, then purchased credits.
-- A persistent credit ledger tracks every grant, purchase, usage, and admin adjustment.

create table if not exists public.vendor_ai_credits (
  vendor_id uuid primary key references public.vendors(id) on delete cascade,
  plan_credits integer not null default 0 check (plan_credits >= 0),
  purchased_credits integer not null default 0 check (purchased_credits >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.vendor_ai_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  entry_type text not null check (entry_type in ('grant', 'purchase', 'usage', 'adjustment')),
  action text not null,
  credits_change integer not null,
  plan_credits_after integer not null default 0,
  purchased_credits_after integer not null default 0,
  balance_after integer not null default 0,
  notes text,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Indexes for efficient lookups and chronological ledger browsing
create index if not exists idx_vendor_ai_credits_vendor_id on public.vendor_ai_credits(vendor_id);
create index if not exists idx_vendor_ai_credit_ledger_vendor_time on public.vendor_ai_credit_ledger(vendor_id, created_at desc);

-- Enable Row Level Security
alter table public.vendor_ai_credits enable row level security;
alter table public.vendor_ai_credit_ledger enable row level security;

-- Policy: Vendors can read their own credit balance
drop policy if exists "Vendors can read own ai credits" on public.vendor_ai_credits;
create policy "Vendors can read own ai credits"
  on public.vendor_ai_credits
  for select
  using (
    vendor_id in (select vendor_id from public.profiles where id = auth.uid())
    or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'operations'))
  );

-- Policy: Operations and Super Admin can manage vendor ai credits
drop policy if exists "Admin and operations can manage ai credits" on public.vendor_ai_credits;
create policy "Admin and operations can manage ai credits"
  on public.vendor_ai_credits
  for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'operations')));

-- Policy: Vendors can read their own credit ledger
drop policy if exists "Vendors can read own credit ledger" on public.vendor_ai_credit_ledger;
create policy "Vendors can read own credit ledger"
  on public.vendor_ai_credit_ledger
  for select
  using (
    vendor_id in (select vendor_id from public.profiles where id = auth.uid())
    or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'operations'))
  );

-- Policy: Admin and Operations can manage credit ledger
drop policy if exists "Admin and operations can manage credit ledger" on public.vendor_ai_credit_ledger;
create policy "Admin and operations can manage credit ledger"
  on public.vendor_ai_credit_ledger
  for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'operations')));

-- Backfill initial credits for all existing vendors based on their plan
insert into public.vendor_ai_credits (vendor_id, plan_credits, purchased_credits, updated_at)
select
  v.id,
  case
    when lower(coalesce(vp.code, 'crave')) = 'crown' then 800
    when lower(coalesce(vp.code, 'crave')) = 'thrive' then 400
    when lower(coalesce(vp.code, 'crave')) = 'crave' then 200
    else 0
  end,
  0,
  now()
from public.vendors v
left join public.vendor_plans vp on v.plan_id = vp.id
on conflict (vendor_id) do nothing;

-- Create initial ledger records for backfilled vendors with credits > 0
insert into public.vendor_ai_credit_ledger (
  vendor_id,
  entry_type,
  action,
  credits_change,
  plan_credits_after,
  purchased_credits_after,
  balance_after,
  notes
)
select
  c.vendor_id,
  'grant',
  'initial_plan_grant',
  c.plan_credits,
  c.plan_credits,
  0,
  c.plan_credits,
  'Initial plan AI credits allocation'
from public.vendor_ai_credits c
where c.plan_credits > 0
  and not exists (
    select 1 from public.vendor_ai_credit_ledger l
    where l.vendor_id = c.vendor_id and l.action = 'initial_plan_grant'
  );
