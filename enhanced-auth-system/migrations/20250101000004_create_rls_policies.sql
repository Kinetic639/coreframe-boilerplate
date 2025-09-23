-- =============================================
-- Enhanced Multi-Tenant Auth System - Row Level Security Policies
-- Migration 4: Create comprehensive RLS policies for data security
-- =============================================

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================

-- Core entities
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_onboarding ENABLE ROW LEVEL SECURITY;

-- Permissions and roles
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;

-- Invitations
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitation_events ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ORGANIZATIONS RLS POLICIES
-- =============================================

-- Users can view organizations they belong to
CREATE POLICY "Users can view their organizations" ON organizations
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT scope_id 
      FROM user_role_assignments 
      WHERE user_id = (SELECT auth.uid()) 
        AND scope = 'organization'
        AND is_active = true
        AND deleted_at IS NULL
    )
  );

-- Only org owners can create organizations (handled by application logic)
CREATE POLICY "Organization creation restricted" ON organizations
  FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

-- Only org owners can update their organizations
CREATE POLICY "Org owners can update organizations" ON organizations
  FOR UPDATE TO authenticated
  USING (
    user_has_permission(
      (SELECT auth.uid()),
      'organization.update',
      'organization',
      id
    )
  )
  WITH CHECK (
    user_has_permission(
      (SELECT auth.uid()),
      'organization.update',
      'organization',
      id
    )
  );

-- Only org owners can delete organizations
CREATE POLICY "Org owners can delete organizations" ON organizations
  FOR DELETE TO authenticated
  USING (
    user_has_permission(
      (SELECT auth.uid()),
      'organization.delete',
      'organization',
      id
    )
  );

-- =============================================
-- ORGANIZATION PROFILES RLS POLICIES
-- =============================================

-- Public profiles are viewable by organization members
CREATE POLICY "Organization members can view profiles" ON organization_profiles
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT scope_id 
      FROM user_role_assignments 
      WHERE user_id = (SELECT auth.uid()) 
        AND scope = 'organization'
        AND is_active = true
        AND deleted_at IS NULL
    )
  );

-- Only users with permission can update organization profiles
CREATE POLICY "Authorized users can update org profiles" ON organization_profiles
  FOR UPDATE TO authenticated
  USING (
    user_has_permission(
      (SELECT auth.uid()),
      'organization.profile.update',
      'organization',
      organization_id
    )
  )
  WITH CHECK (
    user_has_permission(
      (SELECT auth.uid()),
      'organization.profile.update',
      'organization',
      organization_id
    )
  );

-- Auto-created on organization insert (no explicit insert policy needed)

-- =============================================
-- ORGANIZATION SETTINGS RLS POLICIES
-- =============================================

-- Only users with admin permissions can view organization settings
CREATE POLICY "Admins can view organization settings" ON organization_settings
  FOR SELECT TO authenticated
  USING (
    user_has_permission(
      (SELECT auth.uid()),
      'organization.settings.read',
      'organization',
      organization_id
    )
  );

-- Only users with admin permissions can update organization settings
CREATE POLICY "Admins can update organization settings" ON organization_settings
  FOR UPDATE TO authenticated
  USING (
    user_has_permission(
      (SELECT auth.uid()),
      'organization.settings.update',
      'organization',
      organization_id
    )
  )
  WITH CHECK (
    user_has_permission(
      (SELECT auth.uid()),
      'organization.settings.update',
      'organization',
      organization_id
    )
  );

-- =============================================
-- BRANCHES RLS POLICIES
-- =============================================

-- Users can view branches they have access to
CREATE POLICY "Users can view accessible branches" ON branches
  FOR SELECT TO authenticated
  USING (
    -- User has organization access
    organization_id IN (
      SELECT scope_id 
      FROM user_role_assignments 
      WHERE user_id = (SELECT auth.uid()) 
        AND scope = 'organization'
        AND is_active = true
        AND deleted_at IS NULL
    )
    OR
    -- User has specific branch access
    id IN (
      SELECT scope_id 
      FROM user_role_assignments 
      WHERE user_id = (SELECT auth.uid()) 
        AND scope = 'branch'
        AND is_active = true
        AND deleted_at IS NULL
    )
  );

