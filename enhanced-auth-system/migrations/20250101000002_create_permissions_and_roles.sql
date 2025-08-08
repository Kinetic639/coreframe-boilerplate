-- =============================================
-- Enhanced Multi-Tenant Auth System - Permissions & Roles
-- Migration 2: Create comprehensive permissions and roles system
-- =============================================

-- =============================================
-- PERMISSIONS SYSTEM
-- =============================================

-- Enhanced permissions table with categories and dependencies
CREATE TABLE permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  
  -- Categorization
  category text NOT NULL, -- e.g., 'system', 'organization', 'branch', 'user'
  subcategory text, -- e.g., 'management', 'analytics', 'security'
  resource_type text, -- What resource this permission applies to
  action text NOT NULL, -- create, read, update, delete, manage, etc.
  
  -- Permission configuration
  scope_types text[] DEFAULT array['organization', 'branch'], -- Valid scopes for this permission
  dependencies uuid[], -- Other permission IDs this depends on
  conflicts_with uuid[], -- Permissions that conflict with this one
  
  -- Metadata
  is_system boolean DEFAULT false, -- System permissions cannot be deleted
  is_dangerous boolean DEFAULT false, -- Requires special confirmation
  requires_mfa boolean DEFAULT false, -- Permission requires MFA to use
  priority integer DEFAULT 0, -- Higher priority permissions override lower ones
  
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- =============================================
-- ROLES SYSTEM
-- =============================================

-- Enhanced roles table with hierarchy and templates
CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  
  -- Organization scope (NULL for system roles)
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Role hierarchy and inheritance
  parent_role_id uuid REFERENCES roles(id) ON DELETE SET NULL,
  
  -- Role type and configuration
  role_type text DEFAULT 'custom' CHECK (role_type IN ('system', 'template', 'custom')),
  is_assignable boolean DEFAULT true,
  is_deletable boolean DEFAULT true,
  
  -- Role constraints
  priority integer DEFAULT 0, -- Higher priority roles override lower ones
  max_users integer, -- Limit on number of users with this role
  
  -- Auto-assignment rules
  auto_assign_conditions jsonb DEFAULT '{}'::jsonb,
  
  metadata jsonb DEFAULT '{
    "color": "#6366f1",
    "icon": "users",
    "category": "general"
  }'::jsonb,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  
  UNIQUE(organization_id, slug)
);

-- Role permissions junction table with conditions
CREATE TABLE role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
  permission_id uuid REFERENCES permissions(id) ON DELETE CASCADE NOT NULL,
  
  -- Permission grant configuration
  granted boolean DEFAULT true,
  scope_types text[] DEFAULT array['organization', 'branch'], -- Which scopes this applies to
  
  -- Conditional permissions
  conditions jsonb DEFAULT '{}'::jsonb, -- Time-based, resource-based, context-based conditions
  
  -- Permission metadata
  granted_by uuid REFERENCES users(id),
  granted_at timestamptz DEFAULT now(),
  expires_at timestamptz, -- Temporary permissions
  reason text, -- Reason for granting this permission
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  
  UNIQUE(role_id, permission_id)
);

-- User role assignments with scope and conditions
CREATE TABLE user_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
  
  -- Scope definition
  scope text NOT NULL CHECK (scope IN ('organization', 'branch')),
  scope_id uuid NOT NULL, -- References organizations.id or branches.id
  
  -- Assignment metadata
  assigned_by uuid REFERENCES users(id),
  assignment_type text DEFAULT 'manual' CHECK (assignment_type IN ('manual', 'auto', 'inherited', 'temporary')),
  reason text,
  
  -- Temporal constraints
  starts_at timestamptz DEFAULT now(),
  expires_at timestamptz, -- Temporary role assignments
  is_active boolean DEFAULT true,
  
  -- Assignment conditions
  conditions jsonb DEFAULT '{}'::jsonb,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  
  UNIQUE(user_id, role_id, scope, scope_id)
);

-- Permission overrides for granular control
CREATE TABLE user_permission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  permission_id uuid REFERENCES permissions(id) ON DELETE CASCADE NOT NULL,
  
  -- Scope definition
  scope text NOT NULL CHECK (scope IN ('organization', 'branch')),
  scope_id uuid NOT NULL,
  
  -- Override configuration
  granted boolean NOT NULL,
  reason text NOT NULL, -- Required explanation for override
  
  -- Override metadata
  override_type text DEFAULT 'manual' CHECK (override_type IN ('manual', 'emergency', 'temporary', 'exception')),
  granted_by uuid REFERENCES users(id) NOT NULL,
  reviewed_by uuid REFERENCES users(id),
  review_status text DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  
  -- Temporal constraints
  starts_at timestamptz DEFAULT now(),
  expires_at timestamptz, -- Auto-expiring overrides
  
  -- Approval workflow
  requires_approval boolean DEFAULT true,
  approved_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  
  UNIQUE(user_id, permission_id, scope, scope_id)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Permissions indexes
