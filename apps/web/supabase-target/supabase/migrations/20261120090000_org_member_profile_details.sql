-- Public profile details of org members.
--
-- The public member profile showed only first/last name and email: the display
-- name, phone, position and branch a member sets live in tables other members
-- cannot read (user_preferences is owner-only). `org_member_profile_details`
-- returns exactly those approved fields to active members of the same org.

CREATE OR REPLACE FUNCTION public.org_member_profile_details(p_org uuid, p_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  display_name text,
  phone text,
  job_title text,
  branch_name text,
  joined_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    om.user_id,
    nullif(btrim(p.display_name), ''),
    nullif(btrim(p.phone), ''),
    (SELECT pos.name
       FROM public.org_position_assignments a
       JOIN public.org_positions pos ON pos.id = a.position_id AND pos.deleted_at IS NULL
      WHERE a.org_id = p_org AND a.user_id = om.user_id AND a.deleted_at IS NULL
      ORDER BY a.created_at
      LIMIT 1),
    b.name,
    coalesce(om.joined_at, om.created_at)
  FROM public.organization_members om
  LEFT JOIN public.user_preferences p ON p.user_id = om.user_id AND p.deleted_at IS NULL
  LEFT JOIN public.branches b
    ON b.id = p.default_branch_id AND b.organization_id = p_org AND b.deleted_at IS NULL
  WHERE om.organization_id = p_org
    AND om.user_id = ANY (p_user_ids[1:300])
    AND om.status = 'active'
    AND om.deleted_at IS NULL
    AND public.is_org_member(p_org);
$$;

REVOKE ALL ON FUNCTION public.org_member_profile_details(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_member_profile_details(uuid, uuid[]) TO authenticated;
