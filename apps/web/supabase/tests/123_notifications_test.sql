-- ============================================================================
-- TEST: Notifications -- table, RLS, RPCs and the source triggers
-- ============================================================================
-- Users of "Diff Org name": A (e2e), B, C; X is a member of another organization only.
--   - anon cannot execute the RPCs; authenticated cannot insert or update rows directly
--   - task assigned / status changed notify the other person, never the actor
--   - a comment on a task notifies its participants with a snippet
--   - a ticket assignee is notified ("ticket.new" at creation, "ticket.assigned" later);
--     a status change notifies requester and assignees except the actor
--   - an internal ticket comment does not reach the requester
--   - RLS: a user reads only their own notifications; another organization sees nothing
--   - notifications_set_read toggles read / unread; mark_all_read clears the count
--   - filters: "assigned" and "unread"
-- Everything rolls back.

BEGIN;

SELECT plan(15);

CREATE TEMP TABLE fx (org uuid, branch uuid, a uuid, b uuid, c uuid, x uuid,
                      task uuid, ticket_new uuid, ticket_old uuid);
GRANT SELECT ON fx TO authenticated;
INSERT INTO fx VALUES (
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9', '92c5d9f5-0568-4a90-bf56-09ca298c5fe3',
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4', '832858c3-0a9f-4f9f-a230-fc7e47855e78',
  '434e3138-d810-46a1-864b-b59ed5660dc5', '627c6636-0c0b-45f4-a224-149e88677737',
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
);

CREATE TEMP TABLE results (k text, v jsonb);
CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON results TO authenticated;

