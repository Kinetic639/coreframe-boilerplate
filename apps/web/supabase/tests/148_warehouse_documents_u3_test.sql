-- ============================================================================
-- TEST: one document = one magazyn, AutoStacja numbering, MM between magazyny (U3)
-- ============================================================================
-- Jednostka 9148 has magazyny 91481 and 91482; jednostka 9149 has 91491.
-- * PZ into 91481 is numbered PZ(91481)/1/26/9148, the next one /2/.
-- * A document mixing magazyny is refused; a delivery of two magazyny is
--   posted as two PZ in one call.
-- * MM 91481 -> 91482 on the same shelf moves the magazyn stock only;
--   MM to another jednostka and MM beyond the magazyn stock are refused.
-- * An issue to a repair order is numbered WU(magazyn)/…, its storno KWU;
--   the storno of a PZ is KPZ (K + the corrected document).
-- Executed live against supabase-target via Supabase MCP; everything rolls back.

BEGIN;

SELECT plan(11);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, e2e_user uuid, v_std uuid, unit uuid,
  loc_prz uuid, loc_l1 uuid, ro uuid, rol1 uuid,
  j1 uuid, m1 uuid, m2 uuid, j2 uuid, m3 uuid,
  pz1 uuid, pz2 uuid, mm uuid, rw uuid, kor uuid, multi jsonb
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
  null, null, null, null, null, null;

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch, org, '148-u3-branch', 996 FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT loc_prz, org, branch, '148 strefa przyjęć', '148-PRZ', true, 'receiving' FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc_l1, org, branch, '148 regał', '148-L1', true FROM fx;

INSERT INTO branch_warehouses (id, organization_id, branch_id, code, name, order_prefix)
SELECT j1, org, branch, '9148', '148 jednostka', 'ZL' FROM fx;
INSERT INTO unit_warehouses (id, organization_id, branch_id, unit_id, code, name)
SELECT m1, org, branch, j1, '91481', '148 blacharnia' FROM fx;
INSERT INTO unit_warehouses (id, organization_id, branch_id, unit_id, code, name)
SELECT m2, org, branch, j1, '91482', '148 lakiery' FROM fx;
INSERT INTO branch_warehouses (id, organization_id, branch_id, code, name, order_prefix)
SELECT j2, org, branch, '9149', '148 druga jednostka', 'ZL' FROM fx;
INSERT INTO unit_warehouses (id, organization_id, branch_id, unit_id, code, name)
SELECT m3, org, branch, j2, '91491', '148 obcy magazyn' FROM fx;

INSERT INTO repair_orders (id, organization_id, branch_id, order_number, zl_number, status)
SELECT ro, org, branch, '148-RO', '148ZL', 'open' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit)
SELECT rol1, ro, 'P148A', '148 part A', 1, 'szt' FROM fx;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

-- PZ 1: 3 pieces into 91481, one of them for the repair order
UPDATE fx SET pz1 = (inventory_create_and_finalize_receipt(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(
    jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
      'quantity', 1, 'destination_location_id', (SELECT loc_prz FROM fx), 'warehouse_id', (SELECT m1 FROM fx)),
    jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
      'quantity', 2, 'destination_location_id', (SELECT loc_prz FROM fx), 'warehouse_id', (SELECT m1 FROM fx))),
  NULL, NULL, NULL, '148-PZ1', NULL, NULL, (SELECT e2e_user FROM fx),
  jsonb_build_array(jsonb_build_object('line_index', 1, 'zl_number', '148ZL', 'product_code', 'P148A'))
) ->> 'movement_id')::uuid;

INSERT INTO test_log(line) SELECT ok(
  (SELECT document_number = 'PZ(91481)/1/' || to_char(now(), 'YY') || '/9148'
          AND warehouse_id = (SELECT m1 FROM fx)
   FROM inventory_movement_headers WHERE id = (SELECT pz1 FROM fx)),
  'T1: the PZ is numbered PZ(91481)/1/rr/9148 and carries its magazyn');

