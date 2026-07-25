-- Migration: Fix JWT custom access token hook claim shape
-- Date: 2026-03-18
-- Purpose: Align DB hook output with TypeScript JWTRole interface
--
-- ROOT CAUSE (G1 audit finding):
--   The live DB hook injected roles into claims.app_metadata.roles with
--   field name 'name' for the role. TypeScript reads decoded.roles (root-level)
--   and expects field name 'role' (not 'name'), 'org_id', 'branch_id'.
--   This caused getUserRolesFromJWT() to always return [] and all
--   HasAnyRole* components to permanently show their fallback.
--
-- FIX:
--   Rebuild the hook to:
--     1. Inject roles at root-level claims.roles  (matches decoded.roles)
--     2. Use field names matching JWTRole in src/lib/types/auth.ts:
--        role_id, role, org_id, branch_id, scope, scope_id
--     3. Handle both camelCase userId (legacy hook format) and snake_case
--        user_id (Supabase v2 hook format) via COALESCE — safe against
--        future Supabase event shape changes.
--
-- CANONICAL JWT ROLE SHAPE AFTER THIS MIGRATION:
--   jwt.roles = [
--     {
--       "role_id":   "<uuid>",
--       "role":      "<role_name>",   -- e.g. "org_owner"
--       "org_id":    "<uuid>|null",   -- set when scope = 'org'
--       "branch_id": "<uuid>|null",   -- set when scope = 'branch'
--       "scope":     "org|branch",
--       "scope_id":  "<uuid>"
--     }
--   ]
--
-- TypeScript interface this matches (src/lib/types/auth.ts):
--   interface JWTRole {
--     role_id: string;
--     role: string;
--     org_id: string | null;
--     branch_id: string | null;
--     scope: "org" | "branch";
--     scope_id: string;
--   }

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claims    jsonb;
  v_user_id uuid;
  user_roles jsonb;
BEGIN
  -- Support both snake_case (Supabase v2 hooks) and camelCase (legacy hooks).
  -- COALESCE tries snake_case first, then camelCase, to ensure forward-compat.
  v_user_id := COALESCE(
    (event->>'user_id')::uuid,
    (event->>'userId')::uuid
  );

  claims := event->'claims';

  -- Build roles array from user_role_assignments with complete role metadata.
  -- Field names are fixed to match src/lib/types/auth.ts JWTRole interface:
  --   role_id, role, org_id, branch_id, scope, scope_id
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'role_id',   ura.role_id,
        'role',      r.name,
        'org_id',    CASE WHEN ura.scope = 'org'    THEN ura.scope_id ELSE NULL END,
        'branch_id', CASE WHEN ura.scope = 'branch' THEN ura.scope_id ELSE NULL END,
        'scope',     ura.scope,
        'scope_id',  ura.scope_id
      )
    ),
    '[]'::jsonb
  )
  INTO user_roles
  FROM public.user_role_assignments ura
  JOIN public.roles r ON r.id = ura.role_id
  WHERE ura.user_id = v_user_id
    AND ura.deleted_at IS NULL
    AND r.deleted_at IS NULL;

  -- Inject roles at ROOT-LEVEL claims.roles.
  -- This is the path TypeScript reads: decoded.roles (via getUserRolesFromJWT).
  -- Do NOT put roles in app_metadata — that path is NOT read by any TS code.
  claims := jsonb_set(claims, '{roles}', user_roles, true);

  RETURN jsonb_set(event, '{claims}', claims, true);
END;
$$;

COMMENT ON FUNCTION public.custom_access_token_hook IS
  'Injects user role assignments into JWT claims on token generation. '
  'Roles are injected at root-level claims.roles (not app_metadata). '
  'Field names match src/lib/types/auth.ts JWTRole: role_id, role, org_id, branch_id, scope, scope_id.';
