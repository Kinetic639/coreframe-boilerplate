-- ============================================================================
-- TEST: INVENTORY CORE A7 -- RepairOrder <-> generic container boundary
-- ============================================================================
-- Covers the A7 domain-boundary extraction: inventory_add_to_container (a
-- generic, domain-agnostic Handling-Unit primitive) no longer contains an
-- inline RepairOrder-ownership branch (repair_order_lines JOIN). That check
-- now lives in a new RepairOrder-domain wrapper,
-- repair_order_add_allocation_to_container, which validates ownership then
-- calls the now-narrowed generic primitive as a nested call in the SAME
-- transaction (no second round-trip, no new lock -- see docs/inventory/
-- reviews/inventory-a7-repairorder-container-boundary-review/boundary-
-- evidence.md for the full write-once/TOCTOU re-verification this pass
-- performed live before implementing).
--
-- A7 FOLLOW-UP CORRECTION PASS (see docs/inventory/reviews/inventory-a7-
-- correction-generic-container-eligibility-review/): scenario G2 below
-- originally demonstrated a disclosed, accepted tradeoff -- a DIRECT call
-- to inventory_add_to_container (bypassing the wrapper) with a cross-
-- RepairOrder allocation into a RepairOrder-owned container succeeded,
-- since the generic primitive had no opinion on container ownership at
-- all. That tradeoff is now CLOSED: inventory_add_to_container itself
-- was split into a thin public wrapper (a generic-eligibility gate: reject
-- ANY container carrying reference_type/reference_id, domain-agnostic,
-- not specifically RepairOrder) delegating to a new INTERNAL-ONLY helper,
-- inventory_add_to_container_internal (unreachable by any role but the
-- owner). repair_order_add_allocation_to_container was redirected to call
-- this same internal helper directly. G2 (and J2's own downstream total)
-- are updated accordingly -- see their own inline comments. A new,
-- dedicated file, 115_a7_correction_generic_container_eligibility_test.sql,
-- covers this correction's own full scenario set.
--
-- Executed live against supabase-target via Supabase MCP.

BEGIN;

SELECT plan(18);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, branch_b uuid, variant_1 uuid, unit_1 uuid, e2e_user uuid,
  location_1 uuid, location_2 uuid,
  ro_a uuid, ro_b uuid, line_a uuid, line_b uuid, line_c uuid,
  res_a uuid, resline_a uuid, alloc_a uuid, allocline_a uuid,
  res_b uuid, resline_b uuid, alloc_b uuid, allocline_b uuid,
  res_c uuid, resline_c uuid, alloc_c uuid, allocline_c uuid,
  container_a uuid, container_generic uuid
);
GRANT SELECT, UPDATE ON fx TO authenticated, anon;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  'e39b15da-0a8d-4056-b5a2-80eb1da868a6'::uuid,
  gen_random_uuid(),
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid,
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  null, null, null, null,
  null, null, null, null,
  null, null, null, null,
  null, null;

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated, anon;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated, anon;

-- ===========================================================================
-- Fixture setup (as the connecting role, unrestricted).
-- ===========================================================================

INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch_b, org, '114-test-branch-B', 994 FROM fx;

INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory)
SELECT location_1, org, branch, '114-loc-1', true FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory)
SELECT location_2, org, branch, '114-loc-2', true FROM fx;

INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT ro_a, org, branch, '114-RO-A', 'open' FROM fx;
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT ro_b, org, branch, '114-RO-B', 'open' FROM fx;

INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT line_a, ro_a, variant_1, '114-SKU-A', '114 line A', 10, 'pcs' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT line_b, ro_b, variant_1, '114-SKU-B', '114 line B (different RepairOrder)', 10, 'pcs' FROM fx;
-- line_c: SAME RepairOrder as line_a, but its own reservation/allocation
-- will be placed at location_2 -- used only for the location-mismatch
-- scenario (H2), isolated from the running placement sums used elsewhere.
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT line_c, ro_a, variant_1, '114-SKU-C', '114 line C (SAME RepairOrder, location-mismatch probe)', 5, 'pcs' FROM fx;

