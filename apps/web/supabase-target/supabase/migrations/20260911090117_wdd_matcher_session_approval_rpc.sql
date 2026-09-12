-- Zone 3 Phase 4-6 correction-review follow-up (second pass), Finding A
-- reopened with new evidence:
--
-- The 20260911071854 migration (kept unmodified, per this pass's own rule)
-- closed the confirmed upload-only-direct-approve bypass, but a fresh
-- live-verify pass proved a second, distinct problem in that same policy:
--
--   1. An approve-only (no wdd_matcher.upload) actor gets full raw-UPDATE
--      reachability to ANY session in the org via USING(... OR approve),
--      and the WITH CHECK's second clause (`status <> 'approved' OR
--      approve`) trivially passes for every non-'approved' resulting
--      status -- so `wdd_matcher.approve` silently became generic Matcher
--      UPDATE authority (rename, arbitrary status hops, approved ->
--      processing downgrade), not narrowly "approval".
--   2. PostgreSQL RLS's USING/WITH CHECK clauses are evaluated against the
--      OLD row and the NEW row independently -- there is no expression
--      that can see both at once, so no RLS policy on this table can ever
--      enforce "the OLD status was specifically ready_for_review" as part
--      of the transition to 'approved'. WITH CHECK only ever asks "is the
--      resulting row acceptable", never "was this specific transition
--      valid". Live-verified: an approve-only actor could set
--      status='approved' directly on a session whose OLD status was
--      'pending' (not ready_for_review), completely bypassing the
--      intended workflow gate that WddMatcherService.approveSession's own
--      application-level `.eq("status","ready_for_review")` guard was
--      supposed to enforce end-to-end.
--
-- Evaluated against actual Ambra architecture (per this migration's own
-- required "evaluate, don't guess" discipline):
--   A. current RLS sufficient -- REJECTED, live-disproven above.
--   B. transition-aware trigger -- would work, but this codebase already
--      has an established, working pattern for exactly this class of
--      problem (state-transition-guarded privileged write), see C below;
--      introducing a second, structurally different mechanism (trigger)
--      for the same class of problem this pass would be inconsistent.
--   C. dedicated approval RPC -- CHOSEN. Mirrors
--      materialize_repair_orders_from_session
--      (20260910075814_repair_orders_materialization_rpc.sql) exactly:
--      SECURITY DEFINER, actor-identity check (auth.uid() must equal the
--      supplied actor), SELECT ... FOR UPDATE row lock (concurrency-safe,
--      same as the materialize RPC), explicit OLD-status validation
--      inside the function body (something only imperative PL/pgSQL, not
--      a declarative RLS policy, can express), specific stable ERRCODEs
--      per failure mode, EXECUTE revoked from PUBLIC/anon and granted
--      only to authenticated.
--   D. split policy / column grants -- rejected: Postgres column-level
--      privileges don't compose with row-level CHECK-style transition
--      logic either, and would be a novel mechanism nowhere else used in
--      this repo.
--
-- Once approval exclusively goes through this RPC (which bypasses RLS via
-- its own SECURITY DEFINER context for its internal UPDATE, exactly like
-- the materialize RPC does for repair_orders), wdd_matcher.approve no
-- longer needs -- and no longer gets -- any raw-UPDATE RLS reachability
-- at all. wms_update is reverted to upload-only reachability (the
-- ORIGINAL, pre-20260911071854 shape, which is correct once approval no
-- longer needs a raw-UPDATE path) plus one added defense-in-depth
-- WITH CHECK clause: no raw client UPDATE, by any permission, may ever
-- set status='approved' -- that transition is now only reachable through
-- approve_wdd_matcher_session's own internal, OLD-status-validated
-- UPDATE. This directly satisfies the stated goal: wdd_matcher.approve
-- authorizes APPROVAL (calling this RPC), not generic Matcher UPDATE
-- authority; and the database itself now rejects the OLD->NEW transition
-- the application service forbids, not merely the resulting NEW value.
--
-- Verified all pre-existing legitimate raw-UPDATE lifecycle writers
-- (WddMatcherService.updateSessionStatus -> 'processing'/'failed',
-- WddMatcherService.updateMatchSummary -> 'ready_for_review') are gated
-- at the application layer on wdd_matcher.upload (REPO VERIFIED:
-- apps/web/src/app/actions/tools/wdd-matcher.ts's runMatchingAction and
-- every upload/parse/match action checks PERMISSION_WDD_MATCHER_UPLOAD,
-- never PERMISSION_WDD_MATCHER_APPROVE) and never target status='approved'
-- -- so reverting wms_update to upload-only reachability plus the new
-- WITH CHECK clause breaks nothing in the existing lifecycle.

CREATE OR REPLACE FUNCTION public.approve_wdd_matcher_session(
  p_actor_user_id uuid,
  p_session_id uuid
)
RETURNS public.wdd_matcher_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_session RECORD;
  v_result public.wdd_matcher_sessions;
BEGIN
  -- ---------------------------------------------------------------------
  -- Authorization: actor identity (same pattern as
  -- materialize_repair_orders_from_session -- rejects delegated-actor
  -- spoofing)
  -- ---------------------------------------------------------------------
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  -- ---------------------------------------------------------------------
  -- Lock and validate the session (concurrency boundary -- same pattern
  -- as materialize_repair_orders_from_session; two concurrent approval
  -- attempts serialize on this row lock, and only the first to commit
  -- will find status still = 'ready_for_review')
  -- ---------------------------------------------------------------------
  SELECT * INTO v_session FROM public.wdd_matcher_sessions WHERE id = p_session_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Matcher session not found: %', p_session_id USING ERRCODE = 'P0002';
  END IF;

  -- OLD-status transition validation. This is exactly the check that no
  -- RLS USING/WITH CHECK clause on this table can express (RLS cannot
  -- correlate the pre-image and post-image in one expression) -- this RPC
  -- is what makes "ready_for_review -> approved" the only valid path to
  -- 'approved', not merely "the resulting row happens to be acceptable".
  IF v_session.status <> 'ready_for_review' THEN
    RAISE EXCEPTION 'Matcher session is not ready for review (status=%)', v_session.status USING ERRCODE = '55000';
  END IF;

  -- ---------------------------------------------------------------------
  -- Authorization: approval permission, checked against the LOCKED
  -- session's own organization_id -- never a client-supplied org (same
  -- "target-entity-authoritative" principle as
  -- materialize_repair_orders_from_session's has_branch_permission check).
  -- Matches this table's existing, pre-existing org-only RLS model
  -- (has_permission, not has_branch_permission) -- NOT redefining Matcher's
  -- org-vs-branch scoping here, which is a separate, already-tracked Zone 1
  -- item (see this pass's own Finding C write-up), out of scope for this
  -- migration.
  -- ---------------------------------------------------------------------
  IF NOT public.has_permission(v_session.organization_id, 'wdd_matcher.approve') THEN
    RAISE EXCEPTION 'Not authorized to approve this Matcher session' USING ERRCODE = '42501';
  END IF;

  UPDATE public.wdd_matcher_sessions
  SET status = 'approved', approved_by = p_actor_user_id, approved_at = now()
  WHERE id = p_session_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.approve_wdd_matcher_session(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_wdd_matcher_session(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_wdd_matcher_session(uuid, uuid) TO authenticated;

-- Narrow wms_update: revert to upload-only raw-UPDATE reachability (the
-- ORIGINAL shape, correct now that approval no longer needs a raw-UPDATE
-- path at all) plus a defense-in-depth WITH CHECK that unconditionally
-- forbids any raw client UPDATE -- by any permission -- from ever setting
-- status='approved'. That transition is now exclusively reachable through
-- approve_wdd_matcher_session above.
drop policy if exists wms_update on public.wdd_matcher_sessions;

create policy wms_update on public.wdd_matcher_sessions
  for update
  using (
    has_permission(organization_id, 'wdd_matcher.upload'::text)
  )
  with check (
    has_permission(organization_id, 'wdd_matcher.upload'::text)
    and status <> 'approved'::text
  );
