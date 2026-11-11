-- ============================================================================
-- TEST: Chat -- edit and delete own messages
-- ============================================================================
-- Users of "Diff Org name": A (e2e), B; X is a member of another organization only.
--   - anon cannot execute the RPCs
--   - the author edits within 15 minutes: text replaced, edited_at set
--   - nobody else edits or deletes the message (other member, outsider)
--   - an empty edit and an edit after the window are refused
--   - the author deletes: placeholder row with cleared content; deleting twice is harmless
--   - a deleted message cannot be edited
-- Everything rolls back.

BEGIN;

SELECT plan(8);

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
-- Runs a statement and records 'ok' or the SQLSTATE
CREATE FUNCTION pg_temp.attempt(p_key text, p_sql text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  INSERT INTO results VALUES (p_key, '"ok"');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO results VALUES (p_key, to_jsonb(SQLSTATE));
END $$;

INSERT INTO test_log (line) SELECT ok(
  NOT has_function_privilege('anon', 'public.chat_edit_message(uuid,text,jsonb,jsonb)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.chat_delete_message(uuid)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public._chat_broadcast_message_update()', 'EXECUTE'),
  'anon cannot edit or delete; the broadcast helper is internal'
);

SET LOCAL ROLE authenticated;
SELECT pg_temp.act_as(a) FROM fx;
INSERT INTO results SELECT 'conv', to_jsonb(public.chat_open_direct(org, b)) FROM fx;
INSERT INTO results SELECT 'm1', to_jsonb(public.chat_send(
  (SELECT v #>> '{}' FROM results WHERE k = 'conv')::uuid, '127 pierwsza wersja'));
INSERT INTO results SELECT 'm2', to_jsonb(public.chat_send(
  (SELECT v #>> '{}' FROM results WHERE k = 'conv')::uuid, '127 stara wiadomość'));
INSERT INTO results SELECT 'edited', to_jsonb(public.chat_edit_message(
  (SELECT (v ->> 'id')::uuid FROM results WHERE k = 'm1'), '  127 poprawiona  '));
SELECT pg_temp.attempt('a_empty', format('SELECT public.chat_edit_message(%L, %L)',
  (SELECT v ->> 'id' FROM results WHERE k = 'm1'), '   '));

-- Another member and an outsider
SELECT pg_temp.act_as(b) FROM fx;
SELECT pg_temp.attempt('b_edit', format('SELECT public.chat_edit_message(%L, %L)',
  (SELECT v ->> 'id' FROM results WHERE k = 'm1'), 'przejęta'));
SELECT pg_temp.attempt('b_delete', format('SELECT public.chat_delete_message(%L)',
  (SELECT v ->> 'id' FROM results WHERE k = 'm1')));
SELECT pg_temp.act_as(x) FROM fx;
SELECT pg_temp.attempt('x_delete', format('SELECT public.chat_delete_message(%L)',
  (SELECT v ->> 'id' FROM results WHERE k = 'm1')));

-- The second message is now 20 minutes old
RESET ROLE;
UPDATE chat_messages SET created_at = created_at - interval '20 minutes'
WHERE id = (SELECT (v ->> 'id')::uuid FROM results WHERE k = 'm2');
SET LOCAL ROLE authenticated;
SELECT pg_temp.act_as(a) FROM fx;
SELECT pg_temp.attempt('a_late', format('SELECT public.chat_edit_message(%L, %L)',
  (SELECT v ->> 'id' FROM results WHERE k = 'm2'), 'za późno'));

-- The author deletes (twice), then tries to edit
INSERT INTO results SELECT 'deleted', to_jsonb(public.chat_delete_message(
  (SELECT (v ->> 'id')::uuid FROM results WHERE k = 'm1')));
SELECT pg_temp.attempt('a_delete_again', format('SELECT public.chat_delete_message(%L)',
  (SELECT v ->> 'id' FROM results WHERE k = 'm1')));
SELECT pg_temp.attempt('a_edit_deleted', format('SELECT public.chat_edit_message(%L, %L)',
  (SELECT v ->> 'id' FROM results WHERE k = 'm1'), 'wskrzeszona'));

RESET ROLE;

INSERT INTO test_log (line) SELECT ok(
  (SELECT v ->> 'body_plain' = '127 poprawiona' AND v ->> 'edited_at' IS NOT NULL
          AND v ->> 'created_at' = (SELECT v ->> 'created_at' FROM results WHERE k = 'm1')
   FROM results WHERE k = 'edited'),
  'the author edits: trimmed text, edited_at set, created_at kept'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT v #>> '{}' FROM results WHERE k = 'a_empty'), '22023', 'an empty edit is refused'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT string_agg(v #>> '{}', ',' ORDER BY k) FROM results WHERE k IN ('b_edit', 'b_delete', 'x_delete')),
  '42501,42501,42501', 'another member and an outsider can neither edit nor delete'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT v #>> '{}' FROM results WHERE k = 'a_late'), '22023', 'the edit window closes after 15 minutes'
);
INSERT INTO test_log (line) SELECT ok(
  (SELECT v ->> 'deleted_at' IS NOT NULL AND v ->> 'body_plain' = '' AND v -> 'body_rich' = 'null'::jsonb
          AND v -> 'mentions' = '[]'::jsonb
   FROM results WHERE k = 'deleted')
    AND (SELECT v #>> '{}' FROM results WHERE k = 'a_delete_again') = 'ok',
  'the author deletes: a placeholder with cleared content; deleting again is harmless'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT v #>> '{}' FROM results WHERE k = 'a_edit_deleted'), '42501', 'a deleted message cannot be edited'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT body_plain FROM chat_messages WHERE id = (SELECT (v ->> 'id')::uuid FROM results WHERE k = 'm2')),
  '127 stara wiadomość', 'a refused edit leaves the message untouched'
);

DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 127 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
