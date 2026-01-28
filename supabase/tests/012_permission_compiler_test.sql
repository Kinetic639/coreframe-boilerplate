-- ============================================================================
-- TEST: Permission Compiler Tests (5 tests)
-- ============================================================================
BEGIN;

SELECT plan(4);

-- Setup
SELECT tests.create_supabase_user('compiler_test_user', 'compiler@test.com');

INSERT INTO public.users (id, email) VALUES
  (tests.get_supabase_uid('compiler_test_user'), 'compiler@test.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, slug, created_by) VALUES (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'Compiler Test Org',
  'compiler-test',
  tests.get_supabase_uid('compiler_test_user')
);

INSERT INTO organization_members (user_id, organization_id, status) VALUES
  (tests.get_supabase_uid('compiler_test_user'), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'active');

-- Test 1: No permissions before role assignment
SELECT tests.authenticate_as('compiler_test_user');
SELECT ok(
  (SELECT COUNT(*) FROM user_effective_permissions WHERE user_id = tests.get_supabase_uid('compiler_test_user')) = 0,
  'No permissions before role assignment'
);

-- Test 2: Assign org_owner role
INSERT INTO user_role_assignments (user_id, role_id, scope, scope_id)
SELECT tests.get_supabase_uid('compiler_test_user'), id, 'org', 'dddddddd-dddd-dddd-dddd-dddddddddddd'
FROM roles WHERE name = 'org_owner' LIMIT 1;

-- Test 3: Permissions compiled after role assignment
SELECT ok(
  (SELECT COUNT(*) FROM user_effective_permissions WHERE user_id = tests.get_supabase_uid('compiler_test_user')) > 0,
  'Permissions compiled after role assignment'
);

-- Test 4: org.update permission exists
SELECT ok(
  EXISTS(SELECT 1 FROM user_effective_permissions
         WHERE user_id = tests.get_supabase_uid('compiler_test_user')
         AND permission_slug = 'org.update'),
  'org.update permission compiled'
);

-- Test 5: org.read permission exists
SELECT ok(
  EXISTS(SELECT 1 FROM user_effective_permissions
         WHERE user_id = tests.get_supabase_uid('compiler_test_user')
         AND permission_slug = 'org.read'),
  'org.read permission compiled'
);

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
