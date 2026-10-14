-- ============================================================================
-- TEST: object_mentions -- where an object is mentioned, through the caller's RLS
-- ============================================================================
-- Users of "Diff Org name": A (e2e), B, C; X is a member of another organization only.
--   - anon cannot execute the function
--   - a task description, a comment and a chat message mentioning the object are found;
--     a mention of another object, or of a person with the same id, is not
--   - the chat message shows only to members of that conversation
--   - a user of another organization gets nothing
-- Everything rolls back.

BEGIN;

SELECT plan(5);

CREATE TEMP TABLE fx (org uuid, branch uuid, a uuid, b uuid, c uuid, x uuid,
                      obj uuid, other uuid, task uuid, task_other uuid);
GRANT SELECT ON fx TO authenticated;
INSERT INTO fx VALUES (
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9', '92c5d9f5-0568-4a90-bf56-09ca298c5fe3',
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4', '832858c3-0a9f-4f9f-a230-fc7e47855e78',
  '434e3138-d810-46a1-864b-b59ed5660dc5', '627c6636-0c0b-45f4-a224-149e88677737',
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
);

CREATE TEMP TABLE results (k text, v jsonb);
CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON results TO authenticated;

CREATE FUNCTION pg_temp.act_as(p_user uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
CREATE FUNCTION pg_temp.doc(p_type text, p_id uuid) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('type', 'doc', 'content', jsonb_build_array(
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
      jsonb_build_object('type', 'text', 'text', 'zobacz '),
      jsonb_build_object('type', 'mention',
        'attrs', jsonb_build_object('type', p_type, 'id', p_id, 'label', 'x'))))));
$$;
CREATE FUNCTION pg_temp.sources(p_key text) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(item ->> 'source', ',' ORDER BY item ->> 'source'), '')
  FROM results, jsonb_array_elements(v) item WHERE k = p_key;
$$;

INSERT INTO test_log (line) SELECT ok(
  NOT has_function_privilege('anon', 'public.object_mentions(uuid,text,uuid)', 'EXECUTE'),
  'anon cannot execute object_mentions'
);

-- A: a task mentioning the object, one mentioning another object, one "mentioning" a
-- person with the object's id; a comment; a 1:1 chat message with B
SELECT pg_temp.act_as(a) FROM fx;
INSERT INTO planning_tasks (id, organization_id, branch_id, title, created_by, assigned_to, task_number, status, description_rich)
SELECT task, org, branch, '132 Zadanie ze wzmianką', a, b, 'PT-132001', 'open', pg_temp.doc('repairOrder', obj) FROM fx
UNION ALL SELECT task_other, org, branch, '132 Inny obiekt', a, b, 'PT-132002', 'open', pg_temp.doc('repairOrder', other) FROM fx
UNION ALL SELECT gen_random_uuid(), org, branch, '132 Osoba o tym samym id', a, b, 'PT-132003', 'open', pg_temp.doc('person', obj) FROM fx;
INSERT INTO app_comments (org_id, target_type, target_id, body_plain, body_rich, created_by, kind, visibility)
SELECT org, 'planning.task', task_other, '132 komentarz ze wzmianką', pg_temp.doc('repairOrder', obj), a, 'comment', 'default' FROM fx;

SET LOCAL ROLE authenticated;
INSERT INTO results SELECT 'conv', to_jsonb(public.chat_open_direct(org, b)) FROM fx;
SELECT public.chat_send((SELECT (v #>> '{}')::uuid FROM results WHERE k = 'conv'), '132 @zlecenie', NULL, NULL, '{}'::uuid[],
  jsonb_build_array(jsonb_build_object('type', 'repairOrder', 'id', (SELECT obj FROM fx))));

INSERT INTO results SELECT 'a', public.object_mentions(org, 'repairOrder', obj) FROM fx;
SELECT pg_temp.act_as(c) FROM fx;
INSERT INTO results SELECT 'c', public.object_mentions(org, 'repairOrder', obj) FROM fx;
SELECT pg_temp.act_as(x) FROM fx;
INSERT INTO results SELECT 'x', public.object_mentions(org, 'repairOrder', obj) FROM fx;
RESET ROLE;

INSERT INTO test_log (line) SELECT is(
  pg_temp.sources('a'), 'chat,comment,task',
  'a task description, a comment and a chat message are found — and nothing else'
);
INSERT INTO test_log (line) SELECT ok(
  (SELECT bool_and(
     CASE item ->> 'source'
       WHEN 'task' THEN item ->> 'code' = 'PT-132001'
       WHEN 'comment' THEN item ->> 'code' = 'PT-132002' AND item ->> 'target_type' = 'planning.task'
                           AND item ->> 'snippet' = '132 komentarz ze wzmianką'
       WHEN 'chat' THEN item ->> 'conversation_id' = (SELECT v #>> '{}' FROM results WHERE k = 'conv')
     END)
   FROM results, jsonb_array_elements(v) item WHERE k = 'a'),
  'each row says where it is: the task, the comment''s task, the conversation'
);
INSERT INTO test_log (line) SELECT is(
  pg_temp.sources('c'), 'comment,task',
  'a chat message shows only to members of that conversation'
);
INSERT INTO test_log (line) SELECT is(
  pg_temp.sources('x'), '', 'a user of another organization gets nothing'
);

DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 132 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
