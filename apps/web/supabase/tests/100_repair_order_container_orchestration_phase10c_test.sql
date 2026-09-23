-- ============================================================================
-- TEST: Phase 10C container orchestration -- Allocation -> Container
-- ============================================================================
-- Proves the REAL, generic inventory-domain container orchestration
-- (inventory_create_container / inventory_add_to_container /
-- inventory_remove_from_container / inventory_seal_container, all LIVE
-- VERIFIED SECURITY DEFINER, owner postgres, gated by their own
-- has_branch_permission(..., 'warehouse.inventory.operate') + actor-identity
-- checks) behaves correctly end-to-end when called against a real
-- Phase 10A/10B reservation+allocation chain, as the genuinely-RLS-enforced
-- `authenticated` role.
--
-- CORRECTION PASS (2026-09-14, external review): this file was revised after
-- Phase 10C's own external review found four gaps, all fixed as narrow
-- forward migrations against the already-live Phase 10C RPCs/RLS (no Phase
-- 10C migration was edited in place):
--   1. inventory_add_to_container now requires
--      allocation_line.location_id = container.current_location_id
--      before any placement (new T11-T14 below).
--   2. inventory_add_to_container now requires, when the container itself
--      declares reference_type='repair_order', that the allocation's own
--      resolved RepairOrder (via AllocationLine -> ReservationLine ->
--      Reservation -> RepairOrderLine -> RepairOrder, exact UUID identity,
--      never SKU) match the container's own reference_id. The OLD T11-T13
--      scenario (which proved cross-RepairOrder mixing as a SUCCESS case)
--      has been replaced with T15-T21 below: same-RepairOrder multi-
--      allocation-line placement remains a success case; cross-RepairOrder
--      placement is now a rejection case.
--   3. Two new RESTRICTIVE RLS policies (per command: INSERT/UPDATE/DELETE)
--      on each of inventory_containers and inventory_container_lines deny
--      direct authenticated DML against any row where the container (or its
--      own parent container) declares reference_type='repair_order'. At the
--      time of THIS correction pass, generic (non-RepairOrder-owned)
--      containers were left unaffected, preserving ambra-location-
--      inventory.ts's own then-still-live legacy direct-write behavior
--      (T37-T44 below).
--      SUPERSEDED BY IC-7 (2026-09-17): IC-6 deleted ambra-location-
--      inventory.ts's own 4 direct-write actions as confirmed-dead code,
--      and IC-7's own live repo-wide grep confirmed zero remaining direct-
--      table writes anywhere -- see T41/T42's own inline comment below for
--      the full account. Raw writes are now closed for ALL
--      inventory_containers/_container_lines rows, generic or RepairOrder-
--      owned alike.
--   4. A genuine two-PostgreSQL-connection concurrency proof was performed
--      OUTSIDE this file (pgTAP is a single-connection tool and cannot
--      express real concurrency) -- see migration-summary.md and the final
--      report for the full methodology and result. This file continues to
--      prove the row-locking STRATEGY sequentially only, as before.
--
-- A7 SIMPLIFICATION PASS correction (see docs/inventory/reviews/inventory-
-- a7-repairorder-container-boundary-review/): the RepairOrder-ownership
-- check inventory_add_to_container used to enforce inline (point 2 above)
-- was extracted into a new RepairOrder-domain wrapper,
-- repair_order_add_allocation_to_container. inventory_add_to_container
-- itself is now a domain-agnostic generic primitive with zero RepairOrder-
-- table knowledge -- a direct call to it no longer enforces cross-
-- RepairOrder rejection (disclosed, accepted tradeoff for any caller that
-- bypasses the wrapper). T19's own call was updated to go through the new
-- wrapper instead (the real production entry point RepairOrdersService now
-- uses) so this file continues proving the same guarantee without
-- weakening coverage -- see T19's own inline comment for the full account.
-- A new, dedicated file, 114_a7_repairorder_container_boundary_test.sql,
-- covers the rest of the A7 boundary (including the generic primitive's
-- own new, narrower direct-call behavior).
--
-- A7 FOLLOW-UP CORRECTION PASS (see docs/inventory/reviews/inventory-a7-
-- correction-generic-container-eligibility-review/): inventory_add_to_
-- container was narrowed FURTHER -- it now rejects ANY domain-owned/
-- referenced container outright (a generic-eligibility gate, P0002,
-- domain-agnostic -- not specifically checking reference_type=
-- 'repair_order'), delegating the real placement logic to a new
-- INTERNAL-ONLY helper, inventory_add_to_container_internal. Since
-- container_a/container_b in THIS file are both RepairOrder-owned
-- (T1/T4's own fixtures), every scenario that places allocations into
-- them via a DIRECT call to inventory_add_to_container would now be
-- rejected regardless of correctness. T2, T5, T9, T15, and T30 (every
-- remaining direct call against container_a/container_b, beyond T19
-- which was already fixed in the prior A7 pass) are updated to route
-- through repair_order_add_allocation_to_container instead -- the real
-- production entry point for a RepairOrder-owned container. Each
-- scenario's own assertion and expected outcome are completely
-- unchanged; only the function called changed. T11/T14 (generic
-- containers), T33 (a generic branch_b container), T34/T43 (fail at
-- the actor/permission check, before eligibility is ever reached) are
-- confirmed unaffected -- see each one's own reasoning if revisited.
--
-- Phase 10C does NOT touch reservation_line.fulfilled_quantity,
-- allocation_line.fulfilled_quantity, or any inventory_balances quantity --
-- container placement is pure physical grouping of ALREADY-allocated stock,
-- proven explicitly below (T23-T27).
--
-- Executed live against supabase-target via Supabase MCP.

BEGIN;

SELECT plan(44);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, branch_b uuid, e2e_user uuid,
  ro uuid, ro_other uuid, line_a uuid, line_b uuid, line_c uuid, line_d uuid,
  variant_1 uuid, location_1 uuid, location_2 uuid, location_b uuid,
  res_a uuid, resline_a uuid, alloc_a uuid, allocline_a uuid,
  res_b uuid, resline_b uuid, alloc_b uuid, allocline_b uuid,
  res_c uuid, resline_c uuid, alloc_c uuid, allocline_c uuid,
  res_d uuid, resline_d uuid, alloc_d uuid, allocline_d uuid,
  container_a uuid, container_b uuid, container_mismatch uuid, container_match uuid,
  link_1 uuid, link_2 uuid,
  before_reserved numeric, before_allocated numeric, before_onhand numeric,
  before_alloc_fulfilled numeric, before_resline_fulfilled numeric
);
GRANT SELECT, UPDATE ON fx TO authenticated;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  'e39b15da-0a8d-4056-b5a2-80eb1da868a6'::uuid,
  gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '267be50d-7bdf-4329-b3e9-c115c5c7d2a9'::uuid,
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(),
  null, null, null, null, null;

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

