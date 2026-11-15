-- =============================================================================
-- Planning: sharing boards.
--
-- Until now a board was either private (its author only) or public (the whole
-- organization). A board now has:
--   * a scope:   private      the owner and the people added to it
--                branch       everyone with planning.boards.read in one branch
--                organization everyone in the organization
--                (old 'public' boards become 'organization')
--   * members:   people added by the owner, each an editor (adds and moves
--                tasks) or a viewer (only looks). A member's role also applies
--                on a branch or organization board, so a viewer stays a viewer.
--   * an owner:  its author, the only one who changes scope, branch and
--                members. Archiving takes the owner or planning.boards.delete.
--
-- One function, planning_board_access(), answers "what is my role on this
-- board" and every policy goes through it: boards, columns, cards, members,
-- and tasks placed on a board (the restrictive policy from 20261115130000,
-- which now also needs edit access to write a task on a board).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Scope and branch on the board
-- ---------------------------------------------------------------------------

ALTER TABLE public.planning_kanban_boards
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE public.planning_kanban_boards
  DROP CONSTRAINT IF EXISTS planning_kanban_boards_visibility_check;

UPDATE public.planning_kanban_boards SET visibility = 'organization' WHERE visibility = 'public';

ALTER TABLE public.planning_kanban_boards
  ADD CONSTRAINT planning_kanban_boards_visibility_check
  CHECK (visibility IN ('private', 'branch', 'organization'));

ALTER TABLE public.planning_kanban_boards
  DROP CONSTRAINT IF EXISTS planning_kanban_boards_branch_scope_check;
ALTER TABLE public.planning_kanban_boards
  ADD CONSTRAINT planning_kanban_boards_branch_scope_check
  CHECK (visibility <> 'branch' OR branch_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS planning_kanban_boards_branch_idx
  ON public.planning_kanban_boards (organization_id, branch_id)
  WHERE deleted_at IS NULL AND branch_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Board members
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.planning_kanban_board_members (
  board_id        UUID        NOT NULL REFERENCES public.planning_kanban_boards(id) ON DELETE CASCADE,
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL DEFAULT 'editor' CHECK (role IN ('editor', 'viewer')),
  added_by        UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, user_id)
);

CREATE INDEX IF NOT EXISTS planning_kanban_board_members_user_idx
  ON public.planning_kanban_board_members (organization_id, user_id);

CREATE OR REPLACE TRIGGER planning_kanban_board_members_updated_at
  BEFORE UPDATE ON public.planning_kanban_board_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- A member must be an active member of the board's organization, and the
-- owner is never a member of their own board.
CREATE OR REPLACE FUNCTION public.planning_kanban_board_members_check()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org   UUID;
  v_owner UUID;
BEGIN
  SELECT b.organization_id, b.created_by INTO v_org, v_owner
  FROM public.planning_kanban_boards b
  WHERE b.id = NEW.board_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Board not found' USING ERRCODE = '23503';
  END IF;
  IF NEW.organization_id <> v_org THEN
    RAISE EXCEPTION 'Board belongs to another organization' USING ERRCODE = '23514';
  END IF;
  IF NEW.user_id = v_owner THEN
    RAISE EXCEPTION 'The owner is not a member of their own board' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = v_org
      AND m.user_id = NEW.user_id
      AND m.status = 'active'
      AND m.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'User is not an active member of this organization' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS planning_kanban_board_members_check ON public.planning_kanban_board_members;
CREATE TRIGGER planning_kanban_board_members_check
  BEFORE INSERT OR UPDATE OF board_id, organization_id, user_id ON public.planning_kanban_board_members
  FOR EACH ROW EXECUTE FUNCTION public.planning_kanban_board_members_check();

-- ---------------------------------------------------------------------------
-- 3. The current user's role on a board
-- ---------------------------------------------------------------------------

