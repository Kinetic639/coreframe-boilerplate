-- ============================================================================
-- TEST: one operation on many parts = one document
-- ============================================================================
-- Putting away a selection posts ONE MM (a line per part) and ONE KON per
-- repair-order container; the reservations move with the parts. Moving two
-- blocked parts posts ONE MM. Moving two reservations to another order
-- creates ONE REZ. The putaway engine helper is not callable by users.
-- Executed live against supabase-target via Supabase MCP; everything rolls back.

BEGIN;

SELECT plan(12);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, e2e_user uuid, v_std uuid, unit uuid,
  loc_prz uuid, loc_l1 uuid, loc_l2 uuid,
  ro uuid, ro2 uuid, ro3 uuid, ro4 uuid,
  rol_a uuid, rol_b uuid, rol_c uuid, rol_e1 uuid, rol_e2 uuid, rol_g1 uuid, rol_g2 uuid,
  mm uuid, blk_line1 uuid, blk_line2 uuid
);
GRANT SELECT, UPDATE ON fx TO authenticated;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(),
  null, null, null;

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch, org, '139-one-doc-branch', 992 FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT loc_prz, org, branch, '139 strefa przyjęć', '139-PRZ', true, 'receiving' FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc_l1, org, branch, '139 regał', '139-L1', true FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc_l2, org, branch, '139 półka reklamacji', '139-L2', true FROM fx;

-- 139ZL: parts A, B. 139ZL2: part C. 139ZL3: E1, E2 (reserved later). 139ZL4: G1, G2 (target).
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, zl_number, status)
SELECT ro, org, branch, '139-RO', '139ZL', 'open' FROM fx;
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, zl_number, status)
SELECT ro2, org, branch, '139-RO2', '139ZL2', 'open' FROM fx;
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, zl_number, status)
SELECT ro3, org, branch, '139-RO3', '139ZL3', 'open' FROM fx;
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, zl_number, status)
SELECT ro4, org, branch, '139-RO4', '139ZL4', 'open' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit)
SELECT rol_a, ro, 'P139A', '139 part A', 1, 'szt' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit)
SELECT rol_b, ro, 'P139B', '139 part B', 1, 'szt' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit)
SELECT rol_c, ro2, 'P139C', '139 part C', 1, 'szt' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit, variant_id)
SELECT rol_e1, ro3, 'P139E1', '139 part E1', 1, 'szt', v_std FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit, variant_id)
SELECT rol_e2, ro3, 'P139E2', '139 part E2', 1, 'szt', v_std FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit, variant_id)
SELECT rol_g1, ro4, 'P139G1', '139 part G1', 1, 'szt', v_std FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit, variant_id)
SELECT rol_g2, ro4, 'P139G2', '139 part G2', 1, 'szt', v_std FROM fx;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

-- PZ: A, B for 139ZL, C for 139ZL2 (reserved), 2 free.
SELECT inventory_create_and_finalize_receipt(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(
    jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
      'quantity', 1, 'destination_location_id', (SELECT loc_prz FROM fx)),
    jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
      'quantity', 1, 'destination_location_id', (SELECT loc_prz FROM fx)),
    jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
      'quantity', 1, 'destination_location_id', (SELECT loc_prz FROM fx)),
    jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
      'quantity', 2, 'destination_location_id', (SELECT loc_prz FROM fx))),
  NULL, NULL, NULL, '139-PZ1', NULL, NULL, (SELECT e2e_user FROM fx),
  jsonb_build_array(
    jsonb_build_object('line_index', 1, 'zl_number', '139ZL', 'product_code', 'P139A'),
    jsonb_build_object('line_index', 2, 'zl_number', '139ZL', 'product_code', 'P139B'),
    jsonb_build_object('line_index', 3, 'zl_number', '139ZL2', 'product_code', 'P139C')));

-- One putaway of all four lines to L1.
CREATE TEMP TABLE pb AS SELECT inventory_putaway_batch((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT loc_l1 FROM fx), NULL, NULL,
  jsonb_build_array(
    jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'quantity', 1, 'repair_order_line_id', (SELECT rol_a FROM fx)),
    jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'quantity', 1, 'repair_order_line_id', (SELECT rol_b FROM fx)),
    jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'quantity', 1, 'repair_order_line_id', (SELECT rol_c FROM fx)),
    jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'quantity', 2))) AS r;
