-- ============================================================================
-- TEST: Phase 10B allocation integration -- Reservation -> Allocation
-- ============================================================================
-- Proves the REAL, UNMODIFIED generic allocation engine
-- (inventory_create_allocation, LIVE VERIFIED SECURITY INVOKER, gated by its
-- own has_branch_permission(..., 'warehouse.inventory.operate') check)
-- behaves correctly end-to-end when called with a real, ownership-verified
-- reservation_line_id belonging to a real Phase 10A reservation attributed
-- to a RepairOrderLine, as the genuinely-RLS-enforced `authenticated` role.
--
-- This file proves the DATABASE/ENGINE truth: the reservation-line
-- fulfilled_quantity handshake, the inventory_balances reserved/allocated
-- transitions, partial allocation, multiple allocations against the same
-- reservation line, over-allocation rejection (no partial write), same-SKU
-- independence, cross-branch reservation_line_id rejection (a genuine engine-
-- level check, not merely a Zone 3 one), and permission gating. It does NOT
-- prove RepairOrdersService.allocateForLine's own ownership/scope-resolution
-- logic (org/branch/variant/location ALWAYS derived from the reservation
-- line's own row, never trusted from a caller; the cross-RepairOrderLine
-- rejection) -- that logic lives entirely in TypeScript, not SQL, and is
-- proven instead in repair-orders.service.test.ts (mocked), exactly the same
-- DB-vs-service split Phase 10A's own 098 test file already established.
--
-- IMPORTANT, disclosed finding (see review-context.md section E for the full
-- discussion): LIVE VERIFIED (reading inventory_create_allocation's own body
-- via pg_get_functiondef) the generic engine does NOT itself cross-check
-- that an allocation line's variant_id/location_id agrees with its own
-- reservation_line_id -- it trusts whatever p_lines supplies independently,
-- and updates the BALANCE ROW keyed by whatever location/variant p_lines
-- gives it, not the reservation line's own location/variant. This is why
-- RepairOrdersService.allocateForLine derives these fields from the
-- reservation line's own row rather than accepting them as client input --
-- a correctness/security decision made in the TypeScript service layer, not
-- something this pgTAP file can exercise (it always supplies the correct,
-- matching values, since it is proving the engine's own handshake, not the
-- wrapper's defense against a mismatched client payload).
--
-- DOMAIN-INTEGRITY CORRECTION (2026-09-14, external review): a single new
-- assertion, T-evidence, was added. It does NOT test
-- RepairOrdersService.allocateForLine (frozen, untouched by this
-- addition) -- it DEMONSTRATES, via the real generic reservation RPC used
-- exactly the way the generic Warehouse-module's own
-- createInventoryReservationAction would call it, that the underlying
-- schema/RLS genuinely permits a reservation HEADER to reference a real
-- RepairOrderLine while its own LINE carries a completely different
-- variant -- i.e. that the gap the correction pass closes in TypeScript
-- (see repair-orders.service.ts's own updated doc comments) is a real,
-- reachable database state, not a theoretical one. This is evidence FOR
-- why the application-layer guard is required, not a proof that the
-- guard itself works (that remains exclusively in
-- repair-orders.service.test.ts, since the guard is TypeScript domain
-- logic pgTAP cannot exercise). Every other assertion in this file (T1-
-- T18) is byte-for-byte unchanged from the accepted Phase 10B version.
--
-- Executed live against supabase-target via Supabase MCP.

BEGIN;

SELECT plan(20);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, branch_b uuid, e2e_user uuid,
  ro uuid, line_a uuid, line_b uuid,
  variant_1 uuid, location_1 uuid, location_b uuid,
  res_a uuid, resline_a uuid,
  res_b uuid, resline_b uuid,
  alloc_1 uuid, allocline_1 uuid,
  alloc_2 uuid
);
GRANT SELECT, UPDATE ON fx TO authenticated;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  'e39b15da-0a8d-4056-b5a2-80eb1da868a6'::uuid,
  gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '267be50d-7bdf-4329-b3e9-c115c5c7d2a9'::uuid,
  gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid();

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

-- ===========================================================================
-- Fixture setup (as the connecting role, unrestricted -- mirrors 095-098's
-- own convention).
-- ===========================================================================

-- Second branch, same org -- for the cross-branch reservation_line_id
-- rejection test (T17).
INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch_b, org, '099-test-branch-B', 992 FROM fx;

-- A real location genuinely scoped to branch_b -- needed so T17's call can
-- pass `inventory_balances`' own composite FK
-- (location_id, organization_id, branch_id) -> warehouse_locations(...)
-- (LIVE VERIFIED to exist and to be enforced BEFORE the engine ever reaches
-- its own reservation_line_id lookup) and isolate the SPECIFIC assertion
-- T17 makes (a reservation_line_id from a different branch than
-- p_branch_id is rejected) from an unrelated location/branch mismatch.
INSERT INTO warehouse_locations (id, organization_id, branch_id, name)
SELECT location_b, org, branch_b, '099-branch-b-location' FROM fx;

INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT ro, org, branch, '099-test-RO', 'open' FROM fx;

INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT line_a, ro, variant_1, '099-SKU-X', '099 line A (same SKU as B)', 10, 'pcs' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT line_b, ro, variant_1, '099-SKU-X', '099 line B (same SKU as A)', 5, 'pcs' FROM fx;

-- Deterministic starting balance for this (location, variant) pair,
-- transaction-scoped -- reset regardless of any pre-existing real value,
-- safe because this whole file rolls back.
-- IC-7 note: inventory_guard_balance_write() now correctly fails closed
-- (COALESCE(...,'off')) when the engine GUC is unset, so this raw fixture
-- seed must set it first -- matching 102/106/107's own convention.
-- PRE-IC8 P0 note: split into shape-compliant statements -- see 098's
-- own identical note for the full rationale.
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

-- No explicit permission grant/delete here -- e2e_user already holds a
-- real, permanent, ORG-WIDE `warehouse.*` wildcard grant in this fixture
-- org (LIVE VERIFIED: `has_permission(org, 'warehouse.inventory.operate')`
-- and `has_branch_permission(org, <any branch>, 'warehouse.inventory.
-- operate')` both return true for it, including for branch_b created just
-- above, with zero grant needed) -- exactly the same pre-existing grant
-- 098's own T1-T16 already relied on (098 never grants anything until its
-- own final T17 permission-denial test, which strips specific exact
-- slugs). `inventory_settings`'s own INSERT policy (hit internally by both
-- inventory_create_reservation and inventory_create_allocation, via their
-- shared `INSERT ... ON CONFLICT (organization_id) DO NOTHING` warm-up)
-- requires org-wide `has_permission`, NOT merely `has_branch_permission`
-- -- LIVE VERIFIED (dry run) a branch-scoped-only grant fails this specific
-- check even when the row already exists and the statement resolves to a
-- no-op, which is why this file deliberately does NOT construct a
-- branch-scoped-only grant the way earlier Zone 3 fixtures did for simpler
-- RPCs that never touch `inventory_settings`.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

