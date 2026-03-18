-- Drop and recreate the JWT custom hook to use user_role_assignments table
-- This updates the hook to work with the new RBAC system

DROP FUNCTION IF EXISTS public.custom_access_token_hook(jsonb);

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  user_roles jsonb;
BEGIN
  claims := event->'claims';

  -- Build roles array from user_role_assignments with complete role metadata
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'role_id', ura.role_id,
        'role', r.name,
        'org_id', CASE WHEN ura.scope = 'org' THEN ura.scope_id ELSE NULL END,
        'branch_id', CASE WHEN ura.scope = 'branch' THEN ura.scope_id ELSE NULL END,
        'scope', ura.scope,
        'scope_id', ura.scope_id
      )
    ),
    '[]'::jsonb
  )
  INTO user_roles
  FROM public.user_role_assignments ura
  JOIN public.roles r ON ura.role_id = r.id
  WHERE ura.user_id = (event->>'user_id')::uuid
    AND ura.deleted_at IS NULL
    AND r.deleted_at IS NULL;

  -- Inject roles into JWT claims
  claims := jsonb_set(claims, '{roles}', user_roles, true);

  -- Update event with new claims
  event := jsonb_set(event, '{claims}', claims, true);

  RETURN event;
END;
$$;

COMMENT ON FUNCTION public.custom_access_token_hook IS
  'Injects user role assignments into JWT claims on token generation. Uses user_role_assignments table with scope-based roles (org/branch).';
