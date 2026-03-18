-- Fix: Add SELECT policy for authenticated users on org-logos bucket.
--
-- Root cause: The existing org_logos_public_read policy targets the {public}
-- role (anon), which covers browser-side public reads but does NOT apply to
-- the server-side authenticated Supabase client used by storage.list().
--
-- Effect of the missing policy:
--   OrgProfileService.uploadLogo calls storage.list(orgId) to find existing
--   files before deletion. Without an authenticated SELECT policy, list()
--   silently returns [] even when files exist. The delete step is skipped,
--   and the subsequent INSERT (upsert:false) fails with "resource already
--   exists" — blocking logo replacement entirely.
--
-- Fix: add a permissive SELECT policy for all authenticated users on the
-- org-logos bucket. This is safe because the bucket is already public
-- (public=true), so the data is not sensitive.
CREATE POLICY "org_logos_authenticated_read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'org-logos');
