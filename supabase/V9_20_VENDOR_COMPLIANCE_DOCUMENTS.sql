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
