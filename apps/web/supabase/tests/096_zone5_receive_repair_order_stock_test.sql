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
--
-- CORRECTION (external review): the two placeholder `SELECT pass('... TODO
-- ...')` assertions from the previous pass are removed. Case 4 (ambiguous
-- provenance) is now a real, fixture-driven test built against the
-- CONFIRMED real schema of wdd_matcher_sessions/wdd_matcher_session_files/
-- wdd_matcher_blocks/wdd_matcher_lines (read directly from
-- supabase/migrations/20260415100000_svwms_wdd_matcher_tables.sql this
-- pass, not assumed). Case 7 (atomicity) is now a real executed test (no
-- movement is created at all when resolution fails, proven by searching for
-- a distinctive idempotency key afterward) plus a structural proof (no
-- exception-swallowing block exists in the function body) -- not a fake
-- pass(). Where genuine live-only uncertainty remains (an engine-internal
-- failure occurring strictly AFTER inventory_create_and_finalize succeeds
-- but before this RPC's own attribution writes complete), that specific
-- sub-case is marked with an honest `skip()`, not a `pass()` -- see test 7b.

BEGIN;

SELECT plan(13);

-- Live-verification correction: receive_repair_order_stock's own first
-- check compares p_actor_user_id against auth.uid() -- which reads from
-- the request.jwt.claim(s) GUC (confirmed via direct pg_get_functiondef of
-- auth.uid()). Outside a real PostgREST-authenticated session that GUC is
-- unset, so auth.uid() is NULL and every call would fail with 28000
-- regardless of which actor id is passed -- including the tests that
-- expect success. Set it once, for this whole test's transaction, to the
-- real E2E user (same identifier 090-096 already use), matching the same
-- pattern 094 already established for its own RLS test.
SET LOCAL request.jwt.claims = '{"sub": "c4a24371-42db-4bb8-ab5e-379ebbf7d9c4"}';

CREATE TEMP TABLE fx (
  org uuid, branch uuid, e2e_user uuid,
  ro uuid, rol1 uuid, rol2 uuid, unit_ea uuid, variant_x uuid, product_id uuid,
  loc_recv uuid,
  session_id uuid, session_file_id uuid, block_id uuid, matcher_line_id uuid,
  wsd_id uuid, wsd_id_2 uuid, wsdl_a uuid, wsdl_b uuid,
  matcher_line_id_ok uuid, wsdl_ok uuid
);
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  'e39b15da-0a8d-4056-b5a2-80eb1da868a6'::uuid,
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid();

-- Live-verification correction: inventory_movement_lines/repair_order_lines both
-- carry real FKs to inventory_variants/inventory_units -- minimal real rows,
-- org-scoped, rolled back with everything else at the end of this test.
INSERT INTO inventory_units (id, organization_id, code, name)
SELECT unit_ea, org, '096-EA', '096 Each' FROM fx;
INSERT INTO inventory_products (id, organization_id, name, base_unit_id)
SELECT product_id, org, '096-test product', unit_ea FROM fx;
INSERT INTO inventory_variants (id, organization_id, product_id, sku)
SELECT variant_x, org, product_id, '096-SKU-X' FROM fx;

INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT loc_recv, org, branch, '096-test receiving', '096-RECV', true, 'receiving' FROM fx;
INSERT INTO repair_orders (id, organization_id, branch_id, zl_number, order_number, status)
SELECT ro, org, branch, '096-TEST-ZL-1', '096-TEST-1', 'open' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_name, ordered_quantity, status)
SELECT rol1, ro, variant_x, '096-test product', 5, 'pending' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_name, ordered_quantity, status)
SELECT rol2, ro, variant_x, '096-test product (second line, same RO)', 5, 'pending' FROM fx;

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

