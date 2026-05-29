-- =============================================================================
-- Migration: helpdesk_schema_v2 — Default User-to-User Tickets
-- Date:      2026-05-26
-- =============================================================================
-- Scope:
--   1. Extend helpdesk_ticket_types (key, is_system, allows_manual_assignees,
--      default_priority, metadata)
--   2. Extend helpdesk_tickets (description_rich, description_plain, closed_by,
--      requested_by; update status constraint)
--   3. Extend helpdesk_ticket_comments (body_rich JSONB)
--   4. Create helpdesk_ticket_assignees (multi-user assignment join table)
--   5. Create helpdesk_ticket_type_default_responders
--   6. RLS: new tables + update ticket/comment/activity policies to enforce
--      creator-or-assignee-or-manager row visibility
--   7. helpdesk_create_ticket() atomic RPC (ticket + assignees + activity)
--   8. Seed system ticket types for all existing orgs
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PART 1: Extend helpdesk_ticket_types
-- ---------------------------------------------------------------------------
ALTER TABLE public.helpdesk_ticket_types
  ADD COLUMN IF NOT EXISTS key                    TEXT,
  ADD COLUMN IF NOT EXISTS is_system              BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allows_manual_assignees BOOLEAN    NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_priority       TEXT        NOT NULL DEFAULT 'medium'
    CHECK (default_priority IN ('low', 'medium', 'high', 'urgent')),
  ADD COLUMN IF NOT EXISTS metadata               JSONB;

-- Partial unique index: one system-key per org (NULL keys are allowed to
-- coexist, only non-NULL keys must be unique within the org)
CREATE UNIQUE INDEX IF NOT EXISTS helpdesk_ticket_types_org_key_idx
  ON public.helpdesk_ticket_types (org_id, key)
  WHERE key IS NOT NULL AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- PART 2: Extend helpdesk_tickets
-- ---------------------------------------------------------------------------
ALTER TABLE public.helpdesk_tickets
  ADD COLUMN IF NOT EXISTS description_rich  JSONB,
  ADD COLUMN IF NOT EXISTS description_plain TEXT,
  ADD COLUMN IF NOT EXISTS closed_by         UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requested_by      UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Drop old status check (auto-named by PostgreSQL) and recreate with new values.
DO $$
DECLARE
  v_cname TEXT;
BEGIN
  SELECT conname INTO v_cname
  FROM   pg_constraint
  WHERE  conrelid = 'public.helpdesk_tickets'::regclass
    AND  contype  = 'c'
    AND  pg_get_constraintdef(oid) ILIKE '%status%';
  IF v_cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.helpdesk_tickets DROP CONSTRAINT %I', v_cname);
  END IF;
END $$;

ALTER TABLE public.helpdesk_tickets
  ADD CONSTRAINT helpdesk_tickets_status_check
  CHECK (status IN (
    'open', 'in_progress', 'waiting', 'waiting_response',
    'resolved', 'closed', 'cancelled'
  ));

-- ---------------------------------------------------------------------------
-- PART 3: Extend helpdesk_ticket_comments
-- ---------------------------------------------------------------------------
ALTER TABLE public.helpdesk_ticket_comments
  ADD COLUMN IF NOT EXISTS body_rich JSONB;

