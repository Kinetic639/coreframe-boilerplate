-- ============================================================================
-- TEST: Ambra Zapytania step 5a -- branch-aware Help Desk RLS (D3, D4, D8)
-- ============================================================================
-- Demo org "Grupa Cichy-Zasada – CNP":
--   presenter  org_owner, org-wide helpdesk.tickets.manage (backward compatibility)
--   helpdesk   org_member (org-wide read/create) + a test branch role with
--              helpdesk.tickets.manage on CNP Poznań only
--   warehouse  org_member only (read/create, no manage) = requester
-- Executed live against supabase-target via Supabase MCP; everything rolls back.

BEGIN;

SELECT plan(17);

CREATE TEMP TABLE fx AS
SELECT
  (SELECT id FROM organizations WHERE name = 'Grupa Cichy-Zasada – CNP') AS org,
  (SELECT id FROM branches WHERE name = 'CNP Poznań' AND deleted_at IS NULL
     AND organization_id = (SELECT id FROM organizations WHERE name = 'Grupa Cichy-Zasada – CNP')) AS poz,
  (SELECT id FROM branches WHERE name = 'CNP Piaseczno' AND deleted_at IS NULL
     AND organization_id = (SELECT id FROM organizations WHERE name = 'Grupa Cichy-Zasada – CNP')) AS pia,
  (SELECT id FROM users WHERE email = 'michal.stepien36+presenter@gmail.com') AS presenter,
  (SELECT id FROM users WHERE email = 'michal.stepien36+helpdesk@gmail.com') AS handler,
  (SELECT id FROM users WHERE email = 'michal.stepien36+warehouse@gmail.com') AS requester,
  gen_random_uuid() AS role_id,
  NULL::uuid AS t_poz,
  NULL::uuid AS t_pia;
GRANT SELECT, UPDATE ON fx TO authenticated;

-- Test-only branch role: helpdesk.tickets.manage on CNP Poznań for the handler.
INSERT INTO roles (id, organization_id, name, is_basic, scope_type, description)
SELECT role_id, org, '119 test obsługa', false, 'branch', 'pgTAP 119' FROM fx;
INSERT INTO role_permissions (role_id, permission_id, allowed)
SELECT fx.role_id, p.id, true FROM fx, permissions p
WHERE p.slug = 'helpdesk.tickets.manage' AND p.deleted_at IS NULL;
INSERT INTO user_role_assignments (user_id, role_id, scope, scope_id)
SELECT handler, role_id, 'branch', poz FROM fx;

SELECT ok(
  EXISTS (SELECT 1 FROM user_effective_permissions u, fx
          WHERE u.user_id = fx.handler AND u.branch_id = fx.poz
            AND u.permission_slug_exact = 'helpdesk.tickets.manage'),
  'branch role compiles to a branch-scoped manage grant'
);

-- Requester files one ticket per branch.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT requester FROM fx)::text, 'role', 'authenticated')::text, true);

UPDATE fx SET t_poz = (public.helpdesk_create_ticket(
  (SELECT org FROM fx), '119 Poznań', 'opis', '{"type":"doc"}'::jsonb, 'open', 'medium',
  NULL, (SELECT poz FROM fx), ARRAY[]::uuid[]) ->> 'id')::uuid;
UPDATE fx SET t_pia = (public.helpdesk_create_ticket(
  (SELECT org FROM fx), '119 Piaseczno', 'opis', '{"type":"doc"}'::jsonb, 'open', 'medium',
  NULL, (SELECT pia FROM fx), ARRAY[]::uuid[]) ->> 'id')::uuid;

SELECT ok((SELECT t_poz IS NOT NULL AND t_pia IS NOT NULL FROM fx),
  'org-wide create grant still creates tickets in any branch');

SELECT throws_ok(
  $$UPDATE helpdesk_tickets SET title = 'zmieniony' WHERE id = (SELECT t_poz FROM fx)$$,
  '42501', NULL, 'requester cannot edit the title of own ticket');

SELECT throws_ok(
  $$UPDATE helpdesk_tickets SET status = 'in_progress' WHERE id = (SELECT t_poz FROM fx)$$,
  '42501', NULL, 'requester cannot move own ticket to in_progress');

-- Handler (branch manager on Poznań only).
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT handler FROM fx)::text, 'role', 'authenticated')::text, true);

WITH u AS (
  UPDATE helpdesk_tickets SET status = 'in_progress', assigned_to = (SELECT handler FROM fx)
  WHERE id = (SELECT t_poz FROM fx) RETURNING id)
