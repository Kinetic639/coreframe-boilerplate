-- =============================================================================
-- Permission Slug Exact — Compiler-side wildcard expansion (100k-ready)
-- =============================================================================
--
-- Problem: Wildcard permission slugs (e.g. "account.*", "module.*") are stored
-- verbatim in user_effective_permissions.  DB RPC functions (has_permission,
-- has_branch_permission, user_has_effective_permission) do exact string matches,
-- so a user with "account.*" in UEP CANNOT pass `has_permission(org_id, 'account.profile.read')`.
--
-- This forces RLS authors to always call has_permission with exact slugs that
-- the user literally has stored — meaning wildcards provide no DB-layer benefit.
-- At 100k+ UEP rows this becomes a scalability and correctness hazard.
--
-- Solution: Add `permission_slug_exact` column. The compiler expands wildcard
-- source slugs into one UEP row per matching concrete slug (from the permissions
-- registry). DB functions use `permission_slug_exact = p_slug` — pure btree exact
-- lookup, index-optimal, O(1) per check.
--
-- Changes in this migration:
--   1. Add permission_slug_exact column (nullable → backfill → NOT NULL)
--   2. Drop old unique constraint (was on permission_slug)
--   3. Add new unique constraint user_effective_permissions_unique_v3 (on permission_slug_exact)
--   4. Drop old partial indexes (were on permission_slug from the 10k package)
--   5. Recreate compile_user_permissions with wildcard expansion logic
--   6. Update has_permission, has_branch_permission, user_has_effective_permission
--   7. Add new partial indexes on permission_slug_exact
--   8. Backfill: re-run compile for all existing user/org pairs
--   9. Update audit_uep_partial_indexes to reflect new index names
-- =============================================================================

-- =============================================================================
-- Step 1: Add permission_slug_exact column
-- =============================================================================

ALTER TABLE public.user_effective_permissions
  ADD COLUMN IF NOT EXISTS permission_slug_exact text;

-- =============================================================================
-- Step 2: Initial backfill — exact = slug for all current rows
-- For non-wildcard rows this is permanent. Wildcard rows will be replaced
-- in Step 8 when the compiler re-runs with the new expansion logic.
-- =============================================================================

UPDATE public.user_effective_permissions
SET permission_slug_exact = permission_slug
WHERE permission_slug_exact IS NULL;

-- =============================================================================
-- Step 3: Drop old unique constraint (was on permission_slug)
-- =============================================================================

ALTER TABLE public.user_effective_permissions
  DROP CONSTRAINT IF EXISTS user_effective_permissions_unique_v2;

-- =============================================================================
-- Step 4: Add new unique constraint on permission_slug_exact
-- Uniqueness identity is now: one row per (user, org, exact_slug, branch).
-- This allows a wildcard source ("account.*") to produce many rows, one per
-- concrete slug, all sharing the same user/org/branch context.
-- =============================================================================

ALTER TABLE public.user_effective_permissions
  ADD CONSTRAINT user_effective_permissions_unique_v3
  UNIQUE NULLS NOT DISTINCT (user_id, organization_id, permission_slug_exact, branch_id);

-- =============================================================================
-- Step 5: Set NOT NULL on permission_slug_exact (all rows backfilled in Step 2)
-- =============================================================================

ALTER TABLE public.user_effective_permissions
  ALTER COLUMN permission_slug_exact SET NOT NULL;

-- =============================================================================
-- Step 6: Drop old partial indexes (10k package, on permission_slug)
-- They will be replaced by new indexes on permission_slug_exact in Step 9.
-- =============================================================================

DROP INDEX IF EXISTS public.uep_org_exact_active_idx;
DROP INDEX IF EXISTS public.uep_branch_exact_active_idx;

