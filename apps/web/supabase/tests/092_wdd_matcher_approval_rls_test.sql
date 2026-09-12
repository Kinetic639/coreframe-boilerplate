-- ============================================================================
-- TEST: wdd_matcher_sessions approval RLS + approve_wdd_matcher_session RPC
-- (Zone 3 Phase 4-6 correction-review, Finding A -- FULL rewrite, second
-- pass)
-- ============================================================================
-- Verifies the CURRENT, final shape after both correction-review passes:
--   apps/web/supabase-target/supabase/migrations/
--   20260911071854_wdd_matcher_sessions_approval_rls_restriction.sql (first
--   pass -- now partially superseded, kept unmodified per instruction) and
--   20260911090117_wdd_matcher_session_approval_rpc.sql (second pass --
--   the approve_wdd_matcher_session RPC + the final wms_update policy
--   shape: upload-only raw-UPDATE reachability, status='approved'
--   unconditionally forbidden via raw UPDATE by any permission).
--
-- Rewritten from the first pass's version, which caught
-- "EXCEPTION WHEN insufficient_privilege OR OTHERS" and treated ANY
-- exception as proof the forbidden approval was blocked -- a genuine
-- false-positive risk (an unrelated error, e.g. a typo'd column name or a
-- transient issue, would have made the test pass for the wrong reason).
-- This version instead proves the SPECIFIC, EXPECTED outcome for every
-- case:
--   - an RLS-blocked raw UPDATE is proven by asserting the row's value is
--     UNCHANGED after the attempt (a USING-clause mismatch is a SILENT
--     0-row no-op in Postgres, not an exception -- so "no error raised"
--     is not evidence of anything by itself; only the unchanged row is).
--   - an RPC-blocked call is proven via pgTAP's throws_ok() against the
--     SPECIFIC expected SQLSTATE (55000 for an invalid source-status
--     transition, 42501 for a missing-permission caller) -- not merely
--     "some error occurred".
--
-- Runs as the genuinely-RLS-enforced `authenticated` role (not `postgres`,
-- which bypasses RLS entirely) with a real JWT claim set via
-- request.jwt.claims. Uses the real, existing dedicated Zone 3 E2E test
-- account, whose permission-cache rows are temporarily narrowed within
-- this transaction and rolled back at the end -- the account's real
-- permissions are unaffected after the run.
--
-- Executed live against supabase-target via Supabase MCP. Last run:
-- 2026-09-11, 13/13 assertions passing.

BEGIN;

SELECT plan(13);

CREATE TEMP TABLE fx (
  s_approved uuid, s_ready_a uuid, s_ready_b uuid, s_pending uuid, s_lifecycle uuid,
  e2e_user uuid, org uuid, branch uuid
);
GRANT SELECT ON fx TO authenticated;
INSERT INTO fx SELECT
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  'e39b15da-0a8d-4056-b5a2-80eb1da868a6'::uuid;

INSERT INTO wdd_matcher_sessions (id, organization_id, branch_id, name, status)
SELECT s_approved, org, branch, '092-test approved session', 'approved' FROM fx;
INSERT INTO wdd_matcher_sessions (id, organization_id, branch_id, name, status)
SELECT s_ready_a, org, branch, '092-test ready session A (approve-only success path)', 'ready_for_review' FROM fx;
INSERT INTO wdd_matcher_sessions (id, organization_id, branch_id, name, status)
SELECT s_ready_b, org, branch, '092-test ready session B (upload-only rejection path)', 'ready_for_review' FROM fx;
INSERT INTO wdd_matcher_sessions (id, organization_id, branch_id, name, status)
SELECT s_pending, org, branch, '092-test pending session (invalid source status)', 'pending' FROM fx;
INSERT INTO wdd_matcher_sessions (id, organization_id, branch_id, name, status)
SELECT s_lifecycle, org, branch, '092-test legit upload lifecycle', 'pending' FROM fx;

-- ===========================================================================
-- Phase A: actor holds wdd_matcher.approve + .read, but NOT .upload.
-- ===========================================================================
DELETE FROM user_effective_permissions WHERE user_id = (SELECT e2e_user FROM fx) AND organization_id = (SELECT org FROM fx);
INSERT INTO user_effective_permissions (user_id, organization_id, permission_slug, permission_slug_exact)
SELECT e2e_user, org, slug, slug FROM fx, unnest(ARRAY['wdd_matcher.approve', 'wdd_matcher.read']) AS slug;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', e2e_user::text, 'role', 'authenticated')::text, true) FROM fx;

