-- Fix Gap #6: invitations UPDATE privilege escalation
-- Splits the combined UPDATE policy into two separate policies:
--   1. Org members with invites.cancel permission — full UPDATE (unchanged behavior)
--   2. Invitee email-match — WITH CHECK restricts new row to status='cancelled' only
--
-- Exploit path blocked: invitee could previously PATCH role_id/branch_id while keeping
-- status='pending' via direct Supabase REST API (email-match branch had no column restriction).
-- With this fix, the WITH CHECK on the invitee branch requires status='cancelled', so
-- any update that keeps status='pending' is rejected at DB level.

-- Drop the combined vulnerable policy
DROP POLICY IF EXISTS invitations_update_permission ON public.invitations;

-- Policy 1: org members with cancel permission — full UPDATE (preserves existing admin behavior)
CREATE POLICY invitations_update_org_cancel
ON public.invitations FOR UPDATE
USING (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'invites.cancel')
  AND deleted_at IS NULL
)
WITH CHECK (
  is_org_member(organization_id)
  AND has_permission(organization_id, 'invites.cancel')
  AND deleted_at IS NULL
);

-- Policy 2: invitee self-cancel — USING allows read of their own invite,
-- WITH CHECK requires status='cancelled' in the new row state (blocks role_id/branch_id pivoting)
CREATE POLICY invitations_update_self_cancel
ON public.invitations FOR UPDATE
USING (
  lower(email) = lower(COALESCE(auth.jwt()->>'email', ''))
  AND deleted_at IS NULL
)
WITH CHECK (
  lower(email) = lower(COALESCE(auth.jwt()->>'email', ''))
  AND status = 'cancelled'
  AND deleted_at IS NULL
);
