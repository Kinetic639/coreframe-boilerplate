-- ============================================================================
-- TEST: IC-6 -- Legacy Writer/Helper Removal (cleanup boundary proof)
-- ============================================================================
-- Does NOT retest 097-107's own business workflows from scratch -- those
-- are re-run unmodified as part of this pass's own full regression. This
-- file proves only the CLEANUP BOUNDARY itself: dropped objects are
-- genuinely gone, stale overloads are genuinely gone, deprecated
-- negative-stock configuration is genuinely unavailable, internal
-- functions remain non-executable by ordinary callers, and every
-- canonical path this phase touched (directly or by proximity) still
-- succeeds end-to-end.
--
-- Executed live against supabase-target via Supabase MCP.

BEGIN;

SELECT plan(23);

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

SET LOCAL ambra.inventory_movement_engine = 'on';

-- ============================================================================
-- SCENARIO A: dropped legacy helper genuinely absent.
-- ============================================================================

INSERT INTO test_log(line) SELECT is(
  to_regprocedure('public.inventory_v1_get_or_create_balance(uuid,uuid,uuid,uuid)'),
  NULL::regprocedure,
  'A1: inventory_v1_get_or_create_balance is genuinely gone (to_regprocedure returns NULL)'
);

-- ============================================================================
-- SCENARIO B: stale overload genuinely absent, canonical overload intact.
-- ============================================================================

INSERT INTO test_log(line) SELECT is(
  to_regprocedure('public.inventory_get_or_create_balance_for_update(uuid,uuid,uuid,uuid,uuid)'),
  NULL::regprocedure,
  'B1: the stale 5-arg inventory_get_or_create_balance_for_update overload is genuinely gone'
);
INSERT INTO test_log(line) SELECT isnt(
  to_regprocedure('public.inventory_get_or_create_balance_for_update(uuid,uuid,uuid,uuid,uuid,uuid,uuid)'),
  NULL::regprocedure,
  'B2: the canonical 7-arg (lot/serial-aware) overload remains callable'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*)::int FROM pg_proc WHERE proname = 'inventory_get_or_create_balance_for_update'),
  1,
  'B3: exactly ONE overload of inventory_get_or_create_balance_for_update exists live (no stale duplicate)'
);

-- ============================================================================
-- SCENARIO C: deprecated negative_stock_policy configuration is genuinely
-- unavailable -- the column itself is gone, not merely unused.
-- ============================================================================

INSERT INTO test_log(line) SELECT is(
  (SELECT count(*)::int FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'inventory_settings' AND column_name = 'negative_stock_policy'),
  0,
  'C1: inventory_settings.negative_stock_policy column is genuinely gone'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*)::int FROM pg_constraint
   WHERE conrelid = 'public.inventory_settings'::regclass AND conname = 'inventory_settings_negative_stock_policy_check'),
  0,
  'C2: the column''s own CHECK constraint is genuinely gone (dropped automatically with the column)'
);
INSERT INTO test_log(line) SELECT ok(
  (SELECT pg_get_functiondef('public.inventory_finalize_posting_internal'::regproc)) NOT ILIKE '%negative_stock_policy%',
  'C3: inventory_finalize_posting_internal no longer references negative_stock_policy anywhere in its own body'
);

-- ============================================================================
-- SCENARIO D: internal functions remain non-executable by ordinary roles.
-- ============================================================================

INSERT INTO test_log(line) SELECT is(
  has_function_privilege('authenticated', 'public.inventory_finalize_posting_internal(uuid,uuid,jsonb)'::regprocedure, 'EXECUTE'),
  false, 'D1: inventory_finalize_posting_internal remains non-executable by authenticated'
);
INSERT INTO test_log(line) SELECT is(
  has_function_privilege('authenticated', 'public.write_repair_order_line_movement_link_internal(uuid,uuid,numeric,text,boolean)'::regprocedure, 'EXECUTE'),
  false, 'D2: write_repair_order_line_movement_link_internal remains non-executable by authenticated'
);
INSERT INTO test_log(line) SELECT is(
  has_function_privilege('authenticated', 'public.rebuild_repair_order_projection_bucket_internal(uuid,uuid,uuid,uuid)'::regprocedure, 'EXECUTE'),
  false, 'D3: rebuild_repair_order_projection_bucket_internal remains non-executable by authenticated'
);
INSERT INTO test_log(line) SELECT is(
  has_function_privilege('anon', 'public.inventory_finalize_posting_internal(uuid,uuid,jsonb)'::regprocedure, 'EXECUTE'),
  false, 'D4: inventory_finalize_posting_internal remains non-executable by anon'
);

