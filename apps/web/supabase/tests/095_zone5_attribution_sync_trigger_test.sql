-- ============================================================================
-- TEST: Zone 5 Phase 3 -- repair_order_location_attribution_sync trigger
-- ============================================================================
-- Verifies:
--   apps/web/supabase-target/supabase/migrations/
--   20260912092000_zone5_attribution_sync_trigger.sql
--
-- CORRECTION, round 1 (external review, applied before any live run): the
-- trigger's ambiguity-test query originally combined an aggregate (sum/count)
-- with `FOR UPDATE` in one query -- invalid PostgreSQL ("FOR UPDATE is not
-- allowed with aggregate functions"). Fixed to lock via a CTE first, then
-- aggregate over the locked rows in the same statement. Test #2 below
-- exercises exactly this corrected query path (the single-unambiguous-source
-- propagation branch) -- when this file is actually run, a failure there
-- would have caught the original bug directly (the trigger would have
-- raised a Postgres error instead of silently mis-behaving).
--
-- CORRECTION, round 2 (external review of round 1's bundle): the prior
-- trigger cleared the zero-bucket's UNKNOWN marker as its very first act,
-- destroying the "was this bucket UNKNOWN before" signal before the
-- marker-gate could use it -- a bucket that had just gone physically empty
-- could fall through into the generic math test against now-stale rows,
-- either re-marking UNKNOWN spuriously or, worse, propagating a GUESSED
-- attribution to a transfer's destination if the stale numbers happened to
-- coincide. Fixed (see the migration's own updated header/body). Test #9b
-- and the four new scenario blocks (A-D, tests 15-25) below are the real,
-- fixture-driven regression tests the review specifically required -- they
-- fail against the pre-fix trigger and pass against the fix.
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

SELECT plan(26);

CREATE TEMP TABLE fx (
  org uuid, branch uuid,
  loc_a uuid, loc_b uuid, loc_c uuid,
  variant_x uuid, variant_y uuid, unit_ea uuid, product_id uuid,
  header_id uuid,
  line_ax_decrease uuid,   -- source=A dest=B, variant X (transfer-shaped)
  line_a_pure_decrease uuid, -- source=A dest=NULL, variant X (402/issue-shaped)
  ro1 uuid, ro2 uuid, rol1 uuid, rol2 uuid,
  effect_801_source uuid, effect_801_dest uuid, effect_402_source uuid, effect_101_dest uuid,
  -- Live-verification correction: inventory_stock_ledger_entries has a real
  -- UNIQUE(movement_line_id, effect_id) constraint -- a real engine only ever
  -- posts one ledger row per (line, effect), by construction. This test
  -- deliberately simulates MULTIPLE separate movement events at the same
  -- (location, variant) bucket over time, so each synthetic event needs its
  -- OWN distinct movement_line_id, even when several share the same
  -- source/destination shape. line_ax_decrease/line_a_pure_decrease above
  -- are reused verbatim only where a test's own narrative is genuinely about
  -- the FIRST event at that line; every subsequent event gets its own line.
  line_ax_decrease_2 uuid, line_ax_decrease_3 uuid, line_a_pure_decrease_2 uuid
);
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  'e39b15da-0a8d-4056-b5a2-80eb1da868a6'::uuid,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  NULL, NULL, NULL, NULL,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

-- Live-verification correction: inventory_stock_ledger_entries.effect_id is
-- NOT NULL with a real FK to inventory_movement_type_effects -- resolve the
-- real, live effect rows for this org's 101/402/801 movement types once,
-- reused by every synthetic ledger row below (the FK only needs a valid
-- row to point to; it does not need to semantically match balance_field/
-- direction for THIS trigger-focused test, since the trigger only reads
-- balance_field/direction/quantity/balance_after off the ledger row itself).
UPDATE fx SET
  effect_801_source = (SELECT mte.id FROM inventory_movement_type_effects mte JOIN inventory_movement_types mt ON mt.id = mte.movement_type_id WHERE mt.organization_id = fx.org AND mt.code = '801' AND mte.target = 'source'),
  effect_801_dest    = (SELECT mte.id FROM inventory_movement_type_effects mte JOIN inventory_movement_types mt ON mt.id = mte.movement_type_id WHERE mt.organization_id = fx.org AND mt.code = '801' AND mte.target = 'destination'),
  effect_402_source  = (SELECT mte.id FROM inventory_movement_type_effects mte JOIN inventory_movement_types mt ON mt.id = mte.movement_type_id WHERE mt.organization_id = fx.org AND mt.code = '402' AND mte.target = 'source'),
  effect_101_dest    = (SELECT mte.id FROM inventory_movement_type_effects mte JOIN inventory_movement_types mt ON mt.id = mte.movement_type_id WHERE mt.organization_id = fx.org AND mt.code = '101' AND mte.target = 'destination');

-- Live-verification correction: inventory_movement_lines.variant_id/unit_id and
-- repair_order_line_locations.variant_id all carry real FKs to inventory_variants/
-- inventory_units -- a bare gen_random_uuid() (as this fixture used before live
-- verification) would fail those FKs. Minimal real rows, org-scoped, rolled back
-- with everything else at the end of this test.
INSERT INTO inventory_units (id, organization_id, code, name)
SELECT unit_ea, org, '095-EA', '095 Each' FROM fx;
INSERT INTO inventory_products (id, organization_id, name, base_unit_id)
SELECT product_id, org, '095-test product', unit_ea FROM fx;
INSERT INTO inventory_variants (id, organization_id, product_id, sku)
SELECT variant_x, org, product_id, '095-SKU-X' FROM fx;
INSERT INTO inventory_variants (id, organization_id, product_id, sku)
SELECT variant_y, org, product_id, '095-SKU-Y' FROM fx;

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
-- Live-verification correction: inventory_movement_headers.movement_type_id
-- and movement_type_code are both NOT NULL with no default -- reuses the
-- real, live '801' movement type already configured for this E2E org (the
-- header itself is otherwise inert for this test; the trigger never reads
-- it directly, only inventory_movement_lines.destination_location_id via
-- movement_line_id).
-- inventory_movement_headers_posted_pair_v2 also requires posted_at NOT NULL
-- whenever status='posted'.
INSERT INTO inventory_movement_headers (id, organization_id, branch_id, status, movement_type_id, movement_type_code, posted_at)
SELECT header_id, org, branch, 'posted',
  (SELECT id FROM inventory_movement_types WHERE organization_id = org AND code = '801'),
  '801', now()
FROM fx;
-- Live-verification correction: inventory_movement_lines has a real
-- UNIQUE(movement_id, line_number) constraint (line_number defaults to 1) --
-- every line sharing this test's single synthetic header_id needs its own
-- explicit, distinct line_number.
INSERT INTO inventory_movement_lines (id, movement_id, organization_id, branch_id, variant_id, unit_id, quantity, source_location_id, destination_location_id, line_number)
SELECT line_ax_decrease, header_id, org, branch, variant_x, unit_ea, 2, loc_a, loc_b, 1 FROM fx;
INSERT INTO inventory_movement_lines (id, movement_id, organization_id, branch_id, variant_id, unit_id, quantity, source_location_id, destination_location_id, line_number)
SELECT line_a_pure_decrease, header_id, org, branch, variant_x, unit_ea, 2, loc_a, NULL, 2 FROM fx;
INSERT INTO inventory_movement_lines (id, movement_id, organization_id, branch_id, variant_id, unit_id, quantity, source_location_id, destination_location_id, line_number)
SELECT line_ax_decrease_2, header_id, org, branch, variant_x, unit_ea, 2, loc_a, loc_b, 8 FROM fx;
INSERT INTO inventory_movement_lines (id, movement_id, organization_id, branch_id, variant_id, unit_id, quantity, source_location_id, destination_location_id, line_number)
SELECT line_ax_decrease_3, header_id, org, branch, variant_x, unit_ea, 1, loc_a, loc_b, 9 FROM fx;
INSERT INTO inventory_movement_lines (id, movement_id, organization_id, branch_id, variant_id, unit_id, quantity, source_location_id, destination_location_id, line_number)
SELECT line_a_pure_decrease_2, header_id, org, branch, variant_x, unit_ea, 4, loc_a, NULL, 10 FROM fx;

-- =====================================================================
-- 1. Non-on_hand ledger effect is ignored entirely.
-- =====================================================================
INSERT INTO repair_order_line_locations (organization_id, branch_id, repair_order_id, repair_order_line_id, variant_id, location_id, quantity)
SELECT org, branch, ro1, rol1, variant_x, loc_a, 5 FROM fx;

INSERT INTO inventory_stock_ledger_entries
  (organization_id, branch_id, location_id, variant_id, movement_id, movement_line_id, movement_type_code, effect_id, balance_field, direction, quantity, balance_after, posted_at)
SELECT org, branch, loc_a, variant_x, header_id, line_a_pure_decrease, '999-test-reserved', effect_402_source, 'reserved', 'decrease', 2, 3, now() FROM fx;

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
  (organization_id, branch_id, location_id, variant_id, movement_id, movement_line_id, movement_type_code, effect_id, balance_field, direction, quantity, balance_after, posted_at)
SELECT org, branch, loc_a, variant_x, header_id, line_ax_decrease, '801', effect_801_source, 'on_hand', 'decrease', 2, 3, now() FROM fx;

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
  (organization_id, branch_id, location_id, variant_id, movement_id, movement_line_id, movement_type_code, effect_id, balance_field, direction, quantity, balance_after, posted_at)
SELECT org, branch, loc_a, variant_x, header_id, line_ax_decrease_2, '801', effect_801_source, 'on_hand', 'decrease', 2, 8, now() FROM fx;

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
  (organization_id, branch_id, location_id, variant_id, movement_id, movement_line_id, movement_type_code, effect_id, balance_field, direction, quantity, balance_after, posted_at)
SELECT org, branch, loc_a, variant_x, header_id, line_ax_decrease_3, '801', effect_801_source, 'on_hand', 'decrease', 1, 4, now() FROM fx;

SELECT is(
  (SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id = (SELECT rol1 FROM fx) AND location_id = (SELECT loc_a FROM fx)),
  5::numeric,
  '8. UNKNOWN is sticky: a later, numerically-unambiguous-looking movement at an already-marked bucket is NOT propagated (no self-heal from arithmetic equality)'
);

-- =====================================================================
-- 9. Zero clears the marker -- the ONE automatic clearing path. Also
--    verifies (second review round): physical truth wipes ALL leftover
--    projection rows for the bucket, not just the marker -- rol1's stale
--    row (quantity 5, untouched by test 8) must be gone too, since on_hand
--    is now provably zero regardless of what any stale row claims.
-- =====================================================================
INSERT INTO inventory_stock_ledger_entries
  (organization_id, branch_id, location_id, variant_id, movement_id, movement_line_id, movement_type_code, effect_id, balance_field, direction, quantity, balance_after, posted_at)
SELECT org, branch, loc_a, variant_x, header_id, line_a_pure_decrease_2, '402', effect_402_source, 'on_hand', 'decrease', 4, 0, now() FROM fx;

SELECT ok(
  NOT EXISTS (SELECT 1 FROM repair_order_location_attribution_uncertain WHERE organization_id = (SELECT org FROM fx) AND location_id = (SELECT loc_a FROM fx) AND variant_id = (SELECT variant_x FROM fx)),
  '9. on_hand reaching exactly zero clears the UNKNOWN marker for (A, X) -- the only automatic clearing path'
);
SELECT is(
  (SELECT count(*)::int FROM repair_order_line_locations WHERE organization_id = (SELECT org FROM fx) AND location_id = (SELECT loc_a FROM fx) AND variant_id = (SELECT variant_x FROM fx)),
  0,
  '9b. on_hand reaching exactly zero also wipes ALL leftover projection rows for the bucket (the stale rol1=5 row from an UNKNOWN bucket), not just the marker'
);

-- =====================================================================
-- 10. Ambiguous 402 (pure decrease, ordinary + attributed stock coexisting)
--     marks ONLY the source, no destination bucket.
-- =====================================================================
INSERT INTO repair_order_line_locations (organization_id, branch_id, repair_order_id, repair_order_line_id, variant_id, location_id, quantity)
SELECT org, branch, ro1, rol1, variant_x, loc_c, 5 FROM fx;
-- pre-effect on_hand at C/X is 10 (5 attributed + 5 ordinary) -- attributed_sum(5) != pre_effect(10) -> ambiguous.
INSERT INTO inventory_movement_lines (id, movement_id, organization_id, branch_id, variant_id, unit_id, quantity, source_location_id, destination_location_id, line_number)
SELECT gen_random_uuid(), header_id, org, branch, variant_x, unit_ea, 3, loc_c, NULL, 3 FROM fx;

INSERT INTO inventory_stock_ledger_entries
  (organization_id, branch_id, location_id, variant_id, movement_id, movement_line_id, movement_type_code, effect_id, balance_field, direction, quantity, balance_after, posted_at)
SELECT org, branch, loc_c, variant_x, header_id,
  (SELECT id FROM inventory_movement_lines WHERE source_location_id = loc_c AND destination_location_id IS NULL LIMIT 1),
  '402', effect_402_source, 'on_hand', 'decrease', 3, 7, now() FROM fx;

-- Live-verification correction: this assertion's second clause originally
-- checked "no marker exists anywhere else for variant_x", which is too
-- broad -- by this point in the file, loc_b still legitimately carries an
-- UNKNOWN marker left by tests 6/7 (deliberately never cleared, to prove
-- stickiness elsewhere in this same file) and is unrelated to this event.
-- The real property under test -- "no destination bucket exists for a pure
-- decrease" -- is already structurally guaranteed by the trigger's own
-- `IF v_dest IS NOT NULL THEN` guard (v_dest IS NULL here, since this
-- movement line has no destination_location_id at all), so there is no
-- code path by which this specific event could mark any location other
-- than loc_c. Scoped to the two locations this test itself could plausibly
-- (mis)affect (loc_a, already cleared by test 9's zero-clear) rather than
-- every location for variant_x ever touched by this whole file.
SELECT ok(
  EXISTS (SELECT 1 FROM repair_order_location_attribution_uncertain WHERE organization_id = (SELECT org FROM fx) AND location_id = (SELECT loc_c FROM fx) AND variant_id = (SELECT variant_x FROM fx))
  AND NOT EXISTS (SELECT 1 FROM repair_order_location_attribution_uncertain WHERE organization_id = (SELECT org FROM fx) AND location_id = (SELECT loc_a FROM fx) AND variant_id = (SELECT variant_x FROM fx)),
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
  (organization_id, branch_id, location_id, variant_id, movement_id, movement_line_id, movement_type_code, effect_id, balance_field, direction, quantity, balance_after, posted_at)
SELECT org, branch, loc_a, variant_x, header_id, line_a_pure_decrease, '101', effect_101_dest, 'on_hand', 'increase', 1, 1, now() FROM fx;
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

-- =====================================================================
-- 15/16. SCENARIO A (external review, second round): UNKNOWN + pure
--    decrease to zero. Fresh, isolated fixture (loc_d) to avoid depending
--    on residual state from earlier tests.
-- =====================================================================
CREATE TEMP TABLE fx2 (loc_d uuid, loc_e uuid, loc_f uuid, loc_g uuid, loc_h uuid, loc_i uuid, rol3 uuid,
  line_d_pure uuid, line_e_to_f uuid, line_g_to_h uuid, line_i_pure uuid);
INSERT INTO fx2 SELECT gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc_d, org, branch, '095-test D', '095-D', true FROM fx, fx2;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc_e, org, branch, '095-test E', '095-E', true FROM fx, fx2;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc_f, org, branch, '095-test F', '095-F', true FROM fx, fx2;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc_g, org, branch, '095-test G', '095-G', true FROM fx, fx2;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc_h, org, branch, '095-test H', '095-H', true FROM fx, fx2;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc_i, org, branch, '095-test I', '095-I', true FROM fx, fx2;
INSERT INTO repair_order_lines (id, repair_order_id, product_name, ordered_quantity, status)
SELECT rol3, ro1, '095-test product 3 (fresh, never ambiguous)', 5, 'pending' FROM fx, fx2;

INSERT INTO inventory_movement_lines (id, movement_id, organization_id, branch_id, variant_id, unit_id, quantity, source_location_id, destination_location_id, line_number)
SELECT line_d_pure, header_id, org, branch, variant_x, unit_ea, 4, loc_d, NULL, 4 FROM fx, fx2;
INSERT INTO inventory_movement_lines (id, movement_id, organization_id, branch_id, variant_id, unit_id, quantity, source_location_id, destination_location_id, line_number)
SELECT line_e_to_f, header_id, org, branch, variant_x, unit_ea, 5, loc_e, loc_f, 5 FROM fx, fx2;
INSERT INTO inventory_movement_lines (id, movement_id, organization_id, branch_id, variant_id, unit_id, quantity, source_location_id, destination_location_id, line_number)
SELECT line_g_to_h, header_id, org, branch, variant_x, unit_ea, 5, loc_g, loc_h, 6 FROM fx, fx2;
INSERT INTO inventory_movement_lines (id, movement_id, organization_id, branch_id, variant_id, unit_id, quantity, source_location_id, destination_location_id, line_number)
SELECT line_i_pure, header_id, org, branch, variant_x, unit_ea, 4, loc_i, NULL, 7 FROM fx, fx2;

-- --- Scenario A: UNKNOWN + pure decrease to zero -----------------------
INSERT INTO repair_order_line_locations (organization_id, branch_id, repair_order_id, repair_order_line_id, variant_id, location_id, quantity)
SELECT org, branch, ro1, rol1, variant_x, loc_d, 5 FROM fx, fx2;  -- stale row, quantity doesn't matter, bucket is UNKNOWN
INSERT INTO repair_order_location_attribution_uncertain (organization_id, branch_id, location_id, variant_id)
SELECT org, branch, loc_d, variant_x FROM fx, fx2;

INSERT INTO inventory_stock_ledger_entries
  (organization_id, branch_id, location_id, variant_id, movement_id, movement_line_id, movement_type_code, effect_id, balance_field, direction, quantity, balance_after, posted_at)
SELECT org, branch, loc_d, variant_x, header_id, line_d_pure, '402', effect_402_source, 'on_hand', 'decrease', 4, 0, now() FROM fx, fx2;

SELECT ok(
  NOT EXISTS (SELECT 1 FROM repair_order_location_attribution_uncertain WHERE organization_id = (SELECT org FROM fx) AND location_id = (SELECT loc_d FROM fx2) AND variant_id = (SELECT variant_x FROM fx)),
  '15. SCENARIO A: UNKNOWN + pure decrease to zero -- source marker removed'
);
SELECT is(
  (SELECT count(*)::int FROM repair_order_line_locations WHERE organization_id = (SELECT org FROM fx) AND location_id = (SELECT loc_d FROM fx2) AND variant_id = (SELECT variant_x FROM fx)),
  0,
  '16. SCENARIO A: UNKNOWN + pure decrease to zero -- all source projection rows gone, marker not recreated'
);

-- --- Scenario B: UNKNOWN + transfer that empties source ----------------
INSERT INTO repair_order_line_locations (organization_id, branch_id, repair_order_id, repair_order_line_id, variant_id, location_id, quantity)
SELECT org, branch, ro1, rol1, variant_x, loc_e, 5 FROM fx, fx2;  -- stale row
INSERT INTO repair_order_location_attribution_uncertain (organization_id, branch_id, location_id, variant_id)
SELECT org, branch, loc_e, variant_x FROM fx, fx2;

INSERT INTO inventory_stock_ledger_entries
  (organization_id, branch_id, location_id, variant_id, movement_id, movement_line_id, movement_type_code, effect_id, balance_field, direction, quantity, balance_after, posted_at)
SELECT org, branch, loc_e, variant_x, header_id, line_e_to_f, '801', effect_801_source, 'on_hand', 'decrease', 5, 0, now() FROM fx, fx2;

SELECT is(
  (SELECT count(*)::int FROM repair_order_line_locations WHERE organization_id = (SELECT org FROM fx) AND location_id = (SELECT loc_e FROM fx2) AND variant_id = (SELECT variant_x FROM fx)),
  0,
  '17. SCENARIO B: UNKNOWN + transfer emptying source -- source projection rows gone'
);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM repair_order_location_attribution_uncertain WHERE organization_id = (SELECT org FROM fx) AND location_id = (SELECT loc_e FROM fx2) AND variant_id = (SELECT variant_x FROM fx)),
  '18. SCENARIO B: UNKNOWN + transfer emptying source -- source marker removed'
);
SELECT ok(
  EXISTS (SELECT 1 FROM repair_order_location_attribution_uncertain WHERE organization_id = (SELECT org FROM fx) AND location_id = (SELECT loc_f FROM fx2) AND variant_id = (SELECT variant_x FROM fx)),
  '19. SCENARIO B: UNKNOWN + transfer emptying source -- destination IS marked UNKNOWN'
);
SELECT is(
  (SELECT count(*)::int FROM repair_order_line_locations WHERE organization_id = (SELECT org FROM fx) AND location_id = (SELECT loc_f FROM fx2) AND variant_id = (SELECT variant_x FROM fx)),
  0,
  '20. SCENARIO B: UNKNOWN + transfer emptying source -- destination receives NO guessed RepairOrder attribution row'
);

-- --- Scenario C: KNOWN + unambiguous transfer that empties source ------
INSERT INTO repair_order_line_locations (organization_id, branch_id, repair_order_id, repair_order_line_id, variant_id, location_id, quantity)
SELECT org, branch, ro1, rol3, variant_x, loc_g, 5 FROM fx, fx2;  -- fresh, single, KNOWN row

INSERT INTO inventory_stock_ledger_entries
  (organization_id, branch_id, location_id, variant_id, movement_id, movement_line_id, movement_type_code, effect_id, balance_field, direction, quantity, balance_after, posted_at)
SELECT org, branch, loc_g, variant_x, header_id, line_g_to_h, '801', effect_801_source, 'on_hand', 'decrease', 5, 0, now() FROM fx, fx2;

SELECT is(
  (SELECT count(*)::int FROM repair_order_line_locations WHERE organization_id = (SELECT org FROM fx) AND location_id = (SELECT loc_g FROM fx2) AND variant_id = (SELECT variant_x FROM fx)),
  0,
  '21. SCENARIO C: KNOWN + unambiguous transfer emptying source -- source rows wiped cleanly'
);
SELECT is(
  (SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id = (SELECT rol3 FROM fx2) AND location_id = (SELECT loc_h FROM fx2)),
  5::numeric,
  '22. SCENARIO C: KNOWN + unambiguous transfer emptying source -- destination gets the correct KNOWN attribution (rol3, qty 5)'
);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM repair_order_location_attribution_uncertain WHERE organization_id = (SELECT org FROM fx) AND location_id = (SELECT loc_h FROM fx2) AND variant_id = (SELECT variant_x FROM fx)),
  '23. SCENARIO C: KNOWN + unambiguous transfer emptying source -- no unnecessary UNKNOWN marker at destination'
);

-- --- Scenario D: stale quantity deliberately mismatched, then zero -----
INSERT INTO repair_order_line_locations (organization_id, branch_id, repair_order_id, repair_order_line_id, variant_id, location_id, quantity)
SELECT org, branch, ro1, rol1, variant_x, loc_i, 7 FROM fx, fx2;  -- stale quantity (7) does NOT match the decrease (4) or anything else -- proves the wipe is unconditional on physical truth, not a coincidental match
INSERT INTO repair_order_location_attribution_uncertain (organization_id, branch_id, location_id, variant_id)
SELECT org, branch, loc_i, variant_x FROM fx, fx2;

INSERT INTO inventory_stock_ledger_entries
  (organization_id, branch_id, location_id, variant_id, movement_id, movement_line_id, movement_type_code, effect_id, balance_field, direction, quantity, balance_after, posted_at)
SELECT org, branch, loc_i, variant_x, header_id, line_i_pure, '402', effect_402_source, 'on_hand', 'decrease', 4, 0, now() FROM fx, fx2;

SELECT ok(
  NOT EXISTS (SELECT 1 FROM repair_order_location_attribution_uncertain WHERE organization_id = (SELECT org FROM fx) AND location_id = (SELECT loc_i FROM fx2) AND variant_id = (SELECT variant_x FROM fx)),
  '24. SCENARIO D: stale/mismatched quantity while UNKNOWN, physical balance reaches zero -- marker still clears correctly'
);
SELECT is(
  (SELECT count(*)::int FROM repair_order_line_locations WHERE organization_id = (SELECT org FROM fx) AND location_id = (SELECT loc_i FROM fx2) AND variant_id = (SELECT variant_x FROM fx)),
  0,
  '25. SCENARIO D: stale/mismatched quantity while UNKNOWN, physical balance reaches zero -- stale row wiped regardless of its mismatched quantity'
);

SELECT * FROM finish();
ROLLBACK;
