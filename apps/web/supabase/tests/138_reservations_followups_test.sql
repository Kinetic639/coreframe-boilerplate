-- ============================================================================
-- TEST: Reservations follow-ups (docs/RESERVATIONS_BLOCKS_PLAN.md)
-- ============================================================================
-- A PZ makes ONE reservation document per repair order (a line per part);
-- approving a stock count whose shortage would take reserved (R) parts stops
-- with a clear message and changes nothing; once the reservation is released
-- the same count is approved.
-- Executed live against supabase-target via Supabase MCP; everything rolls back.

BEGIN;

SELECT plan(7);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, e2e_user uuid, v_std uuid, unit uuid,
  loc_prz uuid, ro uuid, ro2 uuid, rol_a uuid, rol_b uuid, rol_c uuid, cs uuid
);
GRANT SELECT, UPDATE ON fx TO authenticated;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch, org, '138-followups-branch', 993 FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT loc_prz, org, branch, '138 strefa przyjęć', '138-PRZ', true, 'receiving' FROM fx;

-- RO 138ZL: parts A and B (1 each). RO 138ZL2: part C (1).
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, zl_number, status)
SELECT ro, org, branch, '138-RO', '138ZL', 'open' FROM fx;
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, zl_number, status)
SELECT ro2, org, branch, '138-RO2', '138ZL2', 'open' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit)
SELECT rol_a, ro, 'P138A', '138 part A', 1, 'szt' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit)
SELECT rol_b, ro, 'P138B', '138 part B', 1, 'szt' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit)
SELECT rol_c, ro2, 'P138C', '138 part C', 1, 'szt' FROM fx;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

-- One PZ, three lines: A and B for 138ZL, C for 138ZL2.
CREATE TEMP TABLE r1 AS SELECT inventory_create_and_finalize_receipt(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(
    jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
      'quantity', 1, 'destination_location_id', (SELECT loc_prz FROM fx)),
    jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
      'quantity', 1, 'destination_location_id', (SELECT loc_prz FROM fx)),
    jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
      'quantity', 1, 'destination_location_id', (SELECT loc_prz FROM fx))),
  NULL, NULL, NULL, '138-PZ1', NULL, NULL, (SELECT e2e_user FROM fx),
  jsonb_build_array(
    jsonb_build_object('line_index', 1, 'zl_number', '138ZL', 'product_code', 'P138A'),
    jsonb_build_object('line_index', 2, 'zl_number', '138ZL', 'product_code', 'P138B'),
    jsonb_build_object('line_index', 3, 'zl_number', '138ZL2', 'product_code', 'P138C'))
) AS r;
GRANT SELECT ON r1 TO authenticated;

INSERT INTO test_log(line) SELECT ok(
  jsonb_array_length(r->'attribution'->'attributed') = 3
  AND (SELECT count(DISTINCT a->>'reservation_number') = 2 FROM jsonb_array_elements(r->'attribution'->'attributed') a),
  'T1: three PZ lines for two repair orders give two REZ documents') FROM r1;

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 1 FROM inventory_reservations
   WHERE reference_type = 'repair_order' AND reference_id = (SELECT ro FROM fx) AND reference_number = '138ZL')
  AND (SELECT count(*) = 2 FROM inventory_reservation_lines rl
       JOIN inventory_reservations r ON r.id = rl.reservation_id
       WHERE r.reference_id = (SELECT ro FROM fx)
         AND rl.repair_order_line_id IN ((SELECT rol_a FROM fx), (SELECT rol_b FROM fx))),
  'T2: 138ZL has one REZ (for the order) with a line for part A and a line for part B');

INSERT INTO test_log(line) SELECT ok(
  (SELECT on_hand_quantity = 3 AND reserved_quantity = 3 AND available_quantity = 0 FROM inventory_balances
   WHERE location_id = (SELECT loc_prz FROM fx) AND variant_id = (SELECT v_std FROM fx)),
  'T3: receiving zone: on hand 3, R 3, D 0');

-- A stock count finds only 2 there (shortage 1, but D = 0).
RESET ROLE;
INSERT INTO inventory_count_sessions (id, organization_id, branch_id, count_number, status)
SELECT cs, org, branch, '138-INW', 'submitted' FROM fx;
INSERT INTO inventory_count_lines (organization_id, branch_id, count_session_id, variant_id, location_id, unit_id,
  expected_quantity, counted_quantity, status, reason_code)
SELECT org, branch, cs, v_std, loc_prz, unit, 3, 2, 'approved', 'damage' FROM fx;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

DO $$
BEGIN
  PERFORM inventory_approve_count_session((SELECT cs FROM fx), (SELECT e2e_user FROM fx));
  INSERT INTO test_log(line) SELECT fail('T4: expected the count to be refused');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT ok(
    SQLSTATE = '22023'
    AND SQLERRM LIKE 'Count shortage of 1% for % at 138-PRZ exceeds the free stock (D 0%): 3% reserved (R) and 0% blocked (B) there.%',
    'T4: the count stops with a clear message (shortage, D, R, B, location): ' || SQLERRM);
END $$;

INSERT INTO test_log(line) SELECT ok(
  (SELECT status = 'submitted' FROM inventory_count_sessions WHERE id = (SELECT cs FROM fx))
  AND (SELECT on_hand_quantity = 3 AND reserved_quantity = 3 FROM inventory_balances
       WHERE location_id = (SELECT loc_prz FROM fx) AND variant_id = (SELECT v_std FROM fx)),
  'T5: nothing changed: the count is still submitted, stock and R as before');

-- Release part C's reservation (with a reason), then the same count is approved.
SELECT inventory_release_reservation_lines((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('reservation_line_id',
    (SELECT id FROM inventory_reservation_lines WHERE repair_order_line_id = (SELECT rol_c FROM fx)), 'quantity', NULL)),
  '138 część uszkodzona przy inwentaryzacji');

SELECT inventory_approve_count_session((SELECT cs FROM fx), (SELECT e2e_user FROM fx));

INSERT INTO test_log(line) SELECT ok(
  (SELECT status = 'approved' FROM inventory_count_sessions WHERE id = (SELECT cs FROM fx))
  AND (SELECT on_hand_quantity = 2 AND reserved_quantity = 2 AND available_quantity = 0 FROM inventory_balances
       WHERE location_id = (SELECT loc_prz FROM fx) AND variant_id = (SELECT v_std FROM fx)),
  'T6: after the release the count is approved: on hand 2, R 2 (A and B still reserved)');

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 1 FROM inventory_reservation_events
   WHERE repair_order_line_id = (SELECT rol_c FROM fx) AND event_type = 'released'
     AND reason = '138 część uszkodzona przy inwentaryzacji'),
  'T7: the release is in the reservation history with its reason');

DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 138 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