-- ===========================================================================
-- Fixture setup (as the connecting role, unrestricted -- mirrors 095-099's
-- own convention).
-- ===========================================================================

INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch_b, org, '100-test-branch-B', 990 FROM fx;

INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory)
SELECT location_b, org, branch_b, '100-branch-b-location', true FROM fx;

-- A SECOND real, stockable location in the SAME org/branch as location_1 --
-- used only by the new location-mismatch tests (T11-T14).
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory)
SELECT location_2, org, branch, '100-test-location-2', true FROM fx;

INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT ro, org, branch, '100-test-RO', 'open' FROM fx;
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT ro_other, org, branch, '100-test-RO-other', 'open' FROM fx;

INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT line_a, ro, variant_1, '100-SKU-X', '100 line A', 10, 'pcs' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT line_b, ro_other, variant_1, '100-SKU-X', '100 line B (different RepairOrder, same SKU)', 3, 'pcs' FROM fx;
-- line_c: SAME RepairOrder as line_a -- proves same-RepairOrder multiple-
-- allocation-lines-into-one-container remains a supported success case.
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT line_c, ro, variant_1, '100-SKU-X', '100 line C (SAME RepairOrder as line A)', 5, 'pcs' FROM fx;
-- line_d: SAME RepairOrder as line_a -- dedicated small allocation used only
-- by the location-mismatch tests, kept isolated from the running sums used
-- elsewhere in this file.
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT line_d, ro, variant_1, '100-SKU-X', '100 line D (location-mismatch probe)', 2, 'pcs' FROM fx;

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
INSERT INTO inventory_balances (organization_id, branch_id, location_id, variant_id, on_hand_quantity, reserved_quantity, allocated_quantity)
SELECT org, branch, location_2, variant_1, 0, 0, 0 FROM fx
ON CONFLICT (organization_id, branch_id, location_id, variant_id, coalesce(lot_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(serial_id, '00000000-0000-0000-0000-000000000000'::uuid))
DO NOTHING;
UPDATE inventory_balances SET reserved_quantity = 0, allocated_quantity = 0
WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx)
  AND location_id IN ((SELECT location_1 FROM fx), (SELECT location_2 FROM fx)) AND variant_id = (SELECT variant_1 FROM fx);
UPDATE inventory_balances SET on_hand_quantity = 1000
WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx)
  AND location_id IN ((SELECT location_1 FROM fx), (SELECT location_2 FROM fx)) AND variant_id = (SELECT variant_1 FROM fx);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

-- Reserve + allocate 10 for line_a via the real Phase 10A/10B RPCs.
CREATE TEMP TABLE rf1 AS
SELECT (inventory_create_reservation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT location_1 FROM fx), 'quantity', 10)),
  'repair_order_line', (SELECT line_a FROM fx), null, null, null, (SELECT e2e_user FROM fx)
)) AS result;
UPDATE fx SET res_a = ((SELECT result FROM rf1) ->> 'reservation_id')::uuid;
UPDATE fx SET resline_a = (SELECT id FROM inventory_reservation_lines WHERE reservation_id = (SELECT res_a FROM fx));

CREATE TEMP TABLE rf2 AS
SELECT (inventory_create_allocation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT location_1 FROM fx), 'quantity', 10, 'reservation_line_id', (SELECT resline_a FROM fx))),
  (SELECT res_a FROM fx), 'repair_order_line', (SELECT line_a FROM fx), null, (SELECT e2e_user FROM fx)
)) AS result;
UPDATE fx SET alloc_a = ((SELECT result FROM rf2) ->> 'allocation_id')::uuid;
UPDATE fx SET allocline_a = (SELECT id FROM inventory_allocation_lines WHERE allocation_id = (SELECT alloc_a FROM fx));

