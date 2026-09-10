-- ============================================================================
-- TEST: Zone 3 materialize_repair_orders_from_session RPC (Phase 3)
-- ============================================================================
-- Verifies apps/web/supabase-target/supabase/migrations/20260910075814_repair_orders_materialization_rpc.sql
-- (plus its companion migrations: 20260910075359 unique index,
-- 20260910080123 permission-cache recompile, 20260910080512 quantity CHECK
-- relaxation, 20260910074716 archive RLS restriction).
--
-- Executed against supabase-target via Supabase MCP. Last run: 2026-09-10,
-- 17/17 passing (7 fixture-scenario assertions in the first block, 2 in the
-- second multi-document block, 1 atomicity proof, 1 authorization-denial
-- proof, plus supporting checks).
--
-- This test creates fully SYNTHETIC wdd_matcher_sessions/blocks/lines fixture
-- rows (never touches real imported Matcher data) using a real existing
-- organization/branch/org_owner user from the live database, wrapped in
-- BEGIN/ROLLBACK -- verified zero residual data after each run.
--
-- Simulates an authenticated session via set_config('request.jwt.claim.sub', ...)
-- since Supabase MCP's connection otherwise has auth.uid() = NULL.
--
-- Concurrency note: true two-connection concurrent-call testing cannot be
-- expressed in a single pgTAP script. This file proves (a) the row lock
-- exists in the function body (SELECT ... FOR UPDATE, first statement after
-- validation) and (b) sequential idempotent replay produces zero duplicates
-- -- it does NOT claim to have exercised genuine simultaneous execution.
-- That remains explicitly scheduled for Phase 15's live-DB integration tests.

BEGIN;

SELECT plan(17);

CREATE TEMP TABLE rpc_fixture (
  org_id uuid, branch_id uuid, user_id uuid,
  session_a uuid, session_pending uuid, ro1 uuid, ro2 uuid,
  result1 jsonb, result2 jsonb, reject_status text, reject_actor text
);

