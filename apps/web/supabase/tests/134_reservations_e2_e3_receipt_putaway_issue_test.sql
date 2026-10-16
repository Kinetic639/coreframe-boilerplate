-- ============================================================================
-- TEST: Reservations, stages E2/E3 (docs/RESERVATIONS_BLOCKS_PLAN.md)
-- ============================================================================
-- PZ reserves its repair-order parts in the same transaction (REZ/...,
-- 'created' event); reserved stock cannot be taken by an MM; putaway moves
-- the reservation with the part into the order's container; RW 261 uses it
-- up ('issued'); a fully received line reserves nothing more; reversal and
-- correction of a PZ release what they take back; closing a repair order
-- releases its open reservations. Engine helpers are not callable by users.
-- Executed live against supabase-target via Supabase MCP; everything rolls back.

BEGIN;

SELECT plan(20);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, e2e_user uuid, v_std uuid, unit uuid,
  loc_prz uuid, loc_l1 uuid,
  ro uuid, rol1 uuid, ro2 uuid, rol2 uuid, rol3 uuid, rol4 uuid,
  pz1 uuid, pz3 uuid, pz5 uuid, pz5_line uuid
);
GRANT SELECT, UPDATE ON fx TO authenticated;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid,
  gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  null, null, null, null;

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch, org, '134-e2-branch', 994 FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT loc_prz, org, branch, '134 strefa przyjęć', '134-PRZ', true, 'receiving' FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc_l1, org, branch, '134 regał', '134-L1', true FROM fx;

-- RO 134ZL: line 1 needs 2, line 4 needs 2. RO 134ZL2: line 2 needs 1, line 3 needs 1.
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, zl_number, status)
SELECT ro, org, branch, '134-RO', '134ZL', 'open' FROM fx;
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, zl_number, status)
SELECT ro2, org, branch, '134-RO2', '134ZL2', 'open' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit)
SELECT rol1, ro, 'P134A', '134 part A', 2, 'szt' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit)
SELECT rol4, ro, 'P134D', '134 part D', 2, 'szt' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit)
SELECT rol2, ro2, 'P134B', '134 part B', 1, 'szt' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit)
SELECT rol3, ro2, 'P134C', '134 part C', 1, 'szt' FROM fx;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

-- PZ 1: 3 pcs for ZL 134ZL line A (needs 2) -> 2 reserved, 1 free, one transaction.
CREATE TEMP TABLE r1 AS SELECT inventory_create_and_finalize_receipt(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
    'quantity', 3, 'destination_location_id', (SELECT loc_prz FROM fx))),
  NULL, NULL, NULL, '134-PZ1', NULL, NULL, (SELECT e2e_user FROM fx),
  jsonb_build_array(jsonb_build_object('line_index', 1, 'zl_number', '134ZL', 'product_code', 'P134A'))
) AS r;
GRANT SELECT ON r1 TO authenticated;
UPDATE fx SET pz1 = (SELECT (r->>'movement_id')::uuid FROM r1);

INSERT INTO test_log(line) SELECT ok(
  jsonb_array_length(r->'attribution'->'attributed') = 1
  AND r->'attribution'->'attributed'->0->>'reservation_number' LIKE 'REZ/____/______'
  AND (r->'attribution'->'attributed'->0->>'quantity')::numeric = 2,
  'T1: the PZ reserves 2 of 3 for the repair-order line in the same call (REZ/ number)') FROM r1;

INSERT INTO test_log(line) SELECT ok(
  (SELECT on_hand_quantity = 3 AND reserved_quantity = 2 AND available_quantity = 1 FROM inventory_balances
   WHERE location_id = (SELECT loc_prz FROM fx) AND variant_id = (SELECT v_std FROM fx)),
  'T2: receiving zone: on hand 3, R 2, D 1');

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 1 FROM inventory_reservation_events e
   JOIN inventory_reservation_lines rl ON rl.id = e.reservation_line_id
   WHERE e.repair_order_line_id = (SELECT rol1 FROM fx) AND e.event_type = 'created'
     AND e.reason LIKE 'Przyjęcie PZ/%' AND rl.source_movement_line_id IS NOT NULL
     AND e.actor_user_id = (SELECT e2e_user FROM fx)),
  'T3: a ''created'' event names the PZ, the actor, and the line keeps its PZ line as source');

