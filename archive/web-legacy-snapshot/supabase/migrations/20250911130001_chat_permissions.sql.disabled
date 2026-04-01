-- Add chat permissions to the permissions table
INSERT INTO public.permissions (slug, label) VALUES 
  ('teams.chat.create', 'Create chat conversations'),
  ('teams.chat.participate', 'Participate in chat conversations'),
  ('teams.chat.admin', 'Administer chat settings and users'),
  ('teams.chat.view_all', 'View all chat conversations in organization'),
  ('teams.chat.moderate', 'Moderate chat messages (edit/delete any message)')
ON CONFLICT (slug) DO UPDATE SET 
  label = EXCLUDED.label,
  deleted_at = NULL;

-- Grant basic chat permissions to standard user roles
-- Note: These role assignments should be adjusted based on your role structure

-- Grant chat creation and participation to all branch members
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
  r.id as role_id,
  p.id as permission_id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('branch_member', 'branch_admin', 'organization_admin')
AND p.slug IN ('teams.chat.create', 'teams.chat.participate')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant admin permissions to branch and org admins
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
  r.id as role_id,
  p.id as permission_id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('branch_admin', 'organization_admin')
AND p.slug IN ('teams.chat.admin', 'teams.chat.moderate')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant view all permission to org admins only
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
  r.id as role_id,
  p.id as permission_id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'organization_admin'
AND p.slug = 'teams.chat.view_all'
ON CONFLICT (role_id, permission_id) DO NOTHING;