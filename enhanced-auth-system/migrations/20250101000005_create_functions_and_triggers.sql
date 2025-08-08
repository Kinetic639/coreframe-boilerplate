-- =============================================
-- Enhanced Multi-Tenant Auth System - Functions and Triggers
-- Migration 5: Create advanced database functions and triggers for auth system
-- =============================================

-- =============================================
-- SEED SYSTEM PERMISSIONS
-- =============================================

-- Insert core system permissions if they don't exist
INSERT INTO permissions (slug, name, description, category, subcategory, resource_type, action, is_system, is_dangerous, scope_types) VALUES

-- System permissions
('system.admin', 'System Administrator', 'Full system administration access', 'system', 'administration', 'system', 'manage', true, true, ARRAY['organization']),
('system.user.impersonate', 'Impersonate Users', 'Ability to impersonate other users', 'system', 'security', 'user', 'impersonate', true, true, ARRAY['organization']),

-- Organization permissions
('organization.create', 'Create Organizations', 'Create new organizations', 'organization', 'management', 'organization', 'create', true, false, ARRAY['organization']),
('organization.read', 'View Organizations', 'View organization details', 'organization', 'management', 'organization', 'read', true, false, ARRAY['organization']),
('organization.update', 'Update Organizations', 'Update organization details', 'organization', 'management', 'organization', 'update', true, false, ARRAY['organization']),
('organization.delete', 'Delete Organizations', 'Delete organizations', 'organization', 'management', 'organization', 'delete', true, true, ARRAY['organization']),
('organization.profile.update', 'Update Organization Profile', 'Update organization public profile', 'organization', 'profile', 'profile', 'update', true, false, ARRAY['organization']),
('organization.settings.read', 'View Organization Settings', 'View organization settings', 'organization', 'settings', 'settings', 'read', true, false, ARRAY['organization']),
('organization.settings.update', 'Update Organization Settings', 'Update organization settings', 'organization', 'settings', 'settings', 'update', true, false, ARRAY['organization']),

-- Branch permissions
('branch.create', 'Create Branches', 'Create new branches', 'branch', 'management', 'branch', 'create', true, false, ARRAY['organization']),
('branch.read', 'View Branches', 'View branch details', 'branch', 'management', 'branch', 'read', true, false, ARRAY['organization', 'branch']),
('branch.update', 'Update Branches', 'Update branch details', 'branch', 'management', 'branch', 'update', true, false, ARRAY['organization', 'branch']),
('branch.delete', 'Delete Branches', 'Delete branches', 'branch', 'management', 'branch', 'delete', true, false, ARRAY['organization']),
('branch.profile.update', 'Update Branch Profile', 'Update branch public profile', 'branch', 'profile', 'profile', 'update', true, false, ARRAY['branch']),

-- User management permissions
('user.read', 'View Users', 'View user profiles and details', 'user', 'management', 'user', 'read', true, false, ARRAY['organization', 'branch']),
('user.update', 'Update Users', 'Update user profiles', 'user', 'management', 'user', 'update', true, false, ARRAY['organization', 'branch']),
('user.delete', 'Delete Users', 'Delete user accounts', 'user', 'management', 'user', 'delete', true, true, ARRAY['organization']),
('user.onboarding.read', 'View User Onboarding', 'View user onboarding progress', 'user', 'onboarding', 'onboarding', 'read', true, false, ARRAY['organization']),

-- Role management permissions
('role.create', 'Create Roles', 'Create custom roles', 'role', 'management', 'role', 'create', true, false, ARRAY['organization']),
('role.read', 'View Roles', 'View role details', 'role', 'management', 'role', 'read', true, false, ARRAY['organization', 'branch']),
('role.update', 'Update Roles', 'Update role details', 'role', 'management', 'role', 'update', true, false, ARRAY['organization']),
('role.delete', 'Delete Roles', 'Delete custom roles', 'role', 'management', 'role', 'delete', true, false, ARRAY['organization']),
('role.permission.manage', 'Manage Role Permissions', 'Assign permissions to roles', 'role', 'permissions', 'permission', 'manage', true, false, ARRAY['organization']),

