-- INVENTORY CORE IC-8 -- HARD BLOCKER FIX (narrow, per Section 37's own
-- explicit allowance: "narrow fixes to defects that are genuine HARD
-- blockers for the accepted final architecture").
--
-- FINDING: inventory_stock_ledger_entries had NO trigger guarding INSERT
-- at all (only a BEFORE UPDATE/DELETE append-only trigger existed). Its
-- own INSERT policy, `inventory_stock_ledger_insert`, only checked
-- `has_branch_permission(organization_id, branch_id,
-- 'warehouse.inventory.operate')` -- an ORDINARY, widely-granted
-- operational permission, not an admin-only one.
--
-- REPRODUCTION (live, BEGIN/ROLLBACK, before this fix): an authenticated
-- user holding only the ordinary `warehouse.inventory.operate` permission
-- could (1) raw-INSERT a movement header in 'draft' status (already
-- permitted by design -- drafts don't affect balances), (2) raw-INSERT a
-- line on it, then (3) raw-INSERT an `inventory_stock_ledger_entries` row
-- referencing that DRAFT, NEVER-FINALIZED movement line, with entirely
-- self-chosen `balance_field`/`direction`/`quantity`/`balance_after`
-- values -- completely bypassing `inventory_finalize_posting_internal`
-- (the sole intended physical writer) and `inventory_balances` itself
-- was not touched or updated to match. This creates a "phantom" ledger
-- row: a fabricated entry in what this project's entire architecture
-- treats as the immutable, append-only, canonical source of physical
-- history (Concept A) -- corrupting audit-trail integrity even though it
-- does not, by itself, let the same user move REAL on_hand_quantity
-- (that column remains separately protected per PRE-IC8 P0's own
-- hardening).
--
-- ROOT CAUSE: the ledger table's own closure work (this project's
-- IC-1/IC-7/PRE-IC8-P0 passes) closed `inventory_balances`/
-- `inventory_settings` raw-write paths explicitly, but this specific
-- table's own INSERT policy was never tightened to require the same
-- "only the canonical SECURITY DEFINER engine may write this" boundary
-- -- an oversight, not a deliberate design choice (no review bundle
-- anywhere in this project's own history discloses this as an accepted
-- risk).
--
-- SMALLEST FIX: replace the permissive, branch-permission-based INSERT
-- policy with an unconditional deny, matching the EXACT pattern already
-- established and proven for every other canonical-writer-only table in
-- this schema (e.g. `repair_order_line_movement_links_insert_deny`,
-- `repair_order_line_locations_deny_insert` pre-A8). This is safe and
-- sufficient because the ONLY legitimate writer,
-- `inventory_finalize_posting_internal`, is `SECURITY DEFINER` owned by
-- `postgres`, and `postgres` has `rolbypassrls = true` -- it has never
-- depended on this policy to write, exactly the same reasoning already
-- documented for `repair_order_line_movement_links`'s own equivalent
-- closure.
--
-- REGRESSION (live-verified immediately after applying): the exact same
-- 3-step bypass chain now fails at step 3 with `42501` (RLS violation).
-- The canonical engine path (`inventory_create_and_finalize` ->
-- `inventory_finalize_posting_internal`) still posts correctly (balance
-- updated to the exact expected value, exactly one ledger row created).
-- `inventory_reverse_movement`'s own reversal path (which posts via the
-- same internal engine) also re-verified working end-to-end, balance
-- correctly restored to 0 after reversing the same test movement.
--
-- See docs/inventory/reviews/ic-8-final-production-readiness-review/
-- security-evidence.md for the full reproduction/fix/regression
-- transcript.

DROP POLICY IF EXISTS inventory_stock_ledger_insert ON public.inventory_stock_ledger_entries;

CREATE POLICY inventory_stock_ledger_insert_deny
  ON public.inventory_stock_ledger_entries
  FOR INSERT
  WITH CHECK (false);
