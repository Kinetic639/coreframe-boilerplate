-- Default user time zone: Europe/Warsaw instead of UTC.
--
-- user_preferences.timezone defaulted to 'UTC', and the app created new
-- preference rows with 'UTC' too, so almost every user had 'UTC' without ever
-- choosing it. Planning (due dates, "today" on the start page) computes dates
-- in this zone, so those users got UTC days and times.
--
-- The app now defaults to Europe/Warsaw; this aligns the column default and
-- moves the rows still on the old untouched default.

ALTER TABLE public.user_preferences
  ALTER COLUMN timezone SET DEFAULT 'Europe/Warsaw';

UPDATE public.user_preferences
SET timezone = 'Europe/Warsaw'
WHERE timezone IS NULL OR timezone = 'UTC';
