-- ============================================================================
-- TEST: INVENTORY CORE A7 FOLLOW-UP CORRECTION -- generic container
-- eligibility gate + internal-helper extraction
-- ============================================================================
-- Closes the disclosed, accepted tradeoff A7 itself left open (see
-- docs/inventory/reviews/inventory-a7-repairorder-container-boundary-
-- review/boundary-evidence.md): a direct, permissioned caller of the
-- public inventory_add_to_container, bypassing repair_order_add_
-- allocation_to_container entirely, could place an unrelated allocation
-- into a RepairOrder-owned container, since the generic primitive (post
-- A7) had zero opinion on container ownership at all.
--
-- Fix: inventory_add_to_container is now a thin public wrapper -- a
-- generic-eligibility gate (reject ANY container carrying reference_
-- type/reference_id, domain-agnostic, not specifically checking
-- reference_type='repair_order') -- delegating to a new INTERNAL-ONLY
-- helper, inventory_add_to_container_internal, unreachable by any role
-- but the owner (postgres). repair_order_add_allocation_to_container
-- was redirected to call this same internal helper directly, bypassing
-- the public wrapper's own new restriction.
--
-- Executed live against supabase-target via Supabase MCP.

BEGIN;

SELECT plan(14);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, variant_1 uuid, unit_1 uuid, e2e_user uuid, location_1 uuid,
  ro_a uuid, line_a uuid, res_a uuid, resline_a uuid, alloc_a uuid, allocline_a uuid,
  container_repairorder uuid, container_other_domain uuid,
  container_partial_type_only uuid, container_partial_id_only uuid, container_generic uuid
);
GRANT SELECT, UPDATE ON fx TO authenticated, anon;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  'e39b15da-0a8d-4056-b5a2-80eb1da868a6'::uuid,
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid,
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), null, null, null, null,
  null, null, null, null, null;

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated, anon;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated, anon;

INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory)
SELECT location_1, org, branch, '115-loc-1', true FROM fx;
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT ro_a, org, branch, '115-RO-A', 'open' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT line_a, ro_a, variant_1, '115-SKU-A', '115 line A', 10, 'pcs' FROM fx;

SET LOCAL ambra.inventory_movement_engine = 'on';
INSERT INTO inventory_balances (organization_id, branch_id, location_id, variant_id, on_hand_quantity, reserved_quantity, allocated_quantity)
SELECT org, branch, location_1, variant_1, 0, 0, 0 FROM fx;
UPDATE inventory_balances b SET on_hand_quantity = 100
FROM fx WHERE b.organization_id = fx.org AND b.branch_id = fx.branch AND b.location_id = fx.location_1 AND b.variant_id = fx.variant_1;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

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

-- 5 containers covering every eligibility shape.
CREATE TEMP TABLE cf1 AS
SELECT (inventory_create_container(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  '115-CONTAINER-REPAIRORDER', (SELECT location_1 FROM fx), 'container', 'repair_order', (SELECT ro_a FROM fx)::text
)) AS result;
UPDATE fx SET container_repairorder = ((SELECT result FROM cf1) ->> 'container_id')::uuid;

-- An ARBITRARY, non-repair_order reference_type -- proves the public
-- API's own eligibility check is truly domain-agnostic (rejects ANY
-- reference, not specifically 'repair_order').
CREATE TEMP TABLE cf2 AS
SELECT (inventory_create_container(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  '115-CONTAINER-OTHER-DOMAIN', (SELECT location_1 FROM fx), 'container', 'some_other_domain', 'unrelated-ref-id'
)) AS result;
UPDATE fx SET container_other_domain = ((SELECT result FROM cf2) ->> 'container_id')::uuid;

-- Partial-state edge case: reference_type set, reference_id NULL.
CREATE TEMP TABLE cf3 AS
SELECT (inventory_create_container(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  '115-CONTAINER-PARTIAL-TYPE', (SELECT location_1 FROM fx), 'container', 'some_domain', null
)) AS result;
UPDATE fx SET container_partial_type_only = ((SELECT result FROM cf3) ->> 'container_id')::uuid;

