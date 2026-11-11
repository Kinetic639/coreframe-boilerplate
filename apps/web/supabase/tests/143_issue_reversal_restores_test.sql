-- ============================================================================
-- TEST: storno of an RW 261 puts the parts back under the repair order
-- ============================================================================
-- PZ reserves 2 parts for a repair-order line, putaway puts them into the
-- order's container (KON allocation), RW 261 issues them. The storno (KOR
-- 900) gives the on_hand back AND the allocation, the container line and
-- the container's status; an 'allocated' event names the RW and the KOR.
-- The parts can then be issued again.
-- Executed live against supabase-target via Supabase MCP; everything rolls back.

BEGIN;

SELECT plan(8);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, e2e_user uuid, v_std uuid, unit uuid,
  loc_prz uuid, loc_l1 uuid, ro uuid, rol1 uuid, rw uuid, kor uuid
);
GRANT SELECT, UPDATE ON fx TO authenticated;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  null, null;

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch, org, '143-storno-branch', 993 FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT loc_prz, org, branch, '143 strefa przyjęć', '143-PRZ', true, 'receiving' FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc_l1, org, branch, '143 regał', '143-L1', true FROM fx;

INSERT INTO repair_orders (id, organization_id, branch_id, order_number, zl_number, status)
SELECT ro, org, branch, '143-RO', '143ZL', 'open' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit)
SELECT rol1, ro, 'P143A', '143 part A', 2, 'szt' FROM fx;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

SELECT inventory_create_and_finalize_receipt(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
    'quantity', 2, 'destination_location_id', (SELECT loc_prz FROM fx))),
  NULL, NULL, NULL, '143-PZ1', NULL, NULL, (SELECT e2e_user FROM fx),
  jsonb_build_array(jsonb_build_object('line_index', 1, 'zl_number', '143ZL', 'product_code', 'P143A')));

SELECT inventory_putaway_from_receiving((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT v_std FROM fx), 2, (SELECT loc_l1 FROM fx), (SELECT rol1 FROM fx), NULL);

UPDATE fx SET rw = (repair_order_issue_parts((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT ro FROM fx),
  jsonb_build_array(jsonb_build_object('repair_order_line_id', (SELECT rol1 FROM fx), 'quantity', 2,
    'allocation_line_id', (SELECT al.id FROM inventory_allocation_lines al
      JOIN inventory_reservation_lines rl ON rl.id = al.reservation_line_id
      WHERE rl.repair_order_line_id = (SELECT rol1 FROM fx) LIMIT 1))),
  'Mechanik 143', NULL) ->> 'movement_id')::uuid;

INSERT INTO test_log(line) SELECT ok(
  (SELECT on_hand_quantity = 0 AND allocated_quantity = 0 FROM inventory_balances
   WHERE location_id = (SELECT loc_l1 FROM fx) AND variant_id = (SELECT v_std FROM fx))
  AND (SELECT status = 'empty' FROM inventory_containers WHERE code = 'K-143ZL-01' AND branch_id = (SELECT branch FROM fx)),
  'T1: the RW issued both parts out of the container (container empty)');

UPDATE fx SET kor = (inventory_reverse_movement((SELECT rw FROM fx), (SELECT e2e_user FROM fx), '143 pomyłka')
  ->> 'reversal_movement_id')::uuid;

INSERT INTO test_log(line) SELECT ok(
  (SELECT on_hand_quantity = 2 AND allocated_quantity = 2 AND reserved_quantity = 0 AND available_quantity = 0
   FROM inventory_balances
   WHERE location_id = (SELECT loc_l1 FROM fx) AND variant_id = (SELECT v_std FROM fx)),
  'T2: after the storno the 2 parts are back at L1 and allocated to the order again, not free');

INSERT INTO test_log(line) SELECT ok(
  (SELECT SUM(al.allocated_quantity - al.fulfilled_quantity) = 2 FROM inventory_allocation_lines al
   JOIN inventory_reservation_lines rl ON rl.id = al.reservation_line_id
   WHERE rl.repair_order_line_id = (SELECT rol1 FROM fx)),
  'T3: the KON allocation of the repair-order line is open again (2)');

INSERT INTO test_log(line) SELECT ok(
  (SELECT c.status = 'active' FROM inventory_containers c WHERE c.code = 'K-143ZL-01' AND c.branch_id = (SELECT branch FROM fx))
  AND (SELECT COALESCE(SUM(cl.quantity), 0) = 2 FROM inventory_container_lines cl
       JOIN inventory_containers c ON c.id = cl.container_id
       JOIN inventory_allocation_container_links l ON l.container_line_id = cl.id AND l.deleted_at IS NULL
       WHERE c.code = 'K-143ZL-01' AND c.branch_id = (SELECT branch FROM fx) AND cl.deleted_at IS NULL),
  'T4: the parts are back in container K-143ZL-01, which is active again');

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 1 FROM inventory_reservation_events
   WHERE repair_order_line_id = (SELECT rol1 FROM fx) AND event_type = 'allocated'
     AND movement_id = (SELECT kor FROM fx) AND quantity = 2
     AND reason LIKE 'Storno RW/% (KOR/%): 143 pomyłka'),
  'T5: history: ''allocated'' with the RW, the KOR and the reason');

INSERT INTO test_log(line) SELECT ok(
  (SELECT status = 'reversed' FROM inventory_movement_headers WHERE id = (SELECT rw FROM fx)),
  'T6: the RW is reversed, so the order counts nothing issued');

-- The restored parts can be issued again.
SELECT repair_order_issue_parts((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT ro FROM fx),
  jsonb_build_array(jsonb_build_object('repair_order_line_id', (SELECT rol1 FROM fx), 'quantity', 2,
    'allocation_line_id', (SELECT al.id FROM inventory_allocation_lines al
      JOIN inventory_reservation_lines rl ON rl.id = al.reservation_line_id
      WHERE rl.repair_order_line_id = (SELECT rol1 FROM fx) LIMIT 1))),
  'Mechanik 143', NULL);

INSERT INTO test_log(line) SELECT ok(
  (SELECT on_hand_quantity = 0 AND allocated_quantity = 0 FROM inventory_balances
   WHERE location_id = (SELECT loc_l1 FROM fx) AND variant_id = (SELECT v_std FROM fx)),
  'T7: the same parts can be issued again after the storno');
RESET ROLE;

INSERT INTO test_log(line) SELECT ok(
  NOT has_function_privilege('authenticated', 'public.inventory_restore_issue_commitments_internal(uuid, uuid, uuid, text)', 'EXECUTE'),
  'T8: the restore helper is not callable by users');

DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 143 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