-- User role assignment permissions
('user.role.read', 'View User Roles', 'View user role assignments', 'user', 'roles', 'assignment', 'read', true, false, ARRAY['organization', 'branch']),
('user.role.assign', 'Assign User Roles', 'Assign roles to users', 'user', 'roles', 'assignment', 'assign', true, false, ARRAY['organization', 'branch']),
('user.role.manage', 'Manage User Roles', 'Modify user role assignments', 'user', 'roles', 'assignment', 'manage', true, false, ARRAY['organization', 'branch']),
('user.role.revoke', 'Revoke User Roles', 'Revoke roles from users', 'user', 'roles', 'assignment', 'revoke', true, false, ARRAY['organization', 'branch']),

-- Permission override permissions
('permission.override.read', 'View Permission Overrides', 'View user permission overrides', 'permission', 'overrides', 'override', 'read', true, false, ARRAY['organization', 'branch']),
('permission.override.create', 'Create Permission Overrides', 'Create permission overrides for users', 'permission', 'overrides', 'override', 'create', true, false, ARRAY['organization', 'branch']),
('permission.override.manage', 'Manage Permission Overrides', 'Modify permission overrides', 'permission', 'overrides', 'override', 'manage', true, false, ARRAY['organization', 'branch']),
('permission.override.delete', 'Delete Permission Overrides', 'Remove permission overrides', 'permission', 'overrides', 'override', 'delete', true, false, ARRAY['organization', 'branch']),

-- Invitation permissions
('invitation.read', 'View Invitations', 'View organization invitations', 'invitation', 'management', 'invitation', 'read', true, false, ARRAY['organization']),
('invitation.create', 'Create Invitations', 'Send invitations to join organization', 'invitation', 'management', 'invitation', 'create', true, false, ARRAY['organization']),
('invitation.manage', 'Manage Invitations', 'Modify invitation details', 'invitation', 'management', 'invitation', 'manage', true, false, ARRAY['organization']),
('invitation.cancel', 'Cancel Invitations', 'Cancel pending invitations', 'invitation', 'management', 'invitation', 'cancel', true, false, ARRAY['organization']),
('invitation.bulk.read', 'View Bulk Invitations', 'View bulk invitation campaigns', 'invitation', 'bulk', 'bulk_invitation', 'read', true, false, ARRAY['organization']),
('invitation.bulk.create', 'Create Bulk Invitations', 'Create bulk invitation campaigns', 'invitation', 'bulk', 'bulk_invitation', 'create', true, false, ARRAY['organization']),
('invitation.bulk.manage', 'Manage Bulk Invitations', 'Modify bulk invitation campaigns', 'invitation', 'bulk', 'bulk_invitation', 'manage', true, false, ARRAY['organization']),
('invitation.template.read', 'View Invitation Templates', 'View invitation templates', 'invitation', 'templates', 'template', 'read', true, false, ARRAY['organization']),
('invitation.template.manage', 'Manage Invitation Templates', 'Create and modify invitation templates', 'invitation', 'templates', 'template', 'manage', true, false, ARRAY['organization']),
('invitation.events.read', 'View Invitation Events', 'View invitation event history', 'invitation', 'events', 'event', 'read', true, false, ARRAY['organization'])

ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- SEED SYSTEM ROLES
-- =============================================

-- Insert system roles if they don't exist
INSERT INTO roles (name, slug, description, organization_id, role_type, is_assignable, is_deletable, priority, metadata) VALUES

-- Super Admin (system-wide)
('Super Administrator', 'super_admin', 'System-wide administrator with full access', NULL, 'system', true, false, 1000, 
 '{"color": "#dc2626", "icon": "shield", "category": "system", "description": "Full system access"}'),

-- Organization Owner
('Organization Owner', 'org_owner', 'Organization owner with full organizational control', NULL, 'system', true, false, 900,
 '{"color": "#7c2d12", "icon": "crown", "category": "organization", "description": "Full organizational control"}'),

-- Organization Admin
('Organization Admin', 'org_admin', 'Organization administrator with management privileges', NULL, 'system', true, false, 800,
 '{"color": "#dc2626", "icon": "cog", "category": "organization", "description": "Organization management access"}'),

-- Branch Admin
('Branch Administrator', 'branch_admin', 'Branch administrator with branch-level control', NULL, 'system', true, false, 700,
 '{"color": "#ea580c", "icon": "settings", "category": "branch", "description": "Branch-level administration"}'),

