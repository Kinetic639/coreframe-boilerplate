-- Add Row Level Security policies for role management tables
-- Based on Context7 Supabase RLS best practices

-- Enable RLS on missing tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ROLES TABLE POLICIES
-- =============================================

-- Allow authenticated users to view roles in their organization
CREATE POLICY "Users can view roles in their organization" ON roles
FOR SELECT
TO authenticated
USING (
  organization_id IS NULL -- System roles (available to all)
  OR organization_id IN (
    SELECT scope_id 
    FROM user_role_assignments ura
    JOIN roles r ON ura.role_id = r.id
    WHERE ura.user_id = (SELECT auth.uid()) 
    AND ura.scope = 'org'
    AND r.name IN ('org_owner', 'org_admin')
  )
);

-- Allow org owners to create custom roles for their organization
CREATE POLICY "Org owners can create custom roles" ON roles
FOR INSERT
TO authenticated
WITH CHECK (
  -- Only custom roles (not system roles)
  organization_id IS NOT NULL
  AND organization_id IN (
    SELECT scope_id 
    FROM user_role_assignments ura
    JOIN roles r ON ura.role_id = r.id
    WHERE ura.user_id = (SELECT auth.uid()) 
    AND ura.scope = 'org'
    AND r.name = 'org_owner'
  )
);

-- Allow org owners to update custom roles in their organization
CREATE POLICY "Org owners can update custom roles" ON roles
FOR UPDATE
TO authenticated
USING (
  organization_id IS NOT NULL
  AND organization_id IN (
    SELECT scope_id 
    FROM user_role_assignments ura
    JOIN roles r ON ura.role_id = r.id
    WHERE ura.user_id = (SELECT auth.uid()) 
    AND ura.scope = 'org'
    AND r.name = 'org_owner'
  )
)
WITH CHECK (
  organization_id IS NOT NULL
  AND organization_id IN (
    SELECT scope_id 
    FROM user_role_assignments ura
    JOIN roles r ON ura.role_id = r.id
    WHERE ura.user_id = (SELECT auth.uid()) 
    AND ura.scope = 'org'
    AND r.name = 'org_owner'
  )
);

-- Allow org owners to delete custom roles (soft delete via deleted_at)
CREATE POLICY "Org owners can delete custom roles" ON roles
FOR UPDATE
TO authenticated
USING (
  organization_id IS NOT NULL
  AND organization_id IN (
    SELECT scope_id 
    FROM user_role_assignments ura
    JOIN roles r ON ura.role_id = r.id
    WHERE ura.user_id = (SELECT auth.uid()) 
    AND ura.scope = 'org'
    AND r.name = 'org_owner'
  )
)
WITH CHECK (
  -- Allow setting deleted_at for soft delete
  organization_id IS NOT NULL
  AND organization_id IN (
    SELECT scope_id 
    FROM user_role_assignments ura
    JOIN roles r ON ura.role_id = r.id
    WHERE ura.user_id = (SELECT auth.uid()) 
    AND ura.scope = 'org'
    AND r.name = 'org_owner'
  )
);

-- =============================================
-- USER ROLE ASSIGNMENTS TABLE POLICIES
-- =============================================

-- Allow users to view role assignments in their organization
CREATE POLICY "Users can view role assignments in their organization" ON user_role_assignments
FOR SELECT
TO authenticated
USING (
  -- User can see their own role assignments
  user_id = (SELECT auth.uid())
  OR
  -- Org owners/admins can see all assignments in their org
  EXISTS (
    SELECT 1 FROM user_role_assignments ura
    JOIN roles r ON ura.role_id = r.id
    WHERE ura.user_id = (SELECT auth.uid())
    AND ura.scope = 'org'
    AND ura.scope_id = user_role_assignments.scope_id
    AND r.name IN ('org_owner', 'org_admin')
  )
  -- Branch managers can see assignments in their branch
  OR EXISTS (
    SELECT 1 FROM user_role_assignments ura
    JOIN roles r ON ura.role_id = r.id
    WHERE ura.user_id = (SELECT auth.uid())
    AND ura.scope = 'branch'
    AND ura.scope_id = user_role_assignments.scope_id
    AND r.name = 'branch_manager'
    AND user_role_assignments.scope = 'branch'
  )
);