-- Second, independent chain for line_b (different RepairOrder, same SKU) --
-- for cross-RepairOrder rejection tests.
CREATE TEMP TABLE rf3 AS
SELECT (inventory_create_reservation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT location_1 FROM fx), 'quantity', 3)),
  'repair_order_line', (SELECT line_b FROM fx), null, null, null, (SELECT e2e_user FROM fx)
)) AS result;
UPDATE fx SET res_b = ((SELECT result FROM rf3) ->> 'reservation_id')::uuid;
UPDATE fx SET resline_b = (SELECT id FROM inventory_reservation_lines WHERE reservation_id = (SELECT res_b FROM fx));

CREATE TEMP TABLE rf4 AS
SELECT (inventory_create_allocation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT location_1 FROM fx), 'quantity', 3, 'reservation_line_id', (SELECT resline_b FROM fx))),
  (SELECT res_b FROM fx), 'repair_order_line', (SELECT line_b FROM fx), null, (SELECT e2e_user FROM fx)
)) AS result;
UPDATE fx SET alloc_b = ((SELECT result FROM rf4) ->> 'allocation_id')::uuid;
UPDATE fx SET allocline_b = (SELECT id FROM inventory_allocation_lines WHERE allocation_id = (SELECT alloc_b FROM fx));

-- Third chain for line_c (SAME RepairOrder as line_a).
CREATE TEMP TABLE rf5 AS
SELECT (inventory_create_reservation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT location_1 FROM fx), 'quantity', 5)),
  'repair_order_line', (SELECT line_c FROM fx), null, null, null, (SELECT e2e_user FROM fx)
)) AS result;
UPDATE fx SET res_c = ((SELECT result FROM rf5) ->> 'reservation_id')::uuid;
UPDATE fx SET resline_c = (SELECT id FROM inventory_reservation_lines WHERE reservation_id = (SELECT res_c FROM fx));

CREATE TEMP TABLE rf6 AS
SELECT (inventory_create_allocation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT location_1 FROM fx), 'quantity', 5, 'reservation_line_id', (SELECT resline_c FROM fx))),
  (SELECT res_c FROM fx), 'repair_order_line', (SELECT line_c FROM fx), null, (SELECT e2e_user FROM fx)
)) AS result;
UPDATE fx SET alloc_c = ((SELECT result FROM rf6) ->> 'allocation_id')::uuid;
UPDATE fx SET allocline_c = (SELECT id FROM inventory_allocation_lines WHERE allocation_id = (SELECT alloc_c FROM fx));

-- Fourth chain for line_d (SAME RepairOrder as line_a) -- location-mismatch
-- probe only, kept isolated from the running sums used by T1-T10/T15-T21.
CREATE TEMP TABLE rf7 AS
SELECT (inventory_create_reservation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT location_1 FROM fx), 'quantity', 2)),
  'repair_order_line', (SELECT line_d FROM fx), null, null, null, (SELECT e2e_user FROM fx)
)) AS result;
UPDATE fx SET res_d = ((SELECT result FROM rf7) ->> 'reservation_id')::uuid;
UPDATE fx SET resline_d = (SELECT id FROM inventory_reservation_lines WHERE reservation_id = (SELECT res_d FROM fx));

CREATE TEMP TABLE rf8 AS
SELECT (inventory_create_allocation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT location_1 FROM fx), 'quantity', 2, 'reservation_line_id', (SELECT resline_d FROM fx))),
  (SELECT res_d FROM fx), 'repair_order_line', (SELECT line_d FROM fx), null, (SELECT e2e_user FROM fx)
)) AS result;
UPDATE fx SET alloc_d = ((SELECT result FROM rf8) ->> 'allocation_id')::uuid;
UPDATE fx SET allocline_d = (SELECT id FROM inventory_allocation_lines WHERE allocation_id = (SELECT alloc_d FROM fx));

-- Snapshot the exact preserved quantities BEFORE any container placement --
-- proven unchanged after placement (T23-T27 below).
UPDATE fx SET
  before_reserved = (SELECT reserved_quantity FROM inventory_balances WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx) AND location_id = (SELECT location_1 FROM fx) AND variant_id = (SELECT variant_1 FROM fx)),
  before_allocated = (SELECT allocated_quantity FROM inventory_balances WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx) AND location_id = (SELECT location_1 FROM fx) AND variant_id = (SELECT variant_1 FROM fx)),
  before_onhand = (SELECT on_hand_quantity FROM inventory_balances WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx) AND location_id = (SELECT location_1 FROM fx) AND variant_id = (SELECT variant_1 FROM fx)),
  before_alloc_fulfilled = (SELECT fulfilled_quantity FROM inventory_allocation_lines WHERE id = (SELECT allocline_a FROM fx)),
  before_resline_fulfilled = (SELECT fulfilled_quantity FROM inventory_reservation_lines WHERE id = (SELECT resline_a FROM fx));

-- T1: create a real container for the RepairOrder -- starts 'empty'.
CREATE TEMP TABLE cf1 AS
SELECT (inventory_create_container(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  '100-CONTAINER-A', (SELECT location_1 FROM fx), 'container', 'repair_order', (SELECT ro FROM fx)::text
)) AS result;
UPDATE fx SET container_a = ((SELECT result FROM cf1) ->> 'container_id')::uuid;
INSERT INTO test_log(line) SELECT is((result ->> 'status'), 'empty', 'T1: a newly created container starts status=empty') FROM cf1;