DO $$
BEGIN
  PERFORM inventory_create_and_finalize(
    (SELECT org FROM fx), (SELECT branch FROM fx), '801',
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
      'quantity', 2, 'source_location_id', (SELECT loc_prz FROM fx), 'destination_location_id', (SELECT loc_l1 FROM fx))),
    NULL, NULL, NULL, '134-MM', NULL, NULL, (SELECT e2e_user FROM fx));
  INSERT INTO test_log(line) SELECT fail('T4: expected an MM of reserved stock to be rejected');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0003', 'T4: an ordinary MM cannot take the reserved parts (only D = 1)');
END $$;

-- Putaway of the 2 reserved parts -> container of 134ZL at L1, reservation moves with them.
CREATE TEMP TABLE pa AS SELECT inventory_putaway_from_receiving((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT v_std FROM fx), 2, (SELECT loc_l1 FROM fx), (SELECT rol1 FROM fx), NULL) AS r;
GRANT SELECT ON pa TO authenticated;

INSERT INTO test_log(line) SELECT ok(
  r->>'mode' = 'container' AND (r->>'reserved_quantity')::numeric = 2 AND r->>'container_code' = 'K-134ZL-01',
  'T5: putaway puts the 2 parts into K-134ZL-01, still reserved for the order') FROM pa;

INSERT INTO test_log(line) SELECT ok(
  (SELECT reserved_quantity = 0 AND on_hand_quantity = 1 FROM inventory_balances
   WHERE location_id = (SELECT loc_prz FROM fx) AND variant_id = (SELECT v_std FROM fx))
  AND (SELECT on_hand_quantity = 2 AND allocated_quantity = 2 AND available_quantity = 0 FROM inventory_balances
   WHERE location_id = (SELECT loc_l1 FROM fx) AND variant_id = (SELECT v_std FROM fx)),
  'T6: R left the receiving zone and sits at L1 (in the container)');

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 1 FROM inventory_reservations r JOIN inventory_reservation_lines rl ON rl.reservation_id = r.id
   WHERE r.reference_id = (SELECT rol1 FROM fx) AND rl.location_id = (SELECT loc_l1 FROM fx)
     AND rl.moved_from_line_id IS NOT NULL)
  AND (SELECT count(DISTINCT r.id) = 1 FROM inventory_reservations r WHERE r.reference_id = (SELECT rol1 FROM fx)),
  'T7: the same reservation document continues at L1 (moved_from the receiving-zone line)');

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 1 FROM inventory_reservation_events
   WHERE repair_order_line_id = (SELECT rol1 FROM fx) AND event_type = 'moved'
     AND location_id = (SELECT loc_prz FROM fx) AND to_location_id = (SELECT loc_l1 FROM fx) AND movement_id IS NOT NULL)
  AND (SELECT count(*) = 1 FROM inventory_reservation_events
   WHERE repair_order_line_id = (SELECT rol1 FROM fx) AND event_type = 'allocated'),
  'T8: history: moved PRZ -> L1 with its MM, then allocated to the container');

-- RW 261 for the order uses the reservation up.
CREATE TEMP TABLE iss AS SELECT repair_order_issue_parts((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT ro FROM fx),
  jsonb_build_array(jsonb_build_object('repair_order_line_id', (SELECT rol1 FROM fx), 'quantity', 2,
    'allocation_line_id', (SELECT al.id FROM inventory_allocation_lines al
      JOIN inventory_reservation_lines rl ON rl.id = al.reservation_line_id
      WHERE rl.repair_order_line_id = (SELECT rol1 FROM fx) LIMIT 1))),
  'Mechanik 134', NULL) AS r;
GRANT SELECT ON iss TO authenticated;

