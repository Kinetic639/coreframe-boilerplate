-- Migration: add_branch_view_permissions
-- Date: 2026-03-02
--
-- Adds three new branch visibility/context permissions:
--   branches.view.any        — user may see and switch to ALL branches in org (switcher list)
--   branches.view.update.any — user may set their default branch pref to ANY org branch
--   branches.view.remove.any — user may clear/reset their default branch preference
--
-- These are semantic "branch visibility" permissions, separate from CRUD admin permissions
-- (branches.create/read/update/delete) which control branch management.
--
-- org_owner receives all three by default (consistent with full-org visibility expectations).
-- Snapshot trigger fires automatically on role_permissions INSERT.

-- 1. Seed permission slugs (idempotent)
INSERT INTO public.permissions (id, slug, category, action, description)
VALUES
  (gen_random_uuid(),
   'branches.view.any',
   'branches',
   'view.any',
   'See and switch to all branches in the org (branch switcher list)'),
  (gen_random_uuid(),
   'branches.view.update.any',
   'branches',
   'view.update.any',
   'Set default branch preference to any branch in org (without branch-scoped assignment)'),
  (gen_random_uuid(),
   'branches.view.remove.any',
   'branches',
   'view.remove.any',
   'Clear or reset default branch preference globally')
ON CONFLICT (slug) DO NOTHING;

-- 2. Grant all three to org_owner basic role (idempotent)
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
  AND p.slug IN ('branches.view.any', 'branches.view.update.any', 'branches.view.remove.any')
ON CONFLICT (role_id, permission_id) DO NOTHING;
