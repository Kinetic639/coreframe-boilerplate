-- ============================================================================
-- TEST: IC-7 -- Inventory Security / Write-Boundary Closure
-- ============================================================================
-- Proves every fix this phase made, live, against the real canonical
-- engine and its own backing tables. Not a re-test of IC-1 through IC-6's
-- own business semantics (those remain covered by 097-109) -- this file
-- covers ONLY the security/write-boundary surface IC-7 itself closed:
-- the posted-header GUC bypass, the status-blind INSERT gap, the
-- reservation/allocation/container raw-write RLS gap, inventory_cancel_
-- movement's actor/permission gap, and confirms every legitimate
-- canonical path (movement, reservation, allocation, reversal) still
-- succeeds unchanged.
--
-- Executed live against supabase-target via Supabase MCP.

BEGIN;

SELECT plan(25);

CREATE TEMP TABLE fx (org uuid, branch uuid, e2e_user uuid, no_perm_user uuid, variant_1 uuid, unit_1 uuid, loc uuid);
GRANT SELECT ON fx TO authenticated, anon;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid, gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid, gen_random_uuid(),
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid, '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid,
  gen_random_uuid();

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated, anon;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated, anon;

INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch, org, '110-ic7-security-branch', 780 FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory)
SELECT loc, org, branch, '110-ic7-security-loc', true FROM fx;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

-- ============================================================================
-- SCENARIO T: legitimate canonical movement succeeds.
-- ============================================================================
CREATE TEMP TABLE posted AS
SELECT inventory_create_and_finalize(
  (SELECT org FROM fx), (SELECT branch FROM fx), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 10, 'destination_location_id', (SELECT loc FROM fx))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fx)
) AS result;
GRANT SELECT ON posted TO authenticated;
INSERT INTO test_log(line) SELECT is((result->>'status'), 'posted', 'T1: legitimate canonical movement (101 receipt) still succeeds') FROM posted;

-- A second, separate receipt so the reservation/allocation scenarios below
-- have their own uncommitted stock to work against -- T1's own 10 units
-- must remain fully uncommitted so Scenario C can legitimately reverse it
-- (reserving/allocating against the SAME movement's own stock would
-- correctly trip IC-1's own P0003 strand-check on reversal, which is
-- itself proof the invariant still holds, but would break this file's own
-- narrower "does the reversal LIFECYCLE TRANSITION still work" check).
SELECT inventory_create_and_finalize(
  (SELECT org FROM fx), (SELECT branch FROM fx), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 10, 'destination_location_id', (SELECT loc FROM fx))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fx)
);

-- ============================================================================
-- SCENARIO R: legitimate canonical reservation succeeds.
-- ============================================================================
CREATE TEMP TABLE res AS
SELECT inventory_create_reservation(
  p_organization_id := (SELECT org FROM fx), p_branch_id := (SELECT branch FROM fx),
  p_lines := jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT loc FROM fx), 'quantity', 5)),
  p_actor_user_id := (SELECT e2e_user FROM fx)
) AS result;
GRANT SELECT ON res TO authenticated;
INSERT INTO test_log(line) SELECT is((result->>'status'), 'active', 'R1: legitimate canonical reservation still succeeds') FROM res;

-- ============================================================================
-- SCENARIO S: legitimate canonical allocation succeeds.
-- ============================================================================
CREATE TEMP TABLE alloc AS
SELECT inventory_create_allocation(
  p_organization_id := (SELECT org FROM fx), p_branch_id := (SELECT branch FROM fx),
  p_lines := jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT loc FROM fx), 'quantity', 3)),
  p_actor_user_id := (SELECT e2e_user FROM fx)
) AS result;
GRANT SELECT ON alloc TO authenticated;
INSERT INTO test_log(line) SELECT is((result->>'status'), 'active', 'S1: legitimate canonical allocation still succeeds') FROM alloc;

-- ============================================================================
-- SCENARIO A/B: posted-header GUC bypass -- fully closed, structural, not
-- merely GUC-state-dependent.
-- ============================================================================
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT (result->>'movement_id')::uuid INTO v_id FROM posted;
  BEGIN
    UPDATE inventory_movement_headers SET document_number = 'HACKED-NO-GUC' WHERE id = v_id;
    INSERT INTO test_log(line) VALUES ('fail A1: raw UPDATE succeeded with no GUC touched at all');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'A1: posted header UPDATE denied with zero GUC manipulation (structural, not GUC-state-dependent)');
  END;
  BEGIN
    PERFORM set_config('ambra.inventory_movement_engine', 'on', true);
    UPDATE inventory_movement_headers SET document_number = 'HACKED-WITH-GUC' WHERE id = v_id;
    INSERT INTO test_log(line) VALUES ('fail B1: raw UPDATE succeeded with GUC deliberately set on');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'B1: posted header UPDATE denied even with the GUC deliberately set on (GUC is not authorization)');
  END;
  BEGIN
    UPDATE inventory_movement_headers SET movement_type_code = '401' WHERE id = v_id;
    INSERT INTO test_log(line) VALUES ('fail B2: movement_type_code UPDATE succeeded');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'B2: movement_type_code is also protected, not just document_number');
  END;
