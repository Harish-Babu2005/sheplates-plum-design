-- Sheplates: ALL pending database updates in one script (Nov 2026).
-- Paste into Supabase > SQL Editor > New query > Run. It runs as ONE transaction: if anything fails, nothing is changed, and you can
-- run it again after fixing the cause. It is safe to run more than once.
--
-- Contents, in order: V8_1 taste match tables, V4_2 vendor payouts, V9_16 vendor terms trigger, V9_19 vendor delete product,
-- V9_20 vendor compliance documents, V9_13 Food Drop cart checkout, V9_21 Food Drop window 12-6 PM, V9_22 commercial terms,
-- V9_23 email outbox (Amazon SES), V9_24 e-signatures, V9_25 + V9_26 home-food weekly menu with day prices.
-- Needs the earlier V9_12 (Food Drops) to have been applied; the check below stops with a clear message if it was not.

begin;

do $$ begin
  if to_regclass('public.food_drops') is null then
    raise exception 'Run V9_12_ALL_PENDING_MIGRATIONS.sql first (the Food Drops tables are missing), then run this script again.';
  end if;
end $$;

-- ==================== V8_1_TASTE_MATCH.sql ====================
-- V8.1 — Taste Match Engine.
--
-- Adds the three tables the personalization layer needs:
--   taste_profiles       one row per customer, a weighted preference vector
--                        (dimension -> 0..1) stored as jsonb rather than a
--                        row-per-dimension design, since the dimension set
--                        (Spicy, Chicken, South Indian, ...) is small,
--                        largely fixed, and always read/written as a whole.
--   food_item_attributes one row per product, the same kind of weighted
--                        vector describing the dish itself. Populated by AI
--                        inference (cached here so a product is only ever
--                        classified once) or set directly by a vendor.
--   taste_feedback       an append-only signal log (view/save/order/
--                        more_like_this/less_like_this/...) — the taste
--                        profile's weights are derived from this log client
--                        side (see lib/taste-match.ts) rather than computed
--                        in the database, so the scoring model stays easy to
--                        read, test and explain ("why this matches").
--
-- Reuses public.profiles / public.vendors / public.vendor_menu_items and the
-- existing public.current_app_role() RLS helper — no new user/vendor/product
-- tables. Additive only.

