-- Create org-logos public storage bucket for organization logo uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'org-logos',
  'org-logos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for org-logos bucket
DROP POLICY IF EXISTS "org_logos_public_read" ON storage.objects;
CREATE POLICY "org_logos_public_read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'org-logos');

DROP POLICY IF EXISTS "org_logos_upload" ON storage.objects;
CREATE POLICY "org_logos_upload"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'org-logos'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND is_org_member((storage.foldername(name))[1]::uuid)
    AND has_permission((storage.foldername(name))[1]::uuid, 'org.update')
  );

DROP POLICY IF EXISTS "org_logos_update" ON storage.objects;
CREATE POLICY "org_logos_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'org-logos'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND is_org_member((storage.foldername(name))[1]::uuid)
    AND has_permission((storage.foldername(name))[1]::uuid, 'org.update')
  );

DROP POLICY IF EXISTS "org_logos_delete" ON storage.objects;
CREATE POLICY "org_logos_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'org-logos'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND is_org_member((storage.foldername(name))[1]::uuid)
    AND has_permission((storage.foldername(name))[1]::uuid, 'org.update')
  );
