-- ============================================================================
-- TEST: MMJ between jednostki of one branch; WU from one magazyn (U4)
-- ============================================================================
-- Jednostka 9181 (magazyn 91811) and 9182 (91821) in ONE branch.
-- * MMJ 9181/91811 -> 9182/91821 is prepared, sent and received in the same
--   branch, numbered MMJ-(91811)/1/rr/9181 and MMJ+(91821)/1/rr/9182; the
--   magazyn stock moves.
-- * An MMJ within one jednostka is refused (that is an MM), an MMJ- of more
--   than the magazyn holds fails on receipt.
-- * A WU with parts of two magazyny is refused.
-- Executed live against supabase-target via Supabase MCP; everything rolls back.

BEGIN;

SELECT plan(7);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, e2e_user uuid, v_std uuid, unit uuid,
  loc uuid, loc2 uuid, loc_prz uuid, j1 uuid, m1 uuid, m1b uuid, j2 uuid, m2 uuid,
  tr uuid, acc jsonb, ro uuid, rol1 uuid, rol2 uuid
);
GRANT SELECT, UPDATE ON fx TO authenticated;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  null, null, gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch, org, '149-u4-branch', 998 FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc, org, branch, '149 regał A', '149-A', true FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc2, org, branch, '149 regał B', '149-B', true FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT loc_prz, org, branch, '149 strefa przyjęć', '149-PRZ', true, 'receiving' FROM fx;

INSERT INTO branch_warehouses (id, organization_id, branch_id, code, name, order_prefix)
SELECT j1, org, branch, '9181', '149 VW', 'ZL' FROM fx;
INSERT INTO unit_warehouses (id, organization_id, branch_id, unit_id, code, name)
SELECT m1, org, branch, j1, '91811', '149 blacharnia' FROM fx;
INSERT INTO unit_warehouses (id, organization_id, branch_id, unit_id, code, name)
SELECT m1b, org, branch, j1, '91812', '149 lakiery' FROM fx;
INSERT INTO branch_warehouses (id, organization_id, branch_id, code, name, order_prefix)
SELECT j2, org, branch, '9182', '149 Skoda', 'ZLEC' FROM fx;
INSERT INTO unit_warehouses (id, organization_id, branch_id, unit_id, code, name)
SELECT m2, org, branch, j2, '91821', '149 blacharnia Skoda' FROM fx;

INSERT INTO repair_orders (id, organization_id, branch_id, order_number, zl_number, status)
SELECT ro, org, branch, '149-RO', '149ZL', 'open' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit)
SELECT rol1, ro, 'P149A', '149 part A', 1, 'szt' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit)
SELECT rol2, ro, 'P149B', '149 part B', 1, 'szt' FROM fx;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

-- 3 pieces into 91811 on shelf A
SELECT inventory_create_and_finalize(
  (SELECT org FROM fx), (SELECT branch FROM fx), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
    'quantity', 3, 'destination_location_id', (SELECT loc FROM fx), 'warehouse_id', (SELECT m1 FROM fx))),
  NULL, NULL, NULL, '149-PZ', NULL, NULL, (SELECT e2e_user FROM fx));

-- MMJ 9181/91811 -> 9182/91821, same branch
UPDATE fx SET tr = (inventory_create_unit_transfer(
  (SELECT org FROM fx), (SELECT branch FROM fx), (SELECT m1 FROM fx), (SELECT m2 FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'source_location_id', (SELECT loc FROM fx),
    'unit_id', (SELECT unit FROM fx), 'quantity', 2)),
  '149 MMJ', (SELECT e2e_user FROM fx)) ->> 'transfer_id')::uuid;
SELECT inventory_send_branch_transfer((SELECT tr FROM fx), (SELECT e2e_user FROM fx));
UPDATE fx SET acc = inventory_accept_branch_transfer((SELECT tr FROM fx), (SELECT loc2 FROM fx), (SELECT e2e_user FROM fx), NULL);

INSERT INTO test_log(line) SELECT ok(
  ((SELECT acc FROM fx) ->> 'source_document_number') LIKE 'MMJ-(91811)/1/%/9181'
  AND ((SELECT acc FROM fx) ->> 'destination_document_number') LIKE 'MMJ+(91821)/1/%/9182',
  'T1: an MMJ within the branch is numbered MMJ-(91811)/1/rr/9181 and MMJ+(91821)/1/rr/9182');

INSERT INTO test_log(line) SELECT ok(
  (SELECT quantity FROM inventory_warehouse_stock WHERE warehouse_id = (SELECT m1 FROM fx) AND variant_id = (SELECT v_std FROM fx)) = 1
  AND (SELECT quantity FROM inventory_warehouse_stock WHERE warehouse_id = (SELECT m2 FROM fx) AND variant_id = (SELECT v_std FROM fx)) = 2,
  'T2: the MMJ moves 2 from magazyn 91811 to 91821');

INSERT INTO test_log(line) SELECT is(
  (SELECT on_hand_quantity FROM inventory_balances WHERE location_id = (SELECT loc2 FROM fx) AND variant_id = (SELECT v_std FROM fx)),
  2::numeric, 'T3: the parts are received on shelf B of the same branch');

