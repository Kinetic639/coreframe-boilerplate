-- ============================================================================
-- TEST: Phase 10A reservation integration -- RepairOrderLine -> Inventory Reservation
-- ============================================================================
-- Proves the REAL, UNMODIFIED generic reservation engine
-- (inventory_create_reservation / inventory_release_reservation, LIVE
-- VERIFIED SECURITY INVOKER, gated by their own has_branch_permission(...,
-- 'warehouse.inventory.operate') check) behaves correctly end-to-end when
-- called with reference_type='repair_order_line' / reference_id=<a real,
-- fixture RepairOrderLine id>, as the genuinely-RLS-enforced `authenticated`
-- role.
--
-- This file proves the DATABASE/ENGINE truth: real available-stock
-- reservation, same-SKU independence, multiple reservations per line,
-- over-reservation rejection (no partial write), release semantics, and
-- permission gating. It does NOT prove RepairOrdersService.reserveForLine's
-- own ownership/scope-resolution logic (org/branch derived from the
-- authoritative RepairOrderLine, never trusted from a caller; the no-variant
-- rejection) -- that logic lives entirely in TypeScript, not SQL, and is
-- proven instead in repair-orders.service.test.ts (mocked), exactly the
-- same DB-vs-service split Phase 10's own test suite already established.
--
-- IMPORTANT, disclosed finding: `inventory_reservations.reference_id` has
-- NO foreign-key constraint to `repair_order_lines` (or to anything) --
-- LIVE VERIFIED. The generic engine itself does not, and structurally
-- cannot, verify that a reference actually belongs to the caller's own
-- org/branch scope; it only checks the CALLER's own has_branch_permission
-- against the org/branch PARAMETERS passed to the RPC. The RepairOrder
-- domain's own security guarantee (a caller cannot reserve/release against
-- an out-of-scope RepairOrderLine) therefore lives entirely in
-- RepairOrdersService's own server-authoritative scope resolution, not in
-- any DB constraint -- see review-context.md section D for the full
-- discussion of this design boundary.
--
-- Executed live against supabase-target via Supabase MCP.

BEGIN;

SELECT plan(17);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, e2e_user uuid,
  ro uuid, line_a uuid, line_b uuid,
  variant_1 uuid, location_1 uuid
);
GRANT SELECT ON fx TO authenticated;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  'e39b15da-0a8d-4056-b5a2-80eb1da868a6'::uuid,
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '267be50d-7bdf-4329-b3e9-c115c5c7d2a9'::uuid;

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

-- ===========================================================================
-- Fixture setup (as the connecting role, unrestricted -- mirrors 095-097's
-- own convention).
-- ===========================================================================

INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT ro, org, branch, '098-test-RO', 'open' FROM fx;

INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT line_a, ro, variant_1, '098-SKU-X', '098 line A (same SKU as B)', 5, 'pcs' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT line_b, ro, variant_1, '098-SKU-X', '098 line B (same SKU as A)', 3, 'pcs' FROM fx;

-- Deterministic starting balance for this (location, variant) pair,
-- transaction-scoped -- reset regardless of any pre-existing real value,
-- safe because this whole file rolls back.
-- IC-7 note: inventory_guard_balance_write() now correctly fails closed
-- (COALESCE(...,'off')) when the engine GUC is unset, so this raw fixture
-- seed must set it first -- matching 102/106/107's own convention.
-- PRE-IC8 P0 note: the balance guard now enforces substance-validated
-- delta shapes (a physical on_hand change may never be combined with a
-- commitment change in the same statement -- no real business RPC ever
-- does that either). Split into 3 shape-compliant statements: a
-- zero-quantity INSERT (matches inventory_get_or_create_balance_for_
-- update's own shape), a commitment-shape reset, then a physical-shape
-- reset.
SET LOCAL ambra.inventory_movement_engine = 'on';
INSERT INTO inventory_balances (organization_id, branch_id, location_id, variant_id, on_hand_quantity, reserved_quantity, allocated_quantity)
SELECT org, branch, location_1, variant_1, 0, 0, 0 FROM fx
ON CONFLICT (organization_id, branch_id, location_id, variant_id, coalesce(lot_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(serial_id, '00000000-0000-0000-0000-000000000000'::uuid))
DO NOTHING;
UPDATE inventory_balances SET reserved_quantity = 0, allocated_quantity = 0
WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx)
  AND location_id = (SELECT location_1 FROM fx) AND variant_id = (SELECT variant_1 FROM fx);
UPDATE inventory_balances SET on_hand_quantity = 1000
WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx)
  AND location_id = (SELECT location_1 FROM fx) AND variant_id = (SELECT variant_1 FROM fx);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