SELECT is((SELECT count(*)::int FROM u), 1, 'branch manager takes a ticket of own branch');

WITH u AS (
  UPDATE helpdesk_tickets SET status = 'in_progress'
  WHERE id = (SELECT t_pia FROM fx) RETURNING id)
SELECT is((SELECT count(*)::int FROM u), 0, 'branch manager cannot touch another branch''s ticket');

SELECT ok(
  public.can_access_comment_target((SELECT org FROM fx), 'helpdesk.ticket', (SELECT t_poz FROM fx), 'insert', 'internal'),
  'branch manager may write internal notes in own branch');
SELECT ok(
  NOT public.can_access_comment_target((SELECT org FROM fx), 'helpdesk.ticket', (SELECT t_pia FROM fx), 'select', 'default'),
  'branch manager does not see the thread of another branch''s ticket');

INSERT INTO app_comments (org_id, target_type, target_id, body_plain, visibility, kind, created_by)
SELECT org, 'helpdesk.ticket', t_poz, '119 notatka wewnętrzna', 'internal', 'comment', handler FROM fx;
INSERT INTO app_comments (org_id, target_type, target_id, body_plain, visibility, kind, created_by)
SELECT org, 'helpdesk.ticket', t_poz, '119 odpowiedź', 'default', 'comment', handler FROM fx;

-- Requester again: sees the public reply, never the internal note; may close.
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT requester FROM fx)::text, 'role', 'authenticated')::text, true);

SELECT is(
  (SELECT count(*)::int FROM app_comments WHERE target_id = (SELECT t_poz FROM fx) AND visibility = 'internal'),
  0, 'requester cannot read internal notes');
SELECT is(
  (SELECT count(*)::int FROM app_comments WHERE target_id = (SELECT t_poz FROM fx) AND visibility = 'default'),
  1, 'requester reads the public reply');

WITH u AS (
  UPDATE helpdesk_tickets SET status = 'closed', closed_at = now(), closed_by = (SELECT requester FROM fx)
  WHERE id = (SELECT t_poz FROM fx) RETURNING id)
SELECT is((SELECT count(*)::int FROM u), 1, 'requester closes own ticket');

SELECT throws_ok(
  $$UPDATE helpdesk_tickets SET status = 'cancelled', closed_by = (SELECT presenter FROM fx)
    WHERE id = (SELECT t_pia FROM fx)$$,
  '42501', NULL, 'requester cannot record someone else as closer');

-- A listed acceptor without manage rights may accept (helpdesk_accept_ticket).
UPDATE fx SET t_pia = (public.helpdesk_create_ticket(
  (SELECT org FROM fx), '119 Piaseczno akceptacja', 'opis', '{"type":"doc"}'::jsonb, 'open', 'medium',
  NULL, (SELECT pia FROM fx), ARRAY[]::uuid[], NULL, true, ARRAY[(SELECT handler FROM fx)]) ->> 'id')::uuid;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT handler FROM fx)::text, 'role', 'authenticated')::text, true);
SELECT lives_ok(
  $$SELECT public.helpdesk_accept_ticket((SELECT t_pia FROM fx))$$,
  'acceptor without manage rights in that branch can accept');
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT requester FROM fx)::text, 'role', 'authenticated')::text, true);

-- D8: order lookup for anyone who may file tickets in the order's branch.
SELECT is(
  (SELECT zl_number FROM public.portal_find_repair_order((SELECT org FROM fx), '51658', '3252')),
  'ZL/51658/26/3252/BL', 'portal_find_repair_order returns the full DMS number');
SELECT is(
  (SELECT count(*)::int FROM public.portal_find_repair_order((SELECT org FROM fx), '51658%', '3252')),
  0, 'portal_find_repair_order rejects patterns');

-- Presenter (org-wide manager) keeps full access: backward compatibility.
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT presenter FROM fx)::text, 'role', 'authenticated')::text, true);
WITH u AS (
  UPDATE helpdesk_tickets SET title = '119 Piaseczno (edytowane)' WHERE id = (SELECT t_pia FROM fx) RETURNING id)
SELECT is((SELECT count(*)::int FROM u), 1, 'org-wide manager still edits any ticket');

RESET ROLE;
SELECT ok(
  NOT has_function_privilege('anon', 'public.portal_find_repair_order(uuid, text, text)', 'EXECUTE'),
  'anon cannot execute portal_find_repair_order');

SELECT * FROM finish();
ROLLBACK;
