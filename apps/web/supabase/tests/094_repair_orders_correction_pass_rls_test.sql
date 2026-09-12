-- ============================================================================
-- TEST: repair_orders correction-pass fixes (Zone 3 Phase 7 external review)
-- ============================================================================
-- Covers the four CONFIRMED findings from the external reviewer's Phase 7
-- correction pass, each live-reproduced BEFORE its fix and re-verified
-- AFTER, per that pass's explicit "verify first" instruction:
--
--   Finding A: get_own_advisor_contact_id() (20260911183702) -- a genuine
--     manage_own advisor lacking crm.contacts.read can now resolve their own
--     linked contact id (the prior plain-SELECT-based application code could
--     not, even though is_own_advisor_contact() -- a DIFFERENT, already-
--     correct function -- always could).
--   Finding B: repair_orders_update's USING clause (20260911183705) now
--     requires status <> 'archived' unconditionally -- archived is
--     DB-terminal for manage_all too, not just manage_own.
--   Finding C: repair_orders_enforce_invariants() trigger (20260911183709)
--     -- identity_status is always DB-recomputed from zl_number's presence,
--     and created_by/organization_id/branch_id are immutable after insert,
--     regardless of what a direct UPDATE attempts to set them to.
--   Finding D: repair_orders_advisor_contact_id_fkey (20260911183712) is now
--     a composite FK on (organization_id, advisor_contact_id) ->
--     crm_contacts(organization_id, id) -- a cross-organization advisor
--     assignment is now rejected at the storage layer for EVERY caller,
--     manage_all included, not just narrowed for manage_own.
--
-- Also covers the final narrow verify-first pass (2026-09-11, same day):
--   Issue 1: repair_orders_enforce_invariants() (20260911192411) now also
--     forces created_by := COALESCE(auth.uid(), created_by) on INSERT, not
--     only freezing it to OLD.created_by on UPDATE -- a raw INSERT
--     supplying a DIFFERENT real user's id as created_by previously
--     persisted that spoofed authorship verbatim (repair_orders_insert's
--     RLS never checked created_by at all).
--   Issue 3: explicit regression coverage that organization_id/branch_id
--     genuinely cannot be moved via a raw UPDATE (the trigger's freeze-to-
--     OLD behavior for these two columns, added in 20260911183709, had
--     only been spot-checked ad hoc during that pass, not committed as a
--     regression test).
--   (Issue 2, own-advisor-contact cardinality, and Issue 4, EXECUTE grants
--   on get_own_advisor_contact_id, were both verified live during that same
--   pass and found NOT to need a code/schema change -- see the Zone 3
--   progress tracker's change log for the evidence. Nothing to regression-
--   test for either, since neither involved a behavior change.)
--
-- Runs as the genuinely-RLS-enforced `authenticated` role (not `postgres`)
-- with a real JWT claim, using the real, existing dedicated Zone 3 E2E test
-- account (and a second real org member for the created_by-spoof tests) and
-- a synthetic second organization created and rolled back within this same
-- transaction for the cross-org tests. Individual pgTAP assertion results
-- are collected into a temp table and selected out as the final statement
-- (the MCP SQL execution path used to run this only surfaces the last
-- statement's result set).
--
-- Executed live against supabase-target via Supabase MCP. Last run:
-- 2026-09-11, 17/17 assertions passing.

BEGIN;

SELECT plan(17);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, e2e_user uuid, other_user uuid, other_real_user uuid,
  self_contact uuid, org_b uuid, branch_b uuid, contact_b uuid,
  ro1 uuid, ro2 uuid, ro3 uuid, ro4 uuid, ro5 uuid
);
GRANT SELECT ON fx TO authenticated;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  'e39b15da-0a8d-4056-b5a2-80eb1da868a6'::uuid,
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  gen_random_uuid(),
  -- A second REAL org member (not a synthetic random uuid) -- needed
  -- because the Issue-1 INSERT-spoof tests must prove a genuine other
  -- user's authorship cannot be persisted, which requires a real users.id
  -- for repair_orders_created_by_fkey to accept in the first place.
  '832858c3-0a9f-4f9f-a230-fc7e47855e78'::uuid,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

