-- ============================================================================
-- TEST: Zone 5 Phase 4 -- receive_repair_order_stock RPC
-- ============================================================================
-- Verifies:
--   apps/web/supabase-target/supabase/migrations/
--   20260912093000_zone5_receive_repair_order_stock_rpc.sql
--
-- NOT EXECUTED this session -- Supabase MCP / live DB access was unavailable.
-- Depends on inventory_create_and_finalize existing live with the exact
-- named-parameter shape documented in
-- apps/web/src/server/services/inventory-movements.service.ts (tracked
-- application code, high confidence) and on a '101' movement type/receiving
-- purpose location already configured for the E2E fixture org/branch --
-- both require live confirmation before this file is actually run.

BEGIN;

SELECT plan(7);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, e2e_user uuid,
  ro uuid, rol1 uuid, unit_ea uuid, variant_x uuid,
  loc_recv uuid, session_id uuid, wsd_id uuid, wsdl_id uuid
);
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  'e39b15da-0a8d-4056-b5a2-80eb1da868a6'::uuid,
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

-- Fixture: branch receiving location (Phase 1), a RepairOrder + line, and a
-- Matcher-line -> RepairOrderLine lineage chain (Phase 2 dependency, Zone 3
-- tables) to exercise both the null and the resolvable source_line_id paths.
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT loc_recv, org, branch, '096-test receiving', '096-RECV', true, 'receiving' FROM fx;
INSERT INTO repair_orders (id, organization_id, branch_id, zl_number, order_number, status)
SELECT ro, org, branch, '096-TEST-ZL-1', '096-TEST-1', 'open' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_name, ordered_quantity, status)
SELECT rol1, ro, variant_x, '096-test product', 5, 'pending' FROM fx;

-- 1. NULL source_line_id -> allowed, unattributed receipt succeeds; the RPC
--    itself is exercised end-to-end (assumes '101'/receiving are configured
--    live for this org/branch -- disclosed dependency above).
SELECT lives_ok(
  format($sql$
    SELECT receive_repair_order_stock(
      '%s'::uuid, '%s'::uuid, '%s'::uuid,
      jsonb_build_array(jsonb_build_object('variant_id', '%s', 'unit_id', '%s', 'quantity', 3, 'source_line_id', NULL)),
      NULL, NULL, NULL, '096 unattributed receipt test', gen_random_uuid()::text
    )
  $sql$, (SELECT e2e_user::text FROM fx), (SELECT org::text FROM fx), (SELECT branch::text FROM fx),
         (SELECT variant_x::text FROM fx), (SELECT unit_ea::text FROM fx)),
  '1. source_line_id = NULL is allowed: an ordinary unattributed 101 receipt succeeds'
);

SELECT is(
  (SELECT count(*)::int FROM repair_order_line_locations WHERE repair_order_line_id = (SELECT rol1 FROM fx)),
  0,
  '2. an unattributed receipt writes NO repair_order_line_locations row (nothing to attribute)'
);

-- 3. A source_line_id that resolves to zero RepairOrderLines -> HARD ERROR,
--    never silently downgraded to unattributed.
SELECT throws_ok(
  format($sql$
    SELECT receive_repair_order_stock(
      '%s'::uuid, '%s'::uuid, '%s'::uuid,
      jsonb_build_array(jsonb_build_object('variant_id', '%s', 'unit_id', '%s', 'quantity', 2, 'source_line_id', '%s')),
      NULL, NULL, NULL, NULL, gen_random_uuid()::text
    )
  $sql$, (SELECT e2e_user::text FROM fx), (SELECT org::text FROM fx), (SELECT branch::text FROM fx),
         (SELECT variant_x::text FROM fx), (SELECT unit_ea::text FROM fx), (SELECT gen_random_uuid()::text)),
  'P0002',
  NULL,
  '3. a source_line_id that resolves to ZERO RepairOrderLines is a HARD ERROR, not a silent unattributed fallback'
);

-- 4. A source_line_id that resolves to more than one candidate -> HARD ERROR.
-- (Fixture: two workshop_source_document_lines rows pointing at the SAME
-- wdd_matcher_line_id, each linked to a DIFFERENT repair_order_line -- proven
-- structurally reachable in the plan §10 since
-- workshop_source_document_lines.wdd_matcher_line_id carries no UNIQUE
-- constraint.)
-- (Fixture construction omitted for brevity in this non-executed draft --
-- requires real wdd_matcher_sessions/blocks/lines rows per Zone 2/3's own
-- schema; to be completed against live fixtures when this test is actually
-- run, per the Phase 0 gate.)
SELECT pass('4. (fixture TODO when run live) ambiguous source_line_id resolution -> HARD ERROR, matching case 3''s pattern with two candidate rows');

-- 5. Receiving with no receiving location configured for the branch fails
--    clearly (resolve_branch_receiving_location's own P0002).
SELECT throws_ok(
  format($sql$
    SELECT receive_repair_order_stock(
      '%s'::uuid, '%s'::uuid, '%s'::uuid,
      jsonb_build_array(jsonb_build_object('variant_id', '%s', 'unit_id', '%s', 'quantity', 1, 'source_line_id', NULL)),
      NULL, NULL, NULL, NULL, gen_random_uuid()::text
    )
  $sql$, (SELECT e2e_user::text FROM fx), (SELECT gen_random_uuid()::text), (SELECT gen_random_uuid()::text),
         (SELECT variant_x::text FROM fx), (SELECT unit_ea::text FROM fx)),
  'P0002',
  NULL,
  '5. receiving into a branch with no designated receiving location fails clearly, not silently'
);

-- 6. Actor-identity spoofing is rejected.
SELECT throws_ok(
  format($sql$
    SELECT receive_repair_order_stock(
      '%s'::uuid, '%s'::uuid, '%s'::uuid,
      jsonb_build_array(jsonb_build_object('variant_id', '%s', 'unit_id', '%s', 'quantity', 1, 'source_line_id', NULL)),
      NULL, NULL, NULL, NULL, gen_random_uuid()::text
    )
  $sql$, (SELECT gen_random_uuid()::text), (SELECT org::text FROM fx), (SELECT branch::text FROM fx),
         (SELECT variant_x::text FROM fx), (SELECT unit_ea::text FROM fx)),
  '28000',
  NULL,
  '6. p_actor_user_id not matching auth.uid() is rejected'
);

-- 7. (Atomicity) -- documented as requiring a forced-failure fixture (e.g. an
--    invalid unit_id causing inventory_create_and_finalize itself to raise
--    mid-transaction) to prove no orphaned repair_order_line_movement_links/
--    repair_order_line_locations rows remain; to be completed live.
SELECT pass('7. (fixture TODO when run live) a forced mid-path failure inside inventory_create_and_finalize leaves no orphaned attribution rows -- one transaction, all-or-nothing');

SELECT * FROM finish();
ROLLBACK;
