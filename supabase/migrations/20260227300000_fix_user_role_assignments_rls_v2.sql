-- P0: Fix branch-scoped role assignment RLS policies
-- Bug 1 (INSERT): has_org_role(scope_id, 'branch_manager') passes branch_id as org_id → always false
-- Bug 2 (DELETE): scope='org' filter blocks branch-scoped row deletion
-- Gap  (SELECT): admins cannot read another user's branch assignments

-- ── INSERT ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Org owners and creators can assign roles" ON public.user_role_assignments;

CREATE POLICY "V2 assign roles" ON public.user_role_assignments
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      scope = 'org'
      AND is_org_member(scope_id)
      AND has_permission(scope_id, 'members.manage')
    )
    OR
    (
      scope = 'branch'
      AND has_permission(
        (SELECT organization_id FROM public.branches WHERE id = scope_id AND deleted_at IS NULL),
        'members.manage'
      )
      AND is_org_member(
        (SELECT organization_id FROM public.branches WHERE id = scope_id AND deleted_at IS NULL)
      )
    )
  );

-- ── DELETE ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Org owners and creators can delete role assignments" ON public.user_role_assignments;

CREATE POLICY "V2 delete role assignments" ON public.user_role_assignments
  AS PERMISSIVE FOR DELETE
  TO authenticated
  USING (
    (
      scope = 'org'
      AND is_org_member(scope_id)
      AND has_permission(scope_id, 'members.manage')
    )
    OR
    (
      scope = 'branch'
      AND has_permission(
        (SELECT organization_id FROM public.branches WHERE id = scope_id AND deleted_at IS NULL),
        'members.manage'
      )
      AND is_org_member(
        (SELECT organization_id FROM public.branches WHERE id = scope_id AND deleted_at IS NULL)
      )
    )
  );

-- ── SELECT (branch-scope admin view) ─────────────────────────────────────────
-- Existing SELECT policy only covers scope='org'; add coverage for branch-scoped rows.
CREATE POLICY "V2 view branch role assignments" ON public.user_role_assignments
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (
    scope = 'branch'
    AND has_permission(
      (SELECT organization_id FROM public.branches WHERE id = scope_id AND deleted_at IS NULL),
      'members.read'
    )
  );