-- Users with branch creation permissions can create branches
CREATE POLICY "Authorized users can create branches" ON branches
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_permission(
      (SELECT auth.uid()),
      'branch.create',
      'organization',
      organization_id
    )
  );

-- Users with branch update permissions can update branches
CREATE POLICY "Authorized users can update branches" ON branches
  FOR UPDATE TO authenticated
  USING (
    user_has_permission(
      (SELECT auth.uid()),
      'branch.update',
      CASE WHEN id IN (
        SELECT scope_id FROM user_role_assignments 
        WHERE user_id = (SELECT auth.uid()) AND scope = 'branch'
      ) THEN 'branch' ELSE 'organization' END,
      CASE WHEN id IN (
        SELECT scope_id FROM user_role_assignments 
        WHERE user_id = (SELECT auth.uid()) AND scope = 'branch'
      ) THEN id ELSE organization_id END
    )
  )
  WITH CHECK (
    user_has_permission(
      (SELECT auth.uid()),
      'branch.update',
      CASE WHEN id IN (
        SELECT scope_id FROM user_role_assignments 
        WHERE user_id = (SELECT auth.uid()) AND scope = 'branch'
      ) THEN 'branch' ELSE 'organization' END,
      CASE WHEN id IN (
        SELECT scope_id FROM user_role_assignments 
        WHERE user_id = (SELECT auth.uid()) AND scope = 'branch'
      ) THEN id ELSE organization_id END
    )
  );

-- Users with branch deletion permissions can delete branches
CREATE POLICY "Authorized users can delete branches" ON branches
  FOR DELETE TO authenticated
  USING (
    user_has_permission(
      (SELECT auth.uid()),
      'branch.delete',
      'organization',
      organization_id
    )
  );

-- =============================================
-- BRANCH PROFILES RLS POLICIES
-- =============================================

-- Users can view branch profiles for accessible branches
CREATE POLICY "Users can view accessible branch profiles" ON branch_profiles
  FOR SELECT TO authenticated
  USING (
    branch_id IN (
      SELECT b.id FROM branches b
      WHERE 
        -- User has organization access
        b.organization_id IN (
          SELECT scope_id 
          FROM user_role_assignments 
          WHERE user_id = (SELECT auth.uid()) 
            AND scope = 'organization'
            AND is_active = true
            AND deleted_at IS NULL
        )
        OR
        -- User has specific branch access
        b.id IN (
          SELECT scope_id 
          FROM user_role_assignments 
          WHERE user_id = (SELECT auth.uid()) 
            AND scope = 'branch'
            AND is_active = true
            AND deleted_at IS NULL
        )
    )
  );

-- Users with branch profile update permissions can update profiles
CREATE POLICY "Authorized users can update branch profiles" ON branch_profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM branches b
      WHERE b.id = branch_id
        AND user_has_permission(
          (SELECT auth.uid()),
          'branch.profile.update',
          'branch',
          b.id
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM branches b
      WHERE b.id = branch_id
        AND user_has_permission(
          (SELECT auth.uid()),
          'branch.profile.update',
          'branch',
          b.id
        )
    )
  );

-- =============================================
-- USERS RLS POLICIES
-- =============================================

-- Users can view their own profile
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

-- Users can view profiles of members in their organizations
CREATE POLICY "Users can view organization member profiles" ON users
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT DISTINCT ura.user_id
      FROM user_role_assignments ura
      WHERE ura.scope_id IN (
        SELECT my_ura.scope_id
        FROM user_role_assignments my_ura
        WHERE my_ura.user_id = (SELECT auth.uid())
          AND my_ura.scope = 'organization'
          AND my_ura.is_active = true
          AND my_ura.deleted_at IS NULL
      )
      AND ura.scope = 'organization'
      AND ura.is_active = true
      AND ura.deleted_at IS NULL
    )
    AND user_has_permission(
      (SELECT auth.uid()),
      'user.read',
      'organization',
      (
        SELECT ura.scope_id
        FROM user_role_assignments ura
        WHERE ura.user_id = id
          AND ura.scope = 'organization'
          AND ura.is_active = true
          AND ura.deleted_at IS NULL
        LIMIT 1
      )
    )
  );

