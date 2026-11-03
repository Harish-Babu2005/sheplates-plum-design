-- 20261102000700_vendor_terms_and_conditions.sql
-- ShePlates Vendor Terms & Conditions (Version 1.0) Integration

-- 1. Add terms columns to public.vendors
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS terms_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_version text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_document_reference text;

-- 2. Create public.vendor_terms_acceptances table for historical audit tracking
CREATE TABLE IF NOT EXISTS public.vendor_terms_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  terms_version text NOT NULL DEFAULT '1.0',
  terms_accepted boolean NOT NULL DEFAULT true,
  terms_accepted_at timestamptz NOT NULL DEFAULT now(),
  terms_document_reference text NOT NULL DEFAULT '/docs/sheplates-vendor-terms-v1.0.pdf',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_terms_acceptances_vendor ON public.vendor_terms_acceptances(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_terms_acceptances_version ON public.vendor_terms_acceptances(terms_version);

-- 3. Enable RLS on vendor_terms_acceptances
ALTER TABLE public.vendor_terms_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_terms_acceptances_owner_select ON public.vendor_terms_acceptances;
CREATE POLICY vendor_terms_acceptances_owner_select ON public.vendor_terms_acceptances
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.vendors v
        WHERE v.id = vendor_terms_acceptances.vendor_id AND v.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS vendor_terms_acceptances_owner_insert ON public.vendor_terms_acceptances;
CREATE POLICY vendor_terms_acceptances_owner_insert ON public.vendor_terms_acceptances
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.vendors v
        WHERE v.id = vendor_terms_acceptances.vendor_id AND v.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS vendor_terms_acceptances_staff_select ON public.vendor_terms_acceptances;
CREATE POLICY vendor_terms_acceptances_staff_select ON public.vendor_terms_acceptances
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('operations', 'admin')
    )
  );

-- 4. Enforce terms acceptance on subscription vendor submission
CREATE OR REPLACE FUNCTION public.enforce_vendor_terms_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.vendor_kind = 'subscription' THEN
    -- If a vendor application is submitted or set to verified
    IF NEW.verification_status IN ('submitted', 'under_review', 'verified') THEN
      IF NEW.terms_accepted IS NOT TRUE THEN
        RAISE EXCEPTION 'Vendor Terms & Conditions must be accepted before submitting onboarding.';
      END IF;

      -- Enforce trusted database timestamp
      IF NEW.terms_accepted_at IS NULL THEN
        NEW.terms_accepted_at := now();
      END IF;

      IF NEW.terms_version IS NULL OR trim(NEW.terms_version) = '' THEN
        NEW.terms_version := '1.0';
      END IF;

      IF NEW.terms_document_reference IS NULL OR trim(NEW.terms_document_reference) = '' THEN
        NEW.terms_document_reference := '/docs/sheplates-vendor-terms-v1.0.pdf';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_vendor_terms_acceptance ON public.vendors;
CREATE TRIGGER trg_enforce_vendor_terms_acceptance
  BEFORE INSERT OR UPDATE ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_vendor_terms_acceptance();

-- 5. Automatically log acceptance into vendor_terms_acceptances history
CREATE OR REPLACE FUNCTION public.log_vendor_terms_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.terms_accepted IS TRUE AND (
    TG_OP = 'INSERT'
    OR OLD.terms_accepted IS NOT TRUE
    OR OLD.terms_version IS DISTINCT FROM NEW.terms_version
  ) THEN
    INSERT INTO public.vendor_terms_acceptances (
      vendor_id,
      user_id,
      terms_version,
      terms_accepted,
      terms_accepted_at,
      terms_document_reference
    ) VALUES (
      NEW.id,
      NEW.owner_id,
      COALESCE(NEW.terms_version, '1.0'),
      TRUE,
      COALESCE(NEW.terms_accepted_at, now()),
      COALESCE(NEW.terms_document_reference, '/docs/sheplates-vendor-terms-v1.0.pdf')
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_vendor_terms_acceptance ON public.vendors;
CREATE TRIGGER trg_log_vendor_terms_acceptance
  AFTER INSERT OR UPDATE ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.log_vendor_terms_acceptance();

-- 6. RPC function for re-acceptance of updated terms
CREATE OR REPLACE FUNCTION public.record_vendor_terms_acceptance(
  p_vendor_id uuid,
  p_terms_version text,
  p_document_reference text DEFAULT '/docs/sheplates-vendor-terms-v1.0.pdf'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vendor public.vendors;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_vendor FROM public.vendors WHERE id = p_vendor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor not found';
  END IF;

  IF v_vendor.owner_id != auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('operations', 'admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized to accept terms for this vendor';
  END IF;

  UPDATE public.vendors
  SET terms_accepted = true,
      terms_version = p_terms_version,
      terms_accepted_at = v_now,
      terms_document_reference = p_document_reference,
      updated_at = v_now
  WHERE id = p_vendor_id;

  RETURN jsonb_build_object(
    'ok', true,
    'vendor_id', p_vendor_id,
    'terms_version', p_terms_version,
    'terms_accepted_at', v_now
  );
END;
$$;