-- Synthetic second org, purely for the Finding D cross-org tests and the
-- Issue-3 branch/org-immutability tests.
INSERT INTO organizations (id, name) SELECT org_b, '094-test-org-B' FROM fx;
INSERT INTO branches (id, organization_id, name, branch_number) SELECT branch_b, org_b, '094-test-branch-B', 997 FROM fx;
INSERT INTO crm_contacts (id, organization_id, linked_user_id, visibility_scope, display_name, created_by)
SELECT contact_b, org_b, NULL, 'organization', '094-test-org-B-contact', e2e_user FROM fx;

-- self_contact: linked to the real E2E test user, in their REAL org.
INSERT INTO crm_contacts (id, organization_id, linked_user_id, visibility_scope, display_name, created_by)
SELECT self_contact, org, e2e_user, 'organization', '094-test-self-advisor', e2e_user FROM fx;

-- ===========================================================================
-- Phase A: actor holds workshop.repair_orders.manage_own + .read ONLY --
-- deliberately NOT crm.contacts.read, to reproduce/verify Finding A.
-- ===========================================================================
DELETE FROM user_effective_permissions WHERE user_id = (SELECT e2e_user FROM fx) AND organization_id = (SELECT org FROM fx);
INSERT INTO user_effective_permissions (user_id, organization_id, branch_id, permission_slug, permission_slug_exact)
SELECT e2e_user, org, branch, slug, slug FROM fx, unnest(ARRAY['workshop.repair_orders.manage_own', 'workshop.repair_orders.read']) AS slug;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', e2e_user::text, 'role', 'authenticated')::text, true) FROM fx;

-- T1 (Finding A): get_own_advisor_contact_id resolves the real self-linked
-- contact even without crm.contacts.read.
INSERT INTO test_log(line) SELECT is(
  get_own_advisor_contact_id((SELECT org FROM fx)),
  (SELECT self_contact FROM fx),
  'T1 (Finding A): get_own_advisor_contact_id resolves the caller''s own linked contact without crm.contacts.read'
);

-- T2 (Finding A): organization-scoped -- a different org returns NULL, not
-- the same contact (proves the org filter is real, not a no-op).
INSERT INTO test_log(line) SELECT is(
  get_own_advisor_contact_id((SELECT org_b FROM fx)),
  NULL::uuid,
  'T2 (Finding A): get_own_advisor_contact_id is organization-scoped (wrong org -> NULL)'
);

-- T3 (Issue 1, final pass): manage_own's raw INSERT attempt to spoof
-- created_by as a DIFFERENT real user is overridden -- the persisted row
-- always attributes authorship to the genuine actor (auth.uid()), never the
-- caller-supplied value.
INSERT INTO repair_orders (id, organization_id, branch_id, advisor_contact_id, order_number, status, created_by)
SELECT ro4, org, branch, self_contact, '094-test-created-by-spoof-manage-own', 'open', other_real_user FROM fx;
INSERT INTO test_log(line) SELECT is(
  (SELECT created_by FROM repair_orders WHERE id = (SELECT ro4 FROM fx)),
  (SELECT e2e_user FROM fx),
  'T3 (Issue 1): manage_own cannot spoof created_by on INSERT -- the genuine actor is persisted regardless of the supplied value'
);

-- Fixture row, self-assigned, for the Finding B/C tests below.
INSERT INTO repair_orders (id, organization_id, branch_id, advisor_contact_id, order_number, status)
SELECT ro1, org, branch, self_contact, '094-test-B-C', 'open' FROM fx;

RESET ROLE;

-- ===========================================================================
-- Phase B: actor holds workshop.repair_orders.manage_all + .read.
-- ===========================================================================
DELETE FROM user_effective_permissions WHERE user_id = (SELECT e2e_user FROM fx) AND organization_id = (SELECT org FROM fx);
INSERT INTO user_effective_permissions (user_id, organization_id, branch_id, permission_slug, permission_slug_exact)
SELECT e2e_user, org, branch, slug, slug FROM fx, unnest(ARRAY['workshop.repair_orders.manage_all', 'workshop.repair_orders.read']) AS slug;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', e2e_user::text, 'role', 'authenticated')::text, true) FROM fx;

-- T4 (Finding B): manage_all CAN archive.
UPDATE repair_orders SET status = 'archived' WHERE id = (SELECT ro1 FROM fx);
INSERT INTO test_log(line) SELECT is(
  (SELECT status FROM repair_orders WHERE id = (SELECT ro1 FROM fx)),
  'archived',
  'T4 (Finding B): manage_all can archive an open RepairOrder'
);

