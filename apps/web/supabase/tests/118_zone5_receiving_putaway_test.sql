-- ============================================================================
-- TEST: Zone 5 -- receiving zone and putaway
-- ============================================================================
-- Full chain on a fresh branch:
--   PZ (101) into the receiving zone -> attribute lines to RepairOrderLines
--   via their Matcher source lines -> "Do rozlokowania" read model ->
--   putaway: RepairOrder standard part (into a new RO container), RepairOrder
--   bulk part (to its fixed bin, reserved, no container), free stock (loose).
-- Plus: no reservation at the receiving zone; quantity/destination guards;
-- anon has no EXECUTE.
-- Executed live against supabase-target via Supabase MCP; everything rolls back.

BEGIN;

SELECT plan(22);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, e2e_user uuid,
  v_std uuid, v_bulk uuid, p_bulk uuid, unit uuid,
  m_std uuid, m_bulk uuid,
  loc_prz uuid, loc_l1 uuid, loc_bin uuid,
  ro uuid, rol_std uuid, rol_bulk uuid,
  session_id uuid, doc_id uuid, wsdl_std uuid, wsdl_bulk uuid,
  pz uuid, pz_line_std uuid, pz_line_bulk uuid, pz_line_free uuid
);
GRANT SELECT, UPDATE ON fx TO authenticated;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  'e11a5012-d136-4551-952d-6b264023737c'::uuid,
  'b0dfa049-5ef0-45b9-8ec7-29d6d8113bd1'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid,
  '49864df7-5275-48f1-a95e-fdafadce3249'::uuid,
  'cacbf1f9-1803-4f4b-8c8f-78aeac029777'::uuid,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  null, null, null, null;

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

-- Fresh branch (e2e_user holds an org-wide warehouse.* grant here).
INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch, org, '118-zone5-branch', 996 FROM fx;

INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT loc_prz, org, branch, '118 strefa przyjęć', '118-PRZ', true, 'receiving' FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc_l1, org, branch, '118 regał', '118-L1', true FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc_bin, org, branch, '118 kuweta', '118-BIN', true FROM fx;

-- RepairOrder materialized from a Matcher document: lines carry only a
-- product code (variant_id NULL), linked to their Matcher source lines.
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, zl_number, status)
SELECT ro, org, branch, '118-RO', '118ZL', 'open' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT rol_std, ro, NULL, 'R1234YF5', '118 standard part', 2, 'szt' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT rol_bulk, ro, NULL, 'R2016V', '118 bulk clips', 20, 'szt' FROM fx;

INSERT INTO wdd_matcher_sessions (id, organization_id, branch_id, name)
SELECT session_id, org, branch, '118-session' FROM fx;
INSERT INTO workshop_source_documents (id, organization_id, branch_id, document_type, external_document_number, source_session_id)
SELECT doc_id, org, branch, 'zl', '118ZL', session_id FROM fx;
INSERT INTO workshop_source_document_lines (id, workshop_source_document_id, wdd_matcher_line_id, product_code, quantity)
SELECT wsdl_std, doc_id, m_std, 'R1234YF5', 2 FROM fx;
INSERT INTO workshop_source_document_lines (id, workshop_source_document_id, wdd_matcher_line_id, product_code, quantity)
SELECT wsdl_bulk, doc_id, m_bulk, 'R2016V', 20 FROM fx;
INSERT INTO repair_order_line_source_links (repair_order_line_id, workshop_source_document_line_id, quantity_contribution)
SELECT rol_std, wsdl_std, 2 FROM fx;
INSERT INTO repair_order_line_source_links (repair_order_line_id, workshop_source_document_line_id, quantity_contribution)
SELECT rol_bulk, wsdl_bulk, 20 FROM fx;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

-- Bulk handling + fixed bin, written as the user through RLS.
INSERT INTO inventory_product_branch_settings (organization_id, branch_id, product_id, handling_mode, default_location_id)
SELECT org, branch, p_bulk, 'bulk', loc_bin FROM fx;
INSERT INTO test_log(line) SELECT is(
  (SELECT handling_mode FROM inventory_product_branch_settings WHERE branch_id = (SELECT branch FROM fx)),
  'bulk', 'T1: product branch settings are writable/readable through RLS with warehouse.* (products.manage)');

-- PZ into the receiving zone: 2 std (for ZL), 20 bulk (for ZL), 3 std free.
UPDATE fx SET pz = (inventory_create_and_finalize(
  (SELECT org FROM fx), (SELECT branch FROM fx), '101',
  jsonb_build_array(
    jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx), 'quantity', 2, 'destination_location_id', (SELECT loc_prz FROM fx)),
    jsonb_build_object('variant_id', (SELECT v_bulk FROM fx), 'unit_id', (SELECT unit FROM fx), 'quantity', 20, 'destination_location_id', (SELECT loc_prz FROM fx)),
    jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx), 'quantity', 3, 'destination_location_id', (SELECT loc_prz FROM fx))),
  NULL, NULL, NULL, '118-PZ', NULL, NULL, (SELECT e2e_user FROM fx)
) ->> 'movement_id')::uuid;
UPDATE fx SET
  pz_line_std = (SELECT id FROM inventory_movement_lines WHERE movement_id = (SELECT pz FROM fx) AND line_number = 1),
  pz_line_bulk = (SELECT id FROM inventory_movement_lines WHERE movement_id = (SELECT pz FROM fx) AND line_number = 2),
  pz_line_free = (SELECT id FROM inventory_movement_lines WHERE movement_id = (SELECT pz FROM fx) AND line_number = 3);

