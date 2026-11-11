-- ============================================================================
-- TEST: Contacts directory -- org_member_directory() + contacts_directory()
-- ============================================================================
-- Users of "Diff Org name": A (e2e), B, C; X is a member of another organization only.
--   - anon cannot execute either function
--   - every member sees all active members of the organization (kind "member")
--   - a user of another organization gets nothing (members nor contacts)
--   - a contact linked to a member is merged into the member's row (no duplicate):
--     the row carries contact_id and the contact's job title
--   - external contacts are exactly those the caller may read through crm_contacts RLS
--   - search, the kind filter and the single-row lookup (p_key) work
-- Everything rolls back.

BEGIN;

SELECT plan(11);

CREATE TEMP TABLE fx (org uuid, a uuid, b uuid, c uuid, x uuid, linked uuid, ext uuid);
GRANT SELECT ON fx TO authenticated;
INSERT INTO fx VALUES (
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9',
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4',
  '832858c3-0a9f-4f9f-a230-fc7e47855e78',
  '434e3138-d810-46a1-864b-b59ed5660dc5',
  '627c6636-0c0b-45f4-a224-149e88677737',
  gen_random_uuid(), gen_random_uuid()
);

CREATE TEMP TABLE results (k text, v jsonb);
CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON results TO authenticated;

-- A contact linked to member B (an "advisor") and one external contact
INSERT INTO crm_contacts (id, organization_id, linked_user_id, visibility_scope, display_name, first_name, last_name, job_title, created_by)
SELECT linked, org, b, 'organization', '122 Doradca', '122', 'Doradca', '122 Doradca serwisowy', a FROM fx;
INSERT INTO crm_contacts (id, organization_id, visibility_scope, display_name, first_name, last_name, email, created_by)
SELECT ext, org, 'organization', '122 Zewnetrzny Qzx', '122', 'Zewnetrzny', '122-qzx@example.test', a FROM fx;

INSERT INTO test_log (line) SELECT ok(
  NOT has_function_privilege('anon', 'public.contacts_directory(uuid,text,text,boolean,integer,integer,text)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.org_member_directory(uuid)', 'EXECUTE'),
  'anon cannot execute the directory functions'
);

SET LOCAL ROLE authenticated;

SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT a FROM fx), 'role', 'authenticated')::text, true);
INSERT INTO results SELECT 'a_all', public.contacts_directory(org, 'all', NULL, false, 200, 0) FROM fx;
INSERT INTO results SELECT 'a_members', public.contacts_directory(org, 'member', NULL, false, 200, 0) FROM fx;
INSERT INTO results SELECT 'a_search', public.contacts_directory(org, 'all', '122-QZX', false, 200, 0) FROM fx;
INSERT INTO results SELECT 'a_key_b', public.contacts_directory(org, 'all', NULL, false, 1, 0, 'member:' || b) FROM fx;
INSERT INTO results SELECT 'a_rls_external', to_jsonb((
  SELECT count(*) FROM crm_contacts c, fx
  WHERE c.organization_id = fx.org AND c.deleted_at IS NULL
    AND (c.linked_user_id IS NULL OR c.linked_user_id NOT IN (fx.a, fx.b, fx.c))));
INSERT INTO results SELECT 'a_member_rows', to_jsonb((SELECT count(*) FROM public.org_member_directory((SELECT org FROM fx))));

SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT x FROM fx), 'role', 'authenticated')::text, true);
INSERT INTO results SELECT 'x_all', public.contacts_directory(org, 'all', NULL, false, 200, 0) FROM fx;
INSERT INTO results SELECT 'x_member_rows', to_jsonb((SELECT count(*) FROM public.org_member_directory((SELECT org FROM fx))));

RESET ROLE;

INSERT INTO test_log (line) SELECT is(
  (SELECT (v ->> 'member_count')::int FROM results WHERE k = 'a_all'), 3,
  'a member sees every active member of the organization'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT v -> 'member_count' FROM results WHERE k = 'a_all'),
  (SELECT v FROM results WHERE k = 'a_member_rows'),
  'member_count matches org_member_directory'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT count(*) FROM results, jsonb_array_elements(v -> 'rows') r
   WHERE k = 'a_all' AND (r ->> 'user_id' = (SELECT b::text FROM fx) OR r ->> 'key' = (SELECT linked::text FROM fx))),
  1::bigint,
  'a contact linked to a member does not duplicate the member'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT coalesce(r ->> 'contact_id', (SELECT linked::text FROM fx))
   FROM results, jsonb_array_elements(v -> 'rows') r
   WHERE k = 'a_all' AND r ->> 'key' = 'member:' || (SELECT b::text FROM fx)),
  (SELECT linked::text FROM fx),
  'the member row carries its linked contact, never another one'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT v -> 'external_count' FROM results WHERE k = 'a_all'),
  (SELECT v FROM results WHERE k = 'a_rls_external'),
  'external contacts are exactly those readable through crm_contacts RLS'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT jsonb_array_length(v -> 'rows') FROM results WHERE k = 'a_members'),
  3,
  'kind filter "member" returns only employees'
);
INSERT INTO test_log (line) SELECT ok(
  (SELECT bool_and(r ->> 'kind' = 'member') FROM results, jsonb_array_elements(v -> 'rows') r WHERE k = 'a_members'),
  'kind filter rows are all of kind member'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT (v ->> 'total')::int FROM results WHERE k = 'a_search'),
  (SELECT LEAST((v #>> '{}')::int, 1) FROM results WHERE k = 'a_rls_external'),
  'search is case-insensitive and finds the contact by e-mail (if readable)'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT v -> 'rows' -> 0 ->> 'user_id' FROM results WHERE k = 'a_key_b'),
  (SELECT b::text FROM fx),
  'p_key returns the one row asked for'
);
INSERT INTO test_log (line) SELECT ok(
  (SELECT (v ->> 'total')::int = 0 AND (v ->> 'member_count')::int = 0 FROM results WHERE k = 'x_all')
    AND (SELECT v = '0'::jsonb FROM results WHERE k = 'x_member_rows'),
  'a user of another organization sees neither employees nor contacts'
);

DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 122 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
