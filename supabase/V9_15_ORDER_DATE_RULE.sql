-- Let vendors accept and move on orders that are due today or earlier.
--
-- The base schema declared  check (scheduled_date > current_date)  on public.orders. Postgres re-checks a
-- CHECK constraint on every UPDATE of the row, so once an order's delivery day arrived, any status change
-- (Accept, Preparing, Delivered ...) failed with:
--   new row for relation "orders" violates check constraint "orders_scheduled_date_check"
-- The rule that matters is "a delivery date must be in the future WHEN it is set", so it moves to a trigger that
-- runs on INSERT and when scheduled_date itself is changed (for example a reschedule). Status changes no longer re-test it.
--
-- The 15-day planning window is enforced by the commerce API (checkout, schedule start, reschedule), not here,
-- because a recurring schedule or a monthly quotation legitimately creates orders for dates further out.
--
-- Additive and safe to re-run. Existing orders are not changed.

alter table public.orders drop constraint if exists orders_scheduled_date_check;

create or replace function public.enforce_order_date() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.scheduled_date is distinct from old.scheduled_date then
    if new.scheduled_date is null or new.scheduled_date <= current_date then
      raise exception 'The delivery date must be after today' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_enforce_order_date on public.orders;
create trigger orders_enforce_order_date before insert or update of scheduled_date on public.orders
  for each row execute function public.enforce_order_date();

-- OPTIONAL clean-up of test orders planned further than 15 days ahead. Review the SELECT first; nothing here runs on its own.
--   select id, order_number, scheduled_date, status from public.orders where scheduled_date > current_date + 15 order by scheduled_date;
