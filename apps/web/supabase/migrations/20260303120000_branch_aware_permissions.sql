-- ============================================================================
-- Migration: Branch-Aware Permission Compilation
-- 2026-03-03
--
-- Changes:
--   Step 1: Add branch_id UUID NULL to user_effective_permissions
--   Step 2: Drop old unique constraint, create NULLS NOT DISTINCT version
--   Step 3: Add idx_uep_user_org_branch index
--   Step 4: Update compile_user_permissions to compile branch-scoped roles
--   Step 5: Fix has_permission to filter branch_id IS NULL
--   Step 6: Fix user_has_effective_permission to filter branch_id IS NULL
--   Step 7: Update trigger to fire on branch assignment changes
--   Step 8: Add has_branch_permission function
--   Step 9: Backfill-recompile all active users
-- ============================================================================


-- ============================================================================
-- STEP 1: Add branch_id column
-- ============================================================================

ALTER TABLE public.user_effective_permissions
  ADD COLUMN IF NOT EXISTS branch_id UUID NULL;


-- ============================================================================
-- STEP 2: Replace unique constraint
-- ============================================================================

ALTER TABLE public.user_effective_permissions
  DROP CONSTRAINT IF EXISTS user_effective_permissions_unique;

ALTER TABLE public.user_effective_permissions
  ADD CONSTRAINT user_effective_permissions_unique_v2
    UNIQUE NULLS NOT DISTINCT (user_id, organization_id, permission_slug, branch_id);


-- ============================================================================
-- STEP 3: Add branch-aware lookup index
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_uep_user_org_branch
  ON public.user_effective_permissions (user_id, organization_id, branch_id);


-- ============================================================================
-- STEP 4: Update compile_user_permissions
-- Now compiles:
--   - org-scoped role assignments  → branch_id = NULL
--   - branch-scoped role assignments → branch_id = ura.scope_id
-- ============================================================================

CREATE OR REPLACE FUNCTION public.compile_user_permissions(
  p_user_id        uuid,
  p_organization_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- ============================================================================
  -- Active membership guard
  -- Ensures we only compile for active org members.
  -- If user is not active, wipe and exit.
  -- ============================================================================
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id        = p_user_id
      AND organization_id = p_organization_id
      AND status          = 'active'
      AND deleted_at      IS NULL
  ) THEN
    DELETE FROM public.user_effective_permissions
    WHERE user_id        = p_user_id
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
  -- Delete existing effective permissions for this user/org (all scopes)
  -- ============================================================================
  DELETE FROM public.user_effective_permissions
  WHERE user_id        = p_user_id
    AND organization_id = p_organization_id;

  -- ============================================================================
  -- ORG-SCOPED permissions (branch_id = NULL)
  -- Source: org-scoped role assignments + grant overrides
  -- Excludes: permissions with active revoke override
  -- ============================================================================
  INSERT INTO public.user_effective_permissions (
    user_id,
    organization_id,
    permission_slug,
    source_type,
    branch_id,
    compiled_at
  )
  SELECT DISTINCT
    p_user_id,
    p_organization_id,
    final_perms.permission_slug,
    final_perms.source_type,
    NULL::uuid,
    now()
  FROM (
    -- Permissions from org-scoped role assignments
    SELECT
      p.slug AS permission_slug,
      'role'  AS source_type
    FROM public.user_role_assignments ura
    JOIN public.roles           r  ON ura.role_id      = r.id
    JOIN public.role_permissions rp ON r.id             = rp.role_id AND rp.allowed = true
    JOIN public.permissions      p  ON rp.permission_id = p.id
    WHERE ura.user_id    = p_user_id
      AND ura.scope      = 'org'
      AND ura.scope_id   = p_organization_id
      AND ura.deleted_at IS NULL
      AND r.deleted_at   IS NULL
      AND rp.deleted_at  IS NULL
      AND p.deleted_at   IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.user_permission_overrides upo
        WHERE upo.user_id        = p_user_id
          AND upo.organization_id = p_organization_id
          AND upo.permission_slug = p.slug
          AND upo.effect          = 'revoke'
          AND upo.deleted_at      IS NULL
      )

    UNION

    -- Permissions from explicit grant overrides
    SELECT
      upo.permission_slug,
      'override' AS source_type
    FROM public.user_permission_overrides upo
    WHERE upo.user_id        = p_user_id
      AND upo.organization_id = p_organization_id
      AND upo.effect          = 'grant'
      AND upo.permission_slug IS NOT NULL
      AND upo.deleted_at      IS NULL
  ) AS final_perms
  ON CONFLICT ON CONSTRAINT user_effective_permissions_unique_v2
  DO UPDATE SET
    compiled_at = now(),
    source_type = EXCLUDED.source_type;

  -- ============================================================================
  -- BRANCH-SCOPED permissions (branch_id = ura.scope_id)
  -- Source: branch-scoped role assignments for branches in this org
  -- Excludes: permissions with active revoke override (org-level revokes apply)
  -- ============================================================================
  INSERT INTO public.user_effective_permissions (
    user_id,
    organization_id,
    permission_slug,
    source_type,
    branch_id,
    compiled_at
  )
  SELECT DISTINCT
    p_user_id,
    p_organization_id,
    p.slug,
    'role',
    ura.scope_id,   -- branch UUID
    now()
  FROM public.user_role_assignments ura
  JOIN public.roles            r  ON ura.role_id      = r.id
  JOIN public.role_permissions rp ON r.id             = rp.role_id AND rp.allowed = true
  JOIN public.permissions      p  ON rp.permission_id = p.id
  JOIN public.branches         b  ON b.id             = ura.scope_id
                                  AND b.deleted_at    IS NULL
  WHERE ura.user_id         = p_user_id
    AND ura.scope           = 'branch'
    AND b.organization_id   = p_organization_id   -- only branches of this org
    AND ura.deleted_at      IS NULL
    AND r.deleted_at        IS NULL
    AND rp.deleted_at       IS NULL
    AND p.deleted_at        IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.user_permission_overrides upo
      WHERE upo.user_id        = p_user_id
        AND upo.organization_id = p_organization_id
        AND upo.permission_slug = p.slug
        AND upo.effect          = 'revoke'
        AND upo.deleted_at      IS NULL
    )
  ON CONFLICT ON CONSTRAINT user_effective_permissions_unique_v2
  DO UPDATE SET
    compiled_at = now(),
    source_type = EXCLUDED.source_type;