-- 'owner' | 'editor' | 'viewer', or NULL when the user cannot see the board.
-- Ignores deleted_at on purpose (callers check it where it matters), so tasks
-- left on an archived board stay visible to the same people.
CREATE OR REPLACE FUNCTION public.planning_board_access(p_board_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_board  RECORD;
  v_member TEXT;
BEGIN
  IF v_uid IS NULL OR p_board_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT b.organization_id, b.created_by, b.visibility, b.branch_id INTO v_board
  FROM public.planning_kanban_boards b
  WHERE b.id = p_board_id;

  IF NOT FOUND OR NOT public.is_org_member(v_board.organization_id) THEN
    RETURN NULL;
  END IF;

  IF v_board.created_by = v_uid THEN
    RETURN 'owner';
  END IF;

  SELECT m.role INTO v_member
  FROM public.planning_kanban_board_members m
  WHERE m.board_id = p_board_id AND m.user_id = v_uid;

  IF v_member IS NOT NULL THEN
    RETURN v_member;
  END IF;

  IF v_board.visibility = 'organization' THEN
    RETURN 'editor';
  END IF;

  IF v_board.visibility = 'branch'
    AND v_board.branch_id IS NOT NULL
    AND public.has_branch_permission(v_board.organization_id, v_board.branch_id, 'planning.boards.read') THEN
    RETURN 'editor';
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_view_planning_board(p_board_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.planning_board_access(p_board_id) IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.can_edit_planning_board(p_board_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(public.planning_board_access(p_board_id) IN ('owner', 'editor'), false);
$$;

REVOKE ALL ON FUNCTION public.planning_board_access(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_planning_board(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_edit_planning_board(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.planning_board_access(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_planning_board(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_edit_planning_board(UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Only the owner changes scope, branch and owner; archiving takes the
--    owner or planning.boards.delete
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.planning_kanban_boards_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Service-role and maintenance writes have no user.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF (NEW.visibility IS DISTINCT FROM OLD.visibility
      OR NEW.branch_id IS DISTINCT FROM OLD.branch_id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by)
    AND OLD.created_by <> auth.uid() THEN
    RAISE EXCEPTION 'Only the board owner can change who sees the board' USING ERRCODE = '42501';
  END IF;

  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL
    AND OLD.created_by <> auth.uid()
    AND NOT public.has_permission(OLD.organization_id, 'planning.boards.delete') THEN
    RAISE EXCEPTION 'Only the board owner can archive the board' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS planning_kanban_boards_guard ON public.planning_kanban_boards;
CREATE TRIGGER planning_kanban_boards_guard
  BEFORE UPDATE ON public.planning_kanban_boards
  FOR EACH ROW EXECUTE FUNCTION public.planning_kanban_boards_guard();

-- ---------------------------------------------------------------------------
-- 5. Policies: boards, columns, cards (replaced; same permissions as before,
--    with "public or mine" replaced by the role on the board)
--
--    The SELECT policies no longer require deleted_at IS NULL. Postgres checks
--    an updated row against the SELECT policies too, so with that condition a
--    soft delete (setting deleted_at) was always refused: archiving a board,
--    a column or a card failed with "new row violates row-level security
--    policy". The services already filter deleted_at IS NULL when reading.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "planning_kanban_boards_select" ON public.planning_kanban_boards;
CREATE POLICY "planning_kanban_boards_select" ON public.planning_kanban_boards
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.boards.read')
    AND public.can_view_planning_board(id)
  );

DROP POLICY IF EXISTS "planning_kanban_boards_update" ON public.planning_kanban_boards;
CREATE POLICY "planning_kanban_boards_update" ON public.planning_kanban_boards
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.boards.update')
    AND public.can_edit_planning_board(id)
  )
  WITH CHECK (
    public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'planning.boards.update')
    AND public.can_edit_planning_board(id)
  );

DROP POLICY IF EXISTS "planning_kanban_columns_select" ON public.planning_kanban_columns;
CREATE POLICY "planning_kanban_columns_select" ON public.planning_kanban_columns
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.planning_kanban_boards b
      WHERE b.id = planning_kanban_columns.board_id
        AND b.organization_id = planning_kanban_columns.organization_id
    )
    AND public.has_permission(organization_id, 'planning.boards.read')
    AND public.can_view_planning_board(board_id)
  );

DROP POLICY IF EXISTS "planning_kanban_columns_insert" ON public.planning_kanban_columns;
CREATE POLICY "planning_kanban_columns_insert" ON public.planning_kanban_columns
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.planning_kanban_boards b
      WHERE b.id = planning_kanban_columns.board_id
        AND b.deleted_at IS NULL
        AND b.organization_id = planning_kanban_columns.organization_id
    )
    AND public.has_permission(organization_id, 'planning.boards.update')
    AND public.can_edit_planning_board(board_id)
  );

DROP POLICY IF EXISTS "planning_kanban_columns_update" ON public.planning_kanban_columns;
CREATE POLICY "planning_kanban_columns_update" ON public.planning_kanban_columns
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND public.has_permission(organization_id, 'planning.boards.update')
    AND public.can_edit_planning_board(board_id)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.planning_kanban_boards b
      WHERE b.id = planning_kanban_columns.board_id
        AND b.deleted_at IS NULL
        AND b.organization_id = planning_kanban_columns.organization_id
    )
    AND public.has_permission(organization_id, 'planning.boards.update')
    AND public.can_edit_planning_board(board_id)
  );