-- T2: place 6 of line_a's 10-unit allocation into container A.
--
-- A7 FOLLOW-UP CORRECTION PASS: container_a is RepairOrder-owned
-- (reference_type='repair_order', see T1's own fixture above). Post-
-- correction, the public inventory_add_to_container generic primitive
-- rejects ANY domain-owned container as a matter of policy (see
-- docs/inventory/reviews/inventory-a7-correction-generic-container-
-- eligibility-review/) -- a direct call here would now fail with
-- P0002 regardless of the allocation's own correctness. Routed through
-- repair_order_add_allocation_to_container instead, the real
-- production entry point for a RepairOrder-owned container -- same
-- params, same result shape, identical assertion.
CREATE TEMP TABLE addf1 AS
SELECT (repair_order_add_allocation_to_container(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT container_a FROM fx), (SELECT allocline_a FROM fx), 6
)) AS result;
UPDATE fx SET link_1 = ((SELECT result FROM addf1) ->> 'link_id')::uuid;
INSERT INTO test_log(line) SELECT is((result ->> 'quantity')::numeric, 6::numeric, 'T2: placing 6 into container A succeeds (via repair_order_add_allocation_to_container, A7 follow-up correction)') FROM addf1;

-- T3: container A transitions empty -> active on first placement.
INSERT INTO test_log(line) SELECT is(
  (SELECT status FROM inventory_containers WHERE id = (SELECT container_a FROM fx)),
  'active', 'T3: container A transitions empty -> active after placement'
);

-- T4: create a SECOND container for the SAME RepairOrder.
CREATE TEMP TABLE cf2 AS
SELECT (inventory_create_container(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  '100-CONTAINER-B', (SELECT location_1 FROM fx), 'container', 'repair_order', (SELECT ro FROM fx)::text
)) AS result;
UPDATE fx SET container_b = ((SELECT result FROM cf2) ->> 'container_id')::uuid;

-- T5: place the REMAINING 4 of line_a's allocation into container B (one
-- allocation line split across multiple containers).
--
-- A7 FOLLOW-UP CORRECTION PASS: container_b is also RepairOrder-owned
-- (T4's own fixture above) -- same reasoning as T2, routed through the
-- wrapper.
CREATE TEMP TABLE addf2 AS
SELECT (repair_order_add_allocation_to_container(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT container_b FROM fx), (SELECT allocline_a FROM fx), 4
)) AS result;
UPDATE fx SET link_2 = ((SELECT result FROM addf2) ->> 'link_id')::uuid;
INSERT INTO test_log(line) SELECT is((result ->> 'quantity')::numeric, 4::numeric, 'T5: placing the remaining 4 into container B succeeds (split across two containers, via wrapper, A7 follow-up correction)') FROM addf2;

-- T6: active link sum for line_a's allocation is exactly 10 (6+4).
INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(quantity), 0) FROM inventory_allocation_container_links WHERE allocation_line_id = (SELECT allocline_a FROM fx) AND deleted_at IS NULL),
  10::numeric, 'T6: active link sum for line_a''s allocation = 10 (6+4)'
);

-- T7: container A's own contents sum to exactly 6.
INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(quantity), 0) FROM inventory_container_lines WHERE container_id = (SELECT container_a FROM fx) AND deleted_at IS NULL),
  6::numeric, 'T7: container A''s own contents = 6'
);

-- T8: container B's own contents sum to exactly 4.
INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(quantity), 0) FROM inventory_container_lines WHERE container_id = (SELECT container_b FROM fx) AND deleted_at IS NULL),
  4::numeric, 'T8: container B''s own contents = 4'
);

-- T9: over-placement -- line_a's allocation is fully placed (10/10);
-- attempting +1 more anywhere is atomically rejected.
--
-- A7 FOLLOW-UP CORRECTION PASS: routed through the wrapper (container_a
-- is RepairOrder-owned) -- the wrapper's own ownership check passes
-- (allocline_a belongs to the same RepairOrder as container_a), then
-- delegates to the nested generic call, which still enforces the
-- over-placement cap identically (22023, unchanged).
DO $$
BEGIN
  BEGIN
    PERFORM repair_order_add_allocation_to_container(
      (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
      (SELECT container_a FROM fx), (SELECT allocline_a FROM fx), 1
    );
    INSERT INTO test_log(line) SELECT fail('T9: expected over-placement rejection, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '22023', 'T9: over-placement (would exceed allocated_quantity) is rejected atomically (22023, via wrapper -> internal helper, A7 follow-up correction)');
  END;
END $$;

-- T10: no partial mutation -- active link sum is still exactly 10 after the
-- rejected attempt, container A's own contents still exactly 6.
INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(quantity), 0) FROM inventory_allocation_container_links WHERE allocation_line_id = (SELECT allocline_a FROM fx) AND deleted_at IS NULL),
  10::numeric, 'T10a: no partial mutation -- active link sum still exactly 10 after the rejected over-placement'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(quantity), 0) FROM inventory_container_lines WHERE container_id = (SELECT container_a FROM fx) AND deleted_at IS NULL),
  6::numeric, 'T10b: no partial mutation -- container A''s own contents still exactly 6'
);