-- Users can update their own profile
CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- Only users with user management permissions can update other profiles
CREATE POLICY "Authorized users can update member profiles" ON users
  FOR UPDATE TO authenticated
  USING (
    id != (SELECT auth.uid()) -- Not updating own profile
    AND EXISTS (
      SELECT 1
      FROM user_role_assignments ura
      WHERE ura.user_id = id
        AND ura.scope = 'organization'
        AND user_has_permission(
          (SELECT auth.uid()),
          'user.update',
          'organization',
          ura.scope_id
        )
        AND ura.is_active = true
        AND ura.deleted_at IS NULL
    )
  )
  WITH CHECK (
    id != (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM user_role_assignments ura
      WHERE ura.user_id = id
        AND ura.scope = 'organization'
        AND user_has_permission(
          (SELECT auth.uid()),
          'user.update',
          'organization',
          ura.scope_id
        )
        AND ura.is_active = true
        AND ura.deleted_at IS NULL
    )
  );

-- =============================================
-- USER PREFERENCES RLS POLICIES
-- =============================================

-- Users can only access their own preferences
CREATE POLICY "Users can access their own preferences" ON user_preferences
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- =============================================
-- USER ONBOARDING RLS POLICIES
-- =============================================

-- Users can view their own onboarding
CREATE POLICY "Users can view their own onboarding" ON user_onboarding
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Users can update their own onboarding
CREATE POLICY "Users can update their own onboarding" ON user_onboarding
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Users with user management permissions can view member onboarding
CREATE POLICY "Admins can view member onboarding" ON user_onboarding
  FOR SELECT TO authenticated
  USING (
    user_has_permission(
      (SELECT auth.uid()),
      'user.onboarding.read',
      'organization',
      organization_id
    )
  );

-- =============================================
-- PERMISSIONS RLS POLICIES
-- =============================================

-- All authenticated users can view system permissions (for UI purposes)
CREATE POLICY "Users can view permissions" ON permissions
  FOR SELECT TO authenticated
  USING (true);

-- Only super admins can modify permissions (handled by application logic)
CREATE POLICY "Super admins can manage permissions" ON permissions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_role_assignments ura
      JOIN roles r ON r.id = ura.role_id
      WHERE ura.user_id = (SELECT auth.uid())
        AND r.slug = 'super_admin'
        AND ura.is_active = true
        AND ura.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_role_assignments ura
      JOIN roles r ON r.id = ura.role_id
      WHERE ura.user_id = (SELECT auth.uid())
        AND r.slug = 'super_admin'
        AND ura.is_active = true
        AND ura.deleted_at IS NULL
    )
  );

-- =============================================
-- ROLES RLS POLICIES
-- =============================================

-- Users can view roles in their organizations
CREATE POLICY "Users can view organization roles" ON roles
  FOR SELECT TO authenticated
  USING (
    role_type = 'system' -- System roles visible to all
    OR
    organization_id IN (
      SELECT scope_id 
      FROM user_role_assignments 
      WHERE user_id = (SELECT auth.uid()) 
        AND scope = 'organization'
        AND is_active = true
        AND deleted_at IS NULL
    )
  );

-- Users with role management permissions can create custom roles
CREATE POLICY "Authorized users can create roles" ON roles
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND user_has_permission(
      (SELECT auth.uid()),
      'role.create',
      'organization',
      organization_id
    )
  );

-- Users with role management permissions can update custom roles
CREATE POLICY "Authorized users can update roles" ON roles
  FOR UPDATE TO authenticated
  USING (
    organization_id IS NOT NULL
    AND is_deletable = true
    AND user_has_permission(
      (SELECT auth.uid()),
      'role.update',
      'organization',
      organization_id
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND is_deletable = true
    AND user_has_permission(
      (SELECT auth.uid()),
      'role.update',
      'organization',
      organization_id
    )
  );

-- Users with role management permissions can delete custom roles
CREATE POLICY "Authorized users can delete roles" ON roles
  FOR DELETE TO authenticated
  USING (
    organization_id IS NOT NULL
    AND is_deletable = true
    AND user_has_permission(
      (SELECT auth.uid()),
      'role.delete',
      'organization',
      organization_id
    )
  );

-- =============================================
-- ROLE PERMISSIONS RLS POLICIES
-- =============================================

-- Users can view role permissions for roles they can see
CREATE POLICY "Users can view role permissions" ON role_permissions
  FOR SELECT TO authenticated
  USING (
    role_id IN (
      SELECT id FROM roles r
      WHERE 
        r.role_type = 'system'
        OR
        r.organization_id IN (
          SELECT scope_id 
          FROM user_role_assignments 
          WHERE user_id = (SELECT auth.uid()) 
            AND scope = 'organization'
            AND is_active = true
            AND deleted_at IS NULL
        )
    )
  );

-- Users with role management permissions can modify role permissions
CREATE POLICY "Authorized users can manage role permissions" ON role_permissions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = role_id
        AND r.organization_id IS NOT NULL
        AND user_has_permission(
          (SELECT auth.uid()),
          'role.permission.manage',
          'organization',
          r.organization_id
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = role_id
        AND r.organization_id IS NOT NULL
        AND user_has_permission(
          (SELECT auth.uid()),
          'role.permission.manage',
          'organization',
          r.organization_id
        )
    )
  );

