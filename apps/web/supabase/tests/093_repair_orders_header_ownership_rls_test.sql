-- ============================================================================
-- TEST: repair_orders header ownership/advisor/lifecycle RLS (Zone 3 Phase 7)
-- ============================================================================
-- Verifies the CURRENT, live shape of repair_orders' INSERT/UPDATE policies
-- after:
--   20260910061711_repair_orders_core_schema.sql (base INSERT/SELECT/UPDATE
--   policies -- ownership via advisor_contact_id -> crm_contacts.linked_user_id)
--   20260910074716_repair_orders_archive_rls_restriction.sql (archive
--   requires manage_all, not plain manage_own)
--   20260911172022_repair_orders_insert_advisor_self_restriction.sql (Phase 7
--   -- a manage_own-only actor may only INSERT with advisor_contact_id NULL
--   or their own linked contact, mirroring the existing UPDATE policy)
--   20260911172434_repair_orders_advisor_self_check_fn.sql (Phase 7 -- fixes
--   a CONFIRMED LIVE BUG found while writing THIS test: the ownership
--   subquery `advisor_contact_id IN (SELECT id FROM crm_contacts WHERE
--   linked_user_id = auth.uid())` is a plain correlated subquery, itself
--   subject to crm_contacts' own RLS -- so any manage_own actor who does
--   not ALSO separately hold crm.contacts.read had their own, real
--   ownership silently evaluate to false, a hard self-lockout. Replaced
--   with a SECURITY DEFINER helper, `is_own_advisor_contact()`, matching
--   has_branch_permission's own established pattern of bypassing the
--   underlying table's RLS for this kind of cross-table authorization
--   check.)
--
-- Covers this phase's own stated DB/RLS testing requirement: "advisor with
-- only manage_own cannot edit an order they are not assigned to; advisor
-- with manage_all can edit any in-branch order; advisor ownership does not
-- grant any inventory.* capability (explicit negative test); archiving
-- requires the archive-capable permission, not plain manage_own" -- plus the
-- new Phase 7 INSERT-time advisor-self restriction and the advisor-self-
-- check-function bug fix above.
--
-- Runs as the genuinely-RLS-enforced `authenticated` role (not `postgres`,
-- which bypasses RLS) with a real JWT claim set via request.jwt.claims,
-- using the real, existing dedicated Zone 3 E2E test account. All fixture
-- rows (crm_contacts, repair_orders, and this file's own temp result-log
-- table) are created and asserted against within this transaction and
-- rolled back at the end -- nothing persists. zl_number is left NULL on
-- every fixture row (identity_status stays the DB default 'unresolved')
-- specifically to avoid any risk of colliding with the real, live,
-- persisted demonstration RepairOrder (zl_number = 'ZL/95001/26/3252/BL')
-- or any other real data in this org.
--
-- Implementation note: individual pgTAP assertion results are collected
-- into a temp table (test_log) and selected out as the final statement,
-- rather than relying on each intermediate SELECT's own result set being
-- visible -- the MCP SQL execution path used to run this only surfaces the
-- last statement's result set, not every intermediate one.
--
-- Executed live against supabase-target via Supabase MCP. Last run:
-- 2026-09-11, 12/12 assertions passing.

BEGIN;

SELECT plan(12);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, e2e_user uuid,
  self_contact uuid, other_contact uuid,
  ro_self uuid, ro_other uuid
);
GRANT SELECT ON fx TO authenticated;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  'e39b15da-0a8d-4056-b5a2-80eb1da868a6'::uuid,
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid();

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

-- self_contact: linked to the E2E test user (the "I am my own advisor" case).
INSERT INTO crm_contacts (id, organization_id, linked_user_id, visibility_scope, display_name, created_by)
SELECT self_contact, org, e2e_user, 'organization', '093-test self advisor', e2e_user FROM fx;
-- other_contact: a real contact row, but linked to no platform user at all --
-- sufficient to prove "not MY linked contact" without needing a second real
-- users.id (the FK the linked_user_id column carries).
INSERT INTO crm_contacts (id, organization_id, linked_user_id, visibility_scope, display_name, created_by)
SELECT other_contact, org, NULL, 'organization', '093-test other advisor', e2e_user FROM fx;

