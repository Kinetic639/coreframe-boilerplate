-- ============================================================================
-- TEST: IC-5 -- RepairOrder Physical Projection Consolidation
-- ============================================================================
-- Proves repair_order_line_locations (+ repair_order_location_attribution_
-- uncertain) is now a genuinely DERIVED projection of canonical physical
-- history (inventory_stock_ledger_entries) + canonical business
-- attribution (repair_order_line_movement_links) -- reversal-aware,
-- rebuildable, deterministic, never negative, never guessing.
--
-- Does NOT re-prove IC-0/1/2/3/4/7A's own business logic -- that is
-- 097-106's own job, re-run unmodified as part of this pass's own full
-- regression. Does NOT reopen the accepted receive/putaway contracts;
-- both are exercised here exactly as they already existed.
--
-- Executed live against supabase-target via psql.

BEGIN;

SELECT plan(46);

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

SET LOCAL ambra.inventory_movement_engine = 'on';

CREATE TEMP TABLE fx (
  org uuid, e2e_user uuid, variant_1 uuid, unit_1 uuid,
  branch uuid, ro uuid,
  rol_a uuid, rol_b uuid, rol_c uuid, rol_d uuid,
  recv_loc uuid, shelf_a uuid, shelf_b uuid
);
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9', 'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4',
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da', '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d',
  gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid();
GRANT SELECT ON fx TO authenticated;

INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch, org, 'ic5-branch', 810 FROM fx;

INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT recv_loc, org, branch, 'ic5-receiving', 'IC5R', true, 'receiving' FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT shelf_a, org, branch, 'ic5-shelf-a', 'IC5A', true FROM fx
UNION ALL SELECT shelf_b, org, branch, 'ic5-shelf-b', 'IC5B', true FROM fx;

INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT ro, org, branch, 'ic5-RO', 'open' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT rol_a, ro, variant_1, 'ic5-SKU', 'ic5 line A', 6, 'pcs' FROM fx
UNION ALL SELECT rol_b, ro, variant_1, 'ic5-SKU', 'ic5 line B (same SKU as A)', 4, 'pcs' FROM fx
UNION ALL SELECT rol_c, ro, variant_1, 'ic5-SKU', 'ic5 line C', 5, 'pcs' FROM fx
UNION ALL SELECT rol_d, ro, variant_1, 'ic5-SKU', 'ic5 line D', 3, 'pcs' FROM fx;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role','authenticated')::text, true);

-- ============================================================================
-- SCENARIO A/B: known receipt, split across two same-SKU lines (6+4=10).
-- ============================================================================

CREATE TEMP TABLE recv_ab AS
SELECT inventory_create_and_finalize(
  org, branch, '101',
  jsonb_build_array(jsonb_build_object('variant_id', variant_1, 'unit_id', unit_1, 'quantity', 10, 'destination_location_id', recv_loc)),
  NULL, NULL, NULL, NULL, NULL, NULL, e2e_user
) AS result FROM fx;

CREATE TEMP TABLE ml_ab AS
SELECT id AS movement_line_id FROM inventory_movement_lines
WHERE movement_id = (SELECT (result->>'movement_id')::uuid FROM recv_ab);

SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT rol_a FROM fx), (SELECT movement_line_id FROM ml_ab), 6, 'receipt');
SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT rol_b FROM fx), (SELECT movement_line_id FROM ml_ab), 4, 'receipt');

INSERT INTO test_log(line) SELECT is((SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol_a FROM fx)), 6::numeric, 'A1: line A known receipt = 6, auto-synced by attach') FROM fx LIMIT 1;
INSERT INTO test_log(line) SELECT is((SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol_b FROM fx)), 4::numeric, 'B1: same-SKU line B independently = 4, never merged into A') FROM fx LIMIT 1;
INSERT INTO test_log(line) SELECT ok(NOT EXISTS (SELECT 1 FROM repair_order_location_attribution_uncertain WHERE location_id=(SELECT recv_loc FROM fx) AND variant_id=(SELECT variant_1 FROM fx)), 'A2: fully-attributed bucket (6+4=10=physical) carries no UNKNOWN marker') FROM fx LIMIT 1;

-- ============================================================================
-- SCENARIO C: one RepairOrderLine across multiple locations (putaway split).
-- ============================================================================

-- Give line A its own dedicated receipt (5 units) so putaway math is clean.
CREATE TEMP TABLE recv_c AS
SELECT inventory_create_and_finalize(
  org, branch, '101',
  jsonb_build_array(jsonb_build_object('variant_id', variant_1, 'unit_id', unit_1, 'quantity', 5, 'destination_location_id', recv_loc)),
  NULL, NULL, NULL, NULL, NULL, NULL, e2e_user
) AS result FROM fx;
CREATE TEMP TABLE ml_c AS SELECT id AS movement_line_id FROM inventory_movement_lines WHERE movement_id=(SELECT (result->>'movement_id')::uuid FROM recv_c);
SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT rol_c FROM fx), (SELECT movement_line_id FROM ml_c), 5, 'receipt');

INSERT INTO test_log(line) SELECT is((SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol_c FROM fx)), 5::numeric, 'C0: line C known receipt = 5 before putaway') FROM fx LIMIT 1;

