-- App calendar sources and native events
--
-- Module-backed calendars (tasks, tickets, kanban boards) remain virtual.
-- These tables store user-created native calendars, native events, and
-- per-user display overrides for every calendar key.

ALTER TABLE public.planning_kanban_boards
  ADD COLUMN IF NOT EXISTS color TEXT CHECK (color IS NULL OR color ~ '^#[0-9a-fA-F]{6}$');

CREATE TABLE IF NOT EXISTS public.app_calendars (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL CHECK (char_length(name) > 0 AND char_length(name) <= 160),
  default_color    TEXT        NOT NULL DEFAULT '#14b8a6' CHECK (default_color ~ '^#[0-9a-fA-F]{6}$'),
  visibility       TEXT        NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'organization')),
  created_by       UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_by       UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.app_calendar_events (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  calendar_id      UUID        NOT NULL REFERENCES public.app_calendars(id) ON DELETE CASCADE,
  title            TEXT        NOT NULL CHECK (char_length(title) > 0 AND char_length(title) <= 300),
  description      TEXT        CHECK (description IS NULL OR char_length(description) <= 4000),
  all_day          BOOLEAN     NOT NULL DEFAULT true,
  start_date       DATE,
  end_date         DATE,
  start_at         TIMESTAMPTZ,
  end_at           TIMESTAMPTZ,
  timezone         TEXT        NOT NULL DEFAULT 'UTC' CHECK (char_length(timezone) > 0 AND char_length(timezone) <= 80),
  created_by       UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_by       UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ,
  CONSTRAINT app_calendar_events_date_shape CHECK (
    (all_day = true AND start_date IS NOT NULL AND end_date IS NOT NULL AND start_at IS NULL AND end_at IS NULL AND end_date >= start_date)
    OR
    (all_day = false AND start_at IS NOT NULL AND end_at IS NOT NULL AND start_date IS NULL AND end_date IS NULL AND end_at > start_at)
  )
);

CREATE TABLE IF NOT EXISTS public.app_calendar_user_settings (
  organization_id  UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  calendar_key     TEXT        NOT NULL CHECK (char_length(calendar_key) > 0 AND char_length(calendar_key) <= 220),
  color            TEXT        CHECK (color IS NULL OR color ~ '^#[0-9a-fA-F]{6}$'),
  visible          BOOLEAN,
  position         INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id, calendar_key)
);

CREATE OR REPLACE TRIGGER app_calendars_updated_at
  BEFORE UPDATE ON public.app_calendars
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER app_calendar_events_updated_at
  BEFORE UPDATE ON public.app_calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER app_calendar_user_settings_updated_at
  BEFORE UPDATE ON public.app_calendar_user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS app_calendars_org_visible_idx
  ON public.app_calendars (organization_id, visibility, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS app_calendars_owner_idx
  ON public.app_calendars (organization_id, created_by, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS app_calendar_events_all_day_range_idx
  ON public.app_calendar_events (organization_id, calendar_id, start_date, end_date)
  WHERE deleted_at IS NULL AND all_day = true;

CREATE INDEX IF NOT EXISTS app_calendar_events_timed_range_idx
  ON public.app_calendar_events (organization_id, calendar_id, start_at, end_at)
  WHERE deleted_at IS NULL AND all_day = false;

CREATE INDEX IF NOT EXISTS app_calendar_user_settings_user_idx
  ON public.app_calendar_user_settings (organization_id, user_id, position NULLS LAST, calendar_key);

ALTER TABLE public.app_calendars              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_calendar_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_calendar_user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_calendars              FORCE ROW LEVEL SECURITY;
ALTER TABLE public.app_calendar_events        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.app_calendar_user_settings FORCE ROW LEVEL SECURITY;

CREATE POLICY "app_calendars_select" ON public.app_calendars
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.read')
    AND (visibility = 'organization' OR created_by = auth.uid())
  );

CREATE POLICY "app_calendars_insert" ON public.app_calendars
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.read')
  );

CREATE POLICY "app_calendars_update" ON public.app_calendars
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.read')
    AND (created_by = auth.uid() OR public.has_permission(organization_id, 'planning.settings.manage'))
  )
  WITH CHECK (
    public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.read')
    AND (created_by = auth.uid() OR public.has_permission(organization_id, 'planning.settings.manage'))
  );

CREATE POLICY "app_calendar_events_select" ON public.app_calendar_events
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.read')
    AND EXISTS (
      SELECT 1
      FROM public.app_calendars c
      WHERE c.id = app_calendar_events.calendar_id
        AND c.organization_id = app_calendar_events.organization_id
        AND c.deleted_at IS NULL
        AND (c.visibility = 'organization' OR c.created_by = auth.uid())
    )
  );

CREATE POLICY "app_calendar_events_insert" ON public.app_calendar_events
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.read')
    AND EXISTS (
      SELECT 1
      FROM public.app_calendars c
      WHERE c.id = app_calendar_events.calendar_id
        AND c.organization_id = app_calendar_events.organization_id
        AND c.deleted_at IS NULL
        AND (c.created_by = auth.uid() OR c.visibility = 'organization')
    )
  );

CREATE POLICY "app_calendar_events_update" ON public.app_calendar_events
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.read')
    AND EXISTS (
      SELECT 1
      FROM public.app_calendars c
      WHERE c.id = app_calendar_events.calendar_id
        AND c.organization_id = app_calendar_events.organization_id
        AND c.deleted_at IS NULL
        AND (c.created_by = auth.uid() OR app_calendar_events.created_by = auth.uid())
    )
  )
  WITH CHECK (
    public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.read')
  );

CREATE POLICY "app_calendar_user_settings_select" ON public.app_calendar_user_settings
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.read')
  );

CREATE POLICY "app_calendar_user_settings_insert" ON public.app_calendar_user_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.read')
  );

CREATE POLICY "app_calendar_user_settings_update" ON public.app_calendar_user_settings
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.read')
  )
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.read')
  );
