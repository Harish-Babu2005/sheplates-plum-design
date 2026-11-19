-- V9.21 Vendor Plan Audit Trail and Activity Logging
-- Records comprehensive before-and-after audit logs when an Admin or Super Admin changes a vendor's plan.
-- Enhances public.audit_trail() to return full actor and before/after metadata for the UI.

-- 1. Atomic stored procedure to update vendor plan and record audit log in a single transaction
create or replace function public.admin_update_vendor_plan(
  p_vendor_id uuid,
  p_plan_code text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_caller_id uuid := auth.uid();
  v_caller_role public.app_role;
  v_caller_name text;
  v_caller_email text;
  v_vendor record;
  v_old_plan record;
  v_new_plan record;
  v_clean_code text := lower(btrim(p_plan_code));
  v_before_data jsonb;
  v_after_data jsonb;
  v_limits record;
  v_audit_id bigint;
begin
  -- Check permission: caller must be operations or admin
  v_caller_role := public.current_app_role();
  if v_caller_id is null or v_caller_role not in ('operations', 'admin') then
    raise exception 'Only Operations or Super Admin can update vendor plans' using errcode = '42501';
  end if;

  select full_name into v_caller_name from public.profiles where id = v_caller_id;
  select email into v_caller_email from auth.users where id = v_caller_id;
  v_caller_name := coalesce(v_caller_name, 'Staff User');

  -- Lock vendor row
  select id, name, business_name, plan_id, operational_status, verification_status, billing_status, created_at
  into v_vendor
  from public.vendors
  where id = p_vendor_id
  for update;

  if v_vendor.id is null then
    raise exception 'Vendor not found' using errcode = 'P0002';
  end if;

  -- Get old plan details
  if v_vendor.plan_id is not null then
    select id, code, name, monthly_price into v_old_plan
    from public.vendor_plans
    where id = v_vendor.plan_id;
  end if;

  -- Get target plan details
  select id, code, name, monthly_price into v_new_plan
  from public.vendor_plans
  where lower(code) = v_clean_code and active = true;

  if v_new_plan.id is null then
    raise exception 'Target plan % not found or inactive', p_plan_code using errcode = 'P0002';
  end if;

  -- Check if plan is unchanged (prevent duplicate audit logs)
  if v_old_plan.id is not null and v_old_plan.id = v_new_plan.id then
    return jsonb_build_object(
      'success', true,
      'updated', false,
      'message', 'Vendor is already on this plan',
      'plan', v_new_plan.code
    );
  end if;

  -- Prepare before_data
  v_before_data := jsonb_build_object(
    'plan', coalesce(v_old_plan.code, 'taster'),
    'planName', coalesce(v_old_plan.name, 'Taster'),
    'monthlyPrice', coalesce(v_old_plan.monthly_price, 499),
    'formattedPrice', '₹' || coalesce(v_old_plan.monthly_price, 499)::text || '/month',
    'status', coalesce(v_vendor.operational_status::text, 'active'),
    'vendorName', coalesce(v_vendor.business_name, v_vendor.name, 'Vendor'),
    'vendorId', p_vendor_id::text
  );

  -- Prepare after_data
  v_after_data := jsonb_build_object(
    'plan', v_new_plan.code,
    'planName', v_new_plan.name,
    'monthlyPrice', v_new_plan.monthly_price,
    'formattedPrice', '₹' || v_new_plan.monthly_price::text || '/month',
    'status', coalesce(v_vendor.operational_status::text, 'active'),
    'vendorName', coalesce(v_vendor.business_name, v_vendor.name, 'Vendor'),
    'vendorId', p_vendor_id::text,
    'actorName', v_caller_name,
    'actorEmail', coalesce(v_caller_email, ''),
    'actorRole', case when v_caller_role = 'admin' then 'Super Admin' else 'Operations' end,
    'changedAt', now(),
    'reason', coalesce(p_reason, 'Vendor plan updated by admin')
  );

  -- 1. Update vendor plan_id
  update public.vendors
  set plan_id = v_new_plan.id,
      updated_at = now()
  where id = p_vendor_id;

  -- 2. Insert audit log entry
  insert into public.audit_logs(
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data
  )
  values (
    v_caller_id,
    v_caller_role,
    'Vendor Plan Updated',
    'vendor',
    p_vendor_id::text,
    v_before_data,
    v_after_data
  )
  returning id into v_audit_id;

  return jsonb_build_object(
    'success', true,
    'updated', true,
    'auditId', v_audit_id,
    'vendorId', p_vendor_id,
    'vendorName', coalesce(v_vendor.business_name, v_vendor.name, 'Vendor'),
    'previousPlan', coalesce(v_old_plan.name, 'Taster'),
    'newPlan', v_new_plan.name,
    'previousPrice', '₹' || coalesce(v_old_plan.monthly_price, 499)::text || '/month',
    'newPrice', '₹' || v_new_plan.monthly_price::text || '/month',
    'actorName', v_caller_name,
    'actorRole', case when v_caller_role = 'admin' then 'Super Admin' else 'Operations' end
  );
end;
$$;

-- 2. Enhance public.audit_trail() to return comprehensive before/after and actor data
drop function if exists public.audit_trail(int);

create or replace function public.audit_trail(p_limit int default 200)
returns table (
  id bigint,
  created_at timestamptz,
  actor_id uuid,
  actor_name text,
  actor_email text,
  actor_role text,
  action text,
  entity_type text,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  detail jsonb
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  perform public.assert_review_staff();
  return query
  select
    a.id,
    a.created_at,
    a.actor_id,
    coalesce(p.full_name, 'System')::text as actor_name,
    coalesce(u.email, a.after_data->>'actorEmail', '')::text as actor_email,
    case
      when a.actor_role::text = 'admin' then 'Super Admin'
      when a.actor_role::text = 'operations' then 'Operations'
      else coalesce(a.actor_role::text, 'System')
    end as actor_role,
    a.action,
    a.entity_type,
    a.entity_id,
    coalesce(a.before_data, '{}'::jsonb) as before_data,
    coalesce(a.after_data, '{}'::jsonb) as after_data,
    coalesce(a.after_data, '{}'::jsonb) as detail
  from public.audit_logs a
  left join public.profiles p on p.id = a.actor_id
  left join auth.users u on u.id = a.actor_id
  order by a.created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 500));
end;
$$;

revoke all on function public.admin_update_vendor_plan(uuid, text, text) from public;
revoke all on function public.audit_trail(int) from public;

grant execute on function public.admin_update_vendor_plan(uuid, text, text) to authenticated;
grant execute on function public.audit_trail(int) to authenticated;
