-- ============================================================================
-- RLS V2 Complete Security Migration
-- ============================================================================
-- This migration enables RLS and adds comprehensive policies for ALL tables
-- used in the Permission System V2 dashboard.
--
-- Pattern: Two-layer security
-- 1. Tenant boundary: is_org_member() - Who can see anything at all
-- 2. Permission check: has_permission() - Who can do what
--
-- Tables secured in this migration:
-- - permissions (reference table - read-only for authenticated users)
-- - roles (org-scoped, system roles readable by all)
-- - role_permissions (org-scoped)
-- - user_permission_overrides (user/admin managed)
-- - users (profile data)
-- ============================================================================

-- ============================================================================
-- PART 1: PERMISSIONS TABLE (Dictionary/Reference)
-- ============================================================================
-- This is a reference table - all authenticated users can read it
-- Only service role can modify (via migrations)

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies first
DROP POLICY IF EXISTS "permissions_select_authenticated" ON public.permissions;
DROP POLICY IF EXISTS "permissions_select_all" ON public.permissions;

-- SELECT: Any authenticated user can read the permissions dictionary
CREATE POLICY "permissions_select_authenticated"
  ON public.permissions
  FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policies - only migrations can modify

-- ============================================================================
-- PART 2: ROLES TABLE
-- ============================================================================
-- Roles can be:
-- 1. System roles (is_basic=true, organization_id IS NULL) - readable by all
-- 2. Custom org roles (organization_id IS NOT NULL) - org members can read
--
-- Only users with members.manage can create/update/delete custom roles

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Drop any existing broken policies
DROP POLICY IF EXISTS "org_owners_can_read_roles" ON public.roles;
DROP POLICY IF EXISTS "org_owners_can_create_roles" ON public.roles;
DROP POLICY IF EXISTS "org_owners_can_update_roles" ON public.roles;
DROP POLICY IF EXISTS "org_owners_can_delete_roles" ON public.roles;
DROP POLICY IF EXISTS "roles_select_system" ON public.roles;
DROP POLICY IF EXISTS "roles_select_org" ON public.roles;
DROP POLICY IF EXISTS "roles_insert_permission" ON public.roles;
DROP POLICY IF EXISTS "roles_update_permission" ON public.roles;
DROP POLICY IF EXISTS "roles_delete_permission" ON public.roles;

-- SELECT: System roles (is_basic=true) readable by all authenticated
CREATE POLICY "roles_select_system"
  ON public.roles
  FOR SELECT
  TO authenticated
  USING (
    is_basic = true
    OR organization_id IS NULL
  );

-- SELECT: Custom org roles readable by org members
CREATE POLICY "roles_select_org"
  ON public.roles
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND is_org_member(organization_id)
  );

-- INSERT: Only users with members.manage in the org can create custom roles
CREATE POLICY "roles_insert_permission"
  ON public.roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND has_permission(organization_id, 'members.manage')
  );

-- UPDATE: Only users with members.manage can update custom roles (not system roles)
CREATE POLICY "roles_update_permission"
  ON public.roles
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND is_basic = false
    AND has_permission(organization_id, 'members.manage')
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND is_basic = false
    AND has_permission(organization_id, 'members.manage')
  );

-- DELETE: Only users with members.manage can delete custom roles (soft delete)
CREATE POLICY "roles_delete_permission"
  ON public.roles
  FOR DELETE
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND is_basic = false
    AND has_permission(organization_id, 'members.manage')
  );

