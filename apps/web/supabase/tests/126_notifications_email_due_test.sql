-- ============================================================================
-- TEST: Notifications N3 -- e-mail queue (claim / done) and task due reminders
-- ============================================================================
-- Users of "Diff Org name": A (e2e), B.
--   - clients cannot call the queue or the reminder functions
--   - the claim returns only notifications that are unread, older than 10 minutes,
--     younger than 36 hours and of a type sent by e-mail by default
--   - a claimed notification is not handed out twice; a failed send frees it,
--     a successful one closes it for good
--   - the claimed row carries the recipient's address and the actor
--   - quiet hours: inside / outside, over midnight, switched off, unreadable
--   - a task due today reminds its assignee once per day; closed tasks do not
-- Everything rolls back.

BEGIN;

SELECT plan(11);

CREATE TEMP TABLE fx (org uuid, branch uuid, a uuid, b uuid, target uuid,
                      n_ok uuid, n_type uuid, n_fresh uuid, n_read uuid, n_old uuid,
                      t_due uuid, t_done uuid, t_later uuid);
INSERT INTO fx VALUES (
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9', '92c5d9f5-0568-4a90-bf56-09ca298c5fe3',
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4', '832858c3-0a9f-4f9f-a230-fc7e47855e78',
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
);

CREATE TEMP TABLE results (k text, v jsonb);
CREATE TEMP TABLE test_log (seq serial, line text);

INSERT INTO test_log (line) SELECT ok(
  NOT has_function_privilege('authenticated', 'public.notifications_email_claim(integer)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.notifications_email_done(uuid[],boolean)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.notifications_task_due_run(boolean)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.notifications_email_claim(integer)', 'EXECUTE')
    AND has_function_privilege('service_role', 'public.notifications_email_claim(integer)', 'EXECUTE'),
  'only the service role can use the e-mail queue; nobody calls the reminder run'
);

-- B's e-mail settings must not decide this test: neutral defaults for the transaction
UPDATE user_preferences SET notification_settings = '{}'::jsonb WHERE user_id = (SELECT b FROM fx);

INSERT INTO notifications (id, organization_id, recipient_id, actor_id, type, target_type, target_id, title, created_at, read_at)
SELECT n_ok,    org, b, a, 'mention', 'planning.task', target, '126 do wysłania', now() - interval '11 minutes', NULL::timestamptz FROM fx
UNION ALL SELECT n_type,  org, b, a, 'comment', 'planning.task', target, '126 typ bez e-maila', now() - interval '11 minutes', NULL::timestamptz FROM fx
UNION ALL SELECT n_fresh, org, b, a, 'mention', 'planning.task', target, '126 za świeże', now() - interval '1 minute', NULL::timestamptz FROM fx
UNION ALL SELECT n_read,  org, b, a, 'mention', 'planning.task', target, '126 przeczytane', now() - interval '11 minutes', now() FROM fx
UNION ALL SELECT n_old,   org, b, a, 'mention', 'planning.task', target, '126 za stare', now() - interval '40 hours', NULL FROM fx;

CREATE FUNCTION pg_temp.mine(p jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM jsonb_array_elements(p) item
  WHERE item ->> 'target_id' = (SELECT target::text FROM fx);
$$;

INSERT INTO results SELECT 'claim1', pg_temp.mine(public.notifications_email_claim(500));
INSERT INTO results SELECT 'claim2', pg_temp.mine(public.notifications_email_claim(500));
SELECT public.notifications_email_done(ARRAY[(SELECT n_ok FROM fx)], false);
INSERT INTO results SELECT 'claim3', pg_temp.mine(public.notifications_email_claim(500));
SELECT public.notifications_email_done(ARRAY[(SELECT n_ok FROM fx)], true);
UPDATE notifications SET email_claimed_at = NULL WHERE id = (SELECT n_ok FROM fx);
INSERT INTO results SELECT 'claim4', pg_temp.mine(public.notifications_email_claim(500));

INSERT INTO test_log (line) SELECT is(
  (SELECT jsonb_agg(item ->> 'id') FROM results, jsonb_array_elements(v) item WHERE k = 'claim1'),
  (SELECT jsonb_build_array(n_ok::text) FROM fx),
  'the claim returns only the unread, 10-minute-old notification of an e-mailed type'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT (v -> 0 -> 'recipient' ->> 'user_id') || '|' || (v -> 0 -> 'actor' ->> 'user_id')
          || '|' || ((v -> 0 -> 'recipient' ->> 'email') IS NOT NULL)::text
   FROM results WHERE k = 'claim1'),
  (SELECT b::text || '|' || a::text || '|true' FROM fx),
  'the claimed row carries the recipient (with address) and the actor'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT jsonb_array_length(v) FROM results WHERE k = 'claim2'), 0,
  'a claimed notification is not handed out twice'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT jsonb_array_length(v) FROM results WHERE k = 'claim3'), 1,
  'a failed send frees the notification for the next run'
);
INSERT INTO test_log (line) SELECT ok(
  (SELECT jsonb_array_length(v) FROM results WHERE k = 'claim4') = 0
    AND (SELECT emailed_at IS NOT NULL FROM notifications WHERE id = (SELECT n_ok FROM fx)),
  'a sent notification is never claimed again'
);