-- SCENARIO D: full putaway of 5 to shelf-a.
CREATE TEMP TABLE putaway_d AS
SELECT putaway_repair_order_stock(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('repair_order_line_id', (SELECT rol_c FROM fx), 'variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 5)),
  (SELECT shelf_a FROM fx), NULL
) AS result;

-- putaway's own direct UPDATE decrements to exactly 0 but does not
-- delete the row (unchanged, accepted, pre-existing putaway behavior) --
-- a 0-quantity row is semantically equivalent to absence, not a defect.
INSERT INTO test_log(line) SELECT is((SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol_c FROM fx) AND location_id=(SELECT recv_loc FROM fx)), 0::numeric, 'D1: receiving-location row for line C reaches exactly 0 after full putaway') FROM fx LIMIT 1;
INSERT INTO test_log(line) SELECT is((SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol_c FROM fx) AND location_id=(SELECT shelf_a FROM fx)), 5::numeric, 'D2: shelf-a now holds line C''s own 5 units') FROM fx LIMIT 1;

-- NOTE: putaway_repair_order_stock's own source is always the branch's
-- receiving location by design (unchanged, accepted Zone-5 contract) --
-- a true shelf-to-shelf relocation is outside its own contract, so
-- multi-location independence is proven directly below instead.
-- Multi-location independence proven directly instead: line C's own shelf-a
-- contribution (5) is wholly distinct from line A's own receiving-location
-- contribution (6) and line D's own (below) -- verified via a fresh rebuild
-- of BOTH buckets showing exactly their own expected values, unaffected by
-- each other.
SELECT rebuild_repair_order_location_projection((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx), (SELECT ro FROM fx));
INSERT INTO test_log(line) SELECT is((SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol_c FROM fx) AND location_id=(SELECT shelf_a FROM fx)), 5::numeric, 'C1: line C''s shelf-a contribution (5) survives a full projection rebuild unchanged') FROM fx LIMIT 1;
INSERT INTO test_log(line) SELECT is((SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol_a FROM fx) AND location_id=(SELECT recv_loc FROM fx)), 6::numeric, 'C2: line A''s own receiving-location contribution (6) is untouched by line C''s own putaway activity') FROM fx LIMIT 1;

-- Reset the authoritative GUC (is_local=true, so it otherwise persists
-- for the rest of THIS shared pgTAP transaction, not merely for
-- putaway_d's own call -- a real production call is always its own
-- transaction, so this reset has no counterpart there). Without this,
-- the standalone attach call below would incorrectly defer to a
-- long-gone "authoritative caller".
SELECT set_config('ambra.repair_order_attribution_authoritative', 'off', true);

-- SCENARIO E: genuine partial putaway -- give line D its own receipt, putaway only part of it.
CREATE TEMP TABLE recv_e AS
SELECT inventory_create_and_finalize(
  org, branch, '101',
  jsonb_build_array(jsonb_build_object('variant_id', variant_1, 'unit_id', unit_1, 'quantity', 3, 'destination_location_id', recv_loc)),
  NULL, NULL, NULL, NULL, NULL, NULL, e2e_user
) AS result FROM fx;
CREATE TEMP TABLE ml_e AS SELECT id AS movement_line_id FROM inventory_movement_lines WHERE movement_id=(SELECT (result->>'movement_id')::uuid FROM recv_e);
SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT rol_d FROM fx), (SELECT movement_line_id FROM ml_e), 3, 'receipt');

CREATE TEMP TABLE putaway_e2 AS
SELECT putaway_repair_order_stock(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('repair_order_line_id', (SELECT rol_d FROM fx), 'variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 1)),
  (SELECT shelf_b FROM fx), NULL
) AS result;

INSERT INTO test_log(line) SELECT is((SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol_d FROM fx) AND location_id=(SELECT recv_loc FROM fx)), 2::numeric, 'E1: partial putaway -- receiving location retains the remaining 2 of line D''s own 3') FROM fx LIMIT 1;
INSERT INTO test_log(line) SELECT is((SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol_d FROM fx) AND location_id=(SELECT shelf_b FROM fx)), 1::numeric, 'E2: partial putaway -- shelf-b receives exactly the moved 1') FROM fx LIMIT 1;

-- Reset again (see the comment above Scenario E) -- E's own putaway call
-- above re-set it to 'on' for the rest of this shared transaction.
SELECT set_config('ambra.repair_order_attribution_authoritative', 'off', true);

-- ============================================================================
-- SCENARIO F: attributed movement reversal -- projection goes to zero.
-- ============================================================================

CREATE TEMP TABLE recv_f AS
SELECT inventory_create_and_finalize(
  org, branch, '101',
  jsonb_build_array(jsonb_build_object('variant_id', variant_1, 'unit_id', unit_1, 'quantity', 7, 'destination_location_id', recv_loc)),
  NULL, NULL, NULL, NULL, NULL, NULL, e2e_user
) AS result FROM fx;

CREATE TEMP TABLE fline_f AS
SELECT gen_random_uuid() AS rol_f;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT rol_f, (SELECT ro FROM fx), (SELECT variant_1 FROM fx), 'ic5-SKU', 'ic5 line F', 7, 'pcs' FROM fline_f;

CREATE TEMP TABLE ml_f AS SELECT id AS movement_line_id FROM inventory_movement_lines WHERE movement_id=(SELECT (result->>'movement_id')::uuid FROM recv_f);
SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT rol_f FROM fline_f), (SELECT movement_line_id FROM ml_f), 7, 'receipt');