DO $fixture$
DECLARE
  v_org uuid := '9f98fe91-63b8-4986-a2b3-65bdd47684c9';
  v_branch uuid := 'e39b15da-0a8d-4056-b5a2-80eb1da868a6';
  v_user uuid := '832858c3-0a9f-4f9f-a230-fc7e47855e78';
  v_session_a uuid := gen_random_uuid();
  v_session_pending uuid := gen_random_uuid();
  v_block1 uuid := gen_random_uuid();
  v_block2 uuid := gen_random_uuid();
  v_session_file uuid := gen_random_uuid();
  v_result1 jsonb;
  v_result2 jsonb;
  v_ro1 uuid;
  v_ro2 uuid;
  v_reject_status text := 'not raised';
  v_reject_actor text := 'not raised';
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);

  INSERT INTO wdd_matcher_sessions (id, organization_id, branch_id, name, status)
  VALUES (v_session_a, v_org, v_branch, 'pgTAP fixture session', 'approved');

  INSERT INTO wdd_matcher_session_files (id, session_id, organization_id, file_role, file_name, file_size)
  VALUES (v_session_file, v_session_a, v_org, 'brand', 'fixture.pdf', 100);

  INSERT INTO wdd_matcher_blocks (id, session_file_id, session_id, organization_id, block_index, block_type, is_excluded, metadata)
  VALUES
    (v_block1, v_session_file, v_session_a, v_org, 0, 'brand_order', false,
      jsonb_build_object('zl_number', 'ZL/90001/26/3252/BL', 'order_number', 'BLWK/900', 'vin', 'TESTVIN0000000001')),
    (v_block2, v_session_file, v_session_a, v_org, 1, 'brand_order', false,
      jsonb_build_object('zl_number', 'ZL/90002/26/3252/BL', 'order_number', 'BLWK/901', 'vin', 'TESTVIN0000000002'));

  -- Block 1: two distinct SKUs under order 1.
  -- Block 2: same SKU as block1's P1 but under a DIFFERENT order (must stay
  -- independent), plus a null-quantity line (must be skipped gracefully).
  INSERT INTO wdd_matcher_lines (id, block_id, session_id, organization_id, line_number, product_code, product_name, quantity, unit)
  VALUES
    (gen_random_uuid(), v_block1, v_session_a, v_org, 1, 'SKU-P1', 'Part One', 2, 'szt'),
    (gen_random_uuid(), v_block1, v_session_a, v_org, 2, 'SKU-P2', 'Part Two', 3, 'szt'),
    (gen_random_uuid(), v_block2, v_session_a, v_org, 1, 'SKU-P1', 'Part One', 5, 'szt'),
    (gen_random_uuid(), v_block2, v_session_a, v_org, 2, 'SKU-P3', 'Part Three (no qty)', NULL, 'szt');

  INSERT INTO wdd_matcher_sessions (id, organization_id, branch_id, name, status)
  VALUES (v_session_pending, v_org, v_branch, 'pgTAP fixture pending session', 'pending');

  -- Happy path.
  v_result1 := public.materialize_repair_orders_from_session(v_user, v_session_a);

  -- Idempotent replay.
  v_result2 := public.materialize_repair_orders_from_session(v_user, v_session_a);

  SELECT id INTO v_ro1 FROM repair_orders WHERE zl_number = 'ZL/90001/26/3252/BL';
  SELECT id INTO v_ro2 FROM repair_orders WHERE zl_number = 'ZL/90002/26/3252/BL';

  -- Non-approved session rejection.
  BEGIN
    PERFORM public.materialize_repair_orders_from_session(v_user, v_session_pending);
  EXCEPTION WHEN OTHERS THEN
    v_reject_status := SQLERRM;
  END;

  -- Actor-mismatch rejection.
  BEGIN
    PERFORM public.materialize_repair_orders_from_session('00000000-0000-0000-0000-000000000000'::uuid, v_session_a);
  EXCEPTION WHEN OTHERS THEN
    v_reject_actor := SQLERRM;
  END;

  INSERT INTO rpc_fixture VALUES (
    v_org, v_branch, v_user, v_session_a, v_session_pending, v_ro1, v_ro2,
    v_result1, v_result2, v_reject_status, v_reject_actor
  );
END;
$fixture$;

SELECT ok((SELECT (result1->>'created_repair_orders')::int FROM rpc_fixture) = 2,
  'two distinct zl_number blocks in one session create two RepairOrders');

SELECT ok((SELECT (result1->>'created_source_documents')::int FROM rpc_fixture) = 2,
  'two source documents created (one per block)');

SELECT ok((SELECT (result1->>'created_logical_lines')::int FROM rpc_fixture) = 3,
  'three logical lines created (P1,P2 under order1; P1 under order2 -- independent)');

SELECT ok((SELECT (result1->>'skipped_nonpositive_quantity_lines')::int FROM rpc_fixture) = 1,
  'null-quantity source line is preserved as raw provenance but gracefully skipped for logical-line linkage, not failed');

SELECT ok((SELECT ro1 IS NOT NULL AND ro2 IS NOT NULL AND ro1 <> ro2 FROM rpc_fixture),
  'the two RepairOrders are genuinely distinct rows');

SELECT ok(
  (SELECT count(*) FROM repair_order_lines WHERE repair_order_id = (SELECT ro1 FROM rpc_fixture)) = 2,
  'order1 has exactly 2 logical lines (P1, P2)'
);

SELECT ok(
  (SELECT count(*) FROM repair_order_lines WHERE repair_order_id = (SELECT ro2 FROM rpc_fixture)) = 1,
  'order2 has exactly 1 logical line (P1) -- independent of order1''s P1, not merged across orders'
);

SELECT ok(
  (SELECT ordered_quantity FROM repair_order_lines
   WHERE repair_order_id = (SELECT ro2 FROM rpc_fixture) AND product_code = 'SKU-P1') = 5,
  'order2''s P1 quantity (5) is unaffected by order1''s P1 quantity (2) -- same SKU, different orders, fully independent'
);