-- ---------------------------------------------------------------------------
-- PART 4: helpdesk_ticket_assignees
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.helpdesk_ticket_assignees (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID        NOT NULL REFERENCES public.organizations(id)   ON DELETE CASCADE,
  ticket_id    UUID        NOT NULL REFERENCES public.helpdesk_tickets(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES public.users(id)           ON DELETE CASCADE,
  role         TEXT        NOT NULL DEFAULT 'responder'
               CHECK (role IN ('responder', 'watcher')),
  status       TEXT        NOT NULL DEFAULT 'assigned'
               CHECK (status IN ('assigned', 'responded', 'completed', 'removed')),
  assigned_by  UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  deleted_at   TIMESTAMPTZ,
  UNIQUE (ticket_id, user_id)
);

CREATE INDEX IF NOT EXISTS helpdesk_ticket_assignees_ticket_idx
  ON public.helpdesk_ticket_assignees (ticket_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS helpdesk_ticket_assignees_user_org_idx
  ON public.helpdesk_ticket_assignees (org_id, user_id)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- PART 5: helpdesk_ticket_type_default_responders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.helpdesk_ticket_type_default_responders (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID        NOT NULL REFERENCES public.organizations(id)          ON DELETE CASCADE,
  ticket_type_id    UUID        NOT NULL REFERENCES public.helpdesk_ticket_types(id)  ON DELETE CASCADE,
  responder_user_id UUID        NOT NULL REFERENCES public.users(id)                  ON DELETE CASCADE,
  created_by        UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (ticket_type_id, responder_user_id)
);

CREATE INDEX IF NOT EXISTS helpdesk_type_default_responders_type_idx
  ON public.helpdesk_ticket_type_default_responders (ticket_type_id)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- PART 6: RLS — new tables + updated ticket/comment/activity policies
-- ---------------------------------------------------------------------------
ALTER TABLE public.helpdesk_ticket_assignees              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helpdesk_ticket_type_default_responders ENABLE ROW LEVEL SECURITY;

-- ── helpdesk_ticket_assignees ─────────────────────────────────────────────
CREATE POLICY "helpdesk_ticket_assignees_select" ON public.helpdesk_ticket_assignees
  FOR SELECT TO authenticated
  USING (
    is_org_member(org_id)
    AND has_permission(org_id, 'helpdesk.tickets.read')
  );

CREATE POLICY "helpdesk_ticket_assignees_insert" ON public.helpdesk_ticket_assignees
  FOR INSERT TO authenticated
  WITH CHECK (
    is_org_member(org_id)
    AND (
      has_permission(org_id, 'helpdesk.tickets.create')
      OR has_permission(org_id, 'helpdesk.tickets.manage')
    )
  );

CREATE POLICY "helpdesk_ticket_assignees_update" ON public.helpdesk_ticket_assignees
  FOR UPDATE TO authenticated
  USING (
    is_org_member(org_id)
    AND has_permission(org_id, 'helpdesk.tickets.manage')
  );

CREATE POLICY "helpdesk_ticket_assignees_delete" ON public.helpdesk_ticket_assignees
  FOR DELETE TO authenticated
  USING (
    is_org_member(org_id)
    AND has_permission(org_id, 'helpdesk.tickets.manage')
  );

-- ── helpdesk_ticket_type_default_responders ───────────────────────────────
CREATE POLICY "helpdesk_type_default_responders_select"
  ON public.helpdesk_ticket_type_default_responders
  FOR SELECT TO authenticated
  USING (
    is_org_member(org_id)
    AND has_permission(org_id, 'helpdesk.read')
  );

CREATE POLICY "helpdesk_type_default_responders_insert"
  ON public.helpdesk_ticket_type_default_responders
  FOR INSERT TO authenticated
  WITH CHECK (
    is_org_member(org_id)
    AND has_permission(org_id, 'helpdesk.ticket-types.manage')
  );

CREATE POLICY "helpdesk_type_default_responders_delete"
  ON public.helpdesk_ticket_type_default_responders
  FOR DELETE TO authenticated
  USING (
    is_org_member(org_id)
    AND has_permission(org_id, 'helpdesk.ticket-types.manage')
  );

-- ── helpdesk_tickets SELECT — creator OR assignee OR manager ─────────────
DROP POLICY IF EXISTS "helpdesk_tickets_select" ON public.helpdesk_tickets;
CREATE POLICY "helpdesk_tickets_select" ON public.helpdesk_tickets
  FOR SELECT TO authenticated
  USING (
    is_org_member(org_id)
    AND has_permission(org_id, 'helpdesk.tickets.read')
    AND (
      created_by = auth.uid()
      OR has_permission(org_id, 'helpdesk.tickets.manage')
      OR EXISTS (
        SELECT 1 FROM public.helpdesk_ticket_assignees a
        WHERE a.ticket_id = id
          AND a.user_id   = auth.uid()
          AND a.deleted_at IS NULL
      )
    )
  );

-- ── helpdesk_ticket_comments SELECT — mirrors ticket visibility ───────────
DROP POLICY IF EXISTS "helpdesk_ticket_comments_select" ON public.helpdesk_ticket_comments;
CREATE POLICY "helpdesk_ticket_comments_select" ON public.helpdesk_ticket_comments
  FOR SELECT TO authenticated
  USING (
    is_org_member(org_id)
    AND has_permission(org_id, 'helpdesk.tickets.read')
    AND (NOT is_internal OR has_permission(org_id, 'helpdesk.tickets.manage'))
    AND EXISTS (
      SELECT 1 FROM public.helpdesk_tickets t
      WHERE t.id = ticket_id
        AND (
          t.created_by = auth.uid()
          OR has_permission(t.org_id, 'helpdesk.tickets.manage')
          OR EXISTS (
            SELECT 1 FROM public.helpdesk_ticket_assignees a
            WHERE a.ticket_id = t.id
              AND a.user_id   = auth.uid()
              AND a.deleted_at IS NULL
          )
        )
    )
  );

-- ── helpdesk_ticket_comments INSERT — ticket participant can comment ───────
DROP POLICY IF EXISTS "helpdesk_ticket_comments_insert" ON public.helpdesk_ticket_comments;
CREATE POLICY "helpdesk_ticket_comments_insert" ON public.helpdesk_ticket_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    is_org_member(org_id)
    AND has_permission(org_id, 'helpdesk.tickets.read')
    AND EXISTS (
      SELECT 1 FROM public.helpdesk_tickets t
      WHERE t.id     = ticket_id
        AND t.org_id = org_id
        AND (
          t.created_by = auth.uid()
          OR has_permission(t.org_id, 'helpdesk.tickets.manage')
          OR EXISTS (
            SELECT 1 FROM public.helpdesk_ticket_assignees a
            WHERE a.ticket_id = t.id
              AND a.user_id   = auth.uid()
              AND a.deleted_at IS NULL
          )
        )
    )
  );

-- ── helpdesk_ticket_activity SELECT — same ticket visibility ──────────────
DROP POLICY IF EXISTS "helpdesk_ticket_activity_select" ON public.helpdesk_ticket_activity;
CREATE POLICY "helpdesk_ticket_activity_select" ON public.helpdesk_ticket_activity
  FOR SELECT TO authenticated
  USING (
    is_org_member(org_id)
    AND has_permission(org_id, 'helpdesk.tickets.read')
    AND EXISTS (
      SELECT 1 FROM public.helpdesk_tickets t
      WHERE t.id = ticket_id
        AND (
          t.created_by = auth.uid()
          OR has_permission(t.org_id, 'helpdesk.tickets.manage')
          OR EXISTS (
            SELECT 1 FROM public.helpdesk_ticket_assignees a
            WHERE a.ticket_id = t.id
              AND a.user_id   = auth.uid()
              AND a.deleted_at IS NULL
          )
        )
    )
  );

DROP POLICY IF EXISTS "helpdesk_ticket_activity_insert" ON public.helpdesk_ticket_activity;
CREATE POLICY "helpdesk_ticket_activity_insert" ON public.helpdesk_ticket_activity
  FOR INSERT TO authenticated
  WITH CHECK (
    is_org_member(org_id)
    AND has_permission(org_id, 'helpdesk.tickets.read')
  );

-- ---------------------------------------------------------------------------
-- PART 7: helpdesk_create_ticket — atomic RPC (ticket + assignees + activity)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.helpdesk_create_ticket(
  p_org_id             UUID,
  p_title              TEXT,
  p_description_plain  TEXT,
  p_description_rich   JSONB,
  p_status             TEXT,
  p_priority           TEXT,
  p_ticket_type_id     UUID,
  p_branch_id          UUID,
  p_assignee_ids       UUID[],
  p_due_at             TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_id     UUID;
  v_ticket_number TEXT;
  v_prefix        TEXT := 'HD';
  v_seq_num       BIGINT;
  v_assignee_id   UUID;
BEGIN
  IF NOT (is_org_member(p_org_id) AND has_permission(p_org_id, 'helpdesk.tickets.create')) THEN
    RAISE EXCEPTION 'Unauthorized: cannot create ticket';
  END IF;

  -- Generate atomic ticket number from org settings (fallback HD)
  SELECT COALESCE(ticket_prefix, 'HD') INTO v_prefix
  FROM   public.helpdesk_settings
  WHERE  org_id = p_org_id;

  v_seq_num       := nextval('public.helpdesk_ticket_number_seq');
  v_ticket_number := COALESCE(v_prefix, 'HD') || '-' || LPAD(v_seq_num::TEXT, 6, '0');

  -- Insert ticket
  INSERT INTO public.helpdesk_tickets (
    org_id, ticket_number, title,
    description, description_plain, description_rich,
    status, priority, ticket_type_id, branch_id,
    created_by, requested_by, due_at
  ) VALUES (
    p_org_id, v_ticket_number, p_title,
    p_description_plain, p_description_plain, p_description_rich,
    p_status, p_priority, p_ticket_type_id, p_branch_id,
    auth.uid(), auth.uid(), p_due_at
  )
  RETURNING id INTO v_ticket_id;

  -- Insert assignees
  IF p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > 0 THEN
    FOREACH v_assignee_id IN ARRAY p_assignee_ids LOOP
      INSERT INTO public.helpdesk_ticket_assignees (
        org_id, ticket_id, user_id, role, status, assigned_by
      ) VALUES (
        p_org_id, v_ticket_id, v_assignee_id, 'responder', 'assigned', auth.uid()
      )
      ON CONFLICT (ticket_id, user_id) DO NOTHING;
    END LOOP;
  END IF;

  -- Insert initial activity
  INSERT INTO public.helpdesk_ticket_activity (
    ticket_id, org_id, actor_id, event_type, payload
  ) VALUES (
    v_ticket_id, p_org_id, auth.uid(), 'ticket_created',
    jsonb_build_object(
      'ticket_number', v_ticket_number,
      'title',         p_title,
      'status',        p_status,
      'priority',      p_priority,
      'assignee_count', COALESCE(array_length(p_assignee_ids, 1), 0)
    )
  );

  RETURN jsonb_build_object('id', v_ticket_id, 'ticket_number', v_ticket_number);
END;
$$;

-- ---------------------------------------------------------------------------
-- PART 8: Seed system ticket types for all existing orgs
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_org_id UUID;
BEGIN
  FOR v_org_id IN SELECT id FROM public.organizations WHERE deleted_at IS NULL LOOP

    INSERT INTO public.helpdesk_ticket_types
      (org_id, key, name, description, color, icon,
       is_system, allows_manual_assignees, default_priority, is_active, sort_order)
    VALUES
      (v_org_id, 'general_request', 'General Request',
       'Generic request between organisation members',
       '#6366f1', 'ticket', true, true, 'medium', true, 1)
    ON CONFLICT (org_id, name) DO UPDATE
      SET key                    = EXCLUDED.key,
          is_system              = EXCLUDED.is_system,
          allows_manual_assignees = EXCLUDED.allows_manual_assignees,
          default_priority       = EXCLUDED.default_priority;

    INSERT INTO public.helpdesk_ticket_types
      (org_id, key, name, description, color, icon,
       is_system, allows_manual_assignees, default_priority, is_active, sort_order)
    VALUES
      (v_org_id, 'question', 'Question',
       'Ask another organisation member a question',
       '#06b6d4', 'help-circle', true, true, 'medium', true, 2)
    ON CONFLICT (org_id, name) DO UPDATE
      SET key                    = EXCLUDED.key,
          is_system              = EXCLUDED.is_system,
          allows_manual_assignees = EXCLUDED.allows_manual_assignees,
          default_priority       = EXCLUDED.default_priority;

    INSERT INTO public.helpdesk_ticket_types
      (org_id, key, name, description, color, icon,
       is_system, allows_manual_assignees, default_priority, is_active, sort_order)
    VALUES
      (v_org_id, 'task_request', 'Task / Action Request',
       'Ask another organisation member to complete a task',
       '#f59e0b', 'clipboard-check', true, true, 'medium', true, 3)
    ON CONFLICT (org_id, name) DO UPDATE
      SET key                    = EXCLUDED.key,
          is_system              = EXCLUDED.is_system,
          allows_manual_assignees = EXCLUDED.allows_manual_assignees,
          default_priority       = EXCLUDED.default_priority;

  END LOOP;
END $$;
