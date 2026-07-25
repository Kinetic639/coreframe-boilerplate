-- Migration: Add wildcard permissions for all major modules
-- Created: 2026-01-19
-- Purpose: Enable wildcard permission matching for org_owner role to grant full module access

-- Add wildcard permissions for all major modules
INSERT INTO public.permissions (slug, action, description, category) VALUES
-- Warehouse wildcards
('warehouse.*', '*', 'Full access to all warehouse operations', 'warehouse'),

-- Teams wildcards
('teams.*', '*', 'Full access to all teams operations', 'teams'),

-- Admin wildcards
('admin.*', '*', 'Full admin access to all admin operations', 'admin'),

-- System wildcards
('system.*', '*', 'Full system-level access', 'system')
ON CONFLICT (slug) DO NOTHING;

-- Map wildcard permissions to org_owner role
INSERT INTO public.role_permissions (role_id, permission_id, allowed)
SELECT r.id, p.id, true
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'org_owner'
AND p.slug IN ('warehouse.*', 'teams.*', 'admin.*', 'system.*')
AND NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp
  WHERE rp.role_id = r.id AND rp.permission_id = p.id
);

-- Verify the migration
-- You can check with:
-- SELECT slug, action, category FROM permissions WHERE slug LIKE '%.*';
-- SELECT p.slug FROM role_permissions rp
-- JOIN roles r ON rp.role_id = r.id
-- JOIN permissions p ON rp.permission_id = p.id
-- WHERE r.name = 'org_owner' AND p.slug LIKE '%.*';
