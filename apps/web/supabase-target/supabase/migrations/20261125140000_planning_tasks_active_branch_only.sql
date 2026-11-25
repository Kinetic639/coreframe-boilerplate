-- =============================================================================
-- Planning: branch tasks are visible only in the user's active branch.
--
-- Until now planning_tasks_select let anyone with an organization-wide
-- planning.tasks.read see the tasks of every branch, whatever branch they had
-- active. Now:
--   * organization tasks (branch_id IS NULL) stay visible to everyone with the
--     read permission, as before;
--   * a branch task is visible only when that branch is the user's active
--     branch in its organization (and the read permission still applies, from
--     planning_tasks_select: org-wide or for that branch).
--
-- The active branch is the one the app shows in the branch switcher. The
-- switcher writes it to user_preferences.default_branch_id; the dashboard
-- loader (resolveActiveBranch in @repo/domain) then checks it:
--   1. preferred = default_branch_id if it is a live branch of the organization,
--      else the organization's first branch (by created_at);
--   2. accessible = every branch with branches.view.any (org-wide or for the
--      preferred branch), else the branches the user has a role in;
--   3. active = preferred if accessible, else the first accessible branch.
-- planning_my_active_branch_ids() applies the same rules, once per query, for
-- every organization the user belongs to.
--
-- The new policy is RESTRICTIVE and FOR SELECT only, so it narrows reads (list,
-- detail, boards, calendar, search, realtime, and the child tables whose
-- policies read planning_tasks under RLS) without touching write rules.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.planning_my_active_branch_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  WITH me AS (
    SELECT auth.uid() AS uid
  ),
  pref AS (
    SELECT p.default_branch_id
    FROM public.user_preferences p, me
    WHERE p.user_id = me.uid
    LIMIT 1
  ),
  orgs AS (
    SELECT om.organization_id AS org_id
    FROM public.organization_members om, me
    WHERE om.user_id = me.uid
      AND om.status = 'active'
      AND om.deleted_at IS NULL
  ),
  preferred AS (
    SELECT o.org_id,
      COALESCE(
        (SELECT b.id FROM public.branches b
          WHERE b.organization_id = o.org_id AND b.deleted_at IS NULL
            AND b.id = (SELECT default_branch_id FROM pref)),
        (SELECT b.id FROM public.branches b
          WHERE b.organization_id = o.org_id AND b.deleted_at IS NULL
          ORDER BY b.created_at ASC, b.id ASC LIMIT 1)
      ) AS branch_id
    FROM orgs o
  ),
  view_any AS (
    SELECT pr.org_id,
      EXISTS (
        SELECT 1 FROM public.user_effective_permissions e, me
        WHERE e.user_id = me.uid
          AND e.organization_id = pr.org_id
          AND e.permission_slug_exact = 'branches.view.any'
          AND (e.branch_id IS NULL OR e.branch_id = pr.branch_id)
      ) AS yes,
      pr.branch_id AS preferred_id
    FROM preferred pr
  )
  SELECT COALESCE(
    -- the preferred branch, when the user may use it
    (SELECT va.preferred_id
      WHERE va.preferred_id IS NOT NULL
        AND (
          va.yes
          OR EXISTS (
            SELECT 1 FROM public.user_role_assignments a, me
            WHERE a.user_id = me.uid AND a.scope = 'branch'
              AND a.scope_id = va.preferred_id AND a.deleted_at IS NULL
          )
        )),
    -- else the first branch the user may use
    (SELECT b.id FROM public.branches b
      WHERE b.organization_id = va.org_id AND b.deleted_at IS NULL
        AND (
          va.yes
          OR EXISTS (
            SELECT 1 FROM public.user_role_assignments a, me
            WHERE a.user_id = me.uid AND a.scope = 'branch'
              AND a.scope_id = b.id AND a.deleted_at IS NULL
          )
        )
      ORDER BY b.created_at ASC, b.id ASC LIMIT 1)
  )
  FROM view_any va;
$$;

REVOKE ALL ON FUNCTION public.planning_my_active_branch_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.planning_my_active_branch_ids() TO authenticated, service_role;

DROP POLICY IF EXISTS planning_tasks_active_branch ON public.planning_tasks;
CREATE POLICY planning_tasks_active_branch ON public.planning_tasks
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    branch_id IS NULL
    OR branch_id = ANY (ARRAY(SELECT public.planning_my_active_branch_ids()))
  );