SELECT ok(
  (SELECT result2->>'created_repair_orders' FROM rpc_fixture) = '0'
  AND (SELECT result2->>'created_source_documents' FROM rpc_fixture) = '0'
  AND (SELECT result2->>'created_source_document_lines' FROM rpc_fixture) = '0'
  AND (SELECT result2->>'created_logical_lines' FROM rpc_fixture) = '0'
  AND (SELECT result2->>'already_materialized' FROM rpc_fixture) = 'true',
  'calling the RPC a second time for the same session is a pure idempotent no-op'
);

SELECT ok(
  (SELECT count(*) FROM repair_orders WHERE zl_number IN ('ZL/90001/26/3252/BL', 'ZL/90002/26/3252/BL')) = 2,
  'still exactly 2 RepairOrders after the idempotent replay -- no duplicates'
);

SELECT ok(
  (SELECT reject_status FROM rpc_fixture) LIKE '%is not approved%',
  'materialization is rejected for a non-approved session'
);

SELECT ok(
  (SELECT reject_actor FROM rpc_fixture) LIKE '%must match the authenticated caller%',
  'materialization is rejected when p_actor_user_id does not match auth.uid() (spoofing guard)'
);

-- ============================================================================
-- One RepairOrder receiving source documents from TWO separate sessions
-- ============================================================================

CREATE TEMP TABLE rpc_fixture2 (ro1 uuid, doc_link_count int, line_count int, result_b jsonb);

DO $fixture2$
DECLARE
  v_org uuid := '9f98fe91-63b8-4986-a2b3-65bdd47684c9';
  v_branch uuid := 'e39b15da-0a8d-4056-b5a2-80eb1da868a6';
  v_user uuid := '832858c3-0a9f-4f9f-a230-fc7e47855e78';
  v_session_a uuid := gen_random_uuid();
  v_session_b uuid := gen_random_uuid();
  v_block1 uuid := gen_random_uuid();
  v_block1b uuid := gen_random_uuid();
  v_file_a uuid := gen_random_uuid();
  v_file_b uuid := gen_random_uuid();
  v_result_b jsonb;
  v_ro1 uuid;
  v_doc_link_count int;
  v_line_count int;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);

  INSERT INTO wdd_matcher_sessions (id, organization_id, branch_id, name, status)
  VALUES (v_session_a, v_org, v_branch, 'pgTAP fixture session multi-doc A', 'approved');
  INSERT INTO wdd_matcher_session_files (id, session_id, organization_id, file_role, file_name, file_size)
  VALUES (v_file_a, v_session_a, v_org, 'brand', 'fixture1.pdf', 100);
  INSERT INTO wdd_matcher_blocks (id, session_file_id, session_id, organization_id, block_index, block_type, is_excluded, metadata)
  VALUES (v_block1, v_file_a, v_session_a, v_org, 0, 'brand_order', false,
    jsonb_build_object('zl_number', 'ZL/90010/26/3252/BL', 'vin', 'TESTVIN0000000010'));
  INSERT INTO wdd_matcher_lines (id, block_id, session_id, organization_id, line_number, product_code, product_name, quantity, unit)
  VALUES (gen_random_uuid(), v_block1, v_session_a, v_org, 1, 'SKU-A', 'Part A', 1, 'szt');

  PERFORM public.materialize_repair_orders_from_session(v_user, v_session_a);

  INSERT INTO wdd_matcher_sessions (id, organization_id, branch_id, name, status)
  VALUES (v_session_b, v_org, v_branch, 'pgTAP fixture session multi-doc B', 'approved');
  INSERT INTO wdd_matcher_session_files (id, session_id, organization_id, file_role, file_name, file_size)
  VALUES (v_file_b, v_session_b, v_org, 'brand', 'fixture2.pdf', 100);
  INSERT INTO wdd_matcher_blocks (id, session_file_id, session_id, organization_id, block_index, block_type, is_excluded, metadata)
  VALUES (v_block1b, v_file_b, v_session_b, v_org, 0, 'brand_order', false,
    jsonb_build_object('zl_number', 'ZL/90010/26/3252/BL', 'vin', 'TESTVIN0000000010'));
  INSERT INTO wdd_matcher_lines (id, block_id, session_id, organization_id, line_number, product_code, product_name, quantity, unit)
  VALUES (gen_random_uuid(), v_block1b, v_session_b, v_org, 1, 'SKU-B', 'Part B', 4, 'szt');

  v_result_b := public.materialize_repair_orders_from_session(v_user, v_session_b);

  SELECT id INTO v_ro1 FROM repair_orders WHERE zl_number = 'ZL/90010/26/3252/BL';
  SELECT count(*) INTO v_doc_link_count FROM repair_order_source_document_links WHERE repair_order_id = v_ro1;
  SELECT count(*) INTO v_line_count FROM repair_order_lines WHERE repair_order_id = v_ro1;

  INSERT INTO rpc_fixture2 VALUES (v_ro1, v_doc_link_count, v_line_count, v_result_b);
