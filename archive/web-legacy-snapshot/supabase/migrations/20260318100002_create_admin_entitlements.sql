-- Migration: Create admin_entitlements table
-- Date: 2026-03-18
-- Purpose: Fix G3 audit finding — admin_entitlements table did not exist in
--   the target DB, making the admin portal permanently inaccessible.
--
-- ROOT CAUSE (G3 audit finding):
--   Migration 20260225073934_admin_v2_foundation.sql was created locally but
--   never applied to the target DB (which uses target_* migration naming).
--   AdminEntitlementsService.loadAdminEntitlements() queries this table;
--   on error it returns null; loadAdminContextV2() synthesised an empty
--   permission snapshot from null → admin portal blocked for all users.
--
-- TABLE CONTRACT:
--   admin_entitlements
--     user_id    UUID PRIMARY KEY  — FK to auth.users
--     enabled    BOOLEAN           — true = user is a superadmin
--     created_at TIMESTAMPTZ
--     updated_at TIMESTAMPTZ
--
--   One row per admin user. No row = not an admin.
--   enabled = false = revoked admin (row kept for audit trail).
--
-- SECURITY:
--   RLS enabled + FORCE ROW LEVEL SECURITY.
--   Only SELECT is exposed to authenticated users (own row only).
--   INSERT/UPDATE/DELETE must go through service_role (migrations, admin ops).
--   No authenticated user can grant themselves admin — only service_role can.

-- ---------------------------------------------------------------------------
-- 1. Create table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_entitlements (
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id)
);

-- ---------------------------------------------------------------------------
-- 2. Index for fast point-lookups (user_id is already PK, but explicit for clarity)
-- ---------------------------------------------------------------------------

-- PK already covers this, but ensure the index name is clear in pg_indexes
-- No additional index needed — PK index is sufficient for single-row lookups.

-- ---------------------------------------------------------------------------
-- 3. updated_at auto-trigger
-- ---------------------------------------------------------------------------

-- Only add trigger if the function exists (it's defined in core migration)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'set_updated_at'
  ) THEN
    CREATE TRIGGER admin_entitlements_updated_at
      BEFORE UPDATE ON public.admin_entitlements
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL; -- trigger already exists
END $$;

-- ---------------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.admin_entitlements ENABLE ROW LEVEL SECURITY;

-- FORCE RLS: even the table owner (postgres superuser) goes through policies.
-- This prevents accidental reads during pg_dump / admin sessions.
ALTER TABLE public.admin_entitlements FORCE ROW LEVEL SECURITY;

-- DROP any stale policies first (idempotent re-run safety)
DROP POLICY IF EXISTS admin_entitlements_select_own    ON public.admin_entitlements;
DROP POLICY IF EXISTS admin_entitlements_all_service   ON public.admin_entitlements;

-- SELECT: users can only read their own row (to check if they are admin)
CREATE POLICY admin_entitlements_select_own
  ON public.admin_entitlements
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ALL: service_role bypass (needed for seeding / admin management operations)
CREATE POLICY admin_entitlements_all_service
  ON public.admin_entitlements
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 5. Comments
-- ---------------------------------------------------------------------------

COMMENT ON TABLE public.admin_entitlements IS
  'Controls superadmin access to Admin Dashboard V2. '
  'One row per admin user — absence means no admin access. '
  'enabled = false means revoked (row kept for audit trail). '
  'Permission snapshot is synthesised by loadAdminContextV2 from this table.';

COMMENT ON COLUMN public.admin_entitlements.enabled IS
  'true = user has superadmin access; false = access revoked but row retained.';

-- ---------------------------------------------------------------------------
-- 6. Superadmin permission slugs in catalogue (idempotent)
-- ---------------------------------------------------------------------------
-- These slugs document the admin permission space and are referenced by
-- the SUPERADMIN_* constants in src/lib/constants/permissions.ts.

INSERT INTO public.permissions (slug, category, action, description)
VALUES
  ('superadmin.*',           'superadmin', '*',    'Superadmin wildcard — grants all superadmin permissions'),
  ('superadmin.admin.read',  'superadmin', 'read', 'View the Admin Dashboard V2'),
  ('superadmin.plans.read',  'superadmin', 'read', 'View subscription plans (admin)'),
  ('superadmin.pricing.read','superadmin', 'read', 'View pricing configuration (admin)')
ON CONFLICT (slug) DO NOTHING;
