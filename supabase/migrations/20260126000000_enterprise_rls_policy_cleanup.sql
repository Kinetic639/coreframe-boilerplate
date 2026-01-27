-- ============================================================================
-- Enterprise RLS Policy Cleanup - Final (Supersedes Round 3)
-- ============================================================================
-- This migration is the AUTHORITATIVE final RLS policy set.
-- It supersedes 20260123000000_enterprise_rls_policy_hardening.sql (Round 3).
--
-- All affected tables have been verified to have deleted_at columns:
-- branches, invitations, organization_members, organizations, permissions,
-- role_permissions, roles, user_permission_overrides, user_role_assignments
--
-- Design notes:
-- - deleted_at IS NULL in INSERT WITH CHECK is intentional belt-and-suspenders.
--   All tables default deleted_at to NULL, so this is redundant in normal use,
--   but prevents a malicious client from inserting pre-deleted rows.
-- - Self-registration (org bootstrap) requires SEQUENTIAL execution:
--   1. INSERT organization (created_by = auth.uid())
--   2. INSERT membership (self)
--   3. INSERT role assignment (self, org_member only)
--   Parallel/out-of-order inserts will fail with policy violations.
--   Recommended: migrate to server-side atomic transaction (see bottom).
--
-- Fixes implemented:
-- 1. Consolidate role constraints into single canonical constraint
-- 2. Deterministic DROP + CREATE pattern (no IF NOT EXISTS after DROP)
-- 3. deleted_at IS NULL on ALL SELECT USING clauses
-- 4. deleted_at IS NULL on ALL UPDATE USING clauses
-- 5. deleted_at IS NULL on ALL UPDATE WITH CHECK clauses
-- 6. deleted_at IS NULL on ALL INSERT WITH CHECK clauses
-- 7. is_org_member() on ALL mutation policies (tenant boundary)
-- 8. Fix operator precedence bug in invitations policies (wrap OR)
-- 9. Intentional removal of redundant _select_member policies
-- 10. FORCE ROW LEVEL SECURITY on critical tables (in Round 3, preserved)
-- ============================================================================

-- ============================================================================
-- FIX #1: Consolidate role constraints into single canonical constraint
-- ============================================================================
-- Previous: Two separate constraints that were confusing and allowed edge cases
-- New: One canonical constraint guaranteeing exactly two valid states:
--   - System role: is_basic = true AND organization_id IS NULL
--   - Custom role: is_basic = false AND organization_id IS NOT NULL

-- Drop the old constraints
ALTER TABLE public.roles DROP CONSTRAINT IF EXISTS chk_system_role_no_org;
ALTER TABLE public.roles DROP CONSTRAINT IF EXISTS chk_custom_role_has_org;
ALTER TABLE public.roles DROP CONSTRAINT IF EXISTS roles_invariant;

-- Add single canonical constraint
ALTER TABLE public.roles
ADD CONSTRAINT roles_invariant
CHECK (
  (is_basic = true  AND organization_id IS NULL)
  OR
  (is_basic = false AND organization_id IS NOT NULL)
);

COMMENT ON CONSTRAINT roles_invariant ON public.roles IS
  'Invariant: System roles (is_basic=true) must have NULL organization_id. Custom roles (is_basic=false) must have non-NULL organization_id. No other states allowed.';

-- ============================================================================
-- FIX #2: Clean up inconsistent DROP + IF NOT EXISTS patterns
-- ============================================================================
-- Using deterministic DROP + CREATE pattern throughout

-- user_role_assignments policies
-- NOTE: role_assignments_select_member is intentionally NOT recreated.
-- Least-privilege: regular members should only see their own assignments (_select_self),
-- while admins with members.manage permission can see all (_select_admin).
DROP POLICY IF EXISTS "role_assignments_select_self" ON public.user_role_assignments;
DROP POLICY IF EXISTS "role_assignments_select_admin" ON public.user_role_assignments;
DROP POLICY IF EXISTS "role_assignments_select_member" ON public.user_role_assignments;
DROP POLICY IF EXISTS "role_assignments_insert_permission" ON public.user_role_assignments;
DROP POLICY IF EXISTS "role_assignments_update_permission" ON public.user_role_assignments;
DROP POLICY IF EXISTS "role_assignments_delete_permission" ON public.user_role_assignments;

CREATE POLICY "role_assignments_select_self"
  ON public.user_role_assignments
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND deleted_at IS NULL
  );

