-- ============================================================================
-- TEST: IC-7 CLOSING PASS -- Product/Procurement/Audit mutation-RPC closure
-- ============================================================================
-- Covers the 5 mutation functions IC-7 itself explicitly disclosed and
-- deferred (inventory_create_enhanced_product, inventory_create_product_
-- with_default_variant, inventory_create_purchase_order, inventory_create_
-- valuation_snapshot, inventory_create_count_session) plus the 3 read-only
-- functions found to carry unnecessary anon/PUBLIC EXECUTE during this
-- pass's own live classification sweep (inventory_count_session_list,
-- inventory_find_sku_collisions, inventory_convert_quantity).
--
-- LIVE-CONFIRMED pre-fix findings this pass closes:
--   1. Actor-identity spoofing: an authenticated caller holding the
--      correct permission could forge created_by/updated_by to an
--      arbitrary REAL, DIFFERENT user's id on
--      inventory_create_product_with_default_variant (and, via its own
--      internal call, inventory_create_enhanced_product too),
--      inventory_create_purchase_order, and inventory_create_count_session.
--      Reproduced live with a genuine second real user id (not a
--      synthetic UUID, which would only trip an unrelated FK constraint).
--   2. anon/PUBLIC EXECUTE existed on all 8 functions above; the 5
--      mutation functions' own body-level has_permission/
--      has_branch_permission checks DID already correctly reject anon and
--      no-permission callers in every path tested (GRANT EXPOSURE without
--      ACTUAL EXPLOITABILITY through those specific paths) -- still
--      hardened, since a mutation API should never carry anon EXECUTE.
--   3. inventory_convert_quantity had ZERO permission check of any kind
--      (not even a body-level one) and read tenant-scoped conversion-
--      factor configuration data -- a genuine tenant-data exposure to
--      anon, independent of the grant-vs-exploit distinction above (LIVE-
--      CONFIRMED zero TypeScript and zero SQL callers -- effectively dead
--      code, but still reachable).
--
-- DISCLOSED, OUT-OF-SCOPE finding (NOT fixed this pass, business-logic
-- bug not a security bug): inventory_create_valuation_snapshot's own body
-- references a relation, public.inventory_balance_analytics, that does
-- NOT exist in this database (LIVE-CONFIRMED via to_regclass -- returns
-- NULL). This function's body was not touched by this pass (grant-only
-- change), so this is a pre-existing latent defect, not a regression --
-- recorded here rather than silently worked around. Scenario V2 below
-- proves the AUTHORIZATION boundary (permission check) is reached and
-- passes correctly for a legitimate caller; it does not assert full
-- end-to-end success, since that would require fixing the unrelated
-- missing-relation bug, which is out of this pass's own narrow charter.
--
-- Executed live against supabase-target via Supabase MCP.

BEGIN;

SELECT plan(24);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, unit uuid, variant uuid, supplier uuid,
  e2e_user uuid, spoofed_user uuid, no_perm_user uuid
);
GRANT SELECT ON fx TO authenticated, anon;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  'e39b15da-0a8d-4056-b5a2-80eb1da868a6'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid,
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  '434e3138-d810-46a1-864b-b59ed5660dc5'::uuid,
  gen_random_uuid();

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated, anon;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated, anon;

INSERT INTO inventory_suppliers (id, organization_id, name)
SELECT supplier, org, '111-probe-supplier' FROM fx;

