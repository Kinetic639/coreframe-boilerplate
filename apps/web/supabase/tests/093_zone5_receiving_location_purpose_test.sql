-- ============================================================================
-- TEST: Zone 5 Phase 1 -- warehouse_locations.purpose + one-per-branch rule
-- ============================================================================
-- Verifies:
--   apps/web/supabase-target/supabase/migrations/
--   20260912090000_zone5_receiving_location_purpose.sql
--
-- NOT EXECUTED this session -- Supabase MCP / live DB access was unavailable
-- throughout this implementation pass. Written to the same convention as
-- 090-092 (temp fixture table, real E2E org/branch, pgtap assertions) for
-- execution in a session with live access, per the plan's own "BLOCKED ON
-- MCP" instruction rather than fabricating a run record.
--
-- Reuses the same dedicated E2E fixture identifiers already used by
-- 091/092 (known to exist live, with baseline permissions already granted):
--   org    = 9f98fe91-63b8-4986-a2b3-65bdd47684c9
--   branch = e39b15da-0a8d-4056-b5a2-80eb1da868a6
--   e2e_user = c4a24371-42db-4bb8-ab5e-379ebbf7d9c4

BEGIN;

SELECT plan(8);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, other_branch uuid, other_org uuid,
  loc_std uuid, loc_recv_a uuid, loc_recv_b uuid, loc_deleted uuid, loc_not_stockable uuid
);
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  'e39b15da-0a8d-4056-b5a2-80eb1da868a6'::uuid,
  gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

-- 1. New rows default to 'standard' without specifying purpose.
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc_std, org, branch, '093-test standard location', '093-STD', true FROM fx;

SELECT is(
  (SELECT purpose FROM warehouse_locations WHERE id = (SELECT loc_std FROM fx)),
  'standard',
  'new location defaults to purpose=standard'
);

-- 2. A location can be designated 'receiving'.
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT loc_recv_a, org, branch, '093-test receiving A', '093-RECV-A', true, 'receiving' FROM fx;

SELECT is(
  (SELECT purpose FROM warehouse_locations WHERE id = (SELECT loc_recv_a FROM fx)),
  'receiving',
  'a location can be designated purpose=receiving'
);

-- 3. A SECOND active receiving location in the SAME branch is rejected by the DB.
SELECT throws_ok(
  format($sql$
    INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
    VALUES ('%s', '%s', '%s', '093-test receiving B (should fail)', '093-RECV-B', true, 'receiving')
  $sql$, (SELECT loc_recv_b::text FROM fx), (SELECT org::text FROM fx), (SELECT branch::text FROM fx)),
  '23505',
  NULL,
  'a second active receiving location in the same branch violates the one-per-branch unique index'
);

-- 4. An invalid purpose value is rejected by the CHECK constraint.
SELECT throws_ok(
  format($sql$
    INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
    VALUES ('%s', '%s', '%s', '093-test bad purpose', '093-BAD', true, 'quarantine')
  $sql$, (SELECT gen_random_uuid()::text), (SELECT org::text FROM fx), (SELECT branch::text FROM fx)),
  '23514',
  NULL,
  'a purpose value outside (standard, receiving) is rejected -- pitch domain is intentionally narrow'
);

-- 5. Standard locations are unaffected by the one-per-branch rule (many allowed).
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT gen_random_uuid(), org, branch, '093-test standard 2', '093-STD-2', true FROM fx;

SELECT pass('a second purpose=standard location in the same branch is allowed (no error)');

-- 6. Soft-deleting the active receiving location frees the branch to designate
--    a new one -- the partial index only counts deleted_at IS NULL rows.
UPDATE warehouse_locations SET deleted_at = now() WHERE id = (SELECT loc_recv_a FROM fx);

INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT loc_recv_b, org, branch, '093-test receiving B (after A deleted)', '093-RECV-B2', true, 'receiving' FROM fx;

SELECT is(
  (SELECT purpose FROM warehouse_locations WHERE id = (SELECT loc_recv_b FROM fx)),
  'receiving',
  'after the old receiving location is soft-deleted, a new one can be designated in the same branch'
);

-- 7. resolve_branch_receiving_location() returns the active one, ignoring the deleted one.
SELECT is(
  resolve_branch_receiving_location((SELECT org FROM fx), (SELECT branch FROM fx)),
  (SELECT loc_recv_b FROM fx),
  'resolve_branch_receiving_location returns the active (non-deleted) receiving location'
);

-- 8. resolve_branch_receiving_location() raises a clear error for a branch with none designated.
SELECT throws_ok(
  format('SELECT resolve_branch_receiving_location(%L, %L)', (SELECT other_org::text FROM fx), (SELECT other_branch::text FROM fx)),
  'P0002',
  NULL,
  'resolve_branch_receiving_location raises a clear error when no receiving location is configured'
);

SELECT * FROM finish();
ROLLBACK;