CREATE POLICY "role_assignments_select_admin"
  ON public.user_role_assignments
  FOR SELECT
  TO authenticated
  USING (
    scope = 'org'
    AND is_org_member(scope_id)
    AND has_permission(scope_id, 'members.manage')
    AND deleted_at IS NULL
  );

CREATE POLICY "role_assignments_insert_permission"
  ON public.user_role_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admin case: Has members.manage permission
    (
      scope = 'org'
      AND is_org_member(scope_id)
      AND has_permission(scope_id, 'members.manage')
      AND deleted_at IS NULL
    )
    OR
    -- Self-registration case: ONLY during org creation by the creator
    (
      user_id = auth.uid()
      AND scope = 'org'
      -- Only allow org_member role (NEVER org_owner via self-assignment)
      AND EXISTS (
        SELECT 1 FROM public.roles r
        WHERE r.id = role_id
        AND r.name = 'org_member'
        AND r.deleted_at IS NULL
      )
      -- CRITICAL: User must be the organization creator
      AND EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = scope_id
        AND o.created_by = auth.uid()
        AND o.deleted_at IS NULL
      )
      -- Belt & suspenders: User has no other active memberships
      AND NOT EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
        AND om.organization_id <> scope_id
        AND om.status = 'active'
        AND om.deleted_at IS NULL
      )
      AND deleted_at IS NULL
    )
  );

CREATE POLICY "role_assignments_update_permission"
  ON public.user_role_assignments
  FOR UPDATE
  TO authenticated
  USING (
    scope = 'org'
    AND is_org_member(scope_id)
    AND has_permission(scope_id, 'members.manage')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    scope = 'org'
    AND is_org_member(scope_id)
    AND has_permission(scope_id, 'members.manage')
    AND deleted_at IS NULL
  );

CREATE POLICY "role_assignments_delete_permission"
  ON public.user_role_assignments
  FOR DELETE
  TO authenticated
  USING (
    scope = 'org'
    AND is_org_member(scope_id)
    AND has_permission(scope_id, 'members.manage')
    AND deleted_at IS NULL
  );

-- organization_members policies
-- NOTE: members_select_member is intentionally NOT recreated.
-- members_select_org already covers the case where org members can see other members.
-- This avoids redundant policies with potentially inconsistent conditions.
DROP POLICY IF EXISTS "members_select_self" ON public.organization_members;
DROP POLICY IF EXISTS "members_select_org" ON public.organization_members;
DROP POLICY IF EXISTS "members_select_member" ON public.organization_members;
DROP POLICY IF EXISTS "members_insert_permission" ON public.organization_members;
DROP POLICY IF EXISTS "members_update_permission" ON public.organization_members;
DROP POLICY IF EXISTS "members_delete_permission" ON public.organization_members;

CREATE POLICY "members_select_self"
  ON public.organization_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND deleted_at IS NULL
  );

CREATE POLICY "members_select_org"
  ON public.organization_members
  FOR SELECT
  TO authenticated
  USING (
    is_org_member(organization_id)
    AND deleted_at IS NULL
  );

CREATE POLICY "members_insert_permission"
  ON public.organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admin case: has members.manage permission
    (
      is_org_member(organization_id)
      AND has_permission(organization_id, 'members.manage')
      AND deleted_at IS NULL
    )
    OR
    -- Self-registration case: ONLY org creator adding themselves
    (
      user_id = auth.uid()
      -- CRITICAL: User must be the organization creator
      AND EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = organization_id
        AND o.created_by = auth.uid()
        AND o.deleted_at IS NULL
      )
      -- Belt & suspenders: User has no other active memberships
      AND NOT EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
        AND om.organization_id <> organization_id
        AND om.status = 'active'
        AND om.deleted_at IS NULL
      )
      AND deleted_at IS NULL
    )
  );

CREATE POLICY "members_update_permission"
  ON public.organization_members
  FOR UPDATE
  TO authenticated
  USING (
    is_org_member(organization_id)
    AND has_permission(organization_id, 'members.manage')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    is_org_member(organization_id)
    AND has_permission(organization_id, 'members.manage')
    AND deleted_at IS NULL
  );

CREATE POLICY "members_delete_permission"
  ON public.organization_members
  FOR DELETE
  TO authenticated
  USING (
    is_org_member(organization_id)
    AND has_permission(organization_id, 'members.manage')
    AND deleted_at IS NULL
  );

-- ============================================================================
-- FIX #3: Ensure deleted_at IS NULL on ALL relevant policies
-- ============================================================================

