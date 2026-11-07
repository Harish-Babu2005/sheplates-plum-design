-- V9_23: email outbox (Amazon SES), suppression list and private attachment bucket.
-- Only the server (service role) touches these tables. Safe to run more than once.
create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  template text not null,
  data jsonb not null default '{}'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed','suppressed')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  message_id text,
  dedupe_key text unique,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists email_outbox_due_idx on public.email_outbox(next_attempt_at) where status = 'pending';
create index if not exists email_outbox_to_idx on public.email_outbox(to_email);
alter table public.email_outbox enable row level security;

create table if not exists public.email_suppressions (
  email text primary key,
  reason text not null check (reason in ('bounce','complaint','manual')),
  detail text,
  created_at timestamptz not null default now()
);
alter table public.email_suppressions enable row level security;
-- No policies on purpose: with row security on and no policy, browsers and signed-in users see nothing; the server key bypasses it.

insert into storage.buckets (id, name, public) values ('email-attachments', 'email-attachments', false) on conflict (id) do nothing;