INSERT INTO test_log(line) SELECT is((SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol_f FROM fline_f)), 7::numeric, 'F1: line F known receipt = 7 before reversal') FROM fx LIMIT 1;

SELECT inventory_reverse_movement((SELECT (result->>'movement_id')::uuid FROM recv_f), (SELECT e2e_user FROM fx), 'IC-5 reversal test F');

INSERT INTO test_log(line) SELECT is(count(*), 0::bigint, 'F2: line F projection row fully cleared after reversing its own only contribution') FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol_f FROM fline_f);
INSERT INTO test_log(line) SELECT is(count(*), 1::bigint, 'F3: exactly one reversal-typed attribution link was written, mirroring the original receipt') FROM repair_order_line_movement_links WHERE relation_type='reversal' AND repair_order_line_id=(SELECT rol_f FROM fline_f);

-- ============================================================================
-- SCENARIO G: split-attribution reversal -- both lines' contributions removed exactly.
-- ============================================================================

CREATE TEMP TABLE recv_g AS
SELECT inventory_create_and_finalize(
  org, branch, '101',
  jsonb_build_array(jsonb_build_object('variant_id', variant_1, 'unit_id', unit_1, 'quantity', 10, 'destination_location_id', recv_loc)),
  NULL, NULL, NULL, NULL, NULL, NULL, e2e_user
) AS result FROM fx;
CREATE TEMP TABLE gline_g AS
SELECT gen_random_uuid() AS rol_g1, gen_random_uuid() AS rol_g2;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT rol_g1, (SELECT ro FROM fx), (SELECT variant_1 FROM fx), 'ic5-SKU', 'ic5 line G1', 6, 'pcs' FROM gline_g
UNION ALL SELECT rol_g2, (SELECT ro FROM fx), (SELECT variant_1 FROM fx), 'ic5-SKU', 'ic5 line G2', 4, 'pcs' FROM gline_g;

CREATE TEMP TABLE ml_g AS SELECT id AS movement_line_id FROM inventory_movement_lines WHERE movement_id=(SELECT (result->>'movement_id')::uuid FROM recv_g);
SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT rol_g1 FROM gline_g), (SELECT movement_line_id FROM ml_g), 6, 'receipt');
SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT rol_g2 FROM gline_g), (SELECT movement_line_id FROM ml_g), 4, 'receipt');

SELECT inventory_reverse_movement((SELECT (result->>'movement_id')::uuid FROM recv_g), (SELECT e2e_user FROM fx), 'IC-5 split reversal test G');

INSERT INTO test_log(line) SELECT is(count(*), 0::bigint, 'G1: line G1 (was 6) fully cleared by split-attribution reversal') FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol_g1 FROM gline_g);
INSERT INTO test_log(line) SELECT is(count(*), 0::bigint, 'G2: line G2 (was 4) fully cleared by split-attribution reversal') FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol_g2 FROM gline_g);
INSERT INTO test_log(line) SELECT is((SELECT applied_quantity FROM repair_order_line_movement_links WHERE relation_type='reversal' AND repair_order_line_id=(SELECT rol_g1 FROM gline_g)), 6::numeric, 'G3: G1''s own reversal link carries exactly its own original 6, never the whole 10') FROM fx LIMIT 1;
INSERT INTO test_log(line) SELECT is((SELECT applied_quantity FROM repair_order_line_movement_links WHERE relation_type='reversal' AND repair_order_line_id=(SELECT rol_g2 FROM gline_g)), 4::numeric, 'G4: G2''s own reversal link carries exactly its own original 4, never merged with G1''s') FROM fx LIMIT 1;

-- ============================================================================
-- SCENARIO H: UNKNOWN source -- putaway hard-rejected, never guessed.
-- ============================================================================

-- The authoritative GUC (set by the earlier putaway/reversal calls above)
-- is is_local=true -- scoped to the rest of THIS TRANSACTION, not merely
-- to the statement/call that set it (this pgTAP file's own single shared
-- transaction is a test-harness artifact; a real production call is
-- always its own transaction, so this leak cannot occur there). Reset
-- explicitly so Scenario H's own generic (non-RepairOrder-aware)
-- movements correctly exercise the trigger's own inference path.
SELECT set_config('ambra.repair_order_attribution_authoritative', 'off', true);

CREATE TEMP TABLE hfx AS SELECT gen_random_uuid() AS h_branch, gen_random_uuid() AS h_recv, gen_random_uuid() AS h_shelf, gen_random_uuid() AS h_rol;
GRANT SELECT ON hfx TO authenticated;
INSERT INTO branches (id, organization_id, name, branch_number) SELECT h_branch, (SELECT org FROM fx), 'ic5-h-branch', 811 FROM hfx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT h_recv, (SELECT org FROM fx), h_branch, 'ic5-h-recv', 'IC5H1', true, 'receiving' FROM hfx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT h_shelf, (SELECT org FROM fx), h_branch, 'ic5-h-shelf', 'IC5H2', true FROM hfx;
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT gen_random_uuid(), (SELECT org FROM fx), h_branch, 'ic5-h-RO', 'open' FROM hfx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT h_rol, (SELECT id FROM repair_orders WHERE branch_id = h_branch), (SELECT variant_1 FROM fx), 'ic5-SKU', 'ic5 line H', 4, 'pcs' FROM hfx;

