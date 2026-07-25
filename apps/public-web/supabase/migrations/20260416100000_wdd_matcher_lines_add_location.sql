-- ---------------------------------------------------------------------------
-- Add location column to wdd_matcher_lines
-- Parser v2 extracts location values (e.g. "PRZY A1") from the location
-- column band; this column persists them instead of relying on metadata.
-- ---------------------------------------------------------------------------

ALTER TABLE public.wdd_matcher_lines
  ADD COLUMN IF NOT EXISTS location TEXT NULL;