GRANT SELECT ON pb TO authenticated;
UPDATE fx SET mm = (SELECT (r->>'movement_id')::uuid FROM pb);

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 1 FROM inventory_movement_headers h
   WHERE h.branch_id = (SELECT branch FROM fx) AND h.movement_type_code = '801')
  AND (SELECT count(*) = 4 FROM inventory_movement_lines WHERE movement_id = (SELECT mm FROM fx))
  AND (SELECT (r->>'line_count')::int = 4 FROM pb),
  'T1: putting away 4 lines (3 for orders, 1 free) posts ONE MM with 4 lines');

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 2 FROM inventory_allocations
   WHERE branch_id = (SELECT branch FROM fx) AND allocation_number LIKE 'KON/%')
  AND (SELECT count(*) = 2 FROM inventory_allocation_lines al JOIN inventory_allocations a ON a.id = al.allocation_id
       WHERE a.reference_type = 'repair_order' AND a.reference_id = (SELECT ro FROM fx)),
  'T2: ONE KON per repair-order container (139ZL holds A and B on one KON)');

INSERT INTO test_log(line) SELECT ok(
  (SELECT COALESCE(SUM(cl.quantity), 0) = 2 FROM inventory_container_lines cl JOIN inventory_containers c ON c.id = cl.container_id
   WHERE c.code = 'K-139ZL-01' AND c.branch_id = (SELECT branch FROM fx) AND cl.deleted_at IS NULL)
  AND (SELECT COALESCE(SUM(cl.quantity), 0) = 1 FROM inventory_container_lines cl JOIN inventory_containers c ON c.id = cl.container_id
   WHERE c.code = 'K-139ZL2-01' AND c.branch_id = (SELECT branch FROM fx) AND cl.deleted_at IS NULL),
  'T3: each order''s parts are in its own container at L1');

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 3 FROM inventory_reservation_events
   WHERE event_type = 'moved' AND movement_id = (SELECT mm FROM fx)
     AND location_id = (SELECT loc_prz FROM fx) AND to_location_id = (SELECT loc_l1 FROM fx)),
  'T4: the three reservations moved with their parts, all with the same MM');

INSERT INTO test_log(line) SELECT ok(
  (SELECT on_hand_quantity = 5 AND allocated_quantity = 3 AND reserved_quantity = 0 AND available_quantity = 2
   FROM inventory_balances WHERE location_id = (SELECT loc_l1 FROM fx) AND variant_id = (SELECT v_std FROM fx))
  AND (SELECT COALESCE(SUM(on_hand_quantity), 0) = 0 FROM inventory_balances WHERE location_id = (SELECT loc_prz FROM fx)),
  'T5: L1 has 5 (3 in containers, 2 free), the receiving zone is empty');

-- Block the 2 free parts (two block documents), then move both to L2 at once.
CREATE TEMP TABLE b1 AS SELECT inventory_block_stock((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(
    jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'location_id', (SELECT loc_l1 FROM fx), 'quantity', 1)),
  'damaged', '139 uszkodzona 1', NULL, NULL, NULL) AS r;
CREATE TEMP TABLE b2 AS SELECT inventory_block_stock((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(
    jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'location_id', (SELECT loc_l1 FROM fx), 'quantity', 1)),
  'damaged', '139 uszkodzona 2', NULL, NULL, NULL) AS r;
GRANT SELECT ON b1, b2 TO authenticated;
UPDATE fx SET blk_line1 = (SELECT (r->'lines'->0->>'block_line_id')::uuid FROM b1),
              blk_line2 = (SELECT (r->'lines'->0->>'block_line_id')::uuid FROM b2);

CREATE TEMP TABLE mvb AS SELECT inventory_move_blocked_stock_lines((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(
    jsonb_build_object('block_line_id', (SELECT blk_line1 FROM fx)),
    jsonb_build_object('block_line_id', (SELECT blk_line2 FROM fx))),
  (SELECT loc_l2 FROM fx)) AS r;
GRANT SELECT ON mvb TO authenticated;

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 2 FROM inventory_movement_lines WHERE movement_id = (SELECT (r->>'movement_id')::uuid FROM mvb))
  AND (SELECT count(*) = 2 FROM inventory_movement_headers h
       WHERE h.branch_id = (SELECT branch FROM fx) AND h.movement_type_code = '801'),
  'T6: moving two blocked parts posts ONE MM with 2 lines');

INSERT INTO test_log(line) SELECT ok(
  (SELECT on_hand_quantity = 2 AND blocked = 2 FROM inventory_balances
   WHERE location_id = (SELECT loc_l2 FROM fx) AND variant_id = (SELECT v_std FROM fx))
  AND (SELECT blocked = 0 FROM inventory_balances
       WHERE location_id = (SELECT loc_l1 FROM fx) AND variant_id = (SELECT v_std FROM fx))
  AND (SELECT count(*) = 2 FROM inventory_stock_block_events
       WHERE event_type = 'moved' AND movement_id = (SELECT (r->>'movement_id')::uuid FROM mvb)),
  'T7: both stay blocked at L2, both moves in the block history with that MM');

