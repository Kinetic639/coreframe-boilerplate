-- =============================================================================
-- Migration: helpdesk_module — Help Desk Module Foundation
-- Date:      2026-05-26
-- =============================================================================
-- Scope:
--   1. Help Desk permission rows
--   2. Role-permission seeding
--      - org_owner  → helpdesk.* wildcard only
--      - org_member → helpdesk.read + helpdesk.tickets.read + helpdesk.tickets.create
--   3. Subscription plan updates
--      - professional → add 'help-desk' to enabled_modules
--      - enterprise   → add 'help-desk' to enabled_modules
--   4. Sequence for atomic ticket number generation (HD-000001 format)
--   5. Core tables:
--      - helpdesk_ticket_types
--      - helpdesk_tickets
--      - helpdesk_ticket_references
--      - helpdesk_ticket_comments
--      - helpdesk_ticket_activity
--      - helpdesk_settings
--   6. RLS policies on all tables
--
-- Note on wildcard seeding:
--   org_owner must NOT receive both helpdesk.* AND granular helpdesk.* slugs.
--   The compile_user_permissions function expands wildcards at runtime.
--   org_owner gets helpdesk.* only; compiler expands at runtime.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PART 1: Permission rows
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions (slug, name, category, action)
VALUES
  ('helpdesk.*',                   'Help Desk Wildcard',              'helpdesk',  '*'),
  ('helpdesk.read',                'Help Desk Read',                  'helpdesk',  'read'),
  ('helpdesk.manage',              'Help Desk Manage',                'helpdesk',  'manage'),
  ('helpdesk.tickets.read',        'Help Desk Tickets Read',          'helpdesk',  'read'),
  ('helpdesk.tickets.create',      'Help Desk Tickets Create',        'helpdesk',  'create'),
  ('helpdesk.tickets.manage',      'Help Desk Tickets Manage',        'helpdesk',  'manage'),
  ('helpdesk.ticket-types.manage', 'Help Desk Ticket Types Manage',   'helpdesk',  'manage'),
  ('helpdesk.settings.manage',     'Help Desk Settings Manage',       'helpdesk',  'manage'),
  ('module.helpdesk.access',       'Help Desk Module Access',         'module',    'access')
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- PART 2: Role-permission seeding
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_owner_id   UUID;
  v_member_id  UUID;
  v_perm_id    UUID;
BEGIN
  SELECT id INTO v_owner_id  FROM public.roles WHERE name = 'org_owner'  AND is_basic = true LIMIT 1;
  SELECT id INTO v_member_id FROM public.roles WHERE name = 'org_member' AND is_basic = true LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'org_owner basic role not found';
  END IF;
  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'org_member basic role not found';
  END IF;

  -- org_owner: helpdesk.* wildcard only (compiler expands at runtime)
  SELECT id INTO v_perm_id FROM public.permissions WHERE slug = 'helpdesk.*';
  IF v_perm_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    VALUES (v_owner_id, v_perm_id) ON CONFLICT DO NOTHING;
  END IF;

  -- org_owner already has module.* wildcard → covers module.helpdesk.access.
  -- No explicit module.helpdesk.access grant needed for org_owner.

  -- org_member: read + create tickets (Help Desk is collaborative)
  FOREACH v_perm_id IN ARRAY ARRAY(
    SELECT id FROM public.permissions
    WHERE slug IN ('helpdesk.read', 'helpdesk.tickets.read', 'helpdesk.tickets.create', 'module.helpdesk.access')
  ) LOOP
    INSERT INTO public.role_permissions (role_id, permission_id)
    VALUES (v_member_id, v_perm_id) ON CONFLICT DO NOTHING;
  END LOOP;

END $$;

-- ---------------------------------------------------------------------------
-- PART 3: Subscription plan updates — add 'help-desk' to professional/enterprise
-- ---------------------------------------------------------------------------
UPDATE public.subscription_plans
SET
  enabled_modules = array_append(enabled_modules, 'help-desk'),
  updated_at      = now()
WHERE name = 'professional'
  AND NOT ('help-desk' = ANY(enabled_modules));

UPDATE public.subscription_plans
SET
  enabled_modules = array_append(enabled_modules, 'help-desk'),
  updated_at      = now()
WHERE name = 'enterprise'
  AND NOT ('help-desk' = ANY(enabled_modules));

-- ---------------------------------------------------------------------------
-- PART 4: Ticket number sequence (atomic, per-org, HD-000001 format)
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.helpdesk_ticket_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MAXVALUE
  CACHE 1;

-- ---------------------------------------------------------------------------
-- PART 5: Core tables
-- ---------------------------------------------------------------------------

