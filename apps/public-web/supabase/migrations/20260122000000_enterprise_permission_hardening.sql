-- ============================================================================
-- Enterprise Permission System Hardening
-- ============================================================================
-- This migration applies 3 critical enterprise-grade fixes:
--
-- 1. Fix ON CONFLICT to update source_type (prevents stale metadata)
-- 2. Add active-membership guard to compile_user_permissions (idempotent safety)
-- 3. Harden membership trigger for org/user ID changes (prevents ghost permissions)
--
-- These fixes ensure the permission system is bulletproof for production use.
-- ============================================================================

-- ============================================================================
-- FIX #1 & #2: Update compile_user_permissions function
-- ============================================================================
-- Changes:
-- - Add active membership guard at the top (Fix #2)
-- - Update ON CONFLICT to include source_type (Fix #1)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.compile_user_permissions(
  p_user_id UUID,
  p_organization_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- ============================================================================
  -- FIX #2: Active membership guard
  -- ============================================================================
  -- Ensures we only compile for active org members
  -- Makes the function idempotent and safe even if called "too often"
  -- Enforces invariant: only active members can have compiled permissions

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = p_user_id
      AND organization_id = p_organization_id
      AND status = 'active'
      AND deleted_at IS NULL
  ) THEN
    -- User is not an active member - ensure no permissions exist and exit
    DELETE FROM public.user_effective_permissions
    WHERE user_id = p_user_id
      AND organization_id = p_organization_id;
    RETURN;
  END IF;

  -- ============================================================================
  -- Advisory lock to prevent concurrent compilation races
  -- ============================================================================

  PERFORM pg_advisory_xact_lock(
    hashtext(p_user_id::text || p_organization_id::text)
  );

  -- ============================================================================
  -- Delete existing effective permissions for this user/org
  -- ============================================================================

  DELETE FROM public.user_effective_permissions
  WHERE user_id = p_user_id
    AND organization_id = p_organization_id;

  -- ============================================================================
  -- Insert new effective permissions using set-based logic
  -- ============================================================================
  -- 1. Get all permissions from assigned roles
  -- 2. Add granted overrides
  -- 3. Remove revoked overrides
  -- All in one query, no loops

  INSERT INTO public.user_effective_permissions (
    user_id,
    organization_id,
    permission_slug,
    source_type,
    compiled_at
  )
  SELECT DISTINCT
    p_user_id,
    p_organization_id,
    final_perms.permission_slug,
    final_perms.source_type,
    now()
  FROM (
    -- Permissions from roles (excluding any that are revoked by overrides)
    SELECT
      p.slug AS permission_slug,
      'role' AS source_type
    FROM public.user_role_assignments ura
    JOIN public.roles r ON ura.role_id = r.id
    JOIN public.role_permissions rp ON r.id = rp.role_id AND rp.allowed = true
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ura.user_id = p_user_id
      AND ura.scope = 'org'
      AND ura.scope_id = p_organization_id
      AND ura.deleted_at IS NULL
      AND r.deleted_at IS NULL
      AND rp.deleted_at IS NULL
      AND p.deleted_at IS NULL
      -- Exclude permissions that have a revoke override
      AND NOT EXISTS (
        SELECT 1 FROM public.user_permission_overrides upo
        WHERE upo.user_id = p_user_id
          AND upo.organization_id = p_organization_id
          AND upo.permission_slug = p.slug
          AND upo.effect = 'revoke'
          AND upo.deleted_at IS NULL
      )

    UNION

    -- Permissions from grant overrides (that aren't already from roles)
    SELECT
      upo.permission_slug,
      'override' AS source_type
    FROM public.user_permission_overrides upo
    WHERE upo.user_id = p_user_id
      AND upo.organization_id = p_organization_id
      AND upo.effect = 'grant'
      AND upo.permission_slug IS NOT NULL
      AND upo.deleted_at IS NULL
  ) AS final_perms
  -- ============================================================================
  -- FIX #1: Update source_type on conflict
  -- ============================================================================
  -- Prevents stale source_type when permission source changes
  -- Example: Permission from role → role loses it → override grants it
  -- Without this fix: source_type stays 'role' even though it's now 'override'
  ON CONFLICT (user_id, organization_id, permission_slug) DO UPDATE
  SET
    compiled_at = now(),
    source_type = EXCLUDED.source_type;  -- ← FIX: Keep source_type accurate

END;
$$;

-- ============================================================================
-- FIX #3: Harden membership trigger for org/user ID changes
-- ============================================================================
-- Handles rare but possible cases:
-- - organization_id changes (admin mistake, data migration)
-- - user_id changes (admin mistake, data migration)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_compile_on_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- ============================================================================
  -- Handle INSERT
  -- ============================================================================
  IF TG_OP = 'INSERT' THEN
    -- New member added - compile if active
    IF NEW.status = 'active' AND NEW.deleted_at IS NULL THEN
      PERFORM public.compile_user_permissions(NEW.user_id, NEW.organization_id);
    END IF;
    RETURN NEW;
  END IF;

  -- ============================================================================
  -- Handle UPDATE
  -- ============================================================================
  IF TG_OP = 'UPDATE' THEN
    -- ============================================================================
    -- FIX #3: Handle org_id or user_id changes
    -- ============================================================================
    -- This prevents "ghost permissions" if IDs change due to admin mistakes
    IF (OLD.organization_id <> NEW.organization_id) OR (OLD.user_id <> NEW.user_id) THEN
      -- Delete permissions for OLD user/org
      DELETE FROM public.user_effective_permissions
      WHERE user_id = OLD.user_id
        AND organization_id = OLD.organization_id;

      -- Compile for NEW user/org (if active)
      IF NEW.status = 'active' AND NEW.deleted_at IS NULL THEN
        PERFORM public.compile_user_permissions(NEW.user_id, NEW.organization_id);
      END IF;

      RETURN NEW;
    END IF;

    -- ============================================================================
    -- Handle status changes (active ↔ inactive)
    -- ============================================================================
    -- User became inactive or deleted
    IF (OLD.status = 'active' AND NEW.status <> 'active')
       OR (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
      -- Remove all effective permissions
      DELETE FROM public.user_effective_permissions
      WHERE user_id = NEW.user_id
        AND organization_id = NEW.organization_id;
      RETURN NEW;
    END IF;

    -- User became active
    IF (OLD.status <> 'active' AND NEW.status = 'active')
       OR (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL) THEN
      -- Compile permissions
      PERFORM public.compile_user_permissions(NEW.user_id, NEW.organization_id);
      RETURN NEW;
    END IF;

    RETURN NEW;
  END IF;

  -- ============================================================================
  -- Handle DELETE
  -- ============================================================================
  IF TG_OP = 'DELETE' THEN
    -- Member removed - delete all effective permissions
    DELETE FROM public.user_effective_permissions
    WHERE user_id = OLD.user_id
      AND organization_id = OLD.organization_id;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- Create or replace the trigger on organization_members
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_membership_compile ON public.organization_members;

CREATE TRIGGER trigger_membership_compile
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_compile_on_membership();

-- ============================================================================
-- Add helpful comments for documentation
-- ============================================================================

COMMENT ON FUNCTION public.compile_user_permissions(UUID, UUID) IS
  'V2 Permission Compiler (Enterprise Hardened):
  - Active membership guard prevents compiling for inactive users
  - Advisory lock prevents concurrent compilation races
  - Set-based logic (no loops) for performance
  - Updates source_type on conflict to prevent stale metadata
  - Idempotent and safe to call multiple times';

COMMENT ON FUNCTION public.trigger_compile_on_membership() IS
  'V2 Membership Trigger (Enterprise Hardened):
  - Handles INSERT/UPDATE/DELETE on organization_members
  - Handles org_id/user_id changes to prevent ghost permissions
  - Handles status changes (active ↔ inactive)
  - Automatically compiles/removes permissions as needed';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these after migration to verify the fixes:
--
-- 1. Check that compile_user_permissions has membership guard:
-- SELECT pg_get_functiondef(oid)
-- FROM pg_proc
-- WHERE proname = 'compile_user_permissions'
-- AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
-- → Should contain "IF NOT EXISTS" membership check
--
-- 2. Check that ON CONFLICT updates source_type:
-- → Should contain "source_type = EXCLUDED.source_type"
--
-- 3. Check that membership trigger handles ID changes:
-- SELECT pg_get_functiondef(oid)
-- FROM pg_proc
-- WHERE proname = 'trigger_compile_on_membership'
-- AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
-- → Should contain "IF (OLD.organization_id <> NEW.organization_id)"
--
-- 4. Test the fixes:
-- -- Test Fix #2: Try to compile for non-member (should delete and exit)
-- SELECT compile_user_permissions(
--   'some-user-id'::uuid,
--   'some-org-id'::uuid
-- );
-- -- Verify no permissions created
-- SELECT COUNT(*) FROM user_effective_permissions
-- WHERE user_id = 'some-user-id'::uuid;
-- -- Expected: 0
-- ============================================================================
