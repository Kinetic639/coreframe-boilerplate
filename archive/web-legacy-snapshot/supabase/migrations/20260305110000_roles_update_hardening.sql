-- =============================================================================
-- Security Hardening: roles UPDATE — RESTRICTIVE policy + immutability trigger
-- =============================================================================
--
-- Risk (Policy):
--   The existing permissive `roles_update_permission` WITH CHECK:
--     (organization_id IS NOT NULL) AND (is_basic = false)
--
--   This is insufficient: it does NOT re-verify that the viewer is a member of
--   the NEW organization_id value. A privileged user who belongs to org-A and org-B
--   could in theory UPDATE a role's organization_id from org-A to org-B, because
--   the USING clause checks membership in the OLD org while WITH CHECK only verifies
--   the column is non-null. This enables cross-org role pollution.
--
-- Risk (Immutability):
--   organization_id, is_basic, and scope_type have no DB-level immutability guarantee.
--   These are structural identity columns; mutating them would corrupt the permission
--   model. The existing RLS alone cannot reliably prevent all mutation paths
--   (e.g. service-role API calls, future policy gaps).
--
-- =============================================================================
-- Part 1: RESTRICTIVE UPDATE policy (additive)
-- =============================================================================
--
-- Adds is_org_member(organization_id) and has_permission(organization_id, 'members.manage')
-- to the WITH CHECK via a RESTRICTIVE policy. Combined with the existing permissive
-- policy (AND-logic), the effective constraint becomes:
--
--   USING:
--     existing: org_id IS NOT NULL AND is_basic=false AND is_org_member AND has_permission AND deleted_at IS NULL
--     + new RESTRICTIVE: org_id IS NOT NULL AND is_org_member(organization_id)
--     Effective: same as existing (already includes is_org_member in USING)
--
--   WITH CHECK:
--     existing: org_id IS NOT NULL AND is_basic=false
--     + new RESTRICTIVE: org_id IS NOT NULL AND is_org_member(organization_id) AND has_permission
--     Effective: org_id IS NOT NULL AND is_basic=false AND is_org_member(NEW org_id) AND has_permission(NEW org_id)
--
--   Cross-org update attempt (org_id changed to org-B):
--     is_org_member(org-B) must be TRUE AND has_permission(org-B, 'members.manage') must be TRUE
--     → if not, WITH CHECK fails → update rejected ✅
--
-- =============================================================================
-- Part 2: Immutable column trigger (defense-in-depth)
-- =============================================================================
--
-- BEFORE UPDATE trigger raises P0001 if organization_id, is_basic, or scope_type
-- changes. This provides a hard DB-level guarantee independent of RLS.
-- SECURITY DEFINER with locked search_path prevents privilege escalation.
-- IS DISTINCT FROM is NULL-safe (NULL IS DISTINCT FROM NULL → FALSE).
--
-- =============================================================================

-- Part 1: RESTRICTIVE UPDATE policy
CREATE POLICY "roles_update_restrictive_hardened"
ON public.roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  organization_id IS NOT NULL
  AND is_org_member(organization_id)
)
WITH CHECK (
  organization_id IS NOT NULL
  AND is_org_member(organization_id)
  AND has_permission(organization_id, 'members.manage')
);

-- Part 2: Immutable column protection trigger
CREATE OR REPLACE FUNCTION public.protect_roles_immutable_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'roles.organization_id is immutable';
  END IF;
  IF NEW.is_basic IS DISTINCT FROM OLD.is_basic THEN
    RAISE EXCEPTION 'roles.is_basic is immutable';
  END IF;
  IF NEW.scope_type IS DISTINCT FROM OLD.scope_type THEN
    RAISE EXCEPTION 'roles.scope_type is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER roles_protect_immutable_columns
  BEFORE UPDATE ON public.roles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_roles_immutable_columns();
