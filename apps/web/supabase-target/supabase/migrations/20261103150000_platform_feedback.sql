-- ============================================================================
-- Platform feedback: bug reports, problems and ideas from every organization
-- ============================================================================
-- Any signed-in user reports from inside Ambra (with the page, organization,
-- branch and browser it happened in), follows their own reports and answers
-- in the thread. The platform admin (admin_entitlements.enabled) sees all
-- reports of all organizations in /admin, answers, adds internal notes, sets
-- status and priority. Screenshots and files go to the private bucket
-- "platform-feedback" under <report id>/.
--
-- Reads go through RLS (the reporter sees only their own report and its
-- non-internal messages; the admin sees everything). Writes go through the
-- SECURITY DEFINER functions below only.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_platform_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_entitlements
    WHERE user_id = (SELECT auth.uid()) AND enabled
  );
$function$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

CREATE SEQUENCE IF NOT EXISTS public.platform_feedback_number_seq;

CREATE TABLE IF NOT EXISTS public.platform_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number bigint NOT NULL DEFAULT nextval('public.platform_feedback_number_seq') UNIQUE,
  kind text NOT NULL CHECK (kind IN ('bug', 'problem', 'idea')),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  body_plain text NOT NULL DEFAULT '',
  body_rich jsonb,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'rejected')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  reporter_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
ALTER SEQUENCE public.platform_feedback_number_seq OWNED BY public.platform_feedback.number;

