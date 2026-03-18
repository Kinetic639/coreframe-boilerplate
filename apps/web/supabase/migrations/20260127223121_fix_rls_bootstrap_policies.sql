-- Fix RLS policies to support bootstrap scenarios and organization_members access
-- This migration addresses:
-- 1. Missing organization_members RLS policies
-- 2. Circular dependency in user_role_assignments INSERT policy

-- =============================================
-- ORGANIZATION_MEMBERS TABLE POLICIES
-- =============================================

-- Allow users to view members of organizations they belong to
CREATE POLICY "Users can view members of their organizations" ON organization_members
FOR SELECT
TO authenticated
USING (
  -- User can see members of orgs they're a member of
  organization_id IN (
    SELECT organization_id
    FROM organization_members om
    WHERE om.user_id = (SELECT auth.uid())
    AND om.status = 'active'
  )
);

-- Allow organization creators and org_owners to add members
CREATE POLICY "Org creators and owners can add members" ON organization_members
FOR INSERT
TO authenticated
WITH CHECK (
  -- Organization creator can add members
  EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.id = organization_members.organization_id
    AND o.created_by = (SELECT auth.uid())
  )
  OR
  -- Existing org_owners can add members
  EXISTS (
    SELECT 1 FROM user_role_assignments ura
    JOIN roles r ON ura.role_id = r.id
    WHERE ura.user_id = (SELECT auth.uid())
    AND ura.scope = 'org'
    AND ura.scope_id = organization_members.organization_id
    AND r.name = 'org_owner'
  )
);

-- Allow org_owners to update member status
CREATE POLICY "Org owners can update members" ON organization_members
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_role_assignments ura
    JOIN roles r ON ura.role_id = r.id
    WHERE ura.user_id = (SELECT auth.uid())
    AND ura.scope = 'org'
    AND ura.scope_id = organization_members.organization_id
    AND r.name = 'org_owner'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_role_assignments ura
    JOIN roles r ON ura.role_id = r.id
    WHERE ura.user_id = (SELECT auth.uid())
    AND ura.scope = 'org'
    AND ura.scope_id = organization_members.organization_id
    AND r.name = 'org_owner'
  )
);

-- Allow org_owners to remove members (soft delete via status change)
CREATE POLICY "Org owners can remove members" ON organization_members
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_role_assignments ura
    JOIN roles r ON ura.role_id = r.id
    WHERE ura.user_id = (SELECT auth.uid())
    AND ura.scope = 'org'
    AND ura.scope_id = organization_members.organization_id
    AND r.name = 'org_owner'
  )
);

-- =============================================
-- FIX USER_ROLE_ASSIGNMENTS BOOTSTRAP ISSUE
-- =============================================

-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Org owners can assign roles in their organization" ON user_role_assignments;

-- Create new INSERT policy that allows bootstrap scenarios
CREATE POLICY "Org owners and creators can assign roles" ON user_role_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  -- Organization creator can assign roles (bootstrap scenario)
  EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.id = user_role_assignments.scope_id
    AND o.created_by = (SELECT auth.uid())
    AND user_role_assignments.scope = 'org'
  )
  OR
  -- Existing org_owners can assign roles (normal operation)
  EXISTS (
    SELECT 1 FROM user_role_assignments ura
    JOIN roles r ON ura.role_id = r.id
    WHERE ura.user_id = (SELECT auth.uid())
    AND ura.scope = 'org'
    AND ura.scope_id = user_role_assignments.scope_id
    AND r.name = 'org_owner'
  )
  OR
  -- Branch managers can assign branch-level roles
  EXISTS (
    SELECT 1 FROM user_role_assignments ura
    JOIN roles r ON ura.role_id = r.id
    WHERE ura.user_id = (SELECT auth.uid())
    AND ura.scope = 'branch'
    AND ura.scope_id = user_role_assignments.scope_id
    AND r.name = 'branch_manager'
    AND user_role_assignments.scope = 'branch'
  )
);