-- To reach genuine UNKNOWN, first establish a known contribution (1 unit,
-- attributed to line H), then let an unattributed generic surplus and a
-- generic decrease make the bucket ambiguous -- the original design's
-- own established way of proving uncertainty.
CREATE TEMP TABLE recv_h AS
SELECT inventory_create_and_finalize((SELECT org FROM fx), (SELECT h_branch FROM hfx), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 1, 'destination_location_id', (SELECT h_recv FROM hfx))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fx)) AS result;

CREATE TEMP TABLE hml AS SELECT id AS movement_line_id FROM inventory_movement_lines
WHERE movement_id = (SELECT (result->>'movement_id')::uuid FROM recv_h);
SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT h_rol FROM hfx), (SELECT movement_line_id FROM hml), 1, 'receipt');

-- Now a SEPARATE generic surplus (401) lands 3 more units in the SAME
-- bucket without any attribution -- attach only covers the original 1,
-- so a generic decrease afterward cannot confidently prove which units
-- are whose. Force the ambiguity by adding unattributed physical stock,
-- then draining part of the bucket generically.
SELECT inventory_create_and_finalize((SELECT org FROM fx), (SELECT h_branch FROM hfx), '401',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 3, 'destination_location_id', (SELECT h_recv FROM hfx))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fx));

SELECT inventory_create_and_finalize((SELECT org FROM fx), (SELECT h_branch FROM hfx), '402',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 2, 'source_location_id', (SELECT h_recv FROM hfx))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fx));

INSERT INTO test_log(line) SELECT ok(EXISTS (SELECT 1 FROM repair_order_location_attribution_uncertain WHERE location_id=(SELECT h_recv FROM hfx) AND variant_id=(SELECT variant_1 FROM fx)), 'H1: an ambiguous generic decrease against a partially-attributed bucket marks it UNKNOWN, never guessed') FROM hfx LIMIT 1;

DO $$
DECLARE v_state text;
BEGIN
  BEGIN
    PERFORM putaway_repair_order_stock(
      (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT h_branch FROM hfx),
      jsonb_build_array(jsonb_build_object('repair_order_line_id', (SELECT h_rol FROM hfx), 'variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 1)),
      (SELECT h_shelf FROM hfx), NULL
    );
    INSERT INTO test_log(line) SELECT fail('H2: expected UNKNOWN-source putaway rejection, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, '55000', 'H2: putaway from an UNKNOWN-marked receiving bucket is hard-rejected (55000), accepted Zone-5 semantics preserved');
  END;
END;
$$;

-- ============================================================================
-- SCENARIO I: destination UNKNOWN stickiness -- known contribution moving
-- into an already-UNKNOWN destination does not clear the marker.
-- ============================================================================

CREATE TEMP TABLE ifx AS SELECT gen_random_uuid() AS i_branch, gen_random_uuid() AS i_loc_x;
GRANT SELECT ON ifx TO authenticated;
INSERT INTO branches (id, organization_id, name, branch_number) SELECT i_branch, (SELECT org FROM fx), 'ic5-i-branch', 812 FROM ifx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT i_loc_x, (SELECT org FROM fx), i_branch, 'ic5-i-locX', 'IC5I', true, 'receiving' FROM ifx;

-- Manually seed Location X as UNKNOWN (simulating a prior ambiguous event)
-- by directly invoking the internal rebuild against a bucket with physical
-- stock but zero attribution -- deterministic, not a raw-write bypass
-- (invoked here as the connecting/superuser role for fixture setup only).
RESET ROLE;
-- PRE-IC8 P0 note: the balance guard now enforces zero-quantity-only
-- INSERTs (matching inventory_get_or_create_balance_for_update's own
-- shape) -- split into a zero-quantity insert followed by a
-- physical-shape-only on_hand update.
SET LOCAL ambra.inventory_movement_engine = 'on';
INSERT INTO inventory_balances (organization_id, branch_id, location_id, variant_id, on_hand_quantity, reserved_quantity, allocated_quantity)
SELECT (SELECT org FROM fx), i_branch, i_loc_x, (SELECT variant_1 FROM fx), 0, 0, 0 FROM ifx;
UPDATE inventory_balances SET on_hand_quantity = 5
WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT i_branch FROM ifx)
  AND location_id = (SELECT i_loc_x FROM ifx) AND variant_id = (SELECT variant_1 FROM fx);
SELECT rebuild_repair_order_projection_bucket_internal((SELECT org FROM fx), (SELECT i_branch FROM ifx), (SELECT i_loc_x FROM ifx), (SELECT variant_1 FROM fx));
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role','authenticated')::text, true);

INSERT INTO test_log(line) SELECT ok(EXISTS (SELECT 1 FROM repair_order_location_attribution_uncertain WHERE location_id=(SELECT i_loc_x FROM ifx) AND variant_id=(SELECT variant_1 FROM fx)), 'I1: fixture bucket correctly starts UNKNOWN (5 physical, 0 attributed)') FROM ifx LIMIT 1;

-- Now attribute 2 of that SAME bucket's stock via a fresh receipt +
-- attach landing at the SAME location -- rebuild recomputes: known=2,
-- physical=7 (5+2), still short by 5 -- UNKNOWN must remain.
SELECT inventory_create_and_finalize((SELECT org FROM fx), (SELECT i_branch FROM ifx), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 2, 'destination_location_id', (SELECT i_loc_x FROM ifx))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fx));
CREATE TEMP TABLE iml AS SELECT id AS movement_line_id FROM inventory_movement_lines
WHERE movement_id = (SELECT id FROM inventory_movement_headers WHERE branch_id=(SELECT i_branch FROM ifx) ORDER BY created_at DESC LIMIT 1);
CREATE TEMP TABLE irol AS SELECT gen_random_uuid() AS rol_i;
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT gen_random_uuid(), (SELECT org FROM fx), (SELECT i_branch FROM ifx), 'ic5-i-RO', 'open';
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT rol_i, (SELECT id FROM repair_orders WHERE branch_id = (SELECT i_branch FROM ifx)), (SELECT variant_1 FROM fx), 'ic5-SKU', 'ic5 line I', 2, 'pcs' FROM irol;
SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT rol_i FROM irol), (SELECT movement_line_id FROM iml), 2, 'receipt');

