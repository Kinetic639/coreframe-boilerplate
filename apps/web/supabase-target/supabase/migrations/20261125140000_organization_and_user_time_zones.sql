-- Time zones: organization default, user override.
--
-- Timestamps stay in UTC (timestamptz). Zones only decide how they are shown
-- and how business dates ("today", end-of-day due dates) are interpreted:
--
-- * organization_profiles.timezone: the organization's zone, set by an admin
--   in the organization profile. Default Europe/Warsaw. Business dates in
--   planning are computed in it.
-- * user_preferences.timezone: the user's own zone for display. NULL means
--   "same as my organization", so changing the organization's zone reaches
--   everyone who has not picked their own.
--
-- user_preferences.timezone used to default to 'UTC', and the app created new
-- preference rows with 'UTC' too, so most users had 'UTC' without ever
-- choosing it. Those rows move to NULL (follow the organization).

ALTER TABLE public.organization_profiles
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Warsaw';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_profiles_timezone_length'
      AND conrelid = 'public.organization_profiles'::regclass
  ) THEN
    ALTER TABLE public.organization_profiles
      ADD CONSTRAINT organization_profiles_timezone_length
      CHECK (char_length(timezone) BETWEEN 1 AND 64);
  END IF;
END
$$;

COMMENT ON COLUMN public.organization_profiles.timezone IS
  'IANA time zone of the organization. Default display zone for its members; business dates are computed in it.';

ALTER TABLE public.user_preferences
  ALTER COLUMN timezone DROP DEFAULT;

COMMENT ON COLUMN public.user_preferences.timezone IS
  'User''s own IANA display time zone. NULL = same as the active organization.';

UPDATE public.user_preferences
SET timezone = NULL
WHERE timezone = 'UTC';
