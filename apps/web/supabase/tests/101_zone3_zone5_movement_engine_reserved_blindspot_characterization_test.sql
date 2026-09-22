-- ============================================================================
-- TEST: Zone 3 <-> Zone 5 integration -- movement-engine reserved/allocated
--       blind-spot -- IC-1 CLOSURE PROOF (formerly a characterization test)
-- ============================================================================
-- HISTORY / WHY THIS FILE'S EXPECTATIONS CHANGED
--
-- This file originally (Zone 3 <-> Zone 5 integration audit, 2026-09-15,
-- pre-IC-1) documented a real, live-reproduced GAP in the shared, generic
-- movement engine (`inventory_finalize_posting`, called transitively by both
-- `receive_repair_order_stock` and `putaway_repair_order_stock`): its body
-- contained NO reference to `reserved_quantity`/`allocated_quantity`, so a
-- physical movement could relocate on-hand stock that was already reserved
-- and/or allocated elsewhere, leaving a source balance row with
-- `on_hand_quantity < reserved_quantity + allocated_quantity` -- a stranded,
-- inconsistent commitment the engine created and did not itself flag. The
-- old T7-T11 in this file asserted that a putaway of the full 10 received
-- units SUCCEEDED despite 6 of those 10 being already reserved+allocated,
-- and that the resulting source balance row was left with
-- allocated_quantity(6) > on_hand_quantity(0).
--
-- IC-1 (Inventory Core consolidation, Canonical Movement Engine / Hard Stock
-- Invariants -- see `docs/inventory/inventory-core-implementation-plan.md`
-- and `docs/inventory/inventory-core-progress.md`) DELIBERATELY closes this
-- gap: `inventory_finalize_posting` now rejects, with SQLSTATE `P0003`, any
-- 'on_hand'/'decrease' effect that would leave
-- `on_hand_quantity < reserved_quantity + allocated_quantity` (the SUM of
-- both commitment buckets -- verified live, via `inventory_create_
-- allocation`'s own body, that reserved and allocated are non-overlapping,
-- additive buckets: a reservation-backed allocation DECREMENTS
-- reserved_quantity by exactly the amount it INCREMENTS allocated_quantity
-- in the same UPDATE, so protecting either value alone is insufficient --
-- only protecting their sum is correct).
--
-- This file's expectations are therefore intentionally and explicitly
-- INVERTED versus the original characterization: what used to be proven to
-- SUCCEED (and left a stranded balance) is now proven to be REJECTED (with
-- the source/destination balances, reservation, and allocation all left
-- completely unchanged, and no orphan movement header/line rows created).
-- A new valid-movement control case proves that moving exactly the
-- genuinely free quantity still succeeds -- IC-1 does not block legitimate
-- movement, only movement that would strand a commitment.
--
-- The companion RESERVED-ONLY scenario (zero allocation) is in a separate
-- file, `102_ic1_reserved_only_hard_invariant_test.sql`, because
-- `receive_repair_order_stock` resolves exactly ONE receiving location per
-- branch (`resolve_branch_receiving_location`, enforced by a live UNIQUE
-- constraint) -- a second independent receive/reserve scenario against the
-- SAME fixed test org/branch cannot share this file's single transaction
-- without either colliding on that location or double-counting balances on
-- top of this file's own control-move residue.
--
-- If a future change ever makes this file's assertions fail again, that is
-- a signal requiring an explicit, conscious decision -- never a silent
-- adjustment of the expected values to manufacture a pass.
--
-- Executed live against supabase-target via Supabase MCP.

BEGIN;

SELECT plan(17);

-- ===========================================================================
-- Fixtures: a full, real Zone 5 provenance chain (workshop_source_documents
-- -> workshop_source_document_lines -> repair_order_line_source_links) is
-- required because `receive_repair_order_stock` only writes a canonical
-- `repair_order_line_movement_links` attribution row (A8: live-read
-- physical state derives from this, not a persisted projection) when
-- `source_line_id` resolves to exactly one RepairOrderLine. `wdd_matcher_line_id` below reuses a REAL,
-- existing `wdd_matcher_lines` row as its own FK target (LIVE VERIFIED zero
-- other `workshop_source_document_lines` rows already reference it) -- the
-- same anchor-to-a-real-existing-row convention this project's own test
-- suite already uses elsewhere.
-- ===========================================================================