INSERT INTO test_log(line) SELECT is((SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol_i FROM irol)), 2::numeric, 'I2: the new known contribution (2) IS represented at the destination bucket') FROM fx LIMIT 1;
INSERT INTO test_log(line) SELECT ok(EXISTS (SELECT 1 FROM repair_order_location_attribution_uncertain WHERE location_id=(SELECT i_loc_x FROM ifx) AND variant_id=(SELECT variant_1 FROM fx)), 'I3: the bucket''s own UNKNOWN marker is STILL present -- a known contribution never silently clears sticky uncertainty') FROM fx LIMIT 1;

-- ============================================================================
-- SCENARIO J: partial attribution / unattributed remainder.
-- ============================================================================

CREATE TEMP TABLE jfx AS SELECT gen_random_uuid() AS j_branch, gen_random_uuid() AS j_loc, gen_random_uuid() AS j_rol;
GRANT SELECT ON jfx TO authenticated;
INSERT INTO branches (id, organization_id, name, branch_number) SELECT j_branch, (SELECT org FROM fx), 'ic5-j-branch', 813 FROM jfx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT j_loc, (SELECT org FROM fx), j_branch, 'ic5-j-loc', 'IC5J', true, 'receiving' FROM jfx;
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT gen_random_uuid(), (SELECT org FROM fx), j_branch, 'ic5-j-RO', 'open' FROM jfx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT j_rol, (SELECT id FROM repair_orders WHERE branch_id = j_branch), (SELECT variant_1 FROM fx), 'ic5-SKU', 'ic5 line J', 6, 'pcs' FROM jfx;

SELECT inventory_create_and_finalize((SELECT org FROM fx), (SELECT j_branch FROM jfx), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 10, 'destination_location_id', (SELECT j_loc FROM jfx))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fx));
CREATE TEMP TABLE jml AS SELECT id AS movement_line_id FROM inventory_movement_lines
WHERE movement_id = (SELECT id FROM inventory_movement_headers WHERE branch_id=(SELECT j_branch FROM jfx) ORDER BY created_at DESC LIMIT 1);

-- Only 6 of the 10 physical units are attributed; the remaining 4 are
-- never claimed by any RepairOrderLine. attach_repair_order_line_movement
-- already triggers its own rebuild internally (IC-5 fix) -- no separate
-- call needed.
SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT j_rol FROM jfx), (SELECT movement_line_id FROM jml), 6, 'receipt');

INSERT INTO test_log(line) SELECT is((SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT j_rol FROM jfx)), 6::numeric, 'J1: line J claims exactly its own attributed 6, never the whole 10') FROM jfx LIMIT 1;
INSERT INTO test_log(line) SELECT ok(EXISTS (SELECT 1 FROM repair_order_location_attribution_uncertain WHERE location_id=(SELECT j_loc FROM jfx) AND variant_id=(SELECT variant_1 FROM fx)), 'J2: the unattributed remainder (4) is represented as UNKNOWN at the bucket, not silently dropped or assigned to line J') FROM jfx LIMIT 1;

-- ============================================================================
-- SCENARIO K/L: rebuild equals incremental result, and is idempotent.
-- ============================================================================

CREATE TEMP TABLE before_kl AS
SELECT repair_order_line_id, location_id, quantity FROM repair_order_line_locations
WHERE repair_order_line_id IN ((SELECT rol_a FROM fx), (SELECT rol_b FROM fx), (SELECT rol_c FROM fx));

SELECT rebuild_repair_order_location_projection((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx), (SELECT ro FROM fx));

CREATE TEMP TABLE after_kl AS
SELECT repair_order_line_id, location_id, quantity FROM repair_order_line_locations
WHERE repair_order_line_id IN ((SELECT rol_a FROM fx), (SELECT rol_b FROM fx), (SELECT rol_c FROM fx));

INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM before_kl b WHERE NOT EXISTS (SELECT 1 FROM after_kl a WHERE a.repair_order_line_id=b.repair_order_line_id AND a.location_id=b.location_id AND a.quantity=b.quantity)),
  0::bigint, 'K1: a full RepairOrder rebuild produces EXACTLY the same known rows the incremental path already established'
);

-- Idempotency: rebuild again, compare once more.
SELECT rebuild_repair_order_location_projection((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx), (SELECT ro FROM fx));
CREATE TEMP TABLE after_kl2 AS
SELECT repair_order_line_id, location_id, quantity FROM repair_order_line_locations
WHERE repair_order_line_id IN ((SELECT rol_a FROM fx), (SELECT rol_b FROM fx), (SELECT rol_c FROM fx));
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM after_kl b WHERE NOT EXISTS (SELECT 1 FROM after_kl2 a WHERE a.repair_order_line_id=b.repair_order_line_id AND a.location_id=b.location_id AND a.quantity=b.quantity)),
  0::bigint, 'L1: rebuilding the SAME RepairOrder a second time is idempotent -- byte-identical result'
);

