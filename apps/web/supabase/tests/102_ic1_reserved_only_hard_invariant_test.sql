-- ============================================================================
-- TEST: IC-1 -- HARD-reservation invariant protects RESERVED-ONLY stock
--       (zero allocation), enforced by the generic movement engine itself
-- ============================================================================
-- Companion to `101_zone3_zone5_movement_engine_reserved_blindspot_
-- characterization_test.sql`, which proves IC-1 closes the blind spot for
-- reservation-backed ALLOCATED stock. This file proves the same protection
-- holds when stock is only RESERVED (never converted to an allocation) --
-- i.e. that `inventory_finalize_posting`'s new invariant check
-- (`post_on_hand >= reserved_quantity + allocated_quantity`) genuinely
-- covers `reserved_quantity` on its own, not merely as an incidental
-- consequence of protecting `allocated_quantity`. This directly enforces
-- the accepted architecture's own HARD-reservation decision
-- (`reserved_quantity <= on_hand_quantity` must always hold; backorder
-- semantics are explicitly out of scope).
--
-- In its own file (not merged into 101) because `receive_repair_order_
-- stock` resolves exactly ONE receiving location per branch
-- (`resolve_branch_receiving_location`, backed by a live UNIQUE constraint
-- on (organization_id, branch_id) for purpose='receiving' locations) -- a
-- second independent receive/reserve scenario against the same fixed test
-- org/branch cannot share 101's single transaction.
--
-- SCENARIO C (added: IC-1 finalization pass, product-owner decision --
-- `on_hand_quantity >= 0` ALWAYS is now the FINAL product contract,
-- `negative_stock_policy='allow'`/`'allow_with_approval'` are superseded
-- for on-hand behavior, see `inventory-core-architecture.md` §0 decision
-- #20 and §5 invariant #1): this is no longer a diagnostic -- it documents
-- the FINAL, accepted product contract. Proves both policy values produce
-- the identical P0003 rejection for a bare on-hand decrease with ZERO
-- commitment (reserved=0, allocated=0) -- i.e. that `negative_stock_
-- policy` cannot bypass the hard invariant regardless of its value.
--
-- Executed live against supabase-target via Supabase MCP.

BEGIN;

SELECT plan(14);

CREATE TEMP TABLE fxb (
  org uuid, branch uuid, e2e_user uuid, variant_1 uuid, unit_1 uuid,
  ro uuid, rol uuid, session_id uuid, doc_id uuid, wsdl_id uuid,
  receiving_location_id uuid, dest_location_id uuid
);
GRANT SELECT ON fxb TO authenticated;
INSERT INTO fxb SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid();

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

-- A dedicated, FRESH branch for this file's own fixture -- see 101's own
-- identical note: IC-1's genuine concurrency test permanently claimed the
-- shared org=9f98fe91.../branch=e39b15da... pair's own "one receiving
-- location per branch" slot with a non-zero-balance residual for this same
-- variant. `e2e_user` already holds a real, permanent, ORG-WIDE
-- `warehouse.*` wildcard grant in this org, so a fresh branch needs no
-- additional permission grant.
INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch, org, '102-resonly-fresh-branch', 994 FROM fxb;

INSERT INTO wdd_matcher_sessions (id, organization_id, branch_id, name)
SELECT session_id, org, branch, '102-reserved-only-session' FROM fxb;
INSERT INTO workshop_source_documents (id, organization_id, branch_id, document_type, external_document_number, source_session_id)
SELECT doc_id, org, branch, 'wdd', '102-RESONLY-DOC', session_id FROM fxb;
INSERT INTO workshop_source_document_lines (id, workshop_source_document_id, wdd_matcher_line_id, product_code, quantity)
SELECT wsdl_id, doc_id, '49864df7-5275-48f1-a95e-fdafadce3249'::uuid, '102-RESONLY-SKU', 10 FROM fxb;
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT ro, org, branch, '102-RESONLY-RO', 'open' FROM fxb;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT rol, ro, variant_1, '102-RESONLY-SKU', '102 reserved-only test line', 10, 'pcs' FROM fxb;
INSERT INTO repair_order_line_source_links (id, repair_order_line_id, workshop_source_document_line_id, quantity_contribution)
SELECT gen_random_uuid(), rol, wsdl_id, 10 FROM fxb;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory, purpose)
SELECT receiving_location_id, org, branch, '102-resonly-receiving', true, 'receiving' FROM fxb;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory)
SELECT dest_location_id, org, branch, '102-resonly-destination', true FROM fxb;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fxb)::text, 'role', 'authenticated')::text, true);

