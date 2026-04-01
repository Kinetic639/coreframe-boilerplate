-- ============================================================================
-- TEST: Enterprise Hardening (5 tests)
-- ============================================================================
BEGIN;

SELECT plan(5);

-- Setup
SELECT tests.create_supabase_user('hardening_user', 'hardening@test.com');

INSERT INTO public.users (id, email) VALUES
  (tests.get_supabase_uid('hardening_user'), 'hardening@test.com')
ON CONFLICT (id) DO NOTHING;

-- Test 1: Roles table has FORCE RLS
SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'roles'),
  'roles table has FORCE RLS'
);

-- Test 2: Cannot create custom role without organization_id
SELECT tests.authenticate_as('hardening_user');
SELECT throws_ok(
  $$INSERT INTO roles (name, is_basic, organization_id) VALUES ('Invalid', false, NULL)$$,
  NULL,
  NULL,
  'Cannot create custom role without organization_id'
);

-- Test 3: Cannot create system role with organization_id
SELECT throws_ok(
  $$INSERT INTO roles (name, is_basic, organization_id) VALUES ('Invalid', true, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)$$,
  NULL,
  NULL,
  'Cannot create system role with organization_id'
);

-- Test 4: user_effective_permissions has FORCE RLS
SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'user_effective_permissions'),
  'user_effective_permissions has FORCE RLS'
);

-- Test 5: RLS prevents direct soft-delete (must go through server action)
INSERT INTO organizations (id, name, slug, created_by) VALUES (
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Test Org',
  'test-org-harden',
  tests.get_supabase_uid('hardening_user')
);
INSERT INTO organization_members (user_id, organization_id, status) VALUES
  (tests.get_supabase_uid('hardening_user'), 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'active');
INSERT INTO user_role_assignments (user_id, role_id, scope, scope_id)
SELECT tests.get_supabase_uid('hardening_user'), id, 'org', 'ffffffff-ffff-ffff-ffff-ffffffffffff'
FROM roles WHERE name = 'org_owner' LIMIT 1;
SELECT throws_ok(
  $$UPDATE organizations SET deleted_at = NOW() WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'$$,
  NULL, NULL,
  'RLS prevents direct soft-delete via UPDATE'
);

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