-- Ticket types (categories that define workflow + priority defaults)
CREATE TABLE IF NOT EXISTS public.helpdesk_ticket_types (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  description   TEXT,
  color         TEXT        NOT NULL DEFAULT '#6366f1',
  icon          TEXT        NOT NULL DEFAULT 'ticket',
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  sort_order    INT         NOT NULL DEFAULT 0,
  created_by    UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS helpdesk_ticket_types_org_active_idx
  ON public.helpdesk_ticket_types (org_id, is_active)
  WHERE deleted_at IS NULL;

-- Main tickets table
CREATE TABLE IF NOT EXISTS public.helpdesk_tickets (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ticket_number   TEXT        NOT NULL,
  title           TEXT        NOT NULL,
  description     TEXT,
  status          TEXT        NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  priority        TEXT        NOT NULL DEFAULT 'medium'
                              CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  ticket_type_id  UUID        REFERENCES public.helpdesk_ticket_types(id) ON DELETE SET NULL,
  assigned_to     UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  created_by      UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  branch_id       UUID        REFERENCES public.branches(id) ON DELETE SET NULL,
  resolved_at     TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  due_at          TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE (org_id, ticket_number)
);

CREATE INDEX IF NOT EXISTS helpdesk_tickets_org_status_idx
  ON public.helpdesk_tickets (org_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS helpdesk_tickets_org_created_by_idx
  ON public.helpdesk_tickets (org_id, created_by)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS helpdesk_tickets_assigned_to_idx
  ON public.helpdesk_tickets (assigned_to)
  WHERE deleted_at IS NULL AND assigned_to IS NOT NULL;

-- Cross-module references (links a ticket to any entity in any module)
CREATE TABLE IF NOT EXISTS public.helpdesk_ticket_references (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID        NOT NULL REFERENCES public.helpdesk_tickets(id) ON DELETE CASCADE,
  source_module   TEXT        NOT NULL,
  source_type     TEXT        NOT NULL,
  source_id       TEXT        NOT NULL,
  context_snapshot JSONB,
  created_by      UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, source_module, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS helpdesk_ticket_references_ticket_idx
  ON public.helpdesk_ticket_references (ticket_id);

CREATE INDEX IF NOT EXISTS helpdesk_ticket_references_source_idx
  ON public.helpdesk_ticket_references (source_module, source_type, source_id);

-- Comments / internal notes on tickets
CREATE TABLE IF NOT EXISTS public.helpdesk_ticket_comments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID        NOT NULL REFERENCES public.helpdesk_tickets(id) ON DELETE CASCADE,
  org_id      UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  body        TEXT        NOT NULL,
  is_internal BOOLEAN     NOT NULL DEFAULT false,
  created_by  UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS helpdesk_ticket_comments_ticket_idx
  ON public.helpdesk_ticket_comments (ticket_id)
  WHERE deleted_at IS NULL;

-- Append-only activity / audit log
CREATE TABLE IF NOT EXISTS public.helpdesk_ticket_activity (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID        NOT NULL REFERENCES public.helpdesk_tickets(id) ON DELETE CASCADE,
  org_id      UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id    UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  event_type  TEXT        NOT NULL,
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS helpdesk_ticket_activity_ticket_idx
  ON public.helpdesk_ticket_activity (ticket_id, created_at DESC);

-- Per-org Help Desk settings (one row per org, upserted on first access)
CREATE TABLE IF NOT EXISTS public.helpdesk_settings (
  org_id                UUID        PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  ticket_prefix         TEXT        NOT NULL DEFAULT 'HD',
  default_priority      TEXT        NOT NULL DEFAULT 'medium'
                                    CHECK (default_priority IN ('low', 'medium', 'high', 'urgent')),
  auto_close_days       INT,
  email_notifications   BOOLEAN     NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- PART 6: RLS policies
-- ---------------------------------------------------------------------------

ALTER TABLE public.helpdesk_ticket_types    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helpdesk_tickets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helpdesk_ticket_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helpdesk_ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helpdesk_ticket_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helpdesk_settings        ENABLE ROW LEVEL SECURITY;

-- ── helpdesk_ticket_types ────────────────────────────────────────────────────

CREATE POLICY "helpdesk_ticket_types_select" ON public.helpdesk_ticket_types
  FOR SELECT TO authenticated
  USING (
    is_org_member(org_id)
    AND has_permission(org_id, 'helpdesk.read')
  );

CREATE POLICY "helpdesk_ticket_types_insert" ON public.helpdesk_ticket_types
  FOR INSERT TO authenticated
  WITH CHECK (
    is_org_member(org_id)
    AND has_permission(org_id, 'helpdesk.ticket-types.manage')
  );

CREATE POLICY "helpdesk_ticket_types_update" ON public.helpdesk_ticket_types
  FOR UPDATE TO authenticated
  USING (
    is_org_member(org_id)
    AND has_permission(org_id, 'helpdesk.ticket-types.manage')
  );

CREATE POLICY "helpdesk_ticket_types_delete" ON public.helpdesk_ticket_types
  FOR DELETE TO authenticated
  USING (
    is_org_member(org_id)
    AND has_permission(org_id, 'helpdesk.ticket-types.manage')
  );

-- ── helpdesk_tickets ─────────────────────────────────────────────────────────

CREATE POLICY "helpdesk_tickets_select" ON public.helpdesk_tickets
  FOR SELECT TO authenticated
  USING (
    is_org_member(org_id)
    AND has_permission(org_id, 'helpdesk.tickets.read')
  );

CREATE POLICY "helpdesk_tickets_insert" ON public.helpdesk_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    is_org_member(org_id)
    AND has_permission(org_id, 'helpdesk.tickets.create')
  );

CREATE POLICY "helpdesk_tickets_update" ON public.helpdesk_tickets
  FOR UPDATE TO authenticated
  USING (
    is_org_member(org_id)
    AND (
      has_permission(org_id, 'helpdesk.tickets.manage')
      OR created_by = auth.uid()
    )
  );

CREATE POLICY "helpdesk_tickets_delete" ON public.helpdesk_tickets
  FOR DELETE TO authenticated
  USING (
    is_org_member(org_id)
    AND has_permission(org_id, 'helpdesk.tickets.manage')
  );

-- ── helpdesk_ticket_references ───────────────────────────────────────────────

CREATE POLICY "helpdesk_ticket_references_select" ON public.helpdesk_ticket_references
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.helpdesk_tickets t
      WHERE t.id = ticket_id
        AND is_org_member(t.org_id)
        AND has_permission(t.org_id, 'helpdesk.tickets.read')
    )
  );

CREATE POLICY "helpdesk_ticket_references_insert" ON public.helpdesk_ticket_references
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.helpdesk_tickets t
      WHERE t.id = ticket_id
        AND is_org_member(t.org_id)
        AND has_permission(t.org_id, 'helpdesk.tickets.create')
    )
  );