-- Within one jednostka it is an MM, not an MMJ
DO $$
BEGIN
  PERFORM inventory_create_unit_transfer(
    (SELECT org FROM fx), (SELECT branch FROM fx), (SELECT m1 FROM fx), (SELECT m1b FROM fx),
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'source_location_id', (SELECT loc FROM fx),
      'unit_id', (SELECT unit FROM fx), 'quantity', 1)),
    NULL, (SELECT e2e_user FROM fx));
  INSERT INTO test_log(line) SELECT ok(false, 'T4: an MMJ within one jednostka is refused');
EXCEPTION WHEN sqlstate '22023' THEN
  INSERT INTO test_log(line) SELECT ok(true, 'T4: an MMJ within one jednostka is refused');
END $$;

-- An MMJ- of more than the magazyn holds fails on receipt (91811 holds 1)
DO $$
DECLARE v_tr uuid;
BEGIN
  -- shelf A gets 2 more pieces without magazyn, so the shelf can reserve 3
  PERFORM inventory_create_and_finalize(
    (SELECT org FROM fx), (SELECT branch FROM fx), '101',
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
      'quantity', 2, 'destination_location_id', (SELECT loc FROM fx))),
    NULL, NULL, NULL, '149-PZ-bez', NULL, NULL, (SELECT e2e_user FROM fx));
  v_tr := (inventory_create_unit_transfer(
    (SELECT org FROM fx), (SELECT branch FROM fx), (SELECT m1 FROM fx), (SELECT m2 FROM fx),
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'source_location_id', (SELECT loc FROM fx),
      'unit_id', (SELECT unit FROM fx), 'quantity', 3)),
    NULL, (SELECT e2e_user FROM fx)) ->> 'transfer_id')::uuid;
  PERFORM inventory_send_branch_transfer(v_tr, (SELECT e2e_user FROM fx));
  PERFORM inventory_accept_branch_transfer(v_tr, (SELECT loc2 FROM fx), (SELECT e2e_user FROM fx), NULL);
  INSERT INTO test_log(line) SELECT ok(false, 'T5: an MMJ- of more than the magazyn holds is refused');
EXCEPTION WHEN sqlstate '22023' THEN
  INSERT INTO test_log(line) SELECT ok(true, 'T5: an MMJ- of more than the magazyn holds is refused');
END $$;

-- A WU with parts of two magazyny is refused
SELECT inventory_create_and_finalize_receipt(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
    'quantity', 1, 'destination_location_id', (SELECT loc_prz FROM fx), 'warehouse_id', (SELECT m1 FROM fx))),
  NULL, NULL, NULL, '149-PZ-A', NULL, NULL, (SELECT e2e_user FROM fx),
  jsonb_build_array(jsonb_build_object('line_index', 1, 'zl_number', '149ZL', 'product_code', 'P149A')));
SELECT inventory_create_and_finalize_receipt(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
    'quantity', 1, 'destination_location_id', (SELECT loc_prz FROM fx), 'warehouse_id', (SELECT m1b FROM fx))),
  NULL, NULL, NULL, '149-PZ-B', NULL, NULL, (SELECT e2e_user FROM fx),
  jsonb_build_array(jsonb_build_object('line_index', 1, 'zl_number', '149ZL', 'product_code', 'P149B')));
SELECT inventory_putaway_from_receiving((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT v_std FROM fx), 1, (SELECT loc FROM fx), (SELECT rol1 FROM fx), NULL);
SELECT inventory_putaway_from_receiving((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT v_std FROM fx), 1, (SELECT loc FROM fx), (SELECT rol2 FROM fx), NULL);

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(DISTINCT rl.warehouse_id) = 2 FROM inventory_reservation_lines rl
   WHERE rl.repair_order_line_id IN ((SELECT rol1 FROM fx), (SELECT rol2 FROM fx))),
  'T6: the two parts of the order are reserved in two magazyny');

DO $$
BEGIN
  PERFORM repair_order_issue_parts((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
    (SELECT ro FROM fx),
    jsonb_build_array(
      jsonb_build_object('repair_order_line_id', (SELECT rol1 FROM fx), 'quantity', 1,
        'allocation_line_id', (SELECT al.id FROM inventory_allocation_lines al
          JOIN inventory_reservation_lines rl ON rl.id = al.reservation_line_id
          WHERE rl.repair_order_line_id = (SELECT rol1 FROM fx) LIMIT 1)),
      jsonb_build_object('repair_order_line_id', (SELECT rol2 FROM fx), 'quantity', 1,
        'allocation_line_id', (SELECT al.id FROM inventory_allocation_lines al
          JOIN inventory_reservation_lines rl ON rl.id = al.reservation_line_id
          WHERE rl.repair_order_line_id = (SELECT rol2 FROM fx) LIMIT 1))),
    'Mechanik 149', NULL);
  INSERT INTO test_log(line) SELECT ok(false, 'T7: a WU with parts of two magazyny is refused');
EXCEPTION WHEN sqlstate '22023' THEN
  INSERT INTO test_log(line) SELECT ok(true, 'T7: a WU with parts of two magazyny is refused');
END $$;

RESET ROLE;

DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 149 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