-- Receive 10, reserve 6 (NO allocation -- reserved_quantity=6, allocated_quantity=0).
SELECT receive_repair_order_stock(
  (SELECT e2e_user FROM fxb), (SELECT org FROM fxb), (SELECT branch FROM fxb),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxb), 'unit_id', (SELECT unit_1 FROM fxb), 'quantity', 10, 'source_line_id', '49864df7-5275-48f1-a95e-fdafadce3249')),
  NULL, NULL, NULL, NULL, NULL
);

SELECT inventory_create_reservation(
  (SELECT org FROM fxb), (SELECT branch FROM fxb),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxb), 'location_id', (SELECT receiving_location_id FROM fxb), 'quantity', 6)),
  'repair_order_line', (SELECT rol FROM fxb), null, null, null, (SELECT e2e_user FROM fxb)
);

CREATE TEMP TABLE putaway_outcome_b (label text, status text, detail text);
GRANT INSERT, SELECT ON putaway_outcome_b TO authenticated;

-- Attempt to move all 10 -- must be REJECTED (only 4 are genuinely free).
DO $$
DECLARE v_result jsonb;
BEGIN
  BEGIN
    v_result := putaway_repair_order_stock(
      (SELECT e2e_user FROM fxb), (SELECT org FROM fxb), (SELECT branch FROM fxb),
      jsonb_build_array(jsonb_build_object('repair_order_line_id', (SELECT rol FROM fxb), 'variant_id', (SELECT variant_1 FROM fxb), 'unit_id', (SELECT unit_1 FROM fxb), 'quantity', 10)),
      (SELECT dest_location_id FROM fxb), NULL
    );
    INSERT INTO putaway_outcome_b VALUES ('move10', 'succeeded', v_result::text);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO putaway_outcome_b VALUES ('move10', 'failed', SQLSTATE || ' ' || SQLERRM);
  END;
END $$;

-- Attempt to move 5 -- must ALSO be REJECTED (still exceeds the 4 free units).
DO $$
DECLARE v_result jsonb;
BEGIN
  BEGIN
    v_result := putaway_repair_order_stock(
      (SELECT e2e_user FROM fxb), (SELECT org FROM fxb), (SELECT branch FROM fxb),
      jsonb_build_array(jsonb_build_object('repair_order_line_id', (SELECT rol FROM fxb), 'variant_id', (SELECT variant_1 FROM fxb), 'unit_id', (SELECT unit_1 FROM fxb), 'quantity', 5)),
      (SELECT dest_location_id FROM fxb), NULL
    );
    INSERT INTO putaway_outcome_b VALUES ('move5', 'succeeded', v_result::text);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO putaway_outcome_b VALUES ('move5', 'failed', SQLSTATE || ' ' || SQLERRM);
  END;
END $$;

INSERT INTO test_log(line) SELECT is((SELECT status FROM putaway_outcome_b WHERE label = 'move10'), 'failed', 'T1: moving all 10 with 6 reserved (0 allocated) is REJECTED -- HARD-reservation invariant enforced by the engine itself, independent of allocation');
INSERT INTO test_log(line) SELECT ok((SELECT detail FROM putaway_outcome_b WHERE label = 'move10') LIKE 'P0003%', 'T2: rejection carries the dedicated SQLSTATE P0003');
INSERT INTO test_log(line) SELECT is((SELECT status FROM putaway_outcome_b WHERE label = 'move5'), 'failed', 'T3: moving 5 (only 4 truly free: 10 on_hand - 6 reserved) is also REJECTED');

CREATE TEMP TABLE after_balance_b_rejected AS
SELECT on_hand_quantity, reserved_quantity FROM inventory_balances
WHERE organization_id = (SELECT org FROM fxb) AND branch_id = (SELECT branch FROM fxb)
  AND location_id = (SELECT receiving_location_id FROM fxb) AND variant_id = (SELECT variant_1 FROM fxb);
INSERT INTO test_log(line) SELECT is(on_hand_quantity, 10::numeric, 'T4: after both rejected attempts, on_hand is UNCHANGED (still 10)') FROM after_balance_b_rejected;
INSERT INTO test_log(line) SELECT is(reserved_quantity, 6::numeric, 'T5: after both rejected attempts, reserved is UNCHANGED (still 6)') FROM after_balance_b_rejected;