-- T1: reserve 10 for line_a via the real reservation RPC -- succeeds.
CREATE TEMP TABLE rf1 AS
SELECT (inventory_create_reservation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT location_1 FROM fx), 'quantity', 10)),
  'repair_order_line', (SELECT line_a FROM fx), null, null, null, (SELECT e2e_user FROM fx)
)) AS result;
INSERT INTO test_log(line) SELECT is((result ->> 'status'), 'active', 'T1: real RPC reserve of 10 for line_a succeeds, status=active') FROM rf1;

UPDATE fx SET res_a = ((SELECT result FROM rf1) ->> 'reservation_id')::uuid;
UPDATE fx SET resline_a = (SELECT id FROM inventory_reservation_lines WHERE reservation_id = (SELECT res_a FROM fx));

-- T2: allocate 4 against line_a's reservation line, reservation-backed
-- (reservation_line_id set) -- the ONLY path this phase's own service ever
-- exercises for RepairOrders (reservation-first is a hard Zone 3 invariant).
CREATE TEMP TABLE rf2 AS
SELECT (inventory_create_allocation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object(
    'variant_id', (SELECT variant_1 FROM fx),
    'location_id', (SELECT location_1 FROM fx),
    'quantity', 4,
    'reservation_line_id', (SELECT resline_a FROM fx)
  )),
  (SELECT res_a FROM fx), 'repair_order_line', (SELECT line_a FROM fx), null, (SELECT e2e_user FROM fx)
)) AS result;
INSERT INTO test_log(line) SELECT is((result ->> 'status'), 'active', 'T2: real RPC allocate of 4 (reservation-backed) for line_a succeeds, status=active') FROM rf2;

