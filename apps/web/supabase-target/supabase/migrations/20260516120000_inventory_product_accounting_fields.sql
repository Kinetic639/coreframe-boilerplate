-- Optional Zoho-like accounting metadata for product catalog items.
-- These are lightweight integration-ready fields, not ledger postings.

ALTER TABLE public.inventory_products
  ADD COLUMN IF NOT EXISTS sales_account_code text null,
  ADD COLUMN IF NOT EXISTS purchase_account_code text null,
  ADD COLUMN IF NOT EXISTS tax_code text null;
