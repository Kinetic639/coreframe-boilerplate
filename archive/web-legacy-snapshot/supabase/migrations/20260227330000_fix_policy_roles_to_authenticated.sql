-- P2-C: Convert {public} → {authenticated} on all org-module RLS policies
-- Rationale: {public} allows unauthenticated (anon) callers to reach these policies.
-- All predicates already require membership/permission checks, but defence-in-depth
-- requires the role guard to reject anon callers before evaluating any predicate.

ALTER POLICY "invitations_update_org_cancel"
  ON public.invitations TO authenticated;

ALTER POLICY "invitations_update_self_accept"
  ON public.invitations TO authenticated;

ALTER POLICY "invitations_update_self_cancel"
  ON public.invitations TO authenticated;

ALTER POLICY "members_manage_can_insert_assignment"
  ON public.org_position_assignments TO authenticated;

ALTER POLICY "members_manage_can_update_assignment"
  ON public.org_position_assignments TO authenticated;

ALTER POLICY "org_members_can_read_assignments"
  ON public.org_position_assignments TO authenticated;

ALTER POLICY "members_manage_can_insert_position"
  ON public.org_positions TO authenticated;

ALTER POLICY "members_manage_can_update_position"
  ON public.org_positions TO authenticated;

ALTER POLICY "org_members_can_read_positions"
  ON public.org_positions TO authenticated;

ALTER POLICY "members_manage_permission_can_update"
  ON public.organization_members TO authenticated;

ALTER POLICY "org_members_can_read_profile"
  ON public.organization_profiles TO authenticated;

ALTER POLICY "org_update_permission_can_update_profile"
  ON public.organization_profiles TO authenticated;

ALTER POLICY "Users can view own effective permissions"
  ON public.user_effective_permissions TO authenticated;
