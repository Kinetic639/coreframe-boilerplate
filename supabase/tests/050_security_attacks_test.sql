-- ============================================================================
-- TEST: Security Attacks (10 tests)
-- ============================================================================
BEGIN;

SELECT plan(10);

-- Setup
SELECT tests.create_supabase_user('attacker_user', 'attacker@test.com');
SELECT tests.create_supabase_user('victim_user', 'victim@test.com');

INSERT INTO public.users (id, email) VALUES
  (tests.get_supabase_uid('attacker_user'), 'attacker@test.com'),
  (tests.get_supabase_uid('victim_user'), 'victim@test.com')
ON CONFLICT (id) DO NOTHING;

-- Victim creates org with full bootstrap
SELECT tests.authenticate_as('victim_user');
INSERT INTO organizations (id, name, slug, created_by) VALUES (
  '30303030-3030-3030-3030-303030303030',
  'Victim Org',
  'victim-org',
  tests.get_supabase_uid('victim_user')
);

INSERT INTO organization_members (user_id, organization_id, status) VALUES
  (tests.get_supabase_uid('victim_user'), '30303030-3030-3030-3030-303030303030', 'active');

INSERT INTO user_role_assignments (user_id, role_id, scope, scope_id)
SELECT tests.get_supabase_uid('victim_user'), id, 'org', '30303030-3030-3030-3030-303030303030'
FROM roles WHERE name = 'org_owner' LIMIT 1;

-- Switch to attacker
SELECT tests.authenticate_as('attacker_user');

-- Test 1: Attacker cannot see victim org
SELECT ok(
  (SELECT COUNT(*) FROM organizations WHERE id = '30303030-3030-3030-3030-303030303030') = 0,
  'Attack 1: Attacker cannot see victim org'
);

-- Test 2: Attacker cannot see victim members
SELECT ok(
  (SELECT COUNT(*) FROM organization_members WHERE organization_id = '30303030-3030-3030-3030-303030303030') = 0,
  'Attack 2: Attacker cannot see victim members'
);

-- Test 3: Attacker cannot see victim permissions
SELECT ok(
  (SELECT COUNT(*) FROM user_effective_permissions WHERE user_id = tests.get_supabase_uid('victim_user')) = 0,
  'Attack 3: Attacker cannot see victim permissions'
);

-- Test 4: Attacker cannot see victim role assignments
SELECT ok(
  (SELECT COUNT(*) FROM user_role_assignments WHERE user_id = tests.get_supabase_uid('victim_user')) = 0,
  'Attack 4: Attacker cannot see victim role assignments'
);

-- Test 5: Attacker UPDATE on victim org has no effect (RLS silently blocks)
UPDATE organizations SET name = 'Hacked' WHERE id = '30303030-3030-3030-3030-303030303030';
SELECT ok(
  (SELECT COUNT(*) FROM organizations WHERE id = '30303030-3030-3030-3030-303030303030' AND name = 'Hacked') = 0,
  'Attack 5: Attacker UPDATE on victim org has no effect'
);

-- Test 6: Attacker DELETE on victim org has no effect (RLS silently blocks)
DELETE FROM organizations WHERE id = '30303030-3030-3030-3030-303030303030';
-- Verify from victim perspective
SELECT tests.authenticate_as('victim_user');
SELECT ok(
  (SELECT COUNT(*) FROM organizations WHERE id = '30303030-3030-3030-3030-303030303030') = 1,
  'Attack 6: Victim org still exists after attacker DELETE attempt'
);

-- Test 7: Attacker cannot join victim org (INSERT throws)
SELECT tests.authenticate_as('attacker_user');
SELECT throws_ok(
  $$INSERT INTO organization_members (user_id, organization_id, status)
    VALUES (tests.get_supabase_uid('attacker_user'), '30303030-3030-3030-3030-303030303030', 'active')$$,
  NULL,
  NULL,
  'Attack 7: Attacker cannot join victim org'
);

-- Test 8: Attacker cannot assign themselves victim roles (INSERT throws)
SELECT throws_ok(
  $$INSERT INTO user_role_assignments (user_id, role_id, scope, scope_id)
    SELECT tests.get_supabase_uid('attacker_user'), id, 'org', '30303030-3030-3030-3030-303030303030'
    FROM roles WHERE name = 'org_owner' LIMIT 1$$,
  NULL,
  NULL,
  'Attack 8: Attacker cannot assign themselves roles in victim org'
);

-- Test 9: Attacker DELETE on victim members has no effect (RLS silently blocks)
DELETE FROM organization_members
  WHERE organization_id = '30303030-3030-3030-3030-303030303030'
  AND user_id = tests.get_supabase_uid('victim_user');
SELECT tests.authenticate_as('victim_user');
SELECT ok(
  (SELECT COUNT(*) FROM organization_members WHERE organization_id = '30303030-3030-3030-3030-303030303030') = 1,
  'Attack 9: Victim members still intact after attacker DELETE attempt'
);

-- Test 10: Attacker DELETE on victim roles has no effect (RLS silently blocks)
SELECT tests.authenticate_as('attacker_user');
DELETE FROM user_role_assignments
  WHERE user_id = tests.get_supabase_uid('victim_user')
  AND scope_id = '30303030-3030-3030-3030-303030303030';
SELECT tests.authenticate_as('victim_user');
SELECT ok(
  (SELECT COUNT(*) FROM user_role_assignments WHERE user_id = tests.get_supabase_uid('victim_user') AND scope_id = '30303030-3030-3030-3030-303030303030') = 1,
  'Attack 10: Victim role assignments intact after attacker DELETE attempt'
);

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
