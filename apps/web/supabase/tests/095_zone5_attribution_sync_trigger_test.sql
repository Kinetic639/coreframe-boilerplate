-- ============================================================================
-- TEST: Zone 5 Phase 3 -- repair_order_location_attribution_sync trigger
-- ============================================================================
-- Verifies:
--   apps/web/supabase-target/supabase/migrations/
--   20260912092000_zone5_attribution_sync_trigger.sql
--
-- NOT EXECUTED this session -- Supabase MCP / live DB access was unavailable.
-- Per that same migration's own header: the exact column list of
-- `inventory_stock_ledger_entries` and `inventory_movement_lines` used below
-- is the convergent result of two independent design/audit sources, NOT this
-- session's own live confirmation. A session with live access MUST re-check
-- every column name/type referenced here (and in the trigger itself) before
-- treating a pass/fail result as meaningful -- this file is written to the
-- required test list in the approved plan and progress tracker, to be run
-- (and, if any column differs, corrected) as the very first live step of
-- Phase 3, per the "verify before each phase" working rule.
--
-- Approach: synthetic ledger rows are inserted directly into
-- inventory_stock_ledger_entries (exactly as the plan's own Phase 3 test
-- design calls for -- "against synthetic ledger rows, before either
-- orchestration RPC exists"), against a minimal real movement header/line
-- fixture, so the trigger fires with realistic movement_line_id linkage.

BEGIN;

SELECT plan(14);

CREATE TEMP TABLE fx (
  org uuid, branch uuid,
  loc_a uuid, loc_b uuid, loc_c uuid,
  variant_x uuid, variant_y uuid, unit_ea uuid,
  header_id uuid,
  line_ax_decrease uuid,   -- source=A dest=B, variant X (transfer-shaped)
  line_a_pure_decrease uuid, -- source=A dest=NULL, variant X (402/issue-shaped)
  ro1 uuid, ro2 uuid, rol1 uuid, rol2 uuid
);
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  'e39b15da-0a8d-4056-b5a2-80eb1da868a6'::uuid,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc_a, org, branch, '095-test A', '095-A', true FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc_b, org, branch, '095-test B', '095-B', true FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc_c, org, branch, '095-test C', '095-C', true FROM fx;

INSERT INTO repair_orders (id, organization_id, branch_id, zl_number, order_number, status)
SELECT ro1, org, branch, '095-TEST-ZL-1', '095-TEST-1', 'open' FROM fx;
INSERT INTO repair_orders (id, organization_id, branch_id, zl_number, order_number, status)
SELECT ro2, org, branch, '095-TEST-ZL-2', '095-TEST-2', 'open' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_name, ordered_quantity, status)
SELECT rol1, ro1, '095-test product 1', 5, 'pending' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_name, ordered_quantity, status)
SELECT rol2, ro2, '095-test product 2', 5, 'pending' FROM fx;

-- Minimal movement header/line fixtures (status irrelevant to the trigger,
-- which only reacts to ledger inserts) -- one transfer-shaped line (A->B),
-- one pure-decrease-shaped line (A, no destination).
INSERT INTO inventory_movement_headers (id, organization_id, branch_id, status)
SELECT header_id, org, branch, 'posted' FROM fx;
INSERT INTO inventory_movement_lines (id, movement_id, organization_id, branch_id, variant_id, unit_id, quantity, source_location_id, destination_location_id)
SELECT line_ax_decrease, header_id, org, branch, variant_x, unit_ea, 2, loc_a, loc_b FROM fx;
INSERT INTO inventory_movement_lines (id, movement_id, organization_id, branch_id, variant_id, unit_id, quantity, source_location_id, destination_location_id)
SELECT line_a_pure_decrease, header_id, org, branch, variant_x, unit_ea, 2, loc_a, NULL FROM fx;

-- =====================================================================
-- 1. Non-on_hand ledger effect is ignored entirely.
-- =====================================================================
INSERT INTO repair_order_line_locations (organization_id, branch_id, repair_order_id, repair_order_line_id, variant_id, location_id, quantity)
SELECT org, branch, ro1, rol1, variant_x, loc_a, 5 FROM fx;