-- ============================================================================
-- SCENARIO M: direct raw-write denial on both projection tables.
-- ============================================================================

DO $$
DECLARE v_ok boolean;
BEGIN
  v_ok := false;
  BEGIN
    INSERT INTO repair_order_line_locations (organization_id, branch_id, repair_order_id, repair_order_line_id, variant_id, location_id, quantity)
    SELECT org, branch, ro, rol_a, variant_1, recv_loc, 999 FROM fx;
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_ok := false; END;
  INSERT INTO test_log(line) SELECT is(v_ok, false, 'M1: raw INSERT into repair_order_line_locations denied for authenticated');

  v_ok := false;
  BEGIN
    INSERT INTO repair_order_location_attribution_uncertain (organization_id, branch_id, location_id, variant_id)
    SELECT org, branch, recv_loc, variant_1 FROM fx;
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_ok := false; END;
  INSERT INTO test_log(line) SELECT is(v_ok, false, 'M2: raw INSERT into repair_order_location_attribution_uncertain denied for authenticated');
END;
$$;

-- ============================================================================
-- SCENARIO N: cross-org/branch isolation on the rebuild RPC.
-- ============================================================================

DO $$
DECLARE v_state text;
BEGIN
  BEGIN
    PERFORM rebuild_repair_order_location_projection((SELECT e2e_user FROM fx), gen_random_uuid(), (SELECT branch FROM fx), (SELECT ro FROM fx));
    INSERT INTO test_log(line) SELECT fail('N1: expected cross-org rejection, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, 'P0002', 'N1: a fabricated organization_id is rejected (P0002, no existence leak)');
  END;
END;
$$;

-- ============================================================================
-- SCENARIO O: no negative projection -- rebuild hard-errors rather than clamps.
-- ============================================================================

RESET ROLE;
-- Fabricate a history inconsistency directly (raw superuser write, test
-- setup only): a link claiming MORE than the bucket's own physical
-- on_hand actually holds -- structurally impossible via any real RPC
-- (attach_repair_order_line_movement's own quantity-cap check prevents
-- it), reachable here only by directly corrupting the ledger's own
-- reported quantity for this synthetic probe.
CREATE TEMP TABLE ofx AS SELECT gen_random_uuid() AS o_branch, gen_random_uuid() AS o_loc, gen_random_uuid() AS o_rol;
GRANT SELECT ON ofx TO authenticated;
INSERT INTO branches (id, organization_id, name, branch_number) SELECT o_branch, (SELECT org FROM fx), 'ic5-o-branch', 814 FROM ofx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT o_loc, (SELECT org FROM fx), o_branch, 'ic5-o-loc', 'IC5O', true, 'receiving' FROM ofx;
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT gen_random_uuid(), (SELECT org FROM fx), o_branch, 'ic5-o-RO', 'open' FROM ofx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT o_rol, (SELECT id FROM repair_orders WHERE branch_id = o_branch), (SELECT variant_1 FROM fx), 'ic5-SKU', 'ic5 line O', 2, 'pcs' FROM ofx;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role','authenticated')::text, true);
SELECT inventory_create_and_finalize((SELECT org FROM fx), (SELECT o_branch FROM ofx), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 2, 'destination_location_id', (SELECT o_loc FROM ofx))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fx));
CREATE TEMP TABLE oml AS SELECT id AS movement_line_id FROM inventory_movement_lines
WHERE movement_id = (SELECT id FROM inventory_movement_headers WHERE branch_id=(SELECT o_branch FROM ofx) ORDER BY created_at DESC LIMIT 1);
SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT o_rol FROM ofx), (SELECT movement_line_id FROM oml), 2, 'receipt');

RESET ROLE;
-- Corrupt the physical balance downward directly, simulating a data
-- inconsistency the rebuild must refuse to paper over.
UPDATE inventory_balances SET on_hand_quantity = 0
WHERE organization_id=(SELECT org FROM fx) AND branch_id=(SELECT o_branch FROM ofx)
  AND location_id=(SELECT o_loc FROM ofx) AND variant_id=(SELECT variant_1 FROM fx);

DO $$
DECLARE v_state text;
BEGIN
  BEGIN
    PERFORM rebuild_repair_order_projection_bucket_internal(
      (SELECT org FROM fx), (SELECT o_branch FROM ofx), (SELECT o_loc FROM ofx), (SELECT variant_1 FROM fx)
    );
    INSERT INTO test_log(line) SELECT fail('O1: expected the rebuild to hard-error on an impossible history, it clamped/succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, 'P0008', 'O1: rebuild hard-errors (P0008) on known attribution exceeding physical on_hand -- never silently clamped');
  END;
END;
$$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role','authenticated')::text, true);

-- ============================================================================
-- SCENARIO P: receive/putaway rollback atomicity -- a rejected putaway
-- leaves the projection completely untouched (single transaction).
-- ============================================================================

CREATE TEMP TABLE before_p AS
SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol_d FROM fx) AND location_id=(SELECT recv_loc FROM fx);

