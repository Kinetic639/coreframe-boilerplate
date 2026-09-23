-- ============================================================================
-- TEST: IC-6A -- Opening Stock Active-Path Repair
-- ============================================================================
-- IC-6 discovered that `InventoryProductsService.createOpeningStockMovement`
-- (reachable from the ACTIVE `createEnhancedProduct` path whenever a new
-- variant has `opening_quantity > 0`) called two RPCs that do not exist
-- live (`inventory_create_draft_movement`, `inventory_post_movement`).
-- IC-6A moved this caller onto the canonical single-call entry point
-- `inventory_create_and_finalize`, movement type '401' ("Inventory Count
-- Adjustment (Increase)" -- the only seeded, active, manually-postable type
-- whose own location requirements match opening stock's destination-only
-- shape). This file proves that exact call shape end to end, live, against
-- the real canonical engine -- not merely that a TypeScript mock was called
-- with the right arguments (Vitest already proves that shape; this proves
-- the DB side actually accepts and correctly applies it).
--
-- Executed live against supabase-target via Supabase MCP.

BEGIN;

SELECT plan(16);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, e2e_user uuid, variant_1 uuid, unit_1 uuid, loc uuid
);
GRANT SELECT ON fx TO authenticated;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid,
  gen_random_uuid();

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

-- e2e_user already holds a real, permanent, ORG-WIDE warehouse.* wildcard
-- grant in this org (established fixture convention) -- a fresh branch
-- needs no additional permission grant.
INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch, org, '109-ic6a-opening-stock-branch', 700 FROM fx;

INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory)
SELECT loc, org, branch, '109-ic6a-opening-loc', true FROM fx;

-- A fake "product id" standing in for the real one (this test exercises the
-- movement engine's own behavior, not product creation itself).
CREATE TEMP TABLE fake_product AS SELECT gen_random_uuid() AS id;
GRANT SELECT ON fake_product TO authenticated;

-- ============================================================================
-- SCENARIO A: baseline -- on_hand is 0 (no balance row exists yet).
-- ============================================================================
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM inventory_balances WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx) AND location_id = (SELECT loc FROM fx) AND variant_id = (SELECT variant_1 FROM fx)),
  0::bigint, 'A1: no balance row exists before the opening-stock movement (on_hand is implicitly 0)'
);

CREATE TEMP TABLE movement_count_before AS
SELECT count(*) AS n FROM inventory_movement_headers WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx);
GRANT SELECT ON movement_count_before TO authenticated;
CREATE TEMP TABLE ledger_count_before AS
SELECT count(*) AS n FROM inventory_stock_ledger_entries WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx);
GRANT SELECT ON ledger_count_before TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

-- ============================================================================
-- SCENARIO B: the exact call shape createOpeningStockMovement now sends.
-- ============================================================================
CREATE TEMP TABLE opening_result AS
SELECT inventory_create_and_finalize(
  (SELECT org FROM fx), (SELECT branch FROM fx), '401',
  jsonb_build_array(jsonb_build_object(
    'variant_id', (SELECT variant_1 FROM fx),
    'unit_id', (SELECT unit_1 FROM fx),
    'quantity', 5,
    'destination_location_id', (SELECT loc FROM fx),
    'unit_cost', 12.50,
    'note', 'Opening stock from product creation'
  )),
  NULL, NULL, NULL,
  (SELECT id::text FROM fake_product),
  'Opening stock from product creation',
  'product-opening-stock-' || (SELECT id::text FROM fake_product),
  (SELECT e2e_user FROM fx)
) AS result;

INSERT INTO test_log(line) SELECT is((SELECT result ->> 'status' FROM opening_result), 'posted', 'B1: opening-stock movement posts successfully (status=posted)');

CREATE TEMP TABLE balance_after AS
SELECT on_hand_quantity FROM inventory_balances WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx) AND location_id = (SELECT loc FROM fx) AND variant_id = (SELECT variant_1 FROM fx);
INSERT INTO test_log(line) SELECT is(on_hand_quantity, 5::numeric, 'B2: on_hand is exactly 5 after the opening-stock movement') FROM balance_after;

