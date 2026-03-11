-- =============================================================================
-- HARDENING PHASE 1: Permission Model Redesign
-- Goal: Seed new wildcard + concrete slugs; simplify org_owner to 8 wildcards;
--       fix phantom account.* wildcard; recompile all org_owner users.
-- =============================================================================

-- ─── 1. Seed new wildcard permission slugs ──────────────────────────────────
-- These are the parent wildcards that org_owner will hold.
-- module.* and account.* already exist; the six below are new.
INSERT INTO public.permissions (id, slug, name, description, category, action)
VALUES
  (gen_random_uuid(), 'branches.*', 'Branches Wildcard',  'Grants all branch permissions',         'branches', '*'),
  (gen_random_uuid(), 'invites.*',  'Invites Wildcard',   'Grants all invite permissions',          'invites',  '*'),
  (gen_random_uuid(), 'members.*',  'Members Wildcard',   'Grants all member permissions',          'members',  '*'),
  (gen_random_uuid(), 'org.*',      'Org Wildcard',       'Grants all organization permissions',    'org',      '*'),
  (gen_random_uuid(), 'self.*',     'Self Wildcard',      'Grants all self permissions',            'self',     '*'),
  (gen_random_uuid(), 'tools.*',    'Tools Wildcard',     'Grants all tools permissions',           'tools',    '*')
ON CONFLICT (slug) DO NOTHING;

-- ─── 2. Seed concrete account.* children (fixes phantom wildcard) ────────────
-- Without these, account.* expands to zero rows in compile_user_permissions.
INSERT INTO public.permissions (id, slug, name, description, category, action)
VALUES
  (gen_random_uuid(), 'account.preferences.read',   'Account Preferences Read',   'Read own account preferences',    'account', 'preferences.read'),
  (gen_random_uuid(), 'account.preferences.update', 'Account Preferences Update', 'Update own account preferences',  'account', 'preferences.update'),
  (gen_random_uuid(), 'account.profile.read',       'Account Profile Read',       'Read own account profile',        'account', 'profile.read'),
  (gen_random_uuid(), 'account.profile.update',     'Account Profile Update',     'Update own account profile',      'account', 'profile.update'),
  (gen_random_uuid(), 'account.settings.read',      'Account Settings Read',      'Read own account settings',       'account', 'settings.read'),
  (gen_random_uuid(), 'account.settings.update',    'Account Settings Update',    'Update own account settings',     'account', 'settings.update')
ON CONFLICT (slug) DO NOTHING;

-- ─── 3. Seed concrete superadmin.* children ──────────────────────────────────
-- Admin uses a synthetic permission snapshot, but these slugs should exist
-- in the registry for correctness and future use.
INSERT INTO public.permissions (id, slug, name, description, category, action)
VALUES
  (gen_random_uuid(), 'superadmin.admin.read',   'Superadmin Admin Read',   'Access superadmin dashboard',    'superadmin', 'admin.read'),
  (gen_random_uuid(), 'superadmin.plans.read',   'Superadmin Plans Read',   'Read plans in admin',            'superadmin', 'plans.read'),
  (gen_random_uuid(), 'superadmin.pricing.read', 'Superadmin Pricing Read', 'Read pricing in admin',          'superadmin', 'pricing.read')
ON CONFLICT (slug) DO NOTHING;

-- ─── 4. Soft-delete granular org_owner permissions replaced by wildcards ─────
-- These slugs are now covered by: branches.*, invites.*, members.*,
-- org.*, self.*, tools.*
-- branch.roles.manage is also removed: org_owner passes branch URA checks
-- via members.manage (org-wide grant satisfies has_branch_permission).
UPDATE public.role_permissions rp
SET deleted_at = now()
WHERE
  rp.role_id = (
    SELECT id FROM public.roles
    WHERE name = 'org_owner' AND is_basic = true
    LIMIT 1
  )
  AND rp.permission_id IN (
    SELECT id FROM public.permissions
    WHERE slug IN (
      'branches.create', 'branches.delete', 'branches.read', 'branches.update',
      'branches.view.any', 'branches.view.remove.any', 'branches.view.update.any',
      'invites.cancel', 'invites.create', 'invites.read',
      'members.manage', 'members.read',
      'org.read', 'org.update',
      'self.read', 'self.update',
      'tools.manage', 'tools.read',
      'branch.roles.manage'
    )
  )
  AND rp.deleted_at IS NULL;

-- ─── 5. Add new wildcard role_permissions to org_owner ───────────────────────
-- account.* and module.* already exist in org_owner — ON CONFLICT reactivates
-- if somehow soft-deleted. The six new wildcards are fresh inserts.
INSERT INTO public.role_permissions (id, role_id, permission_id, allowed)
SELECT
  gen_random_uuid(),
  r.id,
  p.id,
  true
FROM public.roles r
CROSS JOIN public.permissions p
WHERE
  r.name = 'org_owner'
  AND r.is_basic = true
  AND p.slug IN (
    'account.*', 'branches.*', 'invites.*', 'members.*',
    'module.*',  'org.*',      'self.*',    'tools.*'
  )
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL,
      allowed    = true;

-- ─── 6. Recompile all org_owner users ────────────────────────────────────────
-- The compile triggers added in P2 fire on INSERT, not on soft-delete.
-- This explicit loop ensures org_owner UEP is updated immediately.
DO $$
DECLARE
  v_rec record;
BEGIN
  FOR v_rec IN
    SELECT DISTINCT ura.user_id, ura.scope_id AS org_id
    FROM public.user_role_assignments ura
    JOIN public.roles r ON r.id = ura.role_id
    WHERE r.name     = 'org_owner'
      AND r.is_basic = true
      AND ura.scope  = 'org'
      AND ura.deleted_at IS NULL
  LOOP
    PERFORM public.compile_user_permissions(v_rec.user_id, v_rec.org_id);
  END LOOP;
END;
$$;