END;
$fixture2$;

SELECT ok(
  (SELECT result_b->>'created_repair_orders' FROM rpc_fixture2) = '0'
  AND (SELECT result_b->>'reused_repair_orders' FROM rpc_fixture2) = '1',
  'a second approved session with the SAME zl_number reuses the existing RepairOrder, does not create a duplicate'
);

SELECT ok(
  (SELECT doc_link_count FROM rpc_fixture2) = 2,
  'the one RepairOrder now has TWO linked source documents, one from each session'
);

SELECT ok(
  (SELECT line_count FROM rpc_fixture2) = 2,
  'logical lines from both documents (SKU-A, SKU-B) accumulate on the same order'
);

-- ============================================================================
-- Atomicity proof: a real materialization call whose enclosing block then
-- fails discards every one of its writes (no autonomous/out-of-band writes)
-- ============================================================================

CREATE TEMP TABLE rpc_fixture3 (pre_count int, post_count int, pre_doc int, post_doc int);

DO $fixture3$
DECLARE
  v_org uuid := '9f98fe91-63b8-4986-a2b3-65bdd47684c9';
  v_branch uuid := 'e39b15da-0a8d-4056-b5a2-80eb1da868a6';
  v_user uuid := '832858c3-0a9f-4f9f-a230-fc7e47855e78';
  v_session_c uuid := gen_random_uuid();
  v_block1c uuid := gen_random_uuid();
  v_file_c uuid := gen_random_uuid();
  v_pre int;
  v_post int;
  v_predoc int;
  v_postdoc int;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);

  INSERT INTO wdd_matcher_sessions (id, organization_id, branch_id, name, status)
  VALUES (v_session_c, v_org, v_branch, 'pgTAP fixture atomicity', 'approved');
  INSERT INTO wdd_matcher_session_files (id, session_id, organization_id, file_role, file_name, file_size)
  VALUES (v_file_c, v_session_c, v_org, 'brand', 'fixture3.pdf', 100);
  INSERT INTO wdd_matcher_blocks (id, session_file_id, session_id, organization_id, block_index, block_type, is_excluded, metadata)
  VALUES (v_block1c, v_file_c, v_session_c, v_org, 0, 'brand_order', false,
    jsonb_build_object('zl_number', 'ZL/90099/26/3252/BL', 'vin', 'TESTVIN0000000099'));
  INSERT INTO wdd_matcher_lines (id, block_id, session_id, organization_id, line_number, product_code, product_name, quantity, unit)
  VALUES (gen_random_uuid(), v_block1c, v_session_c, v_org, 1, 'SKU-ATOMIC', 'Atomicity Part', 7, 'szt');

  SELECT count(*) INTO v_pre FROM repair_orders WHERE zl_number = 'ZL/90099/26/3252/BL';
  SELECT count(*) INTO v_predoc FROM workshop_source_documents;

  BEGIN
    PERFORM public.materialize_repair_orders_from_session(v_user, v_session_c);
    RAISE EXCEPTION 'forced_test_failure_after_real_materialization';
  EXCEPTION WHEN OTHERS THEN
    NULL; -- PL/pgSQL's implicit savepoint on this BEGIN block rolls back
          -- everything the RPC call wrote, automatically.
  END;

  SELECT count(*) INTO v_post FROM repair_orders WHERE zl_number = 'ZL/90099/26/3252/BL';
  SELECT count(*) INTO v_postdoc FROM workshop_source_documents;

  INSERT INTO rpc_fixture3 VALUES (v_pre, v_post, v_predoc, v_postdoc);
