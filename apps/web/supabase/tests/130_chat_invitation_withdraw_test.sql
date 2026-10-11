-- ============================================================================
-- TEST: Chat -- withdrawing a group invitation
-- ============================================================================
-- Users of "Diff Org name": A (e2e, owner), B, C.
--   - anon cannot call the RPC
--   - a member who neither invited nor owns the group cannot withdraw
--   - the owner withdraws: the invitation disappears for the invited person, who can
--     no longer accept it; withdrawing twice is refused; a system line is written
--   - the person can be invited again; the inviter (not the owner) withdraws their own invitation
-- Everything rolls back.

BEGIN;

SELECT plan(6);

CREATE TEMP TABLE fx (org uuid, a uuid, b uuid, c uuid);
GRANT SELECT ON fx TO authenticated;
INSERT INTO fx VALUES (
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9',
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4', '832858c3-0a9f-4f9f-a230-fc7e47855e78',
  '434e3138-d810-46a1-864b-b59ed5660dc5'
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
  NOT has_function_privilege('anon', 'public.chat_invitation_withdraw(uuid,uuid)', 'EXECUTE'),
  'anon cannot withdraw invitations'
);

SET LOCAL ROLE authenticated;
SELECT pg_temp.act_as(a) FROM fx;
INSERT INTO results SELECT 'group', to_jsonb(public.chat_create_group(org, '130 Magazyn', ARRAY[b, c])) FROM fx;
SELECT pg_temp.act_as(b) FROM fx;
SELECT public.chat_invitation_respond(pg_temp.grp(), true);
-- B: a member, but neither the inviter of C nor the owner
SELECT pg_temp.attempt('b_withdraws', format('SELECT public.chat_invitation_withdraw(%L, %L)', pg_temp.grp(), (SELECT c FROM fx)));

SELECT pg_temp.act_as(a) FROM fx;
SELECT pg_temp.attempt('a_withdraws', format('SELECT public.chat_invitation_withdraw(%L, %L)', pg_temp.grp(), (SELECT c FROM fx)));
SELECT pg_temp.attempt('a_again', format('SELECT public.chat_invitation_withdraw(%L, %L)', pg_temp.grp(), (SELECT c FROM fx)));
INSERT INTO results SELECT 'a_pending', public.chat_pending_invitations(pg_temp.grp());

SELECT pg_temp.act_as(c) FROM fx;
INSERT INTO results SELECT 'c_invites', public.chat_list_invitations(org) FROM fx;
SELECT pg_temp.attempt('c_accepts', format('SELECT public.chat_invitation_respond(%L, true)', pg_temp.grp()));

-- B invites C again and takes it back
SELECT pg_temp.act_as(b) FROM fx;
SELECT public.chat_add_members(pg_temp.grp(), ARRAY[(SELECT c FROM fx)]);
INSERT INTO results SELECT 'b_pending', public.chat_pending_invitations(pg_temp.grp());
SELECT pg_temp.attempt('b_own', format('SELECT public.chat_invitation_withdraw(%L, %L)', pg_temp.grp(), (SELECT c FROM fx)));

RESET ROLE;

INSERT INTO test_log (line) SELECT is(
  (SELECT v #>> '{}' FROM results WHERE k = 'b_withdraws'), '42501',
  'a member who neither invited nor owns the group cannot withdraw'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT string_agg(v #>> '{}', ',' ORDER BY k) FROM results WHERE k IN ('a_withdraws', 'a_again')),
  '42501,ok', 'the owner withdraws once; a second time there is nothing to withdraw'
);
INSERT INTO test_log (line) SELECT ok(
  (SELECT jsonb_array_length(v) = 0 FROM results WHERE k = 'a_pending')
    AND (SELECT jsonb_array_length(v) = 0 FROM results WHERE k = 'c_invites')
    AND (SELECT v #>> '{}' FROM results WHERE k = 'c_accepts') = '42501',
  'a withdrawn invitation is gone for everyone and cannot be accepted'
);
INSERT INTO test_log (line) SELECT ok(
  (SELECT v -> 0 ->> 'user_id' = (SELECT c::text FROM fx) AND v -> 0 ->> 'invited_by' = (SELECT b::text FROM fx)
   FROM results WHERE k = 'b_pending')
    AND (SELECT v #>> '{}' FROM results WHERE k = 'b_own') = 'ok',
  'the person can be invited again, and the inviter withdraws their own invitation'
);
INSERT INTO test_log (line) SELECT ok(
  (SELECT count(*) FROM chat_messages WHERE conversation_id = pg_temp.grp()
     AND system_event ->> 'action' = 'withdrawn') = 2
    AND NOT EXISTS (SELECT 1 FROM chat_members WHERE conversation_id = pg_temp.grp() AND user_id = (SELECT c FROM fx)),
  'each withdrawal writes a system line; the person never became a member'
);

DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 130 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
