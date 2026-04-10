-- Revoke anon role privileges on user_preferences and user_preference_audit tables.
-- The anon role should never access user preferences - only authenticated users
-- via RLS policies should be allowed.
--
-- This migration is safe to run multiple times (idempotent).

DO $$
BEGIN
  -- Revoke all privileges from anon on user_preferences
  REVOKE ALL PRIVILEGES ON public.user_preferences FROM anon;

  -- Revoke all privileges from anon on user_preference_audit
  REVOKE ALL PRIVILEGES ON public.user_preference_audit FROM anon;

  RAISE NOTICE 'Revoked anon privileges on user_preferences and user_preference_audit';
END $$;