-- T5 (Finding B): manage_all's raw UPDATE attempt to un-archive is now a
-- silent no-op -- archived is DB-terminal for manage_all too.
UPDATE repair_orders SET status = 'open' WHERE id = (SELECT ro1 FROM fx);
INSERT INTO test_log(line) SELECT is(
  (SELECT status FROM repair_orders WHERE id = (SELECT ro1 FROM fx)),
  'archived',
  'T5 (Finding B): manage_all cannot un-archive via raw UPDATE (status stays archived)'
);

-- T6 (Finding B): manage_all's raw UPDATE attempt to edit an unrelated
-- field (vin) on an already-archived order is ALSO a silent no-op.
UPDATE repair_orders SET vin = 'SHOULD-NOT-APPLY-POST-FIX' WHERE id = (SELECT ro1 FROM fx);
INSERT INTO test_log(line) SELECT is(
  (SELECT vin FROM repair_orders WHERE id = (SELECT ro1 FROM fx)),
  NULL::text,
  'T6 (Finding B): manage_all cannot edit an unrelated field on an already-archived order (vin stays NULL)'
);

-- Fresh open fixture row for Finding C (field-invariant) tests.
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status, created_by)
SELECT ro2, org, branch, '094-test-C', 'open', e2e_user FROM fx;

-- T7 (Finding C): a direct attempt to set identity_status='resolved'
-- together with a fabricated zl_number is recomputed consistently (not
-- rejected -- the trigger recomputes from zl_number's presence, which here
-- happens to agree with what was attempted).
UPDATE repair_orders SET identity_status = 'resolved', zl_number = '094-FAKE-ZL' WHERE id = (SELECT ro2 FROM fx);
INSERT INTO test_log(line) SELECT is(
  (SELECT identity_status FROM repair_orders WHERE id = (SELECT ro2 FROM fx)),
  'resolved',
  'T7 (Finding C): identity_status is derived from zl_number (resolved when present)'
);

-- T8 (Finding C): a direct attempt to desync identity_status to
-- 'unresolved' WHILE zl_number remains present is overridden back to
-- 'resolved' by the trigger -- the inconsistent state is unreachable.
UPDATE repair_orders SET identity_status = 'unresolved' WHERE id = (SELECT ro2 FROM fx);
INSERT INTO test_log(line) SELECT is(
  (SELECT identity_status FROM repair_orders WHERE id = (SELECT ro2 FROM fx)),
  'resolved',
  'T8 (Finding C): a direct attempt to desync identity_status from zl_number''s presence is overridden by the trigger'
);

-- T9 (Finding C): genuinely clearing zl_number correctly flips identity_
-- status to 'unresolved' -- the trigger does not simply freeze the value,
-- it recomputes it correctly for the legitimate case too.
UPDATE repair_orders SET zl_number = NULL WHERE id = (SELECT ro2 FROM fx);
INSERT INTO test_log(line) SELECT is(
  (SELECT identity_status FROM repair_orders WHERE id = (SELECT ro2 FROM fx)),
  'unresolved',
  'T9 (Finding C): clearing zl_number correctly re-derives identity_status to unresolved'
);

-- T10 (Finding C): a direct attempt to rewrite created_by on UPDATE is
-- overridden back to the original value -- authorship/audit-trail
-- integrity.
UPDATE repair_orders SET created_by = (SELECT other_user FROM fx) WHERE id = (SELECT ro2 FROM fx);
INSERT INTO test_log(line) SELECT is(
  (SELECT created_by FROM repair_orders WHERE id = (SELECT ro2 FROM fx)),
  (SELECT e2e_user FROM fx),
  'T10 (Finding C): created_by is immutable via UPDATE (a direct attempt is overridden)'
);

