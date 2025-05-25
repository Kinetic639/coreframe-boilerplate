-- =============================================
-- Initial Auth, RBAC, and Soft Delete Migration
-- =============================================
-- Idempotent, production-grade, no ON DELETE CASCADE
-- All enums replaced with lookup tables
-- All UUIDs use gen_random_uuid()
-- All created_at default to timezone('utc', now())

-- 1. user_statuses (lookup)
CREATE TABLE IF NOT EXISTS user_statuses (
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
WHERE NOT EXISTS (
  SELECT 1 FROM user_statuses WHERE slug = s.slug
);

-- 2. users (application-level, not auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  status_id UUID REFERENCES user_statuses(id),
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ
);

-- 3. roles (lookup)
CREATE TABLE IF NOT EXISTS roles (
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
    ('team_leader', 'Team Leader', 'Leads a team within the organization'),
    ('member', 'Member', 'Standard user with limited access')
) AS r(slug, label, description)
WHERE NOT EXISTS (
  SELECT 1 FROM roles WHERE slug = r.slug
);

-- 4. permissions (lookup)
CREATE TABLE IF NOT EXISTS permissions (
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
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE slug = p.slug
);

-- 5. role_permissions (many-to-many)
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id),
  permission_id UUID NOT NULL REFERENCES permissions(id),
  UNIQUE(role_id, permission_id)
);

-- 6. user_roles (many-to-many, not scoped yet)
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  role_id UUID NOT NULL REFERENCES roles(id),
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ,
  UNIQUE(user_id, role_id)
); 