-- ============================================================================
-- TEST: stock per AutoStacja magazyn (U2, variant A)
-- ============================================================================
-- PZ books 2 parts to magazyn 91471 for a repair order: the magazyn holds 2,
-- the order's reservation carries the magazyn and keeps it through putaway
-- (which moves shelves, not magazyny). The RW takes them out of that magazyn,
-- its storno puts them back. A PZ line without a magazyn leaves the magazyn
-- stock alone, and a magazyn of another branch is refused.
-- Executed live against supabase-target via Supabase MCP; everything rolls back.

BEGIN;

SELECT plan(8);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, other_branch uuid, e2e_user uuid, v_std uuid, unit uuid,
  loc_prz uuid, loc_l1 uuid, ro uuid, rol1 uuid,
  jedn uuid, mag uuid, other_jedn uuid, other_mag uuid,
  pz uuid, rw uuid, kor uuid
);
GRANT SELECT, UPDATE ON fx TO authenticated;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  gen_random_uuid(), gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  null, null, null;

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch, org, '147-u2-branch', 994 FROM fx;
INSERT INTO branches (id, organization_id, name, branch_number)
SELECT other_branch, org, '147-u2-other', 995 FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT loc_prz, org, branch, '147 strefa przyjęć', '147-PRZ', true, 'receiving' FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc_l1, org, branch, '147 regał', '147-L1', true FROM fx;

-- Jednostka 9147 with magazyn 91471; the other branch has 9148 / 91481.
INSERT INTO branch_warehouses (id, organization_id, branch_id, code, name, order_prefix)
SELECT jedn, org, branch, '9147', '147 jednostka', 'ZL' FROM fx;
INSERT INTO unit_warehouses (id, organization_id, branch_id, unit_id, code, name)
SELECT mag, org, branch, jedn, '91471', '147 blacharnia' FROM fx;
INSERT INTO branch_warehouses (id, organization_id, branch_id, code, name, order_prefix)
SELECT other_jedn, org, other_branch, '9148', '147 obca jednostka', 'ZL' FROM fx;
INSERT INTO unit_warehouses (id, organization_id, branch_id, unit_id, code, name)
SELECT other_mag, org, other_branch, other_jedn, '91481', '147 obcy magazyn' FROM fx;

INSERT INTO repair_orders (id, organization_id, branch_id, order_number, zl_number, status)
SELECT ro, org, branch, '147-RO', '147ZL', 'open' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit)
SELECT rol1, ro, 'P147A', '147 part A', 2, 'szt' FROM fx;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

-- PZ: 2 parts into magazyn 91471, reserved for the repair order
UPDATE fx SET pz = (inventory_create_and_finalize_receipt(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
    'quantity', 2, 'destination_location_id', (SELECT loc_prz FROM fx), 'warehouse_id', (SELECT mag FROM fx))),
  NULL, NULL, NULL, '147-PZ1', NULL, NULL, (SELECT e2e_user FROM fx),
  jsonb_build_array(jsonb_build_object('line_index', 1, 'zl_number', '147ZL', 'product_code', 'P147A'))
) ->> 'movement_id')::uuid;

INSERT INTO test_log(line) SELECT is(
  (SELECT quantity FROM inventory_warehouse_stock
   WHERE warehouse_id = (SELECT mag FROM fx) AND variant_id = (SELECT v_std FROM fx)),
  2::numeric, 'T1: the PZ puts 2 into magazyn 91471');

INSERT INTO test_log(line) SELECT ok(
  (SELECT bool_and(rl.warehouse_id = (SELECT mag FROM fx)) AND count(*) > 0
   FROM inventory_reservation_lines rl WHERE rl.repair_order_line_id = (SELECT rol1 FROM fx)),
  'T2: the repair order''s reservation carries the magazyn of its PZ line');

-- Putaway: shelf changes, magazyn does not
SELECT inventory_putaway_from_receiving((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT v_std FROM fx), 2, (SELECT loc_l1 FROM fx), (SELECT rol1 FROM fx), NULL);