create table if not exists public.taste_profiles (
  customer_id uuid primary key references public.profiles(id) on delete cascade,
  weights jsonb not null default '{}'::jsonb,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_item_attributes (
  product_id uuid primary key references public.vendor_menu_items(id) on delete cascade,
  attributes jsonb not null default '{}'::jsonb,
  source text not null default 'inferred' check (source in ('inferred','vendor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.taste_feedback (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid references public.vendor_menu_items(id) on delete set null,
  signal text not null check (signal in ('view','save','like','order','repeat_order','follow_vendor','more_like_this','less_like_this','skip')),
  created_at timestamptz not null default now()
);
create index if not exists taste_feedback_customer_idx on public.taste_feedback(customer_id, created_at desc);
create index if not exists food_item_attributes_updated_idx on public.food_item_attributes(updated_at);

alter table public.taste_profiles enable row level security;
alter table public.food_item_attributes enable row level security;
alter table public.taste_feedback enable row level security;

-- A customer manages only their own taste profile; operations/admin can read
-- any of them for support and the future analytics dashboard.
drop policy if exists taste_profiles_owner_all on public.taste_profiles;
create policy taste_profiles_owner_all on public.taste_profiles for all
  using (customer_id = auth.uid() or public.current_app_role() in ('operations','admin'))
  with check (customer_id = auth.uid());

-- Attributes are read by anyone (they're just product metadata, same
-- visibility as the product itself) and written by the owning vendor, an
-- operations/admin account, or the AI-inference API route (which runs on the
-- service-role key and bypasses RLS entirely, so no policy is needed for it).
drop policy if exists food_item_attributes_read on public.food_item_attributes;
create policy food_item_attributes_read on public.food_item_attributes for select
  using (true);
drop policy if exists food_item_attributes_vendor_insert on public.food_item_attributes;
create policy food_item_attributes_vendor_insert on public.food_item_attributes for insert
  with check (
    public.current_app_role() in ('operations','admin')
    or exists (select 1 from public.vendor_menu_items i join public.vendors v on v.id=i.vendor_id where i.id=product_id and v.owner_id=auth.uid())
  );
drop policy if exists food_item_attributes_vendor_update on public.food_item_attributes;
create policy food_item_attributes_vendor_update on public.food_item_attributes for update
  using (
    public.current_app_role() in ('operations','admin')
    or exists (select 1 from public.vendor_menu_items i join public.vendors v on v.id=i.vendor_id where i.id=product_id and v.owner_id=auth.uid())
  );

-- Feedback is an append-only log a customer writes for themself; nobody
-- (including the customer) can edit or delete a past signal.
drop policy if exists taste_feedback_insert on public.taste_feedback;
create policy taste_feedback_insert on public.taste_feedback for insert
  with check (customer_id = auth.uid());
drop policy if exists taste_feedback_read on public.taste_feedback;
create policy taste_feedback_read on public.taste_feedback for select
  using (customer_id = auth.uid() or public.current_app_role() in ('operations','admin'));

-- ==================== V4_2_VENDOR_PAYOUTS.sql ====================
-- ShePlates V4.2 — durable storage for the Vendor payments / Settlements ledger
-- introduced in the app's "Pay now" flow and the Operations/Super Admin
-- "Vendor payments" screens. Run after schema.sql + V3_UPGRADE.sql + V4_UPGRADE.sql.
--
-- The shipped app keeps this ledger in browser local state (see `transactions` in
-- components/sheplates-v3.tsx) so the full payment → payout flow is testable without
-- any external service. This migration is the forward path for teams wiring that
-- ledger to Supabase for real, multi-device, durable storage — it is not required
-- for local/demo use.

do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where t.typname='payout_status' and n.nspname='public') then
    create type public.payout_status as enum ('scheduled', 'paid', 'reversed');
  end if;
end $$;

create table if not exists public.vendor_payouts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  vendor_id uuid not null references public.vendors(id),
  payment_id uuid references public.payments(id),
  customer_id uuid not null references public.profiles(id),
  method text not null default 'upi',
  gross_amount numeric(12,2) not null check (gross_amount >= 0),
  commission_percent numeric(5,2) not null default 8,
  commission_amount numeric(12,2) not null check (commission_amount >= 0),
  vendor_payout_amount numeric(12,2) not null check (vendor_payout_amount >= 0),
  collected_at timestamptz not null default now(),
  scheduled_payout_date date not null,
  payout_status public.payout_status not null default 'scheduled',
  paid_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists vendor_payouts_vendor_idx on public.vendor_payouts(vendor_id, payout_status);
create index if not exists vendor_payouts_order_idx on public.vendor_payouts(order_id);

alter table public.vendor_payouts enable row level security;

-- Vendors read only their own payouts.
drop policy if exists vendor_payouts_select_own_vendor on public.vendor_payouts;
create policy vendor_payouts_select_own_vendor on public.vendor_payouts
  for select using (
    vendor_id in (select vendor_id from public.profiles where id = auth.uid())
  );

-- Customers may read the payout row tied to their own order (so "Pay now" can show its own receipt).
drop policy if exists vendor_payouts_select_own_customer on public.vendor_payouts;
create policy vendor_payouts_select_own_customer on public.vendor_payouts
  for select using (customer_id = auth.uid());

-- Operations and Super Admin see and manage every payout.
drop policy if exists vendor_payouts_all_staff on public.vendor_payouts;
create policy vendor_payouts_all_staff on public.vendor_payouts
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('operations', 'admin'))
  );

comment on table public.vendor_payouts is
  'Durable version of the in-app Vendor payments / Settlements ledger. One row per order payment collected from a customer, tracking the platform commission, the vendor''s net payout and when it is scheduled/paid. Populate from the payment-capture webhook, not directly from client code.';

-- ==================== V9_16_VENDOR_TERMS_TRIGGER_SCOPE.sql ====================
-- Stop the vendor-terms trigger from blocking every update on a vendor that has not accepted the terms.
--
-- enforce_vendor_terms_acceptance() raised "Vendor Terms & Conditions must be accepted ..." on ANY insert or update
-- of a subscription vendor whose row has verification_status submitted / under_review / verified and
-- terms_accepted not true. That is right for a new application and for approving a vendor, but it also blocked
-- unrelated updates on the 37 existing vendors that have not accepted yet:
--   * Operations "Save radius"            (updates service_radius_km only)
--   * a vendor opening or closing the shop
--   * anything else that touches the row
-- and it made onboarding fail (the form never sent terms_accepted).
--
-- The rule now applies when it matters: when a vendor row is created, or when its verification status CHANGES to
-- submitted / under_review / verified. A vendor still cannot be submitted or approved without accepting the terms.
-- When terms_accepted is true the trusted timestamp, version and document reference are filled in, as before.
--
-- Additive and safe to re-run. The ADD COLUMN lines are no-ops where the columns already exist (the live project).
-- Existing rows are not changed.

