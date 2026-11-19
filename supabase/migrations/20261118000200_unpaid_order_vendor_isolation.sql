-- Migration: 20261118000200_unpaid_order_vendor_isolation.sql
-- Enforce vendor isolation from unpaid orders across Normal Orders, Schedules, RFQs, and Food Drops.

-- 1. Add new enum values to public.order_status
alter type public.order_status add value if not exists 'awaiting_payment';
alter type public.order_status add value if not exists 'payment_failed';
alter type public.order_status add value if not exists 'expired';

-- 2. Update default order status to 'awaiting_payment' instead of 'awarded'
alter table public.orders alter column status set default 'awaiting_payment'::public.order_status;

-- 3. Update accept_quote to assign 'awaiting_payment' status and notify vendor ONLY after payment
create or replace function public.accept_quote(p_quote uuid)
returns table (o_id uuid, o_number text, o_total numeric)
language plpgsql security definer set search_path = public as $$
declare q public.vendor_quotes; r public.customer_requirements; vend public.vendors; oid uuid; onum text; markup numeric; total numeric;
begin
  if auth.uid() is null or public.current_app_role() <> 'customer' then raise exception 'Sign in as the customer who posted this RFQ'; end if;
  select * into q from public.vendor_quotes where id = p_quote;
  if q.id is null then raise exception 'Quotation not found'; end if;
  select * into r from public.customer_requirements where id = q.requirement_id for update;   -- serialises double clicks
  if r.customer_id <> auth.uid() then raise exception 'This is not your RFQ'; end if;
  if r.status = 'awarded' then raise exception 'This RFQ already has a winner'; end if;
  select * into q from public.vendor_quotes where id = p_quote;                                 -- re-read after the lock
  if q.status <> 'submitted' then raise exception 'This quotation is not open for selection'; end if;
  if q.valid_until is not null and q.valid_until < now() then raise exception 'This quotation has expired'; end if;
  if r.delivery_date <= current_date then raise exception 'The delivery date has passed. Publish a new RFQ'; end if;
  select * into vend from public.vendors where id = q.vendor_id;

  markup := round(q.vendor_total * q.operations_markup_percent / 100, 2);
  total := round(q.vendor_total + markup + q.delivery_fee + q.tax_amount, 2);
  onum := 'RFQ-' || upper(to_hex((extract(epoch from clock_timestamp()) * 1000)::bigint)) || '-' || upper(substr(md5(random()::text), 1, 4));
  insert into public.orders(order_number, requirement_id, quote_id, customer_id, vendor_id, vendor_base_total, markup_total, tax_amount, delivery_fee, customer_total, fulfilment_mode, scheduled_date, scheduled_slot, status)
  values (onum, r.id, q.id, r.customer_id, q.vendor_id, q.vendor_total, markup, q.tax_amount, q.delivery_fee, total, r.fulfilment_mode, r.delivery_date, 'Vendor to confirm', 'awaiting_payment')
  returning id into oid;
  insert into public.order_items(order_id, product_name, quantity, unit, vendor_base_price, markup_percent, customer_price)
  select oid, ri.product_name, ri.quantity, ri.unit, qi.vendor_unit_price,
         coalesce(nullif(qi.operations_markup_percent, 0), q.operations_markup_percent),
         round(qi.vendor_unit_price * (1 + coalesce(nullif(qi.operations_markup_percent, 0), q.operations_markup_percent) / 100), 2)
  from public.vendor_quote_items qi join public.requirement_items ri on ri.id = qi.requirement_item_id
  where qi.quote_id = q.id and qi.available;
  insert into public.payments(order_id, customer_id, amount, status, provider) values (oid, r.customer_id, total, 'pending', 'checkout');

  update public.vendor_quotes set status = case when id = q.id then 'selected' else 'not_selected' end, updated_at = now() where requirement_id = r.id and status = 'submitted';
  update public.customer_requirements set status = 'awarded', awarded_quote_id = q.id, updated_at = now() where id = r.id;
  update public.rfq_vendor_invitations set status = case when vendor_id = q.vendor_id then 'awarded' else 'closed' end where requirement_id = r.id;

  -- Only notify customer to complete payment. Vendor is notified when payment is confirmed by server webhook.
  insert into public.notifications(recipient_id, kind, title, body, entity_type, entity_id)
  values (r.customer_id, 'payment', 'Complete payment', onum || ' is ready for payment.', 'order', oid::text);
  insert into public.notifications(recipient_id, kind, title, body, entity_type, entity_id)
  select v.owner_id, 'rfq', 'RFQ closed', '"' || r.title || '" was awarded to another vendor.', 'requirement', r.id::text
  from public.vendor_quotes lq join public.vendors v on v.id = lq.vendor_id where lq.requirement_id = r.id and lq.id <> q.id;
  return query select oid, onum, total;
end;
$$;

-- 4. RLS policies on public.orders to isolate vendors from unpaid orders:
drop policy if exists orders_party_read on public.orders;
create policy orders_party_read on public.orders for select using (
  customer_id = auth.uid()
  or public.current_app_role() in ('operations', 'admin')
  or (
    public.owns_vendor(vendor_id)
    and (
      exists (
        select 1 from public.payments p
        where p.order_id = orders.id and lower(p.status) in ('paid', 'captured', 'success')
      )
      or exists (
        select 1 from public.payments p
        where p.order_id = orders.id and p.provider = 'food_drop_pickup'
      )
    )
  )
);

-- 5. Guard vendor update: vendor cannot update orders that are unpaid unless it's a Food Drop pickup
drop policy if exists orders_vendor_ops_update on public.orders;
create policy orders_vendor_ops_update on public.orders for update using (
  public.current_app_role() in ('operations', 'admin')
  or (
    public.owns_vendor(vendor_id)
    and (
      exists (
        select 1 from public.payments p
        where p.order_id = orders.id and lower(p.status) in ('paid', 'captured', 'success')
      )
      or exists (
        select 1 from public.payments p
        where p.order_id = orders.id and p.provider = 'food_drop_pickup'
      )
    )
  )
);

-- 6. Server function to expire unpaid orders older than 30 minutes and release stock
create or replace function public.expire_unpaid_orders(p_timeout_minutes integer default 30)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  expired_count integer := 0;
  order_rec record;
begin
  for order_rec in
    select o.id, o.order_number
    from public.orders o
    join public.payments p on p.order_id = o.id
    where (o.status = 'awaiting_payment' or (o.status = 'awarded' and lower(p.status) = 'pending'))
      and p.provider <> 'food_drop_pickup'
      and o.created_at < now() - (p_timeout_minutes || ' minutes')::interval
  loop
    update public.orders
    set status = 'expired', updated_at = now()
    where id = order_rec.id;

    update public.payments
    set status = 'expired', updated_at = now()
    where order_id = order_rec.id and lower(status) = 'pending';

    -- Release food drop reserved units if any
    update public.food_drops fd
    set claimed_units = greatest(0, fd.claimed_units - oi.quantity),
        updated_at = now()
    from public.order_items oi
    where oi.order_id = order_rec.id
      and oi.food_drop_id is not null
      and fd.id = oi.food_drop_id;

    expired_count := expired_count + 1;
  end loop;

  return expired_count;
end;
$$;
revoke all on function public.expire_unpaid_orders(integer) from public, anon;
grant execute on function public.expire_unpaid_orders(integer) to authenticated, service_role;