-- Quiet hours around "now" in Warsaw
CREATE FUNCTION pg_temp.quiet(p_from interval, p_to interval, p_enabled boolean DEFAULT true)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('quietHours', jsonb_build_object(
    'enabled', p_enabled, 'timezone', 'Europe/Warsaw',
    'start', to_char((now() AT TIME ZONE 'Europe/Warsaw')::time + p_from, 'HH24:MI'),
    'end',   to_char((now() AT TIME ZONE 'Europe/Warsaw')::time + p_to, 'HH24:MI')));
$$;
INSERT INTO test_log (line) SELECT ok(
  public._notification_in_quiet_hours(pg_temp.quiet('-2 hours', '2 hours'))
    AND NOT public._notification_in_quiet_hours(pg_temp.quiet('2 hours', '4 hours')),
  'quiet hours: inside the window, outside the window'
);
INSERT INTO test_log (line) SELECT ok(
  -- 20 hours long, started 2 hours ago: wraps over midnight whatever the time of day
  public._notification_in_quiet_hours(pg_temp.quiet('-2 hours', '18 hours'))
    AND NOT public._notification_in_quiet_hours(pg_temp.quiet('-2 hours', '2 hours', false))
    AND NOT public._notification_in_quiet_hours('{"quietHours": {"enabled": true, "start": "x", "end": "07:00"}}')
    AND NOT public._notification_in_quiet_hours(NULL),
  'quiet hours: long window, switched off, unreadable, missing'
);

-- Tasks: due today (open), due today (completed), due in three days
INSERT INTO planning_tasks (id, organization_id, branch_id, title, created_by, assigned_to, task_number, status, due_at)
SELECT t_due, org, branch, '126 na dziś', a, b, 'PT-126001', 'open', now() FROM fx
UNION ALL SELECT t_done, org, branch, '126 zamknięte', a, b, 'PT-126002', 'completed', now() FROM fx
UNION ALL SELECT t_later, org, branch, '126 później', a, b, 'PT-126003', 'open', now() + interval '3 days' FROM fx;

SELECT public.notifications_task_due_run(true);
SELECT public.notifications_task_due_run(true);

INSERT INTO test_log (line) SELECT is(
  (SELECT count(*) FROM notifications WHERE type = 'task.due' AND target_id = (SELECT t_due FROM fx)
     AND recipient_id = (SELECT b FROM fx) AND target_code = 'PT-126001' AND actor_id IS NULL),
  1::bigint, 'a task due today reminds its assignee once, however often the run repeats'
);
INSERT INTO test_log (line) SELECT is(
  (SELECT count(*) FROM notifications WHERE type = 'task.due'
     AND target_id IN ((SELECT t_done FROM fx), (SELECT t_later FROM fx))),
  0::bigint, 'closed tasks and tasks due another day do not remind'
);
INSERT INTO test_log (line) SELECT is(
  public.notifications_task_due_run(false) > 0,
  extract(hour FROM now() AT TIME ZONE 'Europe/Warsaw') = 0,
  'the scheduled run acts only in the first hour after midnight (Warsaw)'
);

DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 126 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