INSERT INTO inventory_stock_ledger_entries
  (organization_id, branch_id, location_id, variant_id, movement_id, movement_line_id, movement_type_code, balance_field, direction, quantity, balance_after, posted_at)
SELECT org, branch, loc_a, variant_x, header_id, line_a_pure_decrease, '999-test-reserved', 'reserved', 'decrease', 2, 3, now() FROM fx;

SELECT is(
  (SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id = (SELECT rol1 FROM fx) AND location_id = (SELECT loc_a FROM fx)),
  5::numeric,
  '1. a non-on_hand ledger effect (e.g. reserved) leaves the projection completely untouched'
);

-- =====================================================================
-- 2. Exact single attribution, transfer-shaped -> propagates correctly.
--    Pre-effect on_hand at A/X = 5 (matches rol1's 5), decrease of 2,
--    balance_after = 3 (post-effect) -- proves the pre-effect reconstruction
--    (3 + 2 = 5) is what's used, not the raw post-effect value.
-- =====================================================================
INSERT INTO inventory_stock_ledger_entries
  (organization_id, branch_id, location_id, variant_id, movement_id, movement_line_id, movement_type_code, balance_field, direction, quantity, balance_after, posted_at)
SELECT org, branch, loc_a, variant_x, header_id, line_ax_decrease, '801', 'on_hand', 'decrease', 2, 3, now() FROM fx;

SELECT is(
  (SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id = (SELECT rol1 FROM fx) AND location_id = (SELECT loc_a FROM fx)),
  3::numeric,
  '2. exact single attribution, transfer-shaped: source decrements from 5 to 3 (using reconstructed pre-effect on_hand=5, not raw balance_after=3)'
);
SELECT is(
  (SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id = (SELECT rol1 FROM fx) AND location_id = (SELECT loc_b FROM fx)),
  2::numeric,
  '3. exact single attribution, transfer-shaped: destination credited with the same repair_order_line_id and the moved quantity'
);

-- Reset A back to 5 for the next scenarios (simulate a fresh receipt directly).
UPDATE repair_order_line_locations SET quantity = 5 WHERE repair_order_line_id = (SELECT rol1 FROM fx) AND location_id = (SELECT loc_a FROM fx);
DELETE FROM repair_order_line_locations WHERE repair_order_line_id = (SELECT rol1 FROM fx) AND location_id = (SELECT loc_b FROM fx);

-- =====================================================================
-- 3/4/5. Ambiguous multi-RepairOrder 801: A holds rol1=5 and rol2=5 (two
--    distinct lines) -- moving 2 units out is ambiguous. Must NOT guess,
--    must mark BOTH source and destination UNKNOWN.
-- =====================================================================
INSERT INTO repair_order_line_locations (organization_id, branch_id, repair_order_id, repair_order_line_id, variant_id, location_id, quantity)
SELECT org, branch, ro2, rol2, variant_x, loc_a, 5 FROM fx;

INSERT INTO inventory_stock_ledger_entries
  (organization_id, branch_id, location_id, variant_id, movement_id, movement_line_id, movement_type_code, balance_field, direction, quantity, balance_after, posted_at)
SELECT org, branch, loc_a, variant_x, header_id, line_ax_decrease, '801', 'on_hand', 'decrease', 2, 8, now() FROM fx;

SELECT is(
  (SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id = (SELECT rol1 FROM fx) AND location_id = (SELECT loc_a FROM fx)),
  5::numeric,
  '4. ambiguous multi-RepairOrder 801 does NOT guess: rol1''s row at A is untouched'
);
SELECT is(
  (SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id = (SELECT rol2 FROM fx) AND location_id = (SELECT loc_a FROM fx)),
  5::numeric,
  '5. ambiguous multi-RepairOrder 801 does NOT guess: rol2''s row at A is untouched either'
);
SELECT ok(
  EXISTS (SELECT 1 FROM repair_order_location_attribution_uncertain WHERE organization_id = (SELECT org FROM fx) AND location_id = (SELECT loc_a FROM fx) AND variant_id = (SELECT variant_x FROM fx)),
  '6. ambiguous 801 marks the SOURCE (A, X) UNKNOWN'
);
SELECT ok(
  EXISTS (SELECT 1 FROM repair_order_location_attribution_uncertain WHERE organization_id = (SELECT org FROM fx) AND location_id = (SELECT loc_b FROM fx) AND variant_id = (SELECT variant_x FROM fx)),
  '7. ambiguous 801 ALSO marks the DESTINATION (B, X) UNKNOWN, even though B had zero prior rows'
);

-- Clean slate for the sticky/no-self-heal test: clear rol2 from A so A is
-- single-attribution again (numerically), leaving the marker in place.
DELETE FROM repair_order_line_locations WHERE repair_order_line_id = (SELECT rol2 FROM fx) AND location_id = (SELECT loc_a FROM fx);

-- =====================================================================
-- 8. STICKY / NO-SELF-HEAL (the load-bearing test for this whole correction):
--    A is marked UNKNOWN from the previous step. Post a SECOND movement at
--    A/X that, numerically, now looks unambiguous (rol1=5 is the only row,
--    matching pre-effect on_hand). The trigger must NOT propagate it and
--    must NOT clear the marker -- it must only re-affirm/extend it.
-- =====================================================================
INSERT INTO inventory_stock_ledger_entries
  (organization_id, branch_id, location_id, variant_id, movement_id, movement_line_id, movement_type_code, balance_field, direction, quantity, balance_after, posted_at)
SELECT org, branch, loc_a, variant_x, header_id, line_ax_decrease, '801', 'on_hand', 'decrease', 1, 4, now() FROM fx;

SELECT is(
  (SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id = (SELECT rol1 FROM fx) AND location_id = (SELECT loc_a FROM fx)),
  5::numeric,
  '8. UNKNOWN is sticky: a later, numerically-unambiguous-looking movement at an already-marked bucket is NOT propagated (no self-heal from arithmetic equality)'
);

-- =====================================================================
-- 9. Zero clears the marker -- the ONE automatic clearing path.
-- =====================================================================
INSERT INTO inventory_stock_ledger_entries
  (organization_id, branch_id, location_id, variant_id, movement_id, movement_line_id, movement_type_code, balance_field, direction, quantity, balance_after, posted_at)
SELECT org, branch, loc_a, variant_x, header_id, line_a_pure_decrease, '402', 'on_hand', 'decrease', 4, 0, now() FROM fx;

SELECT ok(
  NOT EXISTS (SELECT 1 FROM repair_order_location_attribution_uncertain WHERE organization_id = (SELECT org FROM fx) AND location_id = (SELECT loc_a FROM fx) AND variant_id = (SELECT variant_x FROM fx)),
  '9. on_hand reaching exactly zero clears the UNKNOWN marker for (A, X) -- the only automatic clearing path'
);

-- =====================================================================
-- 10. Ambiguous 402 (pure decrease, ordinary + attributed stock coexisting)
--     marks ONLY the source, no destination bucket.
-- =====================================================================
INSERT INTO repair_order_line_locations (organization_id, branch_id, repair_order_id, repair_order_line_id, variant_id, location_id, quantity)
SELECT org, branch, ro1, rol1, variant_x, loc_c, 5 FROM fx;
-- pre-effect on_hand at C/X is 10 (5 attributed + 5 ordinary) -- attributed_sum(5) != pre_effect(10) -> ambiguous.
INSERT INTO inventory_movement_lines (id, movement_id, organization_id, branch_id, variant_id, unit_id, quantity, source_location_id, destination_location_id)
SELECT gen_random_uuid(), header_id, org, branch, variant_x, unit_ea, 3, loc_c, NULL FROM fx;

INSERT INTO inventory_stock_ledger_entries
  (organization_id, branch_id, location_id, variant_id, movement_id, movement_line_id, movement_type_code, balance_field, direction, quantity, balance_after, posted_at)
SELECT org, branch, loc_c, variant_x, header_id,
  (SELECT id FROM inventory_movement_lines WHERE source_location_id = loc_c AND destination_location_id IS NULL LIMIT 1),
  '402', 'on_hand', 'decrease', 3, 7, now() FROM fx;

SELECT ok(
  EXISTS (SELECT 1 FROM repair_order_location_attribution_uncertain WHERE organization_id = (SELECT org FROM fx) AND location_id = (SELECT loc_c FROM fx) AND variant_id = (SELECT variant_x FROM fx))
  AND NOT EXISTS (SELECT 1 FROM repair_order_location_attribution_uncertain WHERE organization_id = (SELECT org FROM fx) AND variant_id = (SELECT variant_x FROM fx) AND location_id NOT IN (SELECT loc_c FROM fx)),
  '10. ambiguous 402 (ordinary + attributed stock coexisting) marks ONLY the source bucket -- no destination bucket exists for a pure decrease'
);

-- =====================================================================
-- 11. No negative projection quantity is ever produced (structural check:
--     the CHECK constraint itself, exercised via a direct decrement attempt
--     larger than what's attributed).
-- =====================================================================
SELECT throws_ok(
  format($sql$UPDATE repair_order_line_locations SET quantity = quantity - 999 WHERE repair_order_line_id = '%s' AND location_id = '%s'$sql$,
    (SELECT rol1::text FROM fx), (SELECT loc_c::text FROM fx)),
  '23514',
  NULL,
  '11. the CHECK(quantity >= 0) constraint itself prevents negative projection quantity regardless of caller'
);

-- =====================================================================
-- 12. Bypass flag suppresses the trigger's propagation logic.
-- =====================================================================
SET LOCAL ambra.repair_order_attribution_authoritative = 'on';
INSERT INTO inventory_stock_ledger_entries
  (organization_id, branch_id, location_id, variant_id, movement_id, movement_line_id, movement_type_code, balance_field, direction, quantity, balance_after, posted_at)
SELECT org, branch, loc_a, variant_x, header_id, line_a_pure_decrease, '101', 'on_hand', 'increase', 1, 1, now() FROM fx;
-- (loc_a/variant_x has no attribution left at this point in the script, so
--  this is primarily proving the bypass check itself does not error and
--  does not fabricate a marker/row where none would otherwise be created.)
SELECT ok(
  NOT EXISTS (SELECT 1 FROM repair_order_location_attribution_uncertain WHERE organization_id = (SELECT org FROM fx) AND location_id = (SELECT loc_a FROM fx) AND variant_id = (SELECT variant_x FROM fx)),
  '12. with the bypass flag set, the trigger performs no propagation/marking work for that ledger insert'
);
RESET ambra.repair_order_attribution_authoritative;

-- =====================================================================
-- 13. Bypass flag grants no authorization: it is a plain SET LOCAL on a
--     custom GUC, not a permission check -- setting it does not itself
--     allow an otherwise-unauthorized write to any table. This is
--     structurally proven by the trigger function having no permission
--     logic conditioned on the flag at all (it only ever affects whether
--     the SECURITY DEFINER trigger body itself performs its own writes,
--     which happen under the trigger's own definer privileges regardless of
--     who is connected) -- and by repair_order_line_locations having zero
--     client-writable RLS policy, independent of this flag's state.
-- =====================================================================
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'repair_order_line_locations'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
  ),
  '13. repair_order_line_locations has no client-writable RLS policy at all -- the bypass flag cannot grant a write path that does not exist'
);

-- =====================================================================
-- 14. Concurrency -- structural proof only (per plan §6.1, mirroring this
--     repo's own established, honest convention in
--     091_repair_orders_materialization_rpc_test.sql: "true two-connection
--     concurrent-call testing cannot be expressed in a single pgTAP
--     script"). This proves the FOR UPDATE lock statement is present in the
--     trigger body; it does NOT prove genuine concurrent-session safety.
--     REQUIRED, EXPLICITLY DEFERRED, NOT WRITTEN HERE: a live-DB
--     integration test opening two separate database sessions/connections
--     with overlapping transactions against the same
--     (org, branch, location, variant), asserting no double-consumption of
--     the same attribution, no negative quantity, no lost destination
--     credit, and a final projection state consistent with both operations.
-- =====================================================================
SELECT ok(
  pg_get_functiondef('public.repair_order_location_attribution_sync'::regproc) ~* 'FOR UPDATE',
  '14. (structural only, not a concurrency proof) the trigger body contains a FOR UPDATE lock statement before reading/deciding on repair_order_line_locations rows'
);

SELECT * FROM finish();
ROLLBACK;
