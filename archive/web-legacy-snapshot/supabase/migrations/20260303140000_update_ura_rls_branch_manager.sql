-- ============================================================================
-- Migration: Update user_role_assignments RLS policies for branch manager model
-- Modifies the branch-path of 4 policies to also allow users who hold
-- has_branch_permission(..., 'branch.roles.manage') for the target branch.
-- Org paths are UNCHANGED.
-- ============================================================================

-- ── Policy: "V2 assign roles" (INSERT) ──────────────────────────────────────
DROP POLICY IF EXISTS "V2 assign roles" ON public.user_role_assignments;
CREATE POLICY "V2 assign roles"
  ON public.user_role_assignments
  FOR INSERT
  WITH CHECK (
    (
      (scope = 'org'
        AND is_org_member(scope_id)
        AND has_permission(scope_id, 'members.manage'))
      OR
      (scope = 'branch'
        AND (
          has_permission(
            (SELECT branches.organization_id
               FROM public.branches
              WHERE branches.id = user_role_assignments.scope_id
                AND branches.deleted_at IS NULL),
            'members.manage'
          )
          OR
          has_branch_permission(
            (SELECT branches.organization_id
               FROM public.branches
              WHERE branches.id = user_role_assignments.scope_id
                AND branches.deleted_at IS NULL),
            user_role_assignments.scope_id,
            'branch.roles.manage'
          )
        )
        AND is_org_member(
          (SELECT branches.organization_id
             FROM public.branches
            WHERE branches.id = user_role_assignments.scope_id
              AND branches.deleted_at IS NULL)
        ))
    )
  );


-- ── Policy: "V2 update role assignments" (UPDATE) ────────────────────────────
DROP POLICY IF EXISTS "V2 update role assignments" ON public.user_role_assignments;
CREATE POLICY "V2 update role assignments"
  ON public.user_role_assignments
  FOR UPDATE
  USING (
    (
      (scope = 'org'
        AND is_org_member(scope_id)
        AND has_permission(scope_id, 'members.manage'))
      OR
      (scope = 'branch'
        AND (
          has_permission(
            (SELECT branches.organization_id
               FROM public.branches
              WHERE branches.id = user_role_assignments.scope_id
                AND branches.deleted_at IS NULL),
            'members.manage'
          )
          OR
          has_branch_permission(
            (SELECT branches.organization_id
               FROM public.branches
              WHERE branches.id = user_role_assignments.scope_id
                AND branches.deleted_at IS NULL),
            user_role_assignments.scope_id,
            'branch.roles.manage'
          )
        )
        AND is_org_member(
          (SELECT branches.organization_id
             FROM public.branches
            WHERE branches.id = user_role_assignments.scope_id
              AND branches.deleted_at IS NULL)
        ))
    )
  )
  WITH CHECK (
    (
      (scope = 'org'
        AND is_org_member(scope_id)
        AND has_permission(scope_id, 'members.manage'))
      OR
      (scope = 'branch'
        AND (
          has_permission(
            (SELECT branches.organization_id
               FROM public.branches
              WHERE branches.id = user_role_assignments.scope_id
                AND branches.deleted_at IS NULL),
            'members.manage'
          )
          OR
          has_branch_permission(
            (SELECT branches.organization_id
               FROM public.branches
              WHERE branches.id = user_role_assignments.scope_id
                AND branches.deleted_at IS NULL),
            user_role_assignments.scope_id,
            'branch.roles.manage'
          )
        )
        AND is_org_member(
          (SELECT branches.organization_id
             FROM public.branches
            WHERE branches.id = user_role_assignments.scope_id
              AND branches.deleted_at IS NULL)
        ))
    )
  );


-- ── Policy: "V2 delete role assignments" (DELETE) ────────────────────────────
DROP POLICY IF EXISTS "V2 delete role assignments" ON public.user_role_assignments;
CREATE POLICY "V2 delete role assignments"
  ON public.user_role_assignments
  FOR DELETE
  USING (
    (
      (scope = 'org'
        AND is_org_member(scope_id)
        AND has_permission(scope_id, 'members.manage'))
      OR
      (scope = 'branch'
        AND (
          has_permission(
            (SELECT branches.organization_id
               FROM public.branches
              WHERE branches.id = user_role_assignments.scope_id
                AND branches.deleted_at IS NULL),
            'members.manage'
          )
          OR
          has_branch_permission(
            (SELECT branches.organization_id
               FROM public.branches
              WHERE branches.id = user_role_assignments.scope_id
                AND branches.deleted_at IS NULL),
            user_role_assignments.scope_id,
            'branch.roles.manage'
          )
        )
        AND is_org_member(
          (SELECT branches.organization_id
             FROM public.branches
            WHERE branches.id = user_role_assignments.scope_id
              AND branches.deleted_at IS NULL)
        ))
    )
  );


-- ── Policy: "V2 view branch role assignments" (SELECT) ───────────────────────
DROP POLICY IF EXISTS "V2 view branch role assignments" ON public.user_role_assignments;
CREATE POLICY "V2 view branch role assignments"
  ON public.user_role_assignments
  FOR SELECT
  USING (
    (scope = 'branch'
      AND (
        has_permission(
          (SELECT branches.organization_id
             FROM public.branches
            WHERE branches.id = user_role_assignments.scope_id
              AND branches.deleted_at IS NULL),
          'members.read'
        )
        OR
        has_branch_permission(
          (SELECT branches.organization_id
             FROM public.branches
            WHERE branches.id = user_role_assignments.scope_id
              AND branches.deleted_at IS NULL),
          user_role_assignments.scope_id,
          'branch.roles.manage'
        )
      ))
  );