-- T11 (Finding D): manage_all's raw UPDATE attempt to assign a DIFFERENT
-- organization's crm_contacts row as advisor is rejected at the FK layer,
-- not merely by RLS -- proven via the specific expected SQLSTATE (23503),
-- not just "some error occurred".
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT ro3, org, branch, '094-test-D', 'open' FROM fx;
INSERT INTO test_log(line) SELECT throws_ok(
  format('UPDATE repair_orders SET advisor_contact_id = %L::uuid WHERE id = %L::uuid', (SELECT contact_b FROM fx), (SELECT ro3 FROM fx)),
  '23503',
  'insert or update on table "repair_orders" violates foreign key constraint "repair_orders_advisor_contact_id_fkey"',
  'T11 (Finding D): manage_all cannot assign a cross-organization contact as advisor -- rejected by the composite FK (SQLSTATE 23503)'
);

-- T12 (Finding D): the row's advisor_contact_id genuinely never changed --
-- the rejected UPDATE left no partial effect.
INSERT INTO test_log(line) SELECT is(
  (SELECT advisor_contact_id FROM repair_orders WHERE id = (SELECT ro3 FROM fx)),
  NULL::uuid,
  'T12 (Finding D): the row''s advisor_contact_id is genuinely unchanged after the blocked cross-org attempt'
);

-- T13 (Finding D): a SAME-org advisor assignment (the legitimate case)
-- still works correctly -- the FK is not overly restrictive.
UPDATE repair_orders SET advisor_contact_id = (SELECT self_contact FROM fx) WHERE id = (SELECT ro3 FROM fx);
INSERT INTO test_log(line) SELECT is(
  (SELECT advisor_contact_id FROM repair_orders WHERE id = (SELECT ro3 FROM fx)),
  (SELECT self_contact FROM fx),
  'T13 (Finding D): a same-organization advisor assignment still succeeds'
);

-- T14 (Finding D): clearing the advisor (NULL) is still always allowed --
-- MATCH SIMPLE means the FK is not checked when advisor_contact_id IS NULL.
UPDATE repair_orders SET advisor_contact_id = NULL WHERE id = (SELECT ro3 FROM fx);
INSERT INTO test_log(line) SELECT is(
  (SELECT advisor_contact_id FROM repair_orders WHERE id = (SELECT ro3 FROM fx)),
  NULL::uuid,
  'T14 (Finding D): clearing advisor_contact_id to NULL still works (FK not checked when NULL)'
);

-- T15 (Issue 1, final pass): manage_all's raw INSERT attempt to spoof
-- created_by as a DIFFERENT real user is ALSO overridden -- proves the fix
-- is not narrowed to manage_own.
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status, created_by)
SELECT ro5, org, branch, '094-test-created-by-spoof-manage-all', 'open', other_real_user FROM fx;
INSERT INTO test_log(line) SELECT is(
  (SELECT created_by FROM repair_orders WHERE id = (SELECT ro5 FROM fx)),
  (SELECT e2e_user FROM fx),
  'T15 (Issue 1): manage_all cannot spoof created_by on INSERT either -- the genuine actor is persisted regardless of the supplied value'
);

-- T16 (Issue 3, final pass): manage_all's raw UPDATE attempt to move an
-- existing RepairOrder to a DIFFERENT organization leaves organization_id
-- genuinely unchanged -- asserting exact persisted row state, not merely
-- "an error occurred" (this UPDATE does not raise -- the trigger resets
-- organization_id back to OLD before RLS's WITH CHECK is ever evaluated
-- against the attempted new value, so it is a real, successful statement
-- that simply has no effect on this column).
UPDATE repair_orders SET organization_id = (SELECT org_b FROM fx) WHERE id = (SELECT ro5 FROM fx);
INSERT INTO test_log(line) SELECT is(
  (SELECT organization_id FROM repair_orders WHERE id = (SELECT ro5 FROM fx)),
  (SELECT org FROM fx),
  'T16 (Issue 3): a raw UPDATE cannot move a RepairOrder to a different organization_id'
);

-- T17 (Issue 3, final pass): same proof for branch_id, using the synthetic
-- org B's own branch as the attempted (invalid) target.
UPDATE repair_orders SET branch_id = (SELECT branch_b FROM fx) WHERE id = (SELECT ro5 FROM fx);
INSERT INTO test_log(line) SELECT is(
  (SELECT branch_id FROM repair_orders WHERE id = (SELECT ro5 FROM fx)),
  (SELECT branch FROM fx),
  'T17 (Issue 3): a raw UPDATE cannot move a RepairOrder to a different branch_id'
);

RESET ROLE;

SELECT line FROM test_log ORDER BY seq;

ROLLBACK;