END $$;

-- ============================================================================
-- SCENARIO D: movement-line mutation denied after posting.
-- ============================================================================
DO $$
DECLARE v_id uuid; v_line_id uuid; v_rc int;
BEGIN
  SELECT (result->>'movement_id')::uuid INTO v_id FROM posted;
  SELECT id INTO v_line_id FROM inventory_movement_lines WHERE movement_id = v_id LIMIT 1;
  BEGIN
    UPDATE inventory_movement_lines SET quantity = 999999 WHERE id = v_line_id;
    GET DIAGNOSTICS v_rc = ROW_COUNT;
    INSERT INTO test_log(line) SELECT is(v_rc, 0, 'D1: posted movement line UPDATE affects zero rows (RLS status=draft scoping)');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT ok(true, 'D1: posted movement line UPDATE denied (' || SQLSTATE || ')');
  END;
END $$;
INSERT INTO test_log(line) SELECT is(quantity, 10::numeric, 'D2: line quantity genuinely unchanged after the D1 attempt') FROM inventory_movement_lines WHERE movement_id = (SELECT (result->>'movement_id')::uuid FROM posted);

-- ============================================================================
-- SCENARIO C: legitimate reversal lifecycle transition still works.
-- ============================================================================
CREATE TEMP TABLE reversal AS
SELECT inventory_reverse_movement((SELECT (result->>'movement_id')::uuid FROM posted), (SELECT e2e_user FROM fx), 'IC-7 pgTAP verification') AS result;
GRANT SELECT ON reversal TO authenticated;
INSERT INTO test_log(line) SELECT is((result->>'status'), 'posted', 'C1: legitimate reversal still succeeds') FROM reversal;
INSERT INTO test_log(line) SELECT is(status, 'reversed', 'C2: original header correctly transitions to reversed') FROM inventory_movement_headers WHERE id = (SELECT (result->>'movement_id')::uuid FROM posted);

-- ============================================================================
-- SCENARIO G/H/I: reservation raw-write denial.
-- ============================================================================
DO $$
DECLARE v_org uuid; v_branch uuid; v_rc int;
BEGIN
  SELECT org, branch INTO v_org, v_branch FROM fx;
  BEGIN
    INSERT INTO inventory_reservations (organization_id, branch_id, reservation_number, status)
    VALUES (v_org, v_branch, 'FORGED-RES', 'active');
    INSERT INTO test_log(line) VALUES ('fail G1: raw INSERT into inventory_reservations succeeded');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'G1: raw INSERT into inventory_reservations denied');
  END;

  UPDATE inventory_reservations SET status = 'cancelled' WHERE organization_id = v_org AND branch_id = v_branch;
  GET DIAGNOSTICS v_rc = ROW_COUNT;
  INSERT INTO test_log(line) SELECT is(v_rc, 0, 'H1: raw UPDATE on inventory_reservations affects zero rows');

  DELETE FROM inventory_reservations WHERE organization_id = v_org AND branch_id = v_branch;
  GET DIAGNOSTICS v_rc = ROW_COUNT;
  INSERT INTO test_log(line) SELECT is(v_rc, 0, 'I1: raw DELETE on inventory_reservations affects zero rows');
END $$;

-- ============================================================================
-- SCENARIO J/K/L: allocation raw-write denial.
-- ============================================================================
DO $$
DECLARE v_org uuid; v_branch uuid; v_rc int;
BEGIN
  SELECT org, branch INTO v_org, v_branch FROM fx;
  BEGIN
    INSERT INTO inventory_allocations (organization_id, branch_id, allocation_number, status)
    VALUES (v_org, v_branch, 'FORGED-ALLOC', 'active');
    INSERT INTO test_log(line) VALUES ('fail J1: raw INSERT into inventory_allocations succeeded');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'J1: raw INSERT into inventory_allocations denied');
  END;

  UPDATE inventory_allocations SET status = 'released' WHERE organization_id = v_org AND branch_id = v_branch;
  GET DIAGNOSTICS v_rc = ROW_COUNT;
  INSERT INTO test_log(line) SELECT is(v_rc, 0, 'K1: raw UPDATE on inventory_allocations affects zero rows');

  DELETE FROM inventory_allocations WHERE organization_id = v_org AND branch_id = v_branch;
  GET DIAGNOSTICS v_rc = ROW_COUNT;
  INSERT INTO test_log(line) SELECT is(v_rc, 0, 'L1: raw DELETE on inventory_allocations affects zero rows');
