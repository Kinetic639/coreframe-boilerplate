-- ============================================================================
-- Enterprise Security Lockdown & Performance Optimization
-- ============================================================================
-- This migration implements critical enterprise-grade security controls:
--
-- 1. EXECUTE privilege lockdown (prevents DoS and unauthorized compiler access)
-- 2. Permission_slug validation trigger (prevents drift and typos)
-- 3. Performance indexes for compiler queries
-- 4. RLS policy hardening (prevents privilege escalation)
--
-- Based on ChatGPT enterprise audit feedback
-- ============================================================================

-- ============================================================================
-- PART 1: EXECUTE PRIVILEGE LOCKDOWN
-- ============================================================================
-- Critical: Prevent normal users from calling compiler functions directly
-- Only service_role should be able to trigger manual recompiles
-- ============================================================================

-- ---------------------------------------------------------------------------
-- RLS Helper Functions: Allow authenticated (needed during policy evaluation)
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.has_permission(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_permission(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.is_org_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_member(UUID) TO authenticated;

-- Also handle legacy function names if they exist
DO $$
BEGIN
  -- current_user_has_permission (if exists)
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'current_user_has_permission'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.current_user_has_permission(UUID, TEXT) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.current_user_has_permission(UUID, TEXT) TO authenticated';
  END IF;

  -- current_user_is_org_member (if exists)
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'current_user_is_org_member'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.current_user_is_org_member(UUID) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.current_user_is_org_member(UUID) TO authenticated';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Compiler Functions: LOCK DOWN to service_role only
-- ---------------------------------------------------------------------------
-- These should NEVER be callable by normal authenticated users
-- Prevents DoS attacks (spamming recompiles) and unauthorized access

REVOKE ALL ON FUNCTION public.compile_user_permissions(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compile_user_permissions(UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.compile_org_permissions(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compile_org_permissions(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.compile_all_user_permissions(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compile_all_user_permissions(UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- Debug/Admin Functions: LOCK DOWN to service_role only
-- ---------------------------------------------------------------------------

-- user_has_effective_permission (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'user_has_effective_permission'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.user_has_effective_permission(UUID, UUID, TEXT) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.user_has_effective_permission(UUID, UUID, TEXT) TO service_role';
  END IF;

  -- get_permissions_for_roles (if exists)
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'get_permissions_for_roles'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    -- This one can stay accessible to authenticated for debugging
    EXECUTE 'REVOKE ALL ON FUNCTION public.get_permissions_for_roles(UUID[]) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_permissions_for_roles(UUID[]) TO authenticated';
  END IF;
END $$;

COMMENT ON FUNCTION public.compile_user_permissions(UUID, UUID) IS
  'SECURITY: service_role only. Prevents DoS via repeated recompiles.';

COMMENT ON FUNCTION public.has_permission(UUID, TEXT) IS
  'SECURITY: authenticated. Required for RLS policy evaluation.';

-- ============================================================================
-- PART 2: PERMISSION_SLUG VALIDATION TRIGGER
-- ============================================================================
-- Ensures permission_slug always matches permission_id
-- Prevents drift, typos, and ensures compiler reliability
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_permission_slug_on_override()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_correct_slug TEXT;
BEGIN
  -- If permission_id is provided, ensure permission_slug matches
  IF NEW.permission_id IS NOT NULL THEN
    SELECT slug INTO v_correct_slug
    FROM public.permissions
    WHERE id = NEW.permission_id;

    IF v_correct_slug IS NULL THEN
      RAISE EXCEPTION 'Invalid permission_id: % does not exist', NEW.permission_id;
    END IF;

    -- Auto-correct the slug or validate it matches
    IF NEW.permission_slug IS NULL OR NEW.permission_slug <> v_correct_slug THEN
      NEW.permission_slug := v_correct_slug;
    END IF;
  END IF;

  -- If permission_slug is provided but permission_id is not, validate slug exists
  IF NEW.permission_slug IS NOT NULL AND NEW.permission_id IS NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.permissions WHERE slug = NEW.permission_slug
    ) THEN
      RAISE EXCEPTION 'Invalid permission_slug: % does not exist in permissions table', NEW.permission_slug;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS trigger_validate_permission_slug ON public.user_permission_overrides;

CREATE TRIGGER trigger_validate_permission_slug
  BEFORE INSERT OR UPDATE ON public.user_permission_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_permission_slug_on_override();

COMMENT ON FUNCTION public.validate_permission_slug_on_override() IS
  'Enterprise hardening: Ensures permission_slug always matches permission_id. Prevents typos and drift.';

-- ============================================================================
-- PART 3: PERFORMANCE INDEXES
-- ============================================================================
-- Add missing indexes for compiler query performance
-- ============================================================================

-- Index for organization_members lookups (membership checks)
CREATE INDEX IF NOT EXISTS idx_organization_members_user_org
  ON public.organization_members(user_id, organization_id)
  WHERE status = 'active' AND deleted_at IS NULL;

-- Index for user_role_assignments compiler queries
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_compiler
  ON public.user_role_assignments(user_id, scope, scope_id)
  WHERE deleted_at IS NULL;

-- Index for user_permission_overrides compiler queries
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_compiler
  ON public.user_permission_overrides(user_id, organization_id, effect)
  WHERE deleted_at IS NULL;

-- Index for role_permissions lookups (frequently joined in compiler)
CREATE INDEX IF NOT EXISTS idx_role_permissions_role
  ON public.role_permissions(role_id, allowed)
  WHERE deleted_at IS NULL;

COMMENT ON INDEX public.idx_organization_members_user_org IS
  'Performance: Fast active membership checks in compile_user_permissions';

COMMENT ON INDEX public.idx_user_role_assignments_compiler IS
  'Performance: Fast role assignment lookups in compile_user_permissions';

-- ============================================================================
-- PART 4: RLS POLICY HARDENING - PRIVILEGE ESCALATION PREVENTION
-- ============================================================================
-- Critical: Prevent users from assigning themselves org_owner role
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Fix: user_role_assignments INSERT policy is too permissive
-- ---------------------------------------------------------------------------
-- Current policy allows: (user_id = auth.uid())
-- This means ANY user can assign ANY role to themselves!
--
-- Security Issue: User could do:
-- INSERT INTO user_role_assignments (user_id, role_id, scope, scope_id)
-- VALUES (auth.uid(), 'org_owner_role_id', 'org', 'some_org_id');
-- → Instant privilege escalation to org_owner!
--
-- Fix: Users can only assign roles to themselves during self-registration
-- and only if they're creating their first org (no existing memberships)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "role_assignments_insert_permission" ON public.user_role_assignments;

CREATE POLICY "role_assignments_insert_permission"
  ON public.user_role_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admin case: Has members.manage permission
    (
      scope = 'org'
      AND has_permission(scope_id, 'members.manage')
    )
    OR
    -- Self-registration case: Only during org creation (handled by backend)
    -- Removed the dangerous (user_id = auth.uid()) blanket permission
    -- Users should NOT be able to directly assign roles to themselves
    (
      user_id = auth.uid()
      AND scope = 'org'
      -- Only allow if inserting org_member role (not org_owner!)
      AND EXISTS (
        SELECT 1 FROM public.roles r
        WHERE r.id = role_id
        AND r.name = 'org_member'  -- Only allow self-assignment of org_member
        AND r.deleted_at IS NULL
      )
      -- Only during initial org creation (user has no other memberships yet)
      AND NOT EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
        AND om.organization_id <> scope_id
        AND om.deleted_at IS NULL
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Fix: organization_members INSERT policy needs same hardening
-- ---------------------------------------------------------------------------
-- Current policy allows: (user_id = auth.uid())
-- This could allow users to add themselves as members without invitation

DROP POLICY IF EXISTS "members_insert_permission" ON public.organization_members;

CREATE POLICY "members_insert_permission"
  ON public.organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admin case: Has members.manage permission
    has_permission(organization_id, 'members.manage')
    OR
    -- Self-registration case: Only during org creation
    -- Backend should handle invitation flow separately
    (
      user_id = auth.uid()
      -- Only during initial setup (creating first org)
      AND NOT EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
        AND om.organization_id <> organization_id
        AND om.deleted_at IS NULL
      )
    )
  );

COMMENT ON POLICY "role_assignments_insert_permission" ON public.user_role_assignments IS
  'Enterprise hardening: Prevents privilege escalation. Users can only self-assign org_member role during initial org creation.';

COMMENT ON POLICY "members_insert_permission" ON public.organization_members IS
  'Enterprise hardening: Prevents unauthorized membership. Users can only self-add during initial org creation.';

-- ============================================================================
-- PART 5: ADDITIONAL FOREIGN KEY VALIDATION
-- ============================================================================
-- Verify all foreign keys exist (most already do, but double-check)
-- ============================================================================

-- These should already exist from previous migrations, but ensure they're present
DO $$
BEGIN
  -- Ensure user_effective_permissions.user_id references auth.users
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_effective_permissions_user_id_fkey'
    AND conrelid = 'public.user_effective_permissions'::regclass
  ) THEN
    ALTER TABLE public.user_effective_permissions
    ADD CONSTRAINT user_effective_permissions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  -- Ensure user_effective_permissions.organization_id references organizations
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_effective_permissions_organization_id_fkey'
    AND conrelid = 'public.user_effective_permissions'::regclass
  ) THEN
    ALTER TABLE public.user_effective_permissions
    ADD CONSTRAINT user_effective_permissions_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- PART 6: OBSERVABILITY - STALENESS TRACKING
-- ============================================================================
-- Add view to monitor permission compilation staleness
-- Helps debug "why don't I have permissions?" issues
-- ============================================================================

CREATE OR REPLACE VIEW public.permission_staleness_report AS
SELECT
  u.email,
  o.name as org_name,
  om.status as membership_status,
  COUNT(DISTINCT uep.permission_slug) as permission_count,
  MAX(uep.compiled_at) as last_compiled_at,
  EXTRACT(EPOCH FROM (now() - MAX(uep.compiled_at))) as seconds_since_compile,
  CASE
    WHEN MAX(uep.compiled_at) IS NULL THEN 'NEVER_COMPILED'
    WHEN EXTRACT(EPOCH FROM (now() - MAX(uep.compiled_at))) > 3600 THEN 'STALE (>1hr)'
    WHEN EXTRACT(EPOCH FROM (now() - MAX(uep.compiled_at))) > 300 THEN 'OLD (>5min)'
    ELSE 'FRESH'
  END as freshness_status
FROM public.organization_members om
JOIN auth.users u ON om.user_id = u.id
JOIN public.organizations o ON om.organization_id = o.id
LEFT JOIN public.user_effective_permissions uep
  ON uep.user_id = om.user_id
  AND uep.organization_id = om.organization_id
WHERE om.status = 'active'
  AND om.deleted_at IS NULL
GROUP BY u.email, o.name, om.status
ORDER BY seconds_since_compile DESC NULLS FIRST;

COMMENT ON VIEW public.permission_staleness_report IS
  'Observability: Shows how fresh each user''s compiled permissions are. Helps debug permission issues.';

-- Grant access to service_role for debugging
GRANT SELECT ON public.permission_staleness_report TO service_role;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these after migration to verify the hardening:
--
-- 1. Verify EXECUTE privileges are locked down:
-- SELECT
--   p.proname,
--   r.rolname,
--   has_function_privilege(r.oid, p.oid, 'EXECUTE') as can_execute
-- FROM pg_proc p
-- CROSS JOIN pg_roles r
-- WHERE p.proname IN (
--   'compile_user_permissions',
--   'has_permission',
--   'is_org_member'
-- )
-- AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
-- AND r.rolname IN ('authenticated', 'service_role', 'anon')
-- ORDER BY p.proname, r.rolname;
--
-- Expected:
-- - compile_user_permissions: only service_role can execute
-- - has_permission: authenticated and service_role can execute
-- - is_org_member: authenticated and service_role can execute
--
-- 2. Verify permission_slug validation trigger exists:
-- SELECT tgname, tgenabled
-- FROM pg_trigger
-- WHERE tgrelid = 'public.user_permission_overrides'::regclass
-- AND tgname = 'trigger_validate_permission_slug';
--
-- 3. Verify indexes exist:
-- SELECT indexname FROM pg_indexes
-- WHERE tablename IN (
--   'organization_members',
--   'user_role_assignments',
--   'user_permission_overrides'
-- )
-- AND indexname LIKE 'idx_%compiler%'
-- OR indexname LIKE 'idx_organization_members%';
--
-- 4. Test privilege escalation prevention:
-- -- Try to assign org_owner to yourself (should FAIL):
-- SET ROLE authenticated;
-- SET request.jwt.claims.sub = 'your-user-id';
-- INSERT INTO user_role_assignments (user_id, role_id, scope, scope_id)
-- SELECT
--   auth.uid(),
--   r.id,
--   'org',
--   'some-org-id'::uuid
-- FROM roles r WHERE r.name = 'org_owner';
-- -- Expected: ERROR - Policy violation
-- ============================================================================