-- T1: reserve 5 for line_a -> real RPC succeeds, status='active'.
CREATE TEMP TABLE rf1 AS
SELECT (inventory_create_reservation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT location_1 FROM fx), 'quantity', 5)),
  'repair_order_line', (SELECT line_a FROM fx), null, null, null, (SELECT e2e_user FROM fx)
)) AS result;
INSERT INTO test_log(line) SELECT is((result ->> 'status'), 'active', 'T1: real RPC reserve of 5 for line_a succeeds, status=active') FROM rf1;

-- T2: persisted reservation carries reference_type/reference_id exactly.
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*)::int FROM inventory_reservations WHERE id = ((SELECT result FROM rf1) ->> 'reservation_id')::uuid AND reference_type = 'repair_order_line' AND reference_id = (SELECT line_a FROM fx)),
  1,
  'T2: persisted reservation carries reference_type=repair_order_line, reference_id=line_a exactly'
);

-- T3: reservation line reserved=5, released=0, fulfilled=0 -> outstanding=5.
INSERT INTO test_log(line) SELECT is(
  (SELECT reserved_quantity - released_quantity - fulfilled_quantity FROM inventory_reservation_lines WHERE reservation_id = ((SELECT result FROM rf1) ->> 'reservation_id')::uuid),
  5::numeric,
  'T3: outstanding = reserved(5) - released(0) - fulfilled(0) = 5'
);

-- T4: same-SKU line_b has ZERO reservations after line_a's reserve -- never
-- inferred/merged by SKU.
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*)::int FROM inventory_reservations WHERE reference_type = 'repair_order_line' AND reference_id = (SELECT line_b FROM fx)),
  0,
  'T4: same-SKU line_b has zero reservations -- not inferred/merged by SKU'
);

-- T5: reserve 3 for line_b independently -> succeeds.
CREATE TEMP TABLE rf2 AS
SELECT (inventory_create_reservation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT location_1 FROM fx), 'quantity', 3)),
  'repair_order_line', (SELECT line_b FROM fx), null, null, null, (SELECT e2e_user FROM fx)
)) AS result;
INSERT INTO test_log(line) SELECT is((result ->> 'status'), 'active', 'T5: real RPC reserve of 3 for line_b (same SKU as A) succeeds independently') FROM rf2;

-- T6: line_b's own reservation shows reserved=3, independent of line_a's 5.
INSERT INTO test_log(line) SELECT is(
  (SELECT reserved_quantity FROM inventory_reservation_lines WHERE reservation_id = ((SELECT result FROM rf2) ->> 'reservation_id')::uuid),
  3::numeric,
  'T6: line_b''s reservation is exactly 3, independent of line_a''s 5'
);

-- T7: reserve AGAIN for line_a, a SECOND batch of 2 -> one RepairOrderLine
-- can have MULTIPLE active reservations (cardinality LIVE VERIFIED: no
-- uniqueness constraint on reference_type+reference_id).
CREATE TEMP TABLE rf3 AS
SELECT (inventory_create_reservation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT location_1 FROM fx), 'quantity', 2)),
  'repair_order_line', (SELECT line_a FROM fx), null, null, null, (SELECT e2e_user FROM fx)
)) AS result;
INSERT INTO test_log(line) SELECT is((result ->> 'status'), 'active', 'T7: a SECOND, independent reservation of 2 for line_a succeeds') FROM rf3;

-- T8: line_a now has TWO distinct reservation rows.
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*)::int FROM inventory_reservations WHERE reference_type = 'repair_order_line' AND reference_id = (SELECT line_a FROM fx)),
  2,
  'T8: line_a has exactly TWO distinct reservation rows (multi-reservation cardinality proven)'
);

-- T9: the read-model's own aggregation -- SUM of outstanding across BOTH of
-- line_a's reservations -- is exactly 5+2=7.
INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(rl.reserved_quantity - rl.released_quantity - rl.fulfilled_quantity), 0)
   FROM inventory_reservations r
   JOIN inventory_reservation_lines rl ON rl.reservation_id = r.id
   WHERE r.reference_type = 'repair_order_line' AND r.reference_id = (SELECT line_a FROM fx)),
  7::numeric,
  'T9: line_a''s total outstanding across both its reservations = 5+2 = 7'
);

-- T10: over-reservation -- available is now 1000-5-3-2=990; attempting 991
-- is rejected by the real RPC, not fabricated.
DO $$
BEGIN
  BEGIN
    PERFORM inventory_create_reservation(
      (SELECT org FROM fx), (SELECT branch FROM fx),
      jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT location_1 FROM fx), 'quantity', 991)),
      'repair_order_line', (SELECT line_a FROM fx), null, null, null, (SELECT e2e_user FROM fx)
    );
    INSERT INTO test_log(line) SELECT fail('T10: expected over-reservation rejection, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0001', 'T10: reserving 991 (available=990) is rejected by the real RPC (P0001, Insufficient available stock)');
  END;