-- ============================================================================
-- SCENARIO C: exactly one posted movement, correct type, correct reference.
-- ============================================================================
CREATE TEMP TABLE header_after AS
SELECT id, status, movement_type_code, external_reference, posted_by, document_number
FROM inventory_movement_headers
WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx);

INSERT INTO test_log(line) SELECT is(count(*), (SELECT n + 1 FROM movement_count_before), 'C1: exactly one new movement header created') FROM header_after;
INSERT INTO test_log(line) SELECT is((SELECT movement_type_code FROM header_after), '401', 'C2: movement type is 401 (Inventory Count Adjustment (Increase))');
INSERT INTO test_log(line) SELECT is((SELECT external_reference FROM header_after), (SELECT id::text FROM fake_product), 'C3: external_reference carries the product id (the reference_type/reference_id substitute)');
INSERT INTO test_log(line) SELECT ok((SELECT document_number FROM header_after) IS NOT NULL, 'C4: a real document_number was generated by the canonical numbering path (not a raw insert)');

-- ============================================================================
-- SCENARIO D: exactly one ledger effect, correct direction/quantity.
-- ============================================================================
CREATE TEMP TABLE ledger_after AS
SELECT count(*) AS n, max(direction) AS direction, max(quantity) AS quantity
FROM inventory_stock_ledger_entries
WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx);

INSERT INTO test_log(line) SELECT is((SELECT n FROM ledger_after), (SELECT n + 1 FROM ledger_count_before), 'D1: exactly one new ledger entry created');
INSERT INTO test_log(line) SELECT is((SELECT direction FROM ledger_after), 'increase', 'D2: ledger direction is increase');
INSERT INTO test_log(line) SELECT is((SELECT quantity FROM ledger_after), 5::numeric, 'D3: ledger quantity is exactly 5');

-- ============================================================================
-- SCENARIO E: actor/audit metadata correct.
-- ============================================================================
INSERT INTO test_log(line) SELECT is((SELECT posted_by FROM header_after), (SELECT e2e_user FROM fx), 'E1: header.posted_by is the real actor');
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM inventory_movement_audit_log WHERE movement_id = (SELECT id FROM header_after) AND action = 'posted' AND actor_user_id = (SELECT e2e_user FROM fx)),
  1::bigint, 'E2: audit log has exactly one posted entry attributed to the real actor'
);

-- ============================================================================
-- SCENARIO F: retry with the SAME idempotency key does not double-post.
-- ============================================================================
CREATE TEMP TABLE retry_result AS
SELECT inventory_create_and_finalize(
  (SELECT org FROM fx), (SELECT branch FROM fx), '401',
  jsonb_build_array(jsonb_build_object(
    'variant_id', (SELECT variant_1 FROM fx),
    'unit_id', (SELECT unit_1 FROM fx),
    'quantity', 5,
    'destination_location_id', (SELECT loc FROM fx),
    'unit_cost', 12.50,
    'note', 'Opening stock from product creation'
  )),
  NULL, NULL, NULL,
  (SELECT id::text FROM fake_product),
  'Opening stock from product creation',
  'product-opening-stock-' || (SELECT id::text FROM fake_product),
  (SELECT e2e_user FROM fx)
) AS result;

INSERT INTO test_log(line) SELECT is((SELECT result ->> 'status' FROM retry_result), 'posted', 'F1: retry with the same idempotency key returns status=posted (not an error)');

CREATE TEMP TABLE balance_after_retry AS
SELECT on_hand_quantity FROM inventory_balances WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx) AND location_id = (SELECT loc FROM fx) AND variant_id = (SELECT variant_1 FROM fx);
INSERT INTO test_log(line) SELECT is(on_hand_quantity, 5::numeric, 'F2: on_hand is STILL exactly 5 after retry -- not 10') FROM balance_after_retry;
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM inventory_movement_headers WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx)),
  (SELECT n + 1 FROM movement_count_before), 'F3: still exactly one movement header (retry did not create a second draft)'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM inventory_stock_ledger_entries WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx)),
  (SELECT n + 1 FROM ledger_count_before), 'F4: still exactly one ledger entry (retry did not post a second effect)'
);

RESET ROLE;

SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') AS not_ok_count, count(*) AS total_assertions FROM test_log;

ROLLBACK;
