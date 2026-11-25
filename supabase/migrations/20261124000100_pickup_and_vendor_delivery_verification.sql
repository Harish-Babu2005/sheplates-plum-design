-- Migration: 20261124000100_pickup_and_vendor_delivery_verification.sql
-- Verification codes for Pickup and Vendor Delivery orders.

-- 1. Add verification and override tracking columns to public.orders
alter table public.orders
  add column if not exists verification_code_hash text,
  add column if not exists verification_code_encrypted text,
  add column if not exists verification_code_expires_at timestamptz,
  add column if not exists verification_attempts integer not null default 0,
  add column if not exists verification_locked_at timestamptz,
  add column if not exists verified_at timestamptz,
  add column if not exists completed_via_override boolean not null default false,
  add column if not exists override_reason text,
  add column if not exists override_by uuid references public.profiles(id);

create index if not exists orders_verification_locked_idx
  on public.orders (verification_locked_at)
  where verification_locked_at is not null;

-- 2. Stored procedure: Verify verification code for Pickup or Vendor Delivery
create or replace function public.verify_order_verification_code(
  p_order_id uuid,
  p_code_hash text,
  p_actor_role text default 'vendor'
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  ord public.orders;
  v_next_status public.order_status;
begin
  select * into ord from public.orders where id = p_order_id for update;
  if ord.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  -- Verify actor authorization
  if p_actor_role = 'vendor' then
    if not public.owns_vendor(ord.vendor_id) and public.current_app_role() not in ('vendor', 'operations', 'admin') then
      return jsonb_build_object('ok', false, 'error', 'unauthorized');
    end if;
  end if;

  -- Completed, cancelled, or expired orders cannot be verified
  if ord.status in ('completed', 'delivered') then
    return jsonb_build_object('ok', false, 'error', 'already_completed');
  end if;
  if ord.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'error', 'cancelled');
  end if;

  -- Lockout check (5 wrong attempts)
  if ord.verification_attempts >= 5 or ord.verification_locked_at is not null then
    return jsonb_build_object('ok', false, 'error', 'attempt_limit', 'remaining_attempts', 0);
  end if;

  -- Code existence check
  if ord.verification_code_hash is null then
    return jsonb_build_object('ok', false, 'error', 'code_not_issued');
  end if;

  -- Expiry check
  if ord.verification_code_expires_at is not null and now() > ord.verification_code_expires_at then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  -- Match comparison
  if ord.verification_code_hash = p_code_hash then
    -- Determine target completion status based on fulfilment mode
    if ord.fulfilment_mode in ('self_pickup') then
      v_next_status := 'completed'::public.order_status;
    else
      v_next_status := 'delivered'::public.order_status;
    end if;

    update public.orders
    set
      status = v_next_status,
      verified_at = now(),
      updated_at = now()
    where id = ord.id;

    -- Notify customer of completion
    insert into public.notifications (
      recipient_id,
      kind,
      title,
      body,
      entity_type,
      entity_id
    ) values (
      ord.customer_id,
      'order',
      case when v_next_status = 'completed' then 'Order Picked Up' else 'Order Delivered' end,
      format('Order %s has been verified and marked %s.', ord.order_number, v_next_status),
      'order',
      ord.id
    );

    return jsonb_build_object(
      'ok', true,
      'status', v_next_status,
      'verified_at', now()
    );
  else
    -- Incorrect attempt: increment failed attempts
    update public.orders
    set
      verification_attempts = ord.verification_attempts + 1,
      verification_locked_at = case when ord.verification_attempts + 1 >= 5 then now() else null end,
      updated_at = now()
    where id = ord.id;

    if ord.verification_attempts + 1 >= 5 then
      -- Notify Operations of locked verification
      insert into public.notifications (
        recipient_id,
        kind,
        title,
        body,
        entity_type,
        entity_id
      )
      select
        p.id,
        'security_alert',
        'Order Verification Locked',
        format('Order %s locked after 5 failed code attempts. Requires Operations review.', ord.order_number),
        'order',
        ord.id
      from public.profiles p
      where p.role in ('operations', 'admin');

      return jsonb_build_object('ok', false, 'error', 'attempt_limit', 'remaining_attempts', 0);
    end if;

    return jsonb_build_object(
      'ok', false,
      'error', 'invalid_code',
      'remaining_attempts', 5 - (ord.verification_attempts + 1)
    );
  end if;
end;
$$;

-- 3. Stored procedure: Operations Override without a verification code
create or replace function public.operations_override_order_completion(
  p_order_id uuid,
  p_reason text
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  ord public.orders;
  v_next_status public.order_status;
  v_actor_id uuid;
begin
  -- Enforce Operations / Admin role
  if auth.uid() is null or public.current_app_role() not in ('operations', 'admin') then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if p_reason is null or length(trim(p_reason)) < 3 then
    return jsonb_build_object('ok', false, 'error', 'reason_required');
  end if;

  select * into ord from public.orders where id = p_order_id for update;
  if ord.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if ord.status in ('completed', 'delivered') then
    return jsonb_build_object('ok', false, 'error', 'already_completed');
  end if;
  if ord.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'error', 'cancelled');
  end if;

  v_actor_id := auth.uid();

  if ord.fulfilment_mode in ('self_pickup') then
    v_next_status := 'completed'::public.order_status;
  else
    v_next_status := 'delivered'::public.order_status;
  end if;

  update public.orders
  set
    status = v_next_status,
    verified_at = now(),
    completed_via_override = true,
    override_reason = trim(p_reason),
    override_by = v_actor_id,
    updated_at = now()
  where id = ord.id;

  -- Write to audit log
  insert into public.audit_log (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    v_actor_id,
    'operations_override_completion',
    'orders',
    ord.id,
    jsonb_build_object(
      'order_number', ord.order_number,
      'reason', trim(p_reason),
      'previous_status', ord.status,
      'new_status', v_next_status,
      'fulfilment_mode', ord.fulfilment_mode
    )
  );

  return jsonb_build_object(
    'ok', true,
    'status', v_next_status,
    'completed_via_override', true
  );
end;
$$;
