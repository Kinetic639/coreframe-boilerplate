-- ============================================================================
-- TEST: internal orders (ZW), stage E1
-- ============================================================================
-- Posting a PZ from a Matcher session creates one Ambra ZW per AutoStacja ZW
-- (numbered ZW/<no>/<yy>/<warehouse>), reserves a repair-order part through
-- its order (the REZ line names the ZW line) and parts of a stand-alone ZW
-- (another branch) under the ZW alone, never as free stock. A second delivery
-- of the same ZW joins the same Ambra ZW with its own receipt rows and REZ.
-- Executed live against supabase-target via Supabase MCP; everything rolls back.

BEGIN;

SELECT plan(12);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, e2e_user uuid, v_std uuid, unit uuid,
  loc_prz uuid, loc_l1 uuid, ro uuid, rol_a uuid,
  s1 uuid, f1 uuid, b1 uuid, b2 uuid, l1 uuid, l2 uuid, l3 uuid,
  s2 uuid, f2 uuid, b3 uuid, l4 uuid,
  yy text
);
GRANT SELECT, UPDATE ON fx TO authenticated;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  lpad((extract(year from now())::int % 100)::text, 2, '0');

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch, org, '140-zw-branch', 993 FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT loc_prz, org, branch, '140 strefa przyjęć', '140-PRZ', true, 'receiving' FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc_l1, org, branch, '140 regał', '140-L1', true FROM fx;

INSERT INTO repair_orders (id, organization_id, branch_id, order_number, zl_number, status)
SELECT ro, org, branch, '140-RO', 'ZLEC/140/26/9140/BL', 'open' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit)
SELECT rol_a, ro, 'P140A', '140 part A', 1, 'szt' FROM fx;

-- Session 1: ZW/91401 for the repair order (part A), ZW/91402 for WYSOG (W1, W2 x2).
INSERT INTO wdd_matcher_sessions (id, organization_id, branch_id, name, status)
SELECT s1, org, branch, '140 dostawa 1', 'ready_for_review' FROM fx;
INSERT INTO wdd_matcher_session_files (id, session_id, organization_id, file_role, file_name)
SELECT f1, s1, org, 'bc', '140-1.pdf' FROM fx;
INSERT INTO wdd_matcher_blocks (id, session_file_id, session_id, organization_id, block_index, block_type, metadata)
SELECT b1, f1, s1, org, 0, 'direct_order',
  jsonb_build_object('zw_number', 'ZW/91401/26/9140', 'zl_number', 'ZLEC/140/26/9140/BL',
                     'client_name', 'Klient 140', 'order_number', 'BLWK/1') FROM fx;
INSERT INTO wdd_matcher_blocks (id, session_file_id, session_id, organization_id, block_index, block_type, metadata)
SELECT b2, f1, s1, org, 1, 'direct_order',
  jsonb_build_object('zw_number', 'ZW/91402/26/9140', 'manual_note', 'WYSOG',
                     'client_name', '3642 Blacharnia Audi (83570)') FROM fx;
INSERT INTO wdd_matcher_lines (id, block_id, session_id, organization_id, line_number, product_code, product_name, quantity)
SELECT l1, b1, s1, org, 1, 'P140A', '140 part A', 1 FROM fx;
INSERT INTO wdd_matcher_lines (id, block_id, session_id, organization_id, line_number, product_code, product_name, quantity)
SELECT l2, b2, s1, org, 1, 'P140W1', '140 part W1', 1 FROM fx;
INSERT INTO wdd_matcher_lines (id, block_id, session_id, organization_id, line_number, product_code, product_name, quantity)
SELECT l3, b2, s1, org, 2, 'P140W2', '140 part W2', 2 FROM fx;

-- Session 2: the rest of ZW/91402 (W3).
INSERT INTO wdd_matcher_sessions (id, organization_id, branch_id, name, status)
SELECT s2, org, branch, '140 dostawa 2', 'ready_for_review' FROM fx;
INSERT INTO wdd_matcher_session_files (id, session_id, organization_id, file_role, file_name)
SELECT f2, s2, org, 'bc', '140-2.pdf' FROM fx;
INSERT INTO wdd_matcher_blocks (id, session_file_id, session_id, organization_id, block_index, block_type, metadata)
SELECT b3, f2, s2, org, 0, 'direct_order',
  jsonb_build_object('zw_number', 'ZW/91402/26/9140', 'manual_note', 'WYSOG',
                     'client_name', '3642 Blacharnia Audi (83570)') FROM fx;
INSERT INTO wdd_matcher_lines (id, block_id, session_id, organization_id, line_number, product_code, product_name, quantity)
SELECT l4, b3, s2, org, 1, 'P140W3', '140 part W3', 1 FROM fx;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

