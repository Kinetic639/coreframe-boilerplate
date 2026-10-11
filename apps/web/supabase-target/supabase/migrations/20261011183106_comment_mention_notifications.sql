-- =============================================================================
-- Comments: a "@" mention of a person notifies them in the bell
-- =============================================================================
-- A comment's document (app_comments.body_rich) may carry mention nodes
-- { type: 'person', id }. The mentioned person is notified ("mention") when they
-- may read the comment's target — checked with the same function RLS uses
-- (can_access_comment_target), evaluated for that person, so nobody learns the
-- title of a ticket / task / order they cannot open. Internal ticket comments
-- reach only people who may read internal comments.
-- A person who is both mentioned and a participant gets one notification (the
-- mention): both triggers use the dedupe key 'comment:<id>' and the mention
-- trigger fires first (trigger names sort alphabetically).
-- Additive only: CREATE OR REPLACE and one new trigger.
-- =============================================================================

-- Would p_user be allowed to read comments of this target? Runs the RLS helper
-- as that user (transaction-local claims), then restores the caller's claims.
CREATE OR REPLACE FUNCTION public._user_can_read_comment_target(
  p_user uuid, p_org uuid, p_target_type text, p_target_id uuid, p_visibility text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_claims text := current_setting('request.jwt.claims', true);
  v_sub    text := current_setting('request.jwt.claim.sub', true);
  v_ok     boolean := false;
BEGIN
  IF p_user IS NULL THEN
    RETURN false;
  END IF;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  BEGIN
    v_ok := coalesce(public.can_access_comment_target(
      p_org, p_target_type, p_target_id, 'select', coalesce(p_visibility, 'default')), false);
  EXCEPTION WHEN OTHERS THEN
    v_ok := false;
  END;
  PERFORM set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);
  RETURN v_ok;
END;
$$;

REVOKE ALL ON FUNCTION public._user_can_read_comment_target(uuid, uuid, text, uuid, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._notify_comment_mentions()
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
  IF NEW.body_rich IS NULL OR jsonb_typeof(NEW.body_rich) <> 'object' THEN
    RETURN NULL;
  END IF;

  IF NEW.target_type = 'helpdesk.ticket' THEN
    SELECT t.branch_id, t.ticket_number, t.title INTO v_branch, v_code, v_title
    FROM public.helpdesk_tickets t WHERE t.id = NEW.target_id AND t.deleted_at IS NULL;
  ELSIF NEW.target_type = 'planning.task' THEN
    SELECT t.branch_id, t.task_number, t.title INTO v_branch, v_code, v_title
    FROM public.planning_tasks t WHERE t.id = NEW.target_id AND t.deleted_at IS NULL;
  ELSIF NEW.target_type = 'workshop.repair_order' THEN
    SELECT o.branch_id, o.zl_number, coalesce(nullif(o.client_name, ''), o.vehicle_brand, '')
      INTO v_branch, v_code, v_title
    FROM public.repair_orders o WHERE o.id = NEW.target_id AND o.deleted_at IS NULL;
  ELSE
    -- Other targets have no page a notification could open
    RETURN NULL;
  END IF;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  FOR r IN
    SELECT DISTINCT (m.node -> 'attrs' ->> 'id')::uuid AS user_id
    FROM jsonb_path_query(NEW.body_rich, 'strict $.** ? (@.type == "mention")') AS m(node)
    WHERE m.node -> 'attrs' ->> 'type' = 'person'
      AND (m.node -> 'attrs' ->> 'id')
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    LIMIT 50
  LOOP
    CONTINUE WHEN r.user_id IS NOT DISTINCT FROM NEW.created_by;
    CONTINUE WHEN NOT public._user_can_read_comment_target(
      r.user_id, NEW.org_id, NEW.target_type, NEW.target_id, NEW.visibility);
    PERFORM public._notify(NEW.org_id, v_branch, r.user_id, NEW.created_by, 'mention',
      NEW.target_type, NEW.target_id, v_code, v_title, v_snippet,
      jsonb_build_object('comment_id', NEW.id, 'visibility', NEW.visibility),
      'comment:' || NEW.id::text);
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public._notify_comment_mentions() FROM PUBLIC, anon, authenticated;

-- "app_comments_mention_notify" sorts before "app_comments_notify": mentions first
CREATE TRIGGER app_comments_mention_notify
  AFTER INSERT ON public.app_comments
  FOR EACH ROW
  WHEN (NEW.kind = 'comment' AND NEW.deleted_at IS NULL)
  EXECUTE FUNCTION public._notify_comment_mentions();

-- Same function as in 20261011054231_notifications.sql, now with the dedupe key
-- 'comment:<id>': one notification per person and comment (mention wins).
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
        jsonb_build_object('comment_id', NEW.id, 'visibility', NEW.visibility),
        'comment:' || NEW.id::text);
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
        jsonb_build_object('comment_id', NEW.id, 'visibility', NEW.visibility),
        'comment:' || NEW.id::text);
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
        jsonb_build_object('comment_id', NEW.id, 'visibility', NEW.visibility),
        'comment:' || NEW.id::text);
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public._notify_comment() FROM PUBLIC, anon, authenticated;