INSERT INTO test_log(line) SELECT ok(
  (SELECT on_hand_quantity = 0 AND allocated_quantity = 0 FROM inventory_balances
   WHERE location_id = (SELECT loc_l1 FROM fx) AND variant_id = (SELECT v_std FROM fx))
  AND (SELECT count(*) = 1 FROM inventory_reservation_events
   WHERE repair_order_line_id = (SELECT rol1 FROM fx) AND event_type = 'issued' AND reason LIKE 'Wydanie %/% dla Mechanik 134'),
  'T9: RW issues the 2 reserved parts and logs ''issued'' with the RW number and recipient');

-- A further PZ for the fully received line reserves nothing.
CREATE TEMP TABLE r2 AS SELECT inventory_create_and_finalize_receipt(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
    'quantity', 1, 'destination_location_id', (SELECT loc_prz FROM fx))),
  NULL, NULL, NULL, '134-PZ2', NULL, NULL, (SELECT e2e_user FROM fx),
  jsonb_build_array(jsonb_build_object('line_index', 1, 'zl_number', '134ZL', 'product_code', 'P134A'))
) AS r;
GRANT SELECT ON r2 TO authenticated;
INSERT INTO test_log(line) SELECT ok(
  jsonb_array_length(r->'attribution'->'attributed') = 0 AND r->'attribution'->'skipped'->0->>'reason' = 'already_received',
  'T10: a PZ for a line that already got everything stays free stock (already_received)') FROM r2;

-- Reversal of a PZ releases its reservation first.
UPDATE fx SET pz3 = (inventory_create_and_finalize_receipt(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
    'quantity', 1, 'destination_location_id', (SELECT loc_prz FROM fx))),
  NULL, NULL, NULL, '134-PZ3', NULL, NULL, (SELECT e2e_user FROM fx),
  jsonb_build_array(jsonb_build_object('line_index', 1, 'zl_number', '134ZL2', 'product_code', 'P134B'))
) ->> 'movement_id')::uuid;

INSERT INTO test_log(line) SELECT ok(
  (SELECT reserved_quantity = 1 FROM inventory_balances
   WHERE location_id = (SELECT loc_prz FROM fx) AND variant_id = (SELECT v_std FROM fx)),
  'T11: PZ3 reserved 1 for 134ZL2 line B');

SELECT inventory_reverse_movement((SELECT pz3 FROM fx), (SELECT e2e_user FROM fx), '134 zła dostawa');

INSERT INTO test_log(line) SELECT ok(
  (SELECT reserved_quantity = 0 FROM inventory_balances
   WHERE location_id = (SELECT loc_prz FROM fx) AND variant_id = (SELECT v_std FROM fx))
  AND (SELECT count(*) = 1 FROM inventory_reservation_events
   WHERE repair_order_line_id = (SELECT rol2 FROM fx) AND event_type = 'released'
     AND reason LIKE 'Storno PZ/%: 134 zła dostawa' AND movement_id IS NOT NULL),
  'T12: storno of PZ3 succeeds and releases its reservation, with the reason and the KOR');

-- Correction of a PZ releases the repair-order share it takes back.
UPDATE fx SET pz5 = (inventory_create_and_finalize_receipt(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
    'quantity', 2, 'destination_location_id', (SELECT loc_prz FROM fx))),
  NULL, NULL, NULL, '134-PZ5', NULL, NULL, (SELECT e2e_user FROM fx),
  jsonb_build_array(jsonb_build_object('line_index', 1, 'zl_number', '134ZL', 'product_code', 'P134D'))
) ->> 'movement_id')::uuid;
UPDATE fx SET pz5_line = (SELECT id FROM inventory_movement_lines WHERE movement_id = (SELECT pz5 FROM fx) AND line_number = 1);

-- Receiving zone now: PZ1 free 1 + PZ2 free 1 + PZ5 2 reserved = 4 on hand, R 2.
SELECT inventory_post_receipt_correction((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT pz5 FROM fx), jsonb_build_array(jsonb_build_object('original_line_id', (SELECT pz5_line FROM fx), 'quantity', 2)),
  '134 dostawca policzył za dużo');

