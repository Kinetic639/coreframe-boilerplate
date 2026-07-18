-- Harden stock-audit immutability and privileged movement-type seeding.
--
-- This migration adds a DB-level guard for inventory_count_lines so closed
-- audit sessions are immutable even if a caller bypasses the application
-- service layer. It also wraps the public SECURITY DEFINER movement-type seed
-- function with an explicit auth/permission guard.

-- ---------------------------------------------------------------------------
-- 1. Count-line/session integrity guard
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.inventory_count_lines_guard_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_session record;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.count_session_id IS DISTINCT FROM NEW.count_session_id THEN
      RAISE EXCEPTION 'Inventory count lines cannot be moved between sessions'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  SELECT id, status
  INTO v_session
  FROM public.inventory_count_sessions
  WHERE id = NEW.count_session_id
    AND organization_id = NEW.organization_id
    AND branch_id = NEW.branch_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory count line must belong to a session in the same organization and branch'
      USING ERRCODE = '23514';
  END IF;

  IF v_session.status IN ('approved', 'cancelled') THEN
    RAISE EXCEPTION 'Inventory count session is % and can no longer be changed', v_session.status
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_count_lines_guard_session_trigger
  ON public.inventory_count_lines;

CREATE TRIGGER inventory_count_lines_guard_session_trigger
  BEFORE INSERT OR UPDATE ON public.inventory_count_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.inventory_count_lines_guard_session();

-- ---------------------------------------------------------------------------
-- 2. RLS policies: keep delete denied, but make insert/update workflow-aware
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS inventory_count_sessions_insert ON public.inventory_count_sessions;
DROP POLICY IF EXISTS inventory_count_sessions_update ON public.inventory_count_sessions;
DROP POLICY IF EXISTS inventory_count_sessions_delete_deny ON public.inventory_count_sessions;

CREATE POLICY inventory_count_sessions_insert
  ON public.inventory_count_sessions FOR INSERT
  TO authenticated
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.audits.manage'));

CREATE POLICY inventory_count_sessions_update
  ON public.inventory_count_sessions FOR UPDATE
  TO authenticated
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.audits.manage'))
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.audits.manage'));

CREATE POLICY inventory_count_sessions_delete_deny
  ON public.inventory_count_sessions FOR DELETE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS inventory_count_lines_insert ON public.inventory_count_lines;
DROP POLICY IF EXISTS inventory_count_lines_update ON public.inventory_count_lines;
DROP POLICY IF EXISTS inventory_count_lines_delete_deny ON public.inventory_count_lines;

CREATE POLICY inventory_count_lines_insert
  ON public.inventory_count_lines FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.audits.manage')
    AND EXISTS (
      SELECT 1
      FROM public.inventory_count_sessions s
      WHERE s.id = count_session_id
        AND s.organization_id = inventory_count_lines.organization_id
        AND s.branch_id = inventory_count_lines.branch_id
        AND s.status NOT IN ('approved', 'cancelled')
    )
  );

CREATE POLICY inventory_count_lines_update
  ON public.inventory_count_lines FOR UPDATE
  TO authenticated
  USING (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.audits.manage')
    AND EXISTS (
      SELECT 1
      FROM public.inventory_count_sessions s
      WHERE s.id = count_session_id
        AND s.organization_id = inventory_count_lines.organization_id
        AND s.branch_id = inventory_count_lines.branch_id
        AND s.status NOT IN ('approved', 'cancelled')
    )
  )
  WITH CHECK (
    public.has_branch_permission(organization_id, branch_id, 'warehouse.audits.manage')
    AND EXISTS (
      SELECT 1
      FROM public.inventory_count_sessions s
      WHERE s.id = count_session_id
        AND s.organization_id = inventory_count_lines.organization_id
        AND s.branch_id = inventory_count_lines.branch_id
        AND s.status NOT IN ('approved', 'cancelled')
    )
  );

CREATE POLICY inventory_count_lines_delete_deny
  ON public.inventory_count_lines FOR DELETE
  TO authenticated
  USING (false);

-- ---------------------------------------------------------------------------
-- 3. Guard the movement-type seed function instead of exposing it directly
-- ---------------------------------------------------------------------------

ALTER FUNCTION public.inventory_seed_movement_types(uuid, uuid)
  RENAME TO inventory_seed_movement_types_internal;

REVOKE EXECUTE ON FUNCTION public.inventory_seed_movement_types_internal(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.inventory_seed_movement_types(
  p_organization_id uuid,
  p_actor_user_id uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_auth_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_auth_uid IS NOT NULL THEN
    IF p_actor_user_id IS NOT NULL AND p_actor_user_id <> v_auth_uid THEN
      RAISE EXCEPTION 'Actor user does not match authenticated user'
        USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.branches b
      WHERE b.organization_id = p_organization_id
        AND b.deleted_at IS NULL
        AND public.has_branch_permission(
          p_organization_id,
          b.id,
          'warehouse.inventory.adjust'
        )
    ) THEN
      RAISE EXCEPTION 'Missing warehouse.inventory.adjust permission'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  PERFORM public.inventory_seed_movement_types_internal(p_organization_id, p_actor_user_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.inventory_seed_movement_types(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_seed_movement_types(uuid, uuid)
  TO authenticated, service_role;