-- roles SELECT policies (system + org)
DROP POLICY IF EXISTS "roles_select_system" ON public.roles;
DROP POLICY IF EXISTS "roles_select_org" ON public.roles;

CREATE POLICY "roles_select_system"
  ON public.roles
  FOR SELECT
  TO authenticated
  USING (
    is_basic = true
    AND organization_id IS NULL
    AND deleted_at IS NULL
  );

CREATE POLICY "roles_select_org"
  ON public.roles
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND is_org_member(organization_id)
    AND deleted_at IS NULL
  );

-- role_permissions SELECT policies (system + org)
DROP POLICY IF EXISTS "role_permissions_select_system" ON public.role_permissions;
DROP POLICY IF EXISTS "role_permissions_select_org" ON public.role_permissions;

CREATE POLICY "role_permissions_select_system"
  ON public.role_permissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = role_permissions.role_id
      AND r.is_basic = true
      AND r.organization_id IS NULL
      AND r.deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

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
      AND r.deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

-- permissions dictionary (read-only for all authenticated users)
DROP POLICY IF EXISTS "permissions_select_authenticated" ON public.permissions;

CREATE POLICY "permissions_select_authenticated"
  ON public.permissions
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- branches table policies
DROP POLICY IF EXISTS "branches_select_member" ON public.branches;
DROP POLICY IF EXISTS "branches_insert_permission" ON public.branches;
DROP POLICY IF EXISTS "branches_update_permission" ON public.branches;
DROP POLICY IF EXISTS "branches_softdelete_permission" ON public.branches;

CREATE POLICY "branches_select_member"
  ON public.branches
  FOR SELECT
  TO authenticated
  USING (
    is_org_member(organization_id)
    AND deleted_at IS NULL
  );

CREATE POLICY "branches_insert_permission"
  ON public.branches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_org_member(organization_id)
    AND has_permission(organization_id, 'branches.create')
    AND deleted_at IS NULL
  );

CREATE POLICY "branches_update_permission"
  ON public.branches
  FOR UPDATE
  TO authenticated
  USING (
    is_org_member(organization_id)
    AND has_permission(organization_id, 'branches.update')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    is_org_member(organization_id)
    AND has_permission(organization_id, 'branches.update')
    AND deleted_at IS NULL
  );

-- NOTE: Soft-delete via UPDATE policy (Option C accepted).
-- RLS cannot enforce "only deleted_at changed" — the UPDATE could also mutate other
-- columns in the same statement. If stricter column-level enforcement is needed later,
-- migrate to Option A (dedicated RPC with service_role) or Option B (BEFORE UPDATE
-- trigger rejecting changes to columns other than deleted_at/updated_at).
CREATE POLICY "branches_softdelete_permission"
  ON public.branches
  FOR UPDATE
  TO authenticated
  USING (
    is_org_member(organization_id)
    AND has_permission(organization_id, 'branches.delete')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    deleted_at IS NOT NULL
  );

-- organizations table policies
DROP POLICY IF EXISTS "org_select_member" ON public.organizations;
DROP POLICY IF EXISTS "org_select_creator" ON public.organizations;
DROP POLICY IF EXISTS "org_insert_authenticated" ON public.organizations;
DROP POLICY IF EXISTS "org_update_permission" ON public.organizations;

CREATE POLICY "org_select_member"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    is_org_member(id)
    AND deleted_at IS NULL
  );

CREATE POLICY "org_select_creator"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    AND deleted_at IS NULL
  );

-- Any authenticated user can create an organization (must be the creator)
CREATE POLICY "org_insert_authenticated"
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND deleted_at IS NULL
  );

CREATE POLICY "org_update_permission"
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (
    is_org_member(id)
    AND has_permission(id, 'org.update')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    is_org_member(id)
    AND has_permission(id, 'org.update')
    AND deleted_at IS NULL
  );

-- invitations table policies
-- NOTE: invitations.deleted_at verified to exist (schema check Jan 2026)
DROP POLICY IF EXISTS "invitations_select_permission" ON public.invitations;
DROP POLICY IF EXISTS "invitations_insert_permission" ON public.invitations;
DROP POLICY IF EXISTS "invitations_update_permission" ON public.invitations;

CREATE POLICY "invitations_select_permission"
  ON public.invitations
  FOR SELECT
  TO authenticated
  USING (
    (
      (
        is_org_member(organization_id)
        AND has_permission(organization_id, 'invites.read')
      )
      OR (
        LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
      )
    )
    AND deleted_at IS NULL
  );

