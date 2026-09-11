-- Zone 3 Phase 4-6 corrective review, Finding A (CONFIRMED SECURITY GAP):
--
-- wdd_matcher_sessions' UPDATE RLS policy (wms_update) gates only on
-- wdd_matcher.upload, with no WITH CHECK clause at all. That means an
-- upload-only caller (lacking wdd_matcher.approve) could bypass
-- approveSessionAction's server-side permission check entirely via a raw
-- client .update() call, setting status='approved' directly -- the DB
-- layer never independently enforced the same approval-authority contract
-- the application layer does.
--
-- Fix, mirroring the exact pattern already established for
-- repair_orders_update's archive-restriction
-- (20260910074716_repair_orders_archive_rls_restriction.sql): the row
-- remains reachable for UPDATE by either .upload or .approve holders (so
-- the existing upload/parse/match lifecycle keeps working, and an
-- approve-only-without-upload role -- architecturally plausible, since
-- these are separate permission slugs -- can still reach the row for the
-- approval transition itself), but the resulting row's status may only be
-- 'approved' if the actor holds wdd_matcher.approve specifically.
--
-- This is layered on top of (not a replacement for) the application's own
-- atomic UPDATE ... WHERE status = 'ready_for_review' guard in
-- WddMatcherService.approveSession -- both remain race-safe together,
-- since RLS is re-evaluated per-statement alongside that WHERE clause.
drop policy if exists wms_update on public.wdd_matcher_sessions;

create policy wms_update on public.wdd_matcher_sessions
  for update
  using (
    has_permission(organization_id, 'wdd_matcher.upload'::text)
    or has_permission(organization_id, 'wdd_matcher.approve'::text)
  )
  with check (
    (
      has_permission(organization_id, 'wdd_matcher.upload'::text)
      or has_permission(organization_id, 'wdd_matcher.approve'::text)
    )
    and (
      status <> 'approved'::text
      or has_permission(organization_id, 'wdd_matcher.approve'::text)
    )
  );