UPDATE fx SET alloc_1 = ((SELECT result FROM rf2) ->> 'allocation_id')::uuid;
UPDATE fx SET allocline_1 = (SELECT id FROM inventory_allocation_lines WHERE allocation_id = (SELECT alloc_1 FROM fx));

-- T3: the reservation-fulfilled handshake -- reservation_line.fulfilled_quantity is now 4.
INSERT INTO test_log(line) SELECT is(
  (SELECT fulfilled_quantity FROM inventory_reservation_lines WHERE id = (SELECT resline_a FROM fx)),
  4::numeric, 'T3: reservation line fulfilled_quantity = 4 after allocating 4'
);

-- T4: balance reserved_quantity decreased by exactly the allocated amount (10 -> 6).
INSERT INTO test_log(line) SELECT is(
  (SELECT reserved_quantity FROM inventory_balances WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx) AND location_id = (SELECT location_1 FROM fx) AND variant_id = (SELECT variant_1 FROM fx)),
  6::numeric, 'T4: balance reserved_quantity decreased from 10 to 6 (allocated 4)'
);

-- T5: balance allocated_quantity increased by exactly the allocated amount (0 -> 4).
INSERT INTO test_log(line) SELECT is(
  (SELECT allocated_quantity FROM inventory_balances WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx) AND location_id = (SELECT location_1 FROM fx) AND variant_id = (SELECT variant_1 FROM fx)),
  4::numeric, 'T5: balance allocated_quantity increased from 0 to 4'
);

-- T6: the allocation line persisted with the correct location_id.
INSERT INTO test_log(line) SELECT is(
  (SELECT location_id FROM inventory_allocation_lines WHERE id = (SELECT allocline_1 FROM fx)),
  (SELECT location_1 FROM fx), 'T6: allocation line persisted with the correct location_id'
);

-- T7: the allocation line persisted with the correct variant_id.
INSERT INTO test_log(line) SELECT is(
  (SELECT variant_id FROM inventory_allocation_lines WHERE id = (SELECT allocline_1 FROM fx)),
  (SELECT variant_1 FROM fx), 'T7: allocation line persisted with the correct variant_id'
);

-- T8: allocation outstanding = allocated(4) - fulfilled(0) = 4.
INSERT INTO test_log(line) SELECT is(
  (SELECT allocated_quantity - fulfilled_quantity FROM inventory_allocation_lines WHERE id = (SELECT allocline_1 FROM fx)),
  4::numeric, 'T8: allocation outstanding = allocated(4) - fulfilled(0) = 4'
);

-- T9: reservation outstanding = reserved(10) - released(0) - fulfilled(4) = 6.
INSERT INTO test_log(line) SELECT is(
  (SELECT reserved_quantity - released_quantity - fulfilled_quantity FROM inventory_reservation_lines WHERE id = (SELECT resline_a FROM fx)),
  6::numeric, 'T9: reservation outstanding = reserved(10) - released(0) - fulfilled(4) = 6'
);

