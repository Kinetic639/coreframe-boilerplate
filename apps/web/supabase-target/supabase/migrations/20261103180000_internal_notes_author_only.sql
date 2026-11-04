-- ============================================================================
-- Internal notes are private to their author
-- ============================================================================
-- An internal note (app_comments.visibility = 'internal' on help-desk
-- tickets, tasks, kanban cards and repair orders; an internal message on a
-- platform report) is seen only by the person who wrote it -- not by the
-- requester, not by managers, not by other admins. It notifies nobody: no
-- "comment" notification, no @mention notification.
--
-- Search ("C" candidates read back through RLS) and "Powiązania"
-- (object_mentions, invoker) read comments through the same policies, so
-- they follow.
-- ============================================================================

ALTER POLICY app_comments_select ON public.app_comments
  USING (
    deleted_at IS NULL
    AND (visibility <> 'internal' OR created_by = (SELECT auth.uid()))
    AND can_access_comment_target(org_id, target_type, target_id, 'select', visibility)
  );

ALTER POLICY app_comments_update ON public.app_comments
  USING (
    deleted_at IS NULL
    AND (visibility <> 'internal' OR created_by = (SELECT auth.uid()))
    AND can_access_comment_target(org_id, target_type, target_id, 'select', visibility)
    AND (created_by = (SELECT auth.uid())
         OR can_access_comment_target(org_id, target_type, target_id, 'moderate', visibility))
  )
  WITH CHECK (
    (visibility <> 'internal' OR created_by = (SELECT auth.uid()))
    AND can_access_comment_target(org_id, target_type, target_id, 'select', visibility)
    AND (created_by = (SELECT auth.uid())
         OR can_access_comment_target(org_id, target_type, target_id, 'moderate', visibility))
  );

ALTER POLICY app_comments_delete ON public.app_comments
  USING (
    (visibility <> 'internal' OR created_by = (SELECT auth.uid()))
    AND can_access_comment_target(org_id, target_type, target_id, 'select', visibility)
    AND (created_by = (SELECT auth.uid())
         OR can_access_comment_target(org_id, target_type, target_id, 'moderate', visibility))
  );

-- Notifications: an internal note tells nobody.
DO $do$
DECLARE
  v_def text;
  v_new text;
BEGIN
  v_def := pg_get_functiondef('public._notify_comment()'::regprocedure);
  IF position('Internal notes are private' IN v_def) = 0 THEN
    v_new := replace(v_def,
      $a$BEGIN
  IF NEW.target_type = 'helpdesk.ticket' THEN$a$,
      $b$BEGIN
  -- Internal notes are private to their author: nobody is notified
  IF NEW.visibility = 'internal' THEN
    RETURN NULL;
  END IF;

  IF NEW.target_type = 'helpdesk.ticket' THEN$b$);
    IF v_new = v_def THEN RAISE EXCEPTION '_notify_comment patch did not apply'; END IF;
    EXECUTE v_new;
  END IF;

  v_def := pg_get_functiondef('public._notify_comment_mentions()'::regprocedure);
  IF position('Internal notes are private' IN v_def) = 0 THEN
    v_new := replace(v_def,
      $a$  IF NEW.body_rich IS NULL OR jsonb_typeof(NEW.body_rich) <> 'object' THEN$a$,
      $b$  -- Internal notes are private to their author: a mention notifies nobody
  IF NEW.visibility = 'internal' THEN
    RETURN NULL;
  END IF;

  IF NEW.body_rich IS NULL OR jsonb_typeof(NEW.body_rich) <> 'object' THEN$b$);
    IF v_new = v_def THEN RAISE EXCEPTION '_notify_comment_mentions patch did not apply'; END IF;
    EXECUTE v_new;
  END IF;
END
$do$;

-- Platform reports: an internal message is the author's own as well.
ALTER POLICY platform_feedback_messages_select ON public.platform_feedback_messages
  USING (
    public.can_access_platform_feedback(feedback_id)
    AND (NOT is_internal OR author_id = (SELECT auth.uid()))
  );

ALTER POLICY platform_feedback_attachments_select ON public.platform_feedback_attachments
  USING (
    public.can_access_platform_feedback(feedback_id)
    AND (
      message_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM public.platform_feedback_messages m
                     WHERE m.id = message_id AND m.is_internal
                       AND m.author_id IS DISTINCT FROM (SELECT auth.uid()))
    )
  );

ALTER POLICY platform_feedback_storage_select ON storage.objects
  USING (
    bucket_id = 'platform-feedback'
    AND EXISTS (
      SELECT 1 FROM public.platform_feedback_attachments a
      LEFT JOIN public.platform_feedback_messages m ON m.id = a.message_id
      WHERE a.storage_path = objects.name
        AND public.can_access_platform_feedback(a.feedback_id)
        AND (m.id IS NULL OR NOT m.is_internal OR m.author_id = (SELECT auth.uid()))
    )
  );

DO $do$
DECLARE
  v_def text;
  v_new text;
BEGIN
  v_def := pg_get_functiondef('public.platform_feedback_get(uuid)'::regprocedure);
  v_new := replace(v_def,
    $a$      WHERE m.feedback_id = v_fb.id AND (v_admin OR NOT m.is_internal)$a$,
    $b$      WHERE m.feedback_id = v_fb.id AND (NOT m.is_internal OR m.author_id = (SELECT auth.uid()))$b$);
  v_new := replace(v_new,
    $a$      WHERE a.feedback_id = v_fb.id AND (v_admin OR m.id IS NULL OR NOT m.is_internal)$a$,
    $b$      WHERE a.feedback_id = v_fb.id
        AND (m.id IS NULL OR NOT m.is_internal OR m.author_id = (SELECT auth.uid()))$b$);
  IF v_new <> v_def THEN
    EXECUTE v_new;
  ELSIF position('m.author_id = (SELECT auth.uid())' IN v_def) = 0 THEN
    RAISE EXCEPTION 'platform_feedback_get patch did not apply';
  END IF;

  v_def := pg_get_functiondef(
    'public.platform_feedback_list(text,text,text[],text,text,integer,integer)'::regprocedure);
  v_new := replace(v_def,
    $a$WHERE m.feedback_id = b.id AND (v_all OR NOT m.is_internal)$a$,
    $b$WHERE m.feedback_id = b.id AND (NOT m.is_internal OR m.author_id = v_uid)$b$);
  IF v_new <> v_def THEN
    EXECUTE v_new;
  ELSIF position('m.author_id = v_uid' IN v_def) = 0 THEN
    RAISE EXCEPTION 'platform_feedback_list patch did not apply';
  END IF;
END
$do$;
