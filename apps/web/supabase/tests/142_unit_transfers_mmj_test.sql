-- ============================================================================
-- TEST: transfers between units, MMJ- / MMJ+ (as in AutoStacja)
-- ============================================================================
-- "Wstrzymaj" keeps a draft (parts reserved, nothing posted). "Wyślij w
-- drogę" puts it in transit: still nothing posted, the parts stay on the
-- sender's stock, reserved. Accepting posts MMJ- at the sender and MMJ+ at
-- the receiver in one go, numbered MMJ-/<no>/<yy>/<unit> per unit. The
-- sender may withdraw until acceptance; the receiver accepts only in full.
-- Executed live against supabase-target via Supabase MCP; everything rolls back.

BEGIN;

SELECT plan(9);

CREATE TEMP TABLE fx (
  org uuid, a uuid, b uuid, e2e_user uuid, v_std uuid, unit uuid,
  prz_a uuid, prz_b uuid, l1 uuid, yy text
);
GRANT SELECT ON fx TO authenticated;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid, gen_random_uuid(), gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  lpad((extract(year from now())::int % 100)::text, 2, '0');

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

INSERT INTO branches (id, organization_id, name, branch_number)
SELECT a, org, '142-mmj-a', 983 FROM fx;
INSERT INTO branches (id, organization_id, name, branch_number)
SELECT b, org, '142-mmj-b', 984 FROM fx;
INSERT INTO branch_warehouses (organization_id, branch_id, code, name)
SELECT org, a, '9252', 'Seat' FROM fx;
INSERT INTO branch_warehouses (organization_id, branch_id, code, name)
SELECT org, b, '9142', 'Audi BC' FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT prz_a, org, a, '142 A przyjęcia', '142-APRZ', true, 'receiving' FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT prz_b, org, b, '142 B przyjęcia', '142-BPRZ', true, 'receiving' FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT l1, org, a, '142 A regał', '142-AL1', true FROM fx;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

SELECT inventory_create_and_finalize((SELECT org FROM fx), (SELECT a FROM fx), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'unit_id', (SELECT unit FROM fx),
    'quantity', 5, 'destination_location_id', (SELECT l1 FROM fx))),
  NULL, NULL, NULL, '142-PZ0', NULL, NULL, (SELECT e2e_user FROM fx));

-- "Nie — wstrzymaj": a draft of 2.
CREATE TEMP TABLE t1 AS SELECT inventory_create_branch_transfer((SELECT org FROM fx), (SELECT a FROM fx), (SELECT b FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'source_location_id', (SELECT l1 FROM fx),
    'unit_id', (SELECT unit FROM fx), 'quantity', 2)), '142 MMJ', (SELECT e2e_user FROM fx)) AS r;
GRANT SELECT ON t1 TO authenticated;

INSERT INTO test_log(line) SELECT ok(
  (SELECT status = 'prepared' FROM inventory_branch_transfers WHERE id = (SELECT (r->>'transfer_id')::uuid FROM t1))
  AND (SELECT on_hand_quantity = 5 AND reserved_quantity = 2 FROM inventory_balances
       WHERE location_id = (SELECT l1 FROM fx) AND variant_id = (SELECT v_std FROM fx)),
  'T1: a held MMJ- is a draft; the parts are reserved, stock unchanged');

-- "Tak — wyślij w drogę".
SELECT inventory_send_branch_transfer((SELECT (r->>'transfer_id')::uuid FROM t1), (SELECT e2e_user FROM fx));
INSERT INTO test_log(line) SELECT ok(
  (SELECT status = 'in_transit' AND source_movement_id IS NULL AND destination_movement_id IS NULL
   FROM inventory_branch_transfers WHERE id = (SELECT (r->>'transfer_id')::uuid FROM t1))
  AND (SELECT count(*) = 0 FROM inventory_movement_headers
       WHERE branch_id IN ((SELECT a FROM fx), (SELECT b FROM fx)) AND movement_type_code IN ('303', '305', '311', '312'))
  AND (SELECT on_hand_quantity = 5 AND reserved_quantity = 2 FROM inventory_balances
       WHERE location_id = (SELECT l1 FROM fx) AND variant_id = (SELECT v_std FROM fx)),
  'T2: in transit nothing is posted; the parts stay on the sender''s stock, reserved');

DO $$
BEGIN
  PERFORM inventory_accept_branch_transfer((SELECT (r->>'transfer_id')::uuid FROM t1), (SELECT prz_b FROM fx),
    (SELECT e2e_user FROM fx), '[]'::jsonb);
  INSERT INTO test_log(line) SELECT fail('T3: expected a partial acceptance to be refused');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT ok(SQLERRM = 'A transfer is accepted in full', 'T3: the receiver accepts in full only');
END $$;

CREATE TEMP TABLE acc1 AS SELECT inventory_accept_branch_transfer((SELECT (r->>'transfer_id')::uuid FROM t1),
  (SELECT prz_b FROM fx), (SELECT e2e_user FROM fx), NULL) AS r;
GRANT SELECT ON acc1 TO authenticated;