-- Branch Manager
('Branch Manager', 'branch_manager', 'Branch manager with operational control', NULL, 'system', true, false, 600,
 '{"color": "#d97706", "icon": "briefcase", "category": "branch", "description": "Branch operational management"}'),

-- Team Lead
('Team Lead', 'team_lead', 'Team leadership with limited administrative access', NULL, 'system', true, false, 500,
 '{"color": "#ca8a04", "icon": "user-group", "category": "team", "description": "Team leadership role"}'),

-- Standard User
('Standard User', 'user', 'Standard user with basic access', NULL, 'system', true, false, 100,
 '{"color": "#059669", "icon": "user", "category": "user", "description": "Standard user access"}'),

-- Guest
('Guest', 'guest', 'Guest user with limited read-only access', NULL, 'system', true, false, 50,
 '{"color": "#6b7280", "icon": "eye", "category": "guest", "description": "Limited read-only access"}')

ON CONFLICT (organization_id, slug) DO NOTHING;

-- =============================================
-- ASSIGN PERMISSIONS TO SYSTEM ROLES
-- =============================================

-- Super Admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id, granted, scope_types)
SELECT 
  (SELECT id FROM roles WHERE slug = 'super_admin'),
  p.id,
  true,
  p.scope_types
FROM permissions p
WHERE p.deleted_at IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Organization Owner permissions
INSERT INTO role_permissions (role_id, permission_id, granted, scope_types)
SELECT 
  (SELECT id FROM roles WHERE slug = 'org_owner'),
  p.id,
  true,
  p.scope_types
FROM permissions p
WHERE p.slug IN (
  'organization.read', 'organization.update', 'organization.delete',
  'organization.profile.update', 'organization.settings.read', 'organization.settings.update',
  'branch.create', 'branch.read', 'branch.update', 'branch.delete', 'branch.profile.update',
  'user.read', 'user.update', 'user.delete', 'user.onboarding.read',
  'role.create', 'role.read', 'role.update', 'role.delete', 'role.permission.manage',
  'user.role.read', 'user.role.assign', 'user.role.manage', 'user.role.revoke',
  'permission.override.read', 'permission.override.create', 'permission.override.manage', 'permission.override.delete',
  'invitation.read', 'invitation.create', 'invitation.manage', 'invitation.cancel',
  'invitation.bulk.read', 'invitation.bulk.create', 'invitation.bulk.manage',
  'invitation.template.read', 'invitation.template.manage', 'invitation.events.read'
) AND p.deleted_at IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Organization Admin permissions (subset of owner)
INSERT INTO role_permissions (role_id, permission_id, granted, scope_types)
SELECT 
  (SELECT id FROM roles WHERE slug = 'org_admin'),
  p.id,
  true,
  p.scope_types
FROM permissions p
WHERE p.slug IN (
  'organization.read', 'organization.profile.update', 'organization.settings.read',
  'branch.create', 'branch.read', 'branch.update', 'branch.profile.update',
  'user.read', 'user.update', 'user.onboarding.read',
  'role.read', 'user.role.read', 'user.role.assign', 'user.role.manage', 'user.role.revoke',
  'invitation.read', 'invitation.create', 'invitation.manage', 'invitation.cancel',
  'invitation.bulk.read', 'invitation.bulk.create', 'invitation.bulk.manage',
  'invitation.template.read', 'invitation.template.manage', 'invitation.events.read'
) AND p.deleted_at IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Branch Admin permissions
INSERT INTO role_permissions (role_id, permission_id, granted, scope_types)
SELECT 
  (SELECT id FROM roles WHERE slug = 'branch_admin'),
  p.id,
  true,
  ARRAY['branch']::text[]
FROM permissions p
WHERE p.slug IN (
  'branch.read', 'branch.update', 'branch.profile.update',
  'user.read', 'user.update',
  'user.role.read', 'user.role.assign', 'user.role.manage',
  'invitation.read', 'invitation.create', 'invitation.manage'
) AND 'branch' = ANY(p.scope_types) AND p.deleted_at IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Branch Manager permissions
INSERT INTO role_permissions (role_id, permission_id, granted, scope_types)
SELECT 
  (SELECT id FROM roles WHERE slug = 'branch_manager'),
  p.id,
  true,
  ARRAY['branch']::text[]