CREATE TEMP TABLE fx (
  org uuid, branch uuid, e2e_user uuid,
  variant_1 uuid, unit_1 uuid,
  ro uuid, rol uuid,
  session_id uuid, doc_id uuid, wsdl_id uuid,
  receiving_location_id uuid, dest_location_id uuid,
  reservation_id uuid, resline_id uuid
);
GRANT SELECT, UPDATE ON fx TO authenticated;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid,
  gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(),
  null, null;

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

-- A dedicated, FRESH branch for this file's own fixture (not the shared
-- org=9f98fe91.../branch=e39b15da... pair other test files use) -- IC-1's
-- own genuine two-session concurrency test permanently, and by design,
-- claimed that shared branch's own "one receiving location per branch"
-- slot (a live UNIQUE INDEX) with a real, undeletable, non-zero-balance
-- residual for this exact variant (see IC-1's review bundle,
-- `negative-stock-policy-conflict.md`'s sibling correction-pass note) --
-- reusing that shared branch here would silently corrupt this file's own
-- "before" balance assumptions (T5/T6 etc. assert exact absolute
-- quantities). A fresh branch has no receiving location and no balance
-- history at all. `e2e_user` already holds a real, permanent, ORG-WIDE
-- `warehouse.*` wildcard grant in this fixture org (LIVE VERIFIED,
-- established convention already used by 099/100's own `branch_b`), so
-- zero additional permission grant is needed for a fresh branch.
INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch, org, '101-char-fresh-branch', 993 FROM fx;

INSERT INTO wdd_matcher_sessions (id, organization_id, branch_id, name)
SELECT session_id, org, branch, '101-char-test-session' FROM fx;

INSERT INTO workshop_source_documents (id, organization_id, branch_id, document_type, external_document_number, source_session_id)
SELECT doc_id, org, branch, 'wdd', '101-CHAR-TEST-DOC', session_id FROM fx;

INSERT INTO workshop_source_document_lines (id, workshop_source_document_id, wdd_matcher_line_id, product_code, quantity)
SELECT wsdl_id, doc_id, '49864df7-5275-48f1-a95e-fdafadce3249'::uuid, '101-CHAR-SKU', 10 FROM fx;

INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT ro, org, branch, '101-CHAR-TEST-RO', 'open' FROM fx;

INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT rol, ro, variant_1, '101-CHAR-SKU', '101 char test line', 10, 'pcs' FROM fx;

INSERT INTO repair_order_line_source_links (id, repair_order_line_id, workshop_source_document_line_id, quantity_contribution)
SELECT gen_random_uuid(), rol, wsdl_id, 10 FROM fx;

-- A dedicated receiving location for THIS test's own (fresh) branch.
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory, purpose)
SELECT receiving_location_id, org, branch, '101-char-receiving', true, 'receiving' FROM fx;

INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory)
SELECT dest_location_id, org, branch, '101-char-destination', true FROM fx;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

-- Step 1: RECEIVE 10 units via the real Zone 5 RPC.
CREATE TEMP TABLE recv AS
SELECT receive_repair_order_stock(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object(
    'variant_id', (SELECT variant_1 FROM fx),
    'unit_id', (SELECT unit_1 FROM fx),
    'quantity', 10,
    'source_line_id', '49864df7-5275-48f1-a95e-fdafadce3249'
  )),
  NULL, NULL, NULL, NULL, NULL
) AS result;
INSERT INTO test_log(line) SELECT is((result ->> 'status'), 'posted', 'T1: receive_repair_order_stock posts a real 101 receipt for 10 units (unaffected by IC-1)') FROM recv;

