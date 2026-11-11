-- ============================================================================
-- TEST: Chat -- e-mail about unread messages (queue for the cron endpoint)
-- ============================================================================
-- Users of "Diff Org name": A (e2e), B.
--   - only the service role can use the queue
--   - a message younger than 15 minutes is not claimed
--   - an unread message older than 15 minutes is claimed for the reader (not the
--     author), with the unread count, the last message and its author
--   - one e-mail per unread streak: no second claim until the person reads
--   - a failed send (release) frees it; reading and a new old message claim again
-- Everything rolls back.

BEGIN;

SELECT plan(7);

CREATE TEMP TABLE fx (org uuid, a uuid, b uuid);
GRANT SELECT ON fx TO authenticated;
INSERT INTO fx VALUES (
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9',
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4', '832858c3-0a9f-4f9f-a230-fc7e47855e78'
);

CREATE TEMP TABLE results (k text, v jsonb);
CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON results TO authenticated;

CREATE FUNCTION pg_temp.act_as(p_user uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
CREATE FUNCTION pg_temp.conv() RETURNS uuid LANGUAGE sql AS $$
  SELECT (v #>> '{}')::uuid FROM results WHERE k = 'conv';
$$;
-- Claimed rows of this test's conversation
CREATE FUNCTION pg_temp.claim() RETURNS jsonb LANGUAGE sql AS $$
  SELECT coalesce(jsonb_agg(item), '[]'::jsonb)
  FROM jsonb_array_elements(public.chat_email_claim(500)) item
  WHERE item ->> 'conversation_id' = pg_temp.conv()::text;
$$;
-- A message sent "p_age" ago by the current user
CREATE FUNCTION pg_temp.send_old(p_text text, p_age interval) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  SET LOCAL ROLE authenticated;
  v_id := (public.chat_send(pg_temp.conv(), p_text)).id;
  RESET ROLE;
  UPDATE chat_messages SET created_at = clock_timestamp() - p_age WHERE id = v_id;
END $$;

INSERT INTO test_log (line) SELECT ok(
  NOT has_function_privilege('authenticated', 'public.chat_email_claim(integer)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.chat_email_release(uuid,uuid[])', 'EXECUTE')
    AND has_function_privilege('service_role', 'public.chat_email_claim(integer)', 'EXECUTE'),
  'only the service role can use the chat e-mail queue'
);

UPDATE user_preferences SET notification_settings = '{}'::jsonb WHERE user_id IN (SELECT a FROM fx UNION SELECT b FROM fx);

SELECT pg_temp.act_as(a) FROM fx;
SET LOCAL ROLE authenticated;
INSERT INTO results SELECT 'conv', to_jsonb(public.chat_open_direct(org, b)) FROM fx;
RESET ROLE;
-- Both joined a while ago
UPDATE chat_members SET last_read_at = now() - interval '2 hours', last_emailed_at = NULL
WHERE conversation_id = pg_temp.conv();

SELECT pg_temp.send_old('128 świeża', interval '1 minute');
INSERT INTO results SELECT 'fresh', pg_temp.claim();

SELECT pg_temp.send_old('128 stara', interval '20 minutes');
INSERT INTO results SELECT 'claim1', pg_temp.claim();
INSERT INTO results SELECT 'claim2', pg_temp.claim();

SELECT public.chat_email_release((SELECT b FROM fx), ARRAY[pg_temp.conv()]);
INSERT INTO results SELECT 'after_release', pg_temp.claim();

-- B reads; a new message arrives and gets old
SELECT pg_temp.act_as(b) FROM fx;
SET LOCAL ROLE authenticated;
SELECT public.chat_mark_read(pg_temp.conv());
RESET ROLE;
INSERT INTO results SELECT 'after_read', pg_temp.claim();
SELECT pg_temp.act_as(a) FROM fx;
SELECT pg_temp.send_old('128 kolejna', interval '16 minutes');
-- The mark-read above is "now": move it before the new message
UPDATE chat_members SET last_read_at = now() - interval '30 minutes', last_emailed_at = now() - interval '40 minutes'
WHERE conversation_id = pg_temp.conv() AND user_id = (SELECT b FROM fx);
INSERT INTO results SELECT 'next_streak', pg_temp.claim();

INSERT INTO test_log (line) SELECT is(
  (SELECT jsonb_array_length(v) FROM results WHERE k = 'fresh'), 0,
  'a message younger than 15 minutes is not claimed'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT jsonb_agg(item -> 'recipient' ->> 'user_id') FROM results, jsonb_array_elements(v) item WHERE k = 'claim1'),
  (SELECT jsonb_build_array(b::text) FROM fx),
  'the unread message is claimed for the reader only, not for its author'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT (v -> 0 ->> 'unread_count') || '|' || (v -> 0 -> 'last_message' ->> 'body_plain') || '|'
          || (v -> 0 -> 'last_message' -> 'author' ->> 'user_id') || '|' || (v -> 0 ->> 'kind')
   FROM results WHERE k = 'claim1'),
  (SELECT '2|128 świeża|' || a::text || '|direct' FROM fx),
  'the claim carries the unread count, the newest message and its author'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT jsonb_array_length(v) FROM results WHERE k = 'claim2'), 0,
  'one e-mail per unread streak'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT jsonb_array_length(v) FROM results WHERE k = 'after_release'), 1,
  'a failed send frees the conversation'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT (SELECT jsonb_array_length(v) FROM results WHERE k = 'after_read')::text || ','
       || (SELECT jsonb_array_length(v) FROM results WHERE k = 'next_streak')::text),
  '0,1', 'nothing after reading; a later unread message starts a new streak'
);

DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 128 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
