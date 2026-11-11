-- Reading a feedback file needs access to its report (and, for a file on an
-- internal note, the platform admin) -- not only a recorded attachment row.
ALTER POLICY platform_feedback_storage_select ON storage.objects
  USING (
    bucket_id = 'platform-feedback'
    AND EXISTS (
      SELECT 1 FROM public.platform_feedback_attachments a
      LEFT JOIN public.platform_feedback_messages m ON m.id = a.message_id
      WHERE a.storage_path = objects.name
        AND public.can_access_platform_feedback(a.feedback_id)
        AND (m.id IS NULL OR NOT m.is_internal OR public.is_platform_admin())
    )
  );