-- =============================================
-- USER ROLE ASSIGNMENTS RLS POLICIES
-- =============================================

-- Users can view their own role assignments
CREATE POLICY "Users can view their own role assignments" ON user_role_assignments
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Users can view role assignments in their organizations (with permission)
CREATE POLICY "Users can view organization role assignments" ON user_role_assignments
  FOR SELECT TO authenticated
  USING (
    user_has_permission(
      (SELECT auth.uid()),
      'user.role.read',
      scope,
      scope_id
    )
  );

-- Users with role management permissions can assign roles
CREATE POLICY "Authorized users can assign roles" ON user_role_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_permission(
      (SELECT auth.uid()),
      'user.role.assign',
      scope,
      scope_id
    )
  );

-- Users with role management permissions can modify role assignments
CREATE POLICY "Authorized users can modify role assignments" ON user_role_assignments
  FOR UPDATE TO authenticated
  USING (
    user_has_permission(
      (SELECT auth.uid()),
      'user.role.manage',
      scope,
      scope_id
    )
  )
  WITH CHECK (
    user_has_permission(
      (SELECT auth.uid()),
      'user.role.manage',
      scope,
      scope_id
    )
  );

-- Users with role management permissions can remove role assignments
CREATE POLICY "Authorized users can remove role assignments" ON user_role_assignments
  FOR DELETE TO authenticated
  USING (
    user_has_permission(
      (SELECT auth.uid()),
      'user.role.revoke',
      scope,
      scope_id
    )
  );

-- =============================================
-- USER PERMISSION OVERRIDES RLS POLICIES
-- =============================================

-- Users can view their own permission overrides
CREATE POLICY "Users can view their own permission overrides" ON user_permission_overrides
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Users can view permission overrides in their organizations (with permission)
CREATE POLICY "Users can view organization permission overrides" ON user_permission_overrides
  FOR SELECT TO authenticated
  USING (
    user_has_permission(
      (SELECT auth.uid()),
      'permission.override.read',
      scope,
      scope_id
    )
  );

-- Users with permission override permissions can create overrides
CREATE POLICY "Authorized users can create permission overrides" ON user_permission_overrides
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_permission(
      (SELECT auth.uid()),
      'permission.override.create',
      scope,
      scope_id
    )
  );

-- Users with permission override permissions can modify overrides
CREATE POLICY "Authorized users can modify permission overrides" ON user_permission_overrides
  FOR UPDATE TO authenticated
  USING (
    user_has_permission(
      (SELECT auth.uid()),
      'permission.override.manage',
      scope,
      scope_id
    )
  )
  WITH CHECK (
    user_has_permission(
      (SELECT auth.uid()),
      'permission.override.manage',
      scope,
      scope_id
    )
  );

-- Users with permission override permissions can delete overrides
CREATE POLICY "Authorized users can delete permission overrides" ON user_permission_overrides
  FOR DELETE TO authenticated
  USING (
    user_has_permission(
      (SELECT auth.uid()),
      'permission.override.delete',
      scope,
      scope_id
    )
  );

-- =============================================
-- INVITATIONS RLS POLICIES
-- =============================================

-- Users can view invitations to organizations they belong to
CREATE POLICY "Users can view organization invitations" ON invitations
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT scope_id 
      FROM user_role_assignments 
      WHERE user_id = (SELECT auth.uid()) 
        AND scope = 'organization'
        AND is_active = true
        AND deleted_at IS NULL
    )
    AND user_has_permission(
      (SELECT auth.uid()),
      'invitation.read',
      'organization',
      organization_id
    )
  );

