-- =============================================================================
-- Migration: inventory_phase1_recompile_permissions
-- Project:   rjeraydumwechpjjzrus (TARGET)
-- Phase:     Ambra Inventory V2 Phase 1 — Permission Snapshot Refresh
-- =============================================================================
-- The inventory permission seed adds new concrete warehouse.* descendants.
-- Existing org_owner role permissions may already contain warehouse.*, so the
-- role_permissions trigger does not necessarily fire again. Recompile active
-- member permission snapshots so wildcard expansion includes the new inventory
-- slugs immediately.
-- =============================================================================

DO $$
DECLARE
  v_member record;
BEGIN
  FOR v_member IN
    SELECT DISTINCT user_id, organization_id
    FROM public.organization_members
    WHERE deleted_at IS NULL
      AND status = 'active'
  LOOP
    PERFORM public.compile_user_permissions(v_member.user_id, v_member.organization_id);
  END LOOP;
END $$;