-- PZ 1: A (the import sends the block's "order number" BLWK/1 as its ZL), W1, W2 x2, 1 free.
SELECT inventory_create_and_finalize_receipt(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(
    jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
      'quantity', 1, 'destination_location_id', (SELECT loc_prz FROM fx)),
    jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
      'quantity', 1, 'destination_location_id', (SELECT loc_prz FROM fx)),
    jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
      'quantity', 2, 'destination_location_id', (SELECT loc_prz FROM fx)),
    jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
      'quantity', 1, 'destination_location_id', (SELECT loc_prz FROM fx))),
  NULL, NULL, NULL, '140-PZ1', NULL, NULL, (SELECT e2e_user FROM fx),
  jsonb_build_array(
    jsonb_build_object('line_index', 1, 'zl_number', 'BLWK/1', 'product_code', 'P140A', 'source_line_id', (SELECT l1 FROM fx)),
    jsonb_build_object('line_index', 2, 'zl_number', 'ZW/91402/26/9140', 'product_code', 'P140W1', 'source_line_id', (SELECT l2 FROM fx)),
    jsonb_build_object('line_index', 3, 'zl_number', 'ZW/91402/26/9140', 'product_code', 'P140W2', 'source_line_id', (SELECT l3 FROM fx))));

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 2 FROM internal_orders WHERE branch_id = (SELECT branch FROM fx))
  AND (SELECT bool_and(order_number ~ ('^ZW/[0-9]+/' || (SELECT yy FROM fx) || '/9140$') AND warehouse_code = '9140')
       FROM internal_orders WHERE branch_id = (SELECT branch FROM fx))
  AND (SELECT max(order_no) - min(order_no) = 1 FROM internal_orders WHERE branch_id = (SELECT branch FROM fx)),
  'T1: one Ambra ZW per AutoStacja ZW, numbered ZW/<no>/<yy>/<warehouse> in sequence');

INSERT INTO test_log(line) SELECT ok(
  (SELECT repair_order_id = (SELECT ro FROM fx) AND client_kind = 'repair_order' AND destination_code IS NULL
   FROM internal_orders WHERE external_number = 'ZW/91401/26/9140')
  AND (SELECT repair_order_id IS NULL AND client_kind = 'branch' AND destination_code = 'WYSOG'
       AND client_name = '3642 Blacharnia Audi (83570)'
       FROM internal_orders WHERE external_number = 'ZW/91402/26/9140'),
  'T2: the ZL block''s ZW belongs to the repair order (not to BLWK/1), the WYSOG ZW stands alone');

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 1 FROM inventory_reservation_lines rl
   JOIN inventory_reservations r ON r.id = rl.reservation_id
   JOIN internal_order_lines iol ON iol.id = rl.internal_order_line_id
   WHERE r.reference_type = 'repair_order' AND r.reference_id = (SELECT ro FROM fx)
     AND rl.repair_order_line_id = (SELECT rol_a FROM fx) AND rl.reserved_quantity = 1
     AND iol.repair_order_line_id = (SELECT rol_a FROM fx) AND iol.source_matcher_line_id = (SELECT l1 FROM fx)),
  'T3: part A is reserved through its repair order and the REZ line names its ZW line');

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(DISTINCT r.id) = 1 AND count(*) = 2 AND SUM(rl.reserved_quantity) = 3
   FROM inventory_reservation_lines rl
   JOIN inventory_reservations r ON r.id = rl.reservation_id
   JOIN internal_orders io ON io.id = r.reference_id
   WHERE r.reference_type = 'internal_order' AND io.external_number = 'ZW/91402/26/9140'
     AND rl.repair_order_line_id IS NULL AND rl.internal_order_line_id IS NOT NULL),
  'T4: the WYSOG parts are on ONE REZ under the ZW alone (2 lines, 3 pcs)');

CREATE TEMP TABLE pend AS SELECT inventory_receiving_pending((SELECT org FROM fx), (SELECT branch FROM fx)) AS p;
GRANT SELECT ON pend TO authenticated;
INSERT INTO test_log(line) SELECT ok(
  (SELECT SUM((it->>'quantity')::numeric) = 3 AND bool_and(it->>'internal_order_destination' = 'WYSOG')
   FROM pend, jsonb_array_elements(p->'items') it WHERE it->>'internal_order_line_id' IS NOT NULL)
  AND (SELECT SUM((it->>'quantity')::numeric) = 1
       FROM pend, jsonb_array_elements(p->'items') it
       WHERE it->>'internal_order_line_id' IS NULL AND it->>'repair_order_line_id' IS NULL)
  AND (SELECT SUM((it->>'quantity')::numeric) = 1
       FROM pend, jsonb_array_elements(p->'items') it WHERE it->>'repair_order_line_id' IS NOT NULL),
  'T5: the receiving zone shows 1 for the order, 3 under the WYSOG ZW and only 1 free');