alter table public.vendors add column if not exists terms_accepted boolean not null default false;
alter table public.vendors add column if not exists terms_accepted_at timestamptz;
alter table public.vendors add column if not exists terms_version text;
alter table public.vendors add column if not exists terms_document_reference text;

create or replace function public.enforce_vendor_terms_acceptance() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.vendor_kind = 'subscription' then
    if new.terms_accepted is true then
      if new.terms_accepted_at is null then new.terms_accepted_at := now(); end if;
      if new.terms_version is null or trim(new.terms_version) = '' then new.terms_version := '1.0'; end if;
      if new.terms_document_reference is null or trim(new.terms_document_reference) = '' then
        new.terms_document_reference := '/docs/sheplates-vendor-terms-v1.0.pdf';
      end if;
    end if;

    if (tg_op = 'INSERT' or new.verification_status is distinct from old.verification_status)
       and new.verification_status in ('submitted', 'under_review', 'verified')
       and new.terms_accepted is not true then
      raise exception 'Vendor Terms & Conditions must be accepted before submitting onboarding.';
    end if;
  end if;
  return new;
end;
$$;

-- ==================== V9_19_VENDOR_DELETE_PRODUCT.sql ====================
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

-- ==================== V9_20_VENDOR_COMPLIANCE_DOCUMENTS.sql ====================
-- Vendor compliance documents (PAN, government ID, address proof, bank details, business registration, product information).
--
-- Safe to re-run. Replaces the earlier 20261103000100_vendor_compliance_documents.sql, which also put PAN, bank account,
-- IFSC and business registration numbers on public.vendors. Customers can read verified vendors' rows, so those numbers must
-- not live there. They are kept with their document in public.vendor_documents instead, which only the vendor who owns it
-- and Operations / Super Admin can read (policy documents_vendor_ops_read), and the files sit in the private
-- vendor-certificates bucket.
--
-- 1. File details for every uploaded document.
alter table public.vendor_documents add column if not exists file_name text;
alter table public.vendor_documents add column if not exists file_size bigint;
alter table public.vendor_documents add column if not exists mime_type text default 'application/pdf';
alter table public.vendor_documents add column if not exists metadata jsonb default '{}'::jsonb;

create index if not exists idx_vendor_documents_vendor_type on public.vendor_documents (vendor_id, document_type);

comment on column public.vendor_documents.metadata is 'Details typed for the document, such as the ID type or the registration type.';

-- 2. Remove the four sensitive columns from the public vendor row, but only if nothing was ever stored in them.
--    If any row has a value, nothing is dropped and a warning says so: move those values into vendor_documents first.
do $$
declare
  v_used bigint := 0;
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'vendors'
             and column_name in ('pan_number', 'bank_account_number', 'bank_ifsc', 'business_registration_number')) then
    execute $q$
      select count(*) from public.vendors
      where (to_jsonb(vendors) ->> 'pan_number') is not null
         or (to_jsonb(vendors) ->> 'bank_account_number') is not null
         or (to_jsonb(vendors) ->> 'bank_ifsc') is not null
         or (to_jsonb(vendors) ->> 'business_registration_number') is not null
    $q$ into v_used;
    if v_used = 0 then
      alter table public.vendors drop column if exists pan_number;
      alter table public.vendors drop column if exists bank_account_number;
      alter table public.vendors drop column if exists bank_ifsc;
      alter table public.vendors drop column if exists business_registration_number;
      raise notice 'Removed the unused PAN / bank / registration columns from public.vendors.';
    else
      raise warning '% vendor row(s) hold PAN / bank / registration values in public.vendors, which customers can read. Move them into vendor_documents, then run this file again.', v_used;
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';

-- ==================== V9_13_FOOD_DROP_CART_CHECKOUT.sql ====================
-- Food Drops can be kept in the normal customer cart and converted into
-- vendor-specific orders at checkout. Apply after V9_12 Food Drops.

alter table public.commerce_cart_items
  add column if not exists food_drop_id uuid
  references public.food_drops(id) on delete cascade;

create index if not exists commerce_cart_items_food_drop_idx
  on public.commerce_cart_items(food_drop_id)
  where food_drop_id is not null;

