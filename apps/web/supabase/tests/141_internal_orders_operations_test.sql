-- ============================================================================
-- TEST: internal orders (ZW), stages E3 / E4
-- ============================================================================
-- A ZW made from a repair order reserves what is in stock at once (ONE REZ),
-- a new part becomes a new position; reserving never exceeds what a line
-- needs; a cancelled line (A) releases its reservation; the AutoStacja number
-- is set once; a delivery of that number joins the ordered line. A ZW for
-- another branch goes onto ONE MMJ- (stays reserved until the receiver accepts,
-- then W), the branch is found by its code;
-- parts reserved at another branch arrive under their ZW line.
-- Executed live against supabase-target via Supabase MCP; everything rolls back.

BEGIN;

SELECT plan(12);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, branch_b uuid, e2e_user uuid, v_std uuid, unit uuid,
  loc_prz uuid, loc_l1 uuid, loc_prz_b uuid, ro uuid, rol_a uuid,
  zw1 uuid, zw2 uuid, zw3 uuid, s1 uuid, f1 uuid, b1 uuid, l1 uuid, tr uuid, yy text
);
GRANT SELECT, UPDATE ON fx TO authenticated;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  gen_random_uuid(), gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  null, null, null, gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), null,
  lpad((extract(year from now())::int % 100)::text, 2, '0');

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch, org, '141-zw-a', 994 FROM fx;
INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch_b, org, '141-zw-b', 995 FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT loc_prz, org, branch, '141 strefa przyjęć', '141-PRZ', true, 'receiving' FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc_l1, org, branch, '141 regał', '141-L1', true FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT loc_prz_b, org, branch_b, '141 B strefa przyjęć', '141-BPRZ', true, 'receiving' FROM fx;

INSERT INTO repair_orders (id, organization_id, branch_id, order_number, zl_number, status, warehouse_code)
SELECT ro, org, branch, '141-RO', 'ZLEC/141/26/9141/BL', 'open', '9141' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit, variant_id)
SELECT rol_a, ro, 'P141A', '141 part A', 1, 'szt', v_std FROM fx;

-- Delivery of the AutoStacja ZW made in Ambra (part A).
INSERT INTO wdd_matcher_sessions (id, organization_id, branch_id, name, status)
SELECT s1, org, branch, '141 dostawa', 'ready_for_review' FROM fx;
INSERT INTO wdd_matcher_session_files (id, session_id, organization_id, file_role, file_name)
SELECT f1, s1, org, 'bc', '141.pdf' FROM fx;
INSERT INTO wdd_matcher_blocks (id, session_file_id, session_id, organization_id, block_index, block_type, metadata)
SELECT b1, f1, s1, org, 0, 'direct_order',
  jsonb_build_object('zw_number', 'ZW/7141/26/9141', 'zl_number', 'ZLEC/141/26/9141/BL') FROM fx;
INSERT INTO wdd_matcher_lines (id, block_id, session_id, organization_id, line_number, product_code, product_name, quantity)
SELECT l1, b1, s1, org, 1, 'P141A', '141 part A', 1 FROM fx;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

-- 4 free pieces at L1.
SELECT inventory_create_and_finalize((SELECT org FROM fx), (SELECT branch FROM fx), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
    'quantity', 4, 'destination_location_id', (SELECT loc_l1 FROM fx))),
  NULL, NULL, NULL, '141-PZ0', NULL, NULL, (SELECT e2e_user FROM fx));

-- ZW from the repair order: position A (1, reserved from L1) + a new part (2).
UPDATE fx SET zw1 = (internal_order_create((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT ro FROM fx), 'zw/7141/26/9141', NULL, NULL,
  jsonb_build_array(
    jsonb_build_object('repair_order_line_id', (SELECT rol_a FROM fx), 'quantity', 1,
      'reserve', jsonb_build_array(jsonb_build_object('location_id', (SELECT loc_l1 FROM fx), 'quantity', 1))),
    jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'product_name', '141 nowa część', 'quantity', 2)))
  ->>'internal_order_id')::uuid;

