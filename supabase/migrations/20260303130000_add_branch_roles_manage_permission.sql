-- ============================================================================
-- Migration: Add branch.roles.manage permission
-- Adds the permission slug that lets a user manage branch-scoped role
-- assignments for branches where they hold this permission.
-- ============================================================================

INSERT INTO public.permissions (
  slug,
  category,
  action,
  description,
  scope_types
)
VALUES (
  'branch.roles.manage',
  'branches',
  'roles.manage',
  'Manage branch-scoped role assignments for members within a branch',
  ARRAY['branch']
)
ON CONFLICT (slug) DO NOTHING;