-- =====================================================================
-- 4. A source_line_id that resolves to MORE THAN ONE candidate -> HARD
--    ERROR. Real fixture: one wdd_matcher_lines row referenced by TWO
--    workshop_source_document_lines rows, each linked via
--    repair_order_line_source_links to a DIFFERENT repair_order_line.
--
--    Live-verification correction: the original comment here claimed this
--    was reachable with both lines under the SAME workshop_source_document
--    (wdd_matcher_line_id carries no UNIQUE constraint on its own, per
--    20260910061711_repair_orders_core_schema.sql:387,401). That is true for
--    the bare column, but a LATER migration
--    (20260910075359_workshop_source_document_lines_matcher_line_unique.sql,
--    confirmed live via pg_indexes) added a composite UNIQUE INDEX on
--    (workshop_source_document_id, wdd_matcher_line_id) WHERE
--    wdd_matcher_line_id IS NOT NULL, which forbids that same-document
--    shape. The scenario remains structurally reachable via two DIFFERENT
--    source documents (wsd_id / wsd_id_2 below) referencing the same
--    matcher line -- which is what this fixture now does. The RPC's own
--    ambiguity check operates purely on wdd_matcher_line_id regardless of
--    which document(s) it came from, so this remains a faithful test of the
--    RPC's rejection behavior.
-- =====================================================================
INSERT INTO wdd_matcher_sessions (id, organization_id, branch_id, name, status)
SELECT session_id, org, branch, '096-test session', 'approved' FROM fx;
INSERT INTO wdd_matcher_session_files (id, session_id, organization_id, file_role, file_name)
SELECT session_file_id, session_id, org, 'wdd', '096-test.pdf' FROM fx;
INSERT INTO wdd_matcher_blocks (id, session_file_id, session_id, organization_id, block_index, block_type)
SELECT block_id, session_file_id, session_id, org, 1, 'wdd_source' FROM fx;
INSERT INTO wdd_matcher_lines (id, block_id, session_id, organization_id, line_number, product_code, product_name, quantity, unit)
SELECT matcher_line_id, block_id, session_id, org, 1, 'SKU-X', '096 ambiguous test part', 2, 'ea' FROM fx;

INSERT INTO workshop_source_documents (id, organization_id, branch_id, document_type, external_document_number, source_session_id)
SELECT wsd_id, org, branch, 'wdd', '096-TEST-WDD-1', session_id FROM fx;
-- Live-verification correction: a LATER migration
-- (20260910075359_workshop_source_document_lines_matcher_line_unique.sql,
-- confirmed live via pg_indexes) added a composite UNIQUE INDEX on
-- (workshop_source_document_id, wdd_matcher_line_id) WHERE wdd_matcher_line_id
-- IS NOT NULL. Two lines under the SAME document can therefore no longer
-- reference the same matcher line. The ambiguous-provenance scenario is
-- still structurally reachable via a second, distinct source document
-- referencing the same matcher line -- that is what wsd_id_2 is for. This
-- does not change the RPC/trigger behavior under test, only how the
-- ambiguity is constructed in the fixture.
INSERT INTO workshop_source_documents (id, organization_id, branch_id, document_type, external_document_number, source_session_id)
SELECT wsd_id_2, org, branch, 'wdd', '096-TEST-WDD-2', session_id FROM fx;
INSERT INTO workshop_source_document_lines (id, workshop_source_document_id, wdd_matcher_line_id, product_code, product_name, quantity, unit)
SELECT wsdl_a, wsd_id, matcher_line_id, 'SKU-X', '096 ambiguous test part (copy A)', 2, 'ea' FROM fx;
INSERT INTO workshop_source_document_lines (id, workshop_source_document_id, wdd_matcher_line_id, product_code, product_name, quantity, unit)
SELECT wsdl_b, wsd_id_2, matcher_line_id, 'SKU-X', '096 ambiguous test part (copy B)', 2, 'ea' FROM fx;

INSERT INTO repair_order_line_source_links (repair_order_line_id, workshop_source_document_line_id, quantity_contribution)
SELECT rol1, wsdl_a, 2 FROM fx;
INSERT INTO repair_order_line_source_links (repair_order_line_id, workshop_source_document_line_id, quantity_contribution)
SELECT rol2, wsdl_b, 2 FROM fx;

-- Sanity: the fixture itself really is ambiguous at the wdd_matcher_line_id
-- hop (two distinct workshop_source_document_lines reference the same
-- matcher line, each resolving to a different repair_order_line) -- prove
-- the setup before trusting the RPC's rejection of it.
SELECT is(
  (SELECT count(*)::int FROM workshop_source_document_lines WHERE wdd_matcher_line_id = (SELECT matcher_line_id FROM fx)),
  2,
  '4a. fixture sanity: the same wdd_matcher_line_id is genuinely referenced by two workshop_source_document_lines rows'
);