-- PZ 2, same magazyn: next number in the series
UPDATE fx SET pz2 = (inventory_create_and_finalize(
  (SELECT org FROM fx), (SELECT branch FROM fx), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
    'quantity', 1, 'destination_location_id', (SELECT loc_prz FROM fx), 'warehouse_id', (SELECT m1 FROM fx))),
  NULL, NULL, NULL, '148-PZ2', NULL, NULL, (SELECT e2e_user FROM fx)) ->> 'movement_id')::uuid;

INSERT INTO test_log(line) SELECT ok(
  (SELECT document_number LIKE 'PZ(91481)/2/%/9148' FROM inventory_movement_headers WHERE id = (SELECT pz2 FROM fx)),
  'T2: the next PZ of the magazyn takes number 2');

-- One document, one magazyn
DO $$
BEGIN
  PERFORM inventory_create_draft(
    (SELECT org FROM fx), (SELECT branch FROM fx), '101',
    jsonb_build_array(
      jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
        'quantity', 1, 'destination_location_id', (SELECT loc_prz FROM fx), 'warehouse_id', (SELECT m1 FROM fx)),
      jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
        'quantity', 1, 'destination_location_id', (SELECT loc_prz FROM fx), 'warehouse_id', (SELECT m3 FROM fx))),
    NULL, NULL, NULL, '148-MIX', NULL, NULL, (SELECT e2e_user FROM fx));
  INSERT INTO test_log(line) SELECT ok(false, 'T3: a document mixing magazyny is refused');
EXCEPTION WHEN sqlstate '22023' THEN
  INSERT INTO test_log(line) SELECT ok(true, 'T3: a document mixing magazyny is refused');
END $$;

-- A delivery of two magazyny: two PZ in one call
UPDATE fx SET multi = inventory_create_and_finalize_receipts(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(
    jsonb_build_object('lines', jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx),
      'unit_id', (SELECT unit FROM fx), 'quantity', 1, 'destination_location_id', (SELECT loc_prz FROM fx),
      'warehouse_id', (SELECT m2 FROM fx)))),
    jsonb_build_object('lines', jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx),
      'unit_id', (SELECT unit FROM fx), 'quantity', 1, 'destination_location_id', (SELECT loc_prz FROM fx),
      'warehouse_id', (SELECT m3 FROM fx))))),
  NULL, NULL, NULL, '148-MULTI', NULL, NULL, (SELECT e2e_user FROM fx));

INSERT INTO test_log(line) SELECT ok(
  (SELECT array_agg(d->>'document_number' ORDER BY d->>'document_number')
   FROM jsonb_array_elements((SELECT multi FROM fx)->'documents') d)
  = ARRAY['PZ(91482)/1/' || to_char(now(), 'YY') || '/9148', 'PZ(91491)/1/' || to_char(now(), 'YY') || '/9149'],
  'T4: a delivery of two magazyny is posted as two PZ, each in its own series');

-- MM 91481 -> 91482 on the same shelf: only the magazyn changes
UPDATE fx SET mm = (inventory_create_and_finalize(
  (SELECT org FROM fx), (SELECT branch FROM fx), '801',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
    'quantity', 1, 'source_location_id', (SELECT loc_prz FROM fx), 'destination_location_id', (SELECT loc_prz FROM fx),
    'warehouse_id', (SELECT m1 FROM fx), 'destination_warehouse_id', (SELECT m2 FROM fx))),
  NULL, NULL, NULL, '148-MM', NULL, NULL, (SELECT e2e_user FROM fx)) ->> 'movement_id')::uuid;

INSERT INTO test_log(line) SELECT ok(
  (SELECT quantity FROM inventory_warehouse_stock WHERE warehouse_id = (SELECT m1 FROM fx) AND variant_id = (SELECT v_std FROM fx)) = 3
  AND (SELECT quantity FROM inventory_warehouse_stock WHERE warehouse_id = (SELECT m2 FROM fx) AND variant_id = (SELECT v_std FROM fx)) = 2
  AND (SELECT document_number LIKE 'MM(91481)/1/%/9148' FROM inventory_movement_headers WHERE id = (SELECT mm FROM fx)),
  'T5: MM 91481 -> 91482 moves 1 between the magazyny and is numbered MM(91481)/1/rr/9148');