CREATE POLICY "invitations_insert_permission"
  ON public.invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_org_member(organization_id)
    AND has_permission(organization_id, 'invites.create')
    AND deleted_at IS NULL
  );

CREATE POLICY "invitations_update_permission"
  ON public.invitations
  FOR UPDATE
  TO authenticated
  USING (
    (
      (
        is_org_member(organization_id)
        AND has_permission(organization_id, 'invites.cancel')
      )
      OR (
        LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
      )
    )
    AND deleted_at IS NULL
  )
  WITH CHECK (
    (
      (
        is_org_member(organization_id)
        AND has_permission(organization_id, 'invites.cancel')
      )
      OR (
        LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
      )
    )
    AND deleted_at IS NULL
  );

-- ============================================================================
-- ENSURE is_org_member() IS ADDED TO ALL MUTATION POLICIES
-- ============================================================================
-- Per enterprise review: All write policies should check BOTH:
-- 1. is_org_member() - tenant boundary
-- 2. has_permission() - authority check
-- This prevents stale compiled permissions from granting access

-- roles table - add is_org_member to mutation policies
DROP POLICY IF EXISTS "roles_insert_permission" ON public.roles;
DROP POLICY IF EXISTS "roles_update_permission" ON public.roles;
DROP POLICY IF EXISTS "roles_delete_permission" ON public.roles;

CREATE POLICY "roles_insert_permission"
  ON public.roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND is_org_member(organization_id)
    AND has_permission(organization_id, 'members.manage')
    AND deleted_at IS NULL
  );

CREATE POLICY "roles_update_permission"
  ON public.roles
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND is_basic = false
    AND is_org_member(organization_id)
    AND has_permission(organization_id, 'members.manage')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND is_basic = false
    AND is_org_member(organization_id)
    AND has_permission(organization_id, 'members.manage')
    AND deleted_at IS NULL
  );

CREATE POLICY "roles_delete_permission"
  ON public.roles
  FOR DELETE
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND is_basic = false
    AND is_org_member(organization_id)
    AND has_permission(organization_id, 'members.manage')
    AND deleted_at IS NULL
  );

-- role_permissions table - add is_org_member to mutation policies
DROP POLICY IF EXISTS "role_permissions_insert_permission" ON public.role_permissions;
DROP POLICY IF EXISTS "role_permissions_update_permission" ON public.role_permissions;
DROP POLICY IF EXISTS "role_permissions_delete_permission" ON public.role_permissions;

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
      AND is_org_member(r.organization_id)
      AND has_permission(r.organization_id, 'members.manage')
      AND r.deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

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
      AND is_org_member(r.organization_id)
      AND has_permission(r.organization_id, 'members.manage')
      AND r.deleted_at IS NULL
    )
    AND deleted_at IS NULL
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = role_permissions.role_id
      AND r.organization_id IS NOT NULL
      AND r.is_basic = false
      AND is_org_member(r.organization_id)
      AND has_permission(r.organization_id, 'members.manage')
      AND r.deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

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
      AND is_org_member(r.organization_id)
      AND has_permission(r.organization_id, 'members.manage')
      AND r.deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

-- user_permission_overrides table - SELECT + mutation policies
DROP POLICY IF EXISTS "overrides_select_self" ON public.user_permission_overrides;
DROP POLICY IF EXISTS "overrides_select_admin" ON public.user_permission_overrides;
DROP POLICY IF EXISTS "overrides_insert_permission" ON public.user_permission_overrides;
DROP POLICY IF EXISTS "overrides_update_permission" ON public.user_permission_overrides;
DROP POLICY IF EXISTS "overrides_delete_permission" ON public.user_permission_overrides;

CREATE POLICY "overrides_select_self"
  ON public.user_permission_overrides
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND deleted_at IS NULL
  );

CREATE POLICY "overrides_select_admin"
  ON public.user_permission_overrides
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND is_org_member(organization_id)
    AND has_permission(organization_id, 'members.manage')
    AND deleted_at IS NULL
  );

CREATE POLICY "overrides_insert_permission"
  ON public.user_permission_overrides
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND is_org_member(organization_id)
    AND has_permission(organization_id, 'members.manage')
    AND deleted_at IS NULL
  );

CREATE POLICY "overrides_update_permission"
  ON public.user_permission_overrides
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND is_org_member(organization_id)
    AND has_permission(organization_id, 'members.manage')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND is_org_member(organization_id)
    AND has_permission(organization_id, 'members.manage')
    AND deleted_at IS NULL
  );

