-- ============================================================================
-- TEST: Chat mentions -- "@" of a person in a message notifies them in the bell
-- ============================================================================
-- Users of "Diff Org name": A (e2e), B, C; X is a member of another organization only.
--   - the trigger function is not callable by clients
--   - a mentioned member of the conversation gets one "mention" notification
--     (target chat.conversation, group name as title, message excerpt)
--   - the author, members who were not mentioned and people outside the
--     conversation get nothing; a mentioned object (not a person) notifies nobody
--   - a member removed from the group is no longer notified
--   - a 1:1 mention has an empty title (the app shows the author)
--   - the "mentions" filter of notifications_list returns it; a plain message notifies nobody
-- Everything rolls back.

BEGIN;

SELECT plan(9);

CREATE TEMP TABLE fx (org uuid, a uuid, b uuid, c uuid, x uuid);
GRANT SELECT ON fx TO authenticated;
INSERT INTO fx VALUES (
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9',
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4', '832858c3-0a9f-4f9f-a230-fc7e47855e78',
  '434e3138-d810-46a1-864b-b59ed5660dc5', '627c6636-0c0b-45f4-a224-149e88677737'
);

CREATE TEMP TABLE results (k text, v jsonb);
CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON results TO authenticated;

CREATE FUNCTION pg_temp.act_as(p_user uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
CREATE FUNCTION pg_temp.person(p_user uuid) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('type', 'person', 'id', p_user);
$$;

INSERT INTO test_log (line) SELECT ok(
  NOT has_function_privilege('authenticated', 'public._notify_chat_mentions()', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public._notify_chat_mentions()', 'EXECUTE'),
  'the mention trigger function is not callable by clients'
);

SET LOCAL ROLE authenticated;
SELECT pg_temp.act_as(a) FROM fx;

INSERT INTO results SELECT 'group', to_jsonb(public.chat_create_group(org, '124 Magazyn', ARRAY[b, c])) FROM fx;
INSERT INTO results SELECT 'direct', to_jsonb(public.chat_open_direct(org, b)) FROM fx;

-- Plain message, then: B, the author and an outsider mentioned, plus an object with C's id
INSERT INTO results SELECT 'plain', to_jsonb(public.chat_send(
  (SELECT v #>> '{}' FROM results WHERE k = 'group')::uuid, '124 zwykła wiadomość')) FROM fx;
INSERT INTO results SELECT 'm1', to_jsonb(public.chat_send(
  (SELECT v #>> '{}' FROM results WHERE k = 'group')::uuid, '124 @B zerknij na to', NULL, NULL, '{}'::uuid[],
  jsonb_build_array(pg_temp.person(b), pg_temp.person(b), pg_temp.person(a), pg_temp.person(x),
                    jsonb_build_object('type', 'repairOrder', 'id', c)))) FROM fx;

-- C is removed, then mentioned
SELECT public.chat_remove_member((SELECT v #>> '{}' FROM results WHERE k = 'group')::uuid, c) FROM fx;
INSERT INTO results SELECT 'm2', to_jsonb(public.chat_send(
  (SELECT v #>> '{}' FROM results WHERE k = 'group')::uuid, '124 @C już cię nie ma', NULL, NULL, '{}'::uuid[],
  jsonb_build_array(pg_temp.person(c)))) FROM fx;

-- 1:1 mention
INSERT INTO results SELECT 'm3', to_jsonb(public.chat_send(
  (SELECT v #>> '{}' FROM results WHERE k = 'direct')::uuid, '124 @B prywatnie', NULL, NULL, '{}'::uuid[],
  jsonb_build_array(pg_temp.person(b)))) FROM fx;

SELECT pg_temp.act_as(b) FROM fx;
INSERT INTO results SELECT 'b_mentions', public.notifications_list(org, 'mentions', 50) FROM fx;

RESET ROLE;

CREATE TEMP TABLE made AS
SELECT n.* FROM notifications n
WHERE n.target_type = 'chat.conversation'
  AND n.target_id IN (SELECT (v #>> '{}')::uuid FROM results WHERE k IN ('group', 'direct'));

INSERT INTO test_log (line) SELECT is(
  (SELECT count(*) FROM made WHERE recipient_id = (SELECT b FROM fx)
     AND target_id = (SELECT (v #>> '{}')::uuid FROM results WHERE k = 'group')),
  1::bigint, 'a mentioned member gets exactly one notification (duplicates in the list collapse)'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT type || '|' || title || '|' || snippet || '|' || actor_id::text FROM made
   WHERE recipient_id = (SELECT b FROM fx) AND title <> ''),
  'mention|124 Magazyn|124 @B zerknij na to|' || (SELECT a::text FROM fx),
  'the notification carries type, group name, excerpt and the author'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT data ->> 'message_id' FROM made WHERE recipient_id = (SELECT b FROM fx) AND title <> ''),
  (SELECT v ->> 'id' FROM results WHERE k = 'm1'),
  'the notification points at the message'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT count(*) FROM made WHERE recipient_id = (SELECT a FROM fx)), 0::bigint,
  'the author is not notified about their own mention'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT count(*) FROM made WHERE recipient_id = (SELECT x FROM fx)), 0::bigint,
  'a person outside the conversation is not notified'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT count(*) FROM made WHERE recipient_id = (SELECT c FROM fx)), 0::bigint,
  'an object mention notifies nobody, and a removed member is not notified'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT title FROM made WHERE recipient_id = (SELECT b FROM fx)
     AND target_id = (SELECT (v #>> '{}')::uuid FROM results WHERE k = 'direct')),
  '', 'a 1:1 mention has no title'
);
INSERT INTO test_log (line) SELECT ok(
  (SELECT count(*) FROM results, jsonb_array_elements(v) n
   WHERE k = 'b_mentions' AND n ->> 'target_type' = 'chat.conversation' AND n ->> 'type' = 'mention') = 2
  AND (SELECT count(*) FROM made) = 2,
  'the "mentions" filter lists both; the plain message created nothing'
);

DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 124 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
