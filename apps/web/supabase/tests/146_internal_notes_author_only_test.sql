-- ============================================================================
-- TEST: internal notes are private to their author
-- ============================================================================
-- Oskar and Kacper both own "Ambra – testy". Oskar writes an internal note on
-- a repair order that @mentions Kacper: only Oskar sees it, Kacper (an owner,
-- a moderator) neither sees nor edits it, and nobody is notified. A normal
-- comment is still seen by both.
-- Executed live against supabase-target via Supabase MCP; everything rolls back.

BEGIN;

SELECT plan(6);

CREATE TEMP TABLE fx (org uuid, branch uuid, oskar uuid, kacper uuid, ro uuid, note uuid);
GRANT SELECT, UPDATE ON fx TO authenticated;
INSERT INTO fx SELECT
  o.id,
  (SELECT b.id FROM branches b WHERE b.organization_id = o.id AND b.branch_number = 1),
  '8ed79598-1fc4-41f7-9ee2-1af621cce960'::uuid,
  'bb263937-97fe-432e-b5b9-2c2bb4b1ddf6'::uuid,
  gen_random_uuid(), null
FROM organizations o WHERE o.slug = 'ambra-testy';

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

INSERT INTO repair_orders (id, organization_id, branch_id, order_number, zl_number, status)
SELECT ro, org, branch, '146-RO', 'ZL/146/26/9101/BL', 'open' FROM fx;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT oskar FROM fx)::text, 'role', 'authenticated')::text, true);

INSERT INTO app_comments (org_id, target_type, target_id, body_plain, body_rich, visibility, kind, created_by)
SELECT org, 'workshop.repair_order', ro, 'notatka 146 @Kacper',
  jsonb_build_object('type', 'doc', 'content', jsonb_build_array(jsonb_build_object(
    'type', 'paragraph', 'content', jsonb_build_array(
      jsonb_build_object('type', 'text', 'text', 'notatka 146 '),
      jsonb_build_object('type', 'mention', 'attrs', jsonb_build_object('type', 'person', 'id', kacper::text, 'label', 'Kacper')))))),
  'internal', 'comment', oskar
FROM fx;
INSERT INTO app_comments (org_id, target_type, target_id, body_plain, visibility, kind, created_by)
SELECT org, 'workshop.repair_order', ro, 'zwykły 146', 'default', 'comment', oskar FROM fx;

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 2 FROM app_comments WHERE target_id = (SELECT ro FROM fx)),
  'T1: the author sees their internal note and the normal comment');

SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT kacper FROM fx)::text, 'role', 'authenticated')::text, true);

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 1 FROM app_comments WHERE target_id = (SELECT ro FROM fx))
  AND (SELECT bool_and(visibility = 'default') FROM app_comments WHERE target_id = (SELECT ro FROM fx)),
  'T2: another owner sees only the normal comment');

WITH changed AS (
  UPDATE app_comments SET body_plain = 'zmienione' WHERE target_id = (SELECT ro FROM fx) AND visibility = 'internal'
  RETURNING id
)
INSERT INTO test_log(line) SELECT is((SELECT count(*)::int FROM changed), 0, 'T3: nor can they edit it');

WITH removed AS (
  DELETE FROM app_comments WHERE target_id = (SELECT ro FROM fx) AND visibility = 'internal'
  RETURNING id
)
INSERT INTO test_log(line) SELECT is((SELECT count(*)::int FROM removed), 0, 'T4: nor delete it');

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 0 FROM notifications
   WHERE recipient_id = (SELECT kacper FROM fx) AND target_id = (SELECT ro FROM fx)),
  'T5: the @mentioned owner gets no notification about the internal note');
RESET ROLE;

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) = 0 FROM notifications n
   WHERE n.target_id = (SELECT ro FROM fx) AND n.data ->> 'visibility' = 'internal'),
  'T6: an internal note notifies nobody');

DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 146 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
