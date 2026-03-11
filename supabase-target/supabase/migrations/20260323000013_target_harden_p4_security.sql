-- =============================================================================
-- HARDENING PHASE 4: Security Hardening
-- Goal:
--   1. Fix {public} policies → {authenticated} on org_positions,
--      org_position_assignments, organization_profiles
--   2. Add FORCE ROW LEVEL SECURITY to organizations, users,
--      invitation_role_assignments
--   3. Drop legacy tables modules + user_modules (confirmed empty)
--   4. Enable RLS on any remaining unprotected tables
--   5. Revoke unnecessary PUBLIC EXECUTE on sensitive SECURITY DEFINER
--      functions; grant only to authenticated + service_role
-- =============================================================================

-- ─── 1a. Fix org_positions policies ─────────────────────────────────────────
DROP POLICY IF EXISTS org_members_can_read_positions         ON public.org_positions;
DROP POLICY IF EXISTS members_manage_can_insert_position     ON public.org_positions;
DROP POLICY IF EXISTS members_manage_can_update_position     ON public.org_positions;

CREATE POLICY org_members_can_read_positions
  ON public.org_positions
  FOR SELECT TO authenticated
  USING (is_org_member(org_id) AND deleted_at IS NULL);

CREATE POLICY members_manage_can_insert_position
  ON public.org_positions
  FOR INSERT TO authenticated
  WITH CHECK (
    is_org_member(org_id)
    AND has_permission(org_id, 'members.manage')
    AND deleted_at IS NULL
  );

CREATE POLICY members_manage_can_update_position
  ON public.org_positions
  FOR UPDATE TO authenticated
  USING  (is_org_member(org_id) AND has_permission(org_id, 'members.manage') AND deleted_at IS NULL)
  WITH CHECK (is_org_member(org_id) AND has_permission(org_id, 'members.manage'));

-- ─── 1b. Fix org_position_assignments policies ───────────────────────────────
DROP POLICY IF EXISTS org_members_can_read_assignments         ON public.org_position_assignments;
DROP POLICY IF EXISTS members_manage_can_insert_assignment     ON public.org_position_assignments;
DROP POLICY IF EXISTS members_manage_can_update_assignment     ON public.org_position_assignments;

CREATE POLICY org_members_can_read_assignments
  ON public.org_position_assignments
  FOR SELECT TO authenticated
  USING (is_org_member(org_id) AND deleted_at IS NULL);

CREATE POLICY members_manage_can_insert_assignment
  ON public.org_position_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    is_org_member(org_id)
    AND has_permission(org_id, 'members.manage')
    AND deleted_at IS NULL
  );

CREATE POLICY members_manage_can_update_assignment
  ON public.org_position_assignments
  FOR UPDATE TO authenticated
  USING  (is_org_member(org_id) AND has_permission(org_id, 'members.manage'))
  WITH CHECK (is_org_member(org_id) AND has_permission(org_id, 'members.manage'));

-- ─── 1c. Fix organization_profiles UPDATE policy ────────────────────────────
DROP POLICY IF EXISTS org_update_permission_can_update_profile ON public.organization_profiles;

CREATE POLICY org_update_permission_can_update_profile
  ON public.organization_profiles
  FOR UPDATE TO authenticated
  USING  (is_org_member(organization_id) AND has_permission(organization_id, 'org.update'))
  WITH CHECK (is_org_member(organization_id) AND has_permission(organization_id, 'org.update'));

-- ─── 2. FORCE ROW LEVEL SECURITY on remaining tables ────────────────────────
-- organizations: all writes go through SECURITY DEFINER functions;
--                FORCE prevents accidental bypass by postgres role.
ALTER TABLE public.organizations         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.users                 FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_role_assignments FORCE ROW LEVEL SECURITY;

-- ─── 3. Drop confirmed-empty legacy tables ───────────────────────────────────
-- Both modules and user_modules are verified empty (0 rows, no code usage).
-- Dropping is cleaner than quarantining ghost tables.
-- IMPORTANT: if any FK or view references these, this will fail safely (no data loss).
DROP TABLE IF EXISTS public.user_modules CASCADE;
DROP TABLE IF EXISTS public.modules      CASCADE;

-- ─── 4. Revoke unnecessary PUBLIC EXECUTE from sensitive functions ────────────
-- Pattern: REVOKE FROM PUBLIC (removes the default open grant),
--          then explicitly grant to only the roles that legitimately need access.
--
-- compile_user_permissions — writes UEP; DoS vector if called by anon
REVOKE EXECUTE ON FUNCTION public.compile_user_permissions(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.compile_user_permissions(uuid, uuid)
  TO authenticated, service_role, supabase_auth_admin;

-- recompute_organization_entitlements — rewrites entitlements; DoS vector
REVOKE EXECUTE ON FUNCTION public.recompute_organization_entitlements(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.recompute_organization_entitlements(uuid)
  TO authenticated, service_role, supabase_auth_admin;

-- delete_org_role — privileged mutation
REVOKE EXECUTE ON FUNCTION public.delete_org_role(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.delete_org_role(uuid)
  TO authenticated, service_role;

-- RLS helper functions — use auth.uid() internally; anon callers get nothing
-- but granting to anon is unnecessary and exposes internal function signatures
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_org_member(uuid)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.has_permission(uuid, text)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_branch_permission(uuid, uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.has_branch_permission(uuid, uuid, text)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_org_owner(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_org_owner(uuid)
  TO authenticated, service_role;

-- Invitation functions — invitees are authenticated before they accept/decline
REVOKE EXECUTE ON FUNCTION public.accept_invitation_and_join_org(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.accept_invitation_and_join_org(text)
  TO authenticated, service_role;
-- Note: anon access NOT needed — Supabase requires auth before RPC calls.
-- get_invitation_preview_by_token is legitimately public (pre-login preview page).

REVOKE EXECUTE ON FUNCTION public.decline_invitation(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.decline_invitation(text)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_my_pending_invitations() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_pending_invitations()
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.check_invitation_eligibility(uuid, text, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_invitation_eligibility(uuid, text, uuid)
  TO authenticated, service_role;

-- create_organization_for_current_user (5-param, active version)
REVOKE EXECUTE ON FUNCTION public.create_organization_for_current_user(text, text, uuid, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_organization_for_current_user(text, text, uuid, text, text)
  TO authenticated, service_role;

-- Trigger helper functions — not user-callable; restrict from PUBLIC
REVOKE EXECUTE ON FUNCTION public.trigger_compile_on_membership()            FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_compile_on_override()              FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_compile_on_role_assignment()       FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_compile_on_role_permission()       FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_compile_on_ura_remove()            FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_compile_on_rp_remove()             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_compile_on_override_remove()       FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_recompute_entitlements()           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_org_slug_to_profile()                 FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_roles_immutable_columns()          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_permission_slug_on_override()     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_role_assignment_scope()           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at()                           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()                 FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_user_permission_overrides_updated_at() FROM PUBLIC;