-- T10: partial allocation -- allocate the REMAINING 6 against the SAME
-- reservation line -- succeeds (one reservation line -> multiple allocation
-- lines is structurally supported, LIVE VERIFIED no uniqueness constraint
-- restricts reservation_line_id on inventory_allocation_lines).
CREATE TEMP TABLE rf3 AS
SELECT (inventory_create_allocation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object(
    'variant_id', (SELECT variant_1 FROM fx),
    'location_id', (SELECT location_1 FROM fx),
    'quantity', 6,
    'reservation_line_id', (SELECT resline_a FROM fx)
  )),
  (SELECT res_a FROM fx), 'repair_order_line', (SELECT line_a FROM fx), null, (SELECT e2e_user FROM fx)
)) AS result;
INSERT INTO test_log(line) SELECT is((result ->> 'status'), 'active', 'T10: a SECOND, independent allocation of the remaining 6 against the SAME reservation line succeeds (partial allocation supported)') FROM rf3;

-- T11: the reservation line is now fully fulfilled -- outstanding = 0.
INSERT INTO test_log(line) SELECT is(
  (SELECT reserved_quantity - released_quantity - fulfilled_quantity FROM inventory_reservation_lines WHERE id = (SELECT resline_a FROM fx)),
  0::numeric, 'T11: reservation line outstanding is now 0 (fully allocated across two calls, 4+6=10)'
);

-- T12: TWO distinct allocation_lines rows now exist against this ONE
-- reservation line, summing to exactly 10 (multiple-allocation cardinality
-- proven, no uniqueness constraint forces 1:1).
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*)::int FROM inventory_allocation_lines WHERE reservation_line_id = (SELECT resline_a FROM fx)),
  2, 'T12a: two distinct allocation lines exist against line_a''s one reservation line'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(allocated_quantity), 0) FROM inventory_allocation_lines WHERE reservation_line_id = (SELECT resline_a FROM fx)),
  10::numeric, 'T12b: their allocated_quantity sums to exactly 10 (4+6)'
);

-- T13: over-allocation -- the reservation line has 0 remaining; attempting
-- to allocate even 1 more is rejected by the real RPC, not fabricated.
DO $$
BEGIN
  BEGIN
    PERFORM inventory_create_allocation(
      (SELECT org FROM fx), (SELECT branch FROM fx),
      jsonb_build_array(jsonb_build_object(
        'variant_id', (SELECT variant_1 FROM fx),
        'location_id', (SELECT location_1 FROM fx),
        'quantity', 1,
        'reservation_line_id', (SELECT resline_a FROM fx)
      )),
      (SELECT res_a FROM fx), 'repair_order_line', (SELECT line_a FROM fx), null, (SELECT e2e_user FROM fx)
    );
    INSERT INTO test_log(line) SELECT fail('T13: expected over-allocation rejection, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0001', 'T13: allocating 1 more against a fully-fulfilled reservation line is rejected (P0001, Allocation exceeds remaining reservation quantity)');
  END;
END $$;

-- T14: no partial write -- still exactly two allocation lines against this
-- reservation line after the rejected attempt (not three).
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*)::int FROM inventory_allocation_lines WHERE reservation_line_id = (SELECT resline_a FROM fx)),
  2, 'T14: no partial write -- still exactly two allocation lines after the rejected over-allocation attempt'
);

-- T15: same-SKU independence -- line_b (same variant/SKU as line_a) reserves
-- and allocates its own, fully independent 2 units.
CREATE TEMP TABLE rf4 AS
SELECT (inventory_create_reservation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT location_1 FROM fx), 'quantity', 5)),
  'repair_order_line', (SELECT line_b FROM fx), null, null, null, (SELECT e2e_user FROM fx)
)) AS result;
UPDATE fx SET res_b = ((SELECT result FROM rf4) ->> 'reservation_id')::uuid;
UPDATE fx SET resline_b = (SELECT id FROM inventory_reservation_lines WHERE reservation_id = (SELECT res_b FROM fx));