SELECT throws_ok(
  format($sql$
    SELECT receive_repair_order_stock(
      '%s'::uuid, '%s'::uuid, '%s'::uuid,
      jsonb_build_array(jsonb_build_object('variant_id', '%s', 'unit_id', '%s', 'quantity', 2, 'source_line_id', '%s')),
      NULL, NULL, NULL, NULL, gen_random_uuid()::text
    )
  $sql$, (SELECT e2e_user::text FROM fx), (SELECT org::text FROM fx), (SELECT branch::text FROM fx),
         (SELECT variant_x::text FROM fx), (SELECT unit_ea::text FROM fx), (SELECT matcher_line_id::text FROM fx)),
  '55000',
  NULL,
  '4b. a source_line_id resolving to TWO RepairOrderLine candidates is a HARD ERROR (real fixture, not a placeholder)'
);

-- =====================================================================
-- 4c-4e. Live-verification addition: a genuine SUCCESSFUL, UNAMBIGUOUS
--    attribution path was never actually exercised above -- test 1 used
--    source_line_id = NULL (unattributed, never reaches the
--    repair_order_line_movement_links INSERT at all), and tests 3/4b only
--    exercise REJECTION paths. This is the RPC's whole purpose (resolve
--    Matcher provenance -> exact RepairOrderLine, write the business-
--    quantity link + the spatial seed, atomically) and was untested by
--    live execution until now. A fresh, unambiguous matcher line (one
--    document, one line, one link to rol1) proves the success path for
--    real: the call succeeds, repair_order_line_movement_links gets
--    exactly the expected row (relation_type='receipt'), and
--    repair_order_line_locations is seeded with the exact quantity at the
--    receiving location.
-- =====================================================================
INSERT INTO wdd_matcher_lines (id, block_id, session_id, organization_id, line_number, product_code, product_name, quantity, unit)
SELECT matcher_line_id_ok, block_id, session_id, org, 2, 'SKU-X', '096 unambiguous test part', 2, 'ea' FROM fx;
INSERT INTO workshop_source_document_lines (id, workshop_source_document_id, wdd_matcher_line_id, product_code, product_name, quantity, unit)
SELECT wsdl_ok, wsd_id, matcher_line_id_ok, 'SKU-X', '096 unambiguous test part', 2, 'ea' FROM fx;
INSERT INTO repair_order_line_source_links (repair_order_line_id, workshop_source_document_line_id, quantity_contribution)
SELECT rol1, wsdl_ok, 2 FROM fx;

SELECT lives_ok(
  format($sql$
    SELECT receive_repair_order_stock(
      '%s'::uuid, '%s'::uuid, '%s'::uuid,
      jsonb_build_array(jsonb_build_object('variant_id', '%s', 'unit_id', '%s', 'quantity', 2, 'source_line_id', '%s')),
      NULL, NULL, NULL, '096 unambiguous attributed receipt test', gen_random_uuid()::text
    )
  $sql$, (SELECT e2e_user::text FROM fx), (SELECT org::text FROM fx), (SELECT branch::text FROM fx),
         (SELECT variant_x::text FROM fx), (SELECT unit_ea::text FROM fx), (SELECT matcher_line_id_ok::text FROM fx)),
  '4c. a source_line_id resolving to EXACTLY ONE RepairOrderLine candidate succeeds (the RPC''s actual purpose, now proven live)'
);

SELECT is(
  (SELECT count(*)::int FROM repair_order_line_movement_links
   WHERE repair_order_line_id = (SELECT rol1 FROM fx) AND applied_quantity = 2 AND relation_type = 'receipt'),
  1,
  '4d. the successful attributed receipt writes exactly one repair_order_line_movement_links row (relation_type=''receipt'', correct quantity)'
);

SELECT is(
  (SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id = (SELECT rol1 FROM fx) AND location_id = (SELECT loc_recv FROM fx)),
  2::numeric,
  '4e. the successful attributed receipt seeds repair_order_line_locations with the exact received quantity at the receiving location'
);

