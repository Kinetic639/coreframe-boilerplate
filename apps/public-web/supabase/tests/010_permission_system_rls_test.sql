-- ============================================================================
-- TEST: Permission System RLS Policies (10 tests)
-- ============================================================================
BEGIN;

SELECT plan(10);

-- Setup
SELECT tests.create_supabase_user('perm_owner', 'perm_owner@test.com');
SELECT tests.create_supabase_user('perm_member', 'perm_member@test.com');
SELECT tests.create_supabase_user('perm_outsider', 'perm_outsider@test.com');

INSERT INTO public.users (id, email) VALUES
  (tests.get_supabase_uid('perm_owner'), 'perm_owner@test.com'),
  (tests.get_supabase_uid('perm_member'), 'perm_member@test.com'),
  (tests.get_supabase_uid('perm_outsider'), 'perm_outsider@test.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, slug, created_by) VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'Perm Test Org',
  'perm-test',
  tests.get_supabase_uid('perm_owner')
);

INSERT INTO organization_members (user_id, organization_id, status) VALUES
  (tests.get_supabase_uid('perm_owner'), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'active'),
  (tests.get_supabase_uid('perm_member'), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'active');

INSERT INTO user_role_assignments (user_id, role_id, scope, scope_id)
SELECT tests.get_supabase_uid('perm_owner'), id, 'org', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
FROM roles WHERE name = 'org_owner' LIMIT 1;

INSERT INTO user_role_assignments (user_id, role_id, scope, scope_id)
SELECT tests.get_supabase_uid('perm_member'), id, 'org', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
FROM roles WHERE name = 'org_member' LIMIT 1;

-- Test 1: All authenticated users can read permission catalog
SELECT tests.authenticate_as('perm_member');
SELECT ok(
  (SELECT COUNT(*) FROM permissions WHERE deleted_at IS NULL) > 0,
  'Authenticated users can read permission catalog'
);

-- Test 2: System roles visible to authenticated users
SELECT ok(
  (SELECT COUNT(*) FROM roles WHERE is_basic = true) >= 2,
  'System roles visible to authenticated users'
);

-- Test 3: Owner can see org members
SELECT tests.authenticate_as('perm_owner');
SELECT ok(
  (SELECT COUNT(*) FROM organization_members WHERE organization_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') = 2,
  'Owner can see org members'
);

-- Test 4: Member can see org members
SELECT tests.authenticate_as('perm_member');
SELECT ok(
  (SELECT COUNT(*) FROM organization_members WHERE organization_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') = 2,
  'Member can see org members'
);

-- Test 5: Outsider cannot see org members
SELECT tests.authenticate_as('perm_outsider');
SELECT ok(
  (SELECT COUNT(*) FROM organization_members WHERE organization_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') = 0,
  'Outsider cannot see org members'
);

-- Test 6: Owner can see their role assignments
SELECT tests.authenticate_as('perm_owner');
SELECT ok(
  (SELECT COUNT(*) FROM user_role_assignments WHERE user_id = tests.get_supabase_uid('perm_owner')) >= 1,
  'Owner can see their role assignments'
);

-- Test 7: Member can see their role assignments
SELECT tests.authenticate_as('perm_member');
SELECT ok(
  (SELECT COUNT(*) FROM user_role_assignments WHERE user_id = tests.get_supabase_uid('perm_member')) >= 1,
  'Member can see their role assignments'
);

-- Test 8: Users can see their effective permissions
SELECT tests.authenticate_as('perm_owner');
SELECT ok(
  (SELECT COUNT(*) FROM user_effective_permissions WHERE user_id = tests.get_supabase_uid('perm_owner')) > 0,
  'Owner can see their effective permissions'
);

-- Test 9: Outsider cannot see owner permissions
SELECT tests.authenticate_as('perm_outsider');
SELECT ok(
  (SELECT COUNT(*) FROM user_effective_permissions WHERE user_id = tests.get_supabase_uid('perm_owner')) = 0,
  'Outsider cannot see owner effective permissions'
);

-- Test 10: Permission compilation works
SELECT tests.authenticate_as('perm_owner');
SELECT ok(
  EXISTS(SELECT 1 FROM user_effective_permissions
         WHERE user_id = tests.get_supabase_uid('perm_owner')
         AND permission_slug = 'org.update'),
  'Owner has org.update permission compiled'
);

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
