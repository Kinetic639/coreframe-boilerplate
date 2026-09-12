-- Zone 3 Phase 7 correction pass -- Finding B (CONFIRMED, live-reproduced):
-- the accepted contract states "archived is terminal for everyone,
-- including manage_all", and the application layer (canTransitionRepair
-- OrderStatus) already enforces this -- but repair_orders_update's RLS only
-- restricted status='archived' writes for the manage_own branch
-- (WITH CHECK ... AND status <> 'archived'). The manage_all branch (USING/
-- WITH CHECK: has_branch_permission(..., 'manage_all') OR (...)) carried NO
-- status restriction at all.
--
-- Live-reproduced this pass, as the genuinely-RLS-enforced authenticated
-- role holding only workshop.repair_orders.manage_all: archiving an open
-- order succeeded (expected); a subsequent raw UPDATE ... SET status =
-- 'open' on that now-archived row ALSO succeeded (un-archiving -- NOT
-- expected); a raw UPDATE ... SET vin = ... on a genuinely still-archived
-- row ALSO succeeded (mutating an archived record -- NOT expected). Both
-- confirm archived was not actually DB-terminal for manage_all.
--
-- Fix: add `status <> 'archived'` to the USING clause (evaluated against
-- the OLD/current row, unlike WITH CHECK which evaluates the NEW row) --
-- this makes an already-archived row simply unreachable for UPDATE by
-- ANYONE, manage_all included, without needing per-branch special-casing.
-- Does not affect the ability to legally archive a row in the first place:
-- when transitioning open/closed -> archived, OLD.status is never already
-- 'archived', so USING still evaluates true for that transition. An UPDATE
-- attempt against an already-archived row now becomes a SILENT 0-row no-op
-- (the same "USING excludes the row" behavior already proven and tested for
-- the wrong-advisor case in 093_repair_orders_header_ownership_rls_test.sql's
-- T8) rather than a hard RLS error for manage_own, and rather than a
-- silently-succeeding mutation for manage_all.
drop policy if exists repair_orders_update on public.repair_orders;

create policy repair_orders_update
  on public.repair_orders
  for update
  using (
    status <> 'archived'
    and (
      has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_all')
      or (
        has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_own')
        and is_own_advisor_contact(advisor_contact_id)
      )
    )
  )
  with check (
    has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_all')
    or (
      has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_own')
      and is_own_advisor_contact(advisor_contact_id)
      and status <> 'archived'
    )
  );
