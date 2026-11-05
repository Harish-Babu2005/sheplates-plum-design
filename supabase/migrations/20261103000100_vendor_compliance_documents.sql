-- Migration: Vendor Compliance Documents Expansion
-- Adds support for 6 additional onboarding compliance documents in PDF format:
-- 1) PAN
-- 2) Government Identity Proof
-- 3) Address Proof
-- 4) Bank Details
-- 5) Business Details
-- 6) Product Information
-- in addition to Food Safety Certificate (FSSAI).

-- Add metadata columns to public.vendor_documents if not already present
ALTER TABLE public.vendor_documents
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS mime_type text DEFAULT 'application/pdf',
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Optional document summary columns on vendors table for quick operational queries
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS pan_number text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_ifsc text,
  ADD COLUMN IF NOT EXISTS business_registration_number text;

-- Add index on vendor_documents (vendor_id, document_type) for fast retrieval
CREATE INDEX IF NOT EXISTS idx_vendor_documents_vendor_type
  ON public.vendor_documents (vendor_id, document_type);

COMMENT ON COLUMN public.vendor_documents.mime_type IS 'MIME type of the uploaded document. Compliance documents require application/pdf.';
COMMENT ON COLUMN public.vendor_documents.metadata IS 'Structured metadata for document (e.g. id_type, bank_name, reg_type).';

