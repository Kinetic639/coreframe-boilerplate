-- ============================================================================
-- TEST: IC-4 -- Branch Transfer / MMJ Rebuild
-- ============================================================================
-- Proves the rebuilt branch-transfer lifecycle (prepared -> in_transit ->
-- accepted | partially_accepted | declined | cancelled) end-to-end through
-- the real canonical engine: inventory_create_branch_transfer,
-- inventory_send_branch_transfer, inventory_accept_branch_transfer,
-- inventory_decline_branch_transfer, inventory_cancel_branch_transfer.
--
-- Product-owner decision under test: "in_transit" means the goods have
-- PHYSICALLY LEFT the source branch (a real 311 movement posted), never
-- merely reserved.
--
-- Does NOT re-prove IC-1/IC-2/IC-3/IC-7A's own business logic -- that is
-- 097-105's own job, re-run unmodified as part of this pass's own full
-- regression.
--
-- Executed live against supabase-target via psql.

BEGIN;

SELECT plan(87);

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated, anon;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated, anon;

SET LOCAL ambra.inventory_movement_engine = 'on';

CREATE TEMP TABLE fx (
  org uuid, e2e_user uuid, variant_1 uuid, variant_2 uuid, unit_1 uuid,
  src_branch uuid, dst_branch uuid, src_loc uuid, dst_loc uuid, src_loc2 uuid,
  a_transfer_id uuid, b_transfer_id uuid, c_transfer_id uuid, d_transfer_id uuid,
  e_transfer_id uuid, n_transfer_id uuid, o_transfer_id uuid
);
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9', 'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4',
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da', 'e11a5012-d136-4551-952d-6b264023737c',
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d',
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid();
GRANT SELECT, UPDATE ON fx TO authenticated, anon;

INSERT INTO branches (id, organization_id, name, branch_number)
SELECT src_branch, org, 'ic4-src', 960 FROM fx
UNION ALL SELECT dst_branch, org, 'ic4-dst', 961 FROM fx;

INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT src_loc, org, src_branch, 'ic4-src-loc', 'IC4S', true FROM fx
UNION ALL SELECT dst_loc, org, dst_branch, 'ic4-dst-loc', 'IC4D', true FROM fx
UNION ALL SELECT src_loc2, org, src_branch, 'ic4-src-loc2', 'IC4S2', true FROM fx;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role','authenticated')::text, true);

-- Seed 20 units of variant_1 at src_loc, 5 units of variant_2 at src_loc2.
SELECT inventory_create_and_finalize(
  org, src_branch, '101',
  jsonb_build_array(jsonb_build_object('variant_id', variant_1, 'unit_id', unit_1, 'quantity', 20, 'destination_location_id', src_loc)),
  NULL, NULL, NULL, NULL, NULL, NULL, e2e_user
) FROM fx;
SELECT inventory_create_and_finalize(
  org, src_branch, '101',
  jsonb_build_array(jsonb_build_object('variant_id', variant_2, 'unit_id', unit_1, 'quantity', 5, 'destination_location_id', src_loc2)),
  NULL, NULL, NULL, NULL, NULL, NULL, e2e_user
) FROM fx;

-- ============================================================================
-- SCENARIO A: full lifecycle (create -> send -> accept, full)
-- ============================================================================

CREATE TEMP TABLE a1 AS
SELECT inventory_create_branch_transfer(
  org, src_branch, dst_branch,
  jsonb_build_array(jsonb_build_object('variant_id', variant_1, 'source_location_id', src_loc, 'lot_id', NULL, 'serial_id', NULL, 'unit_id', unit_1, 'quantity', 6)),
  'scenario A', e2e_user
) AS result FROM fx;

INSERT INTO test_log(line) SELECT is((result->>'status'), 'prepared', 'A1: create -> status=prepared') FROM a1;
INSERT INTO test_log(line) SELECT is((SELECT on_hand_quantity FROM inventory_balances b, fx WHERE b.organization_id=fx.org AND b.branch_id=fx.src_branch AND b.location_id=fx.src_loc AND b.variant_id=fx.variant_1)::text, '20.000000', 'A2: on_hand unaffected by create (still 20)') FROM a1;
INSERT INTO test_log(line) SELECT is((SELECT reserved_quantity FROM inventory_balances b, fx WHERE b.organization_id=fx.org AND b.branch_id=fx.src_branch AND b.location_id=fx.src_loc AND b.variant_id=fx.variant_1)::text, '6.000000', 'A3: reserved=6 after create') FROM a1;

UPDATE fx SET a_transfer_id = (SELECT (result->>'transfer_id')::uuid FROM a1);

CREATE TEMP TABLE a2 AS SELECT inventory_send_branch_transfer((SELECT a_transfer_id FROM fx), (SELECT e2e_user FROM fx)) AS result;

INSERT INTO test_log(line) SELECT is((result->>'status'), 'in_transit', 'A4: send -> status=in_transit') FROM a2;
INSERT INTO test_log(line) SELECT ok((result->>'source_movement_id') IS NOT NULL, 'A5: send sets source_movement_id') FROM a2;
INSERT INTO test_log(line) SELECT is((SELECT on_hand_quantity FROM inventory_balances b, fx WHERE b.organization_id=fx.org AND b.branch_id=fx.src_branch AND b.location_id=fx.src_loc AND b.variant_id=fx.variant_1)::text, '14.000000', 'A6: on_hand=14 after send (20-6)') FROM a2;
INSERT INTO test_log(line) SELECT is((SELECT reserved_quantity FROM inventory_balances b, fx WHERE b.organization_id=fx.org AND b.branch_id=fx.src_branch AND b.location_id=fx.src_loc AND b.variant_id=fx.variant_1)::text, '0.000000', 'A7: reserved=0 after send') FROM a2;
INSERT INTO test_log(line) SELECT is((SELECT status FROM inventory_movement_headers WHERE id=(SELECT (result->>'source_movement_id')::uuid FROM a2)), 'posted', 'A8: source movement is posted') FROM a2;
INSERT INTO test_log(line) SELECT is((SELECT movement_type_code FROM inventory_movement_headers WHERE id=(SELECT (result->>'source_movement_id')::uuid FROM a2)), '311', 'A9: source movement uses type 311') FROM a2;

CREATE TEMP TABLE a3 AS SELECT inventory_accept_branch_transfer((SELECT a_transfer_id FROM fx), (SELECT dst_loc FROM fx), (SELECT e2e_user FROM fx), NULL) AS result;