-- Control: moving exactly the free amount (4) succeeds.
SELECT putaway_repair_order_stock(
  (SELECT e2e_user FROM fxb), (SELECT org FROM fxb), (SELECT branch FROM fxb),
  jsonb_build_array(jsonb_build_object('repair_order_line_id', (SELECT rol FROM fxb), 'variant_id', (SELECT variant_1 FROM fxb), 'unit_id', (SELECT unit_1 FROM fxb), 'quantity', 4)),
  (SELECT dest_location_id FROM fxb), NULL
);

CREATE TEMP TABLE after_balance_b_control AS
SELECT on_hand_quantity, reserved_quantity FROM inventory_balances
WHERE organization_id = (SELECT org FROM fxb) AND branch_id = (SELECT branch FROM fxb)
  AND location_id = (SELECT receiving_location_id FROM fxb) AND variant_id = (SELECT variant_1 FROM fxb);
INSERT INTO test_log(line) SELECT is(on_hand_quantity, 6::numeric, 'T6 (control): moving exactly the free 4 units succeeds -- source on_hand now 6, exactly at the reserved boundary') FROM after_balance_b_control;

RESET ROLE;

-- ===========================================================================
-- SCENARIO C: FINAL PRODUCT CONTRACT -- negative_stock_policy cannot bypass
-- the hard invariant, for either 'allow' or 'block', on completely
-- uncommitted stock (reserved=0, allocated=0). A fresh, third isolated
-- branch (same fresh-branch convention as Scenario B above) with a
-- directly-seeded balance (on_hand=2, reserved=0, allocated=0) -- no
-- receive/reserve RPC chain needed since this scenario tests the bare
-- on-hand decrease path directly.
-- ===========================================================================

CREATE TEMP TABLE fxc (org uuid, branch uuid, e2e_user uuid, variant_1 uuid, unit_1 uuid, loc_a uuid, loc_b uuid);
GRANT SELECT ON fxc TO authenticated;
INSERT INTO fxc SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid, gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid, 'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid, gen_random_uuid(), gen_random_uuid();

INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch, org, '102-finalcontract-fresh-branch', 995 FROM fxc;

INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory)
SELECT loc_a, org, branch, '102-finalcontract-loc-a', true FROM fxc;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory)
SELECT loc_b, org, branch, '102-finalcontract-loc-b', true FROM fxc;

-- Seed the org's own inventory_settings row (INSERT ... ON CONFLICT DO
-- NOTHING mirrors the engine's own warm-up pattern; this org already has a
-- settings row from earlier fixtures in this same transaction/session).
INSERT INTO inventory_settings (organization_id) VALUES ((SELECT org FROM fxc))
ON CONFLICT (organization_id) DO NOTHING;

SET LOCAL ambra.inventory_movement_engine = 'on';
INSERT INTO inventory_balances (organization_id, branch_id, location_id, variant_id, on_hand_quantity, reserved_quantity, allocated_quantity)
SELECT org, branch, loc_a, variant_1, 2, 0, 0 FROM fxc
ON CONFLICT (organization_id, branch_id, location_id, variant_id, coalesce(lot_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(serial_id, '00000000-0000-0000-0000-000000000000'::uuid))
DO UPDATE SET on_hand_quantity = 2, reserved_quantity = 0, allocated_quantity = 0;

CREATE TEMP TABLE movement_count_baseline_c AS
SELECT count(*) AS n FROM inventory_movement_headers WHERE organization_id = (SELECT org FROM fxc) AND branch_id = (SELECT branch FROM fxc);
GRANT SELECT ON movement_count_baseline_c TO authenticated;
CREATE TEMP TABLE ledger_count_baseline_c AS
SELECT count(*) AS n FROM inventory_stock_ledger_entries WHERE organization_id = (SELECT org FROM fxc) AND branch_id = (SELECT branch FROM fxc);
GRANT SELECT ON ledger_count_baseline_c TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fxc)::text, 'role', 'authenticated')::text, true);

CREATE TEMP TABLE outcome_c (label text, status text, detail text);
GRANT INSERT, SELECT ON outcome_c TO authenticated;

-- policy='allow': attempt decrease 5 from on_hand=2 (zero commitment) -- MUST be rejected per the final product contract.
RESET ROLE;
UPDATE inventory_settings SET negative_stock_policy = 'allow' WHERE organization_id = (SELECT org FROM fxc);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fxc)::text, 'role', 'authenticated')::text, true);