INSERT INTO test_log(line) SELECT ok(
  (SELECT order_number ~ ('^ZW/[0-9]+/' || (SELECT yy FROM fx) || '/9141$') AND source = 'manual'
     AND external_number = 'ZW/7141/26/9141' AND repair_order_id = (SELECT ro FROM fx)
   FROM internal_orders WHERE id = (SELECT zw1 FROM fx))
  AND (SELECT count(*) = 2 AND bool_and(ordered) AND count(DISTINCT repair_order_line_id) = 2
       FROM internal_order_lines WHERE internal_order_id = (SELECT zw1 FROM fx))
  AND (SELECT count(*) = 2 FROM repair_order_lines WHERE repair_order_id = (SELECT ro FROM fx)),
  'T1: a ZW from the repair order is numbered by its warehouse, lines are ordered (Z), the new part became a position');

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 1 FROM inventory_reservations r
   JOIN inventory_reservation_lines rl ON rl.reservation_id = r.id
   JOIN internal_order_lines iol ON iol.id = rl.internal_order_line_id
   WHERE r.reference_type = 'repair_order' AND r.reference_id = (SELECT ro FROM fx)
     AND iol.internal_order_id = (SELECT zw1 FROM fx) AND rl.location_id = (SELECT loc_l1 FROM fx)
     AND rl.repair_order_line_id = (SELECT rol_a FROM fx) AND rl.reserved_quantity = 1),
  'T2: what was in stock is reserved at once, through the repair order and under its ZW line');

-- Line 2: reserve 1 of 2, then ask for 2 more.
SELECT internal_order_reserve_from_stock((SELECT e2e_user FROM fx), (SELECT zw1 FROM fx),
  jsonb_build_array(jsonb_build_object(
    'internal_order_line_id', (SELECT id FROM internal_order_lines WHERE internal_order_id = (SELECT zw1 FROM fx) AND line_number = 2),
    'location_id', (SELECT loc_l1 FROM fx), 'quantity', 1)));

DO $$
BEGIN
  PERFORM internal_order_reserve_from_stock((SELECT e2e_user FROM fx), (SELECT zw1 FROM fx),
    jsonb_build_array(jsonb_build_object(
      'internal_order_line_id', (SELECT id FROM internal_order_lines WHERE internal_order_id = (SELECT zw1 FROM fx) AND line_number = 2),
      'location_id', (SELECT loc_l1 FROM fx), 'quantity', 2)));
  INSERT INTO test_log(line) SELECT fail('T3: expected reserving more than the line needs to be refused');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT ok(SQLERRM = 'Line 1: only 1 still needed',
    'T3: a line is never reserved beyond what it still needs (1 reserved of 2)');
END $$;

-- Cancel line 2 (A).
SELECT internal_order_cancel_line((SELECT e2e_user FROM fx),
  (SELECT id FROM internal_order_lines WHERE internal_order_id = (SELECT zw1 FROM fx) AND line_number = 2),
  'klient zrezygnował');
INSERT INTO test_log(line) SELECT ok(
  (SELECT cancelled_at IS NOT NULL AND cancel_reason = 'klient zrezygnował'
   FROM internal_order_lines WHERE internal_order_id = (SELECT zw1 FROM fx) AND line_number = 2)
  AND (SELECT s.reserved_quantity = 0 FROM internal_order_line_status s
       JOIN internal_order_lines iol ON iol.id = s.internal_order_line_id
       WHERE iol.internal_order_id = (SELECT zw1 FROM fx) AND iol.line_number = 2)
  AND (SELECT count(*) = 1 FROM inventory_reservation_events e
       JOIN inventory_reservation_lines rl ON rl.id = e.reservation_line_id
       JOIN internal_order_lines iol ON iol.id = rl.internal_order_line_id
       WHERE iol.internal_order_id = (SELECT zw1 FROM fx) AND iol.line_number = 2
         AND e.event_type = 'released' AND e.reason LIKE 'Anulowanie pozycji %klient zrezygnował'),
  'T4: a cancelled line (A) keeps its row and reason, its reservation is released with a logged event');