INSERT INTO test_log(line) SELECT is((result->>'status'), 'accepted', 'A10: accept (full) -> status=accepted') FROM a3;
INSERT INTO test_log(line) SELECT is((SELECT on_hand_quantity FROM inventory_balances b, fx WHERE b.organization_id=fx.org AND b.branch_id=fx.dst_branch AND b.location_id=fx.dst_loc AND b.variant_id=fx.variant_1)::text, '6.000000', 'A11: destination on_hand=6') FROM a3;
INSERT INTO test_log(line) SELECT is((SELECT movement_type_code FROM inventory_movement_headers WHERE id=(SELECT (result->>'destination_movement_id')::uuid FROM a3)), '312', 'A12: destination movement uses type 312') FROM a3;
INSERT INTO test_log(line) SELECT is((SELECT reference_type FROM inventory_movement_headers WHERE id=(SELECT (result->>'destination_movement_id')::uuid FROM a3)), 'branch_transfer', 'A13: destination movement reference_type=branch_transfer') FROM a3;
INSERT INTO test_log(line) SELECT is((SELECT reference_id FROM inventory_movement_headers WHERE id=(SELECT (result->>'destination_movement_id')::uuid FROM a3)), (SELECT a_transfer_id::text FROM fx), 'A14: destination movement linked to the same transfer id') FROM a3;

-- ============================================================================
-- SCENARIO B: partial accept + persisted discrepancy
-- ============================================================================

CREATE TEMP TABLE b1 AS
SELECT inventory_create_branch_transfer(
  org, src_branch, dst_branch,
  jsonb_build_array(jsonb_build_object('variant_id', variant_1, 'source_location_id', src_loc, 'lot_id', NULL, 'serial_id', NULL, 'unit_id', unit_1, 'quantity', 6)),
  'scenario B', e2e_user
) AS result FROM fx;

UPDATE fx SET b_transfer_id = (SELECT (result->>'transfer_id')::uuid FROM b1);

SELECT inventory_send_branch_transfer((SELECT b_transfer_id FROM fx), (SELECT e2e_user FROM fx));

CREATE TEMP TABLE b2 AS
SELECT inventory_accept_branch_transfer(
  (SELECT b_transfer_id FROM fx), (SELECT dst_loc FROM fx), (SELECT e2e_user FROM fx),
  jsonb_build_array(jsonb_build_object('transfer_line_id', (SELECT id FROM inventory_branch_transfer_lines WHERE transfer_id=(SELECT b_transfer_id FROM fx)), 'accepted_quantity', 4))
) AS result;

INSERT INTO test_log(line) SELECT is((result->>'status'), 'partially_accepted', 'B1: partial accept -> status=partially_accepted') FROM b2;
INSERT INTO test_log(line) SELECT is((SELECT (b2.result->>'total_accepted')), '4.000000', 'B2: total_accepted=4') FROM b2;
-- dst_loc/variant_1 is shared with Scenario A (already accepted 6 there);
-- this bucket is cumulative across scenarios in this file, so the
-- expected absolute value is 6 (from A) + 4 (from B) = 10, not 4 alone.
INSERT INTO test_log(line) SELECT is((SELECT on_hand_quantity FROM inventory_balances bal, fx WHERE bal.organization_id=fx.org AND bal.branch_id=fx.dst_branch AND bal.location_id=fx.dst_loc AND bal.variant_id=fx.variant_1)::text, '10.000000', 'B3: destination on_hand=10 (6 from scenario A + only the 4 accepted here)') FROM b2;
INSERT INTO test_log(line) SELECT is((SELECT sent_quantity FROM inventory_branch_transfer_discrepancies WHERE transfer_id=(SELECT b_transfer_id FROM fx))::text, '6.000000', 'B4: discrepancy sent_quantity=6') FROM b2;
INSERT INTO test_log(line) SELECT is((SELECT accepted_quantity FROM inventory_branch_transfer_discrepancies WHERE transfer_id=(SELECT b_transfer_id FROM fx))::text, '4.000000', 'B5: discrepancy accepted_quantity=4') FROM b2;
INSERT INTO test_log(line) SELECT is((SELECT missing_quantity FROM inventory_branch_transfer_discrepancies WHERE transfer_id=(SELECT b_transfer_id FROM fx))::text, '2.000000', 'B6: discrepancy missing_quantity=2, never auto-adjusted back to source') FROM b2;

