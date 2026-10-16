-- ============================================================================
-- TEST: Reservations & blocks, stages E4/E5 (docs/RESERVATIONS_BLOCKS_PLAN.md)
-- ============================================================================
-- E4: reserve several parts of a repair order from D in one REZ document;
-- need and availability limits; release only with a reason; transfer to
-- another order without passing through D; whole-document release logs
-- history; one-document-per-order reservations go into the order's container.
-- E5: block (D -> B) with a reason, also a reserved part (R -> B); B cannot be
-- moved by an MM; a blocked part moves and stays blocked; unblock (B -> D);
-- return to supplier (122, ZWD/) and scrapping (551, LIK/) take B out of
-- stock; 122/551 cannot be entered manually; block documents close.
-- Executed live against supabase-target via Supabase MCP; everything rolls back.

BEGIN;

SELECT plan(20);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, e2e_user uuid, v uuid, unit uuid,
  l1 uuid, l2 uuid,
  ro1 uuid, rol_a uuid, rol_b uuid, ro2 uuid, rol_c uuid, rol_d uuid,
  rez1 uuid, line_a uuid, line_b uuid, rez2 uuid, rez3_line uuid,
  blk1 uuid, blk1_line uuid, blk2_line uuid, blk1_l2_line uuid
);
GRANT SELECT, UPDATE ON fx TO authenticated;
INSERT INTO fx (org, branch, e2e_user, v, unit, l1, l2, ro1, rol_a, rol_b, ro2, rol_c, rol_d) SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid,
  gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch, org, '135-e4e5-branch', 993 FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT l1, org, branch, '135 regał 1', '135-L1', true FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT l2, org, branch, '135 półka reklamacji', '135-L2', true FROM fx;

INSERT INTO repair_orders (id, organization_id, branch_id, order_number, zl_number, status)
SELECT ro1, org, branch, '135-RO1', '135ZL1', 'open' FROM fx;
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, zl_number, status)
SELECT ro2, org, branch, '135-RO2', '135ZL2', 'open' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, ordered_quantity, unit)
SELECT rol_a, ro1, v, 'P135A', 3, 'szt' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, ordered_quantity, unit)
SELECT rol_b, ro1, v, 'P135B', 2, 'szt' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, ordered_quantity, unit)
SELECT rol_c, ro2, v, 'P135C', 2, 'szt' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, ordered_quantity, unit)
SELECT rol_d, ro2, v, 'P135D', 100, 'szt' FROM fx;

-- on hand / R / B / D of the test item at a location.
CREATE OR REPLACE FUNCTION pg_temp.bal(p_loc uuid) RETURNS text LANGUAGE sql AS $fn$
  SELECT on_hand_quantity::int || '/' || (reserved_quantity + allocated_quantity)::int || '/' || blocked::int || '/' || available_quantity::int
  FROM inventory_balances WHERE location_id = p_loc AND variant_id = (SELECT v FROM fx)
$fn$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

-- 10 pcs on L1.
SELECT inventory_create_and_finalize((SELECT org FROM fx), (SELECT branch FROM fx), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT v FROM fx), 'unit_id', (SELECT unit FROM fx),
    'quantity', 10, 'destination_location_id', (SELECT l1 FROM fx))),
  NULL, NULL, NULL, '135-PZ', NULL, NULL, (SELECT e2e_user FROM fx));

-- E4 ------------------------------------------------------------------------------

CREATE TEMP TABLE r1 AS SELECT inventory_reserve_for_repair_order((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT ro1 FROM fx), jsonb_build_array(
    jsonb_build_object('repair_order_line_id', (SELECT rol_a FROM fx), 'location_id', (SELECT l1 FROM fx), 'quantity', 3),
    jsonb_build_object('repair_order_line_id', (SELECT rol_b FROM fx), 'location_id', (SELECT l1 FROM fx), 'quantity', 1)),
  NULL) AS r;
GRANT SELECT ON r1 TO authenticated;
UPDATE fx SET rez1 = (SELECT (r->>'reservation_id')::uuid FROM r1),
  line_a = (SELECT (r->'lines'->0->>'reservation_line_id')::uuid FROM r1),
  line_b = (SELECT (r->'lines'->1->>'reservation_line_id')::uuid FROM r1);

