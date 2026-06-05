-- ===========================================================================
-- Planning Kanban Boards
-- ===========================================================================

-- Permission rows
INSERT INTO public.permissions (slug, name, category, action)
VALUES
  ('planning.boards.read',   'Planning Boards Read',   'planning', 'read'),
  ('planning.boards.create', 'Planning Boards Create', 'planning', 'create'),
  ('planning.boards.update', 'Planning Boards Update', 'planning', 'update'),
  ('planning.boards.delete', 'Planning Boards Delete', 'planning', 'delete')
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  v_owner_id  UUID;
  v_member_id UUID;
  v_perm_id   UUID;
BEGIN
  SELECT id INTO v_owner_id  FROM public.roles WHERE name = 'org_owner'  AND is_basic = true LIMIT 1;
  SELECT id INTO v_member_id FROM public.roles WHERE name = 'org_member' AND is_basic = true LIMIT 1;

  IF v_owner_id IS NOT NULL THEN
    SELECT id INTO v_perm_id FROM public.permissions WHERE slug = 'planning.*';
    IF v_perm_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (v_owner_id, v_perm_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  IF v_member_id IS NOT NULL THEN
    FOREACH v_perm_id IN ARRAY ARRAY(
      SELECT id FROM public.permissions
      WHERE slug IN (
        'planning.boards.read',
        'planning.boards.create',
        'planning.boards.update'
      )
    ) LOOP
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (v_member_id, v_perm_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.planning_kanban_boards (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL CHECK (char_length(title) > 0 AND char_length(title) <= 160),
  description     TEXT        CHECK (description IS NULL OR char_length(description) <= 2000),
  visibility      TEXT        NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  created_by      UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_by      UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.planning_kanban_columns (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id        UUID        NOT NULL REFERENCES public.planning_kanban_boards(id) ON DELETE CASCADE,
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL CHECK (char_length(title) > 0 AND char_length(title) <= 120),
  description     TEXT        CHECK (description IS NULL OR char_length(description) <= 1000),
  color           TEXT        CHECK (color IS NULL OR color ~ '^#[0-9a-fA-F]{6}$'),
  position        INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.planning_kanban_cards (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id        UUID        NOT NULL REFERENCES public.planning_kanban_boards(id) ON DELETE CASCADE,
  column_id       UUID        NOT NULL REFERENCES public.planning_kanban_columns(id) ON DELETE CASCADE,
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL CHECK (char_length(title) > 0 AND char_length(title) <= 300),
  description     TEXT        CHECK (description IS NULL OR char_length(description) <= 4000),
  position        INTEGER     NOT NULL DEFAULT 0,
  created_by      UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_by      UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE OR REPLACE TRIGGER planning_kanban_boards_updated_at
  BEFORE UPDATE ON public.planning_kanban_boards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER planning_kanban_columns_updated_at
  BEFORE UPDATE ON public.planning_kanban_columns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER planning_kanban_cards_updated_at
  BEFORE UPDATE ON public.planning_kanban_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS planning_kanban_boards_org_visible_idx
  ON public.planning_kanban_boards (organization_id, visibility, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS planning_kanban_boards_owner_idx
  ON public.planning_kanban_boards (organization_id, created_by, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS planning_kanban_columns_board_position_idx
  ON public.planning_kanban_columns (board_id, position)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS planning_kanban_cards_column_position_idx
  ON public.planning_kanban_cards (column_id, position)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS planning_kanban_cards_board_position_idx
  ON public.planning_kanban_cards (board_id, position)
  WHERE deleted_at IS NULL;

ALTER TABLE public.planning_kanban_boards  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_kanban_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_kanban_cards   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_kanban_boards  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.planning_kanban_columns FORCE ROW LEVEL SECURITY;
ALTER TABLE public.planning_kanban_cards   FORCE ROW LEVEL SECURITY;

CREATE POLICY "planning_kanban_boards_select" ON public.planning_kanban_boards
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.boards.read')
    AND (visibility = 'public' OR created_by = auth.uid())
  );

CREATE POLICY "planning_kanban_boards_insert" ON public.planning_kanban_boards
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.boards.create')
  );

CREATE POLICY "planning_kanban_boards_update" ON public.planning_kanban_boards
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.boards.update')
    AND (visibility = 'public' OR created_by = auth.uid())
  )
  WITH CHECK (
    public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.boards.update')
    AND (visibility = 'public' OR created_by = auth.uid())
  );

CREATE POLICY "planning_kanban_boards_delete" ON public.planning_kanban_boards
  FOR DELETE TO authenticated
  USING (false);

CREATE POLICY "planning_kanban_columns_select" ON public.planning_kanban_columns
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.planning_kanban_boards b
      WHERE b.id = planning_kanban_columns.board_id
        AND b.deleted_at IS NULL
        AND b.organization_id = planning_kanban_columns.organization_id
        AND public.is_org_member(b.organization_id)
        AND public.has_permission(b.organization_id, 'planning.boards.read')
        AND (b.visibility = 'public' OR b.created_by = auth.uid())
    )
  );

CREATE POLICY "planning_kanban_columns_insert" ON public.planning_kanban_columns
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.planning_kanban_boards b
      WHERE b.id = planning_kanban_columns.board_id
        AND b.deleted_at IS NULL
        AND b.organization_id = planning_kanban_columns.organization_id
        AND public.is_org_member(b.organization_id)
        AND public.has_permission(b.organization_id, 'planning.boards.update')
        AND (b.visibility = 'public' OR b.created_by = auth.uid())
    )
  );

