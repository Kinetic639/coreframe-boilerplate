-- ============================================================================
-- TEST: Phase 10E -- whole-container relocation (inventory_relocate_container)
-- ============================================================================
-- Proves:
--   * a real 801 moves the container's on_hand stock, tagged with container_id;
--   * the allocated commitment follows the stock (source -, destination +);
--   * an allocation line fully inside the container moves in place, one that
--     is split across containers is split, and only this container's links
--     are re-pointed;
--   * container.current_location_id is updated in the same transaction, and a
--     failure after the commitment move rolls everything back;
--   * an empty container only moves its pointer;
--   * rejections: same location, non-stockable destination, archived
--     container, unknown container, actor mismatch, anon has no EXECUTE.
-- Uses the shared fixture org/branch and the e2e user (org-wide warehouse.*),
-- with fresh locations so absolute balances are known.
-- Executed live against supabase-target via Supabase MCP; everything rolls back.

BEGIN;

SELECT plan(24);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, e2e_user uuid, variant_1 uuid,
  loc_a uuid, loc_b uuid, loc_nostock uuid,
  ro uuid, line_a uuid, line_b uuid,
  res_a uuid, resline_a uuid, alloc_a uuid, allocline_a uuid,
  res_b uuid, resline_b uuid, alloc_b uuid, allocline_b uuid,
  c1 uuid, c2 uuid, c3 uuid, c4 uuid, movement_id uuid
);
GRANT SELECT, UPDATE ON fx TO authenticated;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  'e39b15da-0a8d-4056-b5a2-80eb1da868a6'::uuid,
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  null, null, null, null, null, null, null, null,
  null, null, null, null, null;

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory)
SELECT loc_a, org, branch, '117-loc-a', true FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory)
SELECT loc_b, org, branch, '117-loc-b', true FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory)
SELECT loc_nostock, org, branch, '117-loc-nostock', false FROM fx;

INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT ro, org, branch, '117-test-RO', 'open' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT line_a, ro, variant_1, '117-SKU', '117 line A', 10, 'pcs' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT line_b, ro, variant_1, '117-SKU', '117 line B', 3, 'pcs' FROM fx;

-- 100 on hand at loc_a (fresh balance rows, created at zero then set by the
-- engine flag, as the 100_ fixture does).
SET LOCAL ambra.inventory_movement_engine = 'on';
INSERT INTO inventory_balances (organization_id, branch_id, location_id, variant_id, on_hand_quantity, reserved_quantity, allocated_quantity)
SELECT org, branch, loc_a, variant_1, 0, 0, 0 FROM fx;
UPDATE inventory_balances SET on_hand_quantity = 100
WHERE location_id = (SELECT loc_a FROM fx) AND variant_id = (SELECT variant_1 FROM fx);
SET LOCAL ambra.inventory_movement_engine = 'off';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

-- line A: reserve + allocate 10 at loc_a; line B: 3 at loc_a.
UPDATE fx SET res_a = (inventory_create_reservation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT loc_a FROM fx), 'quantity', 10)),
  'repair_order_line', (SELECT line_a FROM fx), null, null, null, (SELECT e2e_user FROM fx)
) ->> 'reservation_id')::uuid;
UPDATE fx SET resline_a = (SELECT id FROM inventory_reservation_lines WHERE reservation_id = (SELECT res_a FROM fx));
UPDATE fx SET alloc_a = (inventory_create_allocation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT loc_a FROM fx), 'quantity', 10, 'reservation_line_id', (SELECT resline_a FROM fx))),
  (SELECT res_a FROM fx), 'repair_order_line', (SELECT line_a FROM fx), null, (SELECT e2e_user FROM fx)
) ->> 'allocation_id')::uuid;
UPDATE fx SET allocline_a = (SELECT id FROM inventory_allocation_lines WHERE allocation_id = (SELECT alloc_a FROM fx));

