-- READ-ONLY check for three live errors. It only reads catalog tables; it changes nothing.
-- Run it once in Supabase -> SQL editor and send back the rows marked PROBLEM (or the whole result).
--
--   V3  vendor onboarding: POST /vendors returns 400 after the certificate uploads
--   O1  Operations "Approve": "Verification decision could not be saved"
--   O4  Operations "Save radius": "Vendor service radius could not be saved"

with wanted(col) as (
  values ('owner_id'), ('name'), ('category'), ('locality'), ('address'), ('latitude'), ('longitude'),
         ('service_radius_km'), ('delivery_enabled'), ('pickup_enabled'), ('store_open_today'),
         ('verification_status'), ('operational_status'), ('operating_hours'), ('radius_updated_at'),
         ('updated_at'), ('plan_id'), ('billing_status'), ('marketplace_visible'), ('connect_enabled'),
         ('vendor_kind'), ('p0_created_by'), ('p0_cancelled_at')
)
select 'V3/O4  vendors column' as "check",
       case when exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = 'vendors' and c.column_name = w.col)
            then 'ok' else 'PROBLEM: column is missing' end as result,
       w.col as detail
from wanted w

union all
select 'V3/O1  enum values', 'info', 'verification_status = ' || enum_range(null::public.verification_status)::text
union all
select 'V3/O1  enum values', 'info', 'operational_status = ' || enum_range(null::public.operational_status)::text

union all
select 'O1  approve function',
       case when pg_get_functiondef(p.oid) ~ '::(public\.)?verification_status' then 'ok' else 'PROBLEM: old version, assigns text to an enum column (re-run the P0 vendor lifecycle migration or V7_5)' end,
       'p0-aware: ' || (pg_get_functiondef(p.oid) ~ 'p0_connect')::text || ', args: ' || pg_get_function_arguments(p.oid)
from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'review_vendor_and_notify'
union all
select 'O1  approve function', 'PROBLEM: function does not exist', 'review_vendor_and_notify'
where not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'review_vendor_and_notify')

union all
select 'V3/O1/O4  trigger on vendors', 'info', t.tgname || ' -> ' || pg_get_triggerdef(t.oid)
from pg_trigger t where t.tgrelid = 'public.vendors'::regclass and not t.tgisinternal

union all
select 'V3/O4  check constraint on vendors', 'info', c.conname || ': ' || pg_get_constraintdef(c.oid)
from pg_constraint c where c.conrelid = 'public.vendors'::regclass and c.contype = 'c'

union all
select 'V3/O4  policy on vendors', 'info', p.policyname || ' [' || p.cmd || '] using: ' || coalesce(p.qual, '-') || ' | with check: ' || coalesce(p.with_check, '-')
from pg_policies p where p.schemaname = 'public' and p.tablename = 'vendors' and p.cmd in ('INSERT', 'UPDATE', 'ALL')

union all
select 'O4  radius column type', 'info', format_type(a.atttypid, a.atttypmod)
from pg_attribute a where a.attrelid = 'public.vendors'::regclass and a.attname = 'service_radius_km' and not a.attisdropped

union all
select 'V3  vendor-certificates bucket', case when exists (select 1 from storage.buckets b where b.id = 'vendor-certificates') then 'ok' else 'PROBLEM: bucket missing' end, 'storage'

order by 1, 2, 3;
