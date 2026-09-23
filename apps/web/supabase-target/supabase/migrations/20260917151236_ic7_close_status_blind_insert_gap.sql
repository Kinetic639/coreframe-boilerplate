-- IC-7 -- inventory_movement_headers/_lines INSERT policies were purely
-- permission-based, with ZERO awareness of the status column. Confirmed
-- live: an ordinary authenticated actor holding warehouse.inventory.
-- operate could raw-INSERT a fully fabricated status='posted' header
-- (fake document number, no real ledger entries) -- a known, disclosed
-- gap since IC-0 (2026-09-15). This also extends to inventory_movement_
-- lines: since the immutability trigger only fires on UPDATE/DELETE
-- (never INSERT), a raw client could INSERT a brand-new line under an
-- EXISTING, already-posted, genuine movement_id, appearing to add
-- quantity to a real document without ever tripping the immutability
-- guard. Closed with a RESTRICTIVE policy on each table's own INSERT
-- requiring the new row (or, for lines, its own parent header) to be in
-- 'draft' status -- matching the actual, only-ever-true shape of every
-- legitimate INSERT (every canonical RPC creates a movement as 'draft'
-- first; the transition to 'posted' happens exclusively via UPDATE
-- inside inventory_finalize_posting_internal, itself SECURITY DEFINER
-- and therefore unaffected by this ordinary-role-scoped RESTRICTIVE
-- policy). Existing PERMISSIVE INSERT policies (and their own permission
-- checks) are left completely untouched.
CREATE POLICY inventory_movement_headers_insert_draft_only
  ON public.inventory_movement_headers AS RESTRICTIVE FOR INSERT
  WITH CHECK (status = 'draft');

CREATE POLICY inventory_movement_lines_insert_draft_header_only
  ON public.inventory_movement_lines AS RESTRICTIVE FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM inventory_movement_headers h
      WHERE h.id = inventory_movement_lines.movement_id
        AND h.status = 'draft'
    )
  );
