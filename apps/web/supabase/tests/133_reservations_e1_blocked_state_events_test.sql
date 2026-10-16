-- ============================================================================
-- TEST: Reservations & blocks, stage E1 (docs/RESERVATIONS_BLOCKS_PLAN.md)
-- ============================================================================
-- B (blocked) on the balance: part of D (available), non-negative, a
-- commitment change for the balance guard, counted by the posting engine.
-- Hard invariant D >= 0. Reservation lines name their repair-order line.
-- inventory_reservation_events: engine-only writes, append-only, RLS read.
-- Executed live against supabase-target via Supabase MCP; everything rolls back.

BEGIN;

SELECT plan(14);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, e2e_user uuid, v_std uuid, unit uuid,
  loc_a uuid, loc_b uuid, pz uuid, res uuid, res_line uuid, ev uuid
);
GRANT SELECT, UPDATE ON fx TO authenticated;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid,
  gen_random_uuid(), gen_random_uuid(), null, gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch, org, '133-e1-branch', 995 FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc_a, org, branch, '133 regał A', '133-A', true FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc_b, org, branch, '133 regał B', '133-B', true FROM fx;

-- 5 pcs on A, posted as the user.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);
UPDATE fx SET pz = (inventory_create_and_finalize(
  (SELECT org FROM fx), (SELECT branch FROM fx), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
    'quantity', 5, 'destination_location_id', (SELECT loc_a FROM fx))),
  NULL, NULL, NULL, '133-PZ', NULL, NULL, (SELECT e2e_user FROM fx)
) ->> 'movement_id')::uuid;
RESET ROLE;

-- B = 2 through the engine flag.
SELECT set_config('ambra.inventory_movement_engine', 'on', true);
UPDATE inventory_balances SET blocked = 2
WHERE location_id = (SELECT loc_a FROM fx) AND variant_id = (SELECT v_std FROM fx);

INSERT INTO test_log(line) SELECT ok(
  (SELECT on_hand_quantity = 5 AND blocked = 2 AND available_quantity = 3 FROM inventory_balances
   WHERE location_id = (SELECT loc_a FROM fx) AND variant_id = (SELECT v_std FROM fx)),
  'T1: D = on_hand - R - B (5 - 0 - 2 = 3)');

DO $$
BEGIN
  UPDATE inventory_balances SET blocked = -1
  WHERE location_id = (SELECT loc_a FROM fx) AND variant_id = (SELECT v_std FROM fx);
  INSERT INTO test_log(line) SELECT fail('T2: expected negative B to be rejected');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '23514', 'T2: B cannot be negative');
END $$;

DO $$
BEGIN
  UPDATE inventory_balances SET blocked = 6
  WHERE location_id = (SELECT loc_a FROM fx) AND variant_id = (SELECT v_std FROM fx);
  INSERT INTO test_log(line) SELECT fail('T3: expected D < 0 to be rejected');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '23514', 'T3: D can never go below zero (B 6 > on_hand 5)');
END $$;

DO $$
BEGIN
  UPDATE inventory_balances SET blocked = 1, on_hand_quantity = 4
  WHERE location_id = (SELECT loc_a FROM fx) AND variant_id = (SELECT v_std FROM fx);
  INSERT INTO test_log(line) SELECT fail('T4: expected a combined physical + B change to be rejected');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'T4: the guard refuses a physical change combined with a B change');
END $$;

SELECT set_config('ambra.inventory_movement_engine', 'off', true);
DO $$
BEGIN
  UPDATE inventory_balances SET blocked = 1
  WHERE location_id = (SELECT loc_a FROM fx) AND variant_id = (SELECT v_std FROM fx);
  INSERT INTO test_log(line) SELECT fail('T5: expected a B change outside the engine to be rejected');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'T5: B changes only through the engine');
END $$;

-- Posting: a decrease may only take D.
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM inventory_create_and_finalize(
    (SELECT org FROM fx), (SELECT branch FROM fx), '801',
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
      'quantity', 4, 'source_location_id', (SELECT loc_a FROM fx), 'destination_location_id', (SELECT loc_b FROM fx))),
    NULL, NULL, NULL, '133-MM-4', NULL, NULL, (SELECT e2e_user FROM fx));
  INSERT INTO test_log(line) SELECT fail('T6: expected MM taking blocked stock to be rejected');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0003', 'T6: MM of 4 is refused when only 3 are available (2 blocked)');
