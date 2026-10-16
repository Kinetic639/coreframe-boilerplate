-- ============================================================================
-- TEST: stage E6 -- RW 261 only for a repair order (docs/RESERVATIONS_BLOCKS_PLAN.md, decision 3)
-- ============================================================================
-- A 261 without a repair order is refused by the posting engine; the same
-- part issued through repair_order_issue_parts (for the order) is posted.
-- Executed live against supabase-target via Supabase MCP; everything rolls back.

BEGIN;

SELECT plan(2);

CREATE TEMP TABLE fx (org uuid, branch uuid, e2e_user uuid, v uuid, unit uuid, l1 uuid, ro uuid, rol uuid);
GRANT SELECT ON fx TO authenticated;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid, gen_random_uuid(), 'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid, '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

INSERT INTO branches (id, organization_id, name, branch_number) SELECT branch, org, '137-e6-branch', 991 FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT l1, org, branch, '137 regał', '137-L1', true FROM fx;
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, zl_number, status)
SELECT ro, org, branch, '137-RO', '137ZL', 'open' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT rol, ro, v, 'P137', '137 part', 1, 'szt' FROM fx;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

SELECT inventory_create_and_finalize((SELECT org FROM fx), (SELECT branch FROM fx), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT v FROM fx), 'unit_id', (SELECT unit FROM fx),
    'quantity', 2, 'destination_location_id', (SELECT l1 FROM fx))),
  NULL, NULL, NULL, '137-PZ', NULL, NULL, (SELECT e2e_user FROM fx));

DO $$
DECLARE v_draft jsonb;
BEGIN
  v_draft := inventory_create_draft((SELECT org FROM fx), (SELECT branch FROM fx), '261',
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT v FROM fx), 'unit_id', (SELECT unit FROM fx),
      'quantity', 1, 'source_location_id', (SELECT l1 FROM fx))),
    NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fx));
  PERFORM inventory_finalize_posting((v_draft->>'movement_id')::uuid, (SELECT e2e_user FROM fx));
  INSERT INTO test_log(line) SELECT fail('T1: expected an RW 261 without a repair order to be refused');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT ok(SQLERRM LIKE 'An RW 261 is posted only for a repair order%', 'T1: an RW 261 without a repair order is refused');
END $$;

-- The same part through the order: reserve, then issue.
SELECT inventory_reserve_for_repair_order((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT ro FROM fx), jsonb_build_array(jsonb_build_object('repair_order_line_id', (SELECT rol FROM fx), 'location_id', (SELECT l1 FROM fx), 'quantity', 1)), NULL);
CREATE TEMP TABLE iss AS SELECT repair_order_issue_parts((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT ro FROM fx), jsonb_build_array(jsonb_build_object('repair_order_line_id', (SELECT rol FROM fx), 'quantity', 1,
    'reservation_line_id', (SELECT id FROM inventory_reservation_lines WHERE repair_order_line_id = (SELECT rol FROM fx) LIMIT 1))),
  'Mechanik 137', NULL) AS r;
GRANT SELECT ON iss TO authenticated;
INSERT INTO test_log(line) SELECT ok(r->>'document_number' IS NOT NULL, 'T2: the RW for the repair order is posted') FROM iss;
RESET ROLE;

DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 137 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