-- Allow org owners to assign roles within their organization
CREATE POLICY "Org owners can assign roles in their organization" ON user_role_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_role_assignments ura
    JOIN roles r ON ura.role_id = r.id
    WHERE ura.user_id = (SELECT auth.uid())
    AND ura.scope = 'org'
    AND ura.scope_id = user_role_assignments.scope_id
    AND r.name = 'org_owner'
  )
);

-- Allow org owners to update role assignments in their organization
CREATE POLICY "Org owners can update role assignments in their organization" ON user_role_assignments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_role_assignments ura
    JOIN roles r ON ura.role_id = r.id
    WHERE ura.user_id = (SELECT auth.uid())
    AND ura.scope = 'org'
    AND ura.scope_id = user_role_assignments.scope_id
    AND r.name = 'org_owner'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_role_assignments ura
    JOIN roles r ON ura.role_id = r.id
    WHERE ura.user_id = (SELECT auth.uid())
    AND ura.scope = 'org'
    AND ura.scope_id = user_role_assignments.scope_id
    AND r.name = 'org_owner'
  )
);

-- Allow org owners to revoke role assignments (soft delete)
CREATE POLICY "Org owners can revoke role assignments in their organization" ON user_role_assignments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_role_assignments ura
    JOIN roles r ON ura.role_id = r.id
    WHERE ura.user_id = (SELECT auth.uid())
    AND ura.scope = 'org'
    AND ura.scope_id = user_role_assignments.scope_id
    AND r.name = 'org_owner'
  )
)
WITH CHECK (
  -- Allow setting deleted_at for soft delete
  EXISTS (
    SELECT 1 FROM user_role_assignments ura
    JOIN roles r ON ura.role_id = r.id
    WHERE ura.user_id = (SELECT auth.uid())
    AND ura.scope = 'org'
    AND ura.scope_id = user_role_assignments.scope_id
    AND r.name = 'org_owner'
  )
);

-- =============================================
-- USER PERMISSION OVERRIDES TABLE POLICIES
-- =============================================

-- Allow users to view their own permission overrides
CREATE POLICY "Users can view their own permission overrides" ON user_permission_overrides
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR
  -- Org owners can see all overrides in their org
  EXISTS (
    SELECT 1 FROM user_role_assignments ura
    JOIN roles r ON ura.role_id = r.id
    WHERE ura.user_id = (SELECT auth.uid())
    AND ura.scope = 'org'
    AND ura.scope_id = user_permission_overrides.organization_id
    AND r.name = 'org_owner'
  )
);

-- Allow org owners to create permission overrides
CREATE POLICY "Org owners can create permission overrides" ON user_permission_overrides
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_role_assignments ura
    JOIN roles r ON ura.role_id = r.id
    WHERE ura.user_id = (SELECT auth.uid())
    AND ura.scope = 'org'
    AND ura.scope_id = user_permission_overrides.organization_id
    AND r.name = 'org_owner'
  )
);

-- Allow org owners to update permission overrides
CREATE POLICY "Org owners can update permission overrides" ON user_permission_overrides
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_role_assignments ura
    JOIN roles r ON ura.role_id = r.id
    WHERE ura.user_id = (SELECT auth.uid())
    AND ura.scope = 'org'
    AND ura.scope_id = user_permission_overrides.organization_id
    AND r.name = 'org_owner'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_role_assignments ura
    JOIN roles r ON ura.role_id = r.id
    WHERE ura.user_id = (SELECT auth.uid())
    AND ura.scope = 'org'
    AND ura.scope_id = user_permission_overrides.organization_id
    AND r.name = 'org_owner'
  )
);

-- Allow org owners to delete permission overrides (soft delete)
CREATE POLICY "Org owners can delete permission overrides" ON user_permission_overrides
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_role_assignments ura
    JOIN roles r ON ura.role_id = r.id
    WHERE ura.user_id = (SELECT auth.uid())
    AND ura.scope = 'org'
    AND ura.scope_id = user_permission_overrides.organization_id
    AND r.name = 'org_owner'
  )
)
WITH CHECK (
  -- Allow setting deleted_at for soft delete
  EXISTS (
    SELECT 1 FROM user_role_assignments ura
    JOIN roles r ON ura.role_id = r.id
    WHERE ura.user_id = (SELECT auth.uid())
    AND ura.scope = 'org'
    AND ura.scope_id = user_permission_overrides.organization_id
    AND r.name = 'org_owner'
  )
);