-- ===========================================================================
-- Section A: anon EXECUTE denied at the grant level (A1-A8)
-- ===========================================================================
DO $$
DECLARE v_org uuid; v_unit uuid; v_variant uuid; v_supplier uuid; v_branch uuid; v_result jsonb;
BEGIN
  SELECT org, unit, variant, supplier, branch INTO v_org, v_unit, v_variant, v_supplier, v_branch FROM fx;
  SET LOCAL ROLE anon;
  PERFORM set_config('request.jwt.claims', '{}', true);

  BEGIN
    SELECT public.inventory_create_enhanced_product(v_org, jsonb_build_object('name','A1','base_unit_id',v_unit,'sku','A1-SKU')) INTO v_result;
    INSERT INTO test_log(line) SELECT fail('A1: anon create_enhanced_product expected denial, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'A1: anon cannot execute inventory_create_enhanced_product');
  END;

  BEGIN
    SELECT public.inventory_create_product_with_default_variant(v_org, 'A2', 'stocked', v_unit, 'A2-SKU', null, null) INTO v_result;
    INSERT INTO test_log(line) SELECT fail('A2: anon create_product_with_default_variant expected denial, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'A2: anon cannot execute inventory_create_product_with_default_variant');
  END;

  BEGIN
    SELECT public.inventory_create_purchase_order(v_org, v_branch, v_supplier, jsonb_build_array(jsonb_build_object('variant_id', v_variant, 'unit_id', v_unit, 'quantity', 1))) INTO v_result;
    INSERT INTO test_log(line) SELECT fail('A3: anon create_purchase_order expected denial, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'A3: anon cannot execute inventory_create_purchase_order');
  END;

  BEGIN
    SELECT public.inventory_create_valuation_snapshot(v_org, v_branch, current_date) INTO v_result;
    INSERT INTO test_log(line) SELECT fail('A4: anon create_valuation_snapshot expected denial, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'A4: anon cannot execute inventory_create_valuation_snapshot');
  END;

  BEGIN
    SELECT public.inventory_create_count_session(v_org, v_branch, jsonb_build_object('count_type','location','location_ids', jsonb_build_array(gen_random_uuid())), null, null) INTO v_result;
    INSERT INTO test_log(line) SELECT fail('A5: anon create_count_session expected denial, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'A5: anon cannot execute inventory_create_count_session');
  END;

  BEGIN
    PERFORM public.inventory_count_session_list(v_org, v_branch, null, null, 1, 20);
    INSERT INTO test_log(line) SELECT fail('A6: anon count_session_list expected denial, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'A6: anon cannot execute inventory_count_session_list (tenant-sensitive read)');
  END;

  BEGIN
    PERFORM public.inventory_find_sku_collisions(v_org, ARRAY['ANY-SKU'], ARRAY[]::uuid[]);
    INSERT INTO test_log(line) SELECT fail('A7: anon find_sku_collisions expected denial, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'A7: anon cannot execute inventory_find_sku_collisions (tenant-sensitive read)');
  END;

  BEGIN
    PERFORM public.inventory_convert_quantity(v_org, gen_random_uuid(), v_unit, v_unit, 1);
    INSERT INTO test_log(line) SELECT fail('A8: anon convert_quantity expected denial, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'A8: anon cannot execute inventory_convert_quantity (zero-permission-check tenant read, closed this pass)');
  END;

  RESET ROLE;
END $$;

-- ===========================================================================
-- Section N: intentionally-public pure utilities remain callable (unchanged)
-- ===========================================================================
DO $$
DECLARE v_sku text;
BEGIN
  SET LOCAL ROLE anon;
  PERFORM set_config('request.jwt.claims', '{}', true);
  BEGIN
    SELECT public.inventory_build_sku_from_pattern('{PREFIX}-{SEQ}', 'SKU', 'Test Product', 'stocked', 1, 6) INTO v_sku;
    INSERT INTO test_log(line) SELECT is(v_sku IS NOT NULL, true, 'N1: anon CAN still call inventory_build_sku_from_pattern (genuinely pure, no table access, intentionally public)');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT fail('N1: pure utility inventory_build_sku_from_pattern unexpectedly denied to anon: ' || SQLSTATE);
  END;
  RESET ROLE;
END $$;

-- ===========================================================================
-- Section F/G: actor-identity spoof + NULL rejected (authenticated, permission-holding)
-- ===========================================================================
DO $$
DECLARE
  v_org uuid; v_unit uuid; v_variant uuid; v_supplier uuid; v_branch uuid;
  v_e2e_user uuid; v_spoofed uuid; v_result jsonb;
BEGIN
  SELECT org, unit, variant, supplier, branch, e2e_user, spoofed_user
    INTO v_org, v_unit, v_variant, v_supplier, v_branch, v_e2e_user, v_spoofed FROM fx;

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_e2e_user::text, 'role', 'authenticated')::text, true);

  BEGIN
    SELECT public.inventory_create_product_with_default_variant(v_org, 'F1', 'stocked', v_unit, 'F1-SKU', null, v_spoofed) INTO v_result;
    INSERT INTO test_log(line) SELECT fail('F1: spoofed actor on create_product_with_default_variant expected rejection, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '28000', 'F1: spoofed actor rejected on inventory_create_product_with_default_variant');
  END;

  BEGIN
    SELECT public.inventory_create_enhanced_product(v_org, jsonb_build_object('name','F2','base_unit_id',v_unit,'sku','F2-SKU'), null, null, null, null, null, null, v_spoofed) INTO v_result;
    INSERT INTO test_log(line) SELECT fail('F2: spoofed actor on create_enhanced_product expected rejection, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '28000', 'F2: spoofed actor rejected on inventory_create_enhanced_product');
  END;

  BEGIN
    SELECT public.inventory_create_purchase_order(v_org, v_branch, v_supplier, jsonb_build_array(jsonb_build_object('variant_id', v_variant, 'unit_id', v_unit, 'quantity', 1)), null, null, null, null, v_spoofed) INTO v_result;
    INSERT INTO test_log(line) SELECT fail('F3: spoofed actor on create_purchase_order expected rejection, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '28000', 'F3: spoofed actor rejected on inventory_create_purchase_order');
  END;

  BEGIN
    SELECT public.inventory_create_count_session(v_org, v_branch, jsonb_build_object('count_type','location','location_ids', jsonb_build_array(gen_random_uuid())), null, v_spoofed) INTO v_result;
    INSERT INTO test_log(line) SELECT fail('F4: spoofed actor on create_count_session expected rejection, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '28000', 'F4: spoofed actor rejected on inventory_create_count_session');
  END;

  BEGIN
    SELECT public.inventory_create_purchase_order(v_org, v_branch, v_supplier, jsonb_build_array(jsonb_build_object('variant_id', v_variant, 'unit_id', v_unit, 'quantity', 1)), null, null, null, null, null) INTO v_result;
    INSERT INTO test_log(line) SELECT fail('G1: NULL actor on create_purchase_order expected rejection, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '28000', 'G1: NULL actor rejected on inventory_create_purchase_order');
  END;

  RESET ROLE;
END $$;

-- ===========================================================================
-- Section H: authenticated, no-permission, real actor -- rejected at the
-- permission check (not the actor check, since the actor id IS genuine)
-- ===========================================================================
DO $$
DECLARE
  v_org uuid; v_unit uuid; v_variant uuid; v_supplier uuid; v_branch uuid;
  v_no_perm uuid; v_result jsonb;
BEGIN
  SELECT org, unit, variant, supplier, branch, no_perm_user
    INTO v_org, v_unit, v_variant, v_supplier, v_branch, v_no_perm FROM fx;

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_no_perm::text, 'role', 'authenticated')::text, true);

  BEGIN
    SELECT public.inventory_create_count_session(v_org, v_branch, jsonb_build_object('count_type','location','location_ids', jsonb_build_array(gen_random_uuid())), null, v_no_perm) INTO v_result;
    INSERT INTO test_log(line) SELECT fail('H1: no-permission create_count_session expected rejection, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0001', 'H1: no-permission (but real-actor) caller rejected on inventory_create_count_session');
  END;

  BEGIN
    SELECT public.inventory_create_purchase_order(v_org, v_branch, v_supplier, jsonb_build_array(jsonb_build_object('variant_id', v_variant, 'unit_id', v_unit, 'quantity', 1)), null, null, null, null, v_no_perm) INTO v_result;
    INSERT INTO test_log(line) SELECT fail('H2: no-permission create_purchase_order expected rejection, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0001', 'H2: no-permission (but real-actor) caller rejected on inventory_create_purchase_order');
  END;

  -- V2: valuation snapshot -- permission check still correctly gates a
  -- no-permission real-actor caller (proves the authz boundary, independent
  -- of the disclosed unrelated missing-relation bug in the legit path below)
  BEGIN
    SELECT public.inventory_create_valuation_snapshot(v_org, v_branch, current_date) INTO v_result;
    INSERT INTO test_log(line) SELECT fail('V1: no-permission create_valuation_snapshot expected rejection, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0001', 'V1: no-permission caller rejected on inventory_create_valuation_snapshot');
  END;

  RESET ROLE;
END $$;

-- ===========================================================================
-- Section I/J/K: legitimate authorized operations still succeed, and
-- created_by/updated_by correctly carry the REAL caller identity (not
-- forgeable per section F above)
-- ===========================================================================
DO $$
DECLARE
  v_org uuid; v_unit uuid; v_variant uuid; v_supplier uuid; v_branch uuid;
  v_e2e_user uuid; v_result jsonb; v_created_by uuid;
BEGIN
  SELECT org, unit, variant, supplier, branch, e2e_user
    INTO v_org, v_unit, v_variant, v_supplier, v_branch, v_e2e_user FROM fx;

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_e2e_user::text, 'role', 'authenticated')::text, true);

  BEGIN
    SELECT public.inventory_create_product_with_default_variant(v_org, 'I1-LEGIT', 'stocked', v_unit, 'I1-SKU', null, v_e2e_user) INTO v_result;
    SELECT created_by INTO v_created_by FROM public.inventory_products WHERE id = (v_result->>'product_id')::uuid;
    INSERT INTO test_log(line) SELECT is(v_created_by, v_e2e_user, 'I1: legitimate create_product_with_default_variant succeeds, created_by = real caller (not forgeable)');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT fail('I1: legitimate create_product_with_default_variant unexpectedly rejected: ' || SQLSTATE || ' ' || SQLERRM);
  END;

  BEGIN
    SELECT public.inventory_create_enhanced_product(v_org, jsonb_build_object('name','I2-LEGIT','base_unit_id',v_unit,'sku','I2-SKU'), null, null, null, null, null, null, v_e2e_user) INTO v_result;
    INSERT INTO test_log(line) SELECT is((v_result ->> 'product_id') IS NOT NULL, true, 'I2: legitimate create_enhanced_product succeeds');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT fail('I2: legitimate create_enhanced_product unexpectedly rejected: ' || SQLSTATE || ' ' || SQLERRM);
  END;

  BEGIN
    SELECT public.inventory_create_purchase_order(v_org, v_branch, v_supplier, jsonb_build_array(jsonb_build_object('variant_id', v_variant, 'unit_id', v_unit, 'quantity', 1)), null, null, null, null, v_e2e_user) INTO v_result;
    SELECT created_by INTO v_created_by FROM public.inventory_purchase_orders WHERE id = (v_result->>'purchase_order_id')::uuid;
    INSERT INTO test_log(line) SELECT is(v_created_by, v_e2e_user, 'J1: legitimate create_purchase_order succeeds, created_by = real caller (not forgeable)');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT fail('J1: legitimate create_purchase_order unexpectedly rejected: ' || SQLSTATE || ' ' || SQLERRM);
  END;

  BEGIN
    SELECT public.inventory_create_count_session(v_org, v_branch, jsonb_build_object('count_type','location','location_ids', jsonb_build_array(gen_random_uuid())), null, v_e2e_user) INTO v_result;
    SELECT created_by INTO v_created_by FROM public.inventory_count_sessions WHERE id = (v_result->>'count_session_id')::uuid;
    INSERT INTO test_log(line) SELECT is(v_created_by, v_e2e_user, 'K1: legitimate create_count_session succeeds, created_by = real caller (not forgeable)');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT fail('K1: legitimate create_count_session unexpectedly rejected: ' || SQLSTATE || ' ' || SQLERRM);
  END;

  -- V2: legitimate, permission-holding caller reaches PAST the authz
  -- boundary for valuation snapshot -- fails on the disclosed, pre-existing,
  -- unrelated missing-relation bug (42P01), proving authz is not the
  -- blocker (distinguishes "denied by design" from "broken dependency").
  BEGIN
    PERFORM public.inventory_create_valuation_snapshot(v_org, v_branch, current_date);
    INSERT INTO test_log(line) SELECT fail('V2: expected the disclosed pre-existing 42P01 missing-relation error, call succeeded instead (bug may have been separately fixed)');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42P01', 'V2: permission-holding caller passes the authz boundary; fails only on the disclosed pre-existing missing-relation bug (out of this pass''s scope)');
  END;

  RESET ROLE;
END $$;

-- ===========================================================================
-- Section: classification-based grant regression (replaces a manually
-- maintained function list) -- no inventory_* writer function (heuristic:
-- name starts with inventory_, not a trigger function, body contains a raw
-- INSERT/UPDATE/DELETE against a public table) may carry anon EXECUTE.
-- This is designed to fail automatically if a FUTURE mutation RPC
-- accidentally inherits anon EXECUTE from the schema-wide default privilege
-- (IC-7's own Option B decision -- see security-evidence.md).
-- ===========================================================================
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname LIKE 'inventory\_%' ESCAPE '\'
    AND p.prorettype <> 'trigger'::regtype
    AND (
      p.prosrc ~* '\minsert\s+into\s+public\.' OR
      p.prosrc ~* '\mupdate\s+public\.' OR
      p.prosrc ~* '\mdelete\s+from\s+public\.'
    )
    AND has_function_privilege('anon', p.oid, 'EXECUTE');
  INSERT INTO test_log(line) SELECT is(v_count, 0, 'GRANT-REGRESSION: zero inventory_* writer functions carry anon EXECUTE (classification-based, not a hardcoded list)');
END $$;

-- Stale overload check for all 8 functions touched this pass
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_proc
  WHERE proname IN (
    'inventory_create_enhanced_product', 'inventory_create_product_with_default_variant',
    'inventory_create_purchase_order', 'inventory_create_valuation_snapshot',
    'inventory_create_count_session', 'inventory_count_session_list',
    'inventory_find_sku_collisions', 'inventory_convert_quantity'
  )
  GROUP BY proname
  HAVING count(*) > 1;
  INSERT INTO test_log(line) SELECT is(coalesce(v_count, 0), 0, 'STALE-OVERLOAD: zero duplicate signatures among the 8 functions touched this pass');
END $$;

SELECT line FROM test_log ORDER BY seq;

ROLLBACK;
