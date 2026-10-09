-- ============================================================================
-- TEST: Messages (chat) M0 -- tables, RLS, RPCs, realtime topics, attachments
-- ============================================================================
-- Users of "Diff Org name": A (e2e), B, C; X is a member of another organization only.
--   - anon has no EXECUTE on the RPCs; authenticated has no direct INSERT/UPDATE on the tables
--   - chat_open_direct is idempotent (same conversation both ways) and refuses users of
--     another organization
--   - chat_send stores once per client id; empty messages are refused
--   - members see the conversation with an unread count; chat_mark_read clears it
--   - a member of the same organization outside the conversation sees nothing and cannot send
--   - a user of another organization sees nothing
--   - groups: only the owner removes others; a removed member loses access (RLS, topics,
--     attachments target); system messages are written
--   - an empty 1:1 is listed only for the person who opened it
--   - realtime topics: own inbox receive-only, typing for members only, presence per org
-- Everything rolls back.

BEGIN;

SELECT plan(25);

CREATE TEMP TABLE fx (org uuid, a uuid, b uuid, c uuid, x uuid);
GRANT SELECT ON fx TO authenticated;
INSERT INTO fx VALUES (
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9',
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4',
  '832858c3-0a9f-4f9f-a230-fc7e47855e78',
  '434e3138-d810-46a1-864b-b59ed5660dc5',
  '627c6636-0c0b-45f4-a224-149e88677737'
);

CREATE TEMP TABLE results (k text, v jsonb);
CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON results TO authenticated;