END $$;

-- T11: no partial write -- line_a still has exactly TWO reservations after
-- the rejected attempt (not three).
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*)::int FROM inventory_reservations WHERE reference_type = 'repair_order_line' AND reference_id = (SELECT line_a FROM fx)),
  2,
  'T11: no partial write -- line_a still has exactly two reservations after the rejected over-reservation attempt'
);

-- T12: release line_a's FIRST reservation (qty 5) -- real RPC, cancel=true.
CREATE TEMP TABLE rf4 AS
SELECT (inventory_release_reservation(((SELECT result FROM rf1) ->> 'reservation_id')::uuid, (SELECT e2e_user FROM fx), true)) AS result;
INSERT INTO test_log(line) SELECT is((result ->> 'status'), 'cancelled', 'T12: releasing line_a''s first reservation (cancel=true) succeeds, status=cancelled') FROM rf4;

-- T13: that reservation's own line now shows released=5, outstanding=0.
INSERT INTO test_log(line) SELECT is(
  (SELECT reserved_quantity - released_quantity - fulfilled_quantity FROM inventory_reservation_lines WHERE reservation_id = ((SELECT result FROM rf1) ->> 'reservation_id')::uuid),
  0::numeric,
  'T13: the released reservation''s own outstanding is now 0 (released_quantity=5)'
);

-- T14: line_a's TOTAL outstanding (across both reservations) is now only
-- 2 -- the release of one reservation does not affect the other.
INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(rl.reserved_quantity - rl.released_quantity - rl.fulfilled_quantity), 0)
   FROM inventory_reservations r
   JOIN inventory_reservation_lines rl ON rl.reservation_id = r.id
   WHERE r.reference_type = 'repair_order_line' AND r.reference_id = (SELECT line_a FROM fx)),
  2::numeric,
  'T14: line_a''s total outstanding after releasing one of two reservations is 2 (only the second remains)'
);

-- T15: sequential over-sell proof -- reserve EXACTLY the remaining
-- available at this point (on_hand 1000, currently-reserved 5 -- T1's 5
-- was released in T12, T5's 3 and T7's 2 remain outstanding -- so
-- available = 1000-5 = 995), then immediately attempt 1 more -> rejected.
-- True concurrent multi-session proof is not expressible in pgTAP (single
-- connection) -- this proves the sequential/row-locked cap honestly,
-- without claiming a stronger concurrency guarantee than was tested.
CREATE TEMP TABLE rf5 AS
SELECT (inventory_create_reservation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT location_1 FROM fx), 'quantity', 995)),
  'repair_order_line', (SELECT line_a FROM fx), null, null, null, (SELECT e2e_user FROM fx)
)) AS result;
INSERT INTO test_log(line) SELECT is((result ->> 'status'), 'active', 'T15: reserving exactly the remaining available (995) succeeds') FROM rf5;

DO $$
BEGIN
  BEGIN
    PERFORM inventory_create_reservation(
      (SELECT org FROM fx), (SELECT branch FROM fx),
      jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT location_1 FROM fx), 'quantity', 1)),
      'repair_order_line', (SELECT line_a FROM fx), null, null, null, (SELECT e2e_user FROM fx)
    );
    INSERT INTO test_log(line) SELECT fail('T16: expected rejection (0 remaining available), call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0001', 'T16: with 0 remaining available, reserving even 1 more unit is rejected sequentially (row-locked balance check)');
  END;
END $$;

-- T17: permission denial -- actor lacking warehouse.inventory.operate ->
-- rejected by the RPC's own has_branch_permission check.
RESET ROLE;
DELETE FROM user_effective_permissions
WHERE user_id = (SELECT e2e_user FROM fx) AND organization_id = (SELECT org FROM fx)
  AND permission_slug_exact IN ('warehouse.inventory.operate', 'warehouse.inventory.adjust', 'warehouse.inventory.reverse');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

DO $$
BEGIN
  BEGIN
    PERFORM inventory_create_reservation(
      (SELECT org FROM fx), (SELECT branch FROM fx),
      jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT location_1 FROM fx), 'quantity', 1)),
      'repair_order_line', (SELECT line_a FROM fx), null, null, null, (SELECT e2e_user FROM fx)
    );
    INSERT INTO test_log(line) SELECT fail('T17: expected permission-denied rejection, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0001', 'T17: actor lacking warehouse.inventory.operate -> rejected by the RPC''s own permission check');
  END;
END $$;

RESET ROLE;

SELECT line FROM test_log ORDER BY seq;

ROLLBACK;
