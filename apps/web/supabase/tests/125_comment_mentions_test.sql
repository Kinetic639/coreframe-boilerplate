-- ============================================================================
-- TEST: Comment mentions -- "@" of a person in a comment notifies them
-- ============================================================================
-- Users of "Diff Org name": A (e2e), B, C; X is a member of another organization only.
--   - the helpers are not callable by clients
--   - a mentioned participant gets ONE notification for the comment, of type "mention"
--     (not "comment" + "mention")
--   - a mentioned person who is not a participant is notified exactly when they may
--     read the target (same rule as RLS: can_access_comment_target evaluated for them)
--   - the author and a user of another organization get nothing
--   - checking another user's access does not change who the caller is
--   - a comment without mentions still notifies participants ("comment")
-- Everything rolls back.

BEGIN;

SELECT plan(8);

CREATE TEMP TABLE fx (org uuid, branch uuid, a uuid, b uuid, c uuid, x uuid, task uuid,
                      c1 uuid, c2 uuid);
GRANT SELECT ON fx TO authenticated;
INSERT INTO fx VALUES (
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9', '92c5d9f5-0568-4a90-bf56-09ca298c5fe3',
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4', '832858c3-0a9f-4f9f-a230-fc7e47855e78',
  '434e3138-d810-46a1-864b-b59ed5660dc5', '627c6636-0c0b-45f4-a224-149e88677737',
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
);

CREATE TEMP TABLE results (k text, v jsonb);
CREATE TEMP TABLE test_log (seq serial, line text);

CREATE FUNCTION pg_temp.act_as(p_user uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
CREATE FUNCTION pg_temp.doc(VARIADIC p_users uuid[]) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('type', 'doc', 'content', jsonb_build_array(
    jsonb_build_object('type', 'paragraph', 'content',
      (SELECT jsonb_agg(jsonb_build_object('type', 'mention',
         'attrs', jsonb_build_object('type', 'person', 'id', u, 'label', 'x'))) FROM unnest(p_users) u))));
$$;

INSERT INTO test_log (line) SELECT ok(
  NOT has_function_privilege('authenticated', 'public._notify_comment_mentions()', 'EXECUTE')
    AND NOT has_function_privilege('authenticated',
      'public._user_can_read_comment_target(uuid,uuid,text,uuid,text)', 'EXECUTE')
    AND NOT has_function_privilege('anon',
      'public._user_can_read_comment_target(uuid,uuid,text,uuid,text)', 'EXECUTE'),
  'the mention helpers are not callable by clients'
);

-- A creates a task for B
SELECT pg_temp.act_as(a) FROM fx;
INSERT INTO planning_tasks (id, organization_id, branch_id, title, created_by, assigned_to, task_number, status)
SELECT task, org, branch, '125 Zadanie testowe', a, b, 'PT-125001', 'open' FROM fx;

-- Whether C (not a participant) may read the task's comments: decides C's notification
SELECT pg_temp.act_as(c) FROM fx;
INSERT INTO results SELECT 'c_can_read',
  to_jsonb(public.can_access_comment_target(org, 'planning.task', task, 'select', 'default')) FROM fx;

-- A mentions B (participant), C, X (other organization) and themselves
SELECT pg_temp.act_as(a) FROM fx;
INSERT INTO app_comments (id, org_id, target_type, target_id, body_plain, body_rich, created_by, kind, visibility)
SELECT c1, org, 'planning.task', task, '125 @B @C zerknijcie', pg_temp.doc(b, c, x, a, b), a, 'comment', 'default' FROM fx;
INSERT INTO results SELECT 'uid_after', to_jsonb(auth.uid());

-- A plain comment
INSERT INTO app_comments (id, org_id, target_type, target_id, body_plain, created_by, kind, visibility)
SELECT c2, org, 'planning.task', task, '125 zwykły komentarz', a, 'comment', 'default' FROM fx;

SELECT set_config('request.jwt.claims', '', true);

CREATE TEMP TABLE made AS
SELECT n.* FROM notifications n WHERE n.target_id = (SELECT task FROM fx) AND n.data ? 'comment_id';

INSERT INTO test_log (line) SELECT is(
  (SELECT string_agg(type, ',') FROM made
   WHERE recipient_id = (SELECT b FROM fx) AND data ->> 'comment_id' = (SELECT c1::text FROM fx)),
  'mention', 'a mentioned participant gets one notification for the comment: the mention'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT target_code || '|' || title || '|' || snippet FROM made
   WHERE recipient_id = (SELECT b FROM fx) AND type = 'mention'),
  'PT-125001|125 Zadanie testowe|125 @B @C zerknijcie',
  'the mention carries the task number, title and an excerpt'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT count(*) FROM made WHERE recipient_id = (SELECT c FROM fx) AND type = 'mention'),
  (SELECT CASE WHEN v = 'true'::jsonb THEN 1 ELSE 0 END::bigint FROM results WHERE k = 'c_can_read'),
  'a mentioned non-participant is notified exactly when they may read the target'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT count(*) FROM made WHERE recipient_id IN ((SELECT a FROM fx), (SELECT x FROM fx))),
  0::bigint, 'the author and a user of another organization get nothing'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT v #>> '{}' FROM results WHERE k = 'uid_after'), (SELECT a::text FROM fx),
  'checking other users'' access leaves the caller''s identity unchanged'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT string_agg(type, ',') FROM made
   WHERE recipient_id = (SELECT b FROM fx) AND data ->> 'comment_id' = (SELECT c2::text FROM fx)),
  'comment', 'a comment without mentions still notifies the participant'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT count(*) FROM made WHERE type = 'mention' AND dedupe_key <> 'comment:' || (data ->> 'comment_id')),
  0::bigint, 'mentions use the per-comment dedupe key'
);

DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 125 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
