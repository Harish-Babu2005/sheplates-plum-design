-- Migration: 20261118000300_schedule_15_day_pause_rule.sql
-- Implements the 15-day pause window, automatic closure, history logging, and vendor isolation for paused/closed schedules.

-- 1. Extend product_schedules status check constraint to include 'closed' and drop legacy start_date update check
alter table public.product_schedules drop constraint if exists product_schedules_status_check;
alter table public.product_schedules add constraint product_schedules_status_check
  check (status in ('awaiting_payment','active','paused','completed','cancelled','closed'));
alter table public.product_schedules drop constraint if exists product_schedules_start_date_check;

-- 2. Add pause tracking, resume-by deadline, and closure columns
alter table public.product_schedules add column if not exists paused_at timestamptz;
alter table public.product_schedules add column if not exists resume_by timestamptz;
alter table public.product_schedules add column if not exists closed_at timestamptz;
alter table public.product_schedules add column if not exists closure_reason text;
alter table public.product_schedules add column if not exists pause_count integer not null default 0;

-- 3. Create schedule history trail table
create table if not exists public.product_schedule_history (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.product_schedules(id) on delete cascade,
  action text not null check (action in ('pause','resume','auto_close','admin_close','admin_reopen','reminder_sent')),
  previous_status text not null,
  new_status text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_email text,
  actor_role text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists product_schedule_history_schedule_idx
  on public.product_schedule_history(schedule_id, created_at desc);

-- 4. Enable Row-Level Security on history table
alter table public.product_schedule_history enable row level security;

drop policy if exists schedule_history_read on public.product_schedule_history;
create policy schedule_history_read on public.product_schedule_history for select using (
  public.current_app_role() in ('admin', 'operations') or
  exists (
    select 1 from public.product_schedules s
    where s.id = schedule_id and s.customer_id = auth.uid()
  )
);

drop policy if exists schedule_history_service_all on public.product_schedule_history;
create policy schedule_history_service_all on public.product_schedule_history
  for all using (auth.role() = 'service_role');
