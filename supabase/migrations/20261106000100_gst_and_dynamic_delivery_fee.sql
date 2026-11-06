-- Migration: 20261106000100_gst_and_dynamic_delivery_fee.sql
-- Adds billing breakdown columns to orders table: subtotal, gst_rate, gst_amount, discount_amount, total_amount, currency, delivery_distance

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS subtotal numeric(12,2),
  ADD COLUMN IF NOT EXISTS gst_rate numeric(5,2) DEFAULT 5.00,
  ADD COLUMN IF NOT EXISTS gst_amount numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS delivery_distance numeric(8,2);

-- Backfill historical orders so billing fields are populated
UPDATE public.orders
SET
  subtotal = COALESCE(subtotal, customer_total - COALESCE(delivery_fee, 0) - COALESCE(tax_amount, 0)),
  gst_amount = COALESCE(gst_amount, tax_amount, 0),
  total_amount = COALESCE(total_amount, customer_total),
  currency = COALESCE(currency, 'INR')
WHERE total_amount IS NULL;