END $$;

-- ============================================================================
-- SCENARIO M: container raw-write denial (generic rows, not just
-- RepairOrder-owned ones).
-- ============================================================================
DO $$
DECLARE v_org uuid; v_branch uuid; v_loc uuid; v_rc int;
BEGIN
  SELECT org, branch, loc INTO v_org, v_branch, v_loc FROM fx;
  BEGIN
    INSERT INTO inventory_containers (organization_id, branch_id, code, type, current_location_id, status)
    VALUES (v_org, v_branch, 'FORGED-CONTAINER', 'box', v_loc, 'active');
    INSERT INTO test_log(line) VALUES ('fail M1: raw INSERT into inventory_containers succeeded');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'M1: raw INSERT into inventory_containers (generic, non-RepairOrder) denied');
  END;
END $$;

-- ============================================================================
-- SCENARIO N: internal helpers remain non-executable by ordinary roles.
-- ============================================================================
INSERT INTO test_log(line) SELECT ok(NOT has_function_privilege('authenticated', 'inventory_finalize_posting_internal(uuid,uuid,jsonb)', 'EXECUTE'), 'N1: inventory_finalize_posting_internal remains non-executable by authenticated');
INSERT INTO test_log(line) SELECT ok(NOT has_function_privilege('authenticated', 'write_repair_order_line_movement_link_internal(uuid,uuid,numeric,text,boolean)', 'EXECUTE'), 'N2: write_repair_order_line_movement_link_internal remains non-executable by authenticated');
INSERT INTO test_log(line) SELECT is((SELECT count(*) FROM pg_proc WHERE proname = 'rebuild_repair_order_projection_bucket_internal'), 0::bigint, 'N3 (A8): rebuild_repair_order_projection_bucket_internal no longer exists at all (removed, not merely non-executable)');

RESET ROLE;

-- ============================================================================
-- SCENARIO Q: anon representative -- inventory_cancel_movement denied at
-- the grant level.
-- ============================================================================
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM inventory_cancel_movement(gen_random_uuid(), gen_random_uuid(), 'anon exploit attempt');
    INSERT INTO test_log(line) VALUES ('fail Q1: anon call to inventory_cancel_movement succeeded');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'Q1: anon denied at the grant level on inventory_cancel_movement');
  END;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

-- ============================================================================
-- SCENARIO O/P: actor-spoof and NULL-actor sweep representative.
-- ============================================================================
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT (result->>'movement_id')::uuid INTO v_id FROM posted;
  BEGIN
    PERFORM inventory_cancel_movement(v_id, gen_random_uuid(), 'spoofed actor');
    INSERT INTO test_log(line) VALUES ('fail O1: actor-spoofed cancel succeeded');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '28000', 'O1: actor-spoofed cancel rejected (p_actor_user_id != auth.uid())');
  END;
  BEGIN
    PERFORM inventory_cancel_movement(v_id, NULL, 'null actor');
    INSERT INTO test_log(line) VALUES ('fail P1: NULL-actor cancel succeeded');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '28000', 'P1: NULL-actor cancel rejected');
  END;
END $$;

-- ============================================================================
-- SCENARIO E: cancel wrong actor denied (draft-status target).
-- ============================================================================
CREATE TEMP TABLE draft2 AS
SELECT inventory_create_draft(
  (SELECT org FROM fx), (SELECT branch FROM fx), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 1, 'destination_location_id', (SELECT loc FROM fx))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fx)
) AS result;
GRANT SELECT ON draft2 TO authenticated;
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT (result->>'movement_id')::uuid INTO v_id FROM draft2;
  BEGIN
    PERFORM inventory_cancel_movement(v_id, gen_random_uuid(), 'wrong actor');
    INSERT INTO test_log(line) VALUES ('fail E1: wrong-actor cancel succeeded');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '28000', 'E1: cancel with wrong actor UUID denied');
  END;
END $$;
RESET ROLE;

-- ============================================================================
-- SCENARIO F: cancel no-permission denied (real actor identity, zero
-- branch permission -- must be indistinguishable from "not found").
-- ============================================================================
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT no_perm_user FROM fx)::text, 'role', 'authenticated')::text, true);
DO $$
DECLARE v_id uuid; v_no_perm uuid;
BEGIN
  SELECT (result->>'movement_id')::uuid INTO v_id FROM draft2;
  SELECT no_perm_user INTO v_no_perm FROM fx;
  BEGIN
    PERFORM inventory_cancel_movement(v_id, v_no_perm, 'no permission');
    INSERT INTO test_log(line) VALUES ('fail F1: no-permission cancel succeeded');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0002', 'F1: no-permission cancel denied with the same non-leaking P0002 message as not-found');
  END;
END $$;
RESET ROLE;

SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') AS not_ok_count, count(*) AS total_assertions FROM test_log;

ROLLBACK;
