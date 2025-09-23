-- Add RLS policies for roles table to enable organization role management

-- Create policy for organization owners to read all roles (basic + their org's custom roles)
CREATE POLICY "org_owners_can_read_roles" ON roles
FOR SELECT
USING (
  -- Allow reading basic roles (organization_id is null) for everyone with role.read permission
  organization_id IS NULL
  OR
  -- Allow reading organization-specific roles for org owners with proper permissions
  (
    organization_id IS NOT NULL 
    AND authorize('role.read') = true
    AND organization_id = (
      SELECT user_organizations.organization_id 
      FROM user_organizations 
      WHERE user_organizations.user_id = auth.uid()
      AND user_organizations.deleted_at IS NULL
      LIMIT 1
    )
  )
);

-- Create policy for organization owners to create organization-specific roles
CREATE POLICY "org_owners_can_create_roles" ON roles
FOR INSERT
WITH CHECK (
  authorize('role.create') = true
  AND organization_id IS NOT NULL
  AND organization_id = (
    SELECT user_organizations.organization_id 
    FROM user_organizations 
    WHERE user_organizations.user_id = auth.uid()
    AND user_organizations.deleted_at IS NULL
    LIMIT 1
  )
);

-- Create policy for organization owners to update their organization's custom roles
CREATE POLICY "org_owners_can_update_roles" ON roles
FOR UPDATE
USING (
  authorize('role.update') = true
  AND organization_id IS NOT NULL
  AND is_basic = false
  AND organization_id = (
    SELECT user_organizations.organization_id 
    FROM user_organizations 
    WHERE user_organizations.user_id = auth.uid()
    AND user_organizations.deleted_at IS NULL
    LIMIT 1
  )
)
WITH CHECK (
  authorize('role.update') = true
  AND organization_id IS NOT NULL
  AND is_basic = false
  AND organization_id = (
    SELECT user_organizations.organization_id 
    FROM user_organizations 
    WHERE user_organizations.user_id = auth.uid()
    AND user_organizations.deleted_at IS NULL
    LIMIT 1
  )
);

-- Create policy for organization owners to delete their organization's custom roles
CREATE POLICY "org_owners_can_delete_roles" ON roles
FOR DELETE
USING (
  authorize('role.delete') = true
  AND organization_id IS NOT NULL
  AND is_basic = false
  AND organization_id = (
    SELECT user_organizations.organization_id 
    FROM user_organizations 
    WHERE user_organizations.user_id = auth.uid()
    AND user_organizations.deleted_at IS NULL
    LIMIT 1
  )
);