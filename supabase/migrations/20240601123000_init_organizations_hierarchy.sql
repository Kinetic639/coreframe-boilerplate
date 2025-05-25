-- =============================================
-- Multi-Tenancy Phase 2: Organizations, Branches, Teams, Scoped Roles
-- =============================================

-- 1. organizations
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ
);

-- 2. organization_profiles (optional public info)
CREATE TABLE IF NOT EXISTS organization_profiles (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id),
  website TEXT,
  logo_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 3. branches
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ
);

-- 4. teams
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ
);

-- 5. Update user_roles for scoping
ALTER TABLE user_roles
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id),
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id),
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);

-- Remove old unique constraint if it exists (Postgres 11+ syntax)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'user_roles' AND indexname = 'user_roles_user_id_role_id_key'
  ) THEN
    ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_id_key;
  END IF;
END$$;

-- Add new unique constraint for scoped roles
ALTER TABLE user_roles
ADD CONSTRAINT user_roles_user_id_role_id_organization_id_branch_id_team_id_key
UNIQUE(user_id, role_id, organization_id, branch_id, team_id);

-- 6. invitations table for scoped invites
CREATE TABLE IF NOT EXISTS invitations (
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

CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token); 