-- ===========================================================================
-- T11-T14: NEW -- allocation-location vs. container-location invariant
-- (external review correction #1). A container at a DIFFERENT physical
-- location than the allocation's own location must reject placement.
-- ===========================================================================

CREATE TEMP TABLE cf3 AS
SELECT (inventory_create_container(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  '100-CONTAINER-MISMATCH', (SELECT location_2 FROM fx), 'container', null, null
)) AS result;
UPDATE fx SET container_mismatch = ((SELECT result FROM cf3) ->> 'container_id')::uuid;

-- T11: placing line_d's allocation (reserved/allocated at location_1) into
-- a container sitting at location_2 is rejected.
DO $$
BEGIN
  BEGIN
    PERFORM inventory_add_to_container(
      (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
      (SELECT container_mismatch FROM fx), (SELECT allocline_d FROM fx), 2
    );
    INSERT INTO test_log(line) SELECT fail('T11: expected location-mismatch rejection, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '22023', 'T11: allocation.location_id != container.current_location_id is rejected (22023)');
  END;
END $$;

-- T12: no partial mutation -- no link was created for line_d's allocation.
INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(quantity), 0) FROM inventory_allocation_container_links WHERE allocation_line_id = (SELECT allocline_d FROM fx) AND deleted_at IS NULL),
  0::numeric, 'T12: no partial mutation -- no link was created for the rejected location-mismatched placement'
);

-- T13: the mismatched container's own status is unaffected (still empty).
INSERT INTO test_log(line) SELECT is(
  (SELECT status FROM inventory_containers WHERE id = (SELECT container_mismatch FROM fx)),
  'empty', 'T13: the location-mismatched container''s own status is unaffected (still empty)'
);

-- T14: the SAME allocation, placed into a container AT the matching
-- location, succeeds.
CREATE TEMP TABLE cf4 AS
SELECT (inventory_create_container(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  '100-CONTAINER-MATCH', (SELECT location_1 FROM fx), 'container', null, null
)) AS result;
UPDATE fx SET container_match = ((SELECT result FROM cf4) ->> 'container_id')::uuid;
CREATE TEMP TABLE addf3 AS
SELECT (inventory_add_to_container(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT container_match FROM fx), (SELECT allocline_d FROM fx), 2
)) AS result;
INSERT INTO test_log(line) SELECT is((result ->> 'quantity')::numeric, 2::numeric, 'T14: the same allocation succeeds once the container is at the matching location') FROM addf3;

-- ===========================================================================
-- T15-T21: REVISED -- RepairOrder-ownership invariant (external review
-- correction #2). A RepairOrder-owned container (reference_type=
-- 'repair_order') may receive placements from MULTIPLE allocation lines
-- belonging to the SAME RepairOrder (cardinality preserved), but an
-- allocation belonging to a DIFFERENT RepairOrder is now rejected. This
-- replaces the OLD T11-T13 scenario, which incorrectly proved cross-
-- RepairOrder mixing as a success case.
-- ===========================================================================

-- T15: line_c's own allocation (5 units, SAME RepairOrder "ro" as line_a)
-- placed into the SAME container A as line_a's -- same-RepairOrder,
-- multiple allocation lines -> one container remains supported.
--
-- A7 FOLLOW-UP CORRECTION PASS: routed through the wrapper -- same
-- reasoning as T2/T5/T9.
CREATE TEMP TABLE addf4 AS
SELECT (repair_order_add_allocation_to_container(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT container_a FROM fx), (SELECT allocline_c FROM fx), 5
)) AS result;
INSERT INTO test_log(line) SELECT is((result ->> 'quantity')::numeric, 5::numeric, 'T15: line_c''s own allocation (SAME RepairOrder as line_a, 5 units) placed into the SAME container A succeeds (via wrapper, A7 follow-up correction)') FROM addf4;

-- T16: container A's own contents now sum to 11 (6 from line_a + 5 from line_c).
INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(quantity), 0) FROM inventory_container_lines WHERE container_id = (SELECT container_a FROM fx) AND deleted_at IS NULL),
  11::numeric, 'T16: container A''s own contents now sum to 11 (6 from line_a + 5 from line_c)'
);

-- T17: line_a's own linked sum is unaffected by line_c's own placement.
INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(quantity), 0) FROM inventory_allocation_container_links WHERE allocation_line_id = (SELECT allocline_a FROM fx) AND deleted_at IS NULL),
  10::numeric, 'T17: line_a''s own linked sum is still exactly 10, unaffected by line_c''s placement'
);

-- T18: line_c's own linked sum is exactly 5, independent of line_a's.
INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(quantity), 0) FROM inventory_allocation_container_links WHERE allocation_line_id = (SELECT allocline_c FROM fx) AND deleted_at IS NULL),
  5::numeric, 'T18: line_c''s own linked sum is exactly 5, independent of line_a''s'
);