INSERT INTO test_log(line) SELECT is(
  (SELECT (loc->>'quantity')::numeric FROM fx, jsonb_array_elements(get_repair_order_line_physical_state(org, branch, rol)->'locations') loc WHERE loc->>'location_id' = receiving_location_id::text),
  10::numeric, 'T2 (A8): live-read physical state shows 10 units at the receiving location after receipt'
);

CREATE TEMP TABLE movement_count_baseline AS
SELECT count(*) AS n FROM inventory_movement_headers WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx);

-- Step 2: RESERVE 6 of the 10.
CREATE TEMP TABLE resv AS
SELECT (inventory_create_reservation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT receiving_location_id FROM fx), 'quantity', 6)),
  'repair_order_line', (SELECT rol FROM fx), null, null, null, (SELECT e2e_user FROM fx)
)) AS result;
UPDATE fx SET reservation_id = ((SELECT result FROM resv) ->> 'reservation_id')::uuid;
UPDATE fx SET resline_id = (SELECT id FROM inventory_reservation_lines WHERE reservation_id = (SELECT reservation_id FROM fx));
INSERT INTO test_log(line) SELECT is((result ->> 'status'), 'active', 'T3: reserving 6 of the 10 received units succeeds') FROM resv;

-- Step 3: ALLOCATE the full 6 reserved units.
CREATE TEMP TABLE alloc AS
SELECT (inventory_create_allocation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object(
    'variant_id', (SELECT variant_1 FROM fx),
    'location_id', (SELECT receiving_location_id FROM fx),
    'quantity', 6,
    'reservation_line_id', (SELECT resline_id FROM fx)
  )),
  (SELECT reservation_id FROM fx), 'repair_order_line', (SELECT rol FROM fx), null, (SELECT e2e_user FROM fx)
)) AS result;
INSERT INTO test_log(line) SELECT is((result ->> 'status'), 'active', 'T4: allocating the full 6 reserved units succeeds') FROM alloc;

CREATE TEMP TABLE before_balance AS
SELECT on_hand_quantity, reserved_quantity, allocated_quantity
FROM inventory_balances
WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx)
  AND location_id = (SELECT receiving_location_id FROM fx) AND variant_id = (SELECT variant_1 FROM fx);

INSERT INTO test_log(line) SELECT is(on_hand_quantity, 10::numeric, 'T5: before putaway, the receiving location has on_hand=10') FROM before_balance;
INSERT INTO test_log(line) SELECT is(allocated_quantity, 6::numeric, 'T6: before putaway, the receiving location has allocated=6 (reservation fully converted to allocation)') FROM before_balance;

-- ===========================================================================
-- Step 4 (IC-1 CLOSURE PROOF): attempt to putaway the FULL 10 units --
-- 6 of which are already allocated. Under IC-1 this must be REJECTED.
-- ===========================================================================
CREATE TEMP TABLE putaway_outcome (status text, detail text);
GRANT INSERT, SELECT ON putaway_outcome TO authenticated;

DO $$
DECLARE v_result jsonb;
BEGIN
  BEGIN
    v_result := putaway_repair_order_stock(
      (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
      jsonb_build_array(jsonb_build_object(
        'repair_order_line_id', (SELECT rol FROM fx),
        'variant_id', (SELECT variant_1 FROM fx),
        'unit_id', (SELECT unit_1 FROM fx),
        'quantity', 10
      )),
      (SELECT dest_location_id FROM fx),
      NULL
    );
    INSERT INTO putaway_outcome VALUES ('succeeded', v_result::text);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO putaway_outcome VALUES ('failed', SQLSTATE || ' ' || SQLERRM);
  END;
END $$;

INSERT INTO test_log(line) SELECT is(
  (SELECT status FROM putaway_outcome), 'failed',
  'T7 (IC-1 CLOSURE): putaway of the full 10 units is now REJECTED -- 6 are already allocated and would be stranded'
);
INSERT INTO test_log(line) SELECT ok(
  (SELECT detail FROM putaway_outcome) LIKE 'P0003%',
  'T8 (IC-1 CLOSURE): the rejection carries the dedicated SQLSTATE P0003 ("would strand committed stock")'
);

CREATE TEMP TABLE after_source_balance_rejected AS
SELECT on_hand_quantity, reserved_quantity, allocated_quantity
FROM inventory_balances
WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx)
  AND location_id = (SELECT receiving_location_id FROM fx) AND variant_id = (SELECT variant_1 FROM fx);

