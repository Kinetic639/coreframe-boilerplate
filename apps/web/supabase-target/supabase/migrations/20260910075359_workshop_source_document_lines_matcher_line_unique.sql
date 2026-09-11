-- Migration: workshop_source_document_lines_matcher_line_unique
-- Discovered during Phase 3 RPC design: workshop_source_document_lines had no
-- deterministic dedup key, so a re-run of materialization for the same
-- session would insert duplicate provenance rows for the same underlying
-- wdd_matcher_lines row. Manual lines (wdd_matcher_line_id IS NULL) are
-- intentionally excluded -- multiple independent manual lines under one
-- document are allowed and not a duplicate-detection case.
CREATE UNIQUE INDEX workshop_source_document_lines_matcher_line_unique
  ON public.workshop_source_document_lines (workshop_source_document_id, wdd_matcher_line_id)
  WHERE wdd_matcher_line_id IS NOT NULL;