-- T19: line_b's own allocation (DIFFERENT RepairOrder "ro_other") placed
-- into container A (owned by "ro") is REJECTED.
--
-- A7 SIMPLIFICATION PASS correction: this RepairOrder-ownership check was
-- extracted out of inventory_add_to_container (now a domain-agnostic
-- generic primitive with zero RepairOrder-table knowledge -- see
-- docs/inventory/reviews/inventory-a7-repairorder-container-boundary-
-- review/) into a new RepairOrder-domain wrapper,
-- repair_order_add_allocation_to_container, which RepairOrdersService now
-- calls instead of the generic primitive directly. T19 is updated to call
-- the new wrapper -- the REAL production enforcement point post-A7 -- so
-- this scenario continues proving the exact same guarantee (cross-
-- RepairOrder placement is rejected) without weakening coverage. T20/T21
-- and everything downstream are UNCHANGED: the wrapper still rejects this
-- exact case, so container A's own contents and line_b's own linked sum
-- remain exactly as this file already asserted before this pass. A
-- dedicated new file, 114_a7_repairorder_container_boundary_test.sql,
-- additionally proves the generic primitive's own new, narrower behavior
-- (a DIRECT call bypassing the wrapper no longer enforces ownership --
-- disclosed, accepted design tradeoff, not tested here).
DO $$
BEGIN
  BEGIN
    PERFORM repair_order_add_allocation_to_container(
      (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
      (SELECT container_a FROM fx), (SELECT allocline_b FROM fx), 3
    );
    INSERT INTO test_log(line) SELECT fail('T19: expected cross-RepairOrder rejection, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0002', 'T19: an allocation belonging to a DIFFERENT RepairOrder than the container''s own owner is rejected (P0002), now enforced by the repair_order_add_allocation_to_container wrapper (A7)');
  END;
END $$;

-- T20: no partial mutation -- container A's own contents still exactly 11
-- after the rejected cross-RepairOrder placement attempt.
INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(quantity), 0) FROM inventory_container_lines WHERE container_id = (SELECT container_a FROM fx) AND deleted_at IS NULL),
  11::numeric, 'T20: no partial mutation -- container A''s own contents still exactly 11 after the rejected cross-RepairOrder placement'
);

-- T21: line_b's own linked sum is still exactly 0 -- it was never
-- successfully placed anywhere in this file.
INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(quantity), 0) FROM inventory_allocation_container_links WHERE allocation_line_id = (SELECT allocline_b FROM fx) AND deleted_at IS NULL),
  0::numeric, 'T21: line_b''s own linked sum remains exactly 0 -- never successfully placed'
);

-- T22: remove 6 (full removal) from container A's link_1 (line_a's own
-- placement there).
CREATE TEMP TABLE removef1 AS
SELECT (inventory_remove_from_container(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT container_a FROM fx), (SELECT link_1 FROM fx), 6
)) AS result;
INSERT INTO test_log(line) SELECT is((result ->> 'remaining_link_quantity')::numeric, 0::numeric, 'T22: removing all 6 from link_1 succeeds, remaining_link_quantity=0') FROM removef1;

-- T23-T27: allocation/reservation fulfilled_quantity and inventory balance
-- quantities are COMPLETELY UNCHANGED by container placement AND removal
-- -- container orchestration is pure physical grouping, not fulfillment.
INSERT INTO test_log(line) SELECT is(
  (SELECT fulfilled_quantity FROM inventory_allocation_lines WHERE id = (SELECT allocline_a FROM fx)),
  (SELECT before_alloc_fulfilled FROM fx), 'T23: allocation_line.fulfilled_quantity unchanged by container placement/removal'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT fulfilled_quantity FROM inventory_reservation_lines WHERE id = (SELECT resline_a FROM fx)),
  (SELECT before_resline_fulfilled FROM fx), 'T24: reservation_line.fulfilled_quantity unchanged by container placement/removal'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT reserved_quantity FROM inventory_balances WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx) AND location_id = (SELECT location_1 FROM fx) AND variant_id = (SELECT variant_1 FROM fx)),
  (SELECT before_reserved FROM fx), 'T25: inventory_balances.reserved_quantity unchanged by container placement/removal'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT allocated_quantity FROM inventory_balances WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx) AND location_id = (SELECT location_1 FROM fx) AND variant_id = (SELECT variant_1 FROM fx)),
  (SELECT before_allocated FROM fx), 'T26: inventory_balances.allocated_quantity unchanged by container placement/removal'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT on_hand_quantity FROM inventory_balances WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx) AND location_id = (SELECT location_1 FROM fx) AND variant_id = (SELECT variant_1 FROM fx)),
  (SELECT before_onhand FROM fx), 'T27: inventory_balances.on_hand_quantity unchanged by container placement/removal'
);

-- T28: container A still has line_c's own 5 units -- NOT empty yet.
INSERT INTO test_log(line) SELECT is(
  (SELECT status FROM inventory_containers WHERE id = (SELECT container_a FROM fx)),
  'active', 'T28: container A remains active (still holds line_c''s own 5 units), not falsely marked empty'
);

-- T29: remove line_c's own remaining 5 units from container A too -- now
-- container A's total active content reaches exactly 0.
CREATE TEMP TABLE linkcf AS
SELECT id FROM inventory_allocation_container_links
WHERE allocation_line_id = (SELECT allocline_c FROM fx) AND deleted_at IS NULL;
CREATE TEMP TABLE removef2 AS
SELECT (inventory_remove_from_container(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT container_a FROM fx), (SELECT id FROM linkcf), 5
)) AS result;
INSERT INTO test_log(line) SELECT is((result ->> 'container_status'), 'empty', 'T29: container A transitions active -> empty once ALL active content reaches zero') FROM removef2;

-- T30-T31: re-add 6 to container A -- empty -> active again, quantity
-- restored correctly (container B's own link_2, still holding 4, untouched).
--
-- A7 FOLLOW-UP CORRECTION PASS: routed through the wrapper -- same
-- reasoning as T2/T5/T9/T15.
CREATE TEMP TABLE addf5 AS
SELECT (repair_order_add_allocation_to_container(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT container_a FROM fx), (SELECT allocline_a FROM fx), 6
)) AS result;
INSERT INTO test_log(line) SELECT is((result ->> 'container_status'), 'active', 'T30: re-adding to the now-empty container A transitions it back to active (via wrapper, A7 follow-up correction)') FROM addf5;
INSERT INTO test_log(line) SELECT is(
  (SELECT quantity FROM inventory_allocation_container_links WHERE id = (SELECT link_2 FROM fx)),
  4::numeric, 'T31: container B''s own link_2 (4 units) is completely untouched by container A''s own remove/re-add cycle'
);

-- T32-T33: cross-branch container_id rejected.
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory)
SELECT gen_random_uuid(), (SELECT org FROM fx), (SELECT branch_b FROM fx), '100-branch-b-loc-2', true;
DO $$
DECLARE v_loc uuid;
BEGIN
  SELECT id INTO v_loc FROM warehouse_locations WHERE name = '100-branch-b-loc-2';
  BEGIN
    PERFORM inventory_create_container(
      (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch_b FROM fx),
      '100-CROSS-BRANCH', v_loc, 'container', null, null
    );
    INSERT INTO test_log(line) SELECT ok(true, 'T32: a real branch_b-scoped container fixture was created successfully');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT fail('T32: unexpected failure creating the branch_b container fixture: ' || SQLSTATE);
  END;
END $$;

DO $$
DECLARE v_container_b_branch uuid;
BEGIN
  SELECT id INTO v_container_b_branch FROM inventory_containers WHERE code = '100-CROSS-BRANCH';
  BEGIN
    PERFORM inventory_add_to_container(
      (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch_b FROM fx),
      v_container_b_branch, (SELECT allocline_a FROM fx), 1
    );
    INSERT INTO test_log(line) SELECT fail('T33: expected cross-branch rejection, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0002', 'T33: an allocation line from a DIFFERENT branch than p_branch_id is rejected (P0002, Allocation line not found)');
  END;
END $$;