CREATE POLICY "planning_kanban_columns_update" ON public.planning_kanban_columns
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.planning_kanban_boards b
      WHERE b.id = planning_kanban_columns.board_id
        AND b.deleted_at IS NULL
        AND b.organization_id = planning_kanban_columns.organization_id
        AND public.is_org_member(b.organization_id)
        AND public.has_permission(b.organization_id, 'planning.boards.update')
        AND (b.visibility = 'public' OR b.created_by = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.planning_kanban_boards b
      WHERE b.id = planning_kanban_columns.board_id
        AND b.deleted_at IS NULL
        AND b.organization_id = planning_kanban_columns.organization_id
        AND public.is_org_member(b.organization_id)
        AND public.has_permission(b.organization_id, 'planning.boards.update')
        AND (b.visibility = 'public' OR b.created_by = auth.uid())
    )
  );

CREATE POLICY "planning_kanban_columns_delete" ON public.planning_kanban_columns
  FOR DELETE TO authenticated
  USING (false);

CREATE POLICY "planning_kanban_cards_select" ON public.planning_kanban_cards
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.planning_kanban_boards b
      WHERE b.id = planning_kanban_cards.board_id
        AND b.deleted_at IS NULL
        AND b.organization_id = planning_kanban_cards.organization_id
        AND public.is_org_member(b.organization_id)
        AND public.has_permission(b.organization_id, 'planning.boards.read')
        AND (b.visibility = 'public' OR b.created_by = auth.uid())
    )
  );

CREATE POLICY "planning_kanban_cards_insert" ON public.planning_kanban_cards
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.planning_kanban_boards b
      JOIN public.planning_kanban_columns c ON c.id = planning_kanban_cards.column_id
      WHERE b.id = planning_kanban_cards.board_id
        AND c.board_id = b.id
        AND c.deleted_at IS NULL
        AND b.deleted_at IS NULL
        AND b.organization_id = planning_kanban_cards.organization_id
        AND c.organization_id = planning_kanban_cards.organization_id
        AND public.is_org_member(b.organization_id)
        AND public.has_permission(b.organization_id, 'planning.boards.update')
        AND (b.visibility = 'public' OR b.created_by = auth.uid())
    )
  );

CREATE POLICY "planning_kanban_cards_update" ON public.planning_kanban_cards
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.planning_kanban_boards b
      WHERE b.id = planning_kanban_cards.board_id
        AND b.deleted_at IS NULL
        AND b.organization_id = planning_kanban_cards.organization_id
        AND public.is_org_member(b.organization_id)
        AND public.has_permission(b.organization_id, 'planning.boards.update')
        AND (b.visibility = 'public' OR b.created_by = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.planning_kanban_boards b
      JOIN public.planning_kanban_columns c ON c.id = planning_kanban_cards.column_id
      WHERE b.id = planning_kanban_cards.board_id
        AND c.board_id = b.id
        AND c.deleted_at IS NULL
        AND b.deleted_at IS NULL
        AND b.organization_id = planning_kanban_cards.organization_id
        AND c.organization_id = planning_kanban_cards.organization_id
        AND public.is_org_member(b.organization_id)
        AND public.has_permission(b.organization_id, 'planning.boards.update')
        AND (b.visibility = 'public' OR b.created_by = auth.uid())
    )
  );

CREATE POLICY "planning_kanban_cards_delete" ON public.planning_kanban_cards
  FOR DELETE TO authenticated
  USING (false);
