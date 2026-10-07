-- Soft delete of an app attachment.
-- A plain UPDATE ... SET deleted_at fails RLS: the SELECT policy requires deleted_at IS NULL
-- and Postgres checks the updated row against it, so no attachment could ever be removed
-- (0 deleted rows in production as of 2026-10-07). Same rules as app_attachments_update:
-- target readable and caller is the author or may moderate. Additive only.
CREATE OR REPLACE FUNCTION public.soft_delete_app_attachment(p_attachment_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  r public.app_attachments%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO r FROM public.app_attachments WHERE id = p_attachment_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF NOT public.can_access_comment_target(r.org_id, r.target_type, r.target_id, 'select', 'default')
     OR NOT (r.created_by = auth.uid()
             OR public.can_access_comment_target(r.org_id, r.target_type, r.target_id, 'moderate', 'default')) THEN
    RAISE EXCEPTION 'Not allowed to delete this attachment' USING ERRCODE = '42501';
  END IF;

  UPDATE public.app_attachments
  SET deleted_at = now(), deleted_by = auth.uid()
  WHERE id = p_attachment_id;

  RETURN r.storage_path;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_app_attachment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_app_attachment(uuid) TO authenticated;