-- ============================================================================
-- SCENARIO C: decline before send (destination's decision)
-- ============================================================================

CREATE TEMP TABLE c1 AS
SELECT inventory_create_branch_transfer(
  org, src_branch, dst_branch,
  jsonb_build_array(jsonb_build_object('variant_id', variant_1, 'source_location_id', src_loc, 'lot_id', NULL, 'serial_id', NULL, 'unit_id', unit_1, 'quantity', 2)),
  'scenario C', e2e_user
) AS result FROM fx;
UPDATE fx SET c_transfer_id = (SELECT (result->>'transfer_id')::uuid FROM c1);

CREATE TEMP TABLE c2 AS SELECT inventory_decline_branch_transfer((SELECT c_transfer_id FROM fx), 'not needed', (SELECT e2e_user FROM fx)) AS result;

INSERT INTO test_log(line) SELECT is((result->>'status'), 'declined', 'C1: pre-send decline -> status=declined') FROM c2;
INSERT INTO test_log(line) SELECT is((SELECT count(*) FROM inventory_movement_headers WHERE reference_type='branch_transfer' AND reference_id=(SELECT c_transfer_id::text FROM fx)), 0::bigint, 'C2: zero movements posted for a pre-send decline') FROM c2;
INSERT INTO test_log(line) SELECT ok((SELECT status FROM inventory_reservations WHERE id=(SELECT reservation_id FROM inventory_branch_transfers WHERE id=(SELECT c_transfer_id FROM fx))) = 'cancelled', 'C3: reservation released on decline') FROM c2;

-- ============================================================================
-- SCENARIO D: cancel before send (source's decision)
-- ============================================================================

CREATE TEMP TABLE d1 AS
SELECT inventory_create_branch_transfer(
  org, src_branch, dst_branch,
  jsonb_build_array(jsonb_build_object('variant_id', variant_1, 'source_location_id', src_loc, 'lot_id', NULL, 'serial_id', NULL, 'unit_id', unit_1, 'quantity', 2)),
  'scenario D', e2e_user
) AS result FROM fx;
UPDATE fx SET d_transfer_id = (SELECT (result->>'transfer_id')::uuid FROM d1);

CREATE TEMP TABLE d2 AS SELECT inventory_cancel_branch_transfer((SELECT d_transfer_id FROM fx), (SELECT e2e_user FROM fx), 'changed mind') AS result;

INSERT INTO test_log(line) SELECT is((result->>'status'), 'cancelled', 'D1: pre-send cancel -> status=cancelled') FROM d2;
INSERT INTO test_log(line) SELECT is((SELECT count(*) FROM inventory_movement_headers WHERE reference_type='branch_transfer' AND reference_id=(SELECT d_transfer_id::text FROM fx)), 0::bigint, 'D2: zero movements posted for a pre-send cancel') FROM d2;
INSERT INTO test_log(line) SELECT ok((SELECT status FROM inventory_reservations WHERE id=(SELECT reservation_id FROM inventory_branch_transfers WHERE id=(SELECT d_transfer_id FROM fx))) = 'cancelled', 'D3: reservation released on cancel') FROM d2;

-- ============================================================================
-- SCENARIO E: post-send decline/cancel are HARD-REJECTED, no auto-return
-- ============================================================================

CREATE TEMP TABLE e1 AS
SELECT inventory_create_branch_transfer(
  org, src_branch, dst_branch,
  jsonb_build_array(jsonb_build_object('variant_id', variant_1, 'source_location_id', src_loc, 'lot_id', NULL, 'serial_id', NULL, 'unit_id', unit_1, 'quantity', 1)),
  'scenario E', e2e_user
) AS result FROM fx;
UPDATE fx SET e_transfer_id = (SELECT (result->>'transfer_id')::uuid FROM e1);
SELECT inventory_send_branch_transfer((SELECT e_transfer_id FROM fx), (SELECT e2e_user FROM fx));

DO $$
DECLARE
  v_id uuid; v_usr uuid; v_state text;
BEGIN
  SELECT e_transfer_id, e2e_user INTO v_id, v_usr FROM fx;
  BEGIN
    PERFORM inventory_decline_branch_transfer(v_id, 'too late', v_usr);
    INSERT INTO test_log(line) SELECT fail('E1: expected post-send decline rejection, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, 'P0007', 'E1: post-send decline rejected P0007, no auto-return');
  END;
  BEGIN
    PERFORM inventory_cancel_branch_transfer(v_id, v_usr, 'too late');
    INSERT INTO test_log(line) SELECT fail('E2: expected post-send cancel rejection, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, 'P0007', 'E2: post-send cancel rejected P0007, no auto-return');
  END;
END;
$$;

-- ============================================================================
-- SCENARIO F: NULL actor rejected on every RPC
-- ============================================================================

DO $$
DECLARE v_state text;
BEGIN
  BEGIN
    PERFORM inventory_create_branch_transfer((SELECT org FROM fx), (SELECT src_branch FROM fx), (SELECT dst_branch FROM fx), '[]'::jsonb, NULL, NULL);
    INSERT INTO test_log(line) SELECT fail('F1: expected NULL-actor rejection on create');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, '28000', 'F1: NULL actor rejected on create (28000)');
  END;
  BEGIN
    PERFORM inventory_send_branch_transfer(gen_random_uuid(), NULL);
    INSERT INTO test_log(line) SELECT fail('F2: expected NULL-actor rejection on send');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, '28000', 'F2: NULL actor rejected on send (28000)');
  END;
  BEGIN
    PERFORM inventory_accept_branch_transfer(gen_random_uuid(), gen_random_uuid(), NULL, NULL);
    INSERT INTO test_log(line) SELECT fail('F3: expected NULL-actor rejection on accept');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, '28000', 'F3: NULL actor rejected on accept (28000)');
  END;
  BEGIN
    PERFORM inventory_decline_branch_transfer(gen_random_uuid(), 'x', NULL);
    INSERT INTO test_log(line) SELECT fail('F4: expected NULL-actor rejection on decline');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, '28000', 'F4: NULL actor rejected on decline (28000)');
  END;
  BEGIN
    PERFORM inventory_cancel_branch_transfer(gen_random_uuid(), NULL, 'x');
    INSERT INTO test_log(line) SELECT fail('F5: expected NULL-actor rejection on cancel');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, '28000', 'F5: NULL actor rejected on cancel (28000)');
  END;
END;
$$;

-- ============================================================================
-- SCENARIO G: actor impersonation rejected (create, send)
-- ============================================================================

CREATE TEMP TABLE g_setup AS SELECT gen_random_uuid() AS no_perm_user;
GRANT SELECT ON g_setup TO authenticated;

SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT no_perm_user FROM g_setup)::text, 'role','authenticated')::text, true);

DO $$
DECLARE v_state text; v_real_actor uuid;
BEGIN
  SELECT e2e_user INTO v_real_actor FROM fx;
  BEGIN
    PERFORM inventory_create_branch_transfer((SELECT org FROM fx), (SELECT src_branch FROM fx), (SELECT dst_branch FROM fx), '[]'::jsonb, NULL, v_real_actor);
    INSERT INTO test_log(line) SELECT fail('G1: expected impersonation rejection on create');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, '28000', 'G1: impersonated actor rejected on create (28000)');
  END;
  BEGIN
    PERFORM inventory_send_branch_transfer((SELECT a_transfer_id FROM fx), v_real_actor);
    INSERT INTO test_log(line) SELECT fail('G2: expected impersonation rejection on send');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, '28000', 'G2: impersonated actor rejected on send (28000)');
  END;
END;
$$;

-- ============================================================================
-- SCENARIO H: authenticated, zero permission -- rejected on create/send/accept
-- ============================================================================

SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT no_perm_user FROM g_setup)::text, 'role','authenticated')::text, true);

DO $$
DECLARE v_state text; v_no_perm_user uuid;
BEGIN
  SELECT no_perm_user INTO v_no_perm_user FROM g_setup;
  BEGIN
    PERFORM inventory_create_branch_transfer((SELECT org FROM fx), (SELECT src_branch FROM fx), (SELECT dst_branch FROM fx), '[]'::jsonb, NULL, v_no_perm_user);
    INSERT INTO test_log(line) SELECT fail('H1: expected no-permission rejection on create');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, '42501', 'H1: no source-branch permission rejected on create (42501)');
  END;
END;
$$;

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role','authenticated')::text, true);

-- e2e_user holds a real org-wide warehouse.* wildcard, so a genuine
-- no-permission negative needs a user with literally zero rows -- reuse
-- g_setup's no_perm_user, verified to have no permission grants at all.
DO $$
DECLARE v_state text; v_no_perm_user uuid; v_id uuid;
BEGIN
  SELECT no_perm_user INTO v_no_perm_user FROM g_setup;
  SELECT b_transfer_id INTO v_id FROM fx;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_no_perm_user::text, 'role','authenticated')::text, true);
  BEGIN
    PERFORM inventory_send_branch_transfer(v_id, v_no_perm_user);
    INSERT INTO test_log(line) SELECT fail('H2: expected no-permission rejection on send');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, 'P0002', 'H2: no source-branch permission rejected on send (P0002, no existence leak)');
  END;
  BEGIN
    PERFORM inventory_accept_branch_transfer(v_id, gen_random_uuid(), v_no_perm_user, NULL);
    INSERT INTO test_log(line) SELECT fail('H3: expected no-permission rejection on accept');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, 'P0002', 'H3: no destination-branch permission rejected on accept (P0002, no existence leak)');
  END;