INSERT INTO test_log(line) SELECT ok(
  (SELECT r->>'reservation_number' LIKE 'REZ/____/______' AND jsonb_array_length(r->'lines') = 2 FROM r1)
  AND (SELECT reference_type = 'repair_order' AND reference_id = (SELECT ro1 FROM fx) FROM inventory_reservations WHERE id = (SELECT rez1 FROM fx))
  AND pg_temp.bal((SELECT l1 FROM fx)) = '10/4/0/6'
  AND (SELECT count(*) = 2 FROM inventory_reservation_events WHERE reservation_id = (SELECT rez1 FROM fx) AND event_type = 'created' AND reason = 'Rezerwacja z magazynu'),
  'T1: two parts of 135ZL1 reserved from D in ONE REZ document (on hand/R/B/D = 10/4/0/6), history written');

DO $$
BEGIN
  PERFORM inventory_reserve_for_repair_order((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
    (SELECT ro1 FROM fx), jsonb_build_array(jsonb_build_object('repair_order_line_id', (SELECT rol_b FROM fx), 'location_id', (SELECT l1 FROM fx), 'quantity', 2)), NULL);
  INSERT INTO test_log(line) SELECT fail('T2: expected reserving above the need to be refused');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT ok(SQLERRM LIKE '%still needs only 1%', 'T2: cannot reserve more than the line still needs (1)');
END $$;

DO $$
BEGIN
  PERFORM inventory_reserve_for_repair_order((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
    (SELECT ro2 FROM fx), jsonb_build_array(jsonb_build_object('repair_order_line_id', (SELECT rol_d FROM fx), 'location_id', (SELECT l1 FROM fx), 'quantity', 50)), NULL);
  INSERT INTO test_log(line) SELECT fail('T3: expected reserving above D to be refused');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT ok(SQLSTATE = '22023' AND SQLERRM LIKE 'Insufficient available stock%', 'T3: cannot reserve more than D (6)');
END $$;

DO $$
BEGIN
  PERFORM inventory_release_reservation_lines((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
    jsonb_build_array(jsonb_build_object('reservation_line_id', (SELECT line_b FROM fx))), '  ');
  INSERT INTO test_log(line) SELECT fail('T4: expected a release without a reason to be refused');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT ok(SQLERRM LIKE 'A reason is required%', 'T4: a release needs a reason');
END $$;

SELECT inventory_release_reservation_lines((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('reservation_line_id', (SELECT line_b FROM fx))), 'Klient zrezygnował z części B');
INSERT INTO test_log(line) SELECT ok(
  pg_temp.bal((SELECT l1 FROM fx)) = '10/3/0/7'
  AND (SELECT count(*) = 1 FROM inventory_reservation_events WHERE reservation_line_id = (SELECT line_b FROM fx)
       AND event_type = 'released' AND reason = 'Klient zrezygnował z części B' AND actor_user_id = (SELECT e2e_user FROM fx)),
  'T5: released with the reason: R -> D (10/3/0/7), who and why in the history');

CREATE TEMP TABLE tr AS SELECT inventory_transfer_reservation((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT line_a FROM fx), 2, (SELECT rol_c FROM fx), 'Pilniejsze zlecenie') AS r;
GRANT SELECT ON tr TO authenticated;
UPDATE fx SET rez2 = (SELECT (r->>'reservation_id')::uuid FROM tr);
INSERT INTO test_log(line) SELECT ok(
  pg_temp.bal((SELECT l1 FROM fx)) = '10/3/0/7'
  AND (SELECT count(*) = 1 FROM inventory_reservation_events WHERE reservation_line_id = (SELECT line_a FROM fx)
       AND event_type = 'transferred' AND to_repair_order_line_id = (SELECT rol_c FROM fx) AND reason = 'Przeniesienie na 135ZL2: Pilniejsze zlecenie')
  AND (SELECT reserved_quantity - released_quantity - fulfilled_quantity = 2 AND moved_from_line_id = (SELECT line_a FROM fx)
       FROM inventory_reservation_lines WHERE reservation_id = (SELECT rez2 FROM fx))
  AND (SELECT count(*) = 1 FROM inventory_reservation_events WHERE reservation_id = (SELECT rez2 FROM fx)
       AND event_type = 'created' AND reason = 'Przeniesienie z 135ZL1: Pilniejsze zlecenie'),
  'T6: 2 transferred 135ZL1 -> 135ZL2 without ever being in D (R and D unchanged), both sides in the history');

DO $$
BEGIN
  PERFORM inventory_transfer_reservation((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
    (SELECT line_a FROM fx), 1, (SELECT rol_c FROM fx), 'Jeszcze jedna');
  INSERT INTO test_log(line) SELECT fail('T7: expected a transfer above the target need to be refused');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT ok(SQLERRM LIKE '%still needs only 0%', 'T7: cannot transfer more than the target line still needs');
END $$;

SELECT inventory_release_reservation((SELECT rez2 FROM fx), (SELECT e2e_user FROM fx), true);
INSERT INTO test_log(line) SELECT ok(
  pg_temp.bal((SELECT l1 FROM fx)) = '10/1/0/9'
  AND (SELECT count(*) = 1 FROM inventory_reservation_events WHERE reservation_id = (SELECT rez2 FROM fx)
       AND event_type = 'released' AND reason LIKE 'Anulowanie rezerwacji REZ/%'),
  'T8: cancelling a whole document releases it and writes the history');

-- One-document-per-order line into the order's container.
SELECT inventory_create_container((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  'K-135ZL1-01', (SELECT l1 FROM fx), 'container', 'repair_order', (SELECT ro1 FROM fx)::text);
DO $$
DECLARE v_alloc jsonb;
BEGIN
  v_alloc := inventory_create_allocation((SELECT org FROM fx), (SELECT branch FROM fx),
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT v FROM fx), 'location_id', (SELECT l1 FROM fx),
      'quantity', 1, 'reservation_line_id', (SELECT line_a FROM fx))),
    (SELECT rez1 FROM fx), 'repair_order', (SELECT ro1 FROM fx), '135ZL1', (SELECT e2e_user FROM fx));
  PERFORM repair_order_add_allocation_to_container((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
    (SELECT id FROM inventory_containers WHERE code = 'K-135ZL1-01' AND branch_id = (SELECT branch FROM fx)),
    (SELECT id FROM inventory_allocation_lines WHERE allocation_id = (v_alloc->>'allocation_id')::uuid), 1);
  INSERT INTO test_log(line) SELECT ok(pg_temp.bal((SELECT l1 FROM fx)) = '10/1/0/9',
    'T9: a line of a whole-order REZ goes into the order''s container (allocated, still R)');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT fail('T9: container placement failed: ' || SQLERRM);
END $$;

-- E5 ------------------------------------------------------------------------------

CREATE TEMP TABLE b1 AS SELECT inventory_block_stock((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT v FROM fx), 'location_id', (SELECT l1 FROM fx), 'quantity', 2)),
  'damaged', 'Pęknięte przy rozpakowaniu', 'helpdesk_ticket', NULL, 'HD-135') AS r;
GRANT SELECT ON b1 TO authenticated;
UPDATE fx SET blk1 = (SELECT (r->>'block_id')::uuid FROM b1), blk1_line = (SELECT (r->'lines'->0->>'block_line_id')::uuid FROM b1);
INSERT INTO test_log(line) SELECT ok(
  (SELECT r->>'block_number' LIKE 'BLK/____/______' FROM b1)
  AND pg_temp.bal((SELECT l1 FROM fx)) = '10/1/2/7'
  AND (SELECT count(*) = 1 FROM inventory_stock_block_events WHERE block_line_id = (SELECT blk1_line FROM fx)
       AND event_type = 'blocked' AND reason LIKE 'BLK/% (damaged): Pęknięte przy rozpakowaniu')
  AND (SELECT reference_number = 'HD-135' FROM inventory_stock_blocks WHERE id = (SELECT blk1 FROM fx)),
  'T10: 2 blocked as damaged with the complaint reference: BLK/ document, 10/1/2/7, history written');

DO $$
BEGIN
  PERFORM inventory_block_stock((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT v FROM fx), 'location_id', (SELECT l1 FROM fx), 'quantity', 1)),
    'other', NULL, NULL, NULL, NULL);
  INSERT INTO test_log(line) SELECT fail('T11: expected "other" without a description to be refused');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT ok(SQLSTATE = '22023', 'T11: reason "other" needs a description');
