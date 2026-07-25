-- ============================================================================
-- TEST: Helper Functions Extended Tests (5 tests)
-- ============================================================================
BEGIN;

SELECT plan(5);

-- Setup
SELECT tests.create_supabase_user('helper_test', 'helper_test@test.com');
SELECT tests.create_supabase_user('non_member_test', 'non_member_test@test.com');

INSERT INTO public.users (id, email) VALUES
  (tests.get_supabase_uid('helper_test'), 'helper_test@test.com'),
  (tests.get_supabase_uid('non_member_test'), 'non_member_test@test.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, slug, created_by) VALUES (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'Helper Test Org',
  'helper-test',
  tests.get_supabase_uid('helper_test')
);

INSERT INTO organization_members (user_id, organization_id, status) VALUES
  (tests.get_supabase_uid('helper_test'), 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'active');

INSERT INTO user_role_assignments (user_id, role_id, scope, scope_id)
SELECT tests.get_supabase_uid('helper_test'), id, 'org', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
FROM roles WHERE name = 'org_owner' LIMIT 1;

-- Test 1: is_org_member returns true for member
SELECT tests.authenticate_as('helper_test');
SELECT ok(
  public.is_org_member('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid) = true,
  'is_org_member returns true for member'
);

-- Test 2: is_org_member returns false for non-member
SELECT tests.authenticate_as('non_member_test');
SELECT ok(
  public.is_org_member('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid) = false,
  'is_org_member returns false for non-member'
);

-- Test 3: has_permission returns true when user has permission
SELECT tests.authenticate_as('helper_test');
SELECT ok(
  public.has_permission('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid, 'org.update') = true,
  'has_permission returns true for org_owner with org.update'
);

-- Test 4: has_permission returns false for non-existent permission
SELECT ok(
  public.has_permission('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid, 'fake.permission') = false,
  'has_permission returns false for non-existent permission'
);

-- Test 5: has_permission returns false for non-member
SELECT tests.authenticate_as('non_member_test');
SELECT ok(
  public.has_permission('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid, 'org.update') = false,
  'has_permission returns false for non-member'
);

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
