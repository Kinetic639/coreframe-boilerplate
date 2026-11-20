-- User profile names: length limits.
--
-- A tester saved a first name, last name and display name of 100 characters
-- (a whole sentence), which broke layouts across the app. The database now caps
-- the first name at 30 characters, the last name at 50 and the display name at 32,
-- so no client (old form, API call, invite) can store a longer one. Existing
-- longer values are cut to the limit first.

-- ── 1. Name length limits ─────────────────────────────────────────────────────

UPDATE public.users
   SET first_name = nullif(btrim(left(btrim(first_name), 30)), '')
 WHERE char_length(first_name) > 30;

UPDATE public.users
   SET last_name = nullif(btrim(left(btrim(last_name), 50)), '')
 WHERE char_length(last_name) > 50;

UPDATE public.user_preferences
   SET display_name = nullif(btrim(left(btrim(display_name), 32)), '')
 WHERE char_length(display_name) > 32;

UPDATE public.invitations
   SET invited_first_name = nullif(btrim(left(btrim(invited_first_name), 30)), '')
 WHERE char_length(invited_first_name) > 30;

UPDATE public.invitations
   SET invited_last_name = nullif(btrim(left(btrim(invited_last_name), 50)), '')
 WHERE char_length(invited_last_name) > 50;

ALTER TABLE public.users
  ADD CONSTRAINT users_first_name_length CHECK (char_length(first_name) <= 30),
  ADD CONSTRAINT users_last_name_length CHECK (char_length(last_name) <= 50);

ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_preferences_display_name_length CHECK (char_length(display_name) <= 32);

ALTER TABLE public.invitations
  ADD CONSTRAINT invitations_invited_first_name_length CHECK (char_length(invited_first_name) <= 30),
  ADD CONSTRAINT invitations_invited_last_name_length CHECK (char_length(invited_last_name) <= 50);