CREATE POLICY "helpdesk_ticket_references_delete" ON public.helpdesk_ticket_references
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.helpdesk_tickets t
      WHERE t.id = ticket_id
        AND is_org_member(t.org_id)
        AND has_permission(t.org_id, 'helpdesk.tickets.manage')
    )
  );

-- ── helpdesk_ticket_comments ─────────────────────────────────────────────────

CREATE POLICY "helpdesk_ticket_comments_select" ON public.helpdesk_ticket_comments
  FOR SELECT TO authenticated
  USING (
    is_org_member(org_id)
    AND has_permission(org_id, 'helpdesk.tickets.read')
    AND (NOT is_internal OR has_permission(org_id, 'helpdesk.tickets.manage'))
  );

CREATE POLICY "helpdesk_ticket_comments_insert" ON public.helpdesk_ticket_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    is_org_member(org_id)
    AND has_permission(org_id, 'helpdesk.tickets.create')
  );

CREATE POLICY "helpdesk_ticket_comments_update" ON public.helpdesk_ticket_comments
  FOR UPDATE TO authenticated
  USING (
    is_org_member(org_id)
    AND (
      created_by = auth.uid()
      OR has_permission(org_id, 'helpdesk.tickets.manage')
    )
  );

CREATE POLICY "helpdesk_ticket_comments_delete" ON public.helpdesk_ticket_comments
  FOR DELETE TO authenticated
  USING (
    is_org_member(org_id)
    AND (
      created_by = auth.uid()
      OR has_permission(org_id, 'helpdesk.tickets.manage')
    )
  );

-- ── helpdesk_ticket_activity ─────────────────────────────────────────────────
-- Append-only: SELECT for ticket readers, INSERT for anyone with tickets.read,
-- no UPDATE/DELETE (audit log must be immutable)

CREATE POLICY "helpdesk_ticket_activity_select" ON public.helpdesk_ticket_activity
  FOR SELECT TO authenticated
  USING (
    is_org_member(org_id)
    AND has_permission(org_id, 'helpdesk.tickets.read')
  );

CREATE POLICY "helpdesk_ticket_activity_insert" ON public.helpdesk_ticket_activity
  FOR INSERT TO authenticated
  WITH CHECK (
    is_org_member(org_id)
    AND has_permission(org_id, 'helpdesk.tickets.read')
  );

-- ── helpdesk_settings ────────────────────────────────────────────────────────

CREATE POLICY "helpdesk_settings_select" ON public.helpdesk_settings
  FOR SELECT TO authenticated
  USING (
    is_org_member(org_id)
    AND has_permission(org_id, 'helpdesk.read')
  );

CREATE POLICY "helpdesk_settings_upsert" ON public.helpdesk_settings
  FOR ALL TO authenticated
  USING (
    is_org_member(org_id)
    AND has_permission(org_id, 'helpdesk.settings.manage')
  )
  WITH CHECK (
    is_org_member(org_id)
    AND has_permission(org_id, 'helpdesk.settings.manage')
  );