END;
$$;

SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role','authenticated')::text, true);

-- ============================================================================
-- SCENARIO I: cross-org isolation
-- ============================================================================

DO $$
DECLARE v_state text; v_other_org uuid := gen_random_uuid();
BEGIN
  BEGIN
    PERFORM inventory_create_branch_transfer(v_other_org, (SELECT src_branch FROM fx), (SELECT dst_branch FROM fx), '[]'::jsonb, NULL, (SELECT e2e_user FROM fx));
    INSERT INTO test_log(line) SELECT fail('I1: expected cross-org rejection');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT ok(v_state IS NOT NULL, 'I1: cross-org branch/org mismatch rejected (' || v_state || ')');
  END;
END;
$$;

-- ============================================================================
-- SCENARIO J: same source/destination branch rejected
-- ============================================================================

DO $$
DECLARE v_state text;
BEGIN
  BEGIN
    PERFORM inventory_create_branch_transfer((SELECT org FROM fx), (SELECT src_branch FROM fx), (SELECT src_branch FROM fx), '[]'::jsonb, NULL, (SELECT e2e_user FROM fx));
    INSERT INTO test_log(line) SELECT fail('J1: expected same-branch rejection');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT pass('J1: same source/destination branch rejected');
  END;
END;
$$;

-- ============================================================================
-- SCENARIO K: anon negatives on all five RPCs
-- ============================================================================

SET LOCAL ROLE anon;
DO $$ BEGIN BEGIN
  PERFORM inventory_create_branch_transfer(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), '[]'::jsonb, NULL, NULL);
  INSERT INTO test_log(line) SELECT fail('K1: expected EXECUTE denial on create as anon');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'K1: anon has no EXECUTE on inventory_create_branch_transfer');
END; END $$;
DO $$ BEGIN BEGIN
  PERFORM inventory_send_branch_transfer(gen_random_uuid(), NULL);
  INSERT INTO test_log(line) SELECT fail('K2: expected EXECUTE denial on send as anon');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'K2: anon has no EXECUTE on inventory_send_branch_transfer');
END; END $$;
DO $$ BEGIN BEGIN
  PERFORM inventory_accept_branch_transfer(gen_random_uuid(), gen_random_uuid(), NULL, NULL);
  INSERT INTO test_log(line) SELECT fail('K3: expected EXECUTE denial on accept as anon');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'K3: anon has no EXECUTE on inventory_accept_branch_transfer');
END; END $$;
DO $$ BEGIN BEGIN
  PERFORM inventory_decline_branch_transfer(gen_random_uuid(), NULL, NULL);
  INSERT INTO test_log(line) SELECT fail('K4: expected EXECUTE denial on decline as anon');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'K4: anon has no EXECUTE on inventory_decline_branch_transfer');
END; END $$;
DO $$ BEGIN BEGIN
  PERFORM inventory_cancel_branch_transfer(gen_random_uuid(), NULL, NULL);
  INSERT INTO test_log(line) SELECT fail('K5: expected EXECUTE denial on cancel as anon');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'K5: anon has no EXECUTE on inventory_cancel_branch_transfer');
END; END $$;
RESET ROLE;

-- ============================================================================
-- SCENARIO L: raw-write denial on all three tables, authenticated + real permission
-- ============================================================================

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role','authenticated')::text, true);

DO $$
DECLARE v_ok boolean; v_rows_affected integer;
BEGIN
  v_ok := false;
  BEGIN
    INSERT INTO inventory_branch_transfers (organization_id, transfer_number, source_branch_id, destination_branch_id)
    SELECT org, 'RAW-L1', src_branch, dst_branch FROM fx;
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_ok := false; END;
  INSERT INTO test_log(line) SELECT is(v_ok, false, 'L1: raw INSERT on inventory_branch_transfers denied for authenticated');

  -- A RESTRICTIVE USING(false) policy makes UPDATE silently match zero
  -- rows (standard Postgres RLS row-filtering semantics for UPDATE/DELETE)
  -- rather than raising an exception -- unlike INSERT's WITH CHECK, which
  -- does raise. So the correct proof here is "zero rows affected", not
  -- "an exception was thrown".
  v_ok := false;
  BEGIN
    UPDATE inventory_branch_transfers SET status = 'declined' WHERE id = (SELECT a_transfer_id FROM fx);
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    v_ok := (v_rows_affected > 0);
  EXCEPTION WHEN OTHERS THEN v_ok := false; END;
  INSERT INTO test_log(line) SELECT is(v_ok, false, 'L2: raw UPDATE on inventory_branch_transfers denied for authenticated (zero rows matched)');

  v_ok := false;
  BEGIN
    INSERT INTO inventory_branch_transfer_lines (organization_id, transfer_id, variant_id, source_location_id, unit_id, quantity)
    SELECT org, a_transfer_id, variant_1, src_loc, unit_1, 1 FROM fx;
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_ok := false; END;
  INSERT INTO test_log(line) SELECT is(v_ok, false, 'L3: raw INSERT on inventory_branch_transfer_lines denied for authenticated');

  v_ok := false;
  BEGIN
    INSERT INTO inventory_branch_transfer_discrepancies (organization_id, transfer_id, transfer_line_id, variant_id, sent_quantity, accepted_quantity, missing_quantity)
    SELECT org, b_transfer_id, (SELECT id FROM inventory_branch_transfer_lines WHERE transfer_id = fx.b_transfer_id LIMIT 1), variant_1, 6, 0, 6 FROM fx;
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_ok := false; END;
  INSERT INTO test_log(line) SELECT is(v_ok, false, 'L4: raw INSERT on inventory_branch_transfer_discrepancies denied for authenticated');
END;
$$;

-- ============================================================================
-- SCENARIO M: idempotent retry (send twice, accept twice)
-- ============================================================================

DO $$
DECLARE v_state text;
BEGIN
  BEGIN
    PERFORM inventory_send_branch_transfer((SELECT a_transfer_id FROM fx), (SELECT e2e_user FROM fx));
    INSERT INTO test_log(line) SELECT fail('M1: expected second send to be rejected (already in_transit/accepted)');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, 'P0007', 'M1: retrying send on an already-sent transfer rejected P0007, no duplicate movement');
  END;