DO $$
DECLARE v_result jsonb;
BEGIN
  BEGIN
    v_result := inventory_create_and_finalize(
      (SELECT org FROM fxc), (SELECT branch FROM fxc), '402',
      jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxc), 'unit_id', (SELECT unit_1 FROM fxc), 'quantity', 5, 'source_location_id', (SELECT loc_a FROM fxc), 'destination_location_id', NULL)),
      NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fxc)
    );
    INSERT INTO outcome_c VALUES ('allow', 'succeeded', v_result::text);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO outcome_c VALUES ('allow', 'failed', SQLSTATE || ' ' || SQLERRM);
  END;
END $$;

INSERT INTO test_log(line) SELECT is((SELECT status FROM outcome_c WHERE label = 'allow'), 'failed', 'T7 (FINAL CONTRACT): with negative_stock_policy=''allow'', a bare on-hand decrease that would go negative (2-5) is REJECTED -- ''allow'' cannot bypass the hard invariant');
INSERT INTO test_log(line) SELECT ok((SELECT detail FROM outcome_c WHERE label = 'allow') LIKE 'P0003%', 'T8: rejection carries SQLSTATE P0003 (not an accidental 23514 CHECK violation)');

CREATE TEMP TABLE balance_after_allow AS
SELECT on_hand_quantity FROM inventory_balances WHERE organization_id = (SELECT org FROM fxc) AND branch_id = (SELECT branch FROM fxc) AND location_id = (SELECT loc_a FROM fxc) AND variant_id = (SELECT variant_1 FROM fxc);
INSERT INTO test_log(line) SELECT is(on_hand_quantity, 2::numeric, 'T9: on_hand remains UNCHANGED (still 2) after the rejected ''allow''-policy attempt') FROM balance_after_allow;
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM inventory_movement_headers WHERE organization_id = (SELECT org FROM fxc) AND branch_id = (SELECT branch FROM fxc)),
  (SELECT n FROM movement_count_baseline_c), 'T10: no orphan inventory_movement_headers row created'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM inventory_stock_ledger_entries WHERE organization_id = (SELECT org FROM fxc) AND branch_id = (SELECT branch FROM fxc)),
  (SELECT n FROM ledger_count_baseline_c), 'T11: no ledger mutation (inventory_stock_ledger_entries row count unchanged)'
);

-- policy='block': same fixture, same attempt -- must produce the byte-identical rejection.
RESET ROLE;
UPDATE inventory_settings SET negative_stock_policy = 'block' WHERE organization_id = (SELECT org FROM fxc);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fxc)::text, 'role', 'authenticated')::text, true);

DO $$
DECLARE v_result jsonb;
BEGIN
  BEGIN
    v_result := inventory_create_and_finalize(
      (SELECT org FROM fxc), (SELECT branch FROM fxc), '402',
      jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxc), 'unit_id', (SELECT unit_1 FROM fxc), 'quantity', 5, 'source_location_id', (SELECT loc_a FROM fxc), 'destination_location_id', NULL)),
      NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fxc)
    );
    INSERT INTO outcome_c VALUES ('block', 'succeeded', v_result::text);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO outcome_c VALUES ('block', 'failed', SQLSTATE || ' ' || SQLERRM);
  END;
END $$;

INSERT INTO test_log(line) SELECT is((SELECT status FROM outcome_c WHERE label = 'block'), 'failed', 'T12 (FINAL CONTRACT): with negative_stock_policy=''block'', the identical attempt is also REJECTED');
INSERT INTO test_log(line) SELECT ok((SELECT detail FROM outcome_c WHERE label = 'block') LIKE 'P0003%', 'T13: ''block''-policy rejection also carries SQLSTATE P0003 -- byte-identical behavior to ''allow''');

CREATE TEMP TABLE balance_after_block AS
SELECT on_hand_quantity FROM inventory_balances WHERE organization_id = (SELECT org FROM fxc) AND branch_id = (SELECT branch FROM fxc) AND location_id = (SELECT loc_a FROM fxc) AND variant_id = (SELECT variant_1 FROM fxc);
INSERT INTO test_log(line) SELECT is(on_hand_quantity, 2::numeric, 'T14: on_hand remains UNCHANGED (still 2) after the rejected ''block''-policy attempt too') FROM balance_after_block;

RESET ROLE;

SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') AS not_ok_count, count(*) AS total_assertions FROM test_log;

ROLLBACK;
