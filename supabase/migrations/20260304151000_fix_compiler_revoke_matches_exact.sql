-- =============================================================================
-- Fix: compiler revoke check must also match against permission_slug_exact
-- =============================================================================
--
-- Bug (P0): After the 100k wildcard-expansion migration, the NOT EXISTS revoke
-- checks in compile_user_permissions still compared only against the SOURCE slug
-- (p.slug, e.g. "account.*").  This means a revoke override for the EXPANDED
-- concrete slug (e.g. "account.profile.read") was silently ignored — the expanded
-- row was still inserted into UEP even though it should have been suppressed.
--
-- Root cause:
--   The org-scope and branch-scope NOT EXISTS checks contained:
--     AND upo.permission_slug = p.slug          ← source slug only
--
--   When p.slug = 'account.*' and expansion yields p2.slug = 'account.profile.read',
--   a revoke for 'account.profile.read' did NOT match the check above and the row
--   was inserted.
--
-- Fix (minimal):
--   Change both NOT EXISTS clauses to also match against COALESCE(p2.slug, p.slug),
--   which equals permission_slug_exact for the row being considered:
--
--     AND (upo.permission_slug = p.slug
--          OR upo.permission_slug = COALESCE(p2.slug, p.slug))
--
--   Behavior matrix:
--   ┌────────────────────┬──────────────────────┬────────────────────────────┐
--   │ Revoke for         │ Source p.slug        │ Suppressed?                │
--   ├────────────────────┼──────────────────────┼────────────────────────────┤
--   │ account.*          │ account.*            │ YES — entire wildcard       │
--   │ account.profile.rd │ account.*            │ YES — exact expanded slug  │ ← was broken
--   │ account.profile.rd │ account.profile.rd   │ YES — exact concrete slug  │
--   │ account.profile.rd │ org.read             │ NO  — unrelated slug       │
--   └────────────────────┴──────────────────────┴────────────────────────────┘
--
--   NULL-safe: for concrete source slugs (no '*'), p2 is NULL (LEFT JOIN predicate
--   fails), so COALESCE(p2.slug, p.slug) = p.slug.  The OR clause reduces to
--   upo.permission_slug = p.slug — identical to the previous behavior.
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
    SELECT
      p.slug                                       AS permission_slug,
      COALESCE(p2.slug, p.slug)                    AS permission_slug_exact,
      'role'                                       AS source_type
    FROM public.user_role_assignments ura
    JOIN public.roles            r   ON ura.role_id      = r.id
    JOIN public.role_permissions rp  ON r.id              = rp.role_id AND rp.allowed = true
    JOIN public.permissions      p   ON rp.permission_id  = p.id
    LEFT JOIN public.permissions p2
      ON  p.slug LIKE '%*%'
      AND p2.slug NOT LIKE '%*%'
      AND p2.deleted_at IS NULL
      AND p2.slug LIKE replace(p.slug, '*', '%')
    WHERE ura.user_id    = p_user_id
      AND ura.scope      = 'org'
      AND ura.scope_id   = p_organization_id
      AND ura.deleted_at IS NULL
      AND r.deleted_at   IS NULL
      AND rp.deleted_at  IS NULL
      AND p.deleted_at   IS NULL
      AND (NOT p.slug LIKE '%*%' OR p2.slug IS NOT NULL)
      -- ── Revoke check (FIXED) ─────────────────────────────────────────────
      -- Match revokes against EITHER the source wildcard slug (p.slug)
      -- OR the expanded exact slug (COALESCE(p2.slug, p.slug)).
      -- This ensures "revoke account.profile.read" suppresses the expanded
      -- row produced by "account.*", not just rows with that exact source slug.
      AND NOT EXISTS (
        SELECT 1 FROM public.user_permission_overrides upo
        WHERE upo.user_id        = p_user_id
          AND upo.organization_id = p_organization_id
          AND (upo.permission_slug = p.slug
               OR upo.permission_slug = COALESCE(p2.slug, p.slug))
          AND upo.effect          = 'revoke'
          AND upo.deleted_at      IS NULL
      )

    UNION

    -- ── Explicit grant overrides (org scope) ──────────────────────────────
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
    permission_slug       = EXCLUDED.permission_slug;

  -- ============================================================================
  -- BRANCH-SCOPED permissions (branch_id = ura.scope_id)
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
      -- ── Revoke check (FIXED) — same fix as org-scope above ───────────────
      AND NOT EXISTS (
        SELECT 1 FROM public.user_permission_overrides upo
        WHERE upo.user_id        = p_user_id
          AND upo.organization_id = p_organization_id
          AND (upo.permission_slug = p.slug
               OR upo.permission_slug = COALESCE(p2.slug, p.slug))
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
