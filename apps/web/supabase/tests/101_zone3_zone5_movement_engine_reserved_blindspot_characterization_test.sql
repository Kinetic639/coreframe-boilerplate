-- ============================================================================
-- TEST: Zone 3 <-> Zone 5 integration -- movement-engine reserved/allocated
--       blind-spot CHARACTERIZATION
-- ============================================================================
-- This file does NOT test new code. It documents, with a live, reproducible
-- assertion, a real behavior of the EXISTING, shared, unmodified generic
-- movement engine (`inventory_finalize_posting`, called transitively by
-- both `receive_repair_order_stock` and `putaway_repair_order_stock`),
-- discovered during the Zone 3 <-> Zone 5 integration audit:
--
--   `inventory_finalize_posting`'s own body contains NO reference to
--   `reserved_quantity` or `allocated_quantity` (LIVE VERIFIED via
--   `prosrc ILIKE '%reserved_quantity%'` returning false before this test
--   was written). It therefore does not check, when reducing
--   `on_hand_quantity` at a location, whether any of that quantity is
--   already reserved or allocated elsewhere in the system.
--
-- This is a PRE-EXISTING gap in the shared, base movement engine -- it
-- predates and is independent of both Zone 3 Phase 10C and Zone 5's own
-- receive/putaway RPCs. Phase 10C's own containers never touch
-- `inventory_balances` at all (proven in `100_...`'s own T23-T27), so this
-- is not a Phase 10C defect. Zone 5's `putaway_repair_order_stock` is
-- simply the first REAL, RepairOrder-aware caller that makes this
-- pre-existing gap reachable against RepairOrder-owned, potentially
-- already-allocated stock -- exactly the scenario this file proves, using
-- the REAL Zone 5 RPCs end-to-end, not a synthetic reproduction.
--
-- Per the accepted product decision, `receive -> putaway -> reservation ->
-- allocation -> container -> ...` is the NORMAL sequential lifecycle --
-- putaway-after-reservation (what this file deliberately does, to exercise
-- the blind spot) is NOT the normal product workflow. This file exists to
-- honestly characterize what the shared engine currently allows, not to
-- describe an expected or recommended operational sequence.
--
-- Per explicit instruction: this file does NOT fix the gap. It asserts
-- whatever the LIVE, REAL behavior actually is. If a future change to
-- `inventory_finalize_posting` (out of THIS integration's own scope, see
-- the integration audit's own "changes that must not be made" list) closes
-- this gap, this file's own assertions will start failing -- which is the
-- correct, intended outcome: it will force an explicit, conscious update
-- to this file's own documented expectations, not a silent behavior
-- change nobody notices.
--
-- Executed live against supabase-target via Supabase MCP.

BEGIN;

SELECT plan(11);

-- ===========================================================================
-- Fixtures: a full, real Zone 5 provenance chain (workshop_source_documents
-- -> workshop_source_document_lines -> repair_order_line_source_links) is
-- required because `receive_repair_order_stock` only writes a
-- `repair_order_line_locations` row (the row `putaway_repair_order_stock`'s
-- own availability check reads) when `source_line_id` resolves to exactly
-- one RepairOrderLine. `wdd_matcher_line_id` below reuses a REAL, existing
-- `wdd_matcher_lines` row as its own FK target (LIVE VERIFIED zero other
-- `workshop_source_document_lines` rows already reference it, so no
-- ambiguous-resolution collision) -- the same "anchor to a real existing
-- row for an FK target, without depending on its own content" convention
-- this project's own test suite already uses elsewhere.
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
  'e39b15da-0a8d-4056-b5a2-80eb1da868a6'::uuid,
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

INSERT INTO wdd_matcher_sessions (id, organization_id, branch_id, name)
SELECT session_id, org, branch, '101-char-test-session' FROM fx;

INSERT INTO workshop_source_documents (id, organization_id, branch_id, document_type, external_document_number, source_session_id)
SELECT doc_id, org, branch, 'wdd', '101-CHAR-TEST-DOC', session_id FROM fx;

-- Reuses a REAL, pre-existing wdd_matcher_lines row as the FK target for
-- wdd_matcher_line_id -- LIVE VERIFIED zero other workshop_source_document_lines
-- rows reference it, so `receive_repair_order_stock`'s own candidate-count
-- resolution sees exactly one match, not zero or ambiguous.
INSERT INTO workshop_source_document_lines (id, workshop_source_document_id, wdd_matcher_line_id, product_code, quantity)
SELECT wsdl_id, doc_id, '49864df7-5275-48f1-a95e-fdafadce3249'::uuid, '101-CHAR-SKU', 10 FROM fx;

INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT ro, org, branch, '101-CHAR-TEST-RO', 'open' FROM fx;

INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT rol, ro, variant_1, '101-CHAR-SKU', '101 char test line', 10, 'pcs' FROM fx;

INSERT INTO repair_order_line_source_links (id, repair_order_line_id, workshop_source_document_line_id, quantity_contribution)
SELECT gen_random_uuid(), rol, wsdl_id, 10 FROM fx;

-- A dedicated receiving location for THIS test's own branch (none exists
-- there by default -- reusing the shared test branch's own real receiving
-- location, if any, would risk colliding with unrelated live data).
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory, purpose)
SELECT receiving_location_id, org, branch, '101-char-receiving', true, 'receiving' FROM fx;

INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory)
SELECT dest_location_id, org, branch, '101-char-destination', true FROM fx;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

-- ===========================================================================
-- Step 1: RECEIVE 10 units via the real Zone 5 RPC.
-- ===========================================================================
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
INSERT INTO test_log(line) SELECT is((result ->> 'status'), 'posted', 'T1: receive_repair_order_stock posts a real 101 receipt for 10 units') FROM recv;