INSERT INTO test_log(line) SELECT is(on_hand_quantity, 10::numeric, 'T9: after the rejected putaway, source on_hand is UNCHANGED (still 10) -- no partial write') FROM after_source_balance_rejected;
INSERT INTO test_log(line) SELECT is(allocated_quantity, 6::numeric, 'T10: after the rejected putaway, source allocated is UNCHANGED (still 6)') FROM after_source_balance_rejected;
INSERT INTO test_log(line) SELECT is(reserved_quantity, 0::numeric, 'T11: after the rejected putaway, source reserved is UNCHANGED (still 0 -- fully converted to allocation earlier)') FROM after_source_balance_rejected;

INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM inventory_movement_headers WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx)),
  (SELECT n FROM movement_count_baseline),
  'T12: the rejected putaway created NO orphan inventory_movement_headers row (exception rolled back the entire attempt, header count unchanged since the receipt)'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT allocated_quantity FROM inventory_allocation_lines WHERE reservation_line_id = (SELECT resline_id FROM fx)),
  6::numeric, 'T13: the allocation line itself is completely unaffected by the rejected putaway (still 6)'
) ;

-- ===========================================================================
-- Control case: move only the genuinely free quantity (10 on_hand - 6
-- committed = 4). IC-1 must NOT block a legitimate, non-stranding movement.
-- ===========================================================================
DO $$
DECLARE v_result jsonb;
BEGIN
  v_result := putaway_repair_order_stock(
    (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
    jsonb_build_array(jsonb_build_object(
      'repair_order_line_id', (SELECT rol FROM fx),
      'variant_id', (SELECT variant_1 FROM fx),
      'unit_id', (SELECT unit_1 FROM fx),
      'quantity', 4
    )),
    (SELECT dest_location_id FROM fx),
    NULL
  );
  INSERT INTO putaway_outcome VALUES ('succeeded_control', v_result::text);
END $$;

INSERT INTO test_log(line) SELECT ok(
  EXISTS (SELECT 1 FROM putaway_outcome WHERE status = 'succeeded_control'),
  'T14 (control): moving exactly the free 4 units (10 on_hand - 6 committed) SUCCEEDS -- IC-1 does not block legitimate movement'
);

CREATE TEMP TABLE after_source_balance_control AS
SELECT on_hand_quantity, allocated_quantity FROM inventory_balances
WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx)
  AND location_id = (SELECT receiving_location_id FROM fx) AND variant_id = (SELECT variant_1 FROM fx);
CREATE TEMP TABLE after_dest_balance_control AS
SELECT on_hand_quantity FROM inventory_balances
WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx)
  AND location_id = (SELECT dest_location_id FROM fx) AND variant_id = (SELECT variant_1 FROM fx);

INSERT INTO test_log(line) SELECT is(on_hand_quantity, 6::numeric, 'T15: after the control move, source on_hand is 6 (10 - 4), exactly at the committed boundary') FROM after_source_balance_control;
INSERT INTO test_log(line) SELECT is(allocated_quantity, 6::numeric, 'T16: after the control move, source allocated is still 6 (untouched, commitment fully protected)') FROM after_source_balance_control;
INSERT INTO test_log(line) SELECT is(on_hand_quantity, 4::numeric, 'T17: after the control move, destination on_hand is 4') FROM after_dest_balance_control;

RESET ROLE;

SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') AS not_ok_count, count(*) AS total_assertions FROM test_log;

ROLLBACK;