DO $$
DECLARE v_state text;
BEGIN
  BEGIN
    -- line D only has 2 remaining at receiving (per Scenario E) -- request 999.
    PERFORM putaway_repair_order_stock(
      (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
      jsonb_build_array(jsonb_build_object('repair_order_line_id', (SELECT rol_d FROM fx), 'variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 999)),
      (SELECT shelf_a FROM fx), NULL
    );
    INSERT INTO test_log(line) SELECT fail('P1: expected the over-quantity putaway to be rejected, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, '22023', 'P1: an over-quantity putaway is rejected atomically (22023)');
  END;
END;
$$;

INSERT INTO test_log(line) SELECT is(
  (SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol_d FROM fx) AND location_id=(SELECT recv_loc FROM fx)),
  (SELECT quantity FROM before_p), 'P2: line D''s own receiving-location quantity is byte-identical after the rejected putaway -- no partial mutation'
);
INSERT INTO test_log(line) SELECT is(count(*), 0::bigint, 'P3: no row was created at shelf-a for line D by the rejected putaway attempt') FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol_d FROM fx) AND location_id=(SELECT shelf_a FROM fx);

-- ============================================================================
-- IC-5 CORRECTION PASS -- Finding A regression coverage.
-- ============================================================================

-- Reset the authoritative GUC before these dedicated scenarios (see the
-- comment above the original Scenario E for why this is needed in a
-- shared pgTAP transaction -- P's own rejected putaway attempt still ran
-- inside a GUC='on' window that could otherwise leak forward).
SELECT set_config('ambra.repair_order_attribution_authoritative', 'off', true);

-- ============================================================================
-- SCENARIO Q: FULL putaway reversal -- both source AND destination
-- buckets must be rebuilt (the exact BLOCKER this correction pass fixes:
-- the old trigger rebuilt the destination bucket twice and never the
-- source/receiving bucket, leaving it stale after reversal).
-- ============================================================================

CREATE TEMP TABLE qfx AS SELECT gen_random_uuid() AS rol_q;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT rol_q, (SELECT ro FROM fx), (SELECT variant_1 FROM fx), 'ic5c-SKU', 'ic5c line Q (full putaway reversal)', 5, 'pcs' FROM qfx;

CREATE TEMP TABLE recv_q AS
SELECT inventory_create_and_finalize(
  org, branch, '101',
  jsonb_build_array(jsonb_build_object('variant_id', variant_1, 'unit_id', unit_1, 'quantity', 5, 'destination_location_id', recv_loc)),
  NULL, NULL, NULL, NULL, NULL, NULL, e2e_user
) AS result FROM fx;
CREATE TEMP TABLE ml_q AS SELECT id AS movement_line_id FROM inventory_movement_lines WHERE movement_id=(SELECT (result->>'movement_id')::uuid FROM recv_q);
SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT rol_q FROM qfx), (SELECT movement_line_id FROM ml_q), 5, 'receipt');

INSERT INTO test_log(line) SELECT is((SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol_q FROM qfx) AND location_id=(SELECT recv_loc FROM fx)), 5::numeric, 'Q0a: line Q known receipt = 5 at Receiving before putaway') FROM fx LIMIT 1;

CREATE TEMP TABLE putaway_q AS
SELECT putaway_repair_order_stock(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('repair_order_line_id', (SELECT rol_q FROM qfx), 'variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 5)),
  (SELECT shelf_a FROM fx), NULL
) AS result;

INSERT INTO test_log(line) SELECT is((SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol_q FROM qfx) AND location_id=(SELECT shelf_a FROM fx)), 5::numeric, 'Q0b: line Q now holds 5 at shelf-a after full putaway') FROM fx LIMIT 1;

SELECT inventory_reverse_movement((SELECT (result->>'movement_id')::uuid FROM putaway_q), (SELECT e2e_user FROM fx), 'IC-5c full putaway reversal test Q');

INSERT INTO test_log(line) SELECT is((SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol_q FROM qfx) AND location_id=(SELECT recv_loc FROM fx)), 5::numeric, 'Q1: after reversing the FULL putaway, Receiving is restored to 5 (the BLOCKER this pass fixes -- source bucket is no longer left stale)') FROM fx LIMIT 1;
INSERT INTO test_log(line) SELECT is(count(*), 0::bigint, 'Q2: shelf-a''s own row for line Q is fully cleared (0) after the reversal') FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol_q FROM qfx) AND location_id=(SELECT shelf_a FROM fx);

CREATE TEMP TABLE before_q_rebuild AS SELECT location_id, quantity FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol_q FROM qfx);
SELECT rebuild_repair_order_location_projection((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx), (SELECT ro FROM fx));
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM before_q_rebuild b WHERE NOT EXISTS (SELECT 1 FROM repair_order_line_locations a WHERE a.repair_order_line_id=(SELECT rol_q FROM qfx) AND a.location_id=b.location_id AND a.quantity=b.quantity)),
  0::bigint, 'Q3: a full-order rebuild after the reversed FULL putaway produces EXACTLY the same result as the incremental post-reversal state'
);

SELECT set_config('ambra.repair_order_attribution_authoritative', 'off', true);

-- ============================================================================
-- SCENARIO R: PARTIAL putaway reversal -- same bucket-derivation fix,
-- proven with a genuine remainder still sitting at Receiving before the
-- putaway (2 of 5), not a full-clear case.
-- ============================================================================

