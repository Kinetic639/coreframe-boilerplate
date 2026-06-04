-- Generic app comments
--
-- Moves comments out of module-specific tables and into one tenant-scoped,
-- polymorphic comments table. Module-specific target authorization is enforced
-- by public.can_access_comment_target().

CREATE TABLE IF NOT EXISTS public.app_comments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  target_type       TEXT        NOT NULL,
  target_id         UUID        NOT NULL,
  body_plain        TEXT        NOT NULL CHECK (char_length(body_plain) BETWEEN 1 AND 10000),
  body_rich         JSONB,
  visibility        TEXT        NOT NULL DEFAULT 'default'
                                    CHECK (visibility IN ('default', 'internal')),
  kind              TEXT        NOT NULL DEFAULT 'comment'
                                    CHECK (kind IN ('comment', 'system')),
  parent_comment_id UUID        REFERENCES public.app_comments(id) ON DELETE SET NULL,
  metadata          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_by        UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_by        UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS app_comments_target_feed_idx
  ON public.app_comments (org_id, target_type, target_id, created_at, id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS app_comments_org_recent_idx
  ON public.app_comments (org_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS app_comments_author_recent_idx
  ON public.app_comments (created_by, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.app_comment_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  comment_id  UUID        REFERENCES public.app_comments(id) ON DELETE SET NULL,
  target_type TEXT        NOT NULL,
  target_id   UUID        NOT NULL,
  actor_id    UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  event_type  TEXT        NOT NULL,
  payload     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_comment_events_target_idx
  ON public.app_comment_events (org_id, target_type, target_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_app_comments_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS app_comments_updated_at ON public.app_comments;
CREATE TRIGGER app_comments_updated_at
  BEFORE UPDATE ON public.app_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_app_comments_updated_at();

CREATE OR REPLACE FUNCTION public.record_app_comment_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.app_comment_events (
      org_id,
      comment_id,
      target_type,
      target_id,
      actor_id,
      event_type,
      payload
    )
    VALUES (
      NEW.org_id,
      NEW.id,
      NEW.target_type,
      NEW.target_id,
      NEW.created_by,
      'comment.created',
      jsonb_build_object('visibility', NEW.visibility, 'kind', NEW.kind)
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.app_comment_events (
      org_id,
      comment_id,
      target_type,
      target_id,
      actor_id,
      event_type,
      payload
    )
    VALUES (
      NEW.org_id,
      NEW.id,
      NEW.target_type,
      NEW.target_id,
      COALESCE(NEW.updated_by, auth.uid()),
      CASE WHEN OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL
        THEN 'comment.deleted'
        ELSE 'comment.updated'
      END,
      jsonb_build_object('visibility', NEW.visibility, 'kind', NEW.kind)
    );
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_comment_target(
  p_org_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_action text,
  p_visibility text DEFAULT 'default'
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_manager boolean := false;
  v_can_access boolean := false;
BEGIN
  IF auth.uid() IS NULL OR p_org_id IS NULL OR p_target_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.is_org_member(p_org_id) THEN
    RETURN false;
  END IF;

  IF p_target_type = 'helpdesk.ticket' THEN
    v_is_manager := public.has_permission(p_org_id, 'helpdesk.tickets.manage');

    SELECT EXISTS (
      SELECT 1
      FROM public.helpdesk_tickets t
      WHERE t.id = p_target_id
        AND t.org_id = p_org_id
        AND t.deleted_at IS NULL
        AND public.has_permission(t.org_id, 'helpdesk.tickets.read')
        AND (
          t.created_by = auth.uid()
          OR v_is_manager
          OR EXISTS (
            SELECT 1
            FROM public.helpdesk_ticket_assignees a
            WHERE a.ticket_id = t.id
              AND a.user_id = auth.uid()
              AND a.deleted_at IS NULL
          )
        )
    )
    INTO v_can_access;

    IF NOT v_can_access THEN
      RETURN false;
    END IF;

    IF p_visibility = 'internal' AND NOT v_is_manager THEN
      RETURN false;
    END IF;

    IF p_action = 'moderate' THEN
      RETURN v_is_manager;
    END IF;

    RETURN p_action IN ('select', 'insert', 'update', 'delete');
  END IF;

  RETURN false;
END;
$$;

ALTER TABLE public.app_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_comment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_comments_select" ON public.app_comments;
CREATE POLICY "app_comments_select" ON public.app_comments
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.can_access_comment_target(org_id, target_type, target_id, 'select', visibility)
  );

DROP POLICY IF EXISTS "app_comments_insert" ON public.app_comments;
CREATE POLICY "app_comments_insert" ON public.app_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND deleted_at IS NULL
    AND public.can_access_comment_target(org_id, target_type, target_id, 'insert', visibility)
  );

DROP POLICY IF EXISTS "app_comments_update" ON public.app_comments;
CREATE POLICY "app_comments_update" ON public.app_comments
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND public.can_access_comment_target(org_id, target_type, target_id, 'select', visibility)
    AND (
      created_by = auth.uid()
      OR public.can_access_comment_target(org_id, target_type, target_id, 'moderate', visibility)
    )
  )
  WITH CHECK (
    public.can_access_comment_target(org_id, target_type, target_id, 'select', visibility)
    AND (
      created_by = auth.uid()
      OR public.can_access_comment_target(org_id, target_type, target_id, 'moderate', visibility)
    )
  );

DROP POLICY IF EXISTS "app_comments_delete" ON public.app_comments;
CREATE POLICY "app_comments_delete" ON public.app_comments
  FOR DELETE TO authenticated
  USING (
    public.can_access_comment_target(org_id, target_type, target_id, 'select', visibility)
    AND (
      created_by = auth.uid()
      OR public.can_access_comment_target(org_id, target_type, target_id, 'moderate', visibility)
    )
  );

DROP POLICY IF EXISTS "app_comment_events_select" ON public.app_comment_events;
CREATE POLICY "app_comment_events_select" ON public.app_comment_events
  FOR SELECT TO authenticated
  USING (
    public.can_access_comment_target(
      org_id,
      target_type,
      target_id,
      'select',
      COALESCE(payload->>'visibility', 'default')
    )
  );

INSERT INTO public.app_comments (
  id,
  org_id,
  target_type,
  target_id,
  body_plain,
  body_rich,
  visibility,
  kind,
  created_by,
  created_at,
  updated_at,
  deleted_at
)
SELECT
  c.id,
  c.org_id,
  'helpdesk.ticket',
  c.ticket_id,
  c.body,
  c.body_rich,
  CASE WHEN c.is_internal THEN 'internal' ELSE 'default' END,
  'comment',
  c.created_by,
  c.created_at,
  c.updated_at,
  c.deleted_at
FROM public.helpdesk_ticket_comments c
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS app_comments_audit_events ON public.app_comments;
CREATE TRIGGER app_comments_audit_events
  AFTER INSERT OR UPDATE ON public.app_comments
  FOR EACH ROW EXECUTE FUNCTION public.record_app_comment_event();

REVOKE ALL ON FUNCTION public.can_access_comment_target(uuid, text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_comment_target(uuid, text, uuid, text, text) TO authenticated;

COMMENT ON TABLE public.app_comments IS
  'Generic tenant-scoped comments table for any registered app target.';

COMMENT ON FUNCTION public.can_access_comment_target(uuid, text, uuid, text, text) IS
  'Central RLS helper for generic comment target authorization. Add supported target types here as modules opt in.';