-- Two reservations of 139ZL3 moved to 139ZL4 at once.
SELECT inventory_create_and_finalize_receipt(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
    'quantity', 2, 'destination_location_id', (SELECT loc_prz FROM fx))),
  NULL, NULL, NULL, '139-PZ2', NULL, NULL, (SELECT e2e_user FROM fx), NULL);
SELECT inventory_reserve_for_repair_order((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT ro3 FROM fx), jsonb_build_array(
    jsonb_build_object('repair_order_line_id', (SELECT rol_e1 FROM fx), 'location_id', (SELECT loc_prz FROM fx), 'quantity', 1),
    jsonb_build_object('repair_order_line_id', (SELECT rol_e2 FROM fx), 'location_id', (SELECT loc_prz FROM fx), 'quantity', 1)),
  NULL);

CREATE TEMP TABLE trl AS SELECT inventory_transfer_reservation_lines((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(
    jsonb_build_object('reservation_line_id',
      (SELECT id FROM inventory_reservation_lines WHERE repair_order_line_id = (SELECT rol_e1 FROM fx)),
      'target_repair_order_line_id', (SELECT rol_g1 FROM fx)),
    jsonb_build_object('reservation_line_id',
      (SELECT id FROM inventory_reservation_lines WHERE repair_order_line_id = (SELECT rol_e2 FROM fx)),
      'target_repair_order_line_id', (SELECT rol_g2 FROM fx))),
  '139 pilniejsze zlecenie') AS r;
GRANT SELECT ON trl TO authenticated;

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 1 FROM inventory_reservations
   WHERE reference_type = 'repair_order' AND reference_id = (SELECT ro4 FROM fx))
  AND (SELECT count(*) = 2 FROM inventory_reservation_lines
       WHERE reservation_id = (SELECT (r->>'reservation_id')::uuid FROM trl)
         AND repair_order_line_id IN ((SELECT rol_g1 FROM fx), (SELECT rol_g2 FROM fx))),
  'T8: moving two reservations to another order creates ONE REZ with 2 lines');

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 2 FROM inventory_reservation_events
   WHERE event_type = 'transferred' AND reason = 'Przeniesienie na 139ZL4: 139 pilniejsze zlecenie')
  AND repair_order_line_open_need((SELECT rol_e1 FROM fx)) = 1
  AND repair_order_line_open_need((SELECT rol_g1 FROM fx)) = 0,
  'T9: both transfers in the history; 139ZL3 needs its parts again, 139ZL4 has them');

DO $$
BEGIN
  PERFORM inventory_transfer_reservation_lines((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
    jsonb_build_array(
      jsonb_build_object('reservation_line_id',
        (SELECT id FROM inventory_reservation_lines WHERE repair_order_line_id = (SELECT rol_g1 FROM fx)),
        'target_repair_order_line_id', (SELECT rol_e1 FROM fx)),
      jsonb_build_object('reservation_line_id',
        (SELECT id FROM inventory_reservation_lines WHERE repair_order_line_id = (SELECT rol_g2 FROM fx)),
        'target_repair_order_line_id', (SELECT rol_a FROM fx))),
    'x');
  INSERT INTO test_log(line) SELECT fail('T10: expected a transfer to two orders to be refused');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT ok(SQLERRM = 'All parts must go to the same repair order',
    'T10: one transfer goes to one repair order: ' || SQLERRM);
END $$;

RESET ROLE;

INSERT INTO test_log(line) SELECT ok(
  NOT has_function_privilege('authenticated', 'public.inventory_putaway_internal(uuid, uuid, uuid, uuid, uuid, jsonb)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.inventory_move_blocked_stock_lines(uuid, uuid, uuid, jsonb, uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.inventory_move_blocked_stock_lines(uuid, uuid, uuid, jsonb, uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.inventory_transfer_reservation_lines(uuid, uuid, uuid, jsonb, text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.inventory_transfer_reservation_lines(uuid, uuid, uuid, jsonb, text)', 'EXECUTE'),
  'T11: the putaway helper is engine-only; the list operations are for users, not anon');

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 0 FROM inventory_balances WHERE branch_id = (SELECT branch FROM fx) AND available_quantity < 0)
  AND (SELECT count(*) = 0 FROM inventory_balances b
       LEFT JOIN (SELECT location_id, variant_id, SUM(reserved_quantity - released_quantity - fulfilled_quantity) AS open_r
                  FROM inventory_reservation_lines GROUP BY 1, 2) x
         ON x.location_id = b.location_id AND x.variant_id = b.variant_id
       WHERE b.branch_id = (SELECT branch FROM fx) AND b.reserved_quantity <> COALESCE(x.open_r, 0)),
  'T12: no D < 0 and every R equals its open reservation lines');

DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 139 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
