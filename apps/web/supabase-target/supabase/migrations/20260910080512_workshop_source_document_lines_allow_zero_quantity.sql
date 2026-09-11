-- Migration: workshop_source_document_lines_allow_zero_quantity
-- Discovered via real Phase 3 RPC testing: workshop_source_document_lines.quantity
-- had CHECK (quantity > 0), NOT NULL. Real Matcher data legitimately contains
-- lines with no parseable quantity (wdd_matcher_lines.quantity is nullable).
-- Raw provenance storage must never reject/lose a real source line just
-- because its quantity is a data-quality unknown -- "never destructively
-- drop source data" (architecture doc). The RPC already coalesces a NULL
-- source quantity to 0 for storage here, while correctly refusing to create
-- a repair_order_line_source_links row (quantity_contribution still
-- requires > 0, unchanged) for such a line -- so raw provenance is preserved
-- even when the derived logical-line contribution cannot be.
ALTER TABLE public.workshop_source_document_lines DROP CONSTRAINT workshop_source_document_lines_quantity_check;
ALTER TABLE public.workshop_source_document_lines ADD CONSTRAINT workshop_source_document_lines_quantity_check
  CHECK (quantity >= 0);