-- ============================================================================
-- PART 3: ROLE_PERMISSIONS TABLE (Junction)
-- ============================================================================
-- Links roles to permissions
-- SELECT: Viewable by org members (for their org's roles) or for system roles
-- Modify: Only via members.manage permission

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "role_permissions_select_system" ON public.role_permissions;
DROP POLICY IF EXISTS "role_permissions_select_org" ON public.role_permissions;
DROP POLICY IF EXISTS "role_permissions_insert_permission" ON public.role_permissions;
DROP POLICY IF EXISTS "role_permissions_update_permission" ON public.role_permissions;
DROP POLICY IF EXISTS "role_permissions_delete_permission" ON public.role_permissions;

-- SELECT: Role permissions for system roles (no org) readable by authenticated
CREATE POLICY "role_permissions_select_system"
  ON public.role_permissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = role_permissions.role_id
      AND (r.is_basic = true OR r.organization_id IS NULL)
    )
  );

-- SELECT: Role permissions for org roles readable by org members
CREATE POLICY "role_permissions_select_org"
  ON public.role_permissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = role_permissions.role_id
      AND r.organization_id IS NOT NULL
      AND is_org_member(r.organization_id)
    )
  );

-- INSERT: Only users with members.manage can assign permissions to custom roles
CREATE POLICY "role_permissions_insert_permission"
  ON public.role_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = role_permissions.role_id
      AND r.organization_id IS NOT NULL
      AND r.is_basic = false
      AND has_permission(r.organization_id, 'members.manage')
    )
  );

-- UPDATE: Only users with members.manage can update permission assignments
CREATE POLICY "role_permissions_update_permission"
  ON public.role_permissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = role_permissions.role_id
      AND r.organization_id IS NOT NULL
      AND r.is_basic = false
      AND has_permission(r.organization_id, 'members.manage')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = role_permissions.role_id
      AND r.organization_id IS NOT NULL
      AND r.is_basic = false
      AND has_permission(r.organization_id, 'members.manage')
    )
  );

-- DELETE: Only users with members.manage can remove permission assignments
CREATE POLICY "role_permissions_delete_permission"
  ON public.role_permissions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = role_permissions.role_id
      AND r.organization_id IS NOT NULL
      AND r.is_basic = false
      AND has_permission(r.organization_id, 'members.manage')
    )
  );

-- ============================================================================
-- PART 4: USER_PERMISSION_OVERRIDES TABLE
-- ============================================================================
-- Individual user overrides (grant/revoke)
-- Users can view their own overrides
-- Admins with members.manage can create/update/delete overrides

ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Users can view their own permission overrides" ON public.user_permission_overrides;
DROP POLICY IF EXISTS "Org owners can create permission overrides" ON public.user_permission_overrides;
DROP POLICY IF EXISTS "Org owners can update permission overrides" ON public.user_permission_overrides;
DROP POLICY IF EXISTS "Org owners can delete permission overrides" ON public.user_permission_overrides;
DROP POLICY IF EXISTS "overrides_select_self" ON public.user_permission_overrides;
DROP POLICY IF EXISTS "overrides_select_admin" ON public.user_permission_overrides;
DROP POLICY IF EXISTS "overrides_insert_permission" ON public.user_permission_overrides;
DROP POLICY IF EXISTS "overrides_update_permission" ON public.user_permission_overrides;
DROP POLICY IF EXISTS "overrides_delete_permission" ON public.user_permission_overrides;

-- SELECT: Users can view their own overrides
CREATE POLICY "overrides_select_self"
  ON public.user_permission_overrides
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- SELECT: Admins with members.manage can view all overrides in their org
CREATE POLICY "overrides_select_admin"
  ON public.user_permission_overrides
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND has_permission(organization_id, 'members.manage')
  );

-- INSERT: Only admins with members.manage can create overrides
CREATE POLICY "overrides_insert_permission"
  ON public.user_permission_overrides
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND has_permission(organization_id, 'members.manage')
  );

-- UPDATE: Only admins with members.manage can update overrides
CREATE POLICY "overrides_update_permission"
  ON public.user_permission_overrides
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND has_permission(organization_id, 'members.manage')
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND has_permission(organization_id, 'members.manage')
  );

-- DELETE: Only admins with members.manage can delete overrides
CREATE POLICY "overrides_delete_permission"
  ON public.user_permission_overrides
  FOR DELETE
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND has_permission(organization_id, 'members.manage')
  );