-- T1: approve-only actor's raw UPDATE cannot mutate an unrelated field
-- (name) on ANY session -- proven by the value staying unchanged, not by
-- "no error".
UPDATE wdd_matcher_sessions SET name = 'HIJACKED BY APPROVE-ONLY ACTOR' WHERE id = (SELECT s_approved FROM fx);
SELECT is(
  (SELECT name FROM wdd_matcher_sessions WHERE id = (SELECT s_approved FROM fx)),
  '092-test approved session',
  'T1: approve-only actor cannot rename an unrelated field via raw UPDATE (name unchanged)'
);

-- T2: approve-only actor's raw UPDATE cannot silently downgrade an already-
-- approved session's status -- proven by status staying unchanged.
UPDATE wdd_matcher_sessions SET status = 'processing' WHERE id = (SELECT s_approved FROM fx);
SELECT is(
  (SELECT status FROM wdd_matcher_sessions WHERE id = (SELECT s_approved FROM fx)),
  'approved',
  'T2: approve-only actor cannot downgrade approved->processing via raw UPDATE (status unchanged)'
);

-- T3: approve-only actor's raw UPDATE cannot jump an invalid-source-status
-- session directly to 'approved', bypassing the intended
-- ready_for_review->approved transition -- proven by status staying
-- unchanged.
UPDATE wdd_matcher_sessions SET status = 'approved', approved_by = (SELECT e2e_user FROM fx), approved_at = now()
WHERE id = (SELECT s_pending FROM fx);
SELECT is(
  (SELECT status FROM wdd_matcher_sessions WHERE id = (SELECT s_pending FROM fx)),
  'pending',
  'T3: approve-only actor cannot jump an invalid source status (pending) directly to approved via raw UPDATE (status unchanged)'
);

-- T4: the LEGITIMATE path -- approve-only actor calling the RPC on a
-- genuinely ready_for_review session -- succeeds.
SELECT lives_ok(
  format('SELECT approve_wdd_matcher_session(%L::uuid, %L::uuid)', (SELECT e2e_user FROM fx), (SELECT s_ready_a FROM fx)),
  'T4: approve-only actor calling approve_wdd_matcher_session on a genuinely ready_for_review session succeeds'
);
SELECT is(
  (SELECT status FROM wdd_matcher_sessions WHERE id = (SELECT s_ready_a FROM fx)),
  'approved',
  'T4b: the session approved via the RPC actually has status=approved afterward'
);

-- T5: the RPC itself rejects an invalid source-status transition with the
-- SPECIFIC expected SQLSTATE (55000), not just "some error".
SELECT throws_ok(
  format('SELECT approve_wdd_matcher_session(%L::uuid, %L::uuid)', (SELECT e2e_user FROM fx), (SELECT s_pending FROM fx)),
  '55000',
  'Matcher session is not ready for review (status=pending)',
  'T5: approve_wdd_matcher_session rejects a pending-status session with SQLSTATE 55000 and the specific expected message'
);

-- T5b: calling the RPC AGAIN on the now-already-approved s_ready_a session
-- (sequential re-approval attempt, same actor) is also rejected with
-- 55000 -- the function-level status re-check protects against a solo
-- retry, the same status-guard mechanism a genuine concurrent second caller
-- would also hit after losing the SELECT...FOR UPDATE race (true two-
-- connection concurrency cannot be expressed in this single-session pgTAP
-- suite -- same tooling limitation already accepted for Phase 3's
-- materialize_repair_orders_from_session concurrency proof; this assertion
-- is real but is not that proof).
SELECT throws_ok(
  format('SELECT approve_wdd_matcher_session(%L::uuid, %L::uuid)', (SELECT e2e_user FROM fx), (SELECT s_ready_a FROM fx)),
  '55000',
  'Matcher session is not ready for review (status=approved)',
  'T5b: re-approving an already-approved session (sequential retry) is rejected with SQLSTATE 55000, proving the function-level status guard'
);