END;
$$;
INSERT INTO test_log(line) SELECT is(count(*), 1::bigint, 'M2: exactly one source movement exists for scenario A''s transfer') FROM inventory_movement_headers WHERE reference_type='branch_transfer' AND reference_id=(SELECT a_transfer_id::text FROM fx) AND movement_type_code='311';

CREATE TEMP TABLE m3 AS SELECT inventory_accept_branch_transfer((SELECT a_transfer_id FROM fx), (SELECT dst_loc FROM fx), (SELECT e2e_user FROM fx), NULL) AS result;
INSERT INTO test_log(line) SELECT is((result->>'already_processed'), 'true', 'M3: retrying accept on an already-accepted transfer is an idempotent no-op') FROM m3;
INSERT INTO test_log(line) SELECT is(count(*), 1::bigint, 'M4: exactly one destination movement exists for scenario A''s transfer') FROM inventory_movement_headers WHERE reference_type='branch_transfer' AND reference_id=(SELECT a_transfer_id::text FROM fx) AND movement_type_code='312';

-- ============================================================================
-- SCENARIO N: IC-1 commitment protection -- send cannot strand an
-- UNRELATED (non-transfer) reservation on the same bucket.
-- ============================================================================

CREATE TEMP TABLE n1 AS
SELECT inventory_create_branch_transfer(
  org, src_branch, dst_branch,
  jsonb_build_array(jsonb_build_object('variant_id', variant_2, 'source_location_id', src_loc2, 'lot_id', NULL, 'serial_id', NULL, 'unit_id', unit_1, 'quantity', 5)),
  'scenario N', e2e_user
) AS result FROM fx;
UPDATE fx SET n_transfer_id = (SELECT (result->>'transfer_id')::uuid FROM n1);

-- Directly grow the committed amount at the SAME bucket beyond what the
-- transfer's own reservation covers, simulating a second, independent
-- commitment (allocation) that must not be stranded by the transfer send.
-- Done as the connecting (RLS-bypassing) role -- this is test-fixture
-- setup, not something under test; the send rejection below is.
-- PRE-IC8 P0 note: explicit GUC set for defense against any prior
-- transaction-scoped state ambiguity -- this UPDATE is already
-- shape-compliant (a pure commitment-only change, on_hand untouched).
RESET ROLE;
SET LOCAL ambra.inventory_movement_engine = 'on';
UPDATE inventory_balances b
SET allocated_quantity = allocated_quantity + 1
FROM fx WHERE b.organization_id = fx.org AND b.branch_id = fx.src_branch AND b.location_id = fx.src_loc2 AND b.variant_id = fx.variant_2;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role','authenticated')::text, true);

DO $$
DECLARE v_state text;
BEGIN
  BEGIN
    PERFORM inventory_send_branch_transfer((SELECT n_transfer_id FROM fx), (SELECT e2e_user FROM fx));
    INSERT INTO test_log(line) SELECT fail('N1: expected send to be rejected (would strand the other commitment)');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, 'P0003', 'N1: send rejected P0003 -- cannot strand an unrelated commitment on the same bucket');
  END;
END;
$$;
INSERT INTO test_log(line) SELECT is((SELECT on_hand_quantity FROM inventory_balances b, fx WHERE b.organization_id=fx.org AND b.branch_id=fx.src_branch AND b.location_id=fx.src_loc2 AND b.variant_id=fx.variant_2)::text, '5.000000', 'N2: source on_hand unchanged after the rejected send') FROM fx LIMIT 1;

-- ============================================================================
-- SCENARIO O: same-SKU line independence -- two lines, same variant,
-- different source locations, correlated by transfer_line_id, not SKU.
-- ============================================================================

INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT gen_random_uuid(), org, src_branch, 'ic4-src-loc3', 'IC4S3', true FROM fx;

CREATE TEMP TABLE o_loc AS SELECT id AS loc3 FROM warehouse_locations WHERE code = 'IC4S3';
GRANT SELECT ON o_loc TO authenticated;

SELECT inventory_create_and_finalize(
  org, src_branch, '101',
  jsonb_build_array(jsonb_build_object('variant_id', variant_1, 'unit_id', unit_1, 'quantity', 3, 'destination_location_id', (SELECT loc3 FROM o_loc))),
  NULL, NULL, NULL, NULL, NULL, NULL, e2e_user
) FROM fx;

CREATE TEMP TABLE o1 AS
SELECT inventory_create_branch_transfer(
  org, src_branch, dst_branch,
  jsonb_build_array(
    jsonb_build_object('variant_id', variant_1, 'source_location_id', src_loc, 'lot_id', NULL, 'serial_id', NULL, 'unit_id', unit_1, 'quantity', 2),
    jsonb_build_object('variant_id', variant_1, 'source_location_id', (SELECT loc3 FROM o_loc), 'lot_id', NULL, 'serial_id', NULL, 'unit_id', unit_1, 'quantity', 3)
  ),
  'scenario O', e2e_user
) AS result FROM fx;
UPDATE fx SET o_transfer_id = (SELECT (result->>'transfer_id')::uuid FROM o1);

SELECT inventory_send_branch_transfer((SELECT o_transfer_id FROM fx), (SELECT e2e_user FROM fx));

CREATE TEMP TABLE o_lines AS SELECT id, source_location_id, quantity FROM inventory_branch_transfer_lines WHERE transfer_id = (SELECT o_transfer_id FROM fx) ORDER BY created_at;
GRANT SELECT ON o_lines TO authenticated;

CREATE TEMP TABLE o2 AS
SELECT inventory_accept_branch_transfer(
  (SELECT o_transfer_id FROM fx), (SELECT dst_loc FROM fx), (SELECT e2e_user FROM fx),
  jsonb_build_array(
    jsonb_build_object('transfer_line_id', (SELECT id FROM o_lines WHERE quantity = 2), 'accepted_quantity', 2),
    jsonb_build_object('transfer_line_id', (SELECT id FROM o_lines WHERE quantity = 3), 'accepted_quantity', 1)
  )
) AS result;

INSERT INTO test_log(line) SELECT is((result->>'status'), 'partially_accepted', 'O1: mixed same-SKU lines -> partially_accepted') FROM o2;
INSERT INTO test_log(line) SELECT is(count(*), 2::bigint, 'O2: two independent lines both correctly correlated (not merged by SKU)') FROM inventory_branch_transfer_lines WHERE transfer_id=(SELECT o_transfer_id FROM fx);
INSERT INTO test_log(line) SELECT is(count(*), 1::bigint, 'O3: exactly one discrepancy row for the short line (the full line has none)') FROM inventory_branch_transfer_discrepancies WHERE transfer_id=(SELECT o_transfer_id FROM fx);

