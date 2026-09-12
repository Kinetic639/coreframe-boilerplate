-- ============================================================================
-- TEST: Zone 5 Phase 2 -- repair_order_line_locations + uncertainty marker
-- schema integrity (composite FKs, RLS, negative-quantity guard)
-- ============================================================================
-- Verifies:
--   apps/web/supabase-target/supabase/migrations/
--   20260912091000_zone5_repair_order_spatial_attribution_schema.sql
--
-- NOT EXECUTED this session -- Supabase MCP / live DB access was unavailable.
-- Written for execution in a session with live access. Uses the same
-- dedicated E2E fixture org/branch as 090-093; creates its own RepairOrder/
-- RepairOrderLine/location fixtures scoped to this test only (rolled back).

BEGIN;

SELECT plan(9);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, other_org uuid, other_branch uuid,
  ro uuid, ro_other_branch uuid, rol_a uuid, rol_b uuid,
  loc_a uuid, loc_wrong_branch uuid, variant_x uuid, advisor_contact uuid
);
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  'e39b15da-0a8d-4056-b5a2-80eb1da868a6'::uuid,
  gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), NULL;

-- Fixture: a RepairOrder + line in the real E2E org/branch, and a location in
-- a DIFFERENT (synthetic) branch to prove the cross-branch FK rejection.
INSERT INTO repair_orders (id, organization_id, branch_id, zl_number, order_number, status)
SELECT ro, org, branch, '094-TEST-ZL-1', '094-TEST-1', 'open' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_name, ordered_quantity, status)
SELECT rol_a, ro, '094-test product A', 5, 'pending' FROM fx;

INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc_a, org, branch, '094-test location A', '094-LOC-A', true FROM fx;

-- 1. A correct row (all relationships consistent) inserts cleanly.
INSERT INTO repair_order_line_locations
  (organization_id, branch_id, repair_order_id, repair_order_line_id, variant_id, location_id, quantity)
SELECT org, branch, ro, rol_a, variant_x, loc_a, 5 FROM fx;

SELECT pass('a fully-consistent repair_order_line_locations row inserts without error');

-- 2. location_id belonging to a DIFFERENT branch than the row's own branch_id
--    is rejected by the composite FK (rol_locations_location_fk), not merely
--    by application code.
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc_wrong_branch, org, other_branch, '094-test wrong-branch location', '094-LOC-WRONG', true FROM fx;

SELECT throws_ok(
  format($sql$
    INSERT INTO repair_order_line_locations
      (organization_id, branch_id, repair_order_id, repair_order_line_id, variant_id, location_id, quantity)
    VALUES ('%s', '%s', '%s', '%s', NULL, '%s', 1)
  $sql$,
    (SELECT org::text FROM fx), (SELECT branch::text FROM fx),
    (SELECT ro::text FROM fx), (SELECT rol_a::text FROM fx), (SELECT loc_wrong_branch::text FROM fx)),
  '23503',
  NULL,
  'a location belonging to a different branch than the row''s own branch_id is rejected (composite FK)'
);

-- 3. repair_order_id belonging to a different org/branch than the row's own
--    columns is rejected (rol_locations_repair_order_fk).
INSERT INTO repair_orders (id, organization_id, branch_id, zl_number, order_number, status)
SELECT ro_other_branch, org, other_branch, '094-TEST-ZL-2', '094-TEST-2', 'open' FROM fx;

SELECT throws_ok(
  format($sql$
    INSERT INTO repair_order_line_locations
      (organization_id, branch_id, repair_order_id, repair_order_line_id, variant_id, location_id, quantity)
    VALUES ('%s', '%s', '%s', '%s', NULL, '%s', 1)
  $sql$,
    (SELECT org::text FROM fx), (SELECT branch::text FROM fx),
    (SELECT ro_other_branch::text FROM fx), (SELECT rol_a::text FROM fx), (SELECT loc_a::text FROM fx)),
  '23503',
  NULL,
  'a repair_order_id whose own org/branch does not match the row''s columns is rejected (composite FK)'
);

-- 4. repair_order_line_id that does not actually belong to the claimed
--    repair_order_id is rejected (rol_locations_line_fk) -- the "pair
--    integrity" gap the review specifically asked to close at the DB level.
INSERT INTO repair_order_lines (id, repair_order_id, product_name, ordered_quantity, status)
SELECT rol_b, ro_other_branch, '094-test product B (belongs to other RO)', 3, 'pending' FROM fx;

SELECT throws_ok(
  format($sql$
    INSERT INTO repair_order_line_locations
      (organization_id, branch_id, repair_order_id, repair_order_line_id, variant_id, location_id, quantity)
    VALUES ('%s', '%s', '%s', '%s', NULL, '%s', 1)
  $sql$,
    (SELECT org::text FROM fx), (SELECT branch::text FROM fx),
    (SELECT ro::text FROM fx), (SELECT rol_b::text FROM fx), (SELECT loc_a::text FROM fx)),
  '23503',
  NULL,
  'a repair_order_line_id that does not belong to the claimed repair_order_id is rejected (composite FK, closes the pair-integrity gap)'
);

-- 5. quantity cannot go negative -- CHECK constraint, not just application discipline.
SELECT throws_ok(
  format($sql$
    UPDATE repair_order_line_locations SET quantity = -1
    WHERE repair_order_line_id = '%s' AND location_id = '%s'
  $sql$, (SELECT rol_a::text FROM fx), (SELECT loc_a::text FROM fx)),
  '23514',
  NULL,
  'quantity cannot be set negative -- CHECK (quantity >= 0) enforced at the DB level'
);

-- 6. Duplicate (repair_order_line_id, location_id) is rejected -- exactly one
--    logical row per that pair (rol_locations_unique).
SELECT throws_ok(
  format($sql$
    INSERT INTO repair_order_line_locations
      (organization_id, branch_id, repair_order_id, repair_order_line_id, variant_id, location_id, quantity)
    VALUES ('%s', '%s', '%s', '%s', NULL, '%s', 2)
  $sql$,
    (SELECT org::text FROM fx), (SELECT branch::text FROM fx),
    (SELECT ro::text FROM fx), (SELECT rol_a::text FROM fx), (SELECT loc_a::text FROM fx)),
  '23505',
  NULL,
  'a second row for the same (repair_order_line_id, location_id) pair is rejected'
);

-- 7. Uncertainty marker: a bad location (wrong branch) is rejected by its own FK.
SELECT throws_ok(
  format($sql$
    INSERT INTO repair_order_location_attribution_uncertain
      (organization_id, branch_id, location_id, variant_id)
    VALUES ('%s', '%s', '%s', '%s')
  $sql$,
    (SELECT org::text FROM fx), (SELECT branch::text FROM fx),
    (SELECT loc_wrong_branch::text FROM fx), (SELECT variant_x::text FROM fx)),
  '23503',
  NULL,
  'the uncertainty marker table also rejects a location from the wrong branch'
);

-- 8/9. RLS isolation: an actor with no permission on this org/branch sees zero
-- rows from either new table, even though rows exist.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000099"}';

SELECT is(
  (SELECT count(*)::int FROM repair_order_line_locations WHERE organization_id = (SELECT org FROM fx)),
  0,
  'RLS isolation: an actor with no permission on this org sees zero repair_order_line_locations rows'
);
SELECT is(
  (SELECT count(*)::int FROM repair_order_location_attribution_uncertain WHERE organization_id = (SELECT org FROM fx)),
  0,
  'RLS isolation: an actor with no permission on this org sees zero uncertainty-marker rows'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