FROM permissions p
WHERE p.slug IN (
  'branch.read', 'user.read', 'user.role.read'
) AND 'branch' = ANY(p.scope_types) AND p.deleted_at IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Team Lead permissions
INSERT INTO role_permissions (role_id, permission_id, granted, scope_types)
SELECT 
  (SELECT id FROM roles WHERE slug = 'team_lead'),
  p.id,
  true,
  p.scope_types
FROM permissions p
WHERE p.slug IN (
  'branch.read', 'user.read', 'user.role.read'
) AND p.deleted_at IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Standard User permissions (basic access)
INSERT INTO role_permissions (role_id, permission_id, granted, scope_types)
SELECT 
  (SELECT id FROM roles WHERE slug = 'user'),
  p.id,
  true,
  p.scope_types
FROM permissions p
WHERE p.slug IN (
  'organization.read', 'branch.read', 'user.read'
) AND p.deleted_at IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Guest permissions (minimal read access)
INSERT INTO role_permissions (role_id, permission_id, granted, scope_types)
SELECT 
  (SELECT id FROM roles WHERE slug = 'guest'),
  p.id,
  true,
  p.scope_types
FROM permissions p
WHERE p.slug IN ('organization.read', 'branch.read') AND p.deleted_at IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =============================================
-- ENHANCED CUSTOM ACCESS TOKEN HOOK
-- =============================================

