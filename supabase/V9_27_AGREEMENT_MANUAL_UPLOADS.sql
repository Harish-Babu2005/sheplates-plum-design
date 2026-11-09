-- V9_27: a vendor may sign the Partnership Agreement and Terms by hand: download, sign, scan or photograph, upload.
-- Operations reviews each upload and accepts or rejects it with a note. Safe to run more than once.
create table if not exists public.vendor_signature_uploads (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  document_id text not null check (document_id in ('partnership_agreement','terms_conditions')),
  document_version text not null,
  file_path text not null,
  file_name text not null,
  content_type text not null,
  file_size int not null,
  file_sha256 text not null,
  uploaded_by uuid not null,
  uploaded_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text
);
create index if not exists vendor_signature_uploads_vendor_idx on public.vendor_signature_uploads(vendor_id, document_id, uploaded_at desc);
alter table public.vendor_signature_uploads enable row level security;
drop policy if exists vendor_signature_uploads_read on public.vendor_signature_uploads;
create policy vendor_signature_uploads_read on public.vendor_signature_uploads for select using (
  exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('operations','admin')));
-- No insert/update policies: uploads and reviews are written only by the server, which checks who is allowed to do what.
