CREATE OR REPLACE FUNCTION public.guard_third_party_delivery_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN

  -- Third-party orders cannot use Completed status
  IF NEW.fulfilment_mode = 'third_party_delivery'
     AND NEW.status = 'completed' THEN

    RAISE EXCEPTION
      'Third-party orders must use the delivered status after handover verification';

  END IF;

  -- Require verification ONLY for third-party delivery
  IF NEW.fulfilment_mode = 'third_party_delivery'
     AND NEW.status = 'delivered'
     AND NOT EXISTS (
       SELECT 1
       FROM public.third_party_delivery_requests r
       WHERE r.order_id = OLD.id
         AND r.status = 'delivered'
         AND r.delivered_at IS NOT NULL
     ) THEN

    RAISE EXCEPTION
      'Third-party delivery must be verified before an order is delivered';

  END IF;

  RETURN NEW;
END;
$$;