END;
$function$;


-- ============================================================================
-- STEP 5: Fix has_permission — add branch_id IS NULL guard
-- Ensures org-level checks cannot be satisfied by branch-specific rows.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_permission(org_id uuid, permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_effective_permissions
    WHERE organization_id = org_id
      AND user_id         = auth.uid()
      AND permission_slug = permission
      AND branch_id       IS NULL
  );
$function$;


-- ============================================================================
-- STEP 6: Fix user_has_effective_permission — add branch_id IS NULL guard
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_has_effective_permission(
  p_user_id          uuid,
  p_organization_id  uuid,
  p_permission_slug  text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_effective_permissions
    WHERE user_id         = p_user_id
      AND organization_id = p_organization_id
      AND permission_slug = p_permission_slug
      AND branch_id       IS NULL
  );
$function$;


-- ============================================================================
-- STEP 7: Update trigger_compile_on_role_assignment
-- Now fires for both scope='org' and scope='branch' changes.
-- For branch scope, resolves org_id from branches table.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_compile_on_role_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_org_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.scope = 'org' THEN
      PERFORM public.compile_user_permissions(OLD.user_id, OLD.scope_id);
    ELSIF OLD.scope = 'branch' THEN
      SELECT organization_id INTO v_org_id
      FROM public.branches
      WHERE id = OLD.scope_id;
      IF v_org_id IS NOT NULL THEN
        PERFORM public.compile_user_permissions(OLD.user_id, v_org_id);
      END IF;
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.scope = 'org' THEN
      PERFORM public.compile_user_permissions(NEW.user_id, NEW.scope_id);
    ELSIF NEW.scope = 'branch' THEN
      SELECT organization_id INTO v_org_id
      FROM public.branches
      WHERE id = NEW.scope_id;
      IF v_org_id IS NOT NULL THEN
        PERFORM public.compile_user_permissions(NEW.user_id, v_org_id);
      END IF;
    END IF;
    RETURN NEW;
  END IF;
END;
$function$;


-- ============================================================================
-- STEP 8: Add has_branch_permission function
-- Returns TRUE if the current user has the permission either:
--   - org-wide (branch_id IS NULL), OR
--   - specifically for the given branch (branch_id = p_branch_id)
-- Org-wide grants always satisfy branch-level checks.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_branch_permission(
  p_org_id          uuid,
  p_branch_id       uuid,
  p_permission_slug text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_effective_permissions
    WHERE user_id         = auth.uid()
      AND organization_id = p_org_id
      AND permission_slug = p_permission_slug
      AND (
            branch_id IS NULL          -- org-wide grant satisfies any branch check
        OR  branch_id = p_branch_id    -- branch-specific grant for the exact branch
      )
  );
$function$;


-- ============================================================================
-- STEP 9: Backfill — recompile all active users in all orgs
-- compile_user_permissions is idempotent: delete + reinsert under advisory lock.
-- This ensures all existing branch-scoped role assignments are now compiled.
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT user_id, organization_id
    FROM public.organization_members
    WHERE status     = 'active'
      AND deleted_at IS NULL
    ORDER BY organization_id, user_id
  LOOP
    PERFORM public.compile_user_permissions(r.user_id, r.organization_id);
  END LOOP;
END;
$$;
