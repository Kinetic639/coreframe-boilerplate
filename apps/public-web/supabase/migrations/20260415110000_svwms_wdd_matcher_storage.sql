-- =============================================================================
-- Migration: SVWMS WDD Matcher — storage bucket + RLS policies
-- Project:   rjeraydumwechpjjzrus (TARGET)
-- =============================================================================
-- Bucket: wdd-matcher-files (private)
-- Path convention: wdd-matcher-files/{org_id}/{session_id}/{file_id}.pdf
--   role and brand_label are stored in wdd_matcher_session_files, NOT in path.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PART 1: Storage bucket
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wdd-matcher-files',
  'wdd-matcher-files',
  false,
  26214400,   -- 25 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- PART 2: Storage RLS policies
-- Path format: wdd-matcher-files/{org_id}/{session_id}/{file_id}.pdf
-- storage.foldername(name) returns text[] where [1] = first segment = org_id
-- ---------------------------------------------------------------------------

-- SELECT: authenticated org member
CREATE POLICY "wdd_matcher_files_select" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'wdd-matcher-files'
    AND public.is_org_member((storage.foldername(name))[1]::UUID)
  );

-- INSERT: user must have wdd_matcher.upload permission for the org (first path segment)
CREATE POLICY "wdd_matcher_files_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'wdd-matcher-files'
    AND public.has_permission((storage.foldername(name))[1]::UUID, 'wdd_matcher.upload')
  );

-- DELETE: user must have wdd_matcher.approve permission for the org
CREATE POLICY "wdd_matcher_files_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'wdd-matcher-files'
    AND public.has_permission((storage.foldername(name))[1]::UUID, 'wdd_matcher.approve')
  );
