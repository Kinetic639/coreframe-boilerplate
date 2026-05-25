-- =============================================================================
-- Migration: workshop_module — Workshop Module Foundation
-- Date:      2026-05-25
-- =============================================================================
-- Scope:
--   1. Workshop permission rows (workshop.*, workshop.read,
--      workshop.manage, module.workshop.access)
--   2. Role-permission seeding
--      - org_owner  → workshop.* wildcard only
--        (compiler expands to all concrete workshop.* slugs automatically)
--      - NOTE: org_member receives NO workshop permissions by default.
--        Workshop is a Premium module; admins grant access via the roles editor.
--   3. Subscription plan updates
--      - professional → add 'workshop' to enabled_modules
--      - enterprise   → add 'workshop' to enabled_modules
--
-- Note on wildcard seeding:
--   org_owner must NOT receive both workshop.* AND granular workshop.* slugs
--   in role_permissions. The compile_user_permissions function joins wildcards
--   to concrete matches; if the same permission_slug_exact appears twice in the
--   UNION (once from wildcard expansion, once from direct grant) the
--   ON CONFLICT DO UPDATE hits the same row a second time → Postgres error 21000.
--   Therefore: org_owner gets workshop.* only; compiler expands at runtime.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PART 1: Permission rows
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions (slug, name, category, action)
VALUES
  ('workshop.*',              'Workshop Wildcard',         'workshop', '*'),
  ('workshop.read',           'Workshop Read',             'workshop', 'read'),
  ('workshop.manage',         'Workshop Manage',           'workshop', 'manage'),
  ('module.workshop.access',  'Workshop Module Access',    'module',   'access')
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- PART 2: Role-permission seeding
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_owner_id  UUID;
  v_perm_id   UUID;
BEGIN
  SELECT id INTO v_owner_id FROM public.roles WHERE name = 'org_owner' AND is_basic = true LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'org_owner basic role not found';
  END IF;

  -- org_owner: workshop.* wildcard only (compiler expands at runtime)
  SELECT id INTO v_perm_id FROM public.permissions WHERE slug = 'workshop.*';
  IF v_perm_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    VALUES (v_owner_id, v_perm_id) ON CONFLICT DO NOTHING;
  END IF;

  -- org_owner already has module.* wildcard which covers module.workshop.access.
  -- No explicit module.workshop.access grant needed for org_owner.

END $$;

-- ---------------------------------------------------------------------------
-- PART 3: Subscription plan updates — add 'workshop' to professional/enterprise
-- ---------------------------------------------------------------------------
UPDATE public.subscription_plans
SET
  enabled_modules = array_append(enabled_modules, 'workshop'),
  updated_at      = now()
WHERE name = 'professional'
  AND NOT ('workshop' = ANY(enabled_modules));

UPDATE public.subscription_plans
SET
  enabled_modules = array_append(enabled_modules, 'workshop'),
  updated_at      = now()
WHERE name = 'enterprise'
  AND NOT ('workshop' = ANY(enabled_modules));