CREATE TEMP TABLE rf5 AS
SELECT (inventory_create_allocation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object(
    'variant_id', (SELECT variant_1 FROM fx),
    'location_id', (SELECT location_1 FROM fx),
    'quantity', 2,
    'reservation_line_id', (SELECT resline_b FROM fx)
  )),
  (SELECT res_b FROM fx), 'repair_order_line', (SELECT line_b FROM fx), null, (SELECT e2e_user FROM fx)
)) AS result;
INSERT INTO test_log(line) SELECT is((result ->> 'status'), 'active', 'T15: same-SKU line_b''s own independent reserve+allocate (2 units) succeeds') FROM rf5;

-- T16: line_a's own allocation state is completely unaffected by line_b's
-- independent activity -- still exactly two lines, still summing to 10.
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*)::int FROM inventory_allocation_lines WHERE reservation_line_id = (SELECT resline_a FROM fx)),
  2, 'T16: line_a''s own allocation lines are unaffected by line_b''s independent allocation (still 2, never merged by SKU)'
);

-- T17: cross-branch reservation_line_id is rejected by the ENGINE'S OWN
-- branch-scoped lookup (`WHERE id=... AND organization_id=p_organization_id
-- AND branch_id=p_branch_id`) -- a genuine, live, engine-level defense, not
-- merely a Zone 3 service-layer one. Uses `location_b` (a real location
-- genuinely scoped to `branch_b`, created above) specifically so the call
-- passes `inventory_balances`' own composite FK
-- (location_id, organization_id, branch_id) -> warehouse_locations(...) --
-- a SEPARATE, earlier, genuinely live engine-level check this same live
-- run discovered (a location/branch mismatch is rejected even before the
-- reservation-line lookup is reached, with SQLSTATE 23503, not P0001) --
-- and isolates the SPECIFIC assertion this test makes (the
-- reservation_line_id's own branch mismatch) from that unrelated one.
-- Calls with p_branch_id=branch_b (a DIFFERENT branch the actor also holds
-- warehouse.inventory.operate on via their pre-existing org-wide grant, so
-- this proves the branch-mismatch rejection specifically, not a permission
-- denial) but reservation_line_id=line_a's own reservation line, which
-- belongs to the PRIMARY branch.
DO $$
BEGIN
  BEGIN
    PERFORM inventory_create_allocation(
      (SELECT org FROM fx), (SELECT branch_b FROM fx),
      jsonb_build_array(jsonb_build_object(
        'variant_id', (SELECT variant_1 FROM fx),
        'location_id', (SELECT location_b FROM fx),
        'quantity', 1,
        'reservation_line_id', (SELECT resline_a FROM fx)
      )),
      null, 'repair_order_line', (SELECT line_a FROM fx), null, (SELECT e2e_user FROM fx)
    );
    INSERT INTO test_log(line) SELECT fail('T17: expected cross-branch rejection, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0001', 'T17: a reservation_line_id from a DIFFERENT branch than p_branch_id is rejected by the engine''s own lookup (P0001, Reservation line not found for allocation)');
  END;
END $$;

-- T-evidence (domain-integrity correction, 2026-09-14, external review):
-- this DEMONSTRATES why the Zone-3 application-layer variant guard is
-- required -- it does NOT prove the guard itself (the guard is TypeScript
-- domain logic, proven live in repair-orders.service.test.ts, which pgTAP
-- cannot exercise). The generic reservation engine and its RLS/permission
-- model place NO constraint tying a reservation LINE's own `variant_id`
-- to the variant of whatever RepairOrderLine its own reservation HEADER's
-- `reference_id` happens to name. Proven here by creating (as the SAME
-- actor, with the SAME real `warehouse.inventory.operate` permission a
-- generic Warehouse-module caller would use -- this is exactly the
-- `createInventoryReservationAction` path, LIVE VERIFIED to accept
-- `reference_type`/`reference_id` as unrestricted client input) a
-- reservation whose HEADER correctly references `line_a`, but whose own
-- LINE carries a DIFFERENT real, active variant (reused from 097's own
-- `variant_2` fixture value) than `line_a`'s own `variant_1`. This
-- succeeds -- the mismatch this correction pass closes is a real,
-- reachable database state, not merely theoretical.
-- IC-7 note: redundant with the top-of-file SET LOCAL (same transaction),
-- but set again explicitly for self-documentation.
-- PRE-IC8 P0 note: `authenticated` no longer holds raw table privileges
-- on inventory_balances at all (the REVOKE half of the fix) -- this
-- fixture seed must run as the connecting/superuser role, matching the
-- established convention every other file already follows, then
-- restore the authenticated role context for the scenario below. Also
-- split into shape-compliant statements (zero-quantity insert, then a
-- physical-shape-only on_hand update).
RESET ROLE;
SET LOCAL ambra.inventory_movement_engine = 'on';
INSERT INTO inventory_balances (organization_id, branch_id, location_id, variant_id, on_hand_quantity, reserved_quantity, allocated_quantity)
SELECT org, branch, location_1, 'e11a5012-d136-4551-952d-6b264023737c'::uuid, 0, 0, 0 FROM fx
ON CONFLICT (organization_id, branch_id, location_id, variant_id, coalesce(lot_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(serial_id, '00000000-0000-0000-0000-000000000000'::uuid))
DO NOTHING;
UPDATE inventory_balances SET reserved_quantity = 0, allocated_quantity = 0
WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx)
  AND location_id = (SELECT location_1 FROM fx) AND variant_id = 'e11a5012-d136-4551-952d-6b264023737c'::uuid;
UPDATE inventory_balances SET on_hand_quantity = 100
WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx)
  AND location_id = (SELECT location_1 FROM fx) AND variant_id = 'e11a5012-d136-4551-952d-6b264023737c'::uuid;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

