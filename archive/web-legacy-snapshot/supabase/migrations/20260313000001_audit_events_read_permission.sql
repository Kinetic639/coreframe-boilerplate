-- ---------------------------------------------------------------------------
-- Phase 5: audit.events.read permission
--
-- Grants org_owners the ability to view the full organization audit event log.
-- Other roles may be granted this permission via the roles editor.
--
-- Migration: 20260313000001_audit_events_read_permission.sql
-- ---------------------------------------------------------------------------

-- 1. Insert the permission (idempotent)
INSERT INTO public.permissions (id, slug, category, action, description)
VALUES (
  gen_random_uuid(),
  'audit.events.read',
  'audit',
  'read',
  'Read full organization audit event log including IP addresses and user agents'
)
ON CONFLICT (slug) DO NOTHING;

-- 2. Grant to org_owner (system role)
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
  AND p.slug = 'audit.events.read'
ON CONFLICT (role_id, permission_id) DO NOTHING;