END $$;

DO $$
BEGIN
  PERFORM inventory_create_and_finalize((SELECT org FROM fx), (SELECT branch FROM fx), '801',
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT v FROM fx), 'unit_id', (SELECT unit FROM fx),
      'quantity', 8, 'source_location_id', (SELECT l1 FROM fx), 'destination_location_id', (SELECT l2 FROM fx))),
    NULL, NULL, NULL, '135-MM', NULL, NULL, (SELECT e2e_user FROM fx));
  INSERT INTO test_log(line) SELECT fail('T12: expected an MM of blocked stock to be refused');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0003', 'T12: an MM cannot take blocked (or reserved) parts: 8 > D 7');
END $$;

-- A reserved part found faulty: R -> B.
UPDATE fx SET rez3_line = (SELECT (inventory_reserve_for_repair_order((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT ro1 FROM fx), jsonb_build_array(jsonb_build_object('repair_order_line_id', (SELECT rol_b FROM fx), 'location_id', (SELECT l1 FROM fx), 'quantity', 1)), NULL)
  ->'lines'->0->>'reservation_line_id')::uuid);
UPDATE fx SET blk2_line = (SELECT (inventory_block_stock((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('reservation_line_id', (SELECT rez3_line FROM fx), 'quantity', 1)),
  'quality_check', NULL, NULL, NULL, NULL)->'lines'->0->>'block_line_id')::uuid);