CREATE TEMP TABLE rf6 AS
SELECT (inventory_create_reservation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object(
    'variant_id', 'e11a5012-d136-4551-952d-6b264023737c'::uuid,
    'location_id', (SELECT location_1 FROM fx),
    'quantity', 1
  )),
  'repair_order_line', (SELECT line_a FROM fx), null, null, null, (SELECT e2e_user FROM fx)
)) AS result;
INSERT INTO test_log(line) SELECT is(
  (result ->> 'status'), 'active',
  'T-evidence: DB DEMONSTRATES (not proves) why the app-layer guard is required -- the generic engine permits a reservation header referencing line_a whose own line carries a DIFFERENT variant than line_a''s own variant_1'
) FROM rf6;

-- T18: permission denial -- actor lacking warehouse.inventory.operate ->
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
    PERFORM inventory_create_allocation(
      (SELECT org FROM fx), (SELECT branch FROM fx),
      jsonb_build_array(jsonb_build_object(
        'variant_id', (SELECT variant_1 FROM fx),
        'location_id', (SELECT location_1 FROM fx),
        'quantity', 1,
        'reservation_line_id', (SELECT resline_b FROM fx)
      )),
      (SELECT res_b FROM fx), 'repair_order_line', (SELECT line_b FROM fx), null, (SELECT e2e_user FROM fx)
    );
    INSERT INTO test_log(line) SELECT fail('T18: expected permission-denied rejection, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0001', 'T18: actor lacking warehouse.inventory.operate -> rejected by the RPC''s own permission check');
  END;
END $$;

RESET ROLE;

SELECT line FROM test_log ORDER BY seq;

ROLLBACK;