INSERT INTO test_log(line) SELECT ok(
  (SELECT quantity = 2 FROM inventory_warehouse_stock
   WHERE warehouse_id = (SELECT mag FROM fx) AND variant_id = (SELECT v_std FROM fx))
  -- Putaway for a repair order moves the reservation to the shelf (a new line,
  -- moved_from the receiving one) and turns it into the container's allocation,
  -- so the shelf line need not stay open; it must carry the magazyn.
  AND (SELECT count(*) > 0 AND bool_and(rl.warehouse_id IS NOT DISTINCT FROM (SELECT mag FROM fx))
       FROM inventory_reservation_lines rl
       WHERE rl.repair_order_line_id = (SELECT rol1 FROM fx)
         AND rl.moved_from_line_id IS NOT NULL),
  'T3: after putaway the magazyn still holds 2 and the shelf reservation keeps the magazyn');

-- RW out of the magazyn of the reservation
UPDATE fx SET rw = (repair_order_issue_parts((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT ro FROM fx),
  jsonb_build_array(jsonb_build_object('repair_order_line_id', (SELECT rol1 FROM fx), 'quantity', 2,
    'allocation_line_id', (SELECT al.id FROM inventory_allocation_lines al
      JOIN inventory_reservation_lines rl ON rl.id = al.reservation_line_id
      WHERE rl.repair_order_line_id = (SELECT rol1 FROM fx) LIMIT 1))),
  'Mechanik 147', NULL) ->> 'movement_id')::uuid;

INSERT INTO test_log(line) SELECT ok(
  (SELECT quantity = 0 FROM inventory_warehouse_stock
   WHERE warehouse_id = (SELECT mag FROM fx) AND variant_id = (SELECT v_std FROM fx))
  AND EXISTS (SELECT 1 FROM inventory_warehouse_ledger
              WHERE movement_id = (SELECT rw FROM fx) AND warehouse_source = 'reservation'
                AND quantity_delta = -2),
  'T4: the RW takes 2 out of the reservation''s magazyn');

-- Storno of the RW
UPDATE fx SET kor = (inventory_reverse_movement((SELECT rw FROM fx), (SELECT e2e_user FROM fx), '147 pomyłka')
  ->> 'reversal_movement_id')::uuid;

INSERT INTO test_log(line) SELECT ok(
  (SELECT quantity = 2 FROM inventory_warehouse_stock
   WHERE warehouse_id = (SELECT mag FROM fx) AND variant_id = (SELECT v_std FROM fx))
  AND EXISTS (SELECT 1 FROM inventory_warehouse_ledger
              WHERE movement_id = (SELECT kor FROM fx) AND warehouse_source = 'original'
                AND quantity_delta = 2),
  'T5: the storno of the RW puts 2 back into the same magazyn');

-- A PZ line without a magazyn: physical stock grows, magazyn stock does not
SELECT inventory_create_and_finalize_receipt(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
    'quantity', 3, 'destination_location_id', (SELECT loc_prz FROM fx))),
  NULL, NULL, NULL, '147-PZ2', NULL, NULL, (SELECT e2e_user FROM fx), '[]'::jsonb);

INSERT INTO test_log(line) SELECT ok(
  (SELECT quantity = 2 FROM inventory_warehouse_stock
   WHERE warehouse_id = (SELECT mag FROM fx) AND variant_id = (SELECT v_std FROM fx))
  AND (SELECT on_hand_quantity = 3 FROM inventory_balances
       WHERE location_id = (SELECT loc_prz FROM fx) AND variant_id = (SELECT v_std FROM fx)),
  'T6: a line without magazyn adds physical stock only (it stays "without magazyn")');

-- History: the PZ line booked its own magazyn
INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 1 FROM inventory_warehouse_ledger
   WHERE movement_id = (SELECT pz FROM fx) AND warehouse_source = 'line' AND quantity_delta = 2),
  'T7: the PZ wrote one +2 history row for the magazyn, from its own line');

-- A magazyn of another branch is refused
DO $$
BEGIN
  PERFORM inventory_create_draft(
    (SELECT org FROM fx), (SELECT branch FROM fx), '101',
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
      'quantity', 1, 'destination_location_id', (SELECT loc_prz FROM fx),
      'warehouse_id', (SELECT other_mag FROM fx))),
    NULL, NULL, NULL, '147-PZ3', NULL, NULL, (SELECT e2e_user FROM fx));
  INSERT INTO test_log(line) SELECT ok(false, 'T8: a magazyn of another branch is refused');
EXCEPTION WHEN sqlstate '22023' THEN
  INSERT INTO test_log(line) SELECT ok(true, 'T8: a magazyn of another branch is refused');
END $$;

RESET ROLE;

DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 147 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