INSERT INTO test_log(line) SELECT ok(
  pg_temp.bal((SELECT l1 FROM fx)) = '10/1/3/6'
  AND (SELECT count(*) = 1 FROM inventory_reservation_events e WHERE e.reservation_line_id = (SELECT rez3_line FROM fx)
       AND e.event_type = 'released' AND e.block_id IS NOT NULL AND e.reason LIKE 'Blokada BLK/% (quality_check)')
  AND repair_order_line_open_need((SELECT rol_b FROM fx)) = 2,
  'T13: blocking a reserved part takes it off the reservation (R -> B), logged with the block; the order needs it again');

CREATE TEMP TABLE mv AS SELECT inventory_move_blocked_stock((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT blk1_line FROM fx), 1, (SELECT l2 FROM fx)) AS r;
GRANT SELECT ON mv TO authenticated;
UPDATE fx SET blk1_l2_line = (SELECT (r->>'block_line_id')::uuid FROM mv);
INSERT INTO test_log(line) SELECT ok(
  pg_temp.bal((SELECT l1 FROM fx)) = '9/1/2/6' AND pg_temp.bal((SELECT l2 FROM fx)) = '1/0/1/0'
  AND (SELECT moved_from_line_id = (SELECT blk1_line FROM fx) FROM inventory_stock_block_lines WHERE id = (SELECT blk1_l2_line FROM fx))
  AND (SELECT count(*) = 1 FROM inventory_stock_block_events WHERE block_line_id = (SELECT blk1_line FROM fx)
       AND event_type = 'moved' AND to_location_id = (SELECT l2 FROM fx) AND movement_id IS NOT NULL),
  'T14: a blocked part moves to the complaints shelf (MM) and stays blocked there');

SELECT inventory_unblock_stock((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('block_line_id', (SELECT blk2_line FROM fx))), 'Kontrola jakości OK');
INSERT INTO test_log(line) SELECT ok(
  pg_temp.bal((SELECT l1 FROM fx)) = '9/1/1/7'
  AND (SELECT count(*) = 1 FROM inventory_stock_block_events WHERE block_line_id = (SELECT blk2_line FROM fx)
       AND event_type = 'unblocked' AND reason = 'Kontrola jakości OK'),
  'T15: unblocked with the reason: B -> D (not back to the order)');