-- T34: cross-org rejection.
DO $$
BEGIN
  BEGIN
    PERFORM inventory_add_to_container(
      (SELECT e2e_user FROM fx), gen_random_uuid(), (SELECT branch FROM fx),
      (SELECT container_a FROM fx), (SELECT allocline_a FROM fx), 1
    );
    INSERT INTO test_log(line) SELECT fail('T34: expected cross-org rejection, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT ok(SQLSTATE IN ('P0002', '42501'), 'T34: a fabricated, unrelated organization_id is rejected (permission denied or not found)');
  END;
END $$;

-- ===========================================================================
-- T35-T42: NEW -- narrow raw-write boundary on RepairOrder-owned
-- inventory_containers/inventory_container_lines (external review
-- correction #3). Deliberately run BEFORE the permission-revocation test
-- below (actor still holds warehouse.inventory.operate here) -- the
-- RESTRICTIVE policies being tested here are independent of that
-- permission, but running these first guarantees any 0-row/denied result
-- is caused ONLY by the new RepairOrder-ownership boundary, never by a
-- missing .operate grant.
-- ===========================================================================

-- T35: direct UPDATE against a RepairOrder-owned container is silently
-- denied (RLS filters the row out -- 0 rows affected, not an exception --
-- LIVE VERIFIED semantics for a RESTRICTIVE USING-clause failure on UPDATE).
DO $$
DECLARE v_rowcount int;
BEGIN
  UPDATE inventory_containers SET code = 'HACKED' WHERE id = (SELECT container_a FROM fx);
  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  INSERT INTO test_log(line) SELECT is(v_rowcount, 0, 'T35: direct UPDATE against a RepairOrder-owned container affects 0 rows (RLS-filtered)');
END $$;

-- T36: direct DELETE against a RepairOrder-owned container is silently
-- denied (0 rows affected).
DO $$
DECLARE v_rowcount int;
BEGIN
  DELETE FROM inventory_containers WHERE id = (SELECT container_a FROM fx);
  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  INSERT INTO test_log(line) SELECT is(v_rowcount, 0, 'T36: direct DELETE against a RepairOrder-owned container affects 0 rows (RLS-filtered)');
END $$;

-- T37: direct INSERT of a new row claiming reference_type='repair_order'
-- is denied with an explicit RLS exception (INSERT's WITH CHECK raises,
-- unlike UPDATE/DELETE's silent USING-filter).
DO $$
BEGIN
  BEGIN
    INSERT INTO inventory_containers (organization_id, branch_id, code, type, status, current_location_id, reference_type, reference_id, created_by, updated_by)
    SELECT org, branch, '100-RAW-INSERT-ATTEMPT', 'container', 'empty', location_1, 'repair_order', ro::text, e2e_user, e2e_user
    FROM fx;
    INSERT INTO test_log(line) SELECT fail('T37: expected the direct INSERT to be denied, it succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'T37: direct INSERT of a RepairOrder-owned container is denied (42501, RLS policy violation)');
  END;
END $$;

-- T38: direct UPDATE against a RepairOrder-owned container's OWN
-- container_line is silently denied (0 rows).
DO $$
DECLARE v_rowcount int; v_line_id uuid;
BEGIN
  SELECT id INTO v_line_id FROM inventory_container_lines WHERE container_id = (SELECT container_a FROM fx) LIMIT 1;
  UPDATE inventory_container_lines SET quantity = 999 WHERE id = v_line_id;
  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  INSERT INTO test_log(line) SELECT is(v_rowcount, 0, 'T38: direct UPDATE against a RepairOrder-owned container''s own line affects 0 rows (RLS-filtered)');
END $$;

-- T39: direct DELETE against a RepairOrder-owned container's OWN
-- container_line is silently denied (0 rows).
DO $$
DECLARE v_rowcount int; v_line_id uuid;
BEGIN
  SELECT id INTO v_line_id FROM inventory_container_lines WHERE container_id = (SELECT container_a FROM fx) LIMIT 1;
  DELETE FROM inventory_container_lines WHERE id = v_line_id;
  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  INSERT INTO test_log(line) SELECT is(v_rowcount, 0, 'T39: direct DELETE against a RepairOrder-owned container''s own line affects 0 rows (RLS-filtered)');
END $$;

-- T40: direct INSERT of a new container_line under a RepairOrder-owned
-- container is denied with an explicit RLS exception.
DO $$
BEGIN
  BEGIN
    INSERT INTO inventory_container_lines (organization_id, branch_id, container_id, variant_id, unit_id, quantity)
    SELECT org, branch, container_a, variant_1,
      (SELECT base_unit_id FROM inventory_products WHERE id = (SELECT product_id FROM inventory_variants WHERE id = variant_1)),
      1
    FROM fx;
    INSERT INTO test_log(line) SELECT fail('T40: expected the direct INSERT to be denied, it succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'T40: direct INSERT of a container_line under a RepairOrder-owned container is denied (42501)');
  END;
END $$;

-- T41-T42: SUPERSEDED BY IC-7 (2026-09-17). Phase 10C's own original intent
-- (preserved here in this comment for history) was that GENERIC
-- (non-RepairOrder-owned) containers/lines remain unaffected, because at
-- the time ambra-location-inventory.ts's own 4 direct-write actions were
-- still live legacy callers. IC-6 (2026-09-17, same day, earlier phase)
-- deleted those 4 actions as confirmed-dead code; IC-7's own live repo-wide
-- grep then confirmed ZERO remaining direct-table writes to these tables
-- anywhere in the codebase (every real write goes through the canonical
-- inventory_create_container/inventory_add_to_container/inventory_remove_
-- from_container/inventory_seal_container RPCs). This made it safe, and a
-- deliberate IC-7 decision (see
-- docs/inventory/reviews/ic-7-review/write-boundary-matrix.md, "generic
-- rows" row, and migration
-- 20260917150706_ic7_reservation_allocation_container_restrictive_rls.sql's
-- own header comment), to close the generic-row raw-write gap too, not
-- just the RepairOrder-owned one. T41/T42 now assert the POST-IC-7
-- contract: raw writes against ANY inventory_containers/_container_lines
-- row -- generic or RepairOrder-owned -- are silently RLS-denied (0 rows).
DO $$
DECLARE v_rowcount int;
BEGIN
  UPDATE inventory_containers SET code = '100-CONTAINER-MISMATCH-RENAMED' WHERE id = (SELECT container_mismatch FROM fx);
  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  INSERT INTO test_log(line) SELECT is(v_rowcount, 0, 'T41: direct UPDATE against a GENERIC (non-RepairOrder) container is now denied post-IC-7 (0 rows, RLS-filtered)');
END $$;

DO $$
DECLARE v_rowcount int; v_line_id uuid;
BEGIN
  SELECT id INTO v_line_id FROM inventory_container_lines WHERE container_id = (SELECT container_match FROM fx) LIMIT 1;
  UPDATE inventory_container_lines SET quantity = quantity WHERE id = v_line_id;
  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  INSERT INTO test_log(line) SELECT is(v_rowcount, 0, 'T42: direct UPDATE against a GENERIC container''s own line is now denied post-IC-7 (0 rows, RLS-filtered)');
END $$;

-- T43: actor without warehouse.inventory.operate -> rejected.
RESET ROLE;
DELETE FROM user_effective_permissions
WHERE user_id = (SELECT e2e_user FROM fx) AND organization_id = (SELECT org FROM fx)
  AND permission_slug_exact IN ('warehouse.inventory.operate', 'warehouse.inventory.adjust', 'warehouse.inventory.reverse');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

DO $$
BEGIN
  BEGIN
    PERFORM inventory_add_to_container(
      (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
      (SELECT container_a FROM fx), (SELECT allocline_a FROM fx), 1
    );
    INSERT INTO test_log(line) SELECT fail('T43: expected permission-denied rejection, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'T43: actor lacking warehouse.inventory.operate -> rejected by the RPC''s own permission check');
  END;
END $$;

-- T44: direct raw-write bypass attempt on inventory_allocation_container_links
-- is denied -- the canonical RPC is the sole production write path. Runs
-- AFTER permission revocation deliberately (matches the original file's own
-- convention) -- the link table's own INSERT-deny policy is `WITH CHECK
-- (false)`, an absolute deny independent of any permission grant, so
-- running it here proves the boundary holds even for a caller who also
-- lacks .operate.
DO $$
BEGIN
  BEGIN
    INSERT INTO inventory_allocation_container_links (organization_id, branch_id, allocation_line_id, container_line_id, quantity)
    SELECT (SELECT org FROM fx), (SELECT branch FROM fx), (SELECT allocline_a FROM fx),
      (SELECT container_line_id FROM inventory_allocation_container_links WHERE id = (SELECT link_2 FROM fx)), 1;
    INSERT INTO test_log(line) SELECT fail('T44: expected the direct INSERT to be denied by RLS, it succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'T44: a direct authenticated client INSERT into inventory_allocation_container_links is denied -- the RPC is the sole production write path');
  END;
END $$;

RESET ROLE;

SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') AS not_ok_count, count(*) AS total_assertions FROM test_log;

ROLLBACK;
