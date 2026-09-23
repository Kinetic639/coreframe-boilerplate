-- IC-5: zero live rows confirmed before this change (safe). Matches the
-- "no negative projection, never clamp" invariant -- enforced at the DB
-- level, not merely by application discipline.
ALTER TABLE public.repair_order_line_locations
  ADD CONSTRAINT repair_order_line_locations_quantity_nonnegative
  CHECK (quantity >= 0);