INSERT INTO test_log(line) SELECT ok(
  (SELECT reserved_quantity = 0 AND on_hand_quantity = 2 FROM inventory_balances
   WHERE location_id = (SELECT loc_prz FROM fx) AND variant_id = (SELECT v_std FROM fx))
  AND (SELECT COALESCE(SUM(quantity), 0) = 2 FROM inventory_reservation_events
   WHERE repair_order_line_id = (SELECT rol4 FROM fx) AND event_type = 'released'
     AND reason LIKE 'Korekta PZ PZ/%: 134 dostawca policzył za dużo'),
  'T13: a PZ correction of the reserved quantity releases it first (2), with the reason');

-- Closing a repair order releases its open reservations.
SELECT inventory_create_and_finalize_receipt(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
    'quantity', 1, 'destination_location_id', (SELECT loc_prz FROM fx))),
  NULL, NULL, NULL, '134-PZ4', NULL, NULL, (SELECT e2e_user FROM fx),
  jsonb_build_array(jsonb_build_object('line_index', 1, 'zl_number', '134ZL2', 'product_code', 'P134C')));
RESET ROLE;

INSERT INTO test_log(line) SELECT ok(
  (SELECT reserved_quantity = 1 FROM inventory_balances
   WHERE location_id = (SELECT loc_prz FROM fx) AND variant_id = (SELECT v_std FROM fx)),
  'T14: PZ4 reserved 1 for 134ZL2 line C');

UPDATE repair_orders SET status = 'closed' WHERE id = (SELECT ro2 FROM fx);

INSERT INTO test_log(line) SELECT ok(
  (SELECT reserved_quantity = 0 FROM inventory_balances
   WHERE location_id = (SELECT loc_prz FROM fx) AND variant_id = (SELECT v_std FROM fx))
  AND (SELECT count(*) = 1 FROM inventory_reservation_events
   WHERE repair_order_line_id = (SELECT rol3 FROM fx) AND event_type = 'released' AND reason = 'Zamknięcie zlecenia 134ZL2'),
  'T15: closing 134ZL2 releases its open reservation, with the reason');

-- Invariants and access.
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*)::int FROM inventory_balances WHERE branch_id = (SELECT branch FROM fx) AND available_quantity < 0),
  0, 'T16: no balance in the branch has D < 0');

INSERT INTO test_log(line) SELECT is(
  (SELECT count(*)::int FROM inventory_balances b
   LEFT JOIN (SELECT location_id, variant_id, SUM(reserved_quantity - released_quantity - fulfilled_quantity) AS open_r
              FROM inventory_reservation_lines GROUP BY 1, 2) x
     ON x.location_id = b.location_id AND x.variant_id = b.variant_id
   WHERE b.branch_id = (SELECT branch FROM fx) AND b.reserved_quantity <> COALESCE(x.open_r, 0)),
  0, 'T17: every balance''s R equals its open reservation lines');

INSERT INTO test_log(line) SELECT ok(
  NOT has_function_privilege('authenticated', 'public.inventory_reservation_add_line_internal(uuid, uuid, uuid, numeric, uuid, uuid, uuid, uuid, text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.inventory_reservation_release_internal(uuid, numeric, text, text, uuid, uuid, uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.inventory_reservation_log_internal(uuid, text, numeric, uuid, uuid, uuid, uuid, text, uuid, uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.inventory_next_commitment_number_internal(uuid, text, uuid)', 'EXECUTE'),
  'T18: engine helpers are not callable by users');

INSERT INTO test_log(line) SELECT ok(
  NOT has_function_privilege('anon', 'public.inventory_create_and_finalize_receipt(uuid, uuid, jsonb, date, date, text, text, text, text, uuid, jsonb)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.inventory_create_and_finalize_receipt(uuid, uuid, jsonb, date, date, text, text, text, text, uuid, jsonb)', 'EXECUTE'),
  'T19: PZ-with-reservations is callable by users, not by anon');

INSERT INTO test_log(line) SELECT ok(
  (SELECT allocation_number LIKE 'KON/____/______' FROM inventory_allocations a
   JOIN inventory_allocation_lines al ON al.allocation_id = a.id
   JOIN inventory_reservation_lines rl ON rl.id = al.reservation_line_id
   WHERE rl.repair_order_line_id = (SELECT rol1 FROM fx) LIMIT 1),
  'T20: the container allocation is numbered KON/rrrr/nnnnnn');

DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 134 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
