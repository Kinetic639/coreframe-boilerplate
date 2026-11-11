-- ============================================================================
-- TEST: Chat -- a group everyone has left is closed
-- ============================================================================
-- Users of "Diff Org name": A (e2e), B, C.
--   - the owner leaving hands the group to the longest-standing member (unchanged)
--   - the last member leaving closes the group: it is marked deleted, nobody is an
--     active member, the history is unreadable for the former members
--   - invitations still waiting lapse: gone from the invited person's list, and
--     accepting one is refused — nobody walks into an empty group
--   - safety net: joining a group that has no owner makes that person its owner
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
CREATE FUNCTION pg_temp.grp(p_key text DEFAULT 'group') RETURNS uuid LANGUAGE sql AS $$
  SELECT (v #>> '{}')::uuid FROM results WHERE k = p_key;
$$;
CREATE FUNCTION pg_temp.attempt(p_key text, p_sql text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  INSERT INTO results VALUES (p_key, '"ok"');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO results VALUES (p_key, to_jsonb(SQLSTATE));
END $$;

SET LOCAL ROLE authenticated;

-- A creates a group inviting B and C; B joins, C does not answer
SELECT pg_temp.act_as(a) FROM fx;
INSERT INTO results SELECT 'group', to_jsonb(public.chat_create_group(org, '131 Magazyn', ARRAY[b, c])) FROM fx;
SELECT public.chat_send(pg_temp.grp(), '131 historia');
SELECT pg_temp.act_as(b) FROM fx;
SELECT public.chat_invitation_respond(pg_temp.grp(), true);

-- The owner leaves: B takes over, the group lives on
SELECT pg_temp.act_as(a) FROM fx;
SELECT public.chat_remove_member(pg_temp.grp(), (SELECT a FROM fx));
RESET ROLE;
INSERT INTO results SELECT 'after_owner_left', to_jsonb(
  (SELECT m.user_id::text || ':' || m.role || ':' || (c.deleted_at IS NULL)::text
   FROM chat_members m JOIN chat_conversations c ON c.id = m.conversation_id
   WHERE m.conversation_id = pg_temp.grp() AND m.left_at IS NULL));
SET LOCAL ROLE authenticated;

-- The last member leaves
SELECT pg_temp.act_as(b) FROM fx;
SELECT public.chat_remove_member(pg_temp.grp(), (SELECT b FROM fx));
INSERT INTO results SELECT 'b_reads', to_jsonb((SELECT count(*) FROM chat_messages WHERE conversation_id = pg_temp.grp()));
INSERT INTO results SELECT 'b_lists', to_jsonb(EXISTS (
  SELECT 1 FROM public.chat_list_conversations((SELECT org FROM fx)) WHERE id = pg_temp.grp()));

-- C still had an invitation
SELECT pg_temp.act_as(c) FROM fx;
INSERT INTO results SELECT 'c_invites', to_jsonb((
  SELECT count(*) FROM jsonb_array_elements(public.chat_list_invitations((SELECT org FROM fx))) i
  WHERE i ->> 'conversation_id' = pg_temp.grp()::text));
SELECT pg_temp.attempt('c_accepts', format('SELECT public.chat_invitation_respond(%L, true)', pg_temp.grp()));

-- Safety net: a group without an owner (forced here) gets one when someone joins
SELECT pg_temp.act_as(a) FROM fx;
INSERT INTO results SELECT 'group2', to_jsonb(public.chat_create_group(org, '131 Bez właściciela', ARRAY[b])) FROM fx;
RESET ROLE;
UPDATE chat_members SET role = 'member' WHERE conversation_id = pg_temp.grp('group2');
SET LOCAL ROLE authenticated;
SELECT pg_temp.act_as(b) FROM fx;
SELECT public.chat_invitation_respond(pg_temp.grp('group2'), true);

RESET ROLE;

INSERT INTO test_log (line) SELECT is(
  (SELECT v #>> '{}' FROM results WHERE k = 'after_owner_left'), (SELECT b::text || ':owner:true' FROM fx),
  'the owner leaving hands the group to the remaining member'
);
INSERT INTO test_log (line) SELECT ok(
  (SELECT deleted_at IS NOT NULL FROM chat_conversations WHERE id = pg_temp.grp())
    AND NOT EXISTS (SELECT 1 FROM chat_members WHERE conversation_id = pg_temp.grp() AND left_at IS NULL),
  'the last member leaving closes the group'
);
INSERT INTO test_log (line) SELECT ok(
  (SELECT v = '0'::jsonb FROM results WHERE k = 'b_reads')
    AND (SELECT v = 'false'::jsonb FROM results WHERE k = 'b_lists')
    AND (SELECT count(*) FROM chat_messages WHERE conversation_id = pg_temp.grp() AND kind = 'text') = 1,
  'the history stays in the database but former members can neither list nor read it'
);
INSERT INTO test_log (line) SELECT ok(
  (SELECT v = '0'::jsonb FROM results WHERE k = 'c_invites')
    AND (SELECT status FROM chat_invitations WHERE conversation_id = pg_temp.grp() AND user_id = (SELECT c FROM fx)) = 'declined',
  'an invitation still waiting lapses with the group'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT v #>> '{}' FROM results WHERE k = 'c_accepts'), '42501',
  'nobody can accept their way into a closed group'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT role FROM chat_members WHERE conversation_id = pg_temp.grp('group2') AND user_id = (SELECT b FROM fx)),
  'owner', 'joining a group without an owner makes that person its owner'
);

DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 131 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