-- ============================================================================
-- SCENARIO P: reversal compatibility -- physical reversibility of the
-- source 311 movement is distinct from business transfer-lifecycle
-- reversal (which is NOT auto-exposed).
-- ============================================================================

CREATE TEMP TABLE p1 AS SELECT inventory_reverse_movement((SELECT (result->>'source_movement_id')::uuid FROM a2), (SELECT e2e_user FROM fx), 'IC-4 reversal compatibility test') AS result;
INSERT INTO test_log(line) SELECT is((result->>'status'), 'posted', 'P1: the source 311 movement is physically reversible via inventory_reverse_movement') FROM p1;
INSERT INTO test_log(line) SELECT is((SELECT status FROM inventory_branch_transfers WHERE id=(SELECT a_transfer_id FROM fx)), 'accepted', 'P2: reversing the physical movement does NOT auto-change the transfer''s own business status (still accepted)') FROM p1;

-- ============================================================================
-- SCENARIO Q: IC-4 CORRECTION PASS -- 100%-missing receipt must NOT
-- orphan a draft 312 movement header. Source has physically shipped;
-- destination receives zero; missing quantity is a persisted
-- discrepancy; status=partially_accepted; no movement of any kind is
-- created; retry is idempotent and creates nothing later.
-- ============================================================================

CREATE TEMP TABLE q_fx AS
SELECT gen_random_uuid() AS q_src_loc;
GRANT SELECT ON q_fx TO authenticated;

INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT q_src_loc, (SELECT org FROM fx), (SELECT src_branch FROM fx), 'ic4-q-src-loc', 'IC4Q', true FROM q_fx;

SELECT inventory_create_and_finalize(
  (SELECT org FROM fx), (SELECT src_branch FROM fx), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 5, 'destination_location_id', (SELECT q_src_loc FROM q_fx))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fx)
);

CREATE TEMP TABLE q1 AS
SELECT inventory_create_branch_transfer(
  (SELECT org FROM fx), (SELECT src_branch FROM fx), (SELECT dst_branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'source_location_id', (SELECT q_src_loc FROM q_fx), 'lot_id', NULL, 'serial_id', NULL, 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 5)),
  'scenario Q -- 100pct missing', (SELECT e2e_user FROM fx)
) AS result;

ALTER TABLE q_fx ADD COLUMN q_transfer_id uuid;
UPDATE q_fx SET q_transfer_id = (SELECT (result->>'transfer_id')::uuid FROM q1);

SELECT inventory_send_branch_transfer((SELECT q_transfer_id FROM q_fx), (SELECT e2e_user FROM fx));

-- Snapshot destination on_hand for this bucket BEFORE the 100%-missing
-- accept -- it is a shared, cumulative bucket across this file's own
-- earlier scenarios, so the correct proof is "unchanged", not a fixed
-- absolute value.
CREATE TEMP TABLE q_before AS
SELECT COALESCE((SELECT on_hand_quantity FROM inventory_balances b WHERE b.organization_id=(SELECT org FROM fx) AND b.branch_id=(SELECT dst_branch FROM fx) AND b.location_id=(SELECT dst_loc FROM fx) AND b.variant_id=(SELECT variant_1 FROM fx)), -1) AS on_hand;

CREATE TEMP TABLE q2 AS
SELECT inventory_accept_branch_transfer(
  (SELECT q_transfer_id FROM q_fx), (SELECT dst_loc FROM fx), (SELECT e2e_user FROM fx),
  jsonb_build_array(jsonb_build_object('transfer_line_id', (SELECT id FROM inventory_branch_transfer_lines WHERE transfer_id=(SELECT q_transfer_id FROM q_fx)), 'accepted_quantity', 0))
) AS result;

INSERT INTO test_log(line) SELECT is((result->>'status'), 'partially_accepted', 'Q1: 100%%-missing accept -> status=partially_accepted') FROM q2;
INSERT INTO test_log(line) SELECT ok((result->>'destination_movement_id') IS NULL, 'Q2: destination_movement_id IS NULL in the RPC result') FROM q2;
INSERT INTO test_log(line) SELECT ok((SELECT destination_movement_id FROM inventory_branch_transfers WHERE id=(SELECT q_transfer_id FROM q_fx)) IS NULL, 'Q3: transfer row destination_movement_id IS NULL') FROM q2;
INSERT INTO test_log(line) SELECT is(count(*), 0::bigint, 'Q4: zero 312 headers exist for this transfer -- no orphan draft') FROM inventory_movement_headers WHERE reference_type='branch_transfer' AND reference_id=(SELECT q_transfer_id::text FROM q_fx) AND movement_type_code='312';
INSERT INTO test_log(line) SELECT is(count(*), 0::bigint, 'Q5: zero movement lines exist for any destination-receipt movement of this transfer') FROM inventory_movement_lines ml JOIN inventory_movement_headers mh ON mh.id = ml.movement_id WHERE mh.reference_type='branch_transfer' AND mh.reference_id=(SELECT q_transfer_id::text FROM q_fx) AND mh.movement_type_code='312';
INSERT INTO test_log(line) SELECT is((SELECT accepted_quantity FROM inventory_branch_transfer_lines WHERE transfer_id=(SELECT q_transfer_id FROM q_fx))::text, '0.000000', 'Q6: transfer line accepted_quantity persisted as exactly 0') FROM q2;
INSERT INTO test_log(line) SELECT is(count(*), 1::bigint, 'Q7: exactly one discrepancy row persisted for the 100%%-missing line') FROM inventory_branch_transfer_discrepancies WHERE transfer_id=(SELECT q_transfer_id FROM q_fx);
INSERT INTO test_log(line) SELECT is((SELECT sent_quantity FROM inventory_branch_transfer_discrepancies WHERE transfer_id=(SELECT q_transfer_id FROM q_fx))::text, '5.000000', 'Q8: discrepancy sent_quantity=5') FROM q2;
INSERT INTO test_log(line) SELECT is((SELECT accepted_quantity FROM inventory_branch_transfer_discrepancies WHERE transfer_id=(SELECT q_transfer_id FROM q_fx))::text, '0.000000', 'Q9: discrepancy accepted_quantity=0') FROM q2;
INSERT INTO test_log(line) SELECT is((SELECT missing_quantity FROM inventory_branch_transfer_discrepancies WHERE transfer_id=(SELECT q_transfer_id FROM q_fx))::text, '5.000000', 'Q10: discrepancy missing_quantity=5') FROM q2;
INSERT INTO test_log(line) SELECT ok((SELECT destination_movement_id FROM inventory_branch_transfer_discrepancies WHERE transfer_id=(SELECT q_transfer_id FROM q_fx)) IS NULL, 'Q11: discrepancy destination_movement_id IS NULL -- never references a draft or non-posted movement') FROM q2;
INSERT INTO test_log(line) SELECT is(
  COALESCE((SELECT on_hand_quantity FROM inventory_balances b WHERE b.organization_id=(SELECT org FROM fx) AND b.branch_id=(SELECT dst_branch FROM fx) AND b.location_id=(SELECT dst_loc FROM fx) AND b.variant_id=(SELECT variant_1 FROM fx)), -1),
  (SELECT on_hand FROM q_before),
  'Q12: destination on_hand for this bucket is completely unchanged by the 100%% missing accept'
);