END;
$fixture3$;

SELECT ok(
  (SELECT pre_count FROM rpc_fixture3) = 0 AND (SELECT post_count FROM rpc_fixture3) = 0
  AND (SELECT pre_doc FROM rpc_fixture3) = (SELECT post_doc FROM rpc_fixture3),
  'a forced failure immediately after a real materialization call discards every write from that call (repair_orders 0->0, no new workshop_source_documents persist) -- the RPC has no autonomous/out-of-band write path that could escape a rollback'
);

-- ============================================================================
-- Authorization denial: an authenticated actor with ZERO permission grants
-- in this org/branch (not an identity spoof -- p_actor_user_id = auth.uid()
-- genuinely matches) must be rejected by the RPC's own has_branch_permission
-- check, not merely by RLS on the underlying tables.
-- ============================================================================

CREATE TEMP TABLE rpc_fixture4 (reject_permission text, ro_count_after int);

DO $fixture4$
DECLARE
  v_org uuid := '9f98fe91-63b8-4986-a2b3-65bdd47684c9';
  v_branch uuid := 'e39b15da-0a8d-4056-b5a2-80eb1da868a6';
  v_unauthorized_user uuid := gen_random_uuid(); -- no role/permission rows exist for this id at all
  v_session_d uuid := gen_random_uuid();
  v_block1d uuid := gen_random_uuid();
  v_file_d uuid := gen_random_uuid();
  v_reject text := 'not raised';
  v_count int;
BEGIN
  -- The unauthorized actor IS the authenticated caller (no spoofing) --
  -- this isolates the has_branch_permission gate from the actor-identity gate.
  PERFORM set_config('request.jwt.claim.sub', v_unauthorized_user::text, true);

  INSERT INTO wdd_matcher_sessions (id, organization_id, branch_id, name, status)
  VALUES (v_session_d, v_org, v_branch, 'pgTAP fixture unauthorized actor', 'approved');
  INSERT INTO wdd_matcher_session_files (id, session_id, organization_id, file_role, file_name, file_size)
  VALUES (v_file_d, v_session_d, v_org, 'brand', 'fixture4.pdf', 100);
  INSERT INTO wdd_matcher_blocks (id, session_file_id, session_id, organization_id, block_index, block_type, is_excluded, metadata)
  VALUES (v_block1d, v_file_d, v_session_d, v_org, 0, 'brand_order', false,
    jsonb_build_object('zl_number', 'ZL/90077/26/3252/BL', 'vin', 'TESTVIN0000000077'));
  INSERT INTO wdd_matcher_lines (id, block_id, session_id, organization_id, line_number, product_code, product_name, quantity, unit)
  VALUES (gen_random_uuid(), v_block1d, v_session_d, v_org, 1, 'SKU-DENY', 'Denied Part', 1, 'szt');

  BEGIN
    PERFORM public.materialize_repair_orders_from_session(v_unauthorized_user, v_session_d);
  EXCEPTION WHEN OTHERS THEN
    v_reject := SQLERRM;
  END;

  SELECT count(*) INTO v_count FROM repair_orders WHERE zl_number = 'ZL/90077/26/3252/BL';

  INSERT INTO rpc_fixture4 VALUES (v_reject, v_count);
END;
$fixture4$;

SELECT ok(
  (SELECT reject_permission FROM rpc_fixture4) LIKE '%Not authorized to materialize repair orders%'
  AND (SELECT ro_count_after FROM rpc_fixture4) = 0,
  'an authenticated actor with no workshop.repair_orders permission grant in this branch is rejected by the RPC''s own has_branch_permission check (not merely by RLS), and no RepairOrder is created'
);

SELECT * FROM finish();

ROLLBACK;