-- T2: Zone 5's own spatial projection shows 10 units at the receiving
-- location for this exact RepairOrderLine.
INSERT INTO test_log(line) SELECT is(
  (SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id = (SELECT rol FROM fx) AND location_id = (SELECT receiving_location_id FROM fx)),
  10::numeric, 'T2: repair_order_line_locations shows 10 units at the receiving location after receipt'
);

-- ===========================================================================
-- Step 2: RESERVE 6 of the 10, at the receiving location (where the stock
-- physically is right now, per Zone 5's own projection).
-- ===========================================================================
CREATE TEMP TABLE resv AS
SELECT (inventory_create_reservation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT receiving_location_id FROM fx), 'quantity', 6)),
  'repair_order_line', (SELECT rol FROM fx), null, null, null, (SELECT e2e_user FROM fx)
)) AS result;
UPDATE fx SET reservation_id = ((SELECT result FROM resv) ->> 'reservation_id')::uuid;
UPDATE fx SET resline_id = (SELECT id FROM inventory_reservation_lines WHERE reservation_id = (SELECT reservation_id FROM fx));
INSERT INTO test_log(line) SELECT is((result ->> 'status'), 'active', 'T3: reserving 6 of the 10 received units succeeds') FROM resv;

-- ===========================================================================
-- Step 3: ALLOCATE the full 6 reserved units.
-- ===========================================================================
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

-- ===========================================================================
-- Baseline, immediately before the characterization step.
-- ===========================================================================
CREATE TEMP TABLE before_balance AS
SELECT on_hand_quantity, allocated_quantity
FROM inventory_balances
WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx)
  AND location_id = (SELECT receiving_location_id FROM fx) AND variant_id = (SELECT variant_1 FROM fx);

INSERT INTO test_log(line) SELECT is(on_hand_quantity, 10::numeric, 'T5: before putaway, the receiving location has on_hand=10') FROM before_balance;
INSERT INTO test_log(line) SELECT is(allocated_quantity, 6::numeric, 'T6: before putaway, the receiving location has allocated=6 (6 of the 10 are committed)') FROM before_balance;

-- ===========================================================================
-- Step 4 (THE CHARACTERIZATION): putaway the FULL 10 units Zone 5's own
-- projection shows as available -- even though 6 of those 10 are already
-- reserved+allocated. This is NOT the normal product workflow (per the
-- accepted lifecycle, allocation happens AFTER putaway) -- it is
-- deliberately exercised here, out of normal order, specifically to probe
-- whether the shared engine itself would stop it if it happened. It does
-- not.
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

-- T7: LIVE, CONFIRMED RESULT -- the shared engine's own reserved/allocated
-- blind spot means this putaway SUCCEEDS. If this assertion ever starts
-- failing, the blind spot has been closed (by a change this integration
-- layer explicitly did NOT make) -- update this file's own expectations
-- explicitly when that happens, do not silently adjust it in passing.
INSERT INTO test_log(line) SELECT is(
  (SELECT status FROM putaway_outcome), 'succeeded',
  'T7 (CHARACTERIZATION): putaway of the full 10 units succeeds DESPITE 6 being already reserved+allocated at the source -- the shared movement engine does not check reserved_quantity/allocated_quantity'
);

-- ===========================================================================
-- Post-state: the actual, live-proven consequence of the blind spot.
-- ===========================================================================
CREATE TEMP TABLE after_source_balance AS
SELECT on_hand_quantity, allocated_quantity
FROM inventory_balances
WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx)
  AND location_id = (SELECT receiving_location_id FROM fx) AND variant_id = (SELECT variant_1 FROM fx);

CREATE TEMP TABLE after_dest_balance AS
SELECT on_hand_quantity, allocated_quantity
FROM inventory_balances
WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx)
  AND location_id = (SELECT dest_location_id FROM fx) AND variant_id = (SELECT variant_1 FROM fx);

INSERT INTO test_log(line) SELECT is(on_hand_quantity, 0::numeric, 'T8: after putaway, the source (receiving) location''s own on_hand is now 0 -- all 10 physically moved') FROM after_source_balance;

-- T9: the load-bearing proof -- allocated_quantity at the source is STILL
-- 6, UNCHANGED by the putaway, even though on_hand there is now 0. The
-- balance row itself now asserts allocated_quantity(6) > on_hand_quantity(0)
-- -- an inconsistent state the engine allowed to be created and does not
-- itself flag.
INSERT INTO test_log(line) SELECT is(
  allocated_quantity, 6::numeric,
  'T9 (CHARACTERIZATION): allocated_quantity at the source location is STILL 6 after putaway -- now exceeding its own on_hand_quantity(0), an inconsistent balance row the engine created and does not flag'
) FROM after_source_balance;

INSERT INTO test_log(line) SELECT is(on_hand_quantity, 10::numeric, 'T10: the destination location correctly received all 10 units of on_hand') FROM after_dest_balance;

-- T11: the destination's own allocated_quantity is 0 -- the allocation's
-- own claim did NOT follow the physical stock; it stayed attached to the
-- now-empty source location. Reservation/allocation's own location_id is
-- entirely independent of wherever a movement physically relocates on_hand.
INSERT INTO test_log(line) SELECT is(
  allocated_quantity, 0::numeric,
  'T11 (CHARACTERIZATION): the destination location''s own allocated_quantity is 0 -- the allocation claim did not travel with the physically-relocated stock'
) FROM after_dest_balance;

RESET ROLE;

SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') AS not_ok_count, count(*) AS total_assertions FROM test_log;

ROLLBACK;