DO $$
BEGIN
  PERFORM inventory_putaway_batch((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
    (SELECT loc_l1 FROM fx), NULL, NULL,
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'quantity', 2)));
  INSERT INTO test_log(line) SELECT fail('T6: expected putting away 2 free to be refused (only 1 is free)');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT ok(SQLERRM = 'Not enough free stock of this item in the receiving zone',
    'T6: parts under a ZW cannot be put away as free stock');
END $$;

-- Part A goes away to L1; its reservation keeps the ZW line.
SELECT inventory_putaway_batch((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT loc_l1 FROM fx), NULL, NULL,
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'quantity', 1,
    'repair_order_line_id', (SELECT rol_a FROM fx))));

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 1 FROM inventory_reservation_lines rl
   JOIN internal_order_lines iol ON iol.id = rl.internal_order_line_id
   WHERE rl.location_id = (SELECT loc_l1 FROM fx) AND iol.source_matcher_line_id = (SELECT l1 FROM fx)
     AND rl.moved_from_line_id IS NOT NULL)
  AND (SELECT reserved_quantity = 1 AND received_quantity = 1 FROM internal_order_line_status s
       JOIN internal_order_lines iol ON iol.id = s.internal_order_line_id
       WHERE iol.source_matcher_line_id = (SELECT l1 FROM fx)),
  'T7: after putaway (into its container) part A is still R = 1 under its ZW line');

-- PZ 2: the rest of ZW/91402.
SELECT inventory_create_and_finalize_receipt(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(
    jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
      'quantity', 1, 'destination_location_id', (SELECT loc_prz FROM fx))),
  NULL, NULL, NULL, '140-PZ2', NULL, NULL, (SELECT e2e_user FROM fx),
  jsonb_build_array(
    jsonb_build_object('line_index', 1, 'zl_number', 'ZW/91402/26/9140', 'product_code', 'P140W3', 'source_line_id', (SELECT l4 FROM fx))));

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 1 FROM internal_orders WHERE external_number = 'ZW/91402/26/9140')
  AND (SELECT count(*) = 3 FROM internal_order_lines iol JOIN internal_orders io ON io.id = iol.internal_order_id
       WHERE io.external_number = 'ZW/91402/26/9140')
  AND (SELECT array_agg(line_number ORDER BY line_number) = ARRAY[1, 2, 3]
       FROM internal_order_lines iol JOIN internal_orders io ON io.id = iol.internal_order_id
       WHERE io.external_number = 'ZW/91402/26/9140'),
  'T8: the second delivery joins the same ZW as a new line 3, nothing duplicated');

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(DISTINCT iml.movement_id) = 2 AND count(*) = 3
   FROM internal_order_line_movement_links k
   JOIN internal_order_lines iol ON iol.id = k.internal_order_line_id
   JOIN internal_orders io ON io.id = iol.internal_order_id
   JOIN inventory_movement_lines iml ON iml.id = k.inventory_movement_line_id
   WHERE io.external_number = 'ZW/91402/26/9140' AND k.relation_type = 'receipt')
  AND (SELECT count(DISTINCT r.id) = 2 FROM inventory_reservations r
       JOIN internal_orders io ON io.id = r.reference_id
       WHERE r.reference_type = 'internal_order' AND io.external_number = 'ZW/91402/26/9140'),
  'T9: each delivery is its own receipt rows and its own REZ under the ZW');

INSERT INTO test_log(line) SELECT ok(
  (SELECT SUM(s.received_quantity) = 4 AND SUM(s.reserved_quantity) = 4 AND SUM(s.issued_quantity) = 0
   FROM internal_order_line_status s JOIN internal_orders io ON io.id = s.internal_order_id
   WHERE io.external_number = 'ZW/91402/26/9140'),
  'T10: the WYSOG ZW shows 4 received, 4 reserved, 0 issued');

DO $$
BEGIN
  INSERT INTO internal_orders (organization_id, branch_id, order_number, order_no, order_year, warehouse_code, client_kind, source)
  VALUES ((SELECT org FROM fx), (SELECT branch FROM fx), 'ZW/999/26/9140', 999, 26, '9140', 'other', 'manual');
  INSERT INTO test_log(line) SELECT fail('T11: expected a direct insert into internal_orders to be refused');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT ok(true, 'T11: users cannot write internal orders directly');
END $$;

DO $$
BEGIN
  PERFORM internal_order_next_number_internal((SELECT org FROM fx), '9140');
  INSERT INTO test_log(line) SELECT fail('T12: expected the numbering helper to be refused');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO test_log(line) SELECT ok(true, 'T12: the ZW helpers are not callable by users');
END $$;

DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 140 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
