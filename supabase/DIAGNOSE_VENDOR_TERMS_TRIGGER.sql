-- READ-ONLY. Shows what the two extra triggers on public.vendors do (they are not in this repo), so the app can satisfy them.
-- Run in Supabase -> SQL editor and send back every row.

select 'function source' as "check", p.proname as name, pg_get_functiondef(p.oid) as detail
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('enforce_vendor_terms_acceptance', 'log_vendor_terms_acceptance')

union all
select 'vendors column', c.column_name,
       c.data_type || ' | nullable=' || c.is_nullable || ' | default=' || coalesce(c.column_default, '-')
from information_schema.columns c
where c.table_schema = 'public' and c.table_name = 'vendors'
  and (c.column_name ilike '%term%' or c.column_name ilike '%agree%' or c.column_name ilike '%accept%' or c.column_name ilike '%consent%')

union all
select 'other table with terms columns', c.table_name || '.' || c.column_name, c.data_type
from information_schema.columns c
where c.table_schema = 'public' and c.table_name <> 'vendors'
  and (c.column_name ilike '%terms%' or c.column_name ilike '%agreement%')

union all
select 'vendor rows (count)', 'vendors', count(*)::text
from public.vendors

order by 1, 2;
