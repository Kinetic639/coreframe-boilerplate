-- =============================================================================
-- Migration: inventory_phase1_permissions
-- Project:   rjeraydumwechpjjzrus (TARGET)
-- Phase:     Ambra Inventory V2 Phase 1 — Permissions
-- =============================================================================
-- Scope:
--   1. Adds concrete Phase 1 inventory permission rows.
--   2. Seeds org_member read-only inventory visibility.
--   3. Keeps org_owner on warehouse.* only; the permission compiler expands the
--      wildcard to concrete warehouse slugs.
--
-- Important:
--   RLS policies and DB RPCs must use exact concrete slugs, never warehouse.*.
--   The wildcard exists only as an assignable role permission for org_owner.
-- =============================================================================

INSERT INTO public.permissions (slug, name, category, action)
VALUES
  ('warehouse.products.read',     'Warehouse Products Read',     'warehouse', 'products.read'),
  ('warehouse.products.manage',   'Warehouse Products Manage',   'warehouse', 'products.manage'),
  ('warehouse.products.archive',  'Warehouse Products Archive',  'warehouse', 'products.archive'),
  ('warehouse.inventory.read',    'Warehouse Inventory Read',    'warehouse', 'inventory.read'),
  ('warehouse.inventory.operate', 'Warehouse Inventory Operate', 'warehouse', 'inventory.operate'),
  ('warehouse.inventory.adjust',  'Warehouse Inventory Adjust',  'warehouse', 'inventory.adjust'),
  ('warehouse.inventory.reverse', 'Warehouse Inventory Reverse', 'warehouse', 'inventory.reverse'),
  ('warehouse.settings.manage',   'Warehouse Settings Manage',   'warehouse', 'settings.manage')
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  v_owner_id  UUID;
  v_member_id UUID;
  v_perm_id   UUID;
BEGIN
  SELECT id INTO v_owner_id
  FROM public.roles
  WHERE name = 'org_owner' AND is_basic = true
  LIMIT 1;

  SELECT id INTO v_member_id
  FROM public.roles
  WHERE name = 'org_member' AND is_basic = true
  LIMIT 1;

  -- org_owner: ensure warehouse.* remains the only warehouse inventory grant
  -- needed here. Do not add granular warehouse.* slugs to org_owner, because
  -- wildcard expansion already covers them and duplicate compiled rows can
  -- break permission snapshot materialization.
  IF v_owner_id IS NOT NULL THEN
    SELECT id INTO v_perm_id FROM public.permissions WHERE slug = 'warehouse.*';
    IF v_perm_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (v_owner_id, v_perm_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- org_member: read-only visibility. Operating stock, adjustments, reversal,
  -- settings, product management, and archiving must be granted intentionally
  -- through custom roles.
  IF v_member_id IS NOT NULL THEN
    SELECT id INTO v_perm_id FROM public.permissions WHERE slug = 'warehouse.products.read';
    IF v_perm_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (v_member_id, v_perm_id)
      ON CONFLICT DO NOTHING;
    END IF;

    SELECT id INTO v_perm_id FROM public.permissions WHERE slug = 'warehouse.inventory.read';
    IF v_perm_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (v_member_id, v_perm_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;