-- Custom access token hook for JWT claims
CREATE OR REPLACE FUNCTION auth.hook_custom_access_token(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  user_id uuid;
  user_data record;
  user_orgs jsonb;
  user_roles jsonb;
  default_org uuid;
  default_branch uuid;
BEGIN
  -- Get user ID from the event
  user_id := (event->>'user_id')::uuid;
  
  -- Get basic user data
  SELECT 
    u.first_name,
    u.last_name,
    u.avatar_url,
    up.default_organization_id,
    up.default_branch_id
  INTO user_data
  FROM users u
  LEFT JOIN user_preferences up ON up.user_id = u.id
  WHERE u.id = user_id;
  
  -- Get user organizations with roles
  SELECT jsonb_agg(
    jsonb_build_object(
      'org_id', org_data.organization_id,
      'org_slug', org_data.org_slug,
      'org_name', org_data.org_name,
      'roles', org_data.roles,
      'branches', org_data.branches
    )
  ) INTO user_orgs
  FROM (
    SELECT DISTINCT
      o.id as organization_id,
      o.slug as org_slug,
      op.name as org_name,
      jsonb_agg(DISTINCT jsonb_build_object(
        'role_id', r.id,
        'role_slug', r.slug,
        'role_name', r.name,
        'scope', ura.scope,
        'scope_id', ura.scope_id,
        'priority', r.priority
      )) as roles,
      (
        SELECT jsonb_agg(jsonb_build_object(
          'branch_id', b.id,
          'branch_slug', b.slug,
          'branch_name', bp.name,
          'has_access', CASE 
            WHEN EXISTS (
              SELECT 1 FROM user_role_assignments branch_ura
              WHERE branch_ura.user_id = user_id
                AND branch_ura.scope = 'branch'
                AND branch_ura.scope_id = b.id
                AND branch_ura.is_active = true
                AND branch_ura.deleted_at IS NULL
            ) THEN true
            ELSE false
          END
        ))
        FROM branches b
        JOIN branch_profiles bp ON bp.branch_id = b.id
        WHERE b.organization_id = o.id
          AND b.deleted_at IS NULL
      ) as branches
    FROM user_role_assignments ura
    JOIN organizations o ON (
      (ura.scope = 'organization' AND o.id = ura.scope_id) OR
      (ura.scope = 'branch' AND o.id = (SELECT organization_id FROM branches WHERE id = ura.scope_id))
    )
    JOIN organization_profiles op ON op.organization_id = o.id
    JOIN roles r ON r.id = ura.role_id
    WHERE ura.user_id = user_id
      AND ura.is_active = true
      AND ura.deleted_at IS NULL
      AND o.deleted_at IS NULL
    GROUP BY o.id, o.slug, op.name
  ) org_data;
  
  -- Set defaults
  default_org := user_data.default_organization_id;
  default_branch := user_data.default_branch_id;
  
  -- If no default org, use first available
  IF default_org IS NULL AND user_orgs IS NOT NULL AND jsonb_array_length(user_orgs) > 0 THEN
    default_org := (user_orgs->0->>'org_id')::uuid;
  END IF;
  
  -- Build custom claims
  claims := jsonb_build_object(
    'user_id', user_id,
    'first_name', user_data.first_name,
    'last_name', user_data.last_name,
    'avatar_url', user_data.avatar_url,
    'organizations', COALESCE(user_orgs, '[]'::jsonb),
    'default_organization_id', default_org,
    'default_branch_id', default_branch,
    'updated_at', extract(epoch from now())
  );
  
  -- Return the modified event with custom claims
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant execute permission to supabase_auth_admin
GRANT EXECUTE ON FUNCTION auth.hook_custom_access_token TO supabase_auth_admin;

-- =============================================
-- ORGANIZATION OWNER ASSIGNMENT FUNCTIONS
-- =============================================

-- Function to automatically assign organization owner role
CREATE OR REPLACE FUNCTION assign_organization_owner_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  owner_role_id uuid;
BEGIN
  -- Get the organization owner role
  SELECT id INTO owner_role_id
  FROM roles
  WHERE slug = 'org_owner'
    AND organization_id IS NULL
    AND deleted_at IS NULL;
  
  -- Assign owner role to the creator
  IF NEW.created_by IS NOT NULL AND owner_role_id IS NOT NULL THEN
    INSERT INTO user_role_assignments (
      user_id,
      role_id,
      scope,
      scope_id,
      assigned_by,
      assignment_type,
      reason
    ) VALUES (
      NEW.created_by,
      owner_role_id,
      'organization',
      NEW.id,
      NEW.created_by,
      'auto',
      'Automatically assigned as organization creator'
    )
    ON CONFLICT (user_id, role_id, scope, scope_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to assign organization owner role on organization creation
CREATE TRIGGER assign_organization_owner_trigger
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION assign_organization_owner_role();

-- =============================================
-- PERMISSION CALCULATION OPTIMIZATION
-- =============================================

-- Function to refresh user permissions cache (for future caching implementation)
CREATE OR REPLACE FUNCTION refresh_user_permissions_cache(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- This function is a placeholder for future permission caching implementation
  -- It would invalidate and rebuild permission cache for a specific user
  
  -- For now, we just ensure the user's role assignments are up to date
  UPDATE user_role_assignments
  SET updated_at = now()
  WHERE user_id = target_user_id
    AND deleted_at IS NULL;
END;
$$;

-- Function to check if user can perform action on resource
CREATE OR REPLACE FUNCTION user_can_access_resource(
  target_user_id uuid,
  resource_type text,
  resource_id uuid,
  required_permission text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  resource_org_id uuid;
  resource_branch_id uuid;
  has_org_permission boolean := false;
  has_branch_permission boolean := false;
BEGIN
  -- Determine resource organization and branch
  CASE resource_type
    WHEN 'organization' THEN
      resource_org_id := resource_id;
    WHEN 'branch' THEN
      SELECT organization_id, id INTO resource_org_id, resource_branch_id
      FROM branches WHERE id = resource_id;
    ELSE
      RETURN false;
  END CASE;
  
  -- Check organization-level permission
  IF resource_org_id IS NOT NULL THEN
    has_org_permission := user_has_permission(
      target_user_id,
      required_permission,
      'organization',
      resource_org_id
    );
  END IF;
  
  -- Check branch-level permission if applicable
  IF resource_branch_id IS NOT NULL THEN
    has_branch_permission := user_has_permission(
      target_user_id,
      required_permission,
      'branch',
      resource_branch_id
    );
  END IF;
  
  -- Return true if user has permission at any applicable level
  RETURN has_org_permission OR has_branch_permission;
END;
$$;

-- =============================================
-- CLEANUP AND MAINTENANCE FUNCTIONS
-- =============================================

-- Function to clean up expired role assignments
CREATE OR REPLACE FUNCTION cleanup_expired_role_assignments()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  expired_count integer;
BEGIN
  WITH expired_assignments AS (
    UPDATE user_role_assignments
    SET is_active = false,
        updated_at = now()
    WHERE expires_at < now()
      AND is_active = true
      AND deleted_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO expired_count FROM expired_assignments;
  
  RETURN expired_count;
END;
$$;

-- Function to clean up expired permission overrides
CREATE OR REPLACE FUNCTION cleanup_expired_permission_overrides()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  expired_count integer;
BEGIN
  WITH expired_overrides AS (
    DELETE FROM user_permission_overrides
    WHERE expires_at < now()
      AND deleted_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO expired_overrides FROM expired_overrides;
  
  RETURN expired_count;
END;
$$;

-- Function to validate role hierarchy (prevent circular references)
CREATE OR REPLACE FUNCTION validate_role_hierarchy()
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  has_cycles boolean := false;
BEGIN
  -- Check for circular references in role hierarchy
  WITH RECURSIVE role_hierarchy AS (
    -- Base case: roles without parents
    SELECT id, parent_role_id, ARRAY[id] as path
    FROM roles
    WHERE parent_role_id IS NULL AND deleted_at IS NULL
    
    UNION ALL
    
    -- Recursive case: roles with parents
    SELECT r.id, r.parent_role_id, rh.path || r.id
    FROM roles r
    JOIN role_hierarchy rh ON r.parent_role_id = rh.id
    WHERE r.deleted_at IS NULL
      AND NOT (r.id = ANY(rh.path)) -- Prevent infinite recursion
  )
  SELECT EXISTS (
    SELECT 1 FROM roles r
    WHERE r.parent_role_id IS NOT NULL
      AND r.deleted_at IS NULL
      AND r.id NOT IN (SELECT id FROM role_hierarchy)
  ) INTO has_cycles;
  
  RETURN NOT has_cycles;
END;
$$;

-- =============================================
-- AUDIT LOGGING FUNCTIONS
-- =============================================

-- Function to log permission changes
CREATE OR REPLACE FUNCTION log_permission_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- This is a placeholder for audit logging functionality
  -- In a full implementation, this would log changes to an audit table
  
  IF TG_OP = 'INSERT' THEN
    -- Log permission grant
    NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log permission modification
    NULL;
  ELSIF TG_OP = 'DELETE' THEN
    -- Log permission revocation
    NULL;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Audit triggers (disabled by default - enable when audit system is implemented)
-- CREATE TRIGGER log_role_permission_changes
--   AFTER INSERT OR UPDATE OR DELETE ON role_permissions
--   FOR EACH ROW
--   EXECUTE FUNCTION log_permission_change();

-- CREATE TRIGGER log_user_role_assignment_changes
--   AFTER INSERT OR UPDATE OR DELETE ON user_role_assignments
--   FOR EACH ROW
--   EXECUTE FUNCTION log_permission_change();

-- CREATE TRIGGER log_permission_override_changes
--   AFTER INSERT OR UPDATE OR DELETE ON user_permission_overrides
--   FOR EACH ROW
--   EXECUTE FUNCTION log_permission_change();

-- =============================================
-- DATABASE MAINTENANCE SCHEDULED FUNCTIONS
-- =============================================

-- Function to run regular maintenance tasks
CREATE OR REPLACE FUNCTION run_auth_maintenance()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  expired_roles integer;
  expired_overrides integer;
  expired_invitations integer;
  cleaned_events integer;
BEGIN
  -- Clean up expired role assignments
  expired_roles := cleanup_expired_role_assignments();
  
  -- Clean up expired permission overrides
  expired_overrides := cleanup_expired_permission_overrides();
  
  -- Clean up expired invitations
  expired_invitations := expire_old_invitations();
  
  -- Clean up old invitation events (keep 90 days)
  cleaned_events := cleanup_old_invitation_events(90);
  
  -- Log maintenance results (would go to audit log in full implementation)
  RAISE NOTICE 'Auth maintenance completed: % expired roles, % expired overrides, % expired invitations, % cleaned events',
    expired_roles, expired_overrides, expired_invitations, cleaned_events;
END;
$$;

-- =============================================
-- SECURITY FUNCTIONS
-- =============================================

-- Function to detect suspicious permission changes
CREATE OR REPLACE FUNCTION detect_suspicious_permission_activity(
  target_user_id uuid,
  time_window_minutes integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  recent_changes jsonb;
  change_count integer;
  elevated_permissions integer;
BEGIN
  -- Count recent permission changes for user
  SELECT 
    COUNT(*),
    jsonb_agg(jsonb_build_object(
      'table', 'user_role_assignments',
      'action', 'granted',
      'timestamp', created_at,
      'role_id', role_id
    ))
  INTO change_count, recent_changes
  FROM user_role_assignments
  WHERE user_id = target_user_id
    AND created_at > now() - (time_window_minutes || ' minutes')::interval;
  
  -- Count elevated permissions granted
  SELECT COUNT(*) INTO elevated_permissions
  FROM user_role_assignments ura
  JOIN roles r ON r.id = ura.role_id
  WHERE ura.user_id = target_user_id
    AND ura.created_at > now() - (time_window_minutes || ' minutes')::interval
    AND r.priority > 500; -- High-privilege roles
  
  RETURN jsonb_build_object(
    'user_id', target_user_id,
    'time_window_minutes', time_window_minutes,
    'total_changes', change_count,
    'elevated_permissions', elevated_permissions,
    'is_suspicious', (change_count > 5 OR elevated_permissions > 2),
    'recent_changes', COALESCE(recent_changes, '[]'::jsonb)
  );
END;
$$;

-- =============================================
-- SCHEDULED TASKS SETUP (Comments for manual setup)
-- =============================================

-- Note: These would need to be set up manually with pg_cron extension
-- Examples of scheduled tasks that should be configured:

-- Run auth maintenance every hour
-- SELECT cron.schedule('auth-maintenance', '0 * * * *', 'SELECT run_auth_maintenance();');

-- Expire invitations every 30 minutes  
-- SELECT cron.schedule('expire-invitations', '*/30 * * * *', 'SELECT expire_old_invitations();');

-- Clean up old invitation events daily at 2 AM
-- SELECT cron.schedule('cleanup-invitation-events', '0 2 * * *', 'SELECT cleanup_old_invitation_events(90);');

-- Validate role hierarchy daily at 3 AM
-- SELECT cron.schedule('validate-roles', '0 3 * * *', 'SELECT validate_role_hierarchy();');

-- =============================================
-- PERFORMANCE OPTIMIZATION
-- =============================================

-- Additional indexes for complex queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_role_assignments_composite 
  ON user_role_assignments(user_id, scope, scope_id, is_active) 
  WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_role_permissions_composite
  ON role_permissions(role_id, granted, permission_id) 
  WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_permissions_system_dangerous
  ON permissions(is_system, is_dangerous) 
  WHERE deleted_at IS NULL;

-- =============================================
-- FINAL COMMENTS AND DOCUMENTATION
-- =============================================

COMMENT ON FUNCTION auth.hook_custom_access_token IS 'Custom JWT claims hook for enhanced auth system';
COMMENT ON FUNCTION assign_organization_owner_role IS 'Automatically assigns owner role to organization creator';
COMMENT ON FUNCTION user_can_access_resource IS 'Checks if user can perform action on specific resource';
COMMENT ON FUNCTION cleanup_expired_role_assignments IS 'Deactivates expired role assignments';
COMMENT ON FUNCTION cleanup_expired_permission_overrides IS 'Removes expired permission overrides';
COMMENT ON FUNCTION run_auth_maintenance IS 'Runs regular maintenance tasks for auth system';
COMMENT ON FUNCTION detect_suspicious_permission_activity IS 'Detects potentially suspicious permission changes';

-- =============================================
-- FINAL VALIDATION
-- =============================================

-- Validate that all required system roles have been created
DO $$
DECLARE
  required_roles text[] := ARRAY['super_admin', 'org_owner', 'org_admin', 'branch_admin', 'branch_manager', 'team_lead', 'user', 'guest'];
  role_slug text;
  missing_roles text[] := ARRAY[]::text[];
BEGIN
  FOREACH role_slug IN ARRAY required_roles LOOP
    IF NOT EXISTS (SELECT 1 FROM roles WHERE slug = role_slug AND organization_id IS NULL) THEN
      missing_roles := missing_roles || role_slug;
    END IF;
  END LOOP;
  
  IF array_length(missing_roles, 1) > 0 THEN
    RAISE EXCEPTION 'Missing required system roles: %', array_to_string(missing_roles, ', ');
  END IF;
  
  RAISE NOTICE 'Auth system migration completed successfully. All required roles and permissions have been created.';
END;
$$;