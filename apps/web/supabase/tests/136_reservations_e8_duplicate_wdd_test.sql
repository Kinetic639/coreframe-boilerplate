-- ============================================================================
-- TEST: stage E8 -- the same WDD document imported twice (docs/RESERVATIONS_BLOCKS_PLAN.md)
-- ============================================================================
-- Three Matcher sessions carry ZL 136ZL with document ZW/136/26/3332:
--   s1: A x2, B x1        -> imported (repair-order lines A 2, B 1)
--   s2: the same file     -> skipped, reported as document_already_imported
--   s3: same ZW, A x1     -> a split delivery: imported, A becomes 3
-- Executed live against supabase-target via Supabase MCP; everything rolls back.

BEGIN;

SELECT plan(6);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, e2e_user uuid,
  s1 uuid, s2 uuid, s3 uuid, f1 uuid, f2 uuid, f3 uuid, b1 uuid, b2 uuid, b3 uuid,
  m1a uuid, m1b uuid, m2a uuid, m2b uuid, m3a uuid
);
GRANT SELECT ON fx TO authenticated;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid, gen_random_uuid(), 'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

INSERT INTO branches (id, organization_id, name, branch_number) SELECT branch, org, '136-e8-branch', 992 FROM fx;

INSERT INTO wdd_matcher_sessions (id, organization_id, branch_id, name)
SELECT s, org, branch, n FROM fx, LATERAL (VALUES (s1, '136 dostawa 1'), (s2, '136 dostawa 1 (ponownie)'), (s3, '136 dostawa 2')) v(s, n);
INSERT INTO wdd_matcher_session_files (id, session_id, organization_id, file_role, file_name)
SELECT f, s, org, 'brand', 'vw.pdf' FROM fx, LATERAL (VALUES (f1, s1), (f2, s2), (f3, s3)) v(f, s);
INSERT INTO wdd_matcher_blocks (id, session_file_id, session_id, organization_id, block_index, block_type, metadata)
SELECT b, f, s, org, 1, 'brand_order', jsonb_build_object('zl_number', '136ZL', 'zw_number', 'ZW/136/26/3332')
FROM fx, LATERAL (VALUES (b1, f1, s1), (b2, f2, s2), (b3, f3, s3)) v(b, f, s);
INSERT INTO wdd_matcher_lines (id, block_id, session_id, organization_id, line_number, product_code, quantity)
SELECT m, b, s, org, n, c, q FROM fx, LATERAL (VALUES
  (m1a, b1, s1, 1, 'P136A', 2), (m1b, b1, s1, 2, 'P136B', 1),
  (m2a, b2, s2, 1, 'P136A', 2), (m2b, b2, s2, 2, 'P136B', 1),
  (m3a, b3, s3, 1, 'P136A', 1)) v(m, b, s, n, c, q);

CREATE OR REPLACE FUNCTION pg_temp.import(p_session uuid, p_block uuid, p_lines jsonb) RETURNS jsonb LANGUAGE sql AS $fn$
  SELECT repair_orders_import((SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
    jsonb_build_array(jsonb_build_object('zl_number', '136ZL',
      'source', jsonb_build_object('session_id', p_session, 'block_id', p_block), 'lines', p_lines)))
$fn$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);


CREATE TEMP TABLE i1 AS SELECT pg_temp.import((SELECT s1 FROM fx), (SELECT b1 FROM fx), jsonb_build_array(
  jsonb_build_object('product_code', 'P136A', 'product_name', '136 A', 'quantity', 2, 'matcher_line_id', (SELECT m1a FROM fx)),
  jsonb_build_object('product_code', 'P136B', 'product_name', '136 B', 'quantity', 1, 'matcher_line_id', (SELECT m1b FROM fx)))) AS r;
GRANT SELECT ON i1 TO authenticated;
INSERT INTO test_log(line) SELECT is(r->'orders'->0->>'outcome', 'created', 'T1: the first session creates 136ZL') FROM i1;

CREATE TEMP TABLE i2 AS SELECT pg_temp.import((SELECT s2 FROM fx), (SELECT b2 FROM fx), jsonb_build_array(
  jsonb_build_object('product_code', 'P136A', 'product_name', '136 A', 'quantity', 2, 'matcher_line_id', (SELECT m2a FROM fx)),
  jsonb_build_object('product_code', 'P136B', 'product_name', '136 B', 'quantity', 1, 'matcher_line_id', (SELECT m2b FROM fx)))) AS r;
GRANT SELECT ON i2 TO authenticated;
INSERT INTO test_log(line) SELECT ok(
  r->'orders'->0->>'outcome' = 'unchanged' AND r->'orders'->0->>'reason' = 'document_already_imported'
  AND r->'orders'->0->>'earlier_session_name' = '136 dostawa 1' AND r->'orders'->0->>'source_document_number' = 'ZW/136/26/3332',
  'T2: the same document in another session is skipped and reported (with the earlier session)') FROM i2;

INSERT INTO test_log(line) SELECT ok(
  (SELECT string_agg(product_code || '=' || trim_scale(ordered_quantity)::text, ',' ORDER BY product_code)
   FROM repair_order_lines rol JOIN repair_orders ro ON ro.id = rol.repair_order_id
   WHERE ro.branch_id = (SELECT branch FROM fx) AND rol.deleted_at IS NULL) = 'P136A=2,P136B=1',
  'T3: quantities are not doubled (A 2, B 1)');

CREATE TEMP TABLE i3 AS SELECT pg_temp.import((SELECT s3 FROM fx), (SELECT b3 FROM fx), jsonb_build_array(
  jsonb_build_object('product_code', 'P136A', 'product_name', '136 A', 'quantity', 1, 'matcher_line_id', (SELECT m3a FROM fx)))) AS r;
GRANT SELECT ON i3 TO authenticated;
INSERT INTO test_log(line) SELECT is(r->'orders'->0->>'outcome', 'updated', 'T4: a split delivery on the same ZW (other lines) is imported') FROM i3;

INSERT INTO test_log(line) SELECT ok(
  (SELECT string_agg(product_code || '=' || trim_scale(ordered_quantity)::text, ',' ORDER BY product_code)
   FROM repair_order_lines rol JOIN repair_orders ro ON ro.id = rol.repair_order_id
   WHERE ro.branch_id = (SELECT branch FROM fx) AND rol.deleted_at IS NULL) = 'P136A=3,P136B=1',
  'T5: the split delivery adds its quantity (A 3)');
RESET ROLE;

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 2 AND bool_and(source_document_number = 'ZW/136/26/3332') FROM workshop_source_documents
   WHERE branch_id = (SELECT branch FROM fx)),
  'T6: source documents keep their ZW number (two imported documents: s1 and s3)');

DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 136 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
