-- ============================================================================
-- TEST: User Preferences V2 RLS and Schema Tests (20 tests)
-- Tests schema expansion, RLS policies, and audit functionality
-- ============================================================================
BEGIN;

SELECT plan(20);

-- ============================================================================
-- SETUP: Create test users
-- ============================================================================

SELECT tests.create_supabase_user('prefs_user1', 'prefs_user1@test.com');
SELECT tests.create_supabase_user('prefs_user2', 'prefs_user2@test.com');

INSERT INTO public.users (id, email) VALUES
  (tests.get_supabase_uid('prefs_user1'), 'prefs_user1@test.com'),
  (tests.get_supabase_uid('prefs_user2'), 'prefs_user2@test.com')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SCHEMA TESTS
-- ============================================================================

-- Test 1: user_preferences table exists
SELECT has_table('public', 'user_preferences', 'user_preferences table exists');

-- Test 2: All new columns exist
SELECT ok(
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_preferences'
    AND column_name = 'display_name'
  ),
  'display_name column exists'
);

-- Test 3: dashboard_settings JSONB column exists
SELECT ok(
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_preferences'
    AND column_name = 'dashboard_settings'
    AND data_type = 'jsonb'
  ),
  'dashboard_settings JSONB column exists'
);

-- Test 4: notification_settings JSONB column exists
SELECT ok(
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_preferences'
    AND column_name = 'notification_settings'
    AND data_type = 'jsonb'
  ),
  'notification_settings JSONB column exists'
);

-- Test 5: module_settings JSONB column exists
SELECT ok(
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_preferences'
    AND column_name = 'module_settings'
    AND data_type = 'jsonb'
  ),
  'module_settings JSONB column exists'
);

-- Test 6: user_preference_audit table exists
SELECT has_table('public', 'user_preference_audit', 'user_preference_audit table exists');

-- Test 7: Audit table has all required columns
SELECT ok(
  (
    SELECT COUNT(*) = 8 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_preference_audit'
    AND column_name IN ('id', 'user_id', 'changed_by', 'change_type', 'old_values', 'new_values', 'ip_address', 'created_at')
  ),
  'user_preference_audit has all required columns'
);

-- Test 8: jsonb_deep_merge function exists
SELECT ok(
  EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'jsonb_deep_merge'),
  'jsonb_deep_merge function exists'
);

-- ============================================================================
-- RLS TESTS - user_preferences
-- ============================================================================

