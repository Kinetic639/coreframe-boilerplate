-- =============================================================================
-- Migration: WDD Matcher — add 'subset' and 'ambiguous' block match types
-- =============================================================================
-- The original CHECK constraint only allowed ('exact','partial','unmatched_bc','unmatched_brand').
-- The enrichment engine now produces semantically distinct outcomes:
--   subset    — every WDD line is contained in the order block; order has extra lines
--   ambiguous — multiple order candidates score closely; no clear winner selected
-- ---------------------------------------------------------------------------

-- block_match_type
ALTER TABLE public.wdd_matcher_block_matches
  DROP CONSTRAINT IF EXISTS wdd_matcher_block_matches_block_match_type_check;

ALTER TABLE public.wdd_matcher_block_matches
  ADD CONSTRAINT wdd_matcher_block_matches_block_match_type_check
  CHECK (block_match_type IN (
    'exact',
    'subset',
    'partial',
    'ambiguous',
    'unmatched_bc',
    'unmatched_brand'
  ));
