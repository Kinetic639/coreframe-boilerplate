-- Migration: repair_orders_archive_rls_restriction
-- Forward migration correcting a defense-in-depth gap in
-- 20260910061711_repair_orders_core_schema.sql (already applied live, left
-- untouched -- see repo convention: never edit an applied migration in place).
--
-- Confirmed LIVE (2026-09-10) before writing this migration:
--   repair_orders_update's WITH CHECK allowed EITHER manage_all OR
--   (manage_own + advisor-ownership match) to write ANY column value,
--   including status = 'archived'. The application-layer helper
--   canTransitionRepairOrderStatus() (apps/web/src/lib/types/repair-orders.ts)
--   already blocks this correctly, but the DB layer did not -- a manage_own
--   advisor could bypass the service layer entirely and archive their own
--   assigned order directly via the client, violating the accepted rule that
--   archiving requires manage_all (or an equivalent archive-capable grant).
--
-- Fix: restrict the manage_own branch of WITH CHECK so it can never produce
-- a row with status = 'archived'. The manage_all branch is unrestricted, per
-- the accepted rule ("manage_all may update/archive in-branch orders").
-- USING is intentionally left unchanged (manage_own's read/target-selection
-- scope is unaffected -- only what the resulting row may look like changes).
-- No trigger, no new permission -- a single ALTER POLICY is sufficient.

ALTER POLICY repair_orders_update ON public.repair_orders
  USING (
    public.has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_all')
    OR (
      public.has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_own')
      AND advisor_contact_id IN (
        SELECT id FROM public.crm_contacts WHERE linked_user_id = (SELECT auth.uid())
      )
    )
  )
  WITH CHECK (
    public.has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_all')
    OR (
      public.has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_own')
      AND advisor_contact_id IN (
        SELECT id FROM public.crm_contacts WHERE linked_user_id = (SELECT auth.uid())
      )
      AND status <> 'archived'
    )
  );