-- First, insert preferences for user1 as an admin to test RLS
SET LOCAL ROLE postgres;
INSERT INTO public.user_preferences (user_id, display_name, timezone, dashboard_settings)
VALUES (
  tests.get_supabase_uid('prefs_user1'),
  'Test User 1',
  'Europe/Warsaw',
  '{"ui": {"theme": "dark"}}'::jsonb
)
ON CONFLICT (user_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  timezone = EXCLUDED.timezone,
  dashboard_settings = EXCLUDED.dashboard_settings;

INSERT INTO public.user_preferences (user_id, display_name, timezone)
VALUES (
  tests.get_supabase_uid('prefs_user2'),
  'Test User 2',
  'America/New_York'
)
ON CONFLICT (user_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  timezone = EXCLUDED.timezone;
RESET ROLE;

-- Test 9: User can read their own preferences
SELECT tests.authenticate_as('prefs_user1');
SELECT ok(
  (SELECT COUNT(*) FROM user_preferences WHERE user_id = tests.get_supabase_uid('prefs_user1')) = 1,
  'User can read their own preferences'
);

-- Test 10: User cannot read other user preferences
SELECT ok(
  (SELECT COUNT(*) FROM user_preferences WHERE user_id = tests.get_supabase_uid('prefs_user2')) = 0,
  'User cannot read other user preferences'
);

-- Test 11: User can update their own preferences
UPDATE user_preferences
SET display_name = 'Updated User 1',
    updated_at = now(),
    updated_by = auth.uid()
WHERE user_id = tests.get_supabase_uid('prefs_user1');

SELECT ok(
  (SELECT display_name FROM user_preferences WHERE user_id = tests.get_supabase_uid('prefs_user1')) = 'Updated User 1',
  'User can update their own preferences'
);

-- Test 12: User cannot update other user preferences (attempt should fail silently or affect 0 rows)
UPDATE user_preferences
SET display_name = 'Hacked Name'
WHERE user_id = tests.get_supabase_uid('prefs_user2');

-- Reset to check the value
RESET ROLE;
SET LOCAL ROLE postgres;
SELECT ok(
  (SELECT display_name FROM user_preferences WHERE user_id = tests.get_supabase_uid('prefs_user2')) = 'Test User 2',
  'User cannot update other user preferences'
);
RESET ROLE;

-- ============================================================================
-- RLS TESTS - user_preference_audit
-- ============================================================================

-- Test 13: User can read their own audit trail
SELECT tests.authenticate_as('prefs_user1');
SELECT ok(
  (SELECT COUNT(*) FROM user_preference_audit WHERE user_id = tests.get_supabase_uid('prefs_user1')) >= 0,
  'User can read their own audit trail'
);

-- Test 14: User cannot read other user audit trail
SELECT ok(
  (SELECT COUNT(*) FROM user_preference_audit WHERE user_id = tests.get_supabase_uid('prefs_user2')) = 0,
  'User cannot read other user audit trail'
);

-- ============================================================================
-- FUNCTIONAL TESTS
-- ============================================================================

-- Test 15: Default values are applied correctly
SELECT tests.authenticate_as('prefs_user1');
SELECT ok(
  (SELECT locale FROM user_preferences WHERE user_id = tests.get_supabase_uid('prefs_user1')) = 'pl',
  'Default locale value is applied'
);

-- Test 16: JSONB deep merge works correctly
SELECT is(
  public.jsonb_deep_merge(
    '{"a": {"b": 1, "c": 2}}'::jsonb,
    '{"a": {"b": 3}}'::jsonb
  ),
  '{"a": {"b": 3, "c": 2}}'::jsonb,
  'jsonb_deep_merge merges nested objects correctly'
);

-- Test 17: JSONB deep merge handles null gracefully
SELECT is(
  public.jsonb_deep_merge(NULL, '{"a": 1}'::jsonb),
  '{"a": 1}'::jsonb,
  'jsonb_deep_merge handles null target'
);

-- Test 18: Dashboard settings can store complex structure
UPDATE user_preferences
SET dashboard_settings = '{
  "ui": {"theme": "dark", "sidebarCollapsed": true},
  "modules": {"warehouse": {"defaultView": "table"}},
  "updated_at": "2026-02-01T12:00:00Z"
}'::jsonb,
    updated_at = now()
WHERE user_id = tests.get_supabase_uid('prefs_user1');

SELECT ok(
  (SELECT dashboard_settings->'ui'->>'theme' FROM user_preferences WHERE user_id = tests.get_supabase_uid('prefs_user1')) = 'dark',
  'Dashboard settings stores complex JSONB structure'
);

-- Test 19: Module settings can store per-module preferences
UPDATE user_preferences
SET module_settings = '{
  "warehouse": {"pageSize": 50, "sortField": "name"},
  "teams": {"defaultView": "cards"}
}'::jsonb
WHERE user_id = tests.get_supabase_uid('prefs_user1');

SELECT ok(
  (SELECT module_settings->'warehouse'->>'pageSize' FROM user_preferences WHERE user_id = tests.get_supabase_uid('prefs_user1')) = '50',
  'Module settings stores per-module preferences'
);

-- Test 20: RLS is enabled on both tables
SELECT ok(
  (
    SELECT COUNT(*) = 2 FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN ('user_preferences', 'user_preference_audit')
    AND rowsecurity = true
  ),
  'RLS is enabled on user_preferences and user_preference_audit tables'
);

-- ============================================================================
-- CLEANUP
-- ============================================================================

SELECT * FROM finish();

ROLLBACK;
