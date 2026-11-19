-- =============================================================================
-- Dashboard context in one request.
--
-- Every dashboard page and many server actions build the dashboard context
-- (loadDashboardContextV2). It used to take 6 to 8 separate PostgREST
-- requests: preferences, the preferred organization, the organization with
-- its profile, branches, the users row, org-scope permissions, branch-scope
-- permissions and, without branches.view.any, the branch role assignments.
-- That was the largest single source of requests to Supabase.
--
-- This function returns the same data in one call. It is SECURITY INVOKER:
-- every read goes through the caller's RLS exactly as the separate requests
-- did, so it cannot return anything the user could not read before.
--
-- The organization is resolved with the same fallback as the app loader:
--   1. user_preferences.organization_id, if that organization is not deleted
--   2. the oldest organization where the user has an org-scope role
--   3. the oldest organization the user created
-- Branch choice and the permission snapshot stay in TypeScript: the function
-- returns branch permissions for every branch of the organization, so the
-- loader can pick the branch and build the snapshot without another request.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_context_v2()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pref_org uuid;
  v_pref_branch uuid;
  v_org uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.organization_id, p.default_branch_id
    INTO v_pref_org, v_pref_branch
  FROM public.user_preferences p
  WHERE p.user_id = v_uid
  LIMIT 1;

  IF v_pref_org IS NOT NULL THEN
    SELECT o.id INTO v_org
    FROM public.organizations o
    WHERE o.id = v_pref_org AND o.deleted_at IS NULL;
  END IF;

  IF v_org IS NULL THEN
    SELECT o.id INTO v_org
    FROM public.organizations o
    WHERE o.id IN (
        SELECT a.scope_id FROM public.user_role_assignments a
        WHERE a.user_id = v_uid AND a.scope = 'org' AND a.deleted_at IS NULL
      )
      AND o.deleted_at IS NULL
    ORDER BY o.created_at ASC
    LIMIT 1;
  END IF;

  IF v_org IS NULL THEN
    SELECT o.id INTO v_org
    FROM public.organizations o
    WHERE o.created_by = v_uid AND o.deleted_at IS NULL
    ORDER BY o.created_at ASC
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'preferences', jsonb_build_object(
      'organization_id', v_pref_org,
      'default_branch_id', v_pref_branch
    ),
    'active_org_id', v_org,
    'org', (
      SELECT jsonb_build_object(
        'id', o.id,
        'name', o.name,
        'slug', o.slug,
        'profile', (
          SELECT jsonb_build_object(
            'name', op.name,
            'name_2', op.name_2,
            'slug', op.slug,
            'logo_url', op.logo_url
          )
          FROM public.organization_profiles op
          WHERE op.organization_id = o.id
          LIMIT 1
        )
      )
      FROM public.organizations o
      WHERE o.id = v_org AND o.deleted_at IS NULL
    ),
    'branches', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', b.id,
          'name', b.name,
          'organization_id', b.organization_id,
          'branch_number', b.branch_number,
          'slug', b.slug,
          'public_warehouse_maps_enabled', b.public_warehouse_maps_enabled,
          'created_at', b.created_at
        )
        ORDER BY b.created_at ASC
      )
      FROM public.branches b
      WHERE b.organization_id = v_org AND b.deleted_at IS NULL
    ), '[]'::jsonb),
    'user', (
      SELECT jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'first_name', u.first_name,
        'last_name', u.last_name,
        'avatar_url', u.avatar_url,
        'avatar_path', u.avatar_path
      )
      FROM public.users u
      WHERE u.id = v_uid
    ),
    'org_permissions', COALESCE((
      SELECT jsonb_agg(DISTINCT e.permission_slug_exact)
      FROM public.user_effective_permissions e
      WHERE e.user_id = v_uid AND e.organization_id = v_org AND e.branch_id IS NULL
    ), '[]'::jsonb),
    'branch_permissions', COALESCE((
      SELECT jsonb_object_agg(x.branch_id, x.slugs)
      FROM (
        SELECT e.branch_id, jsonb_agg(DISTINCT e.permission_slug_exact) AS slugs
        FROM public.user_effective_permissions e
        WHERE e.user_id = v_uid AND e.organization_id = v_org AND e.branch_id IS NOT NULL
        GROUP BY e.branch_id
      ) x
    ), '{}'::jsonb),
    'branch_assignment_ids', COALESCE((
      SELECT jsonb_agg(DISTINCT a.scope_id)
      FROM public.user_role_assignments a
      WHERE a.user_id = v_uid AND a.scope = 'branch' AND a.deleted_at IS NULL
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_context_v2() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_context_v2() TO authenticated;
