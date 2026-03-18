-- =============================================================================
-- CORRECTIVE PASS — Phase 7: Fix trigger_compile_on_role_permission
-- Gap: original function only recompiled org-scoped user_role_assignments.
-- Branch-scoped URAs were missed when a permission is INSERTed into a role
-- (or when a soft-deleted role_permission is undeleted).
--
-- This migration rewrites trigger_compile_on_role_permission() to fan out to
-- ALL users holding the role, resolving org_id for branch-scoped assignments
-- via a branches JOIN. After this fix the single trigger
-- trigger_role_permission_compile (AFTER INSERT OR DELETE OR UPDATE) fully
-- covers all mutation paths with branch-aware fan-out.
--
-- NOTE: A prior comment referenced trg_rp_compile_remove as the narrow
-- DELETE/soft-delete trigger with the branch-aware fan-out. That trigger was
-- removed in 20260323000018_target_corrective_p9_trigger_dedup after it was
-- confirmed redundant — trigger_role_permission_compile already fires on all
-- events and the two functions were equivalent.
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