END $$;

SELECT inventory_create_and_finalize(
  (SELECT org FROM fx), (SELECT branch FROM fx), '801',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
    'quantity', 3, 'source_location_id', (SELECT loc_a FROM fx), 'destination_location_id', (SELECT loc_b FROM fx))),
  NULL, NULL, NULL, '133-MM-3', NULL, NULL, (SELECT e2e_user FROM fx));
RESET ROLE;

INSERT INTO test_log(line) SELECT ok(
  (SELECT on_hand_quantity = 2 AND blocked = 2 AND available_quantity = 0 FROM inventory_balances
   WHERE location_id = (SELECT loc_a FROM fx) AND variant_id = (SELECT v_std FROM fx))
  AND (SELECT on_hand_quantity = 3 AND available_quantity = 3 FROM inventory_balances
   WHERE location_id = (SELECT loc_b FROM fx) AND variant_id = (SELECT v_std FROM fx)),
  'T7: MM of the 3 available succeeds; the 2 blocked stay on A');

-- Reservation lines: new columns, backfill of per-line repair-order reservations.
INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 3 FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'inventory_reservation_lines'
     AND column_name IN ('repair_order_line_id', 'source_movement_line_id', 'moved_from_line_id')),
  'T8: reservation lines carry repair_order_line_id, source_movement_line_id, moved_from_line_id');
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*)::int FROM inventory_reservation_lines rl JOIN inventory_reservations r ON r.id = rl.reservation_id
   WHERE r.reference_type = 'repair_order_line' AND rl.repair_order_line_id IS DISTINCT FROM r.reference_id),
  0, 'T9: every existing repair-order-line reservation names its line');

-- Reservation history: engine-only writes, append-only, RLS read.
INSERT INTO inventory_reservations (id, organization_id, branch_id, reservation_number, reference_type, created_by)
SELECT res, org, branch, '133-RES', 'test', e2e_user FROM fx;
INSERT INTO inventory_reservation_events (id, organization_id, branch_id, reservation_id, event_type, quantity, location_id, reason, actor_user_id)
SELECT ev, org, branch, res, 'created', 1, loc_a, '133 test', e2e_user FROM fx;

DO $$
BEGIN
  UPDATE inventory_reservation_events SET quantity = 2 WHERE id = (SELECT ev FROM fx);
  INSERT INTO test_log(line) SELECT fail('T10: expected an event update to be rejected');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'T10: reservation history is append-only (no UPDATE, even for the owner)');
END $$;

SET LOCAL ROLE authenticated;
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*)::int FROM inventory_reservation_events WHERE id = (SELECT ev FROM fx)),
  1, 'T11: a user with warehouse.inventory.read sees the branch''s reservation history');

DO $$
BEGIN
  INSERT INTO inventory_reservation_events (organization_id, branch_id, reservation_id, event_type, quantity)
  SELECT org, branch, res, 'created', 1 FROM fx;
  INSERT INTO test_log(line) SELECT fail('T12: expected a direct event insert to be rejected');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'T12: users cannot write reservation history directly');
END $$;

RESET ROLE;

INSERT INTO test_log(line) SELECT ok(
  NOT has_table_privilege('authenticated', 'public.inventory_reservation_events', 'DELETE')
  AND NOT has_table_privilege('authenticated', 'public.inventory_reservation_events', 'UPDATE'),
  'T13: users hold no DELETE/UPDATE privilege on reservation history');

INSERT INTO test_log(line) SELECT ok(
  NOT has_table_privilege('anon', 'public.inventory_reservation_events', 'SELECT'),
  'T14: anon cannot read reservation history');

SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') AS not_ok_count, count(*) AS total_assertions FROM test_log;

-- Report the result as an error so it shows up in the SQL Editor (which only displays the
-- last statement); the error also aborts the transaction, so nothing is kept.
DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 133 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
