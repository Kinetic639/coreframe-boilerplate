-- Add DELETE RLS policies for wdd_matcher_block_matches and wdd_matcher_line_matches
-- Required for re-run matching to clear existing matches before re-inserting

CREATE POLICY "wmbm_delete" ON public.wdd_matcher_block_matches
  FOR DELETE USING (public.has_permission(organization_id, 'wdd_matcher.upload'));

CREATE POLICY "wmlm_delete" ON public.wdd_matcher_line_matches
  FOR DELETE USING (public.has_permission(organization_id, 'wdd_matcher.upload'));