DROP POLICY IF EXISTS "planning_kanban_cards_select" ON public.planning_kanban_cards;
CREATE POLICY "planning_kanban_cards_select" ON public.planning_kanban_cards
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.planning_kanban_boards b
      WHERE b.id = planning_kanban_cards.board_id
        AND b.organization_id = planning_kanban_cards.organization_id
    )
    AND public.has_permission(organization_id, 'planning.boards.read')
    AND public.can_view_planning_board(board_id)
  );

DROP POLICY IF EXISTS "planning_kanban_cards_insert" ON public.planning_kanban_cards;
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
    )
    AND public.has_permission(organization_id, 'planning.boards.update')
    AND public.can_edit_planning_board(board_id)
  );

DROP POLICY IF EXISTS "planning_kanban_cards_update" ON public.planning_kanban_cards;
CREATE POLICY "planning_kanban_cards_update" ON public.planning_kanban_cards
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND public.has_permission(organization_id, 'planning.boards.update')
    AND public.can_edit_planning_board(board_id)
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
    )
    AND public.has_permission(organization_id, 'planning.boards.update')
    AND public.can_edit_planning_board(board_id)
  );

-- ---------------------------------------------------------------------------
-- 6. Policies: members (everyone who sees the board sees who is on it; only
--    the owner adds, changes and removes)
-- ---------------------------------------------------------------------------

ALTER TABLE public.planning_kanban_board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_kanban_board_members FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planning_kanban_board_members_select" ON public.planning_kanban_board_members;
CREATE POLICY "planning_kanban_board_members_select" ON public.planning_kanban_board_members
  FOR SELECT TO authenticated
  USING (
    public.has_permission(organization_id, 'planning.boards.read')
    AND public.can_view_planning_board(board_id)
  );

DROP POLICY IF EXISTS "planning_kanban_board_members_insert" ON public.planning_kanban_board_members;
CREATE POLICY "planning_kanban_board_members_insert" ON public.planning_kanban_board_members
  FOR INSERT TO authenticated
  WITH CHECK (public.planning_board_access(board_id) = 'owner');

DROP POLICY IF EXISTS "planning_kanban_board_members_update" ON public.planning_kanban_board_members;
CREATE POLICY "planning_kanban_board_members_update" ON public.planning_kanban_board_members
  FOR UPDATE TO authenticated
  USING (public.planning_board_access(board_id) = 'owner')
  WITH CHECK (public.planning_board_access(board_id) = 'owner');

DROP POLICY IF EXISTS "planning_kanban_board_members_delete" ON public.planning_kanban_board_members;
CREATE POLICY "planning_kanban_board_members_delete" ON public.planning_kanban_board_members
  FOR DELETE TO authenticated
  USING (public.planning_board_access(board_id) = 'owner');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_kanban_board_members TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. Tasks on a board: seeing needs view access, writing needs edit access
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "planning_tasks_placement_visibility" ON public.planning_tasks;
CREATE POLICY "planning_tasks_placement_visibility" ON public.planning_tasks
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    (NOT is_inbox OR created_by = auth.uid())
    AND (board_id IS NULL OR public.can_view_planning_board(board_id))
  )
  WITH CHECK (
    (NOT is_inbox OR created_by = auth.uid())
    AND (board_id IS NULL OR public.can_edit_planning_board(board_id))
  );