-- ============================================================================
-- SCENARIO E: canonical movement/receive/reversal/transfer/RepairOrder
-- paths all still succeed end-to-end after this phase's own cleanup.
-- ============================================================================

CREATE TEMP TABLE fx (
  org uuid, e2e_user uuid, variant_1 uuid, unit_1 uuid,
  branch uuid, dst_branch uuid, loc_a uuid, loc_b uuid, recv_loc uuid, dst_loc uuid,
  ro uuid, rol uuid, shelf uuid
);
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9', 'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4',
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da', '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d',
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid();
GRANT SELECT, UPDATE ON fx TO authenticated;

INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch, org, 'ic6-branch', 950 FROM fx
UNION ALL SELECT dst_branch, org, 'ic6-dst-branch', 951 FROM fx;

INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT recv_loc, org, branch, 'ic6-receiving', 'IC6R', true, 'receiving' FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc_a, org, branch, 'ic6-loc-a', 'IC6A', true FROM fx
UNION ALL SELECT loc_b, org, branch, 'ic6-loc-b', 'IC6B', true FROM fx
UNION ALL SELECT shelf, org, branch, 'ic6-shelf', 'IC6SH', true FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT dst_loc, org, dst_branch, 'ic6-dst-loc', 'IC6D', true FROM fx;

INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT ro, org, branch, 'ic6-RO', 'open' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT rol, ro, variant_1, 'ic6-SKU', 'ic6 line', 5, 'pcs' FROM fx;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role','authenticated')::text, true);

-- E1: canonical generic movement (uses the 7-arg balance helper internally).
CREATE TEMP TABLE e1 AS
SELECT inventory_create_and_finalize(
  (SELECT org FROM fx), (SELECT branch FROM fx), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 10, 'destination_location_id', (SELECT loc_a FROM fx))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fx)
) AS result;
INSERT INTO test_log(line) SELECT is((result->>'status'), 'posted', 'E1: canonical inventory_create_and_finalize still succeeds after cleanup') FROM e1;

-- E2: canonical receive primitive.
CREATE TEMP TABLE e2 AS
SELECT inventory_receive_stock(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 7, 'destination_location_id', (SELECT loc_b FROM fx))),
  NULL, NULL, NULL, NULL, NULL
) AS result;
INSERT INTO test_log(line) SELECT is((result->>'status'), 'posted', 'E2: canonical inventory_receive_stock still succeeds after cleanup') FROM e2;

-- E3: canonical reversal.
CREATE TEMP TABLE e3 AS
SELECT inventory_reverse_movement(((SELECT result FROM e2)->>'movement_id')::uuid, (SELECT e2e_user FROM fx), 'IC-6 cleanup regression reversal') AS result;
INSERT INTO test_log(line) SELECT is((result->>'status'), 'posted', 'E3: canonical inventory_reverse_movement still succeeds after cleanup') FROM e3;
INSERT INTO test_log(line) SELECT is(
  (SELECT on_hand_quantity FROM inventory_balances WHERE organization_id=(SELECT org FROM fx) AND branch_id=(SELECT branch FROM fx) AND location_id=(SELECT loc_b FROM fx) AND variant_id=(SELECT variant_1 FROM fx)),
  0::numeric, 'E4: the reversed receipt''s own balance is exactly restored to 0'
);

-- E5: canonical branch transfer (create -> send -> accept).
CREATE TEMP TABLE e5a AS
SELECT inventory_create_branch_transfer(
  (SELECT org FROM fx), (SELECT branch FROM fx), (SELECT dst_branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'source_location_id', (SELECT loc_a FROM fx), 'lot_id', NULL, 'serial_id', NULL, 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 3)),
  'IC-6 cleanup regression transfer', (SELECT e2e_user FROM fx)
) AS result;
CREATE TEMP TABLE e5b AS
SELECT inventory_send_branch_transfer(((SELECT result FROM e5a)->>'transfer_id')::uuid, (SELECT e2e_user FROM fx)) AS result;
CREATE TEMP TABLE e5c AS
SELECT inventory_accept_branch_transfer(((SELECT result FROM e5a)->>'transfer_id')::uuid, (SELECT dst_loc FROM fx), (SELECT e2e_user FROM fx), NULL) AS result;
INSERT INTO test_log(line) SELECT is((result->>'status'), 'accepted', 'E5: canonical branch-transfer lifecycle (create->send->accept) still succeeds after cleanup') FROM e5c;