-- ===========================================================================
-- Phase A: actor holds workshop.repair_orders.manage_own + .read only.
-- ===========================================================================
DELETE FROM user_effective_permissions WHERE user_id = (SELECT e2e_user FROM fx) AND organization_id = (SELECT org FROM fx);
INSERT INTO user_effective_permissions (user_id, organization_id, branch_id, permission_slug, permission_slug_exact)
SELECT e2e_user, org, branch, slug, slug FROM fx, unnest(ARRAY['workshop.repair_orders.manage_own', 'workshop.repair_orders.read']) AS slug;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', e2e_user::text, 'role', 'authenticated')::text, true) FROM fx;

-- T1: manage_own actor CAN insert a RepairOrder with themselves as advisor.
INSERT INTO repair_orders (id, organization_id, branch_id, advisor_contact_id, vin, order_number)
SELECT ro_self, org, branch, self_contact, 'VIN-093-SELF', '093-TEST-SELF' FROM fx;
INSERT INTO test_log(line) SELECT is(
  (SELECT advisor_contact_id FROM repair_orders WHERE id = (SELECT ro_self FROM fx)),
  (SELECT self_contact FROM fx),
  'T1: manage_own actor can INSERT a RepairOrder naming themselves as advisor_contact_id'
);

-- T2: manage_own actor CANNOT insert a RepairOrder naming a DIFFERENT
-- contact as advisor (Phase 7 hardening) -- blocked by INSERT's own
-- WITH CHECK, proven via the specific expected SQLSTATE, not "any error".
INSERT INTO test_log(line) SELECT throws_ok(
  format(
    $q$INSERT INTO repair_orders (organization_id, branch_id, advisor_contact_id, order_number)
       VALUES (%L::uuid, %L::uuid, %L::uuid, '093-TEST-REJECTED')$q$,
    (SELECT org FROM fx), (SELECT branch FROM fx), (SELECT other_contact FROM fx)
  ),
  '42501',
  'new row violates row-level security policy for table "repair_orders"',
  'T2: manage_own actor cannot INSERT a RepairOrder naming a different contact as advisor'
);

-- T3: manage_own actor CAN insert a RepairOrder with no advisor at all.
INSERT INTO test_log(line) SELECT lives_ok(
  format(
    $q$INSERT INTO repair_orders (organization_id, branch_id, advisor_contact_id, order_number)
       VALUES (%L::uuid, %L::uuid, NULL, '093-TEST-UNASSIGNED')$q$,
    (SELECT org FROM fx), (SELECT branch FROM fx)
  ),
  'T3: manage_own actor can INSERT a RepairOrder with advisor_contact_id left NULL'
);

-- T4: manage_own actor CAN edit a non-advisor header field on their OWN order.
UPDATE repair_orders SET vin = 'VIN-093-SELF-EDITED' WHERE id = (SELECT ro_self FROM fx);
INSERT INTO test_log(line) SELECT is(
  (SELECT vin FROM repair_orders WHERE id = (SELECT ro_self FROM fx)),
  'VIN-093-SELF-EDITED',
  'T4: manage_own actor can edit a header field (vin) on their own RepairOrder'
);

-- T5: manage_own actor CANNOT reassign advisor_contact_id away from
-- themselves, even on their own order -- WITH CHECK rejects the new row.
INSERT INTO test_log(line) SELECT throws_ok(
  format(
    'UPDATE repair_orders SET advisor_contact_id = %L::uuid WHERE id = %L::uuid',
    (SELECT other_contact FROM fx), (SELECT ro_self FROM fx)
  ),
  '42501',
  'new row violates row-level security policy for table "repair_orders"',
  'T5: manage_own actor cannot reassign their own order''s advisor to someone else'
);

-- T6: manage_own actor CANNOT set status='archived' on their own order --
-- WITH CHECK's manage_own branch unconditionally forbids it.
INSERT INTO test_log(line) SELECT throws_ok(
  format('UPDATE repair_orders SET status = ''archived'' WHERE id = %L::uuid', (SELECT ro_self FROM fx)),
  '42501',
  'new row violates row-level security policy for table "repair_orders"',
  'T6: manage_own actor cannot archive their own RepairOrder (requires manage_all)'
);

