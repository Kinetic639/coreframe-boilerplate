-- =============================================================================
-- HARDENING PHASE 2: Compile Triggers on DELETE / Soft-Delete
-- Goal: Ensure user_effective_permissions is never stale after role removal,
--       permission revocation, or override deletion.
-- =============================================================================

-- ─── A. URA removal trigger ──────────────────────────────────────────────────
-- Fires when a user_role_assignments row is hard-deleted OR soft-deleted
-- (UPDATE that sets deleted_at from NULL to a timestamp).

CREATE OR REPLACE FUNCTION public.trigger_compile_on_ura_remove()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
  v_uid    uuid;
BEGIN
  -- Determine effective (user_id, org_id) from the row being removed.
  IF TG_OP = 'DELETE' THEN
    v_uid := OLD.user_id;
    IF OLD.scope = 'org' THEN
      v_org_id := OLD.scope_id;
    ELSE
      SELECT b.organization_id INTO v_org_id
      FROM public.branches b
      WHERE b.id = OLD.scope_id;
    END IF;

  ELSIF TG_OP = 'UPDATE'
    AND OLD.deleted_at IS NULL
    AND NEW.deleted_at IS NOT NULL
  THEN
    -- Soft-delete detected.
    v_uid := NEW.user_id;
    IF NEW.scope = 'org' THEN
      v_org_id := NEW.scope_id;
    ELSE
      SELECT b.organization_id INTO v_org_id
      FROM public.branches b
      WHERE b.id = NEW.scope_id;
    END IF;

  ELSE
    -- Not a removal — skip.
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF v_org_id IS NOT NULL THEN
    PERFORM public.compile_user_permissions(v_uid, v_org_id);
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ura_compile_remove ON public.user_role_assignments;
CREATE TRIGGER trg_ura_compile_remove
  AFTER DELETE OR UPDATE OF deleted_at
  ON public.user_role_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_compile_on_ura_remove();

-- ─── B. Role-permission removal trigger ──────────────────────────────────────
-- Fires when a role_permissions row is hard-deleted or soft-deleted.
-- Recompiles ALL users who currently hold that role (fan-out is bounded by
-- the number of users with the role; only fires on admin operations).

CREATE OR REPLACE FUNCTION public.trigger_compile_on_rp_remove()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_role_id uuid;
  v_rec     record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_role_id := OLD.role_id;
  ELSIF TG_OP = 'UPDATE'
    AND OLD.deleted_at IS NULL
    AND NEW.deleted_at IS NOT NULL
  THEN
    v_role_id := NEW.role_id;
  ELSE
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  -- Fan out: recompile every user who holds this role.
  FOR v_rec IN
    SELECT DISTINCT
      ura.user_id,
      CASE ura.scope
        WHEN 'org' THEN ura.scope_id
        ELSE b.organization_id
      END AS org_id
    FROM public.user_role_assignments ura
    LEFT JOIN public.branches b
      ON b.id = ura.scope_id AND ura.scope = 'branch'
    WHERE ura.role_id    = v_role_id
      AND ura.deleted_at IS NULL
  LOOP
    IF v_rec.org_id IS NOT NULL THEN
      PERFORM public.compile_user_permissions(v_rec.user_id, v_rec.org_id);
    END IF;
  END LOOP;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rp_compile_remove ON public.role_permissions;
CREATE TRIGGER trg_rp_compile_remove
  AFTER DELETE OR UPDATE OF deleted_at
  ON public.role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_compile_on_rp_remove();

-- ─── C. Permission override removal trigger ───────────────────────────────────
-- Fires when a user_permission_overrides row is hard-deleted or soft-deleted.
-- organization_id is directly available — no lookup needed.

CREATE OR REPLACE FUNCTION public.trigger_compile_on_override_remove()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.compile_user_permissions(OLD.user_id, OLD.organization_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE'
    AND OLD.deleted_at IS NULL
    AND NEW.deleted_at IS NOT NULL
  THEN
    PERFORM public.compile_user_permissions(NEW.user_id, NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_override_compile_remove ON public.user_permission_overrides;
CREATE TRIGGER trg_override_compile_remove
  AFTER DELETE OR UPDATE OF deleted_at
  ON public.user_permission_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_compile_on_override_remove();