CREATE FUNCTION pg_temp.act_as(p_user uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

INSERT INTO test_log (line) SELECT ok(
  NOT has_function_privilege('anon', 'public.chat_send(uuid,text,jsonb,uuid,uuid[],jsonb)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.chat_open_direct(uuid,uuid)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.chat_list_conversations(uuid,integer,timestamptz)', 'EXECUTE'),
  'anon cannot execute the chat RPCs'
);
INSERT INTO test_log (line) SELECT ok(
  NOT has_table_privilege('authenticated', 'public.chat_messages', 'INSERT')
    AND NOT has_table_privilege('authenticated', 'public.chat_members', 'UPDATE')
    AND NOT has_table_privilege('authenticated', 'public.chat_conversations', 'INSERT'),
  'authenticated cannot write the chat tables directly'
);
INSERT INTO test_log (line) SELECT ok(
  NOT has_function_privilege('authenticated', 'public._chat_system_message(uuid,uuid,jsonb)', 'EXECUTE'),
  'internal helpers are not callable'
);

SET LOCAL ROLE authenticated;

-- A opens a 1:1 with B and sends a message twice with the same client id
SELECT pg_temp.act_as(a) FROM fx;
INSERT INTO results SELECT 'direct_ab', to_jsonb(public.chat_open_direct(org, b)) FROM fx;
INSERT INTO results SELECT 'msg1', to_jsonb(public.chat_send(
  (SELECT v #>> '{}' FROM results WHERE k = 'direct_ab')::uuid, 'Cześć, klocki już są?', NULL,
  '00000000-0000-4000-8000-000000000121'::uuid));
INSERT INTO results SELECT 'msg1_retry', to_jsonb(public.chat_send(
  (SELECT v #>> '{}' FROM results WHERE k = 'direct_ab')::uuid, 'Cześć, klocki już są?', NULL,
  '00000000-0000-4000-8000-000000000121'::uuid));
DO $$
BEGIN
  PERFORM public.chat_send((SELECT v #>> '{}' FROM results WHERE k = 'direct_ab')::uuid, '   ');
  INSERT INTO results VALUES ('empty_send', '"accepted"');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO results VALUES ('empty_send', to_jsonb(SQLSTATE));
END $$;
DO $$
BEGIN
  PERFORM public.chat_open_direct((SELECT org FROM fx), (SELECT x FROM fx));
  INSERT INTO results VALUES ('direct_foreign', '"accepted"');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO results VALUES ('direct_foreign', to_jsonb(SQLSTATE));
END $$;
INSERT INTO results SELECT 'topic_inbox_receive', to_jsonb(public.can_use_chat_topic('user:' || a || ':inbox', false)) FROM fx;
INSERT INTO results SELECT 'topic_inbox_send', to_jsonb(public.can_use_chat_topic('user:' || a || ':inbox', true)) FROM fx;
INSERT INTO results SELECT 'topic_presence', to_jsonb(public.can_use_chat_topic('org:' || org || ':presence', true)) FROM fx;
-- An empty 1:1 with C (no message yet)
INSERT INTO results SELECT 'direct_ac', to_jsonb(public.chat_open_direct(org, c)) FROM fx;
-- A group with B and C, owned by A
INSERT INTO results SELECT 'group', to_jsonb(public.chat_create_group(org, '121 Magazyn', ARRAY[b, c])) FROM fx;

-- B: the same 1:1 from the other side, unread count, read receipt
SELECT pg_temp.act_as(b) FROM fx;
INSERT INTO results SELECT 'direct_ba', to_jsonb(public.chat_open_direct(org, a)) FROM fx;
INSERT INTO results SELECT 'b_unread_before', to_jsonb(
  (SELECT unread_count FROM public.chat_list_conversations((SELECT org FROM fx))
   WHERE id = (SELECT v #>> '{}' FROM results WHERE k = 'direct_ab')::uuid));
SELECT public.chat_mark_read((SELECT v #>> '{}' FROM results WHERE k = 'direct_ab')::uuid);
INSERT INTO results SELECT 'b_unread_after', to_jsonb(
  (SELECT unread_count FROM public.chat_list_conversations((SELECT org FROM fx))
   WHERE id = (SELECT v #>> '{}' FROM results WHERE k = 'direct_ab')::uuid));
INSERT INTO results SELECT 'b_topic_a_inbox', to_jsonb(public.can_use_chat_topic('user:' || a || ':inbox', false)) FROM fx;
DO $$
BEGIN
  PERFORM public.chat_remove_member((SELECT v #>> '{}' FROM results WHERE k = 'group')::uuid, (SELECT c FROM fx));
  INSERT INTO results VALUES ('b_removes_c', '"accepted"');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO results VALUES ('b_removes_c', to_jsonb(SQLSTATE));
END $$;

-- C: outside the 1:1 — sees nothing of it and cannot send; sees the group
SELECT pg_temp.act_as(c) FROM fx;
INSERT INTO results SELECT 'c_sees_direct_messages', to_jsonb(
  (SELECT count(*) FROM public.chat_messages WHERE conversation_id = (SELECT v #>> '{}' FROM results WHERE k = 'direct_ab')::uuid));
DO $$
BEGIN
  PERFORM public.chat_send((SELECT v #>> '{}' FROM results WHERE k = 'direct_ab')::uuid, 'wtrącam się');
  INSERT INTO results VALUES ('c_sends_direct', '"accepted"');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO results VALUES ('c_sends_direct', to_jsonb(SQLSTATE));
END $$;
INSERT INTO results SELECT 'c_lists_empty_direct', to_jsonb(EXISTS (
  SELECT 1 FROM public.chat_list_conversations((SELECT org FROM fx))
  WHERE id = (SELECT v #>> '{}' FROM results WHERE k = 'direct_ac')::uuid));
INSERT INTO results SELECT 'c_sees_group_system', to_jsonb(
  (SELECT count(*) FROM public.chat_messages
   WHERE conversation_id = (SELECT v #>> '{}' FROM results WHERE k = 'group')::uuid AND kind = 'system'));
INSERT INTO results SELECT 'c_typing_group', to_jsonb(public.can_use_chat_topic(
  'chat:' || (SELECT v #>> '{}' FROM results WHERE k = 'group') || ':typing', true));

-- A (owner) removes C; C loses access everywhere
SELECT pg_temp.act_as(a) FROM fx;
SELECT public.chat_remove_member((SELECT v #>> '{}' FROM results WHERE k = 'group')::uuid, (SELECT c FROM fx));
SELECT pg_temp.act_as(c) FROM fx;
INSERT INTO results SELECT 'c_after_removal_messages', to_jsonb(
  (SELECT count(*) FROM public.chat_messages WHERE conversation_id = (SELECT v #>> '{}' FROM results WHERE k = 'group')::uuid));
INSERT INTO results SELECT 'c_after_removal_typing', to_jsonb(public.can_use_chat_topic(
  'chat:' || (SELECT v #>> '{}' FROM results WHERE k = 'group') || ':typing', false));
INSERT INTO results SELECT 'c_after_removal_attachments', to_jsonb(public.can_access_comment_target(
  (SELECT org FROM fx), 'chat.conversation', (SELECT v #>> '{}' FROM results WHERE k = 'group')::uuid, 'select', 'default'));

-- B (still a member) may use the group as an attachment target, never moderate
SELECT pg_temp.act_as(b) FROM fx;
INSERT INTO results SELECT 'b_attach_insert', to_jsonb(public.can_access_comment_target(
  (SELECT org FROM fx), 'chat.conversation', (SELECT v #>> '{}' FROM results WHERE k = 'group')::uuid, 'insert', 'default'));
INSERT INTO results SELECT 'b_attach_moderate', to_jsonb(public.can_access_comment_target(
  (SELECT org FROM fx), 'chat.conversation', (SELECT v #>> '{}' FROM results WHERE k = 'group')::uuid, 'moderate', 'default'));

-- X: another organization
SELECT pg_temp.act_as(x) FROM fx;
INSERT INTO results SELECT 'x_lists', to_jsonb((SELECT count(*) FROM public.chat_list_conversations((SELECT org FROM fx))));
INSERT INTO results SELECT 'x_get', coalesce(public.chat_get_conversation((SELECT v #>> '{}' FROM results WHERE k = 'group')::uuid), 'null'::jsonb);

RESET ROLE;

INSERT INTO test_log (line) SELECT is(
  (SELECT v FROM results WHERE k = 'direct_ab'), (SELECT v FROM results WHERE k = 'direct_ba'),
  'chat_open_direct returns the same conversation from both sides'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT v ->> 'id' FROM results WHERE k = 'msg1'), (SELECT v ->> 'id' FROM results WHERE k = 'msg1_retry'),
  'a retried send with the same client id stores the message once'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT count(*) FROM chat_messages WHERE conversation_id = (SELECT v #>> '{}' FROM results WHERE k = 'direct_ab')::uuid),
  1::bigint,
  'exactly one message in the 1:1'
);
INSERT INTO test_log (line) SELECT is((SELECT v #>> '{}' FROM results WHERE k = 'empty_send'), '22023', 'an empty message is refused');
INSERT INTO test_log (line) SELECT is((SELECT v #>> '{}' FROM results WHERE k = 'direct_foreign'), '22023', 'no 1:1 with a user of another organization');
INSERT INTO test_log (line) SELECT is((SELECT v FROM results WHERE k = 'topic_inbox_receive'), 'true'::jsonb, 'own inbox: receive allowed');
INSERT INTO test_log (line) SELECT is((SELECT v FROM results WHERE k = 'topic_inbox_send'), 'false'::jsonb, 'own inbox: clients cannot send to it');
INSERT INTO test_log (line) SELECT is((SELECT v FROM results WHERE k = 'topic_presence'), 'true'::jsonb, 'presence in own organization allowed');
INSERT INTO test_log (line) SELECT is((SELECT v FROM results WHERE k = 'b_unread_before'), '1'::jsonb, 'recipient sees 1 unread');
INSERT INTO test_log (line) SELECT is((SELECT v FROM results WHERE k = 'b_unread_after'), '0'::jsonb, 'chat_mark_read clears the unread count');
INSERT INTO test_log (line) SELECT is((SELECT v FROM results WHERE k = 'b_topic_a_inbox'), 'false'::jsonb, 'another user''s inbox is closed');
INSERT INTO test_log (line) SELECT is((SELECT v #>> '{}' FROM results WHERE k = 'b_removes_c'), '42501', 'a non-owner cannot remove others');
INSERT INTO test_log (line) SELECT is((SELECT v FROM results WHERE k = 'c_sees_direct_messages'), '0'::jsonb, 'a non-member sees no messages (RLS)');
INSERT INTO test_log (line) SELECT is((SELECT v #>> '{}' FROM results WHERE k = 'c_sends_direct'), '42501', 'a non-member cannot send');
INSERT INTO test_log (line) SELECT is((SELECT v FROM results WHERE k = 'c_lists_empty_direct'), 'false'::jsonb, 'an empty 1:1 is not listed for the other person');
INSERT INTO test_log (line) SELECT is((SELECT v FROM results WHERE k = 'c_sees_group_system'), '1'::jsonb, 'group creation writes a system message');
INSERT INTO test_log (line) SELECT is((SELECT v FROM results WHERE k = 'c_typing_group'), 'true'::jsonb, 'group member may use its typing channel');
INSERT INTO test_log (line) SELECT is((SELECT v FROM results WHERE k = 'c_after_removal_messages'), '0'::jsonb, 'removed member loses the history (RLS)');
INSERT INTO test_log (line) SELECT is((SELECT v FROM results WHERE k = 'c_after_removal_typing'), 'false'::jsonb, 'removed member loses the typing channel');
INSERT INTO test_log (line) SELECT is((SELECT v FROM results WHERE k = 'c_after_removal_attachments'), 'false'::jsonb, 'removed member loses the attachments');
INSERT INTO test_log (line) SELECT ok(
  (SELECT v FROM results WHERE k = 'b_attach_insert') = 'true'::jsonb
    AND (SELECT v FROM results WHERE k = 'b_attach_moderate') = 'false'::jsonb,
  'member may add attachments, nobody moderates'
);
INSERT INTO test_log (line) SELECT ok(
  (SELECT v FROM results WHERE k = 'x_lists') = '0'::jsonb
    AND (SELECT v FROM results WHERE k = 'x_get') = 'null'::jsonb,
  'a user of another organization sees nothing'
);

DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 121 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