-- The delivery of ZW/7141 (part A) joins ordered line 1.
SELECT inventory_create_and_finalize_receipt(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
    'quantity', 1, 'destination_location_id', (SELECT loc_prz FROM fx))),
  NULL, NULL, NULL, '141-PZ1', NULL, NULL, (SELECT e2e_user FROM fx),
  jsonb_build_array(jsonb_build_object('line_index', 1, 'zl_number', 'ZW/7141/26/9141',
    'product_code', 'P141A', 'source_line_id', (SELECT l1 FROM fx))));
INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 2 FROM internal_order_lines WHERE internal_order_id = (SELECT zw1 FROM fx))
  AND (SELECT count(*) = 1 FROM internal_order_line_movement_links k
       JOIN internal_order_lines iol ON iol.id = k.internal_order_line_id
       WHERE iol.internal_order_id = (SELECT zw1 FROM fx) AND iol.line_number = 1
         AND k.relation_type = 'receipt' AND k.repair_order_line_id = (SELECT rol_a FROM fx)),
  'T5: the delivery of the AutoStacja number joins its ordered line (no new line), received onto its position');

-- A ZW for branch B without a number: set it once.
UPDATE fx SET zw2 = (internal_order_create((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  NULL, NULL, '9999 Blacharnia B', 'w141',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'quantity', 1,
    'reserve', jsonb_build_array(jsonb_build_object('location_id', (SELECT loc_l1 FROM fx), 'quantity', 1)))))
  ->>'internal_order_id')::uuid;
SELECT internal_order_set_external_number((SELECT e2e_user FROM fx), (SELECT zw2 FROM fx), 'ZW/7142/26/9141');
DO $$
BEGIN
  PERFORM internal_order_set_external_number((SELECT e2e_user FROM fx), (SELECT zw2 FROM fx), 'ZW/7143/26/9141');
  INSERT INTO test_log(line) SELECT fail('T6: expected a second AutoStacja number to be refused');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT ok(
    SQLERRM = 'The AutoStacja number is already set'
    AND (SELECT external_number = 'ZW/7142/26/9141' AND client_kind = 'branch' AND destination_code = 'W141'
         FROM internal_orders WHERE id = (SELECT zw2 FROM fx)),
    'T6: the AutoStacja number is set once; the ZW is for branch code W141');
END $$;

-- Branch B goes by W141; ship ZW 2 there.
SELECT branch_set_external_codes((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch_b FROM fx), ARRAY['w141', ' 9999 ']);
CREATE TEMP TABLE shipped AS SELECT internal_order_ship((SELECT e2e_user FROM fx), (SELECT zw2 FROM fx)) AS r;
GRANT SELECT ON shipped TO authenticated;
UPDATE fx SET tr = (SELECT (r->>'transfer_id')::uuid FROM shipped);

INSERT INTO test_log(line) SELECT ok(
  (SELECT (r->>'destination_branch_id')::uuid = (SELECT branch_b FROM fx) FROM shipped)
  AND (SELECT status = 'in_transit' AND internal_order_id = (SELECT zw2 FROM fx) AND source_movement_id IS NULL
       FROM inventory_branch_transfers WHERE id = (SELECT tr FROM fx))
  AND (SELECT s.reserved_quantity = 1 AND s.issued_quantity = 0 FROM internal_order_line_status s
       WHERE s.internal_order_id = (SELECT zw2 FROM fx)),
  'T7: the ZW finds branch B by its code; in transit nothing is posted and the part stays reserved under the ZW');