CREATE TEMP TABLE zwd AS SELECT inventory_issue_blocked_stock((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  'return_to_supplier', jsonb_build_array(jsonb_build_object('block_line_id', (SELECT blk1_l2_line FROM fx))),
  'Reklamacja uznana', 'Dostawca 135') AS r;
GRANT SELECT ON zwd TO authenticated;
INSERT INTO test_log(line) SELECT ok(
  (SELECT r->>'document_number' LIKE 'ZWD/____/______' AND r->>'movement_type_code' = '122' FROM zwd)
  AND pg_temp.bal((SELECT l2 FROM fx)) = '0/0/0/0'
  AND (SELECT counterparty_name = 'Dostawca 135' AND reference_type = 'stock_block' FROM inventory_movement_headers
       WHERE id = (SELECT (r->>'movement_id')::uuid FROM zwd))
  AND (SELECT count(*) = 1 FROM inventory_stock_block_events WHERE block_line_id = (SELECT blk1_l2_line FROM fx) AND event_type = 'returned_to_supplier'),
  'T16: the blocked part goes back to the supplier: ZWD/ document (122), stock and B down');

CREATE TEMP TABLE lik AS SELECT inventory_issue_blocked_stock((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  'scrap', jsonb_build_array(jsonb_build_object('block_line_id', (SELECT blk1_line FROM fx))), 'Nie do naprawy', NULL) AS r;
GRANT SELECT ON lik TO authenticated;
INSERT INTO test_log(line) SELECT ok(
  (SELECT r->>'document_number' LIKE 'LIK/____/______' AND r->>'movement_type_code' = '551' FROM lik)
  AND pg_temp.bal((SELECT l1 FROM fx)) = '8/1/0/7',
  'T17: the other blocked part is scrapped: LIK/ document (551), 8/1/0/7');

DO $$
BEGIN
  PERFORM inventory_create_and_finalize((SELECT org FROM fx), (SELECT branch FROM fx), '122',
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT v FROM fx), 'unit_id', (SELECT unit FROM fx),
      'quantity', 1, 'source_location_id', (SELECT l1 FROM fx))),
    NULL, NULL, NULL, '135-ZWD', NULL, NULL, (SELECT e2e_user FROM fx));
  INSERT INTO test_log(line) SELECT fail('T18: expected a manual 122 to be refused');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT pass('T18: 122 / 551 cannot be entered manually (only from blocked stock)');
END $$;
RESET ROLE;

INSERT INTO test_log(line) SELECT ok(
  (SELECT bool_and(status = 'closed' AND closed_at IS NOT NULL) FROM inventory_stock_blocks WHERE branch_id = (SELECT branch FROM fx))
  AND (SELECT count(*) = 0 FROM inventory_balances b
       LEFT JOIN (SELECT location_id, variant_id, SUM(blocked_quantity - unblocked_quantity - moved_quantity - consumed_quantity) AS open_b
                  FROM inventory_stock_block_lines GROUP BY 1, 2) x ON x.location_id = b.location_id AND x.variant_id = b.variant_id
       WHERE b.branch_id = (SELECT branch FROM fx) AND b.blocked <> COALESCE(x.open_b, 0))
  AND (SELECT count(*) = 0 FROM inventory_balances WHERE branch_id = (SELECT branch FROM fx) AND available_quantity < 0),
  'T19: both block documents are closed; every balance''s B equals its open block lines; D >= 0 everywhere');

INSERT INTO test_log(line) SELECT ok(
  NOT has_function_privilege('authenticated', 'public.inventory_stock_block_take_internal(uuid, numeric, text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.inventory_stock_block_add_line_internal(uuid, uuid, uuid, numeric, uuid, uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.inventory_next_document_number_internal(uuid, text)', 'EXECUTE')
  AND NOT has_table_privilege('authenticated', 'public.inventory_stock_block_events', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.inventory_stock_blocks', 'INSERT')
  AND NOT has_function_privilege('anon', 'public.inventory_block_stock(uuid, uuid, uuid, jsonb, text, text, text, text, text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.inventory_reserve_for_repair_order(uuid, uuid, uuid, uuid, jsonb, text)', 'EXECUTE'),
  'T20: helpers are internal, block tables are read-only for users, anon executes nothing');

DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 135 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