-- Partial-state edge case: reference_id set, reference_type NULL.
CREATE TEMP TABLE cf4 AS
SELECT (inventory_create_container(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  '115-CONTAINER-PARTIAL-ID', (SELECT location_1 FROM fx), 'container', null, 'some-ref-id-without-a-type'
)) AS result;
UPDATE fx SET container_partial_id_only = ((SELECT result FROM cf4) ->> 'container_id')::uuid;

-- Genuinely generic: both NULL.
CREATE TEMP TABLE cf5 AS
SELECT (inventory_create_container(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  '115-CONTAINER-GENERIC', (SELECT location_1 FROM fx), 'container', null, null
)) AS result;
UPDATE fx SET container_generic = ((SELECT result FROM cf5) ->> 'container_id')::uuid;

-- ===========================================================================
-- Structural: internal helper's own grant shape (has_function_privilege,
-- not a live call -- proves the ACL directly).
-- ===========================================================================
RESET ROLE;
INSERT INTO test_log(line) SELECT is(
  has_function_privilege('authenticated', 'public.inventory_add_to_container_internal(uuid,uuid,uuid,uuid,uuid,numeric)', 'EXECUTE'),
  false, 'STRUCT1: authenticated has no EXECUTE on inventory_add_to_container_internal'
);
INSERT INTO test_log(line) SELECT is(
  has_function_privilege('anon', 'public.inventory_add_to_container_internal(uuid,uuid,uuid,uuid,uuid,numeric)', 'EXECUTE'),
  false, 'STRUCT2: anon has no EXECUTE on inventory_add_to_container_internal'
);
INSERT INTO test_log(line) SELECT is(
  has_function_privilege('service_role', 'public.inventory_add_to_container_internal(uuid,uuid,uuid,uuid,uuid,numeric)', 'EXECUTE'),
  false, 'STRUCT3: service_role has no EXECUTE on inventory_add_to_container_internal (reachable only via same-owner nesting)'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM pg_proc WHERE proname = 'inventory_add_to_container_internal'),
  1::bigint, 'STRUCT4: inventory_add_to_container_internal has exactly 1 overload'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

