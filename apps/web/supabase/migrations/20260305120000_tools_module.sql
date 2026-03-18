-- Migration: tools_module
-- Date: 2026-03-05
--
-- Creates the Tools module tables, RLS policies, seeds catalog data,
-- and grants tools.read / tools.manage permissions to org_owner and org_member.
--
-- Design:
--   - tools_catalog: global, read-only for all authenticated users
--   - user_enabled_tools: per-user, full ownership (user_id = auth.uid())
--   - tools.read: granted to org_owner + org_member (view catalog + detail)
--   - tools.manage: granted to org_owner + org_member (enable/disable/pin/settings)
--   - Tools is ALWAYS AVAILABLE — no subscription plan gating.

-- ============================================================
-- 1. tools_catalog
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tools_catalog (
  slug         text PRIMARY KEY,
  name         text NOT NULL,
  description  text,
  category     text,
  icon_key     text,
  is_active    boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tools_catalog ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tools_catalog'
      AND policyname = 'tools_catalog_select_authenticated'
  ) THEN
    CREATE POLICY tools_catalog_select_authenticated
      ON public.tools_catalog
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- ============================================================
-- 2. user_enabled_tools
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_enabled_tools (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_slug  text NOT NULL REFERENCES public.tools_catalog(slug) ON DELETE CASCADE,
  enabled    boolean NOT NULL DEFAULT true,
  pinned     boolean NOT NULL DEFAULT false,
  settings   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tool_slug)
);

CREATE INDEX IF NOT EXISTS user_enabled_tools_user_enabled_idx
  ON public.user_enabled_tools (user_id, enabled);

CREATE INDEX IF NOT EXISTS user_enabled_tools_tool_slug_idx
  ON public.user_enabled_tools (tool_slug);

ALTER TABLE public.user_enabled_tools ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_enabled_tools'
      AND policyname = 'user_enabled_tools_select_own'
  ) THEN
    CREATE POLICY user_enabled_tools_select_own
      ON public.user_enabled_tools
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_enabled_tools'
      AND policyname = 'user_enabled_tools_insert_own'
  ) THEN
    CREATE POLICY user_enabled_tools_insert_own
      ON public.user_enabled_tools
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_enabled_tools'
      AND policyname = 'user_enabled_tools_update_own'
  ) THEN
    CREATE POLICY user_enabled_tools_update_own
      ON public.user_enabled_tools
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_enabled_tools'
      AND policyname = 'user_enabled_tools_delete_own'
  ) THEN
    CREATE POLICY user_enabled_tools_delete_own
      ON public.user_enabled_tools
      FOR DELETE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- ============================================================
-- 3. Seed tools_catalog (idempotent)
-- ============================================================
INSERT INTO public.tools_catalog (slug, name, description, category, icon_key, is_active, sort_order)
VALUES
  ('qr-generator',      'QR Code Generator',     'Generate QR codes for locations, products and documents',   'productivity', 'qr',      true, 10),
  ('csv-importer',      'CSV Importer',           'Import data in bulk from CSV files into any module',         'data',         'import',  true, 20),
  ('barcode-scanner',   'Barcode Scanner',        'Scan barcodes using device camera for quick lookups',        'productivity', 'scan',    true, 30),
  ('report-builder',    'Report Builder',         'Build and export custom reports from your data',             'analytics',    'chart',   true, 40),
  ('webhook-sender',    'Webhook Sender',         'Send HTTP webhooks to external systems on events',           'integrations', 'webhook', true, 50),
  ('audit-log-viewer',  'Audit Log Viewer',       'Browse and filter the organisation audit trail',             'compliance',   'log',     true, 60)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 4. Permissions (idempotent — ON CONFLICT DO NOTHING)
-- ============================================================
INSERT INTO public.permissions (id, slug, category, action, description)
VALUES
  (gen_random_uuid(), 'tools.read',   'tools', 'read',   'View the tools catalog and tool details'),
  (gen_random_uuid(), 'tools.manage', 'tools', 'manage', 'Enable, disable, pin, and configure tools')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 5. Role-permission mappings (idempotent — ON CONFLICT DO NOTHING)
-- ============================================================

-- org_owner → tools.read
INSERT INTO public.role_permissions (id, role_id, permission_id, allowed)
SELECT gen_random_uuid(), r.id, p.id, true
FROM public.roles r CROSS JOIN public.permissions p
WHERE r.name = 'org_owner' AND r.is_basic = true AND p.slug = 'tools.read'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- org_owner → tools.manage
INSERT INTO public.role_permissions (id, role_id, permission_id, allowed)
SELECT gen_random_uuid(), r.id, p.id, true
FROM public.roles r CROSS JOIN public.permissions p
WHERE r.name = 'org_owner' AND r.is_basic = true AND p.slug = 'tools.manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- org_member → tools.read
INSERT INTO public.role_permissions (id, role_id, permission_id, allowed)
SELECT gen_random_uuid(), r.id, p.id, true
FROM public.roles r CROSS JOIN public.permissions p
WHERE r.name = 'org_member' AND r.is_basic = true AND p.slug = 'tools.read'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- org_member → tools.manage
INSERT INTO public.role_permissions (id, role_id, permission_id, allowed)
SELECT gen_random_uuid(), r.id, p.id, true
FROM public.roles r CROSS JOIN public.permissions p
WHERE r.name = 'org_member' AND r.is_basic = true AND p.slug = 'tools.manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