-- Idempotent retry: creates nothing later either.
CREATE TEMP TABLE q3 AS
SELECT inventory_accept_branch_transfer((SELECT q_transfer_id FROM q_fx), (SELECT dst_loc FROM fx), (SELECT e2e_user FROM fx), NULL) AS result;
INSERT INTO test_log(line) SELECT is((result->>'already_processed'), 'true', 'Q13: retrying the accept on an already-partially_accepted 100%%-missing transfer is an idempotent no-op') FROM q3;
INSERT INTO test_log(line) SELECT ok((result->>'destination_movement_id') IS NULL, 'Q14: retry result still carries a NULL destination_movement_id') FROM q3;
INSERT INTO test_log(line) SELECT is(count(*), 0::bigint, 'Q15: still zero 312 headers after the retry -- nothing was created later') FROM inventory_movement_headers WHERE reference_type='branch_transfer' AND reference_id=(SELECT q_transfer_id::text FROM q_fx) AND movement_type_code='312';
INSERT INTO test_log(line) SELECT is(count(*), 1::bigint, 'Q16: still exactly one discrepancy row after the retry -- no duplicate created') FROM inventory_branch_transfer_discrepancies WHERE transfer_id=(SELECT q_transfer_id FROM q_fx);

-- ============================================================================
-- SCENARIO R: IC-4 CORRECTION PASS -- explicit line_acceptances payload
-- must be exact and fail-closed. NULL means full accept (already proven
-- throughout this file, e.g. Scenario A); a non-NULL payload must name
-- every transfer line exactly once, reject unknown/foreign/duplicate
-- transfer_line_id, and mutate NOTHING on any rejection.
-- ============================================================================

CREATE TEMP TABLE r_fx AS
SELECT gen_random_uuid() AS r_src_loc;
GRANT SELECT ON r_fx TO authenticated;

INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT r_src_loc, (SELECT org FROM fx), (SELECT src_branch FROM fx), 'ic4-r-src-loc', 'IC4R', true FROM r_fx;

SELECT inventory_create_and_finalize(
  (SELECT org FROM fx), (SELECT src_branch FROM fx), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 8, 'destination_location_id', (SELECT r_src_loc FROM r_fx))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fx)
);

CREATE TEMP TABLE r1 AS
SELECT inventory_create_branch_transfer(
  (SELECT org FROM fx), (SELECT src_branch FROM fx), (SELECT dst_branch FROM fx),
  jsonb_build_array(
    jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'source_location_id', (SELECT r_src_loc FROM r_fx), 'lot_id', NULL, 'serial_id', NULL, 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 4),
    jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'source_location_id', (SELECT r_src_loc FROM r_fx), 'lot_id', NULL, 'serial_id', NULL, 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 3)
  ),
  'scenario R -- strict payload validation', (SELECT e2e_user FROM fx)
) AS result;

ALTER TABLE r_fx ADD COLUMN r_transfer_id uuid;
UPDATE r_fx SET r_transfer_id = (SELECT (result->>'transfer_id')::uuid FROM r1);

SELECT inventory_send_branch_transfer((SELECT r_transfer_id FROM r_fx), (SELECT e2e_user FROM fx));

CREATE TEMP TABLE r_lines AS SELECT id, quantity FROM inventory_branch_transfer_lines WHERE transfer_id=(SELECT r_transfer_id FROM r_fx) ORDER BY created_at;
GRANT SELECT ON r_lines TO authenticated;

-- A second, unrelated transfer, to obtain a genuinely foreign transfer_line_id.
CREATE TEMP TABLE rf_other AS
SELECT inventory_create_branch_transfer(
  (SELECT org FROM fx), (SELECT src_branch FROM fx), (SELECT dst_branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'source_location_id', (SELECT r_src_loc FROM r_fx), 'lot_id', NULL, 'serial_id', NULL, 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 1)),
  'scenario R -- foreign transfer', (SELECT e2e_user FROM fx)
) AS result;
CREATE TEMP TABLE rf_other_line AS SELECT id FROM inventory_branch_transfer_lines WHERE transfer_id=(SELECT (result->>'transfer_id')::uuid FROM rf_other);
GRANT SELECT ON rf_other_line TO authenticated;

DO $$
DECLARE
  v_transfer_id uuid; v_usr uuid; v_dst_loc uuid; v_line1 uuid; v_line2 uuid; v_foreign uuid; v_state text;