-- Users with invitation permissions can create invitations
CREATE POLICY "Authorized users can create invitations" ON invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_permission(
      (SELECT auth.uid()),
      'invitation.create',
      'organization',
      organization_id
    )
  );

-- Users with invitation permissions can update invitations
CREATE POLICY "Authorized users can update invitations" ON invitations
  FOR UPDATE TO authenticated
  USING (
    user_has_permission(
      (SELECT auth.uid()),
      'invitation.manage',
      'organization',
      organization_id
    )
  )
  WITH CHECK (
    user_has_permission(
      (SELECT auth.uid()),
      'invitation.manage',
      'organization',
      organization_id
    )
  );

-- Users with invitation permissions can cancel invitations
CREATE POLICY "Authorized users can cancel invitations" ON invitations
  FOR DELETE TO authenticated
  USING (
    user_has_permission(
      (SELECT auth.uid()),
      'invitation.cancel',
      'organization',
      organization_id
    )
  );

-- =============================================
-- BULK INVITATIONS RLS POLICIES
-- =============================================

-- Users can view bulk invitations for their organizations
CREATE POLICY "Users can view organization bulk invitations" ON bulk_invitations
  FOR SELECT TO authenticated
  USING (
    user_has_permission(
      (SELECT auth.uid()),
      'invitation.bulk.read',
      'organization',
      organization_id
    )
  );

-- Users with bulk invitation permissions can create bulk invitations
CREATE POLICY "Authorized users can create bulk invitations" ON bulk_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_permission(
      (SELECT auth.uid()),
      'invitation.bulk.create',
      'organization',
      organization_id
    )
  );

-- Users with bulk invitation permissions can update bulk invitations
CREATE POLICY "Authorized users can update bulk invitations" ON bulk_invitations
  FOR UPDATE TO authenticated
  USING (
    user_has_permission(
      (SELECT auth.uid()),
      'invitation.bulk.manage',
      'organization',
      organization_id
    )
  )
  WITH CHECK (
    user_has_permission(
      (SELECT auth.uid()),
      'invitation.bulk.manage',
      'organization',
      organization_id
    )
  );

-- =============================================
-- INVITATION TEMPLATES RLS POLICIES
-- =============================================

-- Users can view templates for their organizations
CREATE POLICY "Users can view organization invitation templates" ON invitation_templates
  FOR SELECT TO authenticated
  USING (
    user_has_permission(
      (SELECT auth.uid()),
      'invitation.template.read',
      'organization',
      organization_id
    )
  );

-- Users with template permissions can manage templates
CREATE POLICY "Authorized users can manage invitation templates" ON invitation_templates
  FOR ALL TO authenticated
  USING (
    user_has_permission(
      (SELECT auth.uid()),
      'invitation.template.manage',
      'organization',
      organization_id
    )
  )
  WITH CHECK (
    user_has_permission(
      (SELECT auth.uid()),
      'invitation.template.manage',
      'organization',
      organization_id
    )
  );

-- =============================================
-- INVITATION EVENTS RLS POLICIES
-- =============================================

-- Users can view invitation events for invitations they can see
CREATE POLICY "Users can view invitation events" ON invitation_events
  FOR SELECT TO authenticated
  USING (
    invitation_id IN (
      SELECT id FROM invitations i
      WHERE i.organization_id IN (
        SELECT scope_id 
        FROM user_role_assignments 
        WHERE user_id = (SELECT auth.uid()) 
          AND scope = 'organization'
          AND is_active = true
          AND deleted_at IS NULL
      )
      AND user_has_permission(
        (SELECT auth.uid()),
        'invitation.events.read',
        'organization',
        i.organization_id
      )
    )
  );

-- Events are inserted by system functions, no explicit insert policy needed

-- =============================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON POLICY "Users can view their organizations" ON organizations IS 'Users can only see organizations they are members of';
COMMENT ON POLICY "Users can view their own profile" ON users IS 'Users have full access to their own profile data';
COMMENT ON POLICY "Authorized users can create invitations" ON invitations IS 'Only users with invitation.create permission can create invitations';