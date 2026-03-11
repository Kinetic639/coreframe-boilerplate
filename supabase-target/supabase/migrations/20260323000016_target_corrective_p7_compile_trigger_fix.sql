-- =============================================================================
-- CORRECTIVE PASS — Phase 7: Fix trigger_compile_on_role_permission
-- Gap: original function only recompiles org-scoped user_role_assignments.
-- Branch-scoped URAs were missed when a permission is INSERTed into a role
-- (or when a soft-deleted role_permission is undeleted).
--
-- trg_rp_compile_remove (DELETE / soft-delete UPDATE) already uses the
-- comprehensive branch-aware fan-out. This migration aligns the INSERT/UPDATE
-- path with the same logic.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trigger_compile_on_role_permission()
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
  ELSE
    v_role_id := NEW.role_id;
  END IF;

  -- Fan out to ALL users holding this role, regardless of scope.
  -- compile_user_permissions(user_id, org_id) recomputes the full UEP snapshot
  -- for the user in that org — it processes both org-scoped and branch-scoped
  -- role assignments in a single pass.
  FOR v_rec IN
    SELECT DISTINCT
      ura.user_id,
      CASE ura.scope
        WHEN 'org'    THEN ura.scope_id
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

-- No trigger recreation needed — trigger_role_permission_compile already
-- points to this function and fires on AFTER INSERT OR DELETE OR UPDATE.
-- Revoke PUBLIC as per Phase 4 security policy.
REVOKE EXECUTE ON FUNCTION public.trigger_compile_on_role_permission() FROM PUBLIC;
