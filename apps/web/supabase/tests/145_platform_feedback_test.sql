-- ============================================================================
-- TEST: platform feedback -- who sees and does what
-- ============================================================================
-- A user reports from their organization; another user does not see it; the
-- platform admin sees every report, answers (the reporter is notified), adds
-- an internal note the reporter never sees and sets the status; the reporter
-- cannot set status nor add internal notes; files are recorded only inside
-- the report's own folder.
-- Executed live against supabase-target via Supabase MCP; everything rolls back.

BEGIN;

SELECT plan(10);

CREATE TEMP TABLE fx (
  org uuid, reporter uuid, other uuid, admin uuid, fb uuid
);
GRANT SELECT, UPDATE ON fx TO authenticated;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  '8ed79598-1fc4-41f7-9ee2-1af621cce960'::uuid,
  gen_random_uuid(),
  null;

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

-- A platform admin of its own for the test.
INSERT INTO auth.users (id, email, aud, role)
SELECT admin, '145-admin@example.com', 'authenticated', 'authenticated' FROM fx;
INSERT INTO users (id, email, first_name) SELECT admin, '145-admin@example.com', 'Admin145' FROM fx;
INSERT INTO admin_entitlements (user_id, enabled) SELECT admin, true FROM fx;

SET LOCAL ROLE authenticated;

-- The reporter files a report from their organization.
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT reporter FROM fx)::text, 'role', 'authenticated')::text, true);
UPDATE fx SET fb = (platform_feedback_create('bug', '145 coś nie działa', 'opis 145', NULL,
  (SELECT org FROM fx), NULL, jsonb_build_object('path', '/dashboard/start')) ->> 'id')::uuid;

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 1 FROM platform_feedback WHERE id = (SELECT fb FROM fx)
     AND organization_id = (SELECT org FROM fx) AND status = 'new'),
  'T1: the reporter sees their report, with their organization');

DO $$
BEGIN
  PERFORM platform_feedback_update((SELECT fb FROM fx), 'resolved', NULL);
  INSERT INTO test_log(line) SELECT fail('T2: the reporter must not set the status');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO test_log(line) SELECT pass('T2: the reporter cannot set the status');
END $$;

DO $$
BEGIN
  PERFORM platform_feedback_add_message((SELECT fb FROM fx), 'tajne', NULL, true);
  INSERT INTO test_log(line) SELECT fail('T3: the reporter must not add internal notes');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO test_log(line) SELECT pass('T3: the reporter cannot add internal notes');
END $$;

DO $$
BEGIN
  PERFORM platform_feedback_add_attachment((SELECT fb FROM fx), NULL,
    gen_random_uuid()::text || '/x.png', 'x.png', 'image/png', 10);
  INSERT INTO test_log(line) SELECT fail('T4: a file outside the report folder must be refused');
EXCEPTION WHEN invalid_parameter_value THEN
  INSERT INTO test_log(line) SELECT pass('T4: a file outside the report''s folder is refused');
END $$;

-- Another user sees nothing of it.
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT other FROM fx)::text, 'role', 'authenticated')::text, true);
INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 0 FROM platform_feedback WHERE id = (SELECT fb FROM fx))
  AND platform_feedback_get((SELECT fb FROM fx)) IS NULL,
  'T5: another user neither lists nor opens the report');

-- The platform admin.
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT admin FROM fx)::text, 'role', 'authenticated')::text, true);
INSERT INTO test_log(line) SELECT ok(
  (platform_feedback_list('all', '145 coś') -> 'rows' -> 0 ->> 'id')::uuid = (SELECT fb FROM fx),
  'T6: the platform admin finds the report among all organizations');

SELECT platform_feedback_add_message((SELECT fb FROM fx), 'odpowiedź 145', NULL, false);
SELECT platform_feedback_add_message((SELECT fb FROM fx), 'notatka 145', NULL, true);
SELECT platform_feedback_update((SELECT fb FROM fx), 'in_progress', 'high');

INSERT INTO test_log(line) SELECT ok(
  (SELECT status = 'in_progress' AND priority = 'high' FROM platform_feedback WHERE id = (SELECT fb FROM fx)),
  'T7: the admin sets status and priority');

-- Back to the reporter.
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT reporter FROM fx)::text, 'role', 'authenticated')::text, true);
INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 1 FROM platform_feedback_messages WHERE feedback_id = (SELECT fb FROM fx))
  AND jsonb_array_length(platform_feedback_get((SELECT fb FROM fx)) -> 'messages') = 1,
  'T8: the reporter sees the answer, not the internal note');

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) >= 1 FROM notifications
   WHERE recipient_id = (SELECT reporter FROM fx) AND target_type = 'platform.feedback'
     AND target_id = (SELECT fb FROM fx) AND type = 'feedback.reply'),
  'T9: the reporter is notified about the answer');

INSERT INTO test_log(line) SELECT ok(
  (platform_feedback_list('mine') ->> 'total')::int >= 1,
  'T10: "mine" lists the reporter''s own reports');
RESET ROLE;

DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 145 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