CREATE TEMP TABLE attr AS
SELECT inventory_attribute_receipt_lines((SELECT e2e_user FROM fx), (SELECT pz FROM fx), jsonb_build_array(
  jsonb_build_object('movement_line_id', (SELECT pz_line_std FROM fx), 'source_line_id', (SELECT m_std FROM fx)),
  jsonb_build_object('movement_line_id', (SELECT pz_line_bulk FROM fx), 'source_line_id', (SELECT m_bulk FROM fx)),
  jsonb_build_object('movement_line_id', (SELECT pz_line_free FROM fx), 'source_line_id', gen_random_uuid())
)) AS r;
GRANT SELECT ON attr TO authenticated;

INSERT INTO test_log(line) SELECT is(jsonb_array_length(r->'attributed'), 2, 'T2: two PZ lines attributed through their Matcher lines') FROM attr;
INSERT INTO test_log(line) SELECT is(r->'skipped'->0->>'reason', 'no_repair_order_line', 'T3: an unresolvable source line is skipped and reported, the PZ stands') FROM attr;
INSERT INTO test_log(line) SELECT ok(
  (SELECT variant_id FROM repair_order_lines WHERE id = (SELECT rol_std FROM fx)) = (SELECT v_std FROM fx)
  AND (SELECT variant_id FROM repair_order_lines WHERE id = (SELECT rol_bulk FROM fx)) = (SELECT v_bulk FROM fx),
  'T4: attribution fills the RepairOrderLines'' missing variant from the received item');

CREATE TEMP TABLE pend1 AS SELECT inventory_receiving_pending((SELECT org FROM fx), (SELECT branch FROM fx)) AS r;
GRANT SELECT ON pend1 TO authenticated;
INSERT INTO test_log(line) SELECT is(jsonb_array_length(r->'items'), 3, 'T5: pending lists 3 items (2 attributed + 1 free remainder)') FROM pend1;
INSERT INTO test_log(line) SELECT is(
  (SELECT (it->>'quantity')::numeric FROM pend1, jsonb_array_elements(r->'items') it
   WHERE it->>'repair_order_line_id' = (SELECT rol_std FROM fx)::text),
  2::numeric, 'T6: the standard part shows 2 pending for its RepairOrderLine');
INSERT INTO test_log(line) SELECT ok(
  (SELECT it->>'handling_mode' = 'bulk' AND it->>'default_location_id' = (SELECT loc_bin FROM fx)::text AND it->>'zl_number' = '118ZL'
   FROM pend1, jsonb_array_elements(r->'items') it
   WHERE it->>'repair_order_line_id' = (SELECT rol_bulk FROM fx)::text),
  'T7: the bulk item carries its handling mode, fixed bin and ZL');
INSERT INTO test_log(line) SELECT is(
  (SELECT (it->>'quantity')::numeric FROM pend1, jsonb_array_elements(r->'items') it
   WHERE it->>'repair_order_line_id' IS NULL AND it->>'variant_id' = (SELECT v_std FROM fx)::text),
  3::numeric, 'T8: the unattributed remainder (3) is listed as free');

-- Receiving zone stock is not available.
DO $$
BEGIN
  PERFORM inventory_create_reservation((SELECT org FROM fx), (SELECT branch FROM fx),
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'location_id', (SELECT loc_prz FROM fx), 'quantity', 1)),
    'repair_order_line', (SELECT rol_std FROM fx), NULL, NULL, NULL, (SELECT e2e_user FROM fx));
  INSERT INTO test_log(line) SELECT fail('T9: expected reservation at the receiving zone to be rejected');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '22023', 'T9: stock in the receiving zone cannot be reserved');
END $$;

-- Putaway: standard RepairOrder part -> new RO container at L1.
CREATE TEMP TABLE pa1 AS SELECT inventory_putaway_from_receiving((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT v_std FROM fx), 2, (SELECT loc_l1 FROM fx), (SELECT rol_std FROM fx), NULL) AS r;
GRANT SELECT ON pa1 TO authenticated;
INSERT INTO test_log(line) SELECT ok(r->>'mode' = 'container' AND (r->>'container_created')::boolean AND r->>'container_code' = 'K-118ZL-01',
  'T10: a standard RO part goes into a newly created RO container K-118ZL-01') FROM pa1;
INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(cl.quantity), 0) FROM inventory_container_lines cl JOIN inventory_containers c ON c.id = cl.container_id
   WHERE c.code = 'K-118ZL-01' AND c.branch_id = (SELECT branch FROM fx) AND cl.deleted_at IS NULL AND c.current_location_id = (SELECT loc_l1 FROM fx)),
  2::numeric, 'T11: the container at L1 holds the 2 parts');
INSERT INTO test_log(line) SELECT ok(
  (SELECT on_hand_quantity = 2 AND allocated_quantity = 2 AND reserved_quantity = 0 FROM inventory_balances
   WHERE location_id = (SELECT loc_l1 FROM fx) AND variant_id = (SELECT v_std FROM fx)),
  'T12: L1 balance: on_hand 2, allocated 2 (reservation converted to allocation)');

-- Putaway: bulk RepairOrder part -> fixed bin, reserved, no container.
CREATE TEMP TABLE pa2 AS SELECT inventory_putaway_from_receiving((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT v_bulk FROM fx), 20, (SELECT loc_bin FROM fx), (SELECT rol_bulk FROM fx), NULL) AS r;
GRANT SELECT ON pa2 TO authenticated;
INSERT INTO test_log(line) SELECT ok(r->>'mode' = 'bulk' AND r->>'container_id' IS NULL AND (r->>'reserved_quantity')::numeric = 20,
  'T13: a bulk RO part is put away without a container and reserved for its line') FROM pa2;
INSERT INTO test_log(line) SELECT ok(
  (SELECT on_hand_quantity = 20 AND reserved_quantity = 20 AND allocated_quantity = 0 FROM inventory_balances
   WHERE location_id = (SELECT loc_bin FROM fx) AND variant_id = (SELECT v_bulk FROM fx)),
  'T14: bin balance: on_hand 20, reserved 20 for the RepairOrder');

-- Putaway: free remainder -> loose at L1.
CREATE TEMP TABLE pa3 AS SELECT inventory_putaway_from_receiving((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT v_std FROM fx), 3, (SELECT loc_l1 FROM fx), NULL, NULL) AS r;
GRANT SELECT ON pa3 TO authenticated;
INSERT INTO test_log(line) SELECT is(r->>'mode', 'free', 'T15: free stock is put away loose') FROM pa3;
INSERT INTO test_log(line) SELECT ok(
  (SELECT on_hand_quantity = 5 AND allocated_quantity = 2 FROM inventory_balances
   WHERE location_id = (SELECT loc_l1 FROM fx) AND variant_id = (SELECT v_std FROM fx))
  AND (SELECT COALESCE(SUM(on_hand_quantity), 0) FROM inventory_balances WHERE location_id = (SELECT loc_prz FROM fx)) = 0,
  'T16: L1 now holds 5 (2 committed), the receiving zone is empty');

INSERT INTO test_log(line) SELECT is(
  jsonb_array_length(inventory_receiving_pending((SELECT org FROM fx), (SELECT branch FROM fx))->'items'), 0,
  'T17: nothing is pending after all three putaways');

-- Guards.
DO $$
BEGIN
  PERFORM inventory_putaway_from_receiving((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
    (SELECT v_std FROM fx), 1, (SELECT loc_l1 FROM fx), NULL, NULL);
  INSERT INTO test_log(line) SELECT fail('T18: expected no-free-stock rejection');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '22023', 'T18: putting away more free stock than is in the receiving zone is rejected');
END $$;

DO $$
BEGIN
  PERFORM inventory_putaway_from_receiving((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
    (SELECT v_std FROM fx), 1, (SELECT loc_l1 FROM fx), (SELECT rol_std FROM fx), NULL);
  INSERT INTO test_log(line) SELECT fail('T19: expected over-putaway rejection for the line');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '22023', 'T19: putting away more than the line has in the receiving zone is rejected');
END $$;

DO $$
BEGIN
  PERFORM inventory_putaway_from_receiving((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
    (SELECT v_std FROM fx), 1, (SELECT loc_prz FROM fx), NULL, NULL);
  INSERT INTO test_log(line) SELECT fail('T20: expected receiving-zone destination rejection');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '22023', 'T20: the receiving zone itself is not a putaway destination');
END $$;

DO $$
BEGIN
  PERFORM inventory_putaway_from_receiving(gen_random_uuid(), (SELECT org FROM fx), (SELECT branch FROM fx),
    (SELECT v_std FROM fx), 1, (SELECT loc_l1 FROM fx), NULL, NULL);
  INSERT INTO test_log(line) SELECT fail('T21: expected actor mismatch rejection');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '28000', 'T21: an actor that is not the caller is rejected');
END $$;

RESET ROLE;

INSERT INTO test_log(line) SELECT ok(
  NOT has_function_privilege('anon', 'public.inventory_putaway_from_receiving(uuid, uuid, uuid, uuid, numeric, uuid, uuid, uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.inventory_receiving_pending(uuid, uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.inventory_attribute_receipt_lines(uuid, uuid, jsonb)', 'EXECUTE'),
  'T22: anon cannot execute the Zone 5 functions');

SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') AS not_ok_count, count(*) AS total_assertions FROM test_log;

ROLLBACK;
