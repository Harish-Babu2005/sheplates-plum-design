-- Stop the vendor-terms trigger from blocking every update on a vendor that has not accepted the terms.
--
-- enforce_vendor_terms_acceptance() raised "Vendor Terms & Conditions must be accepted ..." on ANY insert or update
-- of a subscription vendor whose row has verification_status submitted / under_review / verified and
-- terms_accepted not true. That is right for a new application and for approving a vendor, but it also blocked
-- unrelated updates on the 37 existing vendors that have not accepted yet:
--   * Operations "Save radius"            (updates service_radius_km only)
--   * a vendor opening or closing the shop
--   * anything else that touches the row
-- and it made onboarding fail (the form never sent terms_accepted).
--
-- The rule now applies when it matters: when a vendor row is created, or when its verification status CHANGES to
-- submitted / under_review / verified. A vendor still cannot be submitted or approved without accepting the terms.
-- When terms_accepted is true the trusted timestamp, version and document reference are filled in, as before.
--
-- Additive and safe to re-run. The ADD COLUMN lines are no-ops where the columns already exist (the live project).
-- Existing rows are not changed.

alter table public.vendors add column if not exists terms_accepted boolean not null default false;
alter table public.vendors add column if not exists terms_accepted_at timestamptz;
alter table public.vendors add column if not exists terms_version text;
alter table public.vendors add column if not exists terms_document_reference text;

create or replace function public.enforce_vendor_terms_acceptance() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.vendor_kind = 'subscription' then
    if new.terms_accepted is true then
      if new.terms_accepted_at is null then new.terms_accepted_at := now(); end if;
      if new.terms_version is null or trim(new.terms_version) = '' then new.terms_version := '1.0'; end if;
      if new.terms_document_reference is null or trim(new.terms_document_reference) = '' then
        new.terms_document_reference := '/docs/sheplates-vendor-terms-v1.0.pdf';
      end if;
    end if;

    if (tg_op = 'INSERT' or new.verification_status is distinct from old.verification_status)
       and new.verification_status in ('submitted', 'under_review', 'verified')
       and new.terms_accepted is not true then
      raise exception 'Vendor Terms & Conditions must be accepted before submitting onboarding.';
    end if;
  end if;
  return new;
end;
$$;