-- FUNC1: a real, permissioned authenticated caller cannot call the
-- internal helper directly (functional proof, not just ACL).
DO $$
BEGIN
  BEGIN
    PERFORM inventory_add_to_container_internal(
      (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
      (SELECT container_generic FROM fx), (SELECT allocline_a FROM fx), 1
    );
    INSERT INTO test_log(line) SELECT fail('FUNC1: expected authenticated denial on the internal helper, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'FUNC1: authenticated cannot call inventory_add_to_container_internal directly');
  END;
END $$;

-- ELIG1: public API rejects the RepairOrder-owned container (the
-- exact gap this correction closes).
DO $$
BEGIN
  BEGIN
    PERFORM inventory_add_to_container(
      (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
      (SELECT container_repairorder FROM fx), (SELECT allocline_a FROM fx), 1
    );
    INSERT INTO test_log(line) SELECT fail('ELIG1: expected rejection for a RepairOrder-owned container, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0002', 'ELIG1: public inventory_add_to_container rejects a RepairOrder-owned container');
  END;
END $$;

-- ELIG2: public API rejects an ARBITRARY other-domain container too --
-- proves the check is domain-agnostic, NOT specifically checking
-- reference_type='repair_order'.
DO $$
BEGIN
  BEGIN
    PERFORM inventory_add_to_container(
      (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
      (SELECT container_other_domain FROM fx), (SELECT allocline_a FROM fx), 1
    );
    INSERT INTO test_log(line) SELECT fail('ELIG2: expected rejection for an arbitrary other-domain container, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0002', 'ELIG2: public inventory_add_to_container rejects ANY domain-referenced container, not only repair_order (domain-agnostic)');
  END;
END $$;

-- ELIG3: partial state (reference_type set, reference_id null) is
-- ALSO rejected -- the rule is "either field set", not "both fields set".
DO $$
BEGIN
  BEGIN
    PERFORM inventory_add_to_container(
      (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
      (SELECT container_partial_type_only FROM fx), (SELECT allocline_a FROM fx), 1
    );
    INSERT INTO test_log(line) SELECT fail('ELIG3: expected rejection for a partial-state container (type set, id null), call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0002', 'ELIG3: partial reference state (reference_type set, reference_id null) is rejected -- conservative, not requiring BOTH fields');
  END;
END $$;

-- ELIG4: the other partial-state shape (reference_id set, reference_type null).
DO $$
BEGIN
  BEGIN
    PERFORM inventory_add_to_container(
      (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
      (SELECT container_partial_id_only FROM fx), (SELECT allocline_a FROM fx), 1
    );
    INSERT INTO test_log(line) SELECT fail('ELIG4: expected rejection for a partial-state container (id set, type null), call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0002', 'ELIG4: partial reference state (reference_id set, reference_type null) is rejected too');
  END;
END $$;

-- ELIG5: a genuinely generic (both-null) container still succeeds --
-- the fix does not weaken the legitimate generic path.
CREATE TEMP TABLE elig5 AS
SELECT (inventory_add_to_container(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT container_generic FROM fx), (SELECT allocline_a FROM fx), 4
)) AS result;
INSERT INTO test_log(line) SELECT is((result ->> 'quantity')::numeric, 4::numeric, 'ELIG5: public inventory_add_to_container still succeeds for a genuinely generic (both-null) container') FROM elig5;

-- ORDER1: a spoofed actor targeting a domain-owned container still
-- gets 28000 (actor check runs BEFORE the eligibility check, matching
-- the established ordering convention -- never leaks eligibility
-- information to an unauthenticated-as-claimed caller).
DO $$
BEGIN
  BEGIN
    PERFORM inventory_add_to_container(
      gen_random_uuid(), (SELECT org FROM fx), (SELECT branch FROM fx),
      (SELECT container_repairorder FROM fx), (SELECT allocline_a FROM fx), 1
    );
    INSERT INTO test_log(line) SELECT fail('ORDER1: expected 28000 actor-mismatch, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '28000', 'ORDER1: actor-identity check runs before the eligibility check (28000, not P0002, for a spoofed actor even against a domain-owned container)');
  END;
END $$;

-- ORDER2: a no-permission caller targeting a domain-owned container
-- still gets 42501, not P0002 -- permission check runs before
-- eligibility too.
RESET ROLE;
DELETE FROM user_effective_permissions
WHERE user_id = (SELECT e2e_user FROM fx) AND organization_id = (SELECT org FROM fx)
  AND permission_slug_exact = 'warehouse.inventory.operate';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);
DO $$
BEGIN
  BEGIN
    PERFORM inventory_add_to_container(
      (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
      (SELECT container_repairorder FROM fx), (SELECT allocline_a FROM fx), 1
    );
    INSERT INTO test_log(line) SELECT fail('ORDER2: expected 42501 no-permission, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'ORDER2: branch-permission check runs before the eligibility check (42501, not P0002, for a no-permission caller even against a domain-owned container)');
  END;
END $$;
RESET ROLE;
INSERT INTO user_effective_permissions (user_id, organization_id, branch_id, permission_slug, permission_slug_exact)
SELECT e2e_user, org, branch, 'warehouse.inventory.operate', 'warehouse.inventory.operate' FROM fx;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

-- ATOMIC1: none of the rejected ELIG1-4/ORDER1-2 attempts left any
-- partial mutation -- allocline_a's own container-link total reflects
-- only ELIG5's genuine success (4), nothing else.
INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(quantity), 0) FROM inventory_allocation_container_links WHERE allocation_line_id = (SELECT allocline_a FROM fx) AND deleted_at IS NULL),
  4::numeric,
  'ATOMIC1: allocline_a''s own container-link total is exactly 4 (ELIG5''s genuine success only) -- zero partial mutation from any of the 6 rejected attempts (FUNC1, ELIG1-4, ORDER1-2)'
);

-- WRAPPER_SANITY: the RepairOrder wrapper's own success path still
-- works end-to-end through the new internal-helper delegation.
CREATE TEMP TABLE sanity AS
SELECT (repair_order_add_allocation_to_container(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  (SELECT container_repairorder FROM fx), (SELECT allocline_a FROM fx), 2
)) AS result;
INSERT INTO test_log(line) SELECT is((result ->> 'quantity')::numeric, 2::numeric, 'WRAPPER_SANITY: repair_order_add_allocation_to_container still succeeds end-to-end through the internal helper for a legitimate same-RepairOrder placement') FROM sanity;

RESET ROLE;

SELECT line FROM test_log ORDER BY seq;

ROLLBACK;