-- T7: manage_own actor CAN perform an ordinary open->closed transition on
-- their own order (no elevated permission required for this transition).
UPDATE repair_orders SET status = 'closed' WHERE id = (SELECT ro_self FROM fx);
INSERT INTO test_log(line) SELECT is(
  (SELECT status FROM repair_orders WHERE id = (SELECT ro_self FROM fx)),
  'closed',
  'T7: manage_own actor can transition their own RepairOrder open->closed'
);

-- T8: manage_own actor cannot even touch an order assigned to a DIFFERENT
-- advisor -- proven as a SILENT 0-row no-op (USING itself never matches
-- the row), not an exception, so the value stays unchanged.
RESET ROLE;
INSERT INTO repair_orders (id, organization_id, branch_id, advisor_contact_id, order_number)
SELECT ro_other, org, branch, other_contact, '093-TEST-OTHER' FROM fx;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', e2e_user::text, 'role', 'authenticated')::text, true) FROM fx;

UPDATE repair_orders SET vin = 'SHOULD-NOT-APPLY' WHERE id = (SELECT ro_other FROM fx);
INSERT INTO test_log(line) SELECT is(
  (SELECT vin FROM repair_orders WHERE id = (SELECT ro_other FROM fx)),
  NULL,
  'T8: manage_own actor''s UPDATE on an order assigned to a different advisor is a silent no-op (vin still NULL)'
);

-- T9: advisor ownership (manage_own) does NOT grant any warehouse/inventory
-- capability -- explicit negative test. This actor's permission cache
-- (Phase A, above) was never given warehouse.inventory.operate.
INSERT INTO test_log(line) SELECT ok(
  NOT has_branch_permission((SELECT org FROM fx), (SELECT branch FROM fx), 'warehouse.inventory.operate'),
  'T9: a manage_own RepairOrder advisor does NOT have warehouse.inventory.operate'
);

RESET ROLE;

-- ===========================================================================
-- Phase B: actor holds workshop.repair_orders.manage_all + .read.
-- ===========================================================================
DELETE FROM user_effective_permissions WHERE user_id = (SELECT e2e_user FROM fx) AND organization_id = (SELECT org FROM fx);
INSERT INTO user_effective_permissions (user_id, organization_id, branch_id, permission_slug, permission_slug_exact)
SELECT e2e_user, org, branch, slug, slug FROM fx, unnest(ARRAY['workshop.repair_orders.manage_all', 'workshop.repair_orders.read']) AS slug;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', e2e_user::text, 'role', 'authenticated')::text, true) FROM fx;

-- T10: manage_all actor CAN reassign the advisor on ro_self (previously
-- self-assigned under Phase A) to a completely different contact.
UPDATE repair_orders SET advisor_contact_id = (SELECT other_contact FROM fx) WHERE id = (SELECT ro_self FROM fx);
INSERT INTO test_log(line) SELECT is(
  (SELECT advisor_contact_id FROM repair_orders WHERE id = (SELECT ro_self FROM fx)),
  (SELECT other_contact FROM fx),
  'T10: manage_all actor can reassign a RepairOrder''s advisor to a different contact'
);

-- T11: manage_all actor CAN edit ro_other (an order it does not "own" in
-- the advisor sense) -- manage_all is branch-wide, not ownership-scoped.
UPDATE repair_orders SET vin = 'VIN-093-OTHER-BY-MANAGE-ALL' WHERE id = (SELECT ro_other FROM fx);
INSERT INTO test_log(line) SELECT is(
  (SELECT vin FROM repair_orders WHERE id = (SELECT ro_other FROM fx)),
  'VIN-093-OTHER-BY-MANAGE-ALL',
  'T11: manage_all actor can edit a RepairOrder regardless of which advisor it is assigned to'
);

-- T12: manage_all actor CAN archive.
UPDATE repair_orders SET status = 'archived' WHERE id = (SELECT ro_other FROM fx);
INSERT INTO test_log(line) SELECT is(
  (SELECT status FROM repair_orders WHERE id = (SELECT ro_other FROM fx)),
  'archived',
  'T12: manage_all actor can archive a RepairOrder'
);

RESET ROLE;

SELECT line FROM test_log ORDER BY seq;

ROLLBACK;
