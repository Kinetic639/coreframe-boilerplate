-- =============================================================================
-- Notifications (bell) N0 + N1. Plan: docs/NOTIFICATIONS_PLAN.md
--
-- A notification is a row for one recipient about one object (ticket, task,
-- repair order). Only the recipient reads it (RLS); nobody inserts from the
-- client — rows are created by triggers on the domain tables through
-- _notify(), so the portal, imports and server actions all produce them.
-- The row stores the object's number and title as they were at that moment;
-- the sentence shown to the user is composed in the app from `type` and the
-- actor (i18n). Recipients are always participants of the object (assignee,
-- requester, author, advisor), i.e. people who can open it.
-- Realtime: private broadcast "user:<uid>:notifications" sent by a trigger.
-- Chat messages never create notifications (separate module).
-- =============================================================================

CREATE TABLE public.notifications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id        uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  recipient_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  actor_id         uuid REFERENCES public.users(id) ON DELETE SET NULL,
  type             text NOT NULL,
  target_type      text NOT NULL,
  target_id        uuid NOT NULL,
  target_code      text,
  title            text NOT NULL DEFAULT '',
  snippet          text,
  data             jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key       text,
  created_at       timestamptz NOT NULL DEFAULT clock_timestamp(),
  read_at          timestamptz
);

CREATE INDEX notifications_recipient_created_idx
  ON public.notifications (recipient_id, organization_id, created_at DESC, id DESC);
CREATE INDEX notifications_recipient_unread_idx
  ON public.notifications (recipient_id, organization_id)
  WHERE read_at IS NULL;
