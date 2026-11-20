-- ============================================================================
-- TEST: Chat -- reactions and GIF messages (20261120090000_chat_reactions_and_gifs.sql)
-- ============================================================================
-- Users of "Diff Org name": A (e2e), B; X is a member of another organization only.
--   - anon cannot react; the media check is internal
--   - a member reacts; the same reaction twice is stored once; removing it clears the emoji
--   - an outsider cannot react; a bad emoji is refused
--   - a GIF from a known host is sent without text; a GIF from another host is refused
--   - deleting a message clears its reactions and GIF; a deleted message takes no reactions
-- Everything rolls back.

BEGIN;

SELECT plan(7);

CREATE TEMP TABLE fx (org uuid, a uuid, b uuid, x uuid);
GRANT SELECT ON fx TO authenticated;
INSERT INTO fx VALUES (
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9',
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4', '832858c3-0a9f-4f9f-a230-fc7e47855e78',
  '627c6636-0c0b-45f4-a224-149e88677737'
);

CREATE TEMP TABLE results (k text, v jsonb);
CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON results TO authenticated;

CREATE FUNCTION pg_temp.act_as(p_user uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
CREATE FUNCTION pg_temp.attempt(p_key text, p_sql text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  INSERT INTO results VALUES (p_key, '"ok"');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO results VALUES (p_key, to_jsonb(SQLSTATE));
END $$;

INSERT INTO test_log (line) SELECT ok(
  NOT has_function_privilege('anon', 'public.chat_react(uuid,text,boolean)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public._chat_valid_media(jsonb)', 'EXECUTE'),
  'anon cannot react; the media check is internal'
);

SET LOCAL ROLE authenticated;
SELECT pg_temp.act_as(a) FROM fx;
INSERT INTO results SELECT 'conv', to_jsonb(public.chat_open_direct(org, b)) FROM fx;
INSERT INTO results SELECT 'm1', to_jsonb(public.chat_send(
  (SELECT v #>> '{}' FROM results WHERE k = 'conv')::uuid, '150 reakcje'));

-- B reacts twice with the same emoji, A once; then B takes it back
SELECT pg_temp.act_as(b) FROM fx;
INSERT INTO results SELECT 'r1', to_jsonb(public.chat_react(
  (SELECT (v ->> 'id')::uuid FROM results WHERE k = 'm1'), '👍', true));
INSERT INTO results SELECT 'r2', to_jsonb(public.chat_react(
  (SELECT (v ->> 'id')::uuid FROM results WHERE k = 'm1'), '👍', true));
SELECT pg_temp.attempt('bad_emoji', format('SELECT public.chat_react(%L, %L, true)',
  (SELECT v ->> 'id' FROM results WHERE k = 'm1'), 'a b'));
SELECT pg_temp.act_as(a) FROM fx;
INSERT INTO results SELECT 'r3', to_jsonb(public.chat_react(
  (SELECT (v ->> 'id')::uuid FROM results WHERE k = 'm1'), '❤️', true));
SELECT pg_temp.act_as(b) FROM fx;
INSERT INTO results SELECT 'r4', to_jsonb(public.chat_react(
  (SELECT (v ->> 'id')::uuid FROM results WHERE k = 'm1'), '👍', false));
SELECT pg_temp.act_as(x) FROM fx;
SELECT pg_temp.attempt('x_react', format('SELECT public.chat_react(%L, %L, true)',
  (SELECT v ->> 'id' FROM results WHERE k = 'm1'), '👍'));

-- GIFs
SELECT pg_temp.act_as(a) FROM fx;
INSERT INTO results SELECT 'gif', to_jsonb(public.chat_send(
  p_conversation_id => (SELECT v #>> '{}' FROM results WHERE k = 'conv')::uuid,
  p_body_plain => '',
  p_media => '{"kind":"gif","provider":"klipy","id":"7","url":"https://static.klipy.com/ii/a/b.gif","width":300,"height":200}'::jsonb));
SELECT pg_temp.attempt('gif_bad_host', format(
  'SELECT public.chat_send(p_conversation_id => %L, p_body_plain => %L, p_media => %L::jsonb)',
  (SELECT v #>> '{}' FROM results WHERE k = 'conv'), '',
  '{"kind":"gif","provider":"klipy","id":"7","url":"https://evil.test/b.gif","width":300,"height":200}'));

-- Delete clears reactions and the GIF
INSERT INTO results SELECT 'gif_react', to_jsonb(public.chat_react(
  (SELECT (v ->> 'id')::uuid FROM results WHERE k = 'gif'), '😂', true));
INSERT INTO results SELECT 'gif_deleted', to_jsonb(public.chat_delete_message(
  (SELECT (v ->> 'id')::uuid FROM results WHERE k = 'gif')));
SELECT pg_temp.attempt('react_deleted', format('SELECT public.chat_react(%L, %L, true)',
  (SELECT v ->> 'id' FROM results WHERE k = 'gif'), '👍'));

RESET ROLE;

INSERT INTO test_log (line) SELECT ok(
  (SELECT v -> 'reactions' FROM results WHERE k = 'r2') = jsonb_build_object('👍',
    jsonb_build_array((SELECT b::text FROM fx))),
  'the same reaction twice is stored once'
);
INSERT INTO test_log (line) SELECT ok(
  (SELECT v -> 'reactions' FROM results WHERE k = 'r4') = jsonb_build_object('❤️',
    jsonb_build_array((SELECT a::text FROM fx))),
  'removing the last reaction of an emoji drops the emoji; others stay'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT string_agg(v #>> '{}', ',' ORDER BY k) FROM results WHERE k IN ('bad_emoji', 'x_react')),
  '22023,42501', 'a bad emoji is refused; an outsider cannot react'
);
INSERT INTO test_log (line) SELECT ok(
  (SELECT v ->> 'body_plain' = '' AND v -> 'media' ->> 'kind' = 'gif' FROM results WHERE k = 'gif'),
  'a GIF from the provider is sent without text'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT v #>> '{}' FROM results WHERE k = 'gif_bad_host'), '22023', 'a GIF from another host is refused'
);
INSERT INTO test_log (line) SELECT ok(
  (SELECT v -> 'reactions' = '{}'::jsonb AND v -> 'media' = 'null'::jsonb FROM results WHERE k = 'gif_deleted')
    AND (SELECT v #>> '{}' FROM results WHERE k = 'react_deleted') = '42501',
  'deleting clears reactions and the GIF; a deleted message takes no reactions'
);

DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 150 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
