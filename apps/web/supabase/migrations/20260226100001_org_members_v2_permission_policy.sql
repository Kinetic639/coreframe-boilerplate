-- Migration B: Additive UPDATE policy on organization_members using V2 permission system
-- The existing policies use legacy role-based functions (has_org_role, is_org_creator).
-- This adds an additional UPDATE path via V2 has_permission(), so that users with
-- members.manage permission can suspend/activate members — not only org_owner role holders.
-- Existing policies are NOT removed (additive only).

CREATE POLICY "members_manage_permission_can_update"
ON public.organization_members
FOR UPDATE
USING (
  public.is_org_member(organization_id)
  AND public.has_permission(organization_id, 'members.manage')
)
WITH CHECK (
  public.is_org_member(organization_id)
  AND public.has_permission(organization_id, 'members.manage')
);
