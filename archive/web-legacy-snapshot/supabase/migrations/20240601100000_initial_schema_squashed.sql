-- =============================================
-- Migration: Initial Schema (Squashed)
-- Combines init_auth_rbac and init_organizations_hierarchy
-- =============================================

-- Drop tables with foreign key dependencies first (if they exist, for idempotency)
-- Note: This order is reversed dependency order for drops.
DROP TABLE IF EXISTS invitations CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS organization_profiles CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS user_statuses CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;

-- Drop types if they were used (original migration used enums, but later switched to tables)
-- If you had custom types that were dropped/created, add drops here.


-- 1. user_statuses (lookup) - No FK dependencies
CREATE TABLE user_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL
);

-- Seed user_statuses
INSERT INTO user_statuses (id, slug, label)
SELECT gen_random_uuid(), s.slug, s.label
FROM (
  VALUES
    ('online', 'Online'),
    ('offline', 'Offline'),
    ('banned', 'Banned')
) AS s(slug, label)
ON CONFLICT (slug) DO NOTHING;

-- 2. roles (lookup) - No FK dependencies
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT
);

-- Seed roles
INSERT INTO roles (id, slug, label, description)
SELECT gen_random_uuid(), r.slug, r.label, r.description
FROM (
  VALUES
    ('superadmin', 'Super Admin', 'Global access to all features and data'),
    ('org_owner', 'Organization Owner', 'Owns and manages the organization'),
    ('org_admin', 'Organization Admin', 'Administers organization settings and members'),
    ('branch_admin', 'Branch Admin', 'Administers a specific branch'),
    ('team_leader', 'Team Leader', 'Leads a team within the organization'),
    ('member', 'Member', 'Standard user with limited access')
) AS r(slug, label, description)
ON CONFLICT (slug) DO NOTHING;

-- 3. permissions (lookup) - No FK dependencies
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL
);

-- Seed permissions
INSERT INTO permissions (id, slug, label)
SELECT gen_random_uuid(), p.slug, p.label
FROM (
  VALUES
    ('users.view', 'View Users'),
    ('users.edit', 'Edit Users'),
    ('teams.view', 'View Teams'),
    ('teams.edit', 'Edit Teams'),
    ('branches.view', 'View Branches'),
    ('branches.edit', 'Edit Branches'),
    ('org.view', 'View Organization'),
    ('org.edit', 'Edit Organization')
) AS p(slug, label)
ON CONFLICT (slug) DO NOTHING;

-- 4. users (application-level) - Depends on auth.users, user_statuses
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  status_id UUID REFERENCES user_statuses(id),
  -- default_branch_id references branches, which is created later. Will add FK later.
  default_branch_id UUID,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ
);

-- 5. organizations - Depends on users
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug text UNIQUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ
);

-- 6. organization_profiles (optional public info) - Depends on organizations
CREATE TABLE organization_profiles (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id),
  website TEXT,
  logo_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 7. branches - Depends on organizations
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ
);

-- 8. teams - Depends on branches
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ
);

-- 9. role_permissions (many-to-many) - Depends on roles, permissions
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id),
  permission_id UUID NOT NULL REFERENCES permissions(id),
  UNIQUE(role_id, permission_id)
);

-- 10. user_roles (many-to-many, will be scoped) - Depends on users, roles. Scoping FKs added later.
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  role_id UUID NOT NULL REFERENCES roles(id),
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ
  -- Scoping columns organization_id, branch_id, team_id and unique constraint added below
);

-- 11. user_preferences - Depends on users, branches
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  last_branch_id UUID REFERENCES branches(id),
  preferences JSONB,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  UNIQUE(user_id)
);

-- 12. invitations table for scoped invites - Depends on users, organizations, branches, teams, roles
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  branch_id UUID REFERENCES branches(id),
  team_id UUID REFERENCES teams(id),
  role_id UUID REFERENCES roles(id),
  token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, expired, revoked
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_token ON invitations(token);

-- Add Foreign Keys and constraints that had forward references

-- Add default_branch_id FK to users table
ALTER TABLE users
ADD CONSTRAINT users_default_branch_id_fkey
FOREIGN KEY (default_branch_id) REFERENCES branches(id);

-- Add scoping columns to user_roles
ALTER TABLE user_roles
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id),
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id),
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);

-- Remove old unique constraint if it exists (Postgres 11+ syntax)
-- The DO block is needed to safely drop constraints that might not exist yet.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_role_id_key' AND conrelid = 'public.user_roles'::regclass
  ) THEN
    ALTER TABLE user_roles DROP CONSTRAINT user_roles_user_id_role_id_key;
  END IF;
END$$;

-- Add new unique constraint for scoped user_roles
ALTER TABLE user_roles
ADD CONSTRAINT user_roles_user_id_role_id_organization_id_branch_id_team_id_key
UNIQUE(user_id, role_id, organization_id, branch_id, team_id);
