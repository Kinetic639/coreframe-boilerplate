-- Create a simple authorize() wrapper for RLS policies
-- This function provides a simpler interface for RLS policies to check permissions
-- It wraps the existing authorize() function that returns detailed JSON

-- The function is SECURITY DEFINER to bypass RLS when checking permissions
-- This prevents infinite recursion in RLS policies

CREATE OR REPLACE FUNCTION public.authorize(
  required_permission text,
  org_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  user_id uuid;
  result jsonb;
BEGIN
  -- Get current user ID from auth context
  user_id := (SELECT auth.uid());

  -- If no user is authenticated, deny access
  IF user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Call the existing authorize function with the required permission
  result := public.authorize(
    user_id := user_id,
    required_permissions := ARRAY[required_permission],
    required_roles := ARRAY[]::text[],
    organization_id := org_id,
    branch_id := NULL
  );

  -- Extract the authorized boolean from the result
  RETURN (result->>'authorized')::boolean;
END;
$$;

-- Grant execute to authenticated and anon users so they can use this in RLS policies
GRANT EXECUTE ON FUNCTION public.authorize(text, uuid) TO authenticated, anon;

-- Add helpful comment
COMMENT ON FUNCTION public.authorize(text, uuid) IS
  'Simple wrapper for RLS policies. Checks if the current user has the specified permission within the given organization context. Returns true if authorized, false otherwise. Uses SECURITY DEFINER to bypass RLS when checking permissions to prevent infinite recursion.';