-- Branch B accepts: MMJ- here and MMJ+ there, in one go.
CREATE TEMP TABLE accepted AS SELECT internal_order_accept_transfer((SELECT e2e_user FROM fx), (SELECT tr FROM fx)) AS r;
GRANT SELECT ON accepted TO authenticated;
INSERT INTO test_log(line) SELECT ok(
  (SELECT s.issued_quantity = 1 AND s.reserved_quantity = 0 FROM internal_order_line_status s
   WHERE s.internal_order_id = (SELECT zw2 FROM fx))
  AND (SELECT status = 'completed' AND destination_branch_id = (SELECT branch_b FROM fx)
       FROM internal_orders WHERE id = (SELECT zw2 FROM fx))
  AND (SELECT r->>'source_document_number' ~ '^MMJ-/[0-9]+/[0-9]{2}/9141$' FROM accepted),
  'T8: on acceptance the shipped part is W (R 0), the ZW is completed, the MMJ- is numbered by its unit');

INSERT INTO test_log(line) SELECT ok(
  (SELECT status = 'accepted' FROM inventory_branch_transfers WHERE id = (SELECT tr FROM fx))
  AND (SELECT on_hand_quantity = 1 AND reserved_quantity = 0 FROM inventory_balances
       WHERE location_id = (SELECT loc_prz_b FROM fx) AND variant_id = (SELECT v_std FROM fx)),
  'T9: branch B receives the part (MMJ+) into its receiving zone');

-- ZW 3 (repair order) gets its part reserved at branch B, sent by B, accepted here.
UPDATE fx SET zw3 = (internal_order_create((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT ro FROM fx), NULL, NULL, NULL,
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'product_name', '141 z B', 'quantity', 1)))
  ->>'internal_order_id')::uuid;
CREATE TEMP TABLE req AS SELECT internal_order_request_from_branch((SELECT e2e_user FROM fx), (SELECT zw3 FROM fx),
  (SELECT branch_b FROM fx),
  jsonb_build_array(jsonb_build_object(
    'internal_order_line_id', (SELECT id FROM internal_order_lines WHERE internal_order_id = (SELECT zw3 FROM fx)),
    'location_id', (SELECT loc_prz_b FROM fx), 'quantity', 1))) AS r;
GRANT SELECT ON req TO authenticated;
INSERT INTO test_log(line) SELECT ok(
  (SELECT t.status = 'prepared' AND t.source_branch_id = (SELECT branch_b FROM fx)
     AND t.internal_order_id = (SELECT zw3 FROM fx)
   FROM inventory_branch_transfers t WHERE t.id = (SELECT (r->>'transfer_id')::uuid FROM req))
  AND (SELECT reserved_quantity = 1 FROM inventory_balances
       WHERE location_id = (SELECT loc_prz_b FROM fx) AND variant_id = (SELECT v_std FROM fx)),
  'T10: the part is reserved at branch B for this ZW (prepared transfer)');

SELECT inventory_send_branch_transfer((SELECT (r->>'transfer_id')::uuid FROM req), (SELECT e2e_user FROM fx));
SELECT internal_order_accept_transfer((SELECT e2e_user FROM fx), (SELECT (r->>'transfer_id')::uuid FROM req));
INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 1 FROM inventory_reservation_lines rl
   JOIN internal_order_lines iol ON iol.id = rl.internal_order_line_id
   WHERE iol.internal_order_id = (SELECT zw3 FROM fx) AND rl.location_id = (SELECT loc_prz FROM fx)
     AND rl.repair_order_line_id = iol.repair_order_line_id AND rl.reserved_quantity = 1)
  AND (SELECT received_quantity = 1 AND reserved_quantity = 1 FROM internal_order_line_status s
       WHERE s.internal_order_id = (SELECT zw3 FROM fx)),
  'T11: accepted here, it is reserved under its ZW line through the repair order');

DO $$
BEGIN
  PERFORM internal_order_cancel_line((SELECT e2e_user FROM fx),
    (SELECT id FROM internal_order_lines WHERE internal_order_id = (SELECT zw3 FROM fx)), '  ');
  INSERT INTO test_log(line) SELECT fail('T12: expected a cancel without a reason to be refused');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT ok(SQLERRM = 'A reason is required', 'T12: cancelling needs a reason');
END $$;

DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 141 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
