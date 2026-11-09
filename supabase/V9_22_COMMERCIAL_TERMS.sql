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