CREATE INDEX idx_permissions_category ON permissions(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_permissions_slug ON permissions(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_permissions_system ON permissions(is_system) WHERE deleted_at IS NULL;
CREATE INDEX idx_permissions_dangerous ON permissions(is_dangerous) WHERE deleted_at IS NULL AND is_dangerous = true;

-- Roles indexes
CREATE INDEX idx_roles_organization_id ON roles(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_roles_slug ON roles(organization_id, slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_roles_parent_role ON roles(parent_role_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_roles_type ON roles(role_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_roles_assignable ON roles(is_assignable) WHERE deleted_at IS NULL AND is_assignable = true;

-- Role permissions indexes
CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_role_permissions_granted ON role_permissions(granted) WHERE deleted_at IS NULL;

-- User role assignments indexes
CREATE INDEX idx_user_role_assignments_user_id ON user_role_assignments(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_role_assignments_role_id ON user_role_assignments(role_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_role_assignments_scope ON user_role_assignments(scope, scope_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_role_assignments_active ON user_role_assignments(is_active) WHERE deleted_at IS NULL AND is_active = true;
CREATE INDEX idx_user_role_assignments_expires ON user_role_assignments(expires_at) WHERE expires_at IS NOT NULL;

-- Permission overrides indexes
CREATE INDEX idx_user_permission_overrides_user_id ON user_permission_overrides(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_permission_overrides_permission_id ON user_permission_overrides(permission_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_permission_overrides_scope ON user_permission_overrides(scope, scope_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_permission_overrides_expires ON user_permission_overrides(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_user_permission_overrides_review_status ON user_permission_overrides(review_status) WHERE deleted_at IS NULL;

-- =============================================
-- PERMISSION VALIDATION FUNCTIONS
-- =============================================

-- Function to check if a permission exists and is valid
CREATE OR REPLACE FUNCTION validate_permission(permission_slug text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM permissions 
    WHERE slug = permission_slug 
    AND deleted_at IS NULL
  );
END;
$$;

-- Function to check permission dependencies
CREATE OR REPLACE FUNCTION check_permission_dependencies(permission_id uuid, user_permissions uuid[])
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  required_permissions uuid[];
  missing_permissions uuid[];
BEGIN
  -- Get required dependencies for this permission
  SELECT dependencies INTO required_permissions
  FROM permissions
  WHERE id = permission_id;
  
  -- If no dependencies, return true
  IF required_permissions IS NULL OR array_length(required_permissions, 1) IS NULL THEN
    RETURN true;
  END IF;
  
  -- Check if user has all required permissions
  SELECT array_agg(dep) INTO missing_permissions
  FROM unnest(required_permissions) AS dep
  WHERE dep != ALL(user_permissions);
  
  -- Return true if no missing permissions
  RETURN missing_permissions IS NULL OR array_length(missing_permissions, 1) IS NULL;
END;
$$;

-- Function to get effective permissions for a user in a specific scope
CREATE OR REPLACE FUNCTION get_user_effective_permissions(
  target_user_id uuid,
  target_scope text,
  target_scope_id uuid
)
RETURNS text[]
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  role_permissions text[];
  override_permissions text[];
  denied_permissions text[];
  final_permissions text[];
BEGIN
  -- Get permissions from roles
  SELECT array_agg(DISTINCT p.slug) INTO role_permissions
  FROM user_role_assignments ura
  JOIN role_permissions rp ON rp.role_id = ura.role_id
  JOIN permissions p ON p.id = rp.permission_id
  WHERE ura.user_id = target_user_id
    AND ura.scope = target_scope
    AND ura.scope_id = target_scope_id
    AND ura.is_active = true
    AND (ura.expires_at IS NULL OR ura.expires_at > now())
    AND ura.deleted_at IS NULL
    AND rp.granted = true
    AND rp.deleted_at IS NULL
    AND p.deleted_at IS NULL
    AND target_scope = ANY(rp.scope_types);
  
  -- Get granted override permissions
  SELECT array_agg(DISTINCT p.slug) INTO override_permissions
  FROM user_permission_overrides upo
  JOIN permissions p ON p.id = upo.permission_id
  WHERE upo.user_id = target_user_id
    AND upo.scope = target_scope
    AND upo.scope_id = target_scope_id
    AND upo.granted = true
    AND (upo.expires_at IS NULL OR upo.expires_at > now())
    AND upo.deleted_at IS NULL
    AND p.deleted_at IS NULL;
  
  -- Get denied override permissions
  SELECT array_agg(DISTINCT p.slug) INTO denied_permissions
  FROM user_permission_overrides upo
  JOIN permissions p ON p.id = upo.permission_id
  WHERE upo.user_id = target_user_id
    AND upo.scope = target_scope
    AND upo.scope_id = target_scope_id
    AND upo.granted = false
    AND (upo.expires_at IS NULL OR upo.expires_at > now())
    AND upo.deleted_at IS NULL
    AND p.deleted_at IS NULL;
  
  -- Initialize arrays if NULL
  role_permissions := COALESCE(role_permissions, ARRAY[]::text[]);
  override_permissions := COALESCE(override_permissions, ARRAY[]::text[]);
  denied_permissions := COALESCE(denied_permissions, ARRAY[]::text[]);
  
  -- Combine role permissions and granted overrides, then subtract denied overrides
  SELECT array_agg(DISTINCT perm) INTO final_permissions
  FROM (
    SELECT unnest(role_permissions || override_permissions) AS perm
  ) AS combined_perms
  WHERE perm != ALL(denied_permissions);
  
  RETURN COALESCE(final_permissions, ARRAY[]::text[]);
END;
$$;

-- Function to check if user has specific permission
CREATE OR REPLACE FUNCTION user_has_permission(
  target_user_id uuid,
  permission_slug text,
  target_scope text,
  target_scope_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  user_permissions text[];
BEGIN
  user_permissions := get_user_effective_permissions(target_user_id, target_scope, target_scope_id);
  RETURN permission_slug = ANY(user_permissions);
END;
$$;

-- =============================================
-- ROLE MANAGEMENT FUNCTIONS
-- =============================================

-- Function to assign role to user with validation
CREATE OR REPLACE FUNCTION assign_role_to_user(
  target_user_id uuid,
  target_role_id uuid,
  target_scope text,
  target_scope_id uuid,
  assigned_by_user_id uuid DEFAULT NULL,
  assignment_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  assignment_id uuid;
  role_max_users integer;
  current_user_count integer;
BEGIN
  -- Check if role has user limits
  SELECT max_users INTO role_max_users
  FROM roles
  WHERE id = target_role_id;
  
  -- If there's a user limit, check current count
  IF role_max_users IS NOT NULL THEN
    SELECT COUNT(*) INTO current_user_count
    FROM user_role_assignments
    WHERE role_id = target_role_id
      AND is_active = true
      AND deleted_at IS NULL;
    
    IF current_user_count >= role_max_users THEN
      RAISE EXCEPTION 'Role has reached maximum user limit of %', role_max_users;
    END IF;
  END IF;
  
  -- Insert role assignment
  INSERT INTO user_role_assignments (
    user_id,
    role_id,
    scope,
    scope_id,
    assigned_by,
    reason
  ) VALUES (
    target_user_id,
    target_role_id,
    target_scope,
    target_scope_id,
    assigned_by_user_id,
    assignment_reason
  )
  ON CONFLICT (user_id, role_id, scope, scope_id) 
  DO UPDATE SET
    is_active = true,
    deleted_at = NULL,
    updated_at = now()
  RETURNING id INTO assignment_id;
  
  RETURN assignment_id;
END;
$$;

-- =============================================
-- TRIGGERS FOR AUTO-UPDATING TIMESTAMPS
-- =============================================

CREATE TRIGGER update_permissions_updated_at
  BEFORE UPDATE ON permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_role_permissions_updated_at
  BEFORE UPDATE ON role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_role_assignments_updated_at
  BEFORE UPDATE ON user_role_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_permission_overrides_updated_at
  BEFORE UPDATE ON user_permission_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON TABLE permissions IS 'System-wide permissions with categories and dependencies';
COMMENT ON TABLE roles IS 'Roles with hierarchy, templates, and organizational scope';
COMMENT ON TABLE role_permissions IS 'Junction table for role-permission assignments with conditions';
COMMENT ON TABLE user_role_assignments IS 'User role assignments with scope and temporal constraints';
COMMENT ON TABLE user_permission_overrides IS 'Granular permission overrides for individual users';

COMMENT ON FUNCTION get_user_effective_permissions IS 'Calculates effective permissions for a user in a specific scope';
COMMENT ON FUNCTION user_has_permission IS 'Checks if a user has a specific permission in a scope';
COMMENT ON FUNCTION assign_role_to_user IS 'Assigns a role to a user with validation and constraints';