BEGIN
  SELECT r_transfer_id INTO v_transfer_id FROM r_fx;
  SELECT e2e_user, dst_loc INTO v_usr, v_dst_loc FROM fx;
  SELECT id INTO v_line1 FROM r_lines WHERE quantity = 4;
  SELECT id INTO v_line2 FROM r_lines WHERE quantity = 3;
  SELECT id INTO v_foreign FROM rf_other_line;

  -- R1: missing one line from an explicit payload -> reject, zero mutation.
  BEGIN
    PERFORM inventory_accept_branch_transfer(v_transfer_id, v_dst_loc, v_usr,
      jsonb_build_array(jsonb_build_object('transfer_line_id', v_line1, 'accepted_quantity', 4)));
    INSERT INTO test_log(line) SELECT fail('R1: expected rejection for a payload missing one transfer line');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, '22023', 'R1: an explicit payload missing one transfer line is rejected (22023)');
  END;

  -- R2: unknown (nonexistent) transfer_line_id -> reject.
  BEGIN
    PERFORM inventory_accept_branch_transfer(v_transfer_id, v_dst_loc, v_usr,
      jsonb_build_array(
        jsonb_build_object('transfer_line_id', v_line1, 'accepted_quantity', 4),
        jsonb_build_object('transfer_line_id', v_line2, 'accepted_quantity', 3),
        jsonb_build_object('transfer_line_id', gen_random_uuid(), 'accepted_quantity', 1)
      ));
    INSERT INTO test_log(line) SELECT fail('R2: expected rejection for an unknown transfer_line_id');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, '22023', 'R2: an unknown transfer_line_id is rejected (22023)');
  END;

  -- R3: duplicate transfer_line_id -> reject.
  BEGIN
    PERFORM inventory_accept_branch_transfer(v_transfer_id, v_dst_loc, v_usr,
      jsonb_build_array(
        jsonb_build_object('transfer_line_id', v_line1, 'accepted_quantity', 4),
        jsonb_build_object('transfer_line_id', v_line1, 'accepted_quantity', 2)
      ));
    INSERT INTO test_log(line) SELECT fail('R3: expected rejection for a duplicate transfer_line_id');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, '22023', 'R3: a duplicate transfer_line_id is rejected (22023)');
  END;

  -- R4: a transfer_line_id belonging to a DIFFERENT transfer -> reject.
  BEGIN
    PERFORM inventory_accept_branch_transfer(v_transfer_id, v_dst_loc, v_usr,
      jsonb_build_array(
        jsonb_build_object('transfer_line_id', v_line1, 'accepted_quantity', 4),
        jsonb_build_object('transfer_line_id', v_foreign, 'accepted_quantity', 1)
      ));
    INSERT INTO test_log(line) SELECT fail('R4: expected rejection for a foreign-transfer transfer_line_id');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, '22023', 'R4: a transfer_line_id belonging to a different transfer is rejected (22023)');
  END;
END;
$$;

-- R5: zero mutation after all four rejections -- transfer still in_transit.
INSERT INTO test_log(line) SELECT is((SELECT status FROM inventory_branch_transfers WHERE id=(SELECT r_transfer_id FROM r_fx)), 'in_transit', 'R5: the transfer remains in_transit after all four rejected explicit payloads');
-- R6: zero mutation -- accepted_quantity was never set on either line.
INSERT INTO test_log(line) SELECT is(count(*) FILTER (WHERE accepted_quantity IS NOT NULL), 0::bigint, 'R6: neither transfer line''s accepted_quantity was touched by any rejected attempt') FROM inventory_branch_transfer_lines WHERE transfer_id=(SELECT r_transfer_id FROM r_fx);
-- R7: zero mutation -- no discrepancy, no 312 header, no movement lines, no destination balance change.
INSERT INTO test_log(line) SELECT is(count(*), 0::bigint, 'R7: zero discrepancy rows exist after all four rejected attempts') FROM inventory_branch_transfer_discrepancies WHERE transfer_id=(SELECT r_transfer_id FROM r_fx);
INSERT INTO test_log(line) SELECT is(count(*), 0::bigint, 'R8: zero 312 headers exist after all four rejected attempts') FROM inventory_movement_headers WHERE reference_type='branch_transfer' AND reference_id=(SELECT r_transfer_id::text FROM r_fx) AND movement_type_code='312';

-- R9: exact, complete explicit full-accept payload succeeds.
CREATE TEMP TABLE r_full AS
SELECT inventory_accept_branch_transfer(
  (SELECT r_transfer_id FROM r_fx), (SELECT dst_loc FROM fx), (SELECT e2e_user FROM fx),
  jsonb_build_array(
    jsonb_build_object('transfer_line_id', (SELECT id FROM r_lines WHERE quantity = 4), 'accepted_quantity', 4),
    jsonb_build_object('transfer_line_id', (SELECT id FROM r_lines WHERE quantity = 3), 'accepted_quantity', 3)
  )
) AS result;
INSERT INTO test_log(line) SELECT is((result->>'status'), 'accepted', 'R9: an exact, complete explicit full-accept payload succeeds (status=accepted)') FROM r_full;

-- R10-R11: exact, complete explicit PARTIAL payload succeeds on a fresh transfer.
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT gen_random_uuid(), (SELECT org FROM fx), (SELECT src_branch FROM fx), 'ic4-r2-src-loc', 'IC4R2', true;
CREATE TEMP TABLE r2_loc AS SELECT id AS loc FROM warehouse_locations WHERE code = 'IC4R2';
SELECT inventory_create_and_finalize(
  (SELECT org FROM fx), (SELECT src_branch FROM fx), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 4, 'destination_location_id', (SELECT loc FROM r2_loc))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fx)
);
CREATE TEMP TABLE r2_1 AS
SELECT inventory_create_branch_transfer(
  (SELECT org FROM fx), (SELECT src_branch FROM fx), (SELECT dst_branch FROM fx),
  jsonb_build_array(
    jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'source_location_id', (SELECT loc FROM r2_loc), 'lot_id', NULL, 'serial_id', NULL, 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 2),
    jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'source_location_id', (SELECT loc FROM r2_loc), 'lot_id', NULL, 'serial_id', NULL, 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 2)
  ),
  'scenario R -- explicit complete partial', (SELECT e2e_user FROM fx)
) AS result;
CREATE TEMP TABLE r2_transfer AS SELECT (result->>'transfer_id')::uuid AS id FROM r2_1;
SELECT inventory_send_branch_transfer((SELECT id FROM r2_transfer), (SELECT e2e_user FROM fx));
CREATE TEMP TABLE r2_lines AS SELECT id, quantity FROM inventory_branch_transfer_lines WHERE transfer_id=(SELECT id FROM r2_transfer) ORDER BY created_at;

CREATE TEMP TABLE r2_partial AS
SELECT inventory_accept_branch_transfer(
  (SELECT id FROM r2_transfer), (SELECT dst_loc FROM fx), (SELECT e2e_user FROM fx),
  jsonb_build_array(
    jsonb_build_object('transfer_line_id', (SELECT id FROM r2_lines OFFSET 0 LIMIT 1), 'accepted_quantity', 2),
    jsonb_build_object('transfer_line_id', (SELECT id FROM r2_lines OFFSET 1 LIMIT 1), 'accepted_quantity', 0)
  )
) AS result;
INSERT INTO test_log(line) SELECT is((result->>'status'), 'partially_accepted', 'R10: an exact, complete explicit PARTIAL payload succeeds (status=partially_accepted)') FROM r2_partial;
INSERT INTO test_log(line) SELECT is(count(*), 1::bigint, 'R11: exactly one discrepancy row for the explicit-partial transfer''s own zero-accepted line') FROM inventory_branch_transfer_discrepancies WHERE transfer_id=(SELECT id FROM r2_transfer);

SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') AS not_ok_count, count(*) AS total_assertions FROM test_log;

ROLLBACK;
