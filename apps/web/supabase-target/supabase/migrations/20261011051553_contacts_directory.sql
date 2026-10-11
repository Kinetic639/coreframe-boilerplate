-- =============================================================================
-- Contacts directory: employees + external contacts in one list
--
-- Employees are NOT copied into crm_contacts. They are read live from their
-- profiles (users, user_preferences.phone, position, default branch), so the
-- list is always current and a person who leaves the organization disappears.
-- External contacts stay in crm_contacts under their own RLS.
--
--   org_member_directory(org)   SECURITY DEFINER — active members with the
--                               business contact fields of their profile. The
--                               phone lives in user_preferences (own-row RLS),
--                               hence DEFINER; gated by is_org_member().
--   contacts_directory(...)     SECURITY INVOKER — members + crm_contacts the
--                               caller may read (RLS), one row per person: a
--                               contact linked to a member (advisor) is merged
--                               into the member's row. Search, kind filter,
--                               paging and totals in the database.
-- Every member of the organization sees the employees; external contacts need
-- crm.contacts.read as before.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.org_member_directory(p_org uuid)
RETURNS TABLE (
  user_id uuid, first_name text, last_name text, email text,
  avatar_url text, avatar_path text, phone text, job_title text,
  branch_id uuid, branch_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    u.id, u.first_name, u.last_name, u.email, u.avatar_url, u.avatar_path,
    nullif(btrim(p.phone), ''),
    (SELECT pos.name
     FROM public.org_position_assignments a
     JOIN public.org_positions pos ON pos.id = a.position_id AND pos.deleted_at IS NULL
     WHERE a.org_id = p_org AND a.user_id = u.id AND a.deleted_at IS NULL
     ORDER BY a.created_at LIMIT 1),
    b.id, b.name
  FROM public.organization_members om
  JOIN public.users u ON u.id = om.user_id AND u.deleted_at IS NULL
  LEFT JOIN public.user_preferences p ON p.user_id = u.id AND p.deleted_at IS NULL
  LEFT JOIN public.branches b
    ON b.id = p.default_branch_id AND b.organization_id = p_org AND b.deleted_at IS NULL
  WHERE om.organization_id = p_org
    AND om.status = 'active'
    AND om.deleted_at IS NULL
    AND public.is_org_member(p_org);
$$;

REVOKE ALL ON FUNCTION public.org_member_directory(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_member_directory(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.contacts_directory(
  p_org    uuid,
  p_kind   text DEFAULT 'all',      -- 'all' | 'member' | 'external'
  p_search text DEFAULT NULL,
  p_desc   boolean DEFAULT false,
  p_limit  integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_key    text DEFAULT NULL        -- one row: 'member:<user id>' or a contact id
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
  WITH members AS (
    SELECT * FROM public.org_member_directory(p_org)
  ),
  rows AS (
    SELECT
      'member:' || m.user_id::text AS key,
      'member'::text AS kind,
      m.user_id,
      lc.id AS contact_id,
      coalesce(nullif(btrim(concat_ws(' ', m.first_name, m.last_name)), ''), m.email, '') AS display_name,
      m.first_name, m.last_name, m.email,
      coalesce(m.phone, lc.phone) AS phone,
      lc.mobile,
      coalesce(m.job_title, lc.job_title) AS job_title,
      m.branch_id, m.branch_name,
      m.avatar_url, m.avatar_path,
      NULL::text AS visibility_scope,
      NULL::timestamptz AS created_at
    FROM members m
    LEFT JOIN LATERAL (
      SELECT c.id, c.phone, c.mobile, c.job_title
      FROM public.crm_contacts c
      WHERE c.organization_id = p_org AND c.linked_user_id = m.user_id AND c.deleted_at IS NULL
      ORDER BY c.created_at LIMIT 1
    ) lc ON true
    UNION ALL
    SELECT
      c.id::text, 'external', NULL::uuid, c.id,
      c.display_name, c.first_name, c.last_name, c.email, c.phone, c.mobile, c.job_title,
      c.branch_id, b.name,
      NULL::text, c.avatar_storage_path,
      c.visibility_scope, c.created_at
    FROM public.crm_contacts c
    LEFT JOIN public.branches b ON b.id = c.branch_id
    WHERE c.organization_id = p_org
      AND c.deleted_at IS NULL
      -- A contact linked to an active member is shown on the member's row
      AND NOT EXISTS (SELECT 1 FROM members m WHERE m.user_id = c.linked_user_id)
  ),
  searched AS (
    SELECT * FROM rows r
    WHERE (p_key IS NULL OR r.key = p_key)
      AND (
        nullif(btrim(coalesce(p_search, '')), '') IS NULL
        OR position(lower(btrim(p_search)) IN lower(concat_ws(' ',
             r.display_name, r.first_name, r.last_name, r.email, r.phone, r.mobile, r.job_title))) > 0
      )
  ),
  filtered AS (
    SELECT * FROM searched r
    WHERE coalesce(p_kind, 'all') = 'all' OR r.kind = p_kind
  )
  SELECT jsonb_build_object(
    'rows', coalesce((
      SELECT jsonb_agg(to_jsonb(page))
      FROM (
        SELECT * FROM filtered
        ORDER BY
          CASE WHEN p_desc THEN lower(display_name) END DESC,
          CASE WHEN NOT p_desc THEN lower(display_name) END ASC,
          key
        LIMIT least(greatest(coalesce(p_limit, 50), 1), 200)
        OFFSET greatest(coalesce(p_offset, 0), 0)
      ) page
    ), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtered),
    'member_count', (SELECT count(*) FROM searched WHERE kind = 'member'),
    'external_count', (SELECT count(*) FROM searched WHERE kind = 'external')
  );
$$;

REVOKE ALL ON FUNCTION public.contacts_directory(uuid, text, text, boolean, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contacts_directory(uuid, text, text, boolean, integer, integer, text) TO authenticated;
