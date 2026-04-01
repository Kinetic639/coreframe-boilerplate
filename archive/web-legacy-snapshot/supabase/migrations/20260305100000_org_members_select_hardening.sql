-- =============================================================================
-- Security Hardening: organization_members SELECT — RESTRICTIVE policy
-- =============================================================================
--
-- Risk:
--   The existing permissive SELECT policy uses:
--     (user_id = auth.uid()) OR is_org_creator(organization_id) OR has_any_org_role(organization_id)
--
--   The `is_org_creator(organization_id)` clause checks only the `organizations`
--   table (created_by = auth.uid()). It has NO check on user_role_assignments.
--   A removed org creator — whose org-scoped URA is soft-deleted — still satisfies
--   is_org_creator and therefore retains full SELECT access to the member list.
--
-- Fix (additive-only):
--   Add a RESTRICTIVE SELECT policy using has_any_org_role(organization_id).
--   In Postgres, RESTRICTIVE policies are AND-combined with all permissive policies.
--   Any row visible through a permissive policy is ALSO blocked if the RESTRICTIVE
--   policy's USING predicate evaluates to FALSE.
--
--   Chosen predicate: has_any_org_role(organization_id)
--     Definition:
--       EXISTS (
--         SELECT 1 FROM user_role_assignments
--         WHERE user_id = auth.uid()
--           AND scope = 'org'
--           AND scope_id = organization_id
--           AND deleted_at IS NULL
--       )
--     Recursion risk: NONE — queries user_role_assignments, not organization_members.
--     Already used in the existing permissive SELECT policy (safe precedent).
--
-- Access model after this migration:
--
--   Viewer state                           | has_any_org_role | RESTRICTIVE | Final result
--   ─────────────────────────────────────────────────────────────────────────────────────
--   Active member (URA active)             | TRUE             | PASS        | Filtered by permissive ✅
--   Removed member (URA deleted_at set)    | FALSE            | BLOCK       | Zero rows ✅
--   Inactive member + role revoked         | FALSE            | BLOCK       | Zero rows ✅
--   Org creator, role revoked (old bypass) | FALSE            | BLOCK       | Zero rows ✅ (risk neutralised)
--   Org creator, still has active role     | TRUE             | PASS        | Filtered by permissive ✅
--
-- Additive-only: does NOT modify or drop the existing permissive policy.
-- =============================================================================

CREATE POLICY "org_members_select_requires_active_role"
ON public.organization_members
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  has_any_org_role(organization_id)
);
