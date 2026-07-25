CREATE OR REPLACE FUNCTION public.get_my_pending_invitations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_email   TEXT;
  v_results JSONB;
BEGIN
  SELECT email INTO v_email
    FROM auth.users
    WHERE id = auth.uid();

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id',          inv.id,
      'token',       inv.token,
      'expires_at',  inv.expires_at,
      'org_name',    op.name,
      'org_name_2',  op.name_2,
      'role_name',   r.name,
      'branch_name', b.name
    )
    ORDER BY inv.created_at DESC
  )
  INTO v_results
  FROM public.invitations inv
  LEFT JOIN public.organization_profiles op
         ON op.organization_id = inv.organization_id
  LEFT JOIN public.roles r
         ON r.id = inv.role_id AND r.deleted_at IS NULL
  LEFT JOIN public.branches b
         ON b.id = inv.branch_id AND b.deleted_at IS NULL
  WHERE lower(inv.email)  = lower(v_email)
    AND inv.status        = 'pending'
    AND (inv.expires_at IS NULL OR inv.expires_at > now())
    AND inv.deleted_at    IS NULL;

  RETURN jsonb_build_object(
    'success',     true,
    'invitations', COALESCE(v_results, '[]'::jsonb)
  );
END;
$$;