create or replace function public.claim_food_drops(p_drop_ids uuid[], p_quantities int[])
returns setof public.food_drop_claims
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := coalesce(array_length(p_drop_ids, 1), 0);
  v_index int;
  v_drop public.food_drops;
  v_claim public.food_drop_claims;
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '28000';
  end if;
  if v_count <> coalesce(array_length(p_quantities, 1), 0) then
    raise exception 'Drop IDs and quantities must have the same length' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_quantities) as q(quantity) where q.quantity is null or q.quantity <= 0) then
    raise exception 'Quantity must be positive' using errcode = '22023';
  end if;

  for v_index in 1..v_count loop
    v_drop := null;
    update public.food_drops
      set remaining_quantity = remaining_quantity - p_quantities[v_index], updated_at = now()
      where id = p_drop_ids[v_index]
        and status = 'active'
        and clock_timestamp() >= starts_at
        and clock_timestamp() < ends_at
        and remaining_quantity >= p_quantities[v_index]
      returning * into v_drop;

    if v_drop.id is null then
      raise exception 'Food Drops are no longer available' using errcode = 'P0001';
    end if;

    insert into public.food_drop_claims (drop_id, customer_id, quantity, unit_price, total_price)
    values (p_drop_ids[v_index], auth.uid(), p_quantities[v_index], v_drop.drop_price, v_drop.drop_price * p_quantities[v_index])
    returning * into v_claim;
    return next v_claim;
  end loop;
  return;
end;
$$;

revoke all on function public.claim_food_drops(uuid[], int[]) from public, anon;
grant execute on function public.claim_food_drops(uuid[], int[]) to authenticated;

notify pgrst, 'reload schema';

-- ==================== V9_21_FOOD_DROP_WINDOW_12_TO_6.sql ====================
-- Food Drops now run from 12:00 PM to 6:00 PM IST (they used to run 8:00 PM to midnight).
--
-- Safe to re-run. This replaces only the two database functions that fix the window and guard the stock; it does not touch the
-- plan prices that V9_12 sets, and V9_12 should not be run again just for this. A new drop opens at 12 PM IST (or at once, if it is
-- created between 12 PM and 6 PM) and closes at 6 PM IST the same day. A drop created after 6 PM is created already ended, so the
-- vendor sees it as Ended and customers cannot buy it. The stock is still taken by one conditional UPDATE, so two customers can
-- never take the last unit.

create or replace function public.set_food_drop_daily_window()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_local_now timestamp without time zone := now() at time zone 'Asia/Kolkata';
  v_local_open timestamp without time zone := date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '12 hours';
  v_local_close timestamp without time zone := date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '18 hours';
begin
  if v_local_now >= v_local_open and v_local_now < v_local_close then
    new.starts_at := now();
  else
    new.starts_at := v_local_open at time zone 'Asia/Kolkata';
  end if;
  new.ends_at := v_local_close at time zone 'Asia/Kolkata';
  return new;
end;
$$;

drop trigger if exists food_drops_daily_window on public.food_drops;
create trigger food_drops_daily_window
before insert on public.food_drops
for each row execute function public.set_food_drop_daily_window();

create or replace function public.claim_food_drop(p_drop_id uuid, p_quantity int)
returns public.food_drop_claims
language plpgsql
security definer
set search_path = public
as $$
declare
  v_drop public.food_drops;
  v_claim public.food_drop_claims;
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '28000';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be positive' using errcode = '22023';
  end if;

  update public.food_drops
    set remaining_quantity = remaining_quantity - p_quantity, updated_at = now()
    where id = p_drop_id
      and status = 'active'
      and clock_timestamp() >= starts_at
      and clock_timestamp() < ends_at
      and remaining_quantity >= p_quantity
    returning * into v_drop;

  if v_drop.id is null then
    raise exception 'Food Drops are claimable from 12:00 PM to 6:00 PM IST, while stock lasts' using errcode = 'P0001';
  end if;

  insert into public.food_drop_claims (drop_id, customer_id, quantity, unit_price, total_price)
  values (p_drop_id, auth.uid(), p_quantity, v_drop.drop_price, v_drop.drop_price * p_quantity)
  returning * into v_claim;

  return v_claim;
end;
$$;

revoke all on function public.claim_food_drop(uuid, int) from public, anon;
grant execute on function public.claim_food_drop(uuid, int) to authenticated;

