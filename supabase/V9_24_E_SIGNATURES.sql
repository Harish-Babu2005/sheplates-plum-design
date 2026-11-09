-- V9_24: online signing of the Vendor Partnership Agreement and Terms & Conditions.
-- A signature is evidence, so rows are only written by the server and can never be updated or deleted by anyone through the app.
create table if not exists public.vendor_signatures (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  user_id uuid not null,
  document_id text not null check (document_id in ('partnership_agreement','terms_conditions')),
  document_version text not null,
  document_sha256 text not null,
  signer_name text not null,
  signer_role text not null,
  signer_email text not null,
  otp_verified boolean not null default false,
  consent_text text not null,
  ip_address text,
  user_agent text,
  signed_at timestamptz not null default now(),
  signed_pdf_path text not null,
  signature_png_path text,
  countersigned_name text not null,
  countersigned_title text,
  countersigned_at timestamptz not null default now(),
  unique (vendor_id, document_id, document_version)
);
create index if not exists vendor_signatures_vendor_idx on public.vendor_signatures(vendor_id);
alter table public.vendor_signatures enable row level security;
drop policy if exists vendor_signatures_owner_read on public.vendor_signatures;
create policy vendor_signatures_owner_read on public.vendor_signatures for select using (
  exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('operations','admin')));

create table if not exists public.signing_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  vendor_id uuid not null,
  code_hash text not null,
  expires_at timestamptz not null,
  tries int not null default 0,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists signing_codes_user_idx on public.signing_codes(user_id, created_at desc);
alter table public.signing_codes enable row level security;
-- no policies: only the server key can read or write codes

insert into storage.buckets (id, name, public) values ('signed-agreements', 'signed-agreements', false) on conflict (id) do nothing;