CREATE TEMP TABLE rfx_r AS SELECT gen_random_uuid() AS rol_r;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT rol_r, (SELECT ro FROM fx), (SELECT variant_1 FROM fx), 'ic5c-SKU', 'ic5c line R (partial putaway reversal)', 5, 'pcs' FROM rfx_r;

CREATE TEMP TABLE recv_r_case AS
SELECT inventory_create_and_finalize(
  org, branch, '101',
  jsonb_build_array(jsonb_build_object('variant_id', variant_1, 'unit_id', unit_1, 'quantity', 5, 'destination_location_id', recv_loc)),
  NULL, NULL, NULL, NULL, NULL, NULL, e2e_user
) AS result FROM fx;
CREATE TEMP TABLE ml_r_case AS SELECT id AS movement_line_id FROM inventory_movement_lines WHERE movement_id=(SELECT (result->>'movement_id')::uuid FROM recv_r_case);
SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT rol_r FROM rfx_r), (SELECT movement_line_id FROM ml_r_case), 5, 'receipt');

CREATE TEMP TABLE putaway_r_case AS
SELECT putaway_repair_order_stock(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('repair_order_line_id', (SELECT rol_r FROM rfx_r), 'variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 3)),
  (SELECT shelf_b FROM fx), NULL
) AS result;

INSERT INTO test_log(line) SELECT is((SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol_r FROM rfx_r) AND location_id=(SELECT recv_loc FROM fx)), 2::numeric, 'R0a: before reversal, Receiving retains the remaining 2 of line R''s own 5') FROM fx LIMIT 1;
INSERT INTO test_log(line) SELECT is((SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol_r FROM rfx_r) AND location_id=(SELECT shelf_b FROM fx)), 3::numeric, 'R0b: before reversal, shelf-b holds the moved 3') FROM fx LIMIT 1;

SELECT inventory_reverse_movement((SELECT (result->>'movement_id')::uuid FROM putaway_r_case), (SELECT e2e_user FROM fx), 'IC-5c partial putaway reversal test R');

INSERT INTO test_log(line) SELECT is((SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol_r FROM rfx_r) AND location_id=(SELECT recv_loc FROM fx)), 5::numeric, 'R1: after reversing the PARTIAL putaway, Receiving is restored to the full 5 (2 remaining + 3 returned)') FROM fx LIMIT 1;
INSERT INTO test_log(line) SELECT is(count(*), 0::bigint, 'R2: shelf-b''s own row for line R is fully cleared (0) after the reversal') FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol_r FROM rfx_r) AND location_id=(SELECT shelf_b FROM fx);

CREATE TEMP TABLE before_r_rebuild AS SELECT location_id, quantity FROM repair_order_line_locations WHERE repair_order_line_id=(SELECT rol_r FROM rfx_r);
SELECT rebuild_repair_order_location_projection((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx), (SELECT ro FROM fx));
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM before_r_rebuild b WHERE NOT EXISTS (SELECT 1 FROM repair_order_line_locations a WHERE a.repair_order_line_id=(SELECT rol_r FROM rfx_r) AND a.location_id=b.location_id AND a.quantity=b.quantity)),
  0::bigint, 'R3: a full-order rebuild after the reversed PARTIAL putaway produces EXACTLY the same result as the incremental post-reversal state'
);

SELECT set_config('ambra.repair_order_attribution_authoritative', 'off', true);

-- ============================================================================
-- SCENARIO S: Finding B -- the public attach contract stays FROZEN.
-- An ordinary authenticated caller can never submit the system-owned
-- relation types ('relocation'/'reversal') through attach_repair_order_
-- line_movement -- unchanged check, re-proven after the internal-writer
-- refactor.
-- ============================================================================

DO $$
DECLARE v_state text;
BEGIN
  BEGIN
    PERFORM attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT rol_a FROM fx), (SELECT movement_line_id FROM ml_ab), 1, 'relocation');
    INSERT INTO test_log(line) SELECT fail('S1: expected relation_type=relocation to be rejected by public attach, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, '22023', 'S1: authenticated caller cannot submit relation_type=relocation via the public attach RPC (system-owned type)');
  END;
END;
$$;

DO $$
DECLARE v_state text;
BEGIN
  BEGIN
    PERFORM attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT rol_a FROM fx), (SELECT movement_line_id FROM ml_ab), 1, 'reversal');
    INSERT INTO test_log(line) SELECT fail('S2: expected relation_type=reversal to be rejected by public attach, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, '22023', 'S2: authenticated caller cannot submit relation_type=reversal via the public attach RPC (system-owned type)');
  END;
END;
$$;

-- ============================================================================
-- SCENARIO T: the new internal writer itself is unreachable directly --
-- no new client RPC was exposed.
-- ============================================================================

DO $$
DECLARE v_state text;
BEGIN
  BEGIN
    PERFORM write_repair_order_line_movement_link_internal((SELECT rol_a FROM fx), (SELECT movement_line_id FROM ml_ab), 1, 'receipt');
    INSERT INTO test_log(line) SELECT fail('T1: expected the internal writer to be unreachable for authenticated, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, '42501', 'T1: write_repair_order_line_movement_link_internal is not directly callable by authenticated (EXECUTE revoked, no new client RPC exposed)');
  END;
END;
$$;

RESET ROLE;

SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') AS not_ok_count, count(*) AS total_assertions FROM test_log;

ROLLBACK;