SET LOCAL ambra.inventory_movement_engine = 'on';
INSERT INTO inventory_balances (organization_id, branch_id, location_id, variant_id, on_hand_quantity, reserved_quantity, allocated_quantity)
SELECT org, branch, location_1, variant_1, 0, 0, 0 FROM fx;
INSERT INTO inventory_balances (organization_id, branch_id, location_id, variant_id, on_hand_quantity, reserved_quantity, allocated_quantity)
SELECT org, branch, location_2, variant_1, 0, 0, 0 FROM fx;
UPDATE inventory_balances b SET on_hand_quantity = 100
FROM fx WHERE b.organization_id = fx.org AND b.branch_id = fx.branch
  AND b.location_id IN (fx.location_1, fx.location_2) AND b.variant_id = fx.variant_1;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

-- Chain A: line_a (RO A), reserved+allocated 10 at location_1.
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

-- Chain B: line_b (RO B, DIFFERENT RepairOrder), reserved+allocated 10 at location_1.
CREATE TEMP TABLE rf3 AS
SELECT (inventory_create_reservation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT location_1 FROM fx), 'quantity', 10)),
  'repair_order_line', (SELECT line_b FROM fx), null, null, null, (SELECT e2e_user FROM fx)
)) AS result;
UPDATE fx SET res_b = ((SELECT result FROM rf3) ->> 'reservation_id')::uuid;
UPDATE fx SET resline_b = (SELECT id FROM inventory_reservation_lines WHERE reservation_id = (SELECT res_b FROM fx));
CREATE TEMP TABLE rf4 AS
SELECT (inventory_create_allocation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT location_1 FROM fx), 'quantity', 10, 'reservation_line_id', (SELECT resline_b FROM fx))),
  (SELECT res_b FROM fx), 'repair_order_line', (SELECT line_b FROM fx), null, (SELECT e2e_user FROM fx)
)) AS result;
UPDATE fx SET alloc_b = ((SELECT result FROM rf4) ->> 'allocation_id')::uuid;
UPDATE fx SET allocline_b = (SELECT id FROM inventory_allocation_lines WHERE allocation_id = (SELECT alloc_b FROM fx));

-- Chain C: line_c (SAME RepairOrder as line_a), reserved+allocated 5 at
-- location_2 (deliberately NOT location_1, for the location-mismatch scenario).
CREATE TEMP TABLE rf5 AS
SELECT (inventory_create_reservation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT location_2 FROM fx), 'quantity', 5)),
  'repair_order_line', (SELECT line_c FROM fx), null, null, null, (SELECT e2e_user FROM fx)
)) AS result;
UPDATE fx SET res_c = ((SELECT result FROM rf5) ->> 'reservation_id')::uuid;
UPDATE fx SET resline_c = (SELECT id FROM inventory_reservation_lines WHERE reservation_id = (SELECT res_c FROM fx));
CREATE TEMP TABLE rf6 AS
SELECT (inventory_create_allocation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT location_2 FROM fx), 'quantity', 5, 'reservation_line_id', (SELECT resline_c FROM fx))),
  (SELECT res_c FROM fx), 'repair_order_line', (SELECT line_c FROM fx), null, (SELECT e2e_user FROM fx)
)) AS result;
UPDATE fx SET alloc_c = ((SELECT result FROM rf6) ->> 'allocation_id')::uuid;
UPDATE fx SET allocline_c = (SELECT id FROM inventory_allocation_lines WHERE allocation_id = (SELECT alloc_c FROM fx));

-- container_a: RepairOrder-owned (RO A), at location_1.
CREATE TEMP TABLE cf1 AS
SELECT (inventory_create_container(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  '114-CONTAINER-A', (SELECT location_1 FROM fx), 'container', 'repair_order', (SELECT ro_a FROM fx)::text
)) AS result;
UPDATE fx SET container_a = ((SELECT result FROM cf1) ->> 'container_id')::uuid;

