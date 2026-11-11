-- ============================================================================
-- TEST: Chat -- group invitations (nobody is added to a group without consent)
-- ============================================================================
-- Users of "Diff Org name": A (e2e), B, C; X is a member of another organization only.
--   - clients cannot write invitations directly; anon cannot call the RPCs
--   - creating a group makes only its creator a member; the others get a pending invitation
--   - an invited person does not see the conversation or its messages until they accept
--   - accepting makes them a member (system line "joined"); the invitation disappears
--   - declining leaves them out; answering twice or without an invitation is refused
--   - "add members" invites as well; inviting a member or an already invited person does nothing
--   - a user of another organization cannot be invited; the invitee sees only their own invitations
-- Everything rolls back.

BEGIN;

SELECT plan(10);

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
CREATE FUNCTION pg_temp.grp() RETURNS uuid LANGUAGE sql AS $$
  SELECT (v #>> '{}')::uuid FROM results WHERE k = 'group';
$$;
CREATE FUNCTION pg_temp.attempt(p_key text, p_sql text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  INSERT INTO results VALUES (p_key, '"ok"');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO results VALUES (p_key, to_jsonb(SQLSTATE));
END $$;

INSERT INTO test_log (line) SELECT ok(
  NOT has_table_privilege('authenticated', 'public.chat_invitations', 'INSERT')
    AND NOT has_table_privilege('authenticated', 'public.chat_invitations', 'UPDATE')
    AND NOT has_function_privilege('anon', 'public.chat_invitation_respond(uuid,boolean)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public._chat_invite(uuid,uuid,uuid[])', 'EXECUTE'),
  'clients cannot write invitations directly; anon cannot answer them'
);

SET LOCAL ROLE authenticated;

-- A creates a group inviting B and C, and writes a message
SELECT pg_temp.act_as(a) FROM fx;
INSERT INTO results SELECT 'group', to_jsonb(public.chat_create_group(org, '129 Magazyn', ARRAY[b, c])) FROM fx;
SELECT public.chat_send(pg_temp.grp(), '129 tylko dla członków');
INSERT INTO results SELECT 'a_pending', public.chat_pending_invitations(pg_temp.grp());
SELECT pg_temp.attempt('invite_outsider', format('SELECT public.chat_add_members(%L, ARRAY[%L]::uuid[])',
  pg_temp.grp(), (SELECT x FROM fx)));
-- Inviting B again changes nothing
SELECT public.chat_add_members(pg_temp.grp(), ARRAY[(SELECT b FROM fx)]);

-- B: invited, not a member yet
SELECT pg_temp.act_as(b) FROM fx;
INSERT INTO results SELECT 'b_invites', public.chat_list_invitations(org) FROM fx;
INSERT INTO results SELECT 'b_sees_before', to_jsonb((SELECT count(*) FROM chat_messages WHERE conversation_id = pg_temp.grp()));
INSERT INTO results SELECT 'b_all_invite_rows', to_jsonb((SELECT count(*) FROM chat_invitations WHERE conversation_id = pg_temp.grp()));
SELECT pg_temp.attempt('b_send_before', format('SELECT public.chat_send(%L, %L)', pg_temp.grp(), 'nie powinno przejść'));
SELECT public.chat_invitation_respond(pg_temp.grp(), true);
INSERT INTO results SELECT 'b_sees_after', to_jsonb((SELECT count(*) FROM chat_messages WHERE conversation_id = pg_temp.grp() AND kind = 'text'));
INSERT INTO results SELECT 'b_invites_after', public.chat_list_invitations(org) FROM fx;
SELECT pg_temp.attempt('b_twice', format('SELECT public.chat_invitation_respond(%L, true)', pg_temp.grp()));

-- C declines; X has no invitation
SELECT pg_temp.act_as(c) FROM fx;
SELECT public.chat_invitation_respond(pg_temp.grp(), false);
INSERT INTO results SELECT 'c_sees', to_jsonb((SELECT count(*) FROM chat_messages WHERE conversation_id = pg_temp.grp()));
SELECT pg_temp.act_as(x) FROM fx;
SELECT pg_temp.attempt('x_accept', format('SELECT public.chat_invitation_respond(%L, true)', pg_temp.grp()));

RESET ROLE;

INSERT INTO test_log (line) SELECT is(
  (SELECT string_agg(m.user_id::text || ':' || m.role, ',' ORDER BY m.joined_at)
   FROM chat_members m WHERE m.conversation_id = pg_temp.grp() AND m.left_at IS NULL),
  (SELECT a::text || ':owner,' || b::text || ':member' FROM fx),
  'members are the creator and the person who accepted — nobody else'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT jsonb_array_length(v) FROM results WHERE k = 'a_pending'), 2,
  'creating a group invites the others instead of adding them'
);
INSERT INTO test_log (line) SELECT ok(
  (SELECT jsonb_array_length(v) = 1 AND v -> 0 ->> 'name' = '129 Magazyn'
          AND v -> 0 -> 'invited_by' ->> 'user_id' = (SELECT a::text FROM fx)
          AND (v -> 0 ->> 'member_count')::int = 1
   FROM results WHERE k = 'b_invites'),
  'the invited person sees the invitation: group, inviter, size (one, not duplicated)'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT string_agg(v #>> '{}', ',' ORDER BY k) FROM results WHERE k IN ('b_sees_before', 'b_send_before', 'b_all_invite_rows')),
  '1,0,42501', 'before accepting: only their own invitation row, no messages, no sending'
);
INSERT INTO test_log (line) SELECT ok(
  (SELECT v = '1'::jsonb FROM results WHERE k = 'b_sees_after')
    AND (SELECT jsonb_array_length(v) = 0 FROM results WHERE k = 'b_invites_after'),
  'after accepting: the messages are readable and the invitation is gone'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT string_agg(v #>> '{}', ',' ORDER BY k) FROM results WHERE k IN ('b_twice', 'x_accept')),
  '42501,42501', 'answering twice or without an invitation is refused'
);
INSERT INTO test_log (line) SELECT ok(
  (SELECT v = '0'::jsonb FROM results WHERE k = 'c_sees')
    AND (SELECT status FROM chat_invitations WHERE conversation_id = pg_temp.grp() AND user_id = (SELECT c FROM fx)) = 'declined',
  'declining leaves the person outside the group'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT v #>> '{}' FROM results WHERE k = 'invite_outsider'), '22023',
  'a user of another organization cannot be invited'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT string_agg(system_event ->> 'action', ',' ORDER BY created_at, id)
   FROM chat_messages WHERE conversation_id = pg_temp.grp() AND kind = 'system'),
  'created,invited,joined,declined', 'the conversation tells the story: created, invited, joined, declined'
);

DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 129 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