RESET ROLE;

-- ===========================================================================
-- Phase B: actor holds wdd_matcher.upload + .read, but NOT .approve.
-- ===========================================================================
DELETE FROM user_effective_permissions WHERE user_id = (SELECT e2e_user FROM fx) AND organization_id = (SELECT org FROM fx);
INSERT INTO user_effective_permissions (user_id, organization_id, permission_slug, permission_slug_exact)
SELECT e2e_user, org, slug, slug FROM fx, unnest(ARRAY['wdd_matcher.upload', 'wdd_matcher.read']) AS slug;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', e2e_user::text, 'role', 'authenticated')::text, true) FROM fx;

-- T6: the existing upload/parse/match lifecycle keeps working -- a
-- legitimate non-approval transition succeeds via raw UPDATE.
UPDATE wdd_matcher_sessions SET status = 'processing' WHERE id = (SELECT s_lifecycle FROM fx);
SELECT is(
  (SELECT status FROM wdd_matcher_sessions WHERE id = (SELECT s_lifecycle FROM fx)),
  'processing',
  'T6: upload-only actor can still perform the existing legitimate lifecycle transition (pending->processing) via raw UPDATE'
);

-- T7: upload-only (no approve) actor calling the RPC on a genuinely
-- ready_for_review session is rejected with the SPECIFIC expected SQLSTATE
-- (42501), not just "some error" -- and specifically NOT masked by a
-- 55000 status error, since s_ready_b's status is genuinely
-- ready_for_review at this point (untouched by Phase A).
SELECT throws_ok(
  format('SELECT approve_wdd_matcher_session(%L::uuid, %L::uuid)', (SELECT e2e_user FROM fx), (SELECT s_ready_b FROM fx)),
  '42501',
  'Not authorized to approve this Matcher session',
  'T7: upload-only (no approve) actor calling approve_wdd_matcher_session on a genuinely ready_for_review session is rejected with SQLSTATE 42501'
);

-- T8: upload-only actor's raw UPDATE cannot set status='approved' either.
-- Unlike T1-T3 (where USING itself fails for an approve-only actor, so the
-- row is never matched -- a SILENT 0-row no-op), here the upload-only
-- actor's USING clause DOES pass (they hold upload, so the row is
-- reachable) and it is specifically WITH CHECK's `status <> 'approved'`
-- clause that then fails on the attempted new row -- which Postgres
-- raises as a HARD error ("new row violates row-level security policy"),
-- not a silent no-op. Proven via throws_ok against the specific expected
-- SQLSTATE (42501) and message, not a bare UPDATE + unchanged-value check
-- (which would itself abort this script, since the exception is real).
SELECT throws_ok(
  format(
    'UPDATE wdd_matcher_sessions SET status = ''approved'', approved_by = %L::uuid, approved_at = now() WHERE id = %L::uuid',
    (SELECT e2e_user FROM fx), (SELECT s_lifecycle FROM fx)
  ),
  '42501',
  'new row violates row-level security policy for table "wdd_matcher_sessions"',
  'T8: upload-only actor''s raw UPDATE to status=approved is blocked by WITH CHECK (approval is RPC-only for every permission)'
);
-- T8b: and the row's status genuinely never changed -- the rejected UPDATE
-- left no partial effect (throws_ok rolls back to its own savepoint, but
-- this confirms it explicitly rather than assuming pgTAP's internals).
SELECT is(
  (SELECT status FROM wdd_matcher_sessions WHERE id = (SELECT s_lifecycle FROM fx)),
  'processing',
  'T8b: the row''s status is genuinely unchanged after the blocked attempt'
);

RESET ROLE;

-- ===========================================================================
-- Phase C: EXECUTE grants on the RPC itself.
-- ===========================================================================
SELECT ok(
  has_function_privilege('authenticated', 'public.approve_wdd_matcher_session(uuid,uuid)', 'EXECUTE'),
  'T9: authenticated role has EXECUTE on approve_wdd_matcher_session'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.approve_wdd_matcher_session(uuid,uuid)', 'EXECUTE'),
  'T10: anon role does NOT have EXECUTE on approve_wdd_matcher_session'
);

SELECT * FROM finish();

ROLLBACK;
