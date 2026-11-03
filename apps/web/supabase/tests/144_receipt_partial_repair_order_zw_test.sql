-- ============================================================================
-- TEST: PZ from a Matcher session, a ZW line only partly for its repair order
-- ============================================================================
-- Part A of ZW/91441 is delivered 2, the repair order needs 1: 1 is reserved
-- for the order, 1 under the ZW. Part B of the same order follows. Both ZW
-- receipt rows of A used to collide (one ZW line, one PZ line), the line was
-- rolled back with the order's new REZ, and B then failed "Reservation not
-- found" -- the whole PZ could not be posted.
-- Executed live against supabase-target via Supabase MCP; everything rolls back.

BEGIN;

SELECT plan(5);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, e2e_user uuid, v_std uuid, unit uuid,
  loc_prz uuid, ro uuid, rol_a uuid, rol_b uuid,
  s1 uuid, f1 uuid, b1 uuid, l1 uuid, l2 uuid, pz uuid
);
GRANT SELECT, UPDATE ON fx TO authenticated;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  null;

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch, org, '144-zw-branch', 992 FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT loc_prz, org, branch, '144 strefa przyjęć', '144-PRZ', true, 'receiving' FROM fx;

INSERT INTO repair_orders (id, organization_id, branch_id, order_number, zl_number, status)
SELECT ro, org, branch, '144-RO', 'ZLEC/144/26/9144/BL', 'open' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit)
SELECT rol_a, ro, 'P144A', '144 part A', 1, 'szt' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit)
SELECT rol_b, ro, 'P144B', '144 part B', 1, 'szt' FROM fx;

INSERT INTO wdd_matcher_sessions (id, organization_id, branch_id, name, status)
SELECT s1, org, branch, '144 dostawa', 'ready_for_review' FROM fx;
INSERT INTO wdd_matcher_session_files (id, session_id, organization_id, file_role, file_name)
SELECT f1, s1, org, 'bc', '144.pdf' FROM fx;
INSERT INTO wdd_matcher_blocks (id, session_file_id, session_id, organization_id, block_index, block_type, metadata)
SELECT b1, f1, s1, org, 0, 'direct_order',
  jsonb_build_object('zw_number', 'ZW/91441/26/9144', 'zl_number', 'ZLEC/144/26/9144/BL',
                     'client_name', 'Klient 144') FROM fx;
INSERT INTO wdd_matcher_lines (id, block_id, session_id, organization_id, line_number, product_code, product_name, quantity)
SELECT l1, b1, s1, org, 1, 'P144A', '144 part A', 2 FROM fx;
INSERT INTO wdd_matcher_lines (id, block_id, session_id, organization_id, line_number, product_code, product_name, quantity)
SELECT l2, b1, s1, org, 2, 'P144B', '144 part B', 1 FROM fx;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

UPDATE fx SET pz = (inventory_create_and_finalize_receipt(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(
    jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
      'quantity', 2, 'destination_location_id', (SELECT loc_prz FROM fx)),
    jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
      'quantity', 1, 'destination_location_id', (SELECT loc_prz FROM fx))),
  NULL, NULL, NULL, '144-PZ', NULL, NULL, (SELECT e2e_user FROM fx),
  jsonb_build_array(
    jsonb_build_object('line_index', 1, 'zl_number', 'ZLEC/144/26/9144/BL', 'product_code', 'P144A', 'source_line_id', (SELECT l1 FROM fx)),
    jsonb_build_object('line_index', 2, 'zl_number', 'ZLEC/144/26/9144/BL', 'product_code', 'P144B', 'source_line_id', (SELECT l2 FROM fx)))
) ->> 'movement_id')::uuid;
RESET ROLE;

INSERT INTO test_log(line) SELECT ok(
  (SELECT status = 'posted' FROM inventory_movement_headers WHERE id = (SELECT pz FROM fx)),
  'T1: the PZ is posted');

INSERT INTO test_log(line) SELECT ok(
  (SELECT SUM(rl.reserved_quantity) = 2 FROM inventory_reservation_lines rl
   JOIN inventory_reservations r ON r.id = rl.reservation_id
   WHERE r.reference_type = 'repair_order' AND r.reference_id = (SELECT ro FROM fx))
  AND (SELECT count(DISTINCT rl.reservation_id) = 1 FROM inventory_reservation_lines rl
       WHERE rl.repair_order_line_id IN ((SELECT rol_a FROM fx), (SELECT rol_b FROM fx))),
  'T2: A (1 of 2) and B (1) are reserved for the repair order, on one REZ');

INSERT INTO test_log(line) SELECT ok(
  (SELECT SUM(rl.reserved_quantity) = 1 FROM inventory_reservation_lines rl
   JOIN inventory_reservations r ON r.id = rl.reservation_id
   WHERE r.reference_type = 'internal_order' AND rl.repair_order_line_id IS NULL
     AND rl.source_movement_line_id IN (SELECT id FROM inventory_movement_lines WHERE movement_id = (SELECT pz FROM fx))),
  'T3: the second A waits under its ZW, not as free stock');

INSERT INTO test_log(line) SELECT ok(
  (SELECT s.received_quantity = 2 FROM internal_order_line_status s
   JOIN internal_order_lines iol ON iol.id = s.internal_order_line_id
   WHERE iol.source_matcher_line_id = (SELECT l1 FROM fx)),
  'T4: the ZW line of A counts both pieces received');

INSERT INTO test_log(line) SELECT is(
  (SELECT reserved_quantity FROM inventory_balances
   WHERE location_id = (SELECT loc_prz FROM fx) AND variant_id = (SELECT v_std FROM fx)),
  3::numeric, 'T5: all 3 received pieces are reserved in the receiving zone, none free');

DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 144 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
