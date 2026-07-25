-- Migration: Add user_has_effective_permission DB function
-- Date: 2026-03-18
-- Purpose: Fix G2 audit finding — PermissionServiceV2.hasPermission() calls
--   supabase.rpc("user_has_effective_permission", ...) but the function did
--   not exist, causing every call to log an error and silently return false.
--
-- ROOT CAUSE (G2 audit finding):
--   PermissionServiceV2.hasPermission() calls user_has_effective_permission RPC.
--   The function was defined in migration 20260120113444 but never applied to
--   the target DB (which uses target_* migration naming). The service logged
--   "[PermissionServiceV2] Failed to check permission: <rpc-not-found>" and
--   returned false for every check, causing false-negative permission denials.
--
-- FUNCTION CONTRACT:
--   user_has_effective_permission(p_user_id, p_organization_id, p_permission_slug)
--     → boolean
--
--   Checks the compiled user_effective_permissions table for an EXACT concrete
--   slug match in the ORG SCOPE (branch_id IS NULL). Uses permission_slug_exact
--   (added in the 100k migration) to ensure wildcard-expanded rows are found.
--
--   This mirrors has_permission() (which uses auth.uid()) but accepts an explicit
--   user_id — useful for server-side admin checks and PermissionServiceV2 paths.
--
-- SECURITY:
--   SECURITY DEFINER with empty search_path — accesses user_effective_permissions
--   table using its compiled facts. No privilege escalation: the function only
--   reads already-compiled permission rows for the explicit user/org pair.
--   RLS on user_effective_permissions is bypassed by SECURITY DEFINER (intentional:
--   this is a server-side utility called from the service role context or trusted
--   server actions, never from untrusted client code).

CREATE OR REPLACE FUNCTION public.user_has_effective_permission(
  p_user_id         UUID,
  p_organization_id UUID,
  p_permission_slug TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_effective_permissions
    WHERE user_id               = p_user_id
      AND organization_id       = p_organization_id
      AND permission_slug_exact = p_permission_slug
      AND branch_id             IS NULL
  );
$$;

COMMENT ON FUNCTION public.user_has_effective_permission IS
  'Check if a specific user has an exact org-scope permission (branch_id IS NULL). '
  'Reads compiled user_effective_permissions.permission_slug_exact. '
  'Counterpart to has_permission() which uses auth.uid() internally. '
  'Called by PermissionServiceV2.hasPermission() in server-side contexts.';