-- ============================================================================
-- PART 5: USERS TABLE (Profile Data)
-- ============================================================================
-- Users can view/update their own profile
-- Org members can view basic info of other members in their org

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "users_select_self" ON public.users;
DROP POLICY IF EXISTS "users_select_org_member" ON public.users;
DROP POLICY IF EXISTS "users_update_self" ON public.users;
DROP POLICY IF EXISTS "users_insert_self" ON public.users;

-- SELECT: Users can always see their own profile
CREATE POLICY "users_select_self"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- SELECT: Users can see profiles of other members in their organizations
CREATE POLICY "users_select_org_member"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om1
      JOIN public.organization_members om2
        ON om1.organization_id = om2.organization_id
      WHERE om1.user_id = auth.uid()
      AND om2.user_id = users.id
      AND om1.status = 'active'
      AND om2.status = 'active'
      AND om1.deleted_at IS NULL
      AND om2.deleted_at IS NULL
    )
  );

-- INSERT: Users can create their own profile (during registration)
CREATE POLICY "users_insert_self"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- UPDATE: Users can only update their own profile
CREATE POLICY "users_update_self"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- No DELETE policy - profiles are not deleted directly

-- ============================================================================
-- PART 6: VERIFY EXISTING POLICIES (Organizations, Branches, Members, etc.)
-- ============================================================================
-- These tables already have RLS enabled with correct V2 policies
-- Just verify they exist and are using the right functions

-- Ensure is_org_member and has_permission functions use V2 pattern
-- (Already done in 20260120113444_permission_system_v2_foundation.sql)

-- ============================================================================
-- PART 7: Add helpful comments for documentation
-- ============================================================================

COMMENT ON TABLE public.permissions IS
  'V2 Permission System: Dictionary of all possible permissions. Read-only reference table.';

COMMENT ON TABLE public.roles IS
  'V2 Permission System: Role definitions. System roles (is_basic=true) are global, custom roles belong to organizations.';

COMMENT ON TABLE public.role_permissions IS
  'V2 Permission System: Maps roles to permissions. Junction table.';

COMMENT ON TABLE public.user_role_assignments IS
  'V2 Permission System: Assigns roles to users with scope (org or branch).';

COMMENT ON TABLE public.user_permission_overrides IS
  'V2 Permission System: Individual permission grants/revokes for users.';

COMMENT ON TABLE public.user_effective_permissions IS
  'V2 Permission System: THE KEY TABLE. Contains compiled permission facts. No logic - just "user X can do Y in org Z".';

COMMENT ON FUNCTION public.is_org_member(UUID) IS
  'V2 RLS Helper: Checks if current user is an active member of the organization (tenant boundary).';

COMMENT ON FUNCTION public.has_permission(UUID, TEXT) IS
  'V2 RLS Helper: Checks if current user has a specific permission in the organization (uses compiled facts).';

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- After this migration, ALL permission-related tables have RLS enabled:
--
-- | Table                       | RLS | Pattern                                    |
-- |-----------------------------|-----|-------------------------------------------|
-- | permissions                 | ✅  | Read-only for authenticated               |
-- | roles                       | ✅  | System: all, Custom: org members          |
-- | role_permissions            | ✅  | System: all, Custom: org members          |
-- | user_role_assignments       | ✅  | Org members + members.manage              |
-- | user_permission_overrides   | ✅  | Self + members.manage                     |
-- | user_effective_permissions  | ✅  | Self only (write via triggers)            |
-- | organizations               | ✅  | Members + org.update                      |
-- | organization_members        | ✅  | Self + is_org_member + members.manage     |
-- | branches                    | ✅  | is_org_member + branches.*                |
-- | invitations                 | ✅  | invites.* + email match                   |
-- | users                       | ✅  | Self + org co-members                     |
-- ============================================================================