UPDATE fx SET res_b = (inventory_create_reservation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT loc_a FROM fx), 'quantity', 3)),
  'repair_order_line', (SELECT line_b FROM fx), null, null, null, (SELECT e2e_user FROM fx)
) ->> 'reservation_id')::uuid;
UPDATE fx SET resline_b = (SELECT id FROM inventory_reservation_lines WHERE reservation_id = (SELECT res_b FROM fx));
UPDATE fx SET alloc_b = (inventory_create_allocation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT loc_a FROM fx), 'quantity', 3, 'reservation_line_id', (SELECT resline_b FROM fx))),
  (SELECT res_b FROM fx), 'repair_order_line', (SELECT line_b FROM fx), null, (SELECT e2e_user FROM fx)
) ->> 'allocation_id')::uuid;
UPDATE fx SET allocline_b = (SELECT id FROM inventory_allocation_lines WHERE allocation_id = (SELECT alloc_b FROM fx));

-- C1 at loc_a: 6 of line A + all 3 of line B. C2 at loc_a: the other 4 of
-- line A. C3: empty. C4: to be archived.
UPDATE fx SET c1 = (inventory_create_container((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  '117-C1', (SELECT loc_a FROM fx), 'container', 'repair_order', (SELECT ro FROM fx)::text) ->> 'container_id')::uuid;
UPDATE fx SET c2 = (inventory_create_container((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  '117-C2', (SELECT loc_a FROM fx), 'container', 'repair_order', (SELECT ro FROM fx)::text) ->> 'container_id')::uuid;
UPDATE fx SET c3 = (inventory_create_container((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  '117-C3', (SELECT loc_a FROM fx), 'container', 'repair_order', (SELECT ro FROM fx)::text) ->> 'container_id')::uuid;
UPDATE fx SET c4 = (inventory_create_container((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  '117-C4', (SELECT loc_a FROM fx), 'container', 'repair_order', (SELECT ro FROM fx)::text) ->> 'container_id')::uuid;

SELECT repair_order_add_allocation_to_container((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT c1 FROM fx), (SELECT allocline_a FROM fx), 6);
SELECT repair_order_add_allocation_to_container((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT c1 FROM fx), (SELECT allocline_b FROM fx), 3);
SELECT repair_order_add_allocation_to_container((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT c2 FROM fx), (SELECT allocline_a FROM fx), 4);

-- ---------------------------------------------------------------------------
-- Happy path: relocate C1 (9 units, two allocation lines) to loc_b.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE r1 AS
SELECT inventory_relocate_container((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT c1 FROM fx), (SELECT loc_b FROM fx), '117 move') AS result;
UPDATE fx SET movement_id = ((SELECT result FROM r1) ->> 'movement_id')::uuid;

INSERT INTO test_log(line) SELECT is((result ->> 'line_count')::int, 1, 'T1: relocation returns one moved container line (same variant aggregated)') FROM r1;
INSERT INTO test_log(line) SELECT ok((result ->> 'document_number') IS NOT NULL,'T2: a posted document number is returned') FROM r1;

INSERT INTO test_log(line) SELECT is(
  (SELECT current_location_id FROM inventory_containers WHERE id = (SELECT c1 FROM fx)),
  (SELECT loc_b FROM fx), 'T3: C1 now points at loc_b');

INSERT INTO test_log(line) SELECT is(
  (SELECT movement_type_code || ':' || status FROM inventory_movement_headers WHERE id = (SELECT movement_id FROM fx)),
  '801:posted', 'T4: the movement is a posted 801');

INSERT INTO test_log(line) SELECT is(
  (SELECT count(*)::int FROM inventory_movement_lines WHERE movement_id = (SELECT movement_id FROM fx)
     AND container_id = (SELECT c1 FROM fx) AND quantity = 9
     AND source_location_id = (SELECT loc_a FROM fx) AND destination_location_id = (SELECT loc_b FROM fx)),
  1, 'T5: the 801 line carries container_id, qty 9, loc_a -> loc_b');

INSERT INTO test_log(line) SELECT is(
  (SELECT on_hand_quantity FROM inventory_balances WHERE location_id = (SELECT loc_a FROM fx) AND variant_id = (SELECT variant_1 FROM fx)),
  91::numeric, 'T6: on_hand at loc_a = 100 - 9');
INSERT INTO test_log(line) SELECT is(
  (SELECT on_hand_quantity FROM inventory_balances WHERE location_id = (SELECT loc_b FROM fx) AND variant_id = (SELECT variant_1 FROM fx)),
  9::numeric, 'T7: on_hand at loc_b = 9');
INSERT INTO test_log(line) SELECT is(
  (SELECT allocated_quantity FROM inventory_balances WHERE location_id = (SELECT loc_a FROM fx) AND variant_id = (SELECT variant_1 FROM fx)),
  4::numeric, 'T8: allocated at loc_a = 13 - 9 (C2''s 4 stay)');
INSERT INTO test_log(line) SELECT is(
  (SELECT allocated_quantity FROM inventory_balances WHERE location_id = (SELECT loc_b FROM fx) AND variant_id = (SELECT variant_1 FROM fx)),
  9::numeric, 'T9: allocated at loc_b = 9 (commitment followed the stock)');

INSERT INTO test_log(line) SELECT is(
  (SELECT location_id::text || ':' || allocated_quantity::text FROM inventory_allocation_lines WHERE id = (SELECT allocline_b FROM fx)),
  (SELECT loc_b FROM fx)::text || ':' || (3::numeric(18,6))::text,
  'T10: line B''s allocation (wholly in C1) moved in place to loc_b');

INSERT INTO test_log(line) SELECT is(
  (SELECT location_id::text || ':' || allocated_quantity::text FROM inventory_allocation_lines WHERE id = (SELECT allocline_a FROM fx)),
  (SELECT loc_a FROM fx)::text || ':' || (4::numeric(18,6))::text,
  'T11: line A''s original allocation line keeps the 4 still in C2 at loc_a');

INSERT INTO test_log(line) SELECT is(
  (SELECT count(*)::int FROM inventory_allocation_lines WHERE allocation_id = (SELECT alloc_a FROM fx)
     AND location_id = (SELECT loc_b FROM fx) AND allocated_quantity = 6 AND fulfilled_quantity = 0
     AND reservation_line_id = (SELECT resline_a FROM fx)),
  1, 'T12: the moved 6 of line A were split onto a new allocation line at loc_b (same allocation, same reservation line)');

INSERT INTO test_log(line) SELECT is(
  (SELECT count(*)::int FROM inventory_allocation_container_links l
     JOIN inventory_container_lines cl ON cl.id = l.container_line_id
     JOIN inventory_allocation_lines al ON al.id = l.allocation_line_id
   WHERE cl.container_id = (SELECT c1 FROM fx) AND l.deleted_at IS NULL AND al.location_id <> (SELECT loc_b FROM fx)),
  0, 'T13: every C1 link now points at an allocation line located at loc_b');

INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(l.quantity), 0) FROM inventory_allocation_container_links l
     JOIN inventory_container_lines cl ON cl.id = l.container_line_id
   WHERE cl.container_id = (SELECT c2 FROM fx) AND l.deleted_at IS NULL AND l.allocation_line_id = (SELECT allocline_a FROM fx)),
  4::numeric, 'T14: C2''s link is untouched (still 4 on the original line A allocation)');

INSERT INTO test_log(line) SELECT is(
  (SELECT reserved_quantity - released_quantity - fulfilled_quantity FROM inventory_reservation_lines WHERE id = (SELECT resline_a FROM fx)),
  0::numeric, 'T15: reservation line A is not re-opened by the split');

-- ---------------------------------------------------------------------------
-- Rejections.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  PERFORM inventory_relocate_container((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
    (SELECT c1 FROM fx), (SELECT loc_b FROM fx), NULL);
  INSERT INTO test_log(line) SELECT fail('T16: expected same-location rejection');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '22023', 'T16: relocating to the current location is rejected (22023) -- a retry is harmless');
END $$;

DO $$
BEGIN
  PERFORM inventory_relocate_container((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
    (SELECT c2 FROM fx), (SELECT loc_nostock FROM fx), NULL);
  INSERT INTO test_log(line) SELECT fail('T17: expected non-stockable rejection');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '22023', 'T17: a non-stockable destination is rejected (22023)');
END $$;

DO $$
BEGIN
  PERFORM inventory_relocate_container((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
    gen_random_uuid(), (SELECT loc_b FROM fx), NULL);
  INSERT INTO test_log(line) SELECT fail('T18: expected unknown-container rejection');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0002', 'T18: an unknown container is rejected (P0002)');
END $$;

DO $$
BEGIN
  PERFORM inventory_relocate_container(gen_random_uuid(), (SELECT org FROM fx), (SELECT branch FROM fx),
    (SELECT c2 FROM fx), (SELECT loc_b FROM fx), NULL);
  INSERT INTO test_log(line) SELECT fail('T19: expected actor mismatch rejection');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '28000', 'T19: an actor that is not the caller is rejected (28000)');
END $$;

-- ---------------------------------------------------------------------------
-- Empty container: pointer only.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE r3 AS
SELECT inventory_relocate_container((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT c3 FROM fx), (SELECT loc_b FROM fx), NULL) AS result;
INSERT INTO test_log(line) SELECT ok(
  (SELECT result ->> 'movement_id' FROM r3) IS NULL
  AND (SELECT current_location_id FROM inventory_containers WHERE id = (SELECT c3 FROM fx)) = (SELECT loc_b FROM fx),
  'T20: an empty container moves its pointer only, no movement posted');

RESET ROLE;

-- Archived container (status set directly as the owner; RO containers are
-- not writable by authenticated clients).
UPDATE inventory_containers SET status = 'archived' WHERE id = (SELECT c4 FROM fx);

-- Forced failure after the commitment has been moved: 801 deactivated, so
-- inventory_create_draft raises after step 1 ran.
UPDATE inventory_movement_types SET is_active = false
WHERE organization_id = (SELECT org FROM fx) AND code = '801';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

DO $$
BEGIN
  PERFORM inventory_relocate_container((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
    (SELECT c4 FROM fx), (SELECT loc_b FROM fx), NULL);
  INSERT INTO test_log(line) SELECT fail('T21: expected archived rejection');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '55000', 'T21: an archived container is rejected (55000)');
END $$;

DO $$
BEGIN
  PERFORM inventory_relocate_container((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
    (SELECT c2 FROM fx), (SELECT loc_b FROM fx), NULL);
  INSERT INTO test_log(line) SELECT fail('T22: expected the forced failure');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT pass('T22: relocation fails when the 801 cannot be drafted');
END $$;

INSERT INTO test_log(line) SELECT ok(
  (SELECT current_location_id FROM inventory_containers WHERE id = (SELECT c2 FROM fx)) = (SELECT loc_a FROM fx)
  AND (SELECT allocated_quantity FROM inventory_balances WHERE location_id = (SELECT loc_a FROM fx) AND variant_id = (SELECT variant_1 FROM fx)) = 4
  AND (SELECT on_hand_quantity FROM inventory_balances WHERE location_id = (SELECT loc_a FROM fx) AND variant_id = (SELECT variant_1 FROM fx)) = 91
  AND (SELECT location_id FROM inventory_allocation_lines WHERE id = (SELECT allocline_a FROM fx)) = (SELECT loc_a FROM fx),
  'T23: the failed relocation left pointer, balances and allocation lines untouched (atomic)');

RESET ROLE;

INSERT INTO test_log(line) SELECT ok(
  NOT has_function_privilege('anon', 'public.inventory_relocate_container(uuid, uuid, uuid, uuid, uuid, text)', 'EXECUTE'),
  'T24: anon cannot execute inventory_relocate_container');

SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') AS not_ok_count, count(*) AS total_assertions FROM test_log;

ROLLBACK;
