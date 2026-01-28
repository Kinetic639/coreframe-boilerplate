-- ============================================================================
-- TEST: Integration Flows (10 tests)
-- ============================================================================
BEGIN;

SELECT plan(10);

-- Setup users
SELECT tests.create_supabase_user('flow_owner', 'flow_owner@test.com');
SELECT tests.create_supabase_user('flow_invitee', 'flow_invitee@test.com');

INSERT INTO public.users (id, email) VALUES
  (tests.get_supabase_uid('flow_owner'), 'flow_owner@test.com'),
  (tests.get_supabase_uid('flow_invitee'), 'flow_invitee@test.com')
ON CONFLICT (id) DO NOTHING;

-- Test 1-3: Bootstrap flow
SELECT tests.authenticate_as('flow_owner');
INSERT INTO organizations (id, name, slug, created_by) VALUES (
  '10101010-1010-1010-1010-101010101010',
  'Flow Test Org',
  'flow-test-org',
  tests.get_supabase_uid('flow_owner')
);
SELECT ok(
  (SELECT COUNT(*) FROM organizations WHERE id = '10101010-1010-1010-1010-101010101010') = 1,
  'Bootstrap: Organization created'
);

INSERT INTO organization_members (user_id, organization_id, status) VALUES
  (tests.get_supabase_uid('flow_owner'), '10101010-1010-1010-1010-101010101010', 'active');
SELECT ok(
  (SELECT COUNT(*) FROM organization_members WHERE organization_id = '10101010-1010-1010-1010-101010101010') = 1,
  'Bootstrap: Creator added as member'
);

INSERT INTO user_role_assignments (user_id, role_id, scope, scope_id)
SELECT tests.get_supabase_uid('flow_owner'), id, 'org', '10101010-1010-1010-1010-101010101010'
FROM roles WHERE name = 'org_owner' LIMIT 1;
SELECT ok(
  EXISTS(SELECT 1 FROM user_effective_permissions
         WHERE user_id = tests.get_supabase_uid('flow_owner')
         AND organization_id = '10101010-1010-1010-1010-101010101010'
         AND permission_slug = 'org.update'),
  'Bootstrap: Owner has org.update permission'
);

-- Test 4-6: Invite flow
INSERT INTO organization_members (user_id, organization_id, status) VALUES
  (tests.get_supabase_uid('flow_invitee'), '10101010-1010-1010-1010-101010101010', 'active');
SELECT ok(
  (SELECT COUNT(*) FROM organization_members WHERE organization_id = '10101010-1010-1010-1010-101010101010') = 2,
  'Invite: Invitee added as member'
);

INSERT INTO user_role_assignments (user_id, role_id, scope, scope_id)
SELECT tests.get_supabase_uid('flow_invitee'), id, 'org', '10101010-1010-1010-1010-101010101010'
FROM roles WHERE name = 'org_member' LIMIT 1;
SELECT ok(
  EXISTS(SELECT 1 FROM user_effective_permissions
         WHERE user_id = tests.get_supabase_uid('flow_invitee')
         AND organization_id = '10101010-1010-1010-1010-101010101010'),
  'Invite: Invitee has permissions compiled'
);

SELECT tests.authenticate_as('flow_invitee');
SELECT ok(
  (SELECT COUNT(*) FROM organizations WHERE id = '10101010-1010-1010-1010-101010101010') = 1,
  'Invite: Invitee can see organization'
);

-- Test 7-8: Role management (owner manages invitee's roles)
SELECT tests.authenticate_as('flow_owner');
DELETE FROM user_role_assignments
WHERE user_id = tests.get_supabase_uid('flow_invitee')
AND scope_id = '10101010-1010-1010-1010-101010101010';
SELECT ok(
  (SELECT COUNT(*) FROM user_effective_permissions
   WHERE user_id = tests.get_supabase_uid('flow_invitee')
   AND organization_id = '10101010-1010-1010-1010-101010101010') = 0,
  'Role removal: Permissions removed after role deleted'
);

INSERT INTO user_role_assignments (user_id, role_id, scope, scope_id)
SELECT tests.get_supabase_uid('flow_invitee'), id, 'org', '10101010-1010-1010-1010-101010101010'
FROM roles WHERE name = 'org_owner' LIMIT 1;
SELECT ok(
  EXISTS(SELECT 1 FROM user_effective_permissions
         WHERE user_id = tests.get_supabase_uid('flow_invitee')
         AND organization_id = '10101010-1010-1010-1010-101010101010'
         AND permission_slug = 'org.update'),
  'Role upgrade: User gets new permissions'
);

-- Test 9-10: Cross-org isolation
SELECT tests.authenticate_as('flow_owner');
INSERT INTO organizations (id, name, slug, created_by) VALUES (
  '20202020-2020-2020-2020-202020202020',
  'Second Org',
  'second-org',
  tests.get_supabase_uid('flow_owner')
);
SELECT ok(
  (SELECT COUNT(*) FROM organizations WHERE created_by = tests.get_supabase_uid('flow_owner')) = 2,
  'Cross-org: Owner can create multiple orgs'
);

SELECT tests.authenticate_as('flow_invitee');
SELECT ok(
  (SELECT COUNT(*) FROM organizations WHERE id = '20202020-2020-2020-2020-202020202020') = 0,
  'Cross-org: User cannot see other orgs'
);

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
