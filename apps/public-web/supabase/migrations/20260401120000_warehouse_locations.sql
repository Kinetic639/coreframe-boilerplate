-- =============================================================================
-- Migration: warehouse_locations — Warehouse Module Phase 1
-- Project:   rjeraydumwechpjjzrus (TARGET)
-- Phase:     Warehouse V2 Phase 1 — Locations
-- =============================================================================
-- Scope:
--   1. Warehouse permission rows (warehouse.*, warehouse.read,
--      warehouse.locations.read, warehouse.locations.manage)
--   2. Role-permission seeding
--      - org_owner  → warehouse.* wildcard only
--        (compiler expands to all concrete warehouse.* slugs automatically)
--      - org_member → module.warehouse.access + warehouse.read
--                     + warehouse.locations.read
--   3. warehouse_locations table (branch-scoped nested structure)
--   4. Indexes
--   5. updated_at trigger
--   6. RLS policies
--
-- Note on wildcard seeding:
--   org_owner must NOT receive both warehouse.* AND granular warehouse.* slugs
--   in role_permissions. The compile_user_permissions function joins wildcards
--   to concrete matches; if the same permission_slug_exact appears twice in the
--   UNION (once from wildcard expansion, once from direct grant) the
--   ON CONFLICT DO UPDATE hits the same row a second time → Postgres error 21000.
--   Therefore: org_owner gets warehouse.* only; compiler expands at runtime.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PART 1: Permission rows
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions (slug, name, category, action)
VALUES
  ('warehouse.*',                'Warehouse Wildcard',         'warehouse', '*'),
  ('warehouse.read',             'Warehouse Read',             'warehouse', 'read'),
  ('warehouse.locations.read',   'Warehouse Locations Read',   'warehouse', 'locations.read'),
  ('warehouse.locations.manage', 'Warehouse Locations Manage', 'warehouse', 'locations.manage')
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- PART 2: Role-permission seeding
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_owner_id  UUID;
  v_member_id UUID;
  v_perm_id   UUID;
BEGIN
  SELECT id INTO v_owner_id  FROM public.roles WHERE name = 'org_owner'  AND is_basic = true LIMIT 1;
  SELECT id INTO v_member_id FROM public.roles WHERE name = 'org_member' AND is_basic = true LIMIT 1;

  -- org_owner: warehouse.* wildcard only
  SELECT id INTO v_perm_id FROM public.permissions WHERE slug = 'warehouse.*';
  INSERT INTO public.role_permissions (role_id, permission_id)
  VALUES (v_owner_id, v_perm_id) ON CONFLICT DO NOTHING;

  -- org_member: module access + broad read + locations read
  SELECT id INTO v_perm_id FROM public.permissions WHERE slug = 'module.warehouse.access';
  INSERT INTO public.role_permissions (role_id, permission_id)
  VALUES (v_member_id, v_perm_id) ON CONFLICT DO NOTHING;

  SELECT id INTO v_perm_id FROM public.permissions WHERE slug = 'warehouse.read';
  INSERT INTO public.role_permissions (role_id, permission_id)
  VALUES (v_member_id, v_perm_id) ON CONFLICT DO NOTHING;

  SELECT id INTO v_perm_id FROM public.permissions WHERE slug = 'warehouse.locations.read';
  INSERT INTO public.role_permissions (role_id, permission_id)
  VALUES (v_member_id, v_perm_id) ON CONFLICT DO NOTHING;
END $$;

-- ---------------------------------------------------------------------------
-- PART 3: warehouse_locations table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.warehouse_locations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id       UUID        NOT NULL REFERENCES public.branches(id)      ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  code            TEXT        NULL,
  description     TEXT        NULL,
  icon_name       TEXT        NULL,
  color           TEXT        NULL,
  parent_id       UUID        NULL REFERENCES public.warehouse_locations(id) ON DELETE SET NULL,
  level           INTEGER     NOT NULL DEFAULT 0,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  qr_code         TEXT        NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  created_by      UUID        NULL REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by      UUID        NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ NULL,
  CONSTRAINT wl_name_not_empty     CHECK (length(trim(name)) > 0),
  CONSTRAINT wl_no_self_parent     CHECK (parent_id IS DISTINCT FROM id),
  CONSTRAINT wl_level_non_neg      CHECK (level >= 0),
  CONSTRAINT wl_sort_order_non_neg CHECK (sort_order >= 0)
);

COMMENT ON TABLE  public.warehouse_locations IS 'Nested physical locations within a branch warehouse. Branch is the warehouse boundary.';
COMMENT ON COLUMN public.warehouse_locations.qr_code IS 'Stable opaque identifier for QR encoding. Generated once at INSERT, never modified.';
COMMENT ON COLUMN public.warehouse_locations.code    IS 'Optional short human-readable code (e.g. MG-A-R1). Unique within org+branch when set.';
COMMENT ON COLUMN public.warehouse_locations.level   IS 'Depth in tree (0 = root). Maintained by application layer.';

-- ---------------------------------------------------------------------------
-- PART 4: Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS wl_org_branch_active_idx
  ON public.warehouse_locations (organization_id, branch_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS wl_parent_active_idx
  ON public.warehouse_locations (parent_id)
  WHERE deleted_at IS NULL AND parent_id IS NOT NULL;

-- Code uniqueness enforced by partial unique index (code is optional)
CREATE UNIQUE INDEX IF NOT EXISTS wl_code_unique_in_branch_idx
  ON public.warehouse_locations (organization_id, branch_id, code)
  WHERE code IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS wl_deleted_idx
  ON public.warehouse_locations (organization_id, branch_id, deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- PART 5: updated_at trigger
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'set_updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS warehouse_locations_updated_at ON public.warehouse_locations;
    CREATE TRIGGER warehouse_locations_updated_at
      BEFORE UPDATE ON public.warehouse_locations
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- PART 6: Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.warehouse_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_locations FORCE ROW LEVEL SECURITY;

-- SELECT: any org member can read active locations in their org
DROP POLICY IF EXISTS wl_select_org_member ON public.warehouse_locations;
CREATE POLICY wl_select_org_member
  ON public.warehouse_locations FOR SELECT
  USING (public.is_org_member(organization_id) AND deleted_at IS NULL);

-- INSERT: requires warehouse.locations.manage
DROP POLICY IF EXISTS wl_insert_manage ON public.warehouse_locations;
CREATE POLICY wl_insert_manage
  ON public.warehouse_locations FOR INSERT
  WITH CHECK (public.has_permission(organization_id, 'warehouse.locations.manage'));

-- UPDATE: requires warehouse.locations.manage (soft-delete is an UPDATE)
DROP POLICY IF EXISTS wl_update_manage ON public.warehouse_locations;
CREATE POLICY wl_update_manage
  ON public.warehouse_locations FOR UPDATE
  USING (public.has_permission(organization_id, 'warehouse.locations.manage'));

-- DELETE: blocked — all deletes must go through soft-delete (UPDATE deleted_at)
DROP POLICY IF EXISTS wl_delete_deny ON public.warehouse_locations;
CREATE POLICY wl_delete_deny
  ON public.warehouse_locations FOR DELETE
  USING (false);
