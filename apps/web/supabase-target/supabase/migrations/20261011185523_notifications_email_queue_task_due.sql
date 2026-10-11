-- =============================================================================
-- Notifications N3: e-mail delivery queue and task due reminders
-- =============================================================================
-- E-mail: the app (cron endpoint, service role) claims notifications that are
-- still unread 10 minutes after they were created and whose recipient wants
-- that type by e-mail (user_preferences.notification_settings.email), sends
-- them and reports back. Quiet hours hold a notification until they end; after
-- 36 hours it is no longer sent.
-- Reminders: notifications_task_due_run() notifies the assignee of every open
-- task due today (Europe/Warsaw); it acts only in the first hour after
-- midnight, so the scheduler may call it at both UTC hours that can be local
-- midnight (summer / winter time).
-- Scheduling (pg_cron) and retention live in docs/NOTIFICATIONS_CRON_SETUP.md,
-- run by hand in the SQL Editor. Additive only.
-- =============================================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS emailed_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_claimed_at timestamptz;

CREATE INDEX IF NOT EXISTS notifications_email_queue_idx
  ON public.notifications (created_at)
  WHERE read_at IS NULL AND emailed_at IS NULL;

-- Types sent by e-mail unless the user chose otherwise.
-- Keep in sync with DEFAULT_EMAIL_TYPES in apps/web/src/lib/notifications/settings.ts
CREATE OR REPLACE FUNCTION public._notification_email_default_types()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT '["ticket.new", "ticket.assigned", "task.assigned", "mention"]'::jsonb;
$$;

-- Is "now" inside the user's quiet hours? Hours are "HH:MM" in the stored time zone.
CREATE OR REPLACE FUNCTION public._notification_in_quiet_hours(p_settings jsonb)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_quiet jsonb := p_settings -> 'quietHours';
  v_start time;
  v_end   time;
  v_now   time;
BEGIN
  IF v_quiet IS NULL OR coalesce(v_quiet ->> 'enabled', 'false') <> 'true' THEN
    RETURN false;
  END IF;
  BEGIN
    v_start := (v_quiet ->> 'start')::time;
    v_end   := (v_quiet ->> 'end')::time;
    v_now   := (now() AT TIME ZONE coalesce(nullif(v_quiet ->> 'timezone', ''), 'Europe/Warsaw'))::time;
  EXCEPTION WHEN OTHERS THEN
    -- Unreadable hours or time zone: treat as no quiet hours
    RETURN false;
  END;
  IF v_start IS NULL OR v_end IS NULL OR v_start = v_end THEN
    RETURN false;
  END IF;
  IF v_start < v_end THEN
    RETURN v_now >= v_start AND v_now < v_end;
  END IF;
  -- Over midnight (22:00–07:00)
  RETURN v_now >= v_start OR v_now < v_end;
END;
$$;

CREATE OR REPLACE FUNCTION public.notifications_email_claim(p_limit integer DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH due AS (
    SELECT n.id
    FROM public.notifications n
    JOIN public.users u ON u.id = n.recipient_id AND u.deleted_at IS NULL
    LEFT JOIN public.user_preferences p ON p.user_id = n.recipient_id AND p.deleted_at IS NULL
    WHERE n.read_at IS NULL
      AND n.emailed_at IS NULL
      AND (n.email_claimed_at IS NULL OR n.email_claimed_at < now() - interval '30 minutes')
      AND n.created_at <= now() - interval '10 minutes'
      AND n.created_at > now() - interval '36 hours'
      AND nullif(btrim(u.email), '') IS NOT NULL
      AND coalesce(p.notification_settings -> 'email' ->> 'enabled', 'true') <> 'false'
      AND (CASE WHEN jsonb_typeof(p.notification_settings -> 'email' -> 'types') = 'array'
                THEN p.notification_settings -> 'email' -> 'types'
                ELSE public._notification_email_default_types() END) ? n.type
      AND NOT public._notification_in_quiet_hours(p.notification_settings)
    ORDER BY n.created_at
    LIMIT least(greatest(coalesce(p_limit, 200), 1), 500)
    FOR UPDATE OF n SKIP LOCKED
  ), claimed AS (
    UPDATE public.notifications n
    SET email_claimed_at = now()
    FROM due WHERE n.id = due.id
    RETURNING n.*
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'organization_id', c.organization_id,
    'organization_name', (SELECT o.name FROM public.organizations o WHERE o.id = c.organization_id),
    'type', c.type, 'target_type', c.target_type, 'target_id', c.target_id,
    'target_code', c.target_code, 'title', c.title, 'snippet', c.snippet,
    'data', c.data, 'created_at', c.created_at, 'read_at', c.read_at,
    'actor', (SELECT jsonb_build_object('user_id', a.id, 'first_name', a.first_name,
                                        'last_name', a.last_name, 'email', a.email)
              FROM public.users a WHERE a.id = c.actor_id),
    'recipient', (SELECT jsonb_build_object(
                    'user_id', u.id, 'email', u.email, 'first_name', u.first_name,
                    'locale', (SELECT p.locale FROM public.user_preferences p
                               WHERE p.user_id = u.id AND p.deleted_at IS NULL LIMIT 1))
                  FROM public.users u WHERE u.id = c.recipient_id)
  ) ORDER BY c.created_at), '[]'::jsonb)
  INTO v_result
  FROM claimed c;
  RETURN v_result;
END;
$$;

-- Result of a send: sent = never again; failed = free for the next run
CREATE OR REPLACE FUNCTION public.notifications_email_done(p_ids uuid[], p_sent boolean)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.notifications n
  SET emailed_at = CASE WHEN p_sent THEN now() ELSE n.emailed_at END,
      email_claimed_at = CASE WHEN p_sent THEN n.email_claimed_at ELSE NULL END
  WHERE n.id = ANY (p_ids) AND n.emailed_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notifications_email_claim(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notifications_email_done(uuid[], boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notifications_email_claim(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.notifications_email_done(uuid[], boolean) TO service_role;

-- Task due today: one reminder per task and day for its assignee
CREATE OR REPLACE FUNCTION public.notifications_task_due_run(p_force boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_local timestamp := now() AT TIME ZONE 'Europe/Warsaw';
  v_today date := (now() AT TIME ZONE 'Europe/Warsaw')::date;
  v_count integer := 0;
  r record;
BEGIN
  IF NOT coalesce(p_force, false) AND extract(hour FROM v_local) <> 0 THEN
    RETURN 0;
  END IF;
  FOR r IN
    SELECT t.id, t.organization_id, t.branch_id, t.assigned_to, t.task_number, t.title, t.due_at
    FROM public.planning_tasks t
    WHERE t.deleted_at IS NULL
      AND t.status IN ('open', 'in_progress')
      AND t.assigned_to IS NOT NULL
      AND coalesce(t.due_date, (t.due_at AT TIME ZONE 'Europe/Warsaw')::date) = v_today
  LOOP
    PERFORM public._notify(
      r.organization_id, r.branch_id, r.assigned_to, NULL, 'task.due',
      'planning.task', r.id, r.task_number, r.title, NULL,
      jsonb_build_object('due_at', r.due_at, 'due_date', v_today),
      'task-due:' || r.id::text || ':' || v_today::text);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notifications_task_due_run(boolean) FROM PUBLIC, anon, authenticated;
