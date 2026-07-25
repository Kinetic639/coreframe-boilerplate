-- Migration: add_module_access_permissions
-- Date: 2026-02-28
--
-- Adds two new permission slugs for user-level module access control:
--   module.*                              (wildcard, granted to org_owner only)
--   module.organization-management.access (specific, grantable via custom roles)
--
-- Design:
--   - Entitlements decide which modules an org has (plan-level, unchanged).
--   - These permissions decide which users may enter a module (user-level gate).
--   - org_owner receives module.* wildcard → checkPermission() matches all module.X.access slugs.
--   - org_member receives nothing → blocked from org-scoped modules by default.
--   - Custom roles may be granted module.organization-management.access via the roles editor.
--
-- Snapshot refresh:
--   trigger_role_permission_compile fires automatically on role_permissions INSERT,
--   rebuilding user_effective_permissions for all users holding org_owner role.
--   No manual bulk recompile is needed.

-- 1. Seed permission slugs (idempotent — ON CONFLICT (slug) DO NOTHING)
INSERT INTO public.permissions (id, slug, category, action, description)
VALUES
  (gen_random_uuid(),
   'module.*',
   'module',
   'manage',
   'Wildcard — grants access to all modules (system use; assigned to org_owner only)'),
  (gen_random_uuid(),
   'module.organization-management.access',
   'module',
   'access',
   'Access the Organization Management module')
ON CONFLICT (slug) DO NOTHING;

-- 2. Grant module.* to org_owner basic role (idempotent — ON CONFLICT DO NOTHING)
INSERT INTO public.role_permissions (id, role_id, permission_id, allowed)
SELECT
  gen_random_uuid(),
  r.id,
  p.id,
  true
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'org_owner'
  AND r.is_basic = true
  AND p.slug = 'module.*'
ON CONFLICT (role_id, permission_id) DO NOTHING;
