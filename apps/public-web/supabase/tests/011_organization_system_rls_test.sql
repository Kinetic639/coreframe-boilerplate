-- ============================================================================
-- TEST: Organization System RLS Policies (8 tests)
-- ============================================================================
BEGIN;

SELECT plan(7);

-- Setup
SELECT tests.create_supabase_user('org_creator', 'org_creator@test.com');
SELECT tests.create_supabase_user('org_member_test', 'org_member_test@test.com');
SELECT tests.create_supabase_user('org_outsider', 'org_outsider@test.com');

INSERT INTO public.users (id, email) VALUES
  (tests.get_supabase_uid('org_creator'), 'org_creator@test.com'),
  (tests.get_supabase_uid('org_member_test'), 'org_member_test@test.com'),
  (tests.get_supabase_uid('org_outsider'), 'org_outsider@test.com')
ON CONFLICT (id) DO NOTHING;

-- Test 1: Creator can create organization
SELECT tests.authenticate_as('org_creator');
INSERT INTO organizations (id, name, slug, created_by) VALUES (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'Created Org',
  'created-org',
  tests.get_supabase_uid('org_creator')
);
SELECT ok(
  (SELECT COUNT(*) FROM organizations WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc') = 1,
  'Creator can create and see organization'
);

-- Test 2: Creator can add member
INSERT INTO organization_members (user_id, organization_id, status) VALUES
  (tests.get_supabase_uid('org_member_test'), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'active');
SELECT ok(
  (SELECT COUNT(*) FROM organization_members WHERE organization_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc') >= 1,
  'Creator can add and see members'
);

-- Test 3: Member can see organization
SELECT tests.authenticate_as('org_member_test');
SELECT ok(
  (SELECT COUNT(*) FROM organizations WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc') = 1,
  'Member can see organization'
);

-- Test 4: Outsider cannot see organization
SELECT tests.authenticate_as('org_outsider');
SELECT ok(
  (SELECT COUNT(*) FROM organizations WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc') = 0,
  'Outsider cannot see organization'
);

-- Test 5: Users see their own membership
SELECT tests.authenticate_as('org_member_test');
SELECT ok(
  EXISTS(SELECT 1 FROM organization_members
         WHERE user_id = tests.get_supabase_uid('org_member_test')
         AND organization_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  'User can see their own membership'
);

-- Test 6: Member can see other members
SELECT ok(
  (SELECT COUNT(*) FROM organization_members WHERE organization_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc') >= 1,
  'Member can see organization members'
);

-- Test 7: Outsider cannot see members
SELECT tests.authenticate_as('org_outsider');
SELECT ok(
  (SELECT COUNT(*) FROM organization_members WHERE organization_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc') = 0,
  'Outsider cannot see organization members'
);

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