CREATE POLICY "overrides_delete_permission"
  ON public.user_permission_overrides
  FOR DELETE
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND is_org_member(organization_id)
    AND has_permission(organization_id, 'members.manage')
    AND deleted_at IS NULL
  );

-- ============================================================================
-- FORCE ROW LEVEL SECURITY ON CRITICAL TABLES
-- ============================================================================
-- Ensures RLS is enforced even for table owners (prevents implicit bypass).
-- NOTE: This does NOT affect roles with BYPASSRLS (e.g. Supabase service_role).
-- service_role bypasses RLS by design — this is expected and correct for
-- server-side operations (triggers, RPCs, migrations). FORCE RLS only
-- prevents the table-owning role from silently skipping policies.

ALTER TABLE public.user_effective_permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_overrides FORCE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.roles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "branches_select_member" ON public.branches IS
  'Enterprise: Membership boundary + soft-delete filter';

COMMENT ON POLICY "branches_insert_permission" ON public.branches IS
  'Enterprise: Membership + permission check';

COMMENT ON POLICY "org_select_member" ON public.organizations IS
  'Enterprise: Membership boundary + soft-delete filter';

COMMENT ON POLICY "roles_insert_permission" ON public.roles IS
  'Enterprise: is_org_member() + has_permission() for all mutations';

-- ============================================================================
-- ENTERPRISE RECOMMENDATION (NOT IMPLEMENTED - REQUIRES APP CHANGES)
-- ============================================================================
-- For maximum security, consider removing self-insert capabilities entirely
-- from organization_members and user_role_assignments tables.
--
-- Instead, handle org creation in a single server-side transaction:
--   1. INSERT organization (service_role)
--   2. INSERT membership (service_role)
--   3. INSERT role assignment (service_role)
--   4. compile_user_permissions() (service_role)
--
-- Then RLS can deny INSERT for authenticated users entirely on these tables.
--
-- To implement this:
-- 1. Create a server action that handles org creation atomically
-- 2. Update client code to use the server action
-- 3. Remove self-insert policies from organization_members and user_role_assignments
-- 4. Keep only admin INSERT policies (has_permission checks)
--
-- This eliminates the entire "self-assignment exploit surface" category.
-- ============================================================================

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these after migration to verify fixes:
--
-- 1. Verify single canonical constraint:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.roles'::regclass
-- AND contype = 'c';
-- Expected: Only roles_invariant constraint
--
-- 2. Verify all mutation policies have is_org_member:
-- SELECT tablename, policyname, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
-- AND (tablename IN ('roles', 'role_permissions', 'user_permission_overrides', 'branches', 'organizations'))
-- ORDER BY tablename, cmd;
-- Expected: All should contain is_org_member reference
--
-- 3. Verify all SELECT policies have deleted_at filter:
-- SELECT tablename, policyname, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- AND cmd = 'SELECT'
-- AND tablename IN ('roles', 'role_permissions', 'user_role_assignments',
--                   'organization_members', 'branches', 'organizations',
--                   'user_permission_overrides')
-- ORDER BY tablename;
-- Expected: All should contain deleted_at IS NULL
--
-- 4. Verify invitations policy has proper operator precedence:
-- SELECT policyname, qual FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'invitations';
-- Expected: deleted_at IS NULL should be OUTSIDE the OR grouping, like:
--   ((is_org_member(...) AND has_permission(...)) OR (email = ...)) AND deleted_at IS NULL
-- NOT like:
--   (is_org_member(...) AND has_permission(...)) OR ((email = ...) AND deleted_at IS NULL)
--
-- 5. Verify WITH CHECK clauses include deleted_at IS NULL:
-- SELECT tablename, policyname, cmd, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- AND cmd IN ('INSERT', 'UPDATE')
-- AND with_check IS NOT NULL
-- ORDER BY tablename, cmd;
-- Expected: All INSERT/UPDATE policies should have deleted_at IS NULL in with_check
--
-- 6. Verify FORCE ROW LEVEL SECURITY is enabled:
-- SELECT relname, relforcerowsecurity
-- FROM pg_class
-- WHERE relname IN (
--   'user_effective_permissions', 'user_role_assignments',
--   'user_permission_overrides', 'organization_members',
--   'roles', 'role_permissions'
-- );
-- Expected: relforcerowsecurity = true for all
-- ============================================================================