-- container_generic: no RepairOrder ownership at all.
CREATE TEMP TABLE cf2 AS
SELECT (inventory_create_container(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  '114-CONTAINER-GENERIC', (SELECT location_1 FROM fx), 'container', null, null
)) AS result;
UPDATE fx SET container_generic = ((SELECT result FROM cf2) ->> 'container_id')::uuid;

-- ===========================================================================
-- A. wrapper succeeds for allocation belonging to the same RepairOrder
-- ===========================================================================
CREATE TEMP TABLE wf1 AS
SELECT (repair_order_add_allocation_to_container(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT container_a FROM fx), (SELECT allocline_a FROM fx), 6
)) AS result;
INSERT INTO test_log(line) SELECT is((result ->> 'quantity')::numeric, 6::numeric, 'A: wrapper succeeds placing allocline_a (RO A) into container_a (RO A) -- same RepairOrder') FROM wf1;
INSERT INTO test_log(line) SELECT is(
  (SELECT status FROM inventory_containers WHERE id = (SELECT container_a FROM fx)),
  'active', 'A2: container_a transitions empty -> active after the wrapper''s own successful placement'
);

-- ===========================================================================
-- B. wrapper rejects allocation belonging to a DIFFERENT RepairOrder
-- ===========================================================================
DO $$
BEGIN
  BEGIN
    PERFORM repair_order_add_allocation_to_container(
      (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
      (SELECT container_a FROM fx), (SELECT allocline_b FROM fx), 1
    );
    INSERT INTO test_log(line) SELECT fail('B: expected cross-RepairOrder rejection, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0002', 'B: wrapper rejects allocline_b (RO B) into container_a (RO A) -- different RepairOrder (P0002, non-leaking)');
  END;
END $$;

-- ===========================================================================
-- C. wrapper rejects a foreign branch (container does not exist in that
-- branch -- non-leaking "not found", never reveals it exists elsewhere)
-- ===========================================================================
DO $$
BEGIN
  BEGIN
    PERFORM repair_order_add_allocation_to_container(
      (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch_b FROM fx),
      (SELECT container_a FROM fx), (SELECT allocline_a FROM fx), 1
    );
    INSERT INTO test_log(line) SELECT fail('C: expected foreign-branch rejection, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0002', 'C: wrapper rejects a foreign branch as Container not found (non-leaking)');
  END;
END $$;

-- ===========================================================================
-- D. wrapper rejects a spoofed actor identity
-- ===========================================================================
DO $$
BEGIN
  BEGIN
    PERFORM repair_order_add_allocation_to_container(
      gen_random_uuid(), (SELECT org FROM fx), (SELECT branch FROM fx),
      (SELECT container_a FROM fx), (SELECT allocline_a FROM fx), 1
    );
    INSERT INTO test_log(line) SELECT fail('D: expected actor-mismatch rejection, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '28000', 'D: wrapper rejects p_actor_user_id spoofing (not the authenticated caller)');
  END;
END $$;

-- ===========================================================================
-- E. wrapper rejects a caller with no warehouse.inventory.operate permission
-- ===========================================================================
RESET ROLE;
DELETE FROM user_effective_permissions
WHERE user_id = (SELECT e2e_user FROM fx) AND organization_id = (SELECT org FROM fx)
  AND permission_slug_exact = 'warehouse.inventory.operate';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);
DO $$
BEGIN
  BEGIN
    PERFORM repair_order_add_allocation_to_container(
      (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
      (SELECT container_a FROM fx), (SELECT allocline_a FROM fx), 1
    );
    INSERT INTO test_log(line) SELECT fail('E: expected no-permission rejection, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'E: wrapper rejects a caller without warehouse.inventory.operate');
  END;
END $$;
-- Restore the permission (this whole file rolls back anyway, but keep the
-- remaining scenarios operating under the real, intended permission set).
RESET ROLE;
INSERT INTO user_effective_permissions (user_id, organization_id, branch_id, permission_slug, permission_slug_exact)
SELECT e2e_user, org, branch, 'warehouse.inventory.operate', 'warehouse.inventory.operate' FROM fx;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

-- ===========================================================================
-- F. generic inventory_add_to_container still succeeds for a non-RepairOrder
-- (generic) container -- completely unaffected by A7
-- ===========================================================================
CREATE TEMP TABLE gf1 AS
SELECT (inventory_add_to_container(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT container_generic FROM fx), (SELECT allocline_b FROM fx), 3
)) AS result;
INSERT INTO test_log(line) SELECT is((result ->> 'quantity')::numeric, 3::numeric, 'F: generic inventory_add_to_container still succeeds directly for a non-RepairOrder container') FROM gf1;

-- ===========================================================================
-- G. generic primitive no longer depends on repair_order_lines
-- ===========================================================================
-- G1: structural proof -- zero real FROM/JOIN references (not a substring
-- match on the function's own explanatory comment about the removal).
INSERT INTO test_log(line) SELECT is(
  (SELECT prosrc ~* '(from|join)\s+(public\.)?repair_order_lines\M' FROM pg_proc WHERE proname = 'inventory_add_to_container'),
  false,
  'G1: inventory_add_to_container contains zero real FROM/JOIN references to repair_order_lines'
);
-- G2: A7 FOLLOW-UP CORRECTION PASS -- the disclosed direct-caller
-- tradeoff this scenario used to demonstrate (a direct call bypassing
-- the wrapper could place a cross-RepairOrder allocation into a
-- RepairOrder-owned container) is now CLOSED. The public generic API
-- rejects ANY domain-owned/referenced container (not specifically
-- RepairOrder -- see 115_a7_correction_generic_container_eligibility_
-- test.sql's own G-series for the domain-agnostic proof) with the
-- SAME P0002 "Container not found" message a genuinely nonexistent
-- container gets -- non-leaking, no 42501 (the actor legitimately
-- holds warehouse.inventory.operate; this is not a permission
-- failure).
DO $$
BEGIN
  BEGIN
    PERFORM inventory_add_to_container(
      (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
      (SELECT container_a FROM fx), (SELECT allocline_b FROM fx), 1
    );
    INSERT INTO test_log(line) SELECT fail('G2: expected the generic API to reject a RepairOrder-owned container, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0002', 'G2: a DIRECT call to the generic primitive with a RepairOrder-owned container is now rejected (P0002, generic-eligibility gate, A7 follow-up correction)');
  END;
END $$;

-- ===========================================================================
-- H. quantity/location validation remains enforced (by the nested generic
-- call, reached through the wrapper)
-- ===========================================================================
DO $$
BEGIN
  BEGIN
    PERFORM repair_order_add_allocation_to_container(
      (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
      (SELECT container_a FROM fx), (SELECT allocline_a FROM fx), 0
    );
    INSERT INTO test_log(line) SELECT fail('H1: expected quantity-must-be-positive rejection, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '22023', 'H1: quantity validation (must be positive) still enforced through the wrapper -> nested generic call');
  END;
END $$;

DO $$
BEGIN
  BEGIN
    -- allocline_c belongs to RO A (passes the wrapper's own ownership
    -- check against container_a, also RO A) but its own allocation is at
    -- location_2, while container_a sits at location_1 -- isolates the
    -- LOCATION-mismatch failure specifically (not the ownership check).
    PERFORM repair_order_add_allocation_to_container(
      (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
      (SELECT container_a FROM fx), (SELECT allocline_c FROM fx), 1
    );
    INSERT INTO test_log(line) SELECT fail('H2: expected location-mismatch rejection, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '22023', 'H2: location-match validation still enforced through the wrapper -> nested generic call (same RepairOrder, wrong location)');
  END;
END $$;

-- ===========================================================================
-- I. no duplicate placement / over-placement regression
-- ===========================================================================
-- allocline_a has 10 allocated, 6 already placed (scenario A above).
-- Placing the remaining 4 succeeds; a further +1 (would total 11) is
-- atomically rejected.
CREATE TEMP TABLE wf2 AS
SELECT (repair_order_add_allocation_to_container(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT container_a FROM fx), (SELECT allocline_a FROM fx), 4
)) AS result;
INSERT INTO test_log(line) SELECT is((result ->> 'quantity')::numeric, 4::numeric, 'I1: placing the remaining 4 (6+4=10, exactly the allocated amount) succeeds') FROM wf2;

DO $$
BEGIN
  BEGIN
    PERFORM repair_order_add_allocation_to_container(
      (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
      (SELECT container_a FROM fx), (SELECT allocline_a FROM fx), 1
    );
    INSERT INTO test_log(line) SELECT fail('I2: expected over-placement rejection (10/10 already placed), call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '22023', 'I2: over-placement beyond the allocation''s own allocated_quantity is still atomically rejected through the wrapper');
  END;
END $$;

-- ===========================================================================
-- J. atomic rollback -- a rejected wrapper call leaves zero container-link
-- mutation. Uses allocline_c: it is ONLY ever attempted once in this
-- whole file (scenario H2, rejected for a location mismatch) and never
-- successfully placed anywhere.
--
-- A7 FOLLOW-UP CORRECTION PASS note: prior to this correction, G2's own
-- direct-generic-call demonstration was a deliberate SUCCESS case
-- (the disclosed tradeoff), which contributed +1 to container_a's own
-- total and required using allocline_c here instead of allocline_b to
-- avoid conflating the two. G2 is now ALSO a rejection case (the fix),
-- so allocline_b in fact has zero container-link rows too as of this
-- correction -- allocline_c is kept here regardless, since it remains
-- the cleanest, most narrowly-scoped choice for this specific
-- atomicity proof.
-- ===========================================================================
INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(quantity), 0) FROM inventory_allocation_container_links WHERE allocation_line_id = (SELECT allocline_c FROM fx) AND deleted_at IS NULL),
  0::numeric,
  'J1: allocline_c has zero container-link rows anywhere -- its only attempted placement (scenario H2, rejected for a location mismatch) left no partial mutation'
);
-- container_a's own total contents: 6+4=10 from allocline_a's two
-- successful wrapper placements (A, I1) only. G2 (now also a rejection
-- case, post-correction) contributes nothing. None of the rejected
-- attempts (B, C, D, E, G2, H1, H2, I2) contribute.
INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(quantity), 0) FROM inventory_container_lines WHERE container_id = (SELECT container_a FROM fx) AND deleted_at IS NULL),
  10::numeric,
  'J2: container_a''s own contents total exactly 10 (6+4 from allocline_a''s two successful wrapper placements only) -- no stray rows from any rejected attempt (B, C, D, E, G2, H1, H2, I2)'
);

RESET ROLE;

-- ===========================================================================
-- Security model: stale-overload + anon-denied checks for both functions
-- ===========================================================================
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM pg_proc WHERE proname = 'repair_order_add_allocation_to_container'),
  1::bigint, 'SEC1: repair_order_add_allocation_to_container has exactly 1 overload'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM pg_proc WHERE proname = 'inventory_add_to_container'),
  1::bigint, 'SEC2: inventory_add_to_container still has exactly 1 overload (narrowed, not duplicated)'
);

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}', true);
DO $$
BEGIN
  BEGIN
    PERFORM repair_order_add_allocation_to_container(
      gen_random_uuid(), (SELECT org FROM fx), (SELECT branch FROM fx),
      (SELECT container_a FROM fx), (SELECT allocline_a FROM fx), 1
    );
    INSERT INTO test_log(line) SELECT fail('SEC3: expected anon denial, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'SEC3: anon cannot execute repair_order_add_allocation_to_container (grant-level denial)');
  END;
END $$;
RESET ROLE;

SELECT line FROM test_log ORDER BY seq;

ROLLBACK;
