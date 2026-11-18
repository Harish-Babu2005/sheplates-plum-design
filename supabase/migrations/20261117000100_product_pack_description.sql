-- Migration: Add description to vendor_menu_items (Product pack contents)
-- Allows vendors to detail the pack contents (e.g. "Rice, dal, 2 poriyal with payasam")

ALTER TABLE public.vendor_menu_items
ADD COLUMN IF NOT EXISTS description text;

-- Add check constraint for max length of 200 characters if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_vendor_menu_items_description_len'
  ) THEN
    ALTER TABLE public.vendor_menu_items
    ADD CONSTRAINT chk_vendor_menu_items_description_len
    CHECK (description IS NULL OR char_length(description) <= 200);
  END IF;
END $$;

COMMENT ON COLUMN public.vendor_menu_items.description IS 'Optional pack description/contents (up to 200 plain text characters).';