INSERT INTO test_log(line) SELECT is(
  (SELECT on_hand_quantity FROM inventory_balances
   WHERE location_id = (SELECT loc_prz FROM fx) AND variant_id = (SELECT v_std FROM fx)),
  6::numeric, 'T6: the shelf stock is unchanged by a magazyn-only MM');

-- MM to another jednostka is refused
DO $$
BEGIN
  PERFORM inventory_create_draft(
    (SELECT org FROM fx), (SELECT branch FROM fx), '801',
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
      'quantity', 1, 'source_location_id', (SELECT loc_prz FROM fx), 'destination_location_id', (SELECT loc_prz FROM fx),
      'warehouse_id', (SELECT m1 FROM fx), 'destination_warehouse_id', (SELECT m3 FROM fx))),
    NULL, NULL, NULL, '148-MMX', NULL, NULL, (SELECT e2e_user FROM fx));
  INSERT INTO test_log(line) SELECT ok(false, 'T7: an MM to another jednostka is refused (MMJ)');
EXCEPTION WHEN sqlstate '22023' THEN
  INSERT INTO test_log(line) SELECT ok(true, 'T7: an MM to another jednostka is refused (MMJ)');
END $$;

-- MM beyond the magazyn stock is refused
DO $$
BEGIN
  PERFORM inventory_create_and_finalize(
    (SELECT org FROM fx), (SELECT branch FROM fx), '801',
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
      'quantity', 5, 'source_location_id', (SELECT loc_prz FROM fx), 'destination_location_id', (SELECT loc_prz FROM fx),
      'warehouse_id', (SELECT m2 FROM fx), 'destination_warehouse_id', (SELECT m1 FROM fx))),
    NULL, NULL, NULL, '148-MMS', NULL, NULL, (SELECT e2e_user FROM fx));
  INSERT INTO test_log(line) SELECT ok(false, 'T8: an MM of more than the magazyn holds is refused');
EXCEPTION WHEN sqlstate '22023' THEN
  INSERT INTO test_log(line) SELECT ok(true, 'T8: an MM of more than the magazyn holds is refused');
END $$;

-- Issue to the repair order (WU) and its storno (KWU)
SELECT inventory_putaway_from_receiving((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT v_std FROM fx), 1, (SELECT loc_l1 FROM fx), (SELECT rol1 FROM fx), NULL);

UPDATE fx SET rw = (repair_order_issue_parts((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT ro FROM fx),
  jsonb_build_array(jsonb_build_object('repair_order_line_id', (SELECT rol1 FROM fx), 'quantity', 1,
    'allocation_line_id', (SELECT al.id FROM inventory_allocation_lines al
      JOIN inventory_reservation_lines rl ON rl.id = al.reservation_line_id
      WHERE rl.repair_order_line_id = (SELECT rol1 FROM fx) LIMIT 1))),
  'Mechanik 148', NULL) ->> 'movement_id')::uuid;

INSERT INTO test_log(line) SELECT ok(
  (SELECT document_number LIKE 'WU(91481)/1/%/9148' FROM inventory_movement_headers WHERE id = (SELECT rw FROM fx)),
  'T9: the issue to a repair order is numbered WU(91481)/1/rr/9148');

UPDATE fx SET kor = (inventory_reverse_movement((SELECT rw FROM fx), (SELECT e2e_user FROM fx), '148 pomyłka')
  ->> 'reversal_movement_id')::uuid;

INSERT INTO test_log(line) SELECT ok(
  (SELECT document_number LIKE 'KWU(91481)/1/%/9148' FROM inventory_movement_headers WHERE id = (SELECT kor FROM fx)),
  'T10: its storno is numbered KWU(91481)/1/rr/9148');

-- Storno of the second PZ: K + PZ
UPDATE fx SET multi = inventory_reverse_movement((SELECT pz2 FROM fx), (SELECT e2e_user FROM fx), '148 korekta PZ');

INSERT INTO test_log(line) SELECT ok(
  (SELECT document_number LIKE 'KPZ(91481)/1/%/9148' FROM inventory_movement_headers
   WHERE id = ((SELECT multi FROM fx) ->> 'reversal_movement_id')::uuid),
  'T11: the storno of a PZ is numbered KPZ(91481)/1/rr/9148');

RESET ROLE;

DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 148 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
