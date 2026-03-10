-- ============================================================
-- TARGET Phase 1 — Batch 3 / File 11
-- Seed data: system roles, permissions, role_permissions,
--            free/professional/enterprise subscription plans
-- ============================================================
-- Purpose      : Populate the static, immutable catalog data
--                that the application requires at startup.
--                All inserts are idempotent (ON CONFLICT DO NOTHING
--                or ON CONFLICT DO UPDATE as appropriate).
-- Dependencies : permissions, roles, role_permissions (File 6)
--                subscription_plans (File 9)
-- Applied to   : TARGET project only
-- ============================================================
-- Design notes:
--
--   Roles: UUIDs are PRESERVED from LEGACY (documented below).
--     UUIDs are stable identifiers referenced by handle_user_signup_hook
--     in File 12 (where we resolve by name). The seed preserves the
--     same UUIDs so that LEGACY data exports can be migrated cleanly.
--     ON CONFLICT (id) DO NOTHING: idempotent re-apply.
--
--   Permissions: slugs are globally unique. ON CONFLICT (slug) DO NOTHING.
--     New permissions may be added by future migrations; this seed
--     only inserts the initial catalog.
--
--   role_permissions: (role_id, permission_id) UNIQUE.
--     ON CONFLICT DO NOTHING for idempotent re-apply.
--
--   Subscription plans: resolved by name. ON CONFLICT (name) DO UPDATE
--     to keep limits/modules current if the migration is re-applied.
--
--   System role UUIDs (preserved from LEGACY):
--     org_member : fc5d6871-e442-4e49-94bd-4668b3dde4f7
--     org_owner  : 9de25020-afff-46f4-8385-9920f0f774af
--   These are is_basic=true, organization_id IS NULL, scope_type='org'.
--
--   Free plan UUID (preserved from LEGACY):
--     379932b4-7eae-4d4e-9b04-fae0d42eca1a
-- ============================================================

-- ============================================================
-- System roles
-- ============================================================
insert into public.roles (id, name, is_basic, organization_id, scope_type, description)
values
  (
    'fc5d6871-e442-4e49-94bd-4668b3dde4f7',
    'org_member',
    true,
    null,
    'org',
    'Default member role assigned to all users joining an organization'
  ),
  (
    '9de25020-afff-46f4-8385-9920f0f774af',
    'org_owner',
    true,
    null,
    'org',
    'Owner role with full organization-level permissions'
  )
on conflict (id) do nothing;

-- ============================================================
-- Permissions catalog
-- 33 permissions across 9 namespaces (verified from LEGACY):
--   account.*, branches.*, invites.*, members.*, module.*,
--   org.*, self.*, superadmin.*, tools.*
-- ============================================================
insert into public.permissions (slug, name, label, category, action, is_system, description)
values
  -- account.*
  ('account.*',            'Account Wildcard',          'Account (All)',             'account',    '*',              true,  'Grants all account permissions'),

  -- branches.*
  ('branches.create',      'Branches Create',           'Create Branches',           'branches',   'create',         true,  'Create new branches'),
  ('branches.delete',      'Branches Delete',           'Delete Branches',           'branches',   'delete',         true,  'Delete branches'),
  ('branches.read',        'Branches Read',             'View Branches',             'branches',   'read',           true,  'Read branch information'),
  ('branches.update',      'Branches Update',           'Update Branches',           'branches',   'update',         true,  'Update branch details'),
  ('branches.view.any',    'Branches View Any',         'View Any Branch',           'branches',   'view.any',       true,  'View any branch regardless of membership'),
  ('branches.view.remove.any', 'Branches Remove Any',   'Remove Any Branch Member',  'branches',   'view.remove.any',true,  'Remove any member from any branch'),
  ('branches.view.update.any', 'Branches Update Any',   'Update Any Branch',         'branches',   'view.update.any',true,  'Update any branch as admin'),

  -- invites.*
  ('invites.cancel',       'Invites Cancel',            'Cancel Invitations',        'invites',    'cancel',         true,  'Cancel pending invitations'),
  ('invites.create',       'Invites Create',            'Create Invitations',        'invites',    'create',         true,  'Invite new members to the organization'),
  ('invites.read',         'Invites Read',              'View Invitations',          'invites',    'read',           true,  'View pending invitations'),

  -- members.*
  ('members.manage',       'Members Manage',            'Manage Members',            'members',    'manage',         true,  'Assign and remove roles from members'),
  ('members.read',         'Members Read',              'View Members',              'members',    'read',           true,  'View organization members'),

  -- module.*
  ('module.*',             'Module Wildcard',           'All Modules (Access)',       'module',     '*',              true,  'Grants access to all modules'),
  ('module.organization-management.access', 'Org Management Access', 'Organization Management', 'module', 'access', true, 'Access to organization management module'),
  ('module.tools.access',  'Tools Module Access',       'Tools Module',              'module',     'access',         true,  'Access to tools module'),
  ('module.warehouse.access', 'Warehouse Module Access','Warehouse Module',          'module',     'access',         true,  'Access to warehouse module'),
  ('module.teams.access',  'Teams Module Access',       'Teams Module',              'module',     'access',         true,  'Access to teams module'),
  ('module.home.access',   'Home Module Access',        'Home Module',               'module',     'access',         true,  'Access to home/dashboard module'),

  -- org.*
  ('org.read',             'Org Read',                  'View Organization',         'org',        'read',           true,  'Read organization details'),
  ('org.update',           'Org Update',                'Update Organization',       'org',        'update',         true,  'Update organization settings and profile'),

  -- self.*
  ('self.read',            'Self Read',                 'View Own Profile',          'self',       'read',           true,  'Read own user profile'),
  ('self.update',          'Self Update',               'Update Own Profile',        'self',       'update',         true,  'Update own user profile'),

  -- superadmin.*
  ('superadmin.*',         'Superadmin Wildcard',       'Superadmin (All)',           'superadmin', '*',              true,  'Full superadmin access'),

  -- tools.*
  ('tools.manage',         'Tools Manage',              'Manage Tools',              'tools',      'manage',         true,  'Enable/disable tools for the organization'),
  ('tools.read',           'Tools Read',                'View Tools',                'tools',      'read',           true,  'View available tools'),

  -- branch.*
  ('branch.roles.manage',  'Branch Roles Manage',       'Manage Branch Roles',       'branch',     'roles.manage',   true,  'Assign and remove roles for a specific branch')