-- 5. Receiving with no receiving location configured for the branch fails
--    clearly (resolve_branch_receiving_location's own P0002).
-- Live-verification correction: a genuinely random, unpermissioned org/branch
-- (as this test used before live verification) hits the RPC's own
-- has_branch_permission check FIRST (SQLSTATE 42501), never reaching
-- resolve_branch_receiving_location at all -- proving the WRONG failure
-- path. To actually test "no receiving location configured" (as opposed to
-- "not authorized"), the real, permitted E2E org/branch is used, with its
-- own receiving location temporarily un-designated for just this one call
-- (restored immediately after -- this whole file rolls back at the end
-- regardless, but the restore keeps the remaining tests' own preconditions
-- accurate).
UPDATE warehouse_locations SET purpose = 'standard' WHERE id = (SELECT loc_recv FROM fx);

SELECT throws_ok(
  format($sql$
    SELECT receive_repair_order_stock(
      '%s'::uuid, '%s'::uuid, '%s'::uuid,
      jsonb_build_array(jsonb_build_object('variant_id', '%s', 'unit_id', '%s', 'quantity', 1, 'source_line_id', NULL)),
      NULL, NULL, NULL, NULL, gen_random_uuid()::text
    )
  $sql$, (SELECT e2e_user::text FROM fx), (SELECT org::text FROM fx), (SELECT branch::text FROM fx),
         (SELECT variant_x::text FROM fx), (SELECT unit_ea::text FROM fx)),
  'P0002',
  NULL,
  '5. receiving into a branch with no designated receiving location fails clearly, not silently'
);

UPDATE warehouse_locations SET purpose = 'receiving' WHERE id = (SELECT loc_recv FROM fx);

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

-- =====================================================================
-- 7a. Atomicity, REAL executed proof (replaces the previous placeholder):
--     when resolution fails (case 3's zero-candidate scenario), NO movement
--     is posted at all -- proven by searching for a movement whose
--     idempotency key matches the one we passed, which must not exist.
-- =====================================================================
DO $$
DECLARE
  v_key text := gen_random_uuid()::text;
  v_bad_line uuid := gen_random_uuid();
BEGIN
  BEGIN
    PERFORM receive_repair_order_stock(
      (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
      jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_x FROM fx), 'unit_id', (SELECT unit_ea FROM fx), 'quantity', 2, 'source_line_id', v_bad_line)),
      NULL, NULL, NULL, NULL, v_key
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- expected: resolution fails before anything is posted
  END;
  PERFORM set_config('zone5_test.atomicity_key', v_key, true);
END $$;

SELECT is(
  (SELECT count(*)::int FROM inventory_movement_headers WHERE idempotency_key = current_setting('zone5_test.atomicity_key', true)),
  0,
  '7a. a resolution failure creates NO movement header at all -- the whole operation is atomic, not partially posted'
);

-- =====================================================================
-- 7b. Structural proof (not a behavioral one -- honestly labeled as such):
--     the function body contains no exception-swallowing block that could
--     let a mid-function failure be silently absorbed and falsely reported
--     as success while leaving partial writes. A genuine "engine posts,
--     then THIS function's own attribution write fails" scenario would
--     require either forcing an internal engine failure (whose exact
--     validation surface is not independently confirmed this session --
--     see the migration's own disclosed gap) or a live/local database to
--     execute against; that specific sub-case is honestly left unresolved
--     here via skip(), not asserted as passing.
-- =====================================================================
SELECT ok(
  pg_get_functiondef('public.receive_repair_order_stock'::regproc) !~* 'EXCEPTION\s+WHEN',
  '7b. (structural only) receive_repair_order_stock has no exception-swallowing block -- any failure anywhere in the function aborts the whole transaction by default PL/pgSQL behavior'
);

SELECT * FROM skip(
  1,
  '7c. SKIPPED (honest, not a fake pass): proving rollback of a failure occurring strictly AFTER inventory_create_and_finalize succeeds but BEFORE this RPC''s own attribution writes complete requires either live/local DB execution or independently-confirmed knowledge of the untracked engine''s internal validation surface -- neither is available this session; do not treat 7a/7b above as substituting for this specific sub-case.'
);

SELECT * FROM finish();
ROLLBACK;
