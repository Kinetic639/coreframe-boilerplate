-- Migration A: Enable RLS on organization_profiles + add SELECT + UPDATE policies
-- This closes the critical security gap where any authenticated user could read/modify any org's profile.

ALTER TABLE public.organization_profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: any org member can read their org's profile
CREATE POLICY "org_members_can_read_profile"
ON public.organization_profiles
FOR SELECT
USING (public.is_org_member(organization_id));

-- UPDATE: only users with org.update permission can update
-- WITH CHECK mirrors USING exactly (required by checklist)
CREATE POLICY "org_update_permission_can_update_profile"
ON public.organization_profiles
FOR UPDATE
USING (
  public.is_org_member(organization_id)
  AND public.has_permission(organization_id, 'org.update')
)
WITH CHECK (
  public.is_org_member(organization_id)
  AND public.has_permission(organization_id, 'org.update')
);
