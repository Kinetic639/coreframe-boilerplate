-- Migration: Admin Dashboard V2 Foundation
-- Created: 2026-02-25
-- Purpose: Create admin_entitlements table and superadmin permission slugs
--          for the Admin Dashboard V2 scaffold.
--
-- NOTE ON SUPER_ADMIN ROLE:
-- The existing `roles` table has two check constraints that prevent inserting a
-- global-scoped role:
--   • roles_invariant: (is_basic = TRUE AND org_id IS NULL) OR
--                      (is_basic = FALSE AND org_id IS NOT NULL)
--   • roles_scope_type_check: scope_type IN ('org', 'branch', 'both')
-- Therefore the `super_admin` role is intentionally omitted from this migration.
-- Admin access is instead controlled via the `admin_entitlements` table.
-- The admin context loader synthesises a permission snapshot directly from
-- `admin_entitlements.enabled`, bypassing the org-scoped permission tables.

-- ---------------------------------------------------------------------------
-- 1. admin_entitlements table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_entitlements (
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id)
);

-- Enable Row Level Security
ALTER TABLE public.admin_entitlements ENABLE ROW LEVEL SECURITY;

-- FORCE RLS so even the table owner cannot bypass policies
ALTER TABLE public.admin_entitlements FORCE ROW LEVEL SECURITY;

-- Policy: users can only SELECT their own row
CREATE POLICY admin_entitlements_select_own
  ON public.admin_entitlements
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. Superadmin permission slugs
-- ---------------------------------------------------------------------------
-- These slugs live in the permissions catalogue for documentation and for
-- future role-permission assignments once the schema supports global roles.
-- They are NOT assigned to any role in this migration.

INSERT INTO public.permissions (slug, category, action, description)
VALUES
  ('superadmin.*',          'superadmin', '*',    'Superadmin wildcard — grants all superadmin permissions'),
  ('superadmin.admin.read', 'superadmin', 'read', 'View the Admin Dashboard V2'),
  ('superadmin.plans.read', 'superadmin', 'read', 'View subscription plans (admin)'),
  ('superadmin.pricing.read','superadmin','read', 'View pricing configuration (admin)')
ON CONFLICT (slug) DO NOTHING;