CREATE UNIQUE INDEX notifications_dedupe_unique
  ON public.notifications (recipient_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.notifications FROM anon, authenticated;
GRANT SELECT ON public.notifications TO authenticated;

CREATE POLICY notifications_select_recipient
  ON public.notifications FOR SELECT TO authenticated
  USING (recipient_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- Creating a notification (internal; called by the triggers below)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._notify(
  p_org uuid, p_branch uuid, p_recipient uuid, p_actor uuid, p_type text,
  p_target_type text, p_target_id uuid, p_target_code text,
  p_title text, p_snippet text DEFAULT NULL, p_data jsonb DEFAULT '{}'::jsonb,
  p_dedupe text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_settings jsonb;
BEGIN
  -- Nobody is notified about their own action
  IF p_recipient IS NULL OR p_recipient IS NOT DISTINCT FROM p_actor THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = p_org AND om.user_id = p_recipient
      AND om.status = 'active' AND om.deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  -- User preferences: in-app notifications off, or this type switched off
  SELECT p.notification_settings -> 'inApp' INTO v_settings
  FROM public.user_preferences p WHERE p.user_id = p_recipient AND p.deleted_at IS NULL;
  IF v_settings IS NOT NULL AND (
       v_settings ->> 'enabled' = 'false'
       OR coalesce(v_settings -> 'disabledTypes', '[]'::jsonb) ? p_type
     ) THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (
    organization_id, branch_id, recipient_id, actor_id, type,
    target_type, target_id, target_code, title, snippet, data, dedupe_key
  )
  VALUES (
    p_org, p_branch, p_recipient, p_actor, p_type,
    p_target_type, p_target_id, p_target_code,
    left(coalesce(p_title, ''), 300), left(p_snippet, 300), coalesce(p_data, '{}'::jsonb), p_dedupe
  )
  ON CONFLICT (recipient_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public._notify(uuid, uuid, uuid, uuid, text, text, uuid, text, text, text, jsonb, text)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: a new notification goes to its recipient's private channel
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._notifications_broadcast()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  PERFORM realtime.send(
    jsonb_build_object(
      'id', NEW.id, 'organization_id', NEW.organization_id, 'type', NEW.type,
      'target_type', NEW.target_type, 'target_id', NEW.target_id,
      'target_code', NEW.target_code, 'title', NEW.title, 'snippet', NEW.snippet,
      'data', NEW.data, 'created_at', NEW.created_at, 'read_at', NEW.read_at,
      'actor', (SELECT jsonb_build_object('user_id', u.id, 'first_name', u.first_name,
                                          'last_name', u.last_name, 'email', u.email)
                FROM public.users u WHERE u.id = NEW.actor_id)
    ),
    'notification', 'user:' || NEW.recipient_id::text || ':notifications', true);
  RETURN NULL;
END;
$$;

CREATE TRIGGER notifications_broadcast
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public._notifications_broadcast();

REVOKE ALL ON FUNCTION public._notifications_broadcast() FROM PUBLIC, anon, authenticated;

CREATE POLICY "notifications channel: receive"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.messages.extension = 'broadcast'
    AND (SELECT realtime.topic()) = 'user:' || (SELECT auth.uid())::text || ':notifications'
  );

-- ---------------------------------------------------------------------------
-- Reading and marking (the recipient only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notifications_list(
  p_org       uuid,
  p_filter    text DEFAULT 'all',          -- 'all' | 'unread' | 'mentions' | 'assigned'
  p_limit     integer DEFAULT 30,
  p_before    timestamptz DEFAULT NULL,
  p_before_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT coalesce(jsonb_agg(page.item), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'id', n.id, 'organization_id', n.organization_id, 'type', n.type,
      'target_type', n.target_type, 'target_id', n.target_id, 'target_code', n.target_code,
      'title', n.title, 'snippet', n.snippet, 'data', n.data,
      'created_at', n.created_at, 'read_at', n.read_at,
      'actor', CASE WHEN u.id IS NULL THEN NULL ELSE jsonb_build_object(
        'user_id', u.id, 'first_name', u.first_name, 'last_name', u.last_name, 'email', u.email) END
    ) AS item
    FROM public.notifications n
    LEFT JOIN public.users u ON u.id = n.actor_id
    WHERE n.recipient_id = auth.uid()
      AND n.organization_id = p_org
      AND (
        coalesce(p_filter, 'all') = 'all'
        OR (p_filter = 'unread' AND n.read_at IS NULL)
        OR (p_filter = 'mentions' AND n.type = 'mention')
        OR (p_filter = 'assigned' AND n.type IN ('ticket.new', 'ticket.assigned', 'task.assigned'))
      )
      AND (p_before IS NULL OR (n.created_at, n.id) < (p_before, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
    ORDER BY n.created_at DESC, n.id DESC
    LIMIT least(greatest(coalesce(p_limit, 30), 1), 100)
  ) page;
$$;

CREATE OR REPLACE FUNCTION public.notifications_unread_count(p_org uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT count(*)::int FROM (
    SELECT 1 FROM public.notifications n
    WHERE n.recipient_id = auth.uid() AND n.organization_id = p_org AND n.read_at IS NULL
    LIMIT 100
  ) x;
$$;

-- Read / unread toggle for chosen notifications
CREATE OR REPLACE FUNCTION public.notifications_set_read(p_ids uuid[], p_read boolean DEFAULT true)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.notifications n
  SET read_at = CASE WHEN p_read THEN coalesce(n.read_at, clock_timestamp()) ELSE NULL END
  WHERE n.recipient_id = auth.uid()
    AND n.id = ANY (coalesce(p_ids, '{}'))
    AND (n.read_at IS NULL) = p_read;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.notifications_mark_all_read(p_org uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.notifications n
  SET read_at = clock_timestamp()
  WHERE n.recipient_id = auth.uid() AND n.organization_id = p_org AND n.read_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.notifications_list(uuid, text, integer, timestamptz, uuid)',
    'public.notifications_unread_count(uuid)',
    'public.notifications_set_read(uuid[], boolean)',
    'public.notifications_mark_all_read(uuid)'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- N1 sources
-- ---------------------------------------------------------------------------

-- Help Desk: someone was assigned to a ticket (at creation: "new ticket for you")
CREATE OR REPLACE FUNCTION public._notify_ticket_assignee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  t public.helpdesk_tickets;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO t FROM public.helpdesk_tickets WHERE id = NEW.ticket_id;
  IF NOT FOUND OR t.deleted_at IS NOT NULL THEN
    RETURN NULL;
  END IF;

  PERFORM public._notify(
    t.org_id, t.branch_id, NEW.user_id,
    coalesce(auth.uid(), NEW.assigned_by, t.created_by),
    -- Assigned in the transaction that created the ticket = a new ticket for this person
    CASE WHEN t.created_at >= now() THEN 'ticket.new' ELSE 'ticket.assigned' END,
    'helpdesk.ticket', t.id, t.ticket_number, t.title, NULL,
    jsonb_build_object('role', NEW.role)
  );
  RETURN NULL;
END;
$$;

CREATE TRIGGER helpdesk_ticket_assignees_notify
  AFTER INSERT ON public.helpdesk_ticket_assignees
  FOR EACH ROW EXECUTE FUNCTION public._notify_ticket_assignee();

-- Help Desk: status changes go to the requester and the assignees
CREATE OR REPLACE FUNCTION public._notify_ticket_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  t public.helpdesk_tickets;
  r record;
BEGIN
  SELECT * INTO t FROM public.helpdesk_tickets WHERE id = NEW.ticket_id;
  IF NOT FOUND OR t.deleted_at IS NOT NULL THEN
    RETURN NULL;
  END IF;

  FOR r IN
    SELECT DISTINCT x.user_id FROM (
      SELECT t.created_by AS user_id
      UNION ALL SELECT t.requested_by
      UNION ALL SELECT a.user_id FROM public.helpdesk_ticket_assignees a
                WHERE a.ticket_id = t.id AND a.deleted_at IS NULL
    ) x WHERE x.user_id IS NOT NULL
  LOOP
    PERFORM public._notify(
      t.org_id, t.branch_id, r.user_id, coalesce(NEW.actor_id, auth.uid()),
      'ticket.status', 'helpdesk.ticket', t.id, t.ticket_number, t.title, NULL,
      jsonb_build_object('event', NEW.event_type, 'status', t.status)
    );
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER helpdesk_ticket_activity_notify
  AFTER INSERT ON public.helpdesk_ticket_activity
  FOR EACH ROW
  WHEN (NEW.event_type IN ('status_changed', 'ticket_closed', 'ticket_accepted'))
  EXECUTE FUNCTION public._notify_ticket_activity();

-- Comments on tickets, tasks and repair orders go to the object's participants
CREATE OR REPLACE FUNCTION public._notify_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_branch uuid;
  v_code   text;
  v_title  text;
  v_snippet text := nullif(left(btrim(coalesce(NEW.body_plain, '')), 200), '');
  r record;
BEGIN
  IF NEW.target_type = 'helpdesk.ticket' THEN
    SELECT t.branch_id, t.ticket_number, t.title INTO v_branch, v_code, v_title
    FROM public.helpdesk_tickets t WHERE t.id = NEW.target_id AND t.deleted_at IS NULL;
    IF NOT FOUND THEN RETURN NULL; END IF;
    FOR r IN
      SELECT DISTINCT x.user_id FROM (
        -- Internal comments stay with the people handling the ticket
        SELECT t.created_by AS user_id FROM public.helpdesk_tickets t
          WHERE t.id = NEW.target_id AND NEW.visibility = 'default'
        UNION ALL SELECT t.requested_by FROM public.helpdesk_tickets t
          WHERE t.id = NEW.target_id AND NEW.visibility = 'default'
        UNION ALL SELECT a.user_id FROM public.helpdesk_ticket_assignees a
          WHERE a.ticket_id = NEW.target_id AND a.deleted_at IS NULL
      ) x WHERE x.user_id IS NOT NULL
    LOOP
      PERFORM public._notify(NEW.org_id, v_branch, r.user_id, NEW.created_by, 'comment',
        NEW.target_type, NEW.target_id, v_code, v_title, v_snippet,
        jsonb_build_object('comment_id', NEW.id, 'visibility', NEW.visibility));
    END LOOP;

  ELSIF NEW.target_type = 'planning.task' THEN
    SELECT t.branch_id, t.task_number, t.title INTO v_branch, v_code, v_title
    FROM public.planning_tasks t WHERE t.id = NEW.target_id AND t.deleted_at IS NULL;
    IF NOT FOUND THEN RETURN NULL; END IF;
    FOR r IN
      SELECT DISTINCT x.user_id FROM (
        SELECT t.assigned_to AS user_id FROM public.planning_tasks t WHERE t.id = NEW.target_id
        UNION ALL SELECT t.created_by FROM public.planning_tasks t WHERE t.id = NEW.target_id
      ) x WHERE x.user_id IS NOT NULL
    LOOP
      PERFORM public._notify(NEW.org_id, v_branch, r.user_id, NEW.created_by, 'comment',
        NEW.target_type, NEW.target_id, v_code, v_title, v_snippet,
        jsonb_build_object('comment_id', NEW.id, 'visibility', NEW.visibility));
    END LOOP;

  ELSIF NEW.target_type = 'workshop.repair_order' THEN
    SELECT o.branch_id, o.zl_number, coalesce(nullif(o.client_name, ''), o.vehicle_brand, '')
      INTO v_branch, v_code, v_title
    FROM public.repair_orders o WHERE o.id = NEW.target_id AND o.deleted_at IS NULL;
    IF NOT FOUND THEN RETURN NULL; END IF;
    -- The order's advisor (a contact linked to a user)
    FOR r IN
      SELECT c.linked_user_id AS user_id
      FROM public.repair_orders o
      JOIN public.crm_contacts c ON c.id = o.advisor_contact_id AND c.deleted_at IS NULL
      WHERE o.id = NEW.target_id AND c.linked_user_id IS NOT NULL
    LOOP
      PERFORM public._notify(NEW.org_id, v_branch, r.user_id, NEW.created_by, 'comment',
        NEW.target_type, NEW.target_id, v_code, v_title, v_snippet,
        jsonb_build_object('comment_id', NEW.id, 'visibility', NEW.visibility));
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER app_comments_notify
  AFTER INSERT ON public.app_comments
  FOR EACH ROW
  WHEN (NEW.kind = 'comment' AND NEW.deleted_at IS NULL)
  EXECUTE FUNCTION public._notify_comment();

-- Planning: task assigned / reassigned, status changed
CREATE OR REPLACE FUNCTION public._notify_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_actor uuid := coalesce(auth.uid(), NEW.updated_by, NEW.created_by);
  r record;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NULL;
  END IF;

  IF NEW.assigned_to IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to) THEN
    PERFORM public._notify(NEW.organization_id, NEW.branch_id, NEW.assigned_to, v_actor,
      'task.assigned', 'planning.task', NEW.id, NEW.task_number, NEW.title);
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    FOR r IN
      SELECT DISTINCT x.user_id FROM (
        SELECT NEW.created_by AS user_id UNION ALL SELECT NEW.assigned_to
      ) x WHERE x.user_id IS NOT NULL
    LOOP
      PERFORM public._notify(NEW.organization_id, NEW.branch_id, r.user_id, v_actor,
        'task.status', 'planning.task', NEW.id, NEW.task_number, NEW.title, NULL,
        jsonb_build_object('status', NEW.status));
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER planning_tasks_notify
  AFTER INSERT OR UPDATE OF assigned_to, status ON public.planning_tasks
  FOR EACH ROW EXECUTE FUNCTION public._notify_task();

REVOKE ALL ON FUNCTION public._notify_ticket_assignee() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._notify_ticket_activity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._notify_comment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._notify_task() FROM PUBLIC, anon, authenticated;
