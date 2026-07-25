-- Add event feed visibility permissions
-- events.org_activity.read — view organization activity events (branch created, member joined, etc.)
-- events.org_sensitive.read — view sensitive org events (invitations, role changes, member removal)
--
-- Grant matrix:
--   org_owner  → both permissions
--   org_member → org_activity.read only (no sensitive)
--   (org_admin role does not exist in this project — org_owner covers that level)

INSERT INTO permissions (id, slug, description, category, action)
VALUES
  (gen_random_uuid(), 'events.org_activity.read',  'View organization activity feed (branch created, member joined, etc.)', 'events', 'org_activity.read'),
  (gen_random_uuid(), 'events.org_sensitive.read', 'View sensitive organization events (invitations, role changes, member removal)', 'events', 'org_sensitive.read')
ON CONFLICT (slug) DO NOTHING;

-- Grant to org_owner: both permissions
DO $$
DECLARE
  v_owner_role_id uuid;
  v_member_role_id uuid;
BEGIN
  SELECT id INTO v_owner_role_id  FROM roles WHERE name = 'org_owner'  LIMIT 1;
  SELECT id INTO v_member_role_id FROM roles WHERE name = 'org_member' LIMIT 1;

  -- org_owner gets both event feed permissions
  IF v_owner_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id, allowed)
    SELECT v_owner_role_id, p.id, true
    FROM permissions p
    WHERE p.slug IN ('events.org_activity.read', 'events.org_sensitive.read')
    ON CONFLICT DO NOTHING;
  END IF;

  -- org_member gets org_activity.read only (not sensitive)
  IF v_member_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id, allowed)
    SELECT v_member_role_id, p.id, true
    FROM permissions p
    WHERE p.slug = 'events.org_activity.read'
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