on conflict (slug) do nothing;

-- ============================================================
-- role_permissions: org_member
-- 8 permissions (verified from LEGACY):
--   account.*, branches.read, members.read, org.read,
--   self.read, self.update, tools.manage, tools.read
-- ============================================================
insert into public.role_permissions (role_id, permission_id, allowed)
select
  'fc5d6871-e442-4e49-94bd-4668b3dde4f7' as role_id,
  p.id                                    as permission_id,
  true                                    as allowed
from public.permissions p
where p.slug in (
  'account.*',
  'branches.read',
  'members.read',
  'org.read',
  'self.read',
  'self.update',
  'tools.manage',
  'tools.read'
)
on conflict (role_id, permission_id) do nothing;

-- ============================================================
-- role_permissions: org_owner
-- 21 permissions (verified from LEGACY):
--   All org_member permissions plus:
--   branches.create, branches.delete, branches.update,
--   branches.view.any, branches.view.remove.any, branches.view.update.any,
--   invites.cancel, invites.create, invites.read,
--   members.manage, module.*, org.update
-- ============================================================
insert into public.role_permissions (role_id, permission_id, allowed)
select
  '9de25020-afff-46f4-8385-9920f0f774af' as role_id,
  p.id                                    as permission_id,
  true                                    as allowed
from public.permissions p
where p.slug in (
  -- org_member base set
  'account.*',
  'branches.read',
  'members.read',
  'org.read',
  'self.read',
  'self.update',
  'tools.manage',
  'tools.read',
  -- org_owner additions
  'branches.create',
  'branches.delete',
  'branches.update',
  'branches.view.any',
  'branches.view.remove.any',
  'branches.view.update.any',
  'invites.cancel',
  'invites.create',
  'invites.read',
  'members.manage',
  'module.*',
  'org.update'
)
on conflict (role_id, permission_id) do nothing;

-- ============================================================
-- Subscription plans
-- free, professional, enterprise
-- Free plan UUID preserved from LEGACY: 379932b4-7eae-4d4e-9b04-fae0d42eca1a
-- ON CONFLICT (name) DO UPDATE: keeps limits current on re-apply.
-- ============================================================
insert into public.subscription_plans (
  id,
  name,
  description,
  price_monthly,
  price_yearly,
  is_active,
  enabled_modules,
  limits,
  contexts
)
values
  -- Free plan
  (
    '379932b4-7eae-4d4e-9b04-fae0d42eca1a',
    'free',
    'Free plan with essential features for small teams',
    0,
    0,
    true,
    array[
      'organization-management',
      'home',
      'support',
      'tools'
    ],
    jsonb_build_object(
      'organization.max_users',      3,
      'warehouse.max_branches',      1,
      'warehouse.max_products',      100,
      'warehouse.max_locations',     5
    ),
    array[]::text[]
  ),
  -- Professional plan (no preserved UUID — generated fresh)
  (
    gen_random_uuid(),
    'professional',
    'Professional plan for growing businesses',
    49,
    490,
    true,
    array[
      'organization-management',
      'home',
      'support',
      'tools',
      'warehouse',
      'teams'
    ],
    jsonb_build_object(
      'organization.max_users',      50,
      'warehouse.max_branches',      10,
      'warehouse.max_products',      10000,
      'warehouse.max_locations',     100
    ),
    array[]::text[]
  ),
  -- Enterprise plan (no preserved UUID — generated fresh)
  (
    gen_random_uuid(),
    'enterprise',
    'Enterprise plan with unlimited features and priority support',
    199,
    1990,
    true,
    array[
      'organization-management',
      'home',
      'support',
      'tools',
      'warehouse',
      'teams'
    ],
    jsonb_build_object(
      'organization.max_users',      -1,
      'warehouse.max_branches',      -1,
      'warehouse.max_products',      -1,
      'warehouse.max_locations',     -1
    ),
    array[]::text[]
  )
on conflict (name) do update
  set
    description     = excluded.description,
    price_monthly   = excluded.price_monthly,
    price_yearly    = excluded.price_yearly,
    is_active       = excluded.is_active,
    enabled_modules = excluded.enabled_modules,
    limits          = excluded.limits,
    contexts        = excluded.contexts,
    updated_at      = now();