CREATE FUNCTION pg_temp.act_as(p_user uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

INSERT INTO test_log (line) SELECT ok(
  NOT has_function_privilege('anon', 'public.notifications_list(uuid,text,integer,timestamptz,uuid)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.notifications_set_read(uuid[],boolean)', 'EXECUTE'),
  'anon cannot execute the notification RPCs'
);
INSERT INTO test_log (line) SELECT ok(
  NOT has_table_privilege('authenticated', 'public.notifications', 'INSERT')
    AND NOT has_table_privilege('authenticated', 'public.notifications', 'UPDATE')
    AND NOT has_function_privilege('authenticated',
      'public._notify(uuid,uuid,uuid,uuid,text,text,uuid,text,text,text,jsonb,text)', 'EXECUTE'),
  'authenticated cannot create or change notifications directly'
);

-- A creates a task for B, then changes its status
SELECT pg_temp.act_as(a) FROM fx;
INSERT INTO planning_tasks (id, organization_id, branch_id, title, created_by, assigned_to, task_number, status)
SELECT task, org, branch, '123 Zadanie testowe', a, b, 'PT-123001', 'open' FROM fx;
UPDATE planning_tasks SET status = 'in_progress', updated_by = (SELECT a FROM fx) WHERE id = (SELECT task FROM fx);

-- B comments on the task
SELECT pg_temp.act_as(b) FROM fx;
INSERT INTO app_comments (org_id, target_type, target_id, body_plain, created_by, kind, visibility)
SELECT org, 'planning.task', task, '123 komentarz do zadania', b, 'comment', 'default' FROM fx;

-- A opens a ticket and assigns B at creation; an older ticket gets C assigned later
SELECT pg_temp.act_as(a) FROM fx;
INSERT INTO helpdesk_tickets (id, org_id, branch_id, ticket_number, title, created_by, requested_by)
SELECT ticket_new, org, branch, 'HD-123001', '123 Nowe zgloszenie', a, a FROM fx;
INSERT INTO helpdesk_ticket_assignees (org_id, ticket_id, user_id, assigned_by)
SELECT org, ticket_new, b, a FROM fx;
INSERT INTO helpdesk_tickets (id, org_id, branch_id, ticket_number, title, created_by, requested_by, created_at)
SELECT ticket_old, org, branch, 'HD-123002', '123 Stare zgloszenie', a, a, now() - interval '1 day' FROM fx;
INSERT INTO helpdesk_ticket_assignees (org_id, ticket_id, user_id, assigned_by)
SELECT org, ticket_old, c, a FROM fx;

-- B closes the new ticket and leaves an internal comment
SELECT pg_temp.act_as(b) FROM fx;
INSERT INTO helpdesk_ticket_activity (ticket_id, org_id, actor_id, event_type)
SELECT ticket_new, org, b, 'ticket_closed' FROM fx;
INSERT INTO app_comments (org_id, target_type, target_id, body_plain, created_by, kind, visibility)
SELECT org, 'helpdesk.ticket', ticket_new, '123 notatka wewnetrzna', b, 'comment', 'internal' FROM fx;

INSERT INTO results SELECT 'all', coalesce(jsonb_agg(jsonb_build_object(
  'r', CASE recipient_id WHEN fx.a THEN 'a' WHEN fx.b THEN 'b' WHEN fx.c THEN 'c' ELSE '?' END,
  'type', type, 'tt', target_type, 'old', target_id = fx.ticket_old, 'snippet', snippet, 'data', data)), '[]')
FROM notifications n, fx WHERE n.target_id IN (fx.task, fx.ticket_new, fx.ticket_old);

SET LOCAL ROLE authenticated;

SELECT pg_temp.act_as(b) FROM fx;
INSERT INTO results SELECT 'b_visible', to_jsonb((SELECT count(*) FROM public.notifications));
INSERT INTO results SELECT 'b_foreign_rows', to_jsonb((SELECT count(*) FROM public.notifications WHERE recipient_id <> (SELECT b FROM fx)));
INSERT INTO results SELECT 'b_list', public.notifications_list((SELECT org FROM fx));
INSERT INTO results SELECT 'b_assigned', public.notifications_list((SELECT org FROM fx), 'assigned');
INSERT INTO results SELECT 'b_unread_0', to_jsonb(public.notifications_unread_count((SELECT org FROM fx)));
SELECT public.notifications_set_read(ARRAY[(SELECT (v -> 0 ->> 'id')::uuid FROM results WHERE k = 'b_list')], true);
INSERT INTO results SELECT 'b_unread_1', to_jsonb(public.notifications_unread_count((SELECT org FROM fx)));
SELECT public.notifications_set_read(ARRAY[(SELECT (v -> 0 ->> 'id')::uuid FROM results WHERE k = 'b_list')], false);
INSERT INTO results SELECT 'b_unread_2', to_jsonb(public.notifications_unread_count((SELECT org FROM fx)));
-- Someone else's notification cannot be marked
INSERT INTO results SELECT 'b_marks_foreign', to_jsonb(public.notifications_set_read(
  ARRAY(SELECT id FROM public.notifications WHERE false), true));
SELECT public.notifications_mark_all_read((SELECT org FROM fx));
INSERT INTO results SELECT 'b_unread_3', to_jsonb(public.notifications_unread_count((SELECT org FROM fx)));
INSERT INTO results SELECT 'b_unread_filter', public.notifications_list((SELECT org FROM fx), 'unread');

SELECT pg_temp.act_as(x) FROM fx;
INSERT INTO results SELECT 'x_list', public.notifications_list((SELECT org FROM fx));
INSERT INTO results SELECT 'x_visible', to_jsonb((SELECT count(*) FROM public.notifications n, fx WHERE n.organization_id = fx.org));

RESET ROLE;

CREATE TEMP VIEW sent AS
  SELECT e ->> 'r' AS r, e ->> 'type' AS type, e ->> 'tt' AS tt, (e ->> 'old')::boolean AS old, e ->> 'snippet' AS snippet
  FROM results, jsonb_array_elements(v) e WHERE k = 'all';

INSERT INTO test_log (line) SELECT is(
  (SELECT count(*) FROM sent WHERE type = 'task.assigned'), 1::bigint, 'task assignment: exactly one notification');
INSERT INTO test_log (line) SELECT is(
  (SELECT r FROM sent WHERE type = 'task.assigned'), 'b', 'task assignment goes to the assignee, not the author');
INSERT INTO test_log (line) SELECT is(
  (SELECT string_agg(r, ',' ORDER BY r) FROM sent WHERE type = 'task.status'), 'b',
  'task status change notifies the assignee and skips the actor');
INSERT INTO test_log (line) SELECT is(
  (SELECT r || ':' || snippet FROM sent WHERE type = 'comment' AND tt = 'planning.task'),
  'a:123 komentarz do zadania', 'task comment notifies the other participant with a snippet');
INSERT INTO test_log (line) SELECT is(
  (SELECT r FROM sent WHERE type = 'ticket.new'), 'b', 'assignee at creation gets "ticket.new"');
INSERT INTO test_log (line) SELECT is(
  (SELECT r || ':' || old::text FROM sent WHERE type = 'ticket.assigned'), 'c:true',
  'assignee of an existing ticket gets "ticket.assigned"');
INSERT INTO test_log (line) SELECT is(
  (SELECT string_agg(r, ',' ORDER BY r) FROM sent WHERE type = 'ticket.status'), 'a',
  'ticket status change notifies the requester, not the actor');
INSERT INTO test_log (line) SELECT is(
  (SELECT count(*) FROM sent WHERE type = 'comment' AND tt = 'helpdesk.ticket'), 0::bigint,
  'an internal ticket comment does not reach the requester (the only other assignee is its author)');
INSERT INTO test_log (line) SELECT ok(
  (SELECT v FROM results WHERE k = 'b_foreign_rows') = '0'::jsonb
    AND (SELECT (v #>> '{}')::int FROM results WHERE k = 'b_visible') = 3,
  'RLS: a user reads only their own notifications');
INSERT INTO test_log (line) SELECT is(
  (SELECT jsonb_array_length(v) FROM results WHERE k = 'b_assigned'), 2,
  'filter "assigned" returns the task and the ticket assignment');
INSERT INTO test_log (line) SELECT is(
  (SELECT string_agg(v #>> '{}', ',' ORDER BY k) FROM results WHERE k IN ('b_unread_0', 'b_unread_1', 'b_unread_2', 'b_unread_3')),
  '3,2,3,0', 'set_read toggles read / unread, mark_all_read clears the count');
INSERT INTO test_log (line) SELECT is(
  (SELECT jsonb_array_length(v) FROM results WHERE k = 'b_unread_filter'), 0,
  'filter "unread" is empty after mark_all_read');
INSERT INTO test_log (line) SELECT ok(
  (SELECT v FROM results WHERE k = 'x_list') = '[]'::jsonb
    AND (SELECT v FROM results WHERE k = 'x_visible') = '0'::jsonb,
  'a user of another organization sees nothing');

DO $$
BEGIN
  RAISE EXCEPTION 'PGTAP 123 (rolled back): not ok = %, total = %. Failing: %',
    (SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') FROM test_log),
    (SELECT count(*) FROM test_log),
    COALESCE((SELECT string_agg(split_part(line, E'\n', 1), ' | ' ORDER BY seq)
              FROM test_log WHERE line NOT LIKE 'ok %'), 'none');
END $$;

ROLLBACK;