-- =============================================================================
-- Step 7: Rewrite compile_user_permissions with wildcard expansion
--
-- Expansion logic:
--   - For concrete slugs (no '*'): permission_slug_exact = permission_slug (unchanged)
--   - For wildcard slugs (contains '*'): LEFT JOIN permissions registry where
--     p2.slug LIKE replace(p.slug, '*', '%') AND p2.slug NOT LIKE '%*%'
--     → each matching concrete slug becomes one UEP row
--   - Wildcard rows with no matching expansion (empty registry) are dropped (no row inserted)
--   - ON CONFLICT on permission_slug_exact (new unique_v3 constraint) with DO UPDATE
--   - permission_slug column retained for source traceability (which wildcard caused this row)
--
-- Revoke semantics (unchanged):
--   Revoke overrides are matched against the SOURCE slug (p.slug / upo.permission_slug),
--   not the expanded exact slug. Revoking "warehouse.*" drops all expansions of that
--   source. Revoking a specific concrete slug blocks that exact grant.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.compile_user_permissions(
  p_user_id       uuid,
  p_organization_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
  -- Wildcards: expanded into one row per matching concrete slug
  -- ============================================================================
  INSERT INTO public.user_effective_permissions (
    user_id,
    organization_id,
    permission_slug,
    permission_slug_exact,
    source_type,
    branch_id,
    compiled_at
  )
  SELECT DISTINCT
    p_user_id,
    p_organization_id,
    base.permission_slug,
    base.permission_slug_exact,
    base.source_type,
    NULL::uuid,
    now()
  FROM (
    -- ── Role-based permissions (org scope) ────────────────────────────────
    -- Wildcard slugs (e.g. "account.*") are expanded via a LEFT JOIN to the
    -- permissions registry.  Each matching concrete slug becomes one row.
    -- Non-wildcard slugs pass through unchanged (permission_slug_exact = permission_slug).
    SELECT
      p.slug                                       AS permission_slug,
      COALESCE(p2.slug, p.slug)                    AS permission_slug_exact,
      'role'                                       AS source_type
    FROM public.user_role_assignments ura
    JOIN public.roles            r   ON ura.role_id      = r.id
    JOIN public.role_permissions rp  ON r.id              = rp.role_id AND rp.allowed = true
    JOIN public.permissions      p   ON rp.permission_id  = p.id
    -- Wildcard expansion: only active when source slug contains '*'
    LEFT JOIN public.permissions p2
      ON  p.slug LIKE '%*%'                        -- source is a wildcard
      AND p2.slug NOT LIKE '%*%'                   -- target must be concrete
      AND p2.deleted_at IS NULL
      AND p2.slug LIKE replace(p.slug, '*', '%')   -- expansion: e.g. 'account.%'
    WHERE ura.user_id    = p_user_id
      AND ura.scope      = 'org'
      AND ura.scope_id   = p_organization_id
      AND ura.deleted_at IS NULL
      AND r.deleted_at   IS NULL
      AND rp.deleted_at  IS NULL
      AND p.deleted_at   IS NULL
      -- For wildcard slugs: only include rows where expansion matched
      -- For concrete slugs: always include (p2 is NULL due to LEFT JOIN predicate)
      AND (NOT p.slug LIKE '%*%' OR p2.slug IS NOT NULL)
      -- Revoke check: matched against SOURCE slug (p.slug) so revoking 'account.*'
      -- drops all expanded rows from that wildcard source
      AND NOT EXISTS (
        SELECT 1 FROM public.user_permission_overrides upo
        WHERE upo.user_id        = p_user_id
          AND upo.organization_id = p_organization_id
          AND upo.permission_slug = p.slug
          AND upo.effect          = 'revoke'
          AND upo.deleted_at      IS NULL
      )

    UNION

    -- ── Explicit grant overrides (org scope) ──────────────────────────────
    -- Override slugs may also be wildcards; expand them the same way.
    SELECT
      upo.permission_slug                          AS permission_slug,
      COALESCE(p2.slug, upo.permission_slug)       AS permission_slug_exact,
      'override'                                   AS source_type
    FROM public.user_permission_overrides upo
    LEFT JOIN public.permissions p2
      ON  upo.permission_slug LIKE '%*%'
      AND p2.slug NOT LIKE '%*%'
      AND p2.deleted_at IS NULL
      AND p2.slug LIKE replace(upo.permission_slug, '*', '%')
    WHERE upo.user_id        = p_user_id
      AND upo.organization_id = p_organization_id
      AND upo.effect          = 'grant'
      AND upo.permission_slug IS NOT NULL
      AND upo.deleted_at      IS NULL
      AND (NOT upo.permission_slug LIKE '%*%' OR p2.slug IS NOT NULL)
  ) AS base
  ON CONFLICT ON CONSTRAINT user_effective_permissions_unique_v3
  DO UPDATE SET
    compiled_at           = now(),
    source_type           = EXCLUDED.source_type,
    permission_slug       = EXCLUDED.permission_slug;   -- keep source for traceability

  -- ============================================================================
  -- BRANCH-SCOPED permissions (branch_id = ura.scope_id)
  -- Source: branch-scoped role assignments for branches in this org
  -- Excludes: permissions with active revoke override (org-level revokes apply)
  -- Wildcards: expanded the same way as org-scope above
  -- ============================================================================
  INSERT INTO public.user_effective_permissions (
    user_id,
    organization_id,
    permission_slug,
    permission_slug_exact,
    source_type,
    branch_id,
    compiled_at
  )
  SELECT DISTINCT
    p_user_id,
    p_organization_id,
    base.permission_slug,
    base.permission_slug_exact,
    base.source_type,
    base.branch_id,
    now()
  FROM (
    SELECT
      p.slug                                       AS permission_slug,
      COALESCE(p2.slug, p.slug)                    AS permission_slug_exact,
      'role'                                       AS source_type,
      ura.scope_id                                 AS branch_id
    FROM public.user_role_assignments ura
    JOIN public.roles            r   ON ura.role_id      = r.id
    JOIN public.role_permissions rp  ON r.id              = rp.role_id AND rp.allowed = true
    JOIN public.permissions      p   ON rp.permission_id  = p.id
    JOIN public.branches         b   ON b.id              = ura.scope_id
                                     AND b.deleted_at    IS NULL
    LEFT JOIN public.permissions p2
      ON  p.slug LIKE '%*%'
      AND p2.slug NOT LIKE '%*%'
      AND p2.deleted_at IS NULL
      AND p2.slug LIKE replace(p.slug, '*', '%')
    WHERE ura.user_id         = p_user_id
      AND ura.scope           = 'branch'
      AND b.organization_id   = p_organization_id
      AND ura.deleted_at      IS NULL
      AND r.deleted_at        IS NULL
      AND rp.deleted_at       IS NULL
      AND p.deleted_at        IS NULL
      AND (NOT p.slug LIKE '%*%' OR p2.slug IS NOT NULL)
      AND NOT EXISTS (
        SELECT 1 FROM public.user_permission_overrides upo
        WHERE upo.user_id        = p_user_id
          AND upo.organization_id = p_organization_id
          AND upo.permission_slug = p.slug
          AND upo.effect          = 'revoke'
          AND upo.deleted_at      IS NULL
      )
  ) AS base
  ON CONFLICT ON CONSTRAINT user_effective_permissions_unique_v3
  DO UPDATE SET
    compiled_at           = now(),
    source_type           = EXCLUDED.source_type,
    permission_slug       = EXCLUDED.permission_slug;

END;
$$;

-- =============================================================================
-- Step 8: Update has_permission — use permission_slug_exact for exact match
-- =============================================================================

CREATE OR REPLACE FUNCTION public.has_permission(org_id uuid, permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_effective_permissions
    WHERE organization_id       = org_id
      AND user_id               = auth.uid()
      AND permission_slug_exact = permission
      AND branch_id             IS NULL
  );
$$;

-- =============================================================================
-- Step 9: Update has_branch_permission — use permission_slug_exact
-- =============================================================================

CREATE OR REPLACE FUNCTION public.has_branch_permission(
  p_org_id          uuid,
  p_branch_id       uuid,
  p_permission_slug text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_effective_permissions
    WHERE user_id               = auth.uid()
      AND organization_id       = p_org_id
      AND permission_slug_exact = p_permission_slug
      AND (
            branch_id IS NULL            -- org-wide grant satisfies any branch check
        OR  branch_id = p_branch_id      -- branch-specific grant for the exact branch
      )
  );
$$;

-- =============================================================================
-- Step 10: Update user_has_effective_permission — use permission_slug_exact
-- =============================================================================

CREATE OR REPLACE FUNCTION public.user_has_effective_permission(
  p_user_id         uuid,
  p_organization_id uuid,
  p_permission_slug text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
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

-- =============================================================================
-- Step 11: Add new partial indexes on permission_slug_exact
--
-- These replace the old 10k partial indexes (now dropped) with equivalent
-- indexes on the new permission_slug_exact column.
--
-- DB functions doing `permission_slug_exact = $N` on org-scope rows use
-- uep_org_slug_exact_idx for an O(log N) btree lookup.
--
-- DB functions doing `permission_slug_exact = $N` on branch-scope rows use
-- uep_branch_slug_exact_idx.
-- =============================================================================

CREATE INDEX IF NOT EXISTS uep_org_slug_exact_idx
  ON public.user_effective_permissions (organization_id, user_id, permission_slug_exact)
  WHERE branch_id IS NULL;

CREATE INDEX IF NOT EXISTS uep_branch_slug_exact_idx
  ON public.user_effective_permissions (organization_id, user_id, branch_id, permission_slug_exact)
  WHERE branch_id IS NOT NULL;

-- =============================================================================
-- Step 12: Backfill — re-run compile for all existing user/org pairs
--
-- This replaces the initial verbatim backfill (Step 2) with properly expanded
-- rows. The compiler DELETEs all rows for the user/org then re-INSERTs with
-- correct permission_slug_exact values (expanded from wildcards).
--
-- Note: This runs inline (not CONCURRENTLY) and takes an advisory lock per
-- user/org pair. For large deployments with many UEP rows, run this block
-- manually via psql on a maintenance window.
-- =============================================================================

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT user_id, organization_id
    FROM public.user_effective_permissions
  LOOP
    PERFORM public.compile_user_permissions(r.user_id, r.organization_id);
  END LOOP;
END;
$$;

-- =============================================================================
-- Step 13: Update audit_uep_partial_indexes to reflect new index names
-- =============================================================================

CREATE OR REPLACE FUNCTION public.audit_uep_partial_indexes()
RETURNS TABLE(indexname text, indexdef text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT
    i.indexname::text,
    i.indexdef::text
  FROM pg_indexes i
  WHERE i.schemaname = 'public'
    AND i.tablename  = 'user_effective_permissions'
    AND i.indexname  IN ('uep_org_slug_exact_idx', 'uep_branch_slug_exact_idx')
  ORDER BY i.indexname;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_uep_partial_indexes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_uep_partial_indexes() TO service_role;