CREATE INDEX IF NOT EXISTS platform_feedback_reporter_idx ON public.platform_feedback (reporter_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS platform_feedback_status_idx ON public.platform_feedback (status, last_activity_at DESC);

CREATE TABLE IF NOT EXISTS public.platform_feedback_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES public.platform_feedback(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  body_plain text NOT NULL DEFAULT '',
  body_rich jsonb,
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_feedback_messages_feedback_idx
  ON public.platform_feedback_messages (feedback_id, created_at);

CREATE TABLE IF NOT EXISTS public.platform_feedback_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES public.platform_feedback(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.platform_feedback_messages(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  content_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_feedback_attachments_feedback_idx
  ON public.platform_feedback_attachments (feedback_id, created_at);

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_platform_feedback(p_feedback_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.is_platform_admin()
      OR EXISTS (
        SELECT 1 FROM public.platform_feedback f
        WHERE f.id = p_feedback_id AND f.reporter_id = (SELECT auth.uid())
      );
$function$;

REVOKE ALL ON FUNCTION public.can_access_platform_feedback(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_platform_feedback(uuid) TO authenticated;

ALTER TABLE public.platform_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_feedback FORCE ROW LEVEL SECURITY;
ALTER TABLE public.platform_feedback_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_feedback_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.platform_feedback_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_feedback_attachments FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.platform_feedback, public.platform_feedback_messages,
  public.platform_feedback_attachments FROM anon, authenticated;
GRANT SELECT ON public.platform_feedback, public.platform_feedback_messages,
  public.platform_feedback_attachments TO authenticated;

CREATE POLICY platform_feedback_select ON public.platform_feedback
  FOR SELECT TO authenticated
  USING (reporter_id = (SELECT auth.uid()) OR public.is_platform_admin());

CREATE POLICY platform_feedback_messages_select ON public.platform_feedback_messages
  FOR SELECT TO authenticated
  USING (public.can_access_platform_feedback(feedback_id)
         AND (NOT is_internal OR public.is_platform_admin()));

CREATE POLICY platform_feedback_attachments_select ON public.platform_feedback_attachments
  FOR SELECT TO authenticated
  USING (
    public.can_access_platform_feedback(feedback_id)
    AND (
      message_id IS NULL OR public.is_platform_admin()
      OR NOT EXISTS (SELECT 1 FROM public.platform_feedback_messages m
                     WHERE m.id = message_id AND m.is_internal)
    )
  );

-- ---------------------------------------------------------------------------
-- Files: private bucket, <report id>/<file> -- anyone with access to the
-- report may upload into its folder; reading needs the attachment row.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'platform-feedback', 'platform-feedback', false, 26214400,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain',
        'text/csv', 'application/json', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY platform_feedback_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'platform-feedback'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.can_access_platform_feedback(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY platform_feedback_storage_select ON storage.objects
  FOR SELECT TO authenticated
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

-- ---------------------------------------------------------------------------
-- Writes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_feedback_create(
  p_kind text,
  p_title text,
  p_body_plain text,
  p_body_rich jsonb,
  p_organization_id uuid,
  p_branch_id uuid,
  p_context jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_org uuid;
  v_branch uuid;
  v_row public.platform_feedback%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Context is kept only where the reporter actually belongs.
  IF p_organization_id IS NOT NULL AND public.is_org_member(p_organization_id) THEN
    v_org := p_organization_id;
    SELECT id INTO v_branch FROM public.branches
    WHERE id = p_branch_id AND organization_id = v_org AND deleted_at IS NULL;
  END IF;

  INSERT INTO public.platform_feedback (
    kind, title, body_plain, body_rich, reporter_id, organization_id, branch_id, context
  ) VALUES (
    p_kind, trim(p_title), left(COALESCE(p_body_plain, ''), 20000), p_body_rich, v_uid, v_org, v_branch,
    COALESCE(p_context, '{}'::jsonb)
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('id', v_row.id, 'number', v_row.number);
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_feedback_add_message(
  p_feedback_id uuid,
  p_body_plain text,
  p_body_rich jsonb,
  p_is_internal boolean DEFAULT false
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_admin boolean := public.is_platform_admin();
  v_fb public.platform_feedback%ROWTYPE;
  v_msg_id uuid;
BEGIN
  SELECT * INTO v_fb FROM public.platform_feedback WHERE id = p_feedback_id FOR UPDATE;
  IF NOT FOUND OR NOT (v_admin OR v_fb.reporter_id = v_uid) THEN
    RAISE EXCEPTION 'Report not found' USING ERRCODE = 'P0002';
  END IF;
  IF COALESCE(p_is_internal, false) AND NOT v_admin THEN
    RAISE EXCEPTION 'Only the platform admin adds internal notes' USING ERRCODE = '42501';
  END IF;
  IF length(trim(COALESCE(p_body_plain, ''))) = 0 THEN
    RAISE EXCEPTION 'The message is empty' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.platform_feedback_messages (feedback_id, author_id, body_plain, body_rich, is_internal)
  VALUES (p_feedback_id, v_uid, left(p_body_plain, 20000), p_body_rich, COALESCE(p_is_internal, false))
  RETURNING id INTO v_msg_id;

  UPDATE public.platform_feedback SET last_activity_at = now(), updated_at = now()
  WHERE id = p_feedback_id;

  -- The reporter hears about an answer (not about internal notes).
  IF NOT COALESCE(p_is_internal, false) AND v_fb.reporter_id IS DISTINCT FROM v_uid
     AND v_fb.organization_id IS NOT NULL THEN
    PERFORM public._notify(
      v_fb.organization_id, NULL, v_fb.reporter_id, v_uid, 'feedback.reply',
      'platform.feedback', v_fb.id, 'ZG-' || lpad(v_fb.number::text, 4, '0'),
      v_fb.title, left(p_body_plain, 200), '{}'::jsonb, NULL);
  END IF;

  RETURN jsonb_build_object('id', v_msg_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_feedback_update(
  p_feedback_id uuid,
  p_status text DEFAULT NULL,
  p_priority text DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_fb public.platform_feedback%ROWTYPE;
  v_status text;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Only the platform admin manages reports' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_fb FROM public.platform_feedback WHERE id = p_feedback_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found' USING ERRCODE = 'P0002';
  END IF;
  v_status := COALESCE(p_status, v_fb.status);

  UPDATE public.platform_feedback
  SET status = v_status,
      priority = COALESCE(p_priority, priority),
      resolved_at = CASE WHEN v_status IN ('resolved', 'rejected')
                         THEN COALESCE(resolved_at, now()) ELSE NULL END,
      updated_at = now(),
      last_activity_at = now()
  WHERE id = p_feedback_id;

  IF v_status IS DISTINCT FROM v_fb.status AND v_fb.organization_id IS NOT NULL THEN
    PERFORM public._notify(
      v_fb.organization_id, NULL, v_fb.reporter_id, v_uid, 'feedback.status',
      'platform.feedback', v_fb.id, 'ZG-' || lpad(v_fb.number::text, 4, '0'),
      v_fb.title, NULL, jsonb_build_object('status', v_status), NULL);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_feedback_add_attachment(
  p_feedback_id uuid,
  p_message_id uuid,
  p_storage_path text,
  p_file_name text,
  p_content_type text,
  p_size_bytes bigint
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.can_access_platform_feedback(p_feedback_id) THEN
    RAISE EXCEPTION 'Report not found' USING ERRCODE = 'P0002';
  END IF;
  IF split_part(p_storage_path, '/', 1) <> p_feedback_id::text THEN
    RAISE EXCEPTION 'The file is not in this report''s folder' USING ERRCODE = '22023';
  END IF;
  IF p_message_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.platform_feedback_messages
    WHERE id = p_message_id AND feedback_id = p_feedback_id AND author_id = (SELECT auth.uid())
  ) THEN
    RAISE EXCEPTION 'Message not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.platform_feedback_attachments (
    feedback_id, message_id, uploaded_by, storage_path, file_name, content_type, size_bytes
  ) VALUES (
    p_feedback_id, p_message_id, (SELECT auth.uid()), p_storage_path, left(p_file_name, 200),
    p_content_type, p_size_bytes
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Reads with names: reporter and organization (the admin is not a member of
-- the reporter's organization, so the plain tables would hide them).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_feedback_list(
  p_scope text,
  p_search text DEFAULT NULL,
  p_status text[] DEFAULT NULL,
  p_kind text DEFAULT NULL,
  p_priority text DEFAULT NULL,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_all boolean;
  v_rows jsonb;
  v_total bigint;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_scope = 'all' THEN
    IF NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'Only the platform admin sees all reports' USING ERRCODE = '42501';
    END IF;
    v_all := true;
  ELSE
    v_all := false;
  END IF;

  WITH base AS (
    SELECT f.*
    FROM public.platform_feedback f
    WHERE (v_all OR f.reporter_id = v_uid)
      AND (p_status IS NULL OR cardinality(p_status) = 0 OR f.status = ANY (p_status))
      AND (p_kind IS NULL OR f.kind = p_kind)
      AND (p_priority IS NULL OR f.priority = p_priority)
      AND (p_search IS NULL OR p_search = ''
           OR f.title ILIKE '%' || p_search || '%'
           OR f.body_plain ILIKE '%' || p_search || '%'
           OR ('ZG-' || lpad(f.number::text, 4, '0')) ILIKE '%' || p_search || '%')
  )
  SELECT
    (SELECT count(*) FROM base),
    COALESCE((
      SELECT jsonb_agg(row_json ORDER BY sort_at DESC)
      FROM (
        SELECT b.last_activity_at AS sort_at, jsonb_build_object(
          'id', b.id,
          'number', b.number,
          'code', 'ZG-' || lpad(b.number::text, 4, '0'),
          'kind', b.kind,
          'title', b.title,
          'status', b.status,
          'priority', b.priority,
          'created_at', b.created_at,
          'last_activity_at', b.last_activity_at,
          'reporter_name', NULLIF(trim(concat_ws(' ', u.first_name, u.last_name)), ''),
          'reporter_email', u.email,
          'organization_name', o.name,
          'message_count', (SELECT count(*) FROM public.platform_feedback_messages m
                            WHERE m.feedback_id = b.id AND (v_all OR NOT m.is_internal)),
          'attachment_count', (SELECT count(*) FROM public.platform_feedback_attachments a
                               WHERE a.feedback_id = b.id)
        ) AS row_json
        FROM base b
        LEFT JOIN public.users u ON u.id = b.reporter_id
        LEFT JOIN public.organizations o ON o.id = b.organization_id
        ORDER BY b.last_activity_at DESC
        LIMIT GREATEST(1, LEAST(p_limit, 500)) OFFSET GREATEST(0, p_offset)
      ) x
    ), '[]'::jsonb)
  INTO v_total, v_rows;

  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_feedback_get(p_feedback_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_admin boolean := public.is_platform_admin();
  v_fb public.platform_feedback%ROWTYPE;
BEGIN
  SELECT * INTO v_fb FROM public.platform_feedback WHERE id = p_feedback_id;
  IF NOT FOUND OR NOT (v_admin OR v_fb.reporter_id = (SELECT auth.uid())) THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_fb.id,
    'number', v_fb.number,
    'code', 'ZG-' || lpad(v_fb.number::text, 4, '0'),
    'kind', v_fb.kind,
    'title', v_fb.title,
    'body_rich', v_fb.body_rich,
    'body_plain', v_fb.body_plain,
    'status', v_fb.status,
    'priority', v_fb.priority,
    'created_at', v_fb.created_at,
    'resolved_at', v_fb.resolved_at,
    'context', CASE WHEN v_admin THEN v_fb.context ELSE '{}'::jsonb END,
    'reporter', (SELECT jsonb_build_object(
                   'id', u.id,
                   'name', NULLIF(trim(concat_ws(' ', u.first_name, u.last_name)), ''),
                   'email', u.email, 'avatar_url', u.avatar_url)
                 FROM public.users u WHERE u.id = v_fb.reporter_id),
    'organization_name', (SELECT name FROM public.organizations WHERE id = v_fb.organization_id),
    'branch_name', (SELECT name FROM public.branches WHERE id = v_fb.branch_id),
    'messages', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id,
        'body_rich', m.body_rich,
        'body_plain', m.body_plain,
        'is_internal', m.is_internal,
        'created_at', m.created_at,
        'author', (SELECT jsonb_build_object(
                     'id', u.id,
                     'name', NULLIF(trim(concat_ws(' ', u.first_name, u.last_name)), ''),
                     'email', u.email, 'avatar_url', u.avatar_url,
                     'is_admin', EXISTS (SELECT 1 FROM public.admin_entitlements e
                                         WHERE e.user_id = u.id AND e.enabled))
                   FROM public.users u WHERE u.id = m.author_id)
      ) ORDER BY m.created_at)
      FROM public.platform_feedback_messages m
      WHERE m.feedback_id = v_fb.id AND (v_admin OR NOT m.is_internal)
    ), '[]'::jsonb),
    'attachments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id,
        'message_id', a.message_id,
        'storage_path', a.storage_path,
        'file_name', a.file_name,
        'content_type', a.content_type,
        'size_bytes', a.size_bytes,
        'created_at', a.created_at
      ) ORDER BY a.created_at)
      FROM public.platform_feedback_attachments a
      LEFT JOIN public.platform_feedback_messages m ON m.id = a.message_id
      WHERE a.feedback_id = v_fb.id AND (v_admin OR m.id IS NULL OR NOT m.is_internal)
    ), '[]'::jsonb)
  );
END;
$function$;

REVOKE ALL ON FUNCTION
  public.platform_feedback_create(text, text, text, jsonb, uuid, uuid, jsonb),
  public.platform_feedback_add_message(uuid, text, jsonb, boolean),
  public.platform_feedback_update(uuid, text, text),
  public.platform_feedback_add_attachment(uuid, uuid, text, text, text, bigint),
  public.platform_feedback_list(text, text, text[], text, text, integer, integer),
  public.platform_feedback_get(uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.platform_feedback_create(text, text, text, jsonb, uuid, uuid, jsonb),
  public.platform_feedback_add_message(uuid, text, jsonb, boolean),
  public.platform_feedback_update(uuid, text, text),
  public.platform_feedback_add_attachment(uuid, uuid, text, text, text, bigint),
  public.platform_feedback_list(text, text, text[], text, text, integer, integer),
  public.platform_feedback_get(uuid)
TO authenticated;
