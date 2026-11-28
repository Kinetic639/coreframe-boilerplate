-- User profile names: tighter length limits (first name 20, last name 30).
--
-- The limits of 30 / 50 characters set in 20261120090100 still let a full name
-- of 75 characters through, which broke layouts. Real first and last names fit
-- in 20 / 30 characters (double-barrelled ones included), so the database now
-- enforces those limits on users and invitations.
--
-- Names that don't fit are not cut silently: the one known account over the
-- limit gets the name agreed with the owner, and if any other row is still too
-- long the migration stops and lists it, so it can be fixed by hand first.

-- ── 1. The one known account over the new limits ──────────────────────────────

UPDATE public.users
   SET first_name = 'Kacper',
       last_name  = 'Stelmaszewski'
 WHERE id = 'bb263937-97fe-432e-b5b9-2c2bb4b1ddf6'
   AND (char_length(first_name) > 20 OR char_length(last_name) > 30);

-- ── 2. Stop if anything else is still too long ────────────────────────────────

DO $$
DECLARE
  v_offenders text;
BEGIN
  SELECT string_agg(row_desc, E'\n')
    INTO v_offenders
    FROM (
      SELECT format('users %s: first_name %s chars, last_name %s chars',
                    id, char_length(first_name), char_length(last_name)) AS row_desc
        FROM public.users
       WHERE char_length(first_name) > 20 OR char_length(last_name) > 30
      UNION ALL
      SELECT format('invitations %s: invited_first_name %s chars, invited_last_name %s chars',
                    id, char_length(invited_first_name), char_length(invited_last_name))
        FROM public.invitations
       WHERE char_length(invited_first_name) > 20 OR char_length(invited_last_name) > 30
    ) o;

  IF v_offenders IS NOT NULL THEN
    RAISE EXCEPTION E'Names longer than the new limits (20 / 30). Shorten them first:\n%', v_offenders;
  END IF;
END;
$$;

-- ── 3. New limits ─────────────────────────────────────────────────────────────

ALTER TABLE public.users
  DROP CONSTRAINT users_first_name_length,
  DROP CONSTRAINT users_last_name_length,
  ADD CONSTRAINT users_first_name_length CHECK (char_length(first_name) <= 20),
  ADD CONSTRAINT users_last_name_length CHECK (char_length(last_name) <= 30);

ALTER TABLE public.invitations
  DROP CONSTRAINT invitations_invited_first_name_length,
  DROP CONSTRAINT invitations_invited_last_name_length,
  ADD CONSTRAINT invitations_invited_first_name_length CHECK (char_length(invited_first_name) <= 20),
  ADD CONSTRAINT invitations_invited_last_name_length CHECK (char_length(invited_last_name) <= 30);
