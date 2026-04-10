-- ============================================================================
-- TEST: RLS Policies with Test Helpers
-- ============================================================================
-- Demonstrates using Supabase Test Helpers for easier RLS testing

BEGIN;

SELECT plan(10);

-- ============================================================================
-- SETUP: Create test users using test helpers
-- ============================================================================

-- Create test users (much easier than manual auth.users inserts)
SELECT tests.create_supabase_user('org_owner', 'owner@test.com', '555-1234');
SELECT tests.create_supabase_user('org_member', 'member@test.com', '555-5678');
SELECT tests.create_supabase_user('outsider', 'outsider@test.com', '555-9999');

-- Sync to public.users table (required for foreign key constraints)
INSERT INTO public.users (id, email)
VALUES
  (tests.get_supabase_uid('org_owner'), 'owner@test.com'),
  (tests.get_supabase_uid('org_member'), 'member@test.com'),
  (tests.get_supabase_uid('outsider'), 'outsider@test.com')
ON CONFLICT (id) DO NOTHING;

-- Create test organization
INSERT INTO public.organizations (id, name, slug, created_by)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Test Organization',
  'test-org',
  tests.get_supabase_uid('org_owner')
);

-- Add members to organization
INSERT INTO public.organization_members (user_id, organization_id, status)
VALUES
  (tests.get_supabase_uid('org_owner'), '11111111-1111-1111-1111-111111111111', 'active'),
  (tests.get_supabase_uid('org_member'), '11111111-1111-1111-1111-111111111111', 'active');

-- Assign roles (scope must be 'org' not 'organization' to match role scope_type)
INSERT INTO public.user_role_assignments (user_id, role_id, scope, scope_id)
SELECT
  tests.get_supabase_uid('org_owner'),
  id,
  'org',
  '11111111-1111-1111-1111-111111111111'
FROM public.roles
WHERE name = 'org_owner'
LIMIT 1;

INSERT INTO public.user_role_assignments (user_id, role_id, scope, scope_id)
SELECT
  tests.get_supabase_uid('org_member'),
  id,
  'org',
  '11111111-1111-1111-1111-111111111111'
FROM public.roles
WHERE name = 'org_member'
LIMIT 1;

-- ============================================================================
-- TEST 1-3: Organization Owner Access
-- ============================================================================

-- Authenticate as org owner
SELECT tests.authenticate_as('org_owner');

-- Test 1: Owner can see their organization
SELECT results_eq(
  $$SELECT COUNT(*)::int FROM organizations WHERE id = '11111111-1111-1111-1111-111111111111'$$,
  ARRAY[1],
  'Owner can see their organization'
);

-- Test 2: Owner can see organization members
SELECT results_eq(
  $$SELECT COUNT(*)::int FROM organization_members WHERE organization_id = '11111111-1111-1111-1111-111111111111'$$,
  ARRAY[2],
  'Owner can see all organization members'
);

-- Test 3: Owner can update organization (verify the update took effect)
UPDATE organizations SET name = 'Updated Org' WHERE id = '11111111-1111-1111-1111-111111111111';
SELECT results_eq(
  $$SELECT name FROM organizations WHERE id = '11111111-1111-1111-1111-111111111111'$$,
  $$VALUES ('Updated Org')$$,
  'Owner can update organization'
);

-- ============================================================================
-- TEST 4-6: Organization Member Access
-- ============================================================================

-- Switch to org member context
SELECT tests.authenticate_as('org_member');

-- Test 4: Member can see their organization
SELECT results_eq(
  $$SELECT COUNT(*)::int FROM organizations WHERE id = '11111111-1111-1111-1111-111111111111'$$,
  ARRAY[1],
  'Member can see their organization'
);

-- Test 5: Member can see organization members
SELECT results_eq(
  $$SELECT COUNT(*)::int FROM organization_members WHERE organization_id = '11111111-1111-1111-1111-111111111111'$$,
  ARRAY[2],
  'Member can see organization members'
);

-- Test 6: Member cannot update organization (RLS silently blocks - verify name unchanged)
UPDATE organizations SET name = 'Hacked Org' WHERE id = '11111111-1111-1111-1111-111111111111';
SELECT results_eq(
  $$SELECT name FROM organizations WHERE id = '11111111-1111-1111-1111-111111111111'$$,
  $$VALUES ('Updated Org')$$,
  'Member cannot update organization without permission'
);

-- ============================================================================
-- TEST 7-10: Outsider Access (Cross-tenant isolation)
-- ============================================================================

-- Switch to outsider context
SELECT tests.authenticate_as('outsider');

-- Test 7: Outsider cannot see organization
SELECT results_eq(
  $$SELECT COUNT(*)::int FROM organizations WHERE id = '11111111-1111-1111-1111-111111111111'$$,
  ARRAY[0],
  'Outsider cannot see organization'
);

-- Test 8: Outsider cannot see organization members
SELECT results_eq(
  $$SELECT COUNT(*)::int FROM organization_members WHERE organization_id = '11111111-1111-1111-1111-111111111111'$$,
  ARRAY[0],
  'Outsider cannot see organization members'
);

-- Test 9: Outsider cannot join organization
SELECT throws_ok(
  $$INSERT INTO organization_members (user_id, organization_id, status)
    VALUES (tests.get_supabase_uid('outsider'), '11111111-1111-1111-1111-111111111111', 'active')$$,
  NULL,
  NULL,
  'Outsider cannot join organization without invitation'
);

-- Test 10: Outsider cannot update organization (RLS silently blocks)
UPDATE organizations SET name = 'Outsider Hacked' WHERE id = '11111111-1111-1111-1111-111111111111';
SELECT ok(
  (SELECT COUNT(*) FROM organizations WHERE id = '11111111-1111-1111-1111-111111111111') = 0,
  'Outsider cannot see or update organization'
);

-- ============================================================================
-- CLEANUP
-- ============================================================================

-- Clear authentication (back to anonymous)
SELECT tests.clear_authentication();

SELECT * FROM finish();

ROLLBACK;