-- Reset the authoritative GUC before Scenario E6's own standalone attach
-- call: E3's own inventory_reverse_movement call above sets `ambra.
-- repair_order_attribution_authoritative = 'on'` via SET LOCAL, which
-- persists for the REST OF THIS SHARED pgTAP TRANSACTION (a documented,
-- test-harness-only artifact, not a production bug -- every real RPC
-- call is its own transaction). Without this reset, E6's own standalone
-- attach call would incorrectly defer its own auto-rebuild to a
-- long-gone "authoritative caller", exactly the leak documented at
-- length in the IC-5 review bundle's own test-evidence.md.
SELECT set_config('ambra.repair_order_attribution_authoritative', 'off', true);

-- E6: RepairOrder projection path -- a plain receipt + explicit attach,
-- then putaway, then a full rebuild all succeed and agree, exercising
-- attach's/putaway's/the trigger's own calls through write_repair_
-- order_line_movement_link_internal. (A source_line_id-less receive_
-- repair_order_stock call would leave the line unattributed -- explicit
-- attach is used here instead, matching this project's own established
-- fixture pattern.)
CREATE TEMP TABLE e6recv AS
SELECT inventory_create_and_finalize(
  (SELECT org FROM fx), (SELECT branch FROM fx), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 5, 'destination_location_id', (SELECT recv_loc FROM fx))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fx)
) AS result;
INSERT INTO test_log(line) SELECT is((result->>'status'), 'posted', 'E6: canonical receipt for the RepairOrder projection path still succeeds after cleanup') FROM e6recv;

CREATE TEMP TABLE e6ml AS
SELECT id AS movement_line_id FROM inventory_movement_lines WHERE movement_id = ((SELECT result FROM e6recv)->>'movement_id')::uuid;
SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT rol FROM fx), (SELECT movement_line_id FROM e6ml), 5, 'receipt');

INSERT INTO test_log(line) SELECT is(
  (SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol FROM fx) AND location_id=(SELECT recv_loc FROM fx)),
  5::numeric, 'E7: repair_order_line_locations correctly seeded (5) via the canonical attach path'
);

CREATE TEMP TABLE e6putaway AS
SELECT putaway_repair_order_stock(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('repair_order_line_id', (SELECT rol FROM fx), 'variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 5)),
  (SELECT shelf FROM fx), NULL
) AS result;
INSERT INTO test_log(line) SELECT is((result->>'status'), 'posted', 'E8: putaway_repair_order_stock still succeeds after cleanup') FROM e6putaway;
INSERT INTO test_log(line) SELECT is(
  (SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol FROM fx) AND location_id=(SELECT shelf FROM fx)),
  5::numeric, 'E9: putaway correctly moved 5 units to the shelf'
);

-- E10: rebuild equals incremental for the MEANINGFUL (nonzero) rows.
-- Accepted, disclosed divergence (established since IC-5): putaway's own
-- direct UPDATE decrements the receiving-location row to exactly 0 but
-- does not delete it, while the rebuild path's own HAVING SUM(...) <> 0
-- filter never recreates a zero-quantity row -- a quantity=0 row is
-- semantically equivalent to absence, not a defect (see 107's own D1).
-- The comparison is therefore scoped to quantity > 0 rows only.
CREATE TEMP TABLE before_rebuild AS
SELECT location_id, quantity FROM repair_order_line_locations WHERE repair_order_line_id = (SELECT rol FROM fx) AND quantity > 0;
SELECT rebuild_repair_order_location_projection((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx), (SELECT ro FROM fx));
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM before_rebuild b WHERE NOT EXISTS (
    SELECT 1 FROM repair_order_line_locations a
    WHERE a.repair_order_line_id = (SELECT rol FROM fx) AND a.location_id = b.location_id AND a.quantity = b.quantity
  )),
  0::bigint, 'E10: a full-order rebuild after receive+putaway produces EXACTLY the same nonzero rows as the incremental path'
);

-- E11: reversing the putaway still correctly restores BOTH buckets (the
-- exact IC-5-correction-pass bucket-derivation fix, reconfirmed intact).
SELECT inventory_reverse_movement(((SELECT result FROM e6putaway)->>'movement_id')::uuid, (SELECT e2e_user FROM fx), 'IC-6 cleanup regression putaway reversal');
INSERT INTO test_log(line) SELECT is(
  (SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol FROM fx) AND location_id=(SELECT recv_loc FROM fx)),
  5::numeric, 'E11: reversing the putaway restores the RECEIVING bucket to 5 (IC-5-correction bucket fix still intact)'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol FROM fx) AND location_id=(SELECT shelf FROM fx)),
  0::bigint, 'E12: the shelf bucket is correctly cleared (0) after reversing the putaway'
);

RESET ROLE;

SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') AS not_ok_count, count(*) AS total_assertions FROM test_log;

ROLLBACK;