-- A drop that is live under the old 8 PM window is moved to the new 12 PM to 6 PM window of its day, so nothing created before
-- this update stays claimable until midnight (after 6 PM that means it ends now). Drops that already ended are left alone.
update public.food_drops
set starts_at = (date_trunc('day', starts_at at time zone 'Asia/Kolkata') + interval '12 hours') at time zone 'Asia/Kolkata',
    ends_at   = (date_trunc('day', starts_at at time zone 'Asia/Kolkata') + interval '18 hours') at time zone 'Asia/Kolkata',
    updated_at = now()
where status = 'active'
  and ends_at > now()
  and (starts_at at time zone 'Asia/Kolkata')::time >= time '18:00';

notify pgrst, 'reload schema';

-- ==================== V9_22_COMMERCIAL_TERMS.sql ====================
-- Commercial terms Operations set per vendor, and the bill breakdown stored on every order.
--
-- Safe to re-run. Additive only: nothing existing is changed or removed.
--   vendors.gst_mode              none = no GST charged (Bill of Supply), vendor = vendor issues a Tax Invoice,
--                                 platform = Sheplates pays the GST under Section 9(5). Empty = default for the vendor's category.
--   vendors.delivery_fee_override a flat delivery fee for this vendor instead of the distance slabs (never below Rs 20). Empty = slabs.
--   vendor_commercial_terms       the commission % for this vendor. Kept apart from the vendor row because customers can read
--                                 vendor rows, and commission is between Sheplates and the vendor. Empty = default for the category.
--   orders.*                      subtotal, GST, delivery distance, commission and the invoice type of each order.
-- Only Operations and Super Admin can change these, through /api/vendor/commercial (never the vendor).

alter table public.vendors add column if not exists gst_mode text check (gst_mode in ('none', 'vendor', 'platform'));
alter table public.vendors add column if not exists delivery_fee_override numeric(8,2) check (delivery_fee_override is null or delivery_fee_override >= 20);

create table if not exists public.vendor_commercial_terms (
  vendor_id uuid primary key references public.vendors(id) on delete cascade,
  commission_percent numeric(5,2) check (commission_percent is null or (commission_percent >= 0 and commission_percent <= 100)),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
alter table public.vendor_commercial_terms enable row level security;
drop policy if exists vendor_commercial_terms_staff_all on public.vendor_commercial_terms;
create policy vendor_commercial_terms_staff_all on public.vendor_commercial_terms for all
  using (public.current_app_role() in ('operations', 'admin'))
  with check (public.current_app_role() in ('operations', 'admin'));
drop policy if exists vendor_commercial_terms_owner_read on public.vendor_commercial_terms;
create policy vendor_commercial_terms_owner_read on public.vendor_commercial_terms for select
  using (public.owns_vendor(vendor_id));

alter table public.orders add column if not exists subtotal numeric(12,2);
alter table public.orders add column if not exists gst_rate numeric(5,2);
alter table public.orders add column if not exists gst_amount numeric(12,2) default 0;
alter table public.orders add column if not exists discount_amount numeric(12,2) default 0;
alter table public.orders add column if not exists total_amount numeric(12,2);
alter table public.orders add column if not exists currency text default 'INR';
alter table public.orders add column if not exists delivery_distance numeric(8,2);
alter table public.orders add column if not exists commission_percent numeric(5,2);
alter table public.orders add column if not exists commission_amount numeric(12,2);
alter table public.orders add column if not exists vendor_payout numeric(12,2);
alter table public.orders add column if not exists gst_mode text check (gst_mode in ('none', 'vendor', 'platform'));
alter table public.orders add column if not exists invoice_type text check (invoice_type in ('bill_of_supply', 'tax_invoice', 'section_9_5'));

notify pgrst, 'reload schema';

-- ==================== V9_23_EMAIL_OUTBOX.sql ====================
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

-- ==================== V9_24_E_SIGNATURES.sql ====================
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

-- ==================== V9_25_HOME_WEEKLY_MENU.sql ====================
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

-- ==================== V9_26_WEEKLY_MENU_DAY_PRICE.sql ====================
-- V9_26: each weekday of a home-food plan has its own price (what the chef earns for that day, before Sheplates' markup).
-- Safe to run more than once. Days without a price keep selling at the plan's catalogue price.
alter table public.home_menu_days add column if not exists price numeric(10,2);
alter table public.home_menu_days drop constraint if exists home_menu_days_price_check;
alter table public.home_menu_days add constraint home_menu_days_price_check check (price is null or (price >= 10 and price <= 5000));

commit;
