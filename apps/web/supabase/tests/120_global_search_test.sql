-- ============================================================================
-- TEST: Global search (Ctrl+K) -- search_global()
-- ============================================================================
-- search_global() is SECURITY INVOKER: results come through the caller's RLS. Its candidate
-- lookup search_global_candidates() is SECURITY DEFINER (ids only) and refuses non-members.
--   - anon has no EXECUTE on either function, authenticated has
--   - the candidate lookup returns nothing for an organization the caller is not in
--   - fragment search finds a location and a repair order in the caller's branch
--   - a repair order is found by a part number on its line, typed with spaces/dashes
--   - p_branch limits branch-bound data; another organization returns nothing
--   - LIKE wildcards in the query are literal; p_sources limits the sources
--   - fragments shorter than 3 characters are not searched (no trigram index → full scan)
--   - identifier prefixes (location code, order number, part number on a line) are found
--     through the "C" b-tree tier
-- Everything rolls back.

BEGIN;

SELECT plan(15);

CREATE TEMP TABLE fx (org uuid, foreign_org uuid, branch uuid, other_branch uuid, e2e_user uuid,
                      loc uuid, other_loc uuid, ro uuid);
GRANT SELECT ON fx TO authenticated;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  '2c5aa49a-cc3d-4166-8c5f-f6c94307103f'::uuid,
  gen_random_uuid(), gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

CREATE TEMP TABLE results (k text, r jsonb);
CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON results TO authenticated;

INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch, org, '120-search-branch', 994 FROM fx;
INSERT INTO branches (id, organization_id, name, branch_number)
SELECT other_branch, org, '120-search-other', 993 FROM fx;

INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc, org, branch, '120 Regał szukania', '120-QZX-01', true FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT other_loc, org, other_branch, '120 Regał obcy', '120-QZX-02', true FROM fx;

INSERT INTO repair_orders (id, organization_id, branch_id, zl_number, client_name, status)
SELECT ro, org, branch, '120998', '120 Klient Szukany', 'open' FROM fx;
INSERT INTO repair_order_lines (repair_order_id, product_code, product_name, ordered_quantity, unit)
SELECT ro, '9QZ8077221KGRU', '120 część', 1, 'szt' FROM fx;

INSERT INTO test_log (line) SELECT ok(
  NOT has_function_privilege('anon', 'public.search_global(uuid,uuid,text,text[],integer)', 'EXECUTE'),
  'anon cannot execute search_global'
);
INSERT INTO test_log (line) SELECT ok(
  has_function_privilege('authenticated', 'public.search_global(uuid,uuid,text,text[],integer)', 'EXECUTE'),
  'authenticated can execute search_global'
);
INSERT INTO test_log (line) SELECT ok(
  NOT has_function_privilege('anon', 'public.search_global_candidates(uuid,uuid,text,text,integer)', 'EXECUTE'),
  'anon cannot execute search_global_candidates'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', (SELECT e2e_user FROM fx), 'role', 'authenticated')::text, true);

INSERT INTO results SELECT 'loc', public.search_global(org, branch, 'qzx', ARRAY['locations'], 5) FROM fx;
INSERT INTO results SELECT 'loc_all_branches', public.search_global(org, NULL, 'qzx', ARRAY['locations'], 5) FROM fx;
INSERT INTO results SELECT 'ro_client', public.search_global(org, branch, 'klient szukany', ARRAY['repairOrders'], 5) FROM fx;
INSERT INTO results SELECT 'ro_part', public.search_global(org, branch, '9QZ 807-7221', ARRAY['repairOrders'], 5) FROM fx;
INSERT INTO results SELECT 'foreign', public.search_global(foreign_org, NULL, 'qzx', ARRAY['locations', 'repairOrders'], 5) FROM fx;
INSERT INTO results SELECT 'wildcard', public.search_global(org, branch, '120_QZX', ARRAY['locations'], 5) FROM fx;
INSERT INTO results SELECT 'sources', public.search_global(org, branch, 'qzx', ARRAY['tickets'], 5) FROM fx;
INSERT INTO results SELECT 'short', public.search_global(org, branch, 'qz', ARRAY['locations'], 5) FROM fx;
INSERT INTO results SELECT 'prefix_loc', public.search_global(org, branch, '120-qzx', ARRAY['locations'], 5) FROM fx;
INSERT INTO results SELECT 'prefix_ro', public.search_global(org, branch, '12099', ARRAY['repairOrders'], 5) FROM fx;
INSERT INTO results SELECT 'prefix_part', public.search_global(org, branch, '9qz807', ARRAY['repairOrders'], 5) FROM fx;
-- Demo org locations exist ('R…' codes are common); the caller is not a member there
INSERT INTO results SELECT 'foreign_candidates',
  to_jsonb((SELECT count(*) FROM public.search_global_candidates(foreign_org, NULL, 'reg', 'locations', 50)))
FROM fx;

RESET ROLE;

INSERT INTO test_log (line) SELECT is(
  (SELECT jsonb_path_query_array(r, '$[*].code') FROM results WHERE k = 'loc'),
  '["120-QZX-01"]'::jsonb,
  'fragment finds the location in the given branch only'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT jsonb_array_length(r) FROM results WHERE k = 'loc_all_branches'),
  2,
  'without p_branch both branches are searched'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT r -> 0 ->> 'id' FROM results WHERE k = 'ro_client'),
  (SELECT ro::text FROM fx),
  'repair order found by client name'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT r -> 0 -> 'meta' ->> 'matchedPart' FROM results WHERE k = 'ro_part'),
  '9QZ8077221KGRU',
  'repair order found by a spaced part number on its line'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT r FROM results WHERE k = 'foreign'),
  '[]'::jsonb,
  'another organization returns nothing'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT r FROM results WHERE k = 'wildcard'),
  '[]'::jsonb,
  'underscore is a literal character, not a wildcard'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT r FROM results WHERE k = 'sources'),
  '[]'::jsonb,
  'only the requested sources are searched'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT r FROM results WHERE k = 'short'),
  '[]'::jsonb,
  'fragments shorter than 3 characters are not searched'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT r FROM results WHERE k = 'foreign_candidates'),
  '0'::jsonb,
  'candidate lookup refuses an organization the caller is not a member of'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT jsonb_path_query_array(r, '$[*].code') FROM results WHERE k = 'prefix_loc'),
  '["120-QZX-01"]'::jsonb,
  'location code prefix (case-insensitive) through the "C" b-tree'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT jsonb_path_query_array(r, '$[*].code') FROM results WHERE k = 'prefix_ro'),
  '["120998"]'::jsonb,
  'repair order number prefix'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT r -> 0 -> 'meta' ->> 'matchedPart' FROM results WHERE k = 'prefix_part'),
  '9QZ8077221KGRU',
  'repair order found by a part-number prefix on its line'
);

-- Report the result as an error so it shows up in the SQL Editor (which only displays the
-- last statement); the error also aborts the transaction, so nothing is kept.
DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 120 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