INSERT INTO test_log(line) SELECT ok(
  (SELECT r->>'source_document_number' = 'MMJ-/1/' || (SELECT yy FROM fx) || '/9252'
      AND r->>'destination_document_number' = 'MMJ+/1/' || (SELECT yy FROM fx) || '/9142' FROM acc1)
  AND (SELECT external_reference = (SELECT r->>'source_document_number' FROM acc1)
       FROM inventory_movement_headers WHERE id = (SELECT (r->>'destination_movement_id')::uuid FROM acc1)),
  'T4: on acceptance MMJ- and MMJ+ get numbers per unit (MMJ-/1/yy/9252, MMJ+/1/yy/9142), the MMJ+ names its MMJ-');

INSERT INTO test_log(line) SELECT ok(
  (SELECT on_hand_quantity = 3 AND reserved_quantity = 0 FROM inventory_balances
   WHERE location_id = (SELECT l1 FROM fx) AND variant_id = (SELECT v_std FROM fx))
  AND (SELECT on_hand_quantity = 2 FROM inventory_balances
       WHERE location_id = (SELECT prz_b FROM fx) AND variant_id = (SELECT v_std FROM fx))
  AND (SELECT status = 'accepted' FROM inventory_branch_transfers WHERE id = (SELECT (r->>'transfer_id')::uuid FROM t1)),
  'T5: only then the parts leave the sender (3 left) and land in the receiver''s receiving zone (2)');

-- Sent, then withdrawn by the sender.
CREATE TEMP TABLE t2 AS SELECT inventory_create_branch_transfer((SELECT org FROM fx), (SELECT a FROM fx), (SELECT b FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'source_location_id', (SELECT l1 FROM fx),
    'unit_id', (SELECT unit FROM fx), 'quantity', 1)), '142 MMJ 2', (SELECT e2e_user FROM fx)) AS r;
GRANT SELECT ON t2 TO authenticated;
SELECT inventory_send_branch_transfer((SELECT (r->>'transfer_id')::uuid FROM t2), (SELECT e2e_user FROM fx));
SELECT inventory_cancel_branch_transfer((SELECT (r->>'transfer_id')::uuid FROM t2), (SELECT e2e_user FROM fx), 'pomyłka');

INSERT INTO test_log(line) SELECT ok(
  (SELECT status = 'cancelled' AND cancel_reason = 'pomyłka' FROM inventory_branch_transfers
   WHERE id = (SELECT (r->>'transfer_id')::uuid FROM t2))
  AND (SELECT on_hand_quantity = 3 AND reserved_quantity = 0 FROM inventory_balances
       WHERE location_id = (SELECT l1 FROM fx) AND variant_id = (SELECT v_std FROM fx)),
  'T6: the sender withdraws an MMJ- in transit; the reservation is released, nothing was posted');

-- The next accepted MMJ continues the unit's numbering.
CREATE TEMP TABLE t3 AS SELECT inventory_create_branch_transfer((SELECT org FROM fx), (SELECT a FROM fx), (SELECT b FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT v_std FROM fx), 'source_location_id', (SELECT l1 FROM fx),
    'unit_id', (SELECT unit FROM fx), 'quantity', 1)), '142 MMJ 3', (SELECT e2e_user FROM fx)) AS r;
GRANT SELECT ON t3 TO authenticated;
SELECT inventory_send_branch_transfer((SELECT (r->>'transfer_id')::uuid FROM t3), (SELECT e2e_user FROM fx));
CREATE TEMP TABLE acc3 AS SELECT inventory_accept_branch_transfer((SELECT (r->>'transfer_id')::uuid FROM t3),
  (SELECT prz_b FROM fx), (SELECT e2e_user FROM fx), NULL) AS r;
GRANT SELECT ON acc3 TO authenticated;

INSERT INTO test_log(line) SELECT ok(
  (SELECT r->>'source_document_number' = 'MMJ-/2/' || (SELECT yy FROM fx) || '/9252'
      AND r->>'destination_document_number' = 'MMJ+/2/' || (SELECT yy FROM fx) || '/9142' FROM acc3),
  'T7: numbering continues per unit (…/2/…)');

DO $$
BEGIN
  PERFORM inventory_cancel_branch_transfer((SELECT (r->>'transfer_id')::uuid FROM t3), (SELECT e2e_user FROM fx), 'za późno');
  INSERT INTO test_log(line) SELECT fail('T8: expected withdrawing an accepted transfer to be refused');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT ok(SQLSTATE = 'P0007', 'T8: an accepted MMJ cannot be withdrawn');
END $$;

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 2 FROM inventory_movement_headers h
   JOIN inventory_movement_types t ON t.id = h.movement_type_id
   WHERE h.branch_id = (SELECT a FROM fx) AND h.movement_type_code = '303' AND h.status = 'posted')
  AND (SELECT count(*) = 2 FROM inventory_movement_headers h
       WHERE h.branch_id = (SELECT b FROM fx) AND h.movement_type_code = '305' AND h.status = 'posted'),
  'T9: the history: MMJ- at the sender, MMJ+ at the receiver, one pair per accepted transfer');

DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 142 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
