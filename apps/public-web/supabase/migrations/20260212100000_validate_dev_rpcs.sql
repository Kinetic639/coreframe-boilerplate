-- =====================================================
-- MIGRATION: VALIDATE DEV RPC INPUTS
-- Purpose: Add server-side validation to dev_add_module_addon
--          and dev_set_limit_override RPCs.
-- - dev_add_module_addon: validates p_module_slug exists in modules table
-- - dev_set_limit_override: validates p_limit_key against hardcoded allowlist
-- Includes REVOKE/GRANT privilege re-statements.
-- =====================================================

-- Dev: Add module addon (with module slug validation)
CREATE OR REPLACE FUNCTION public.dev_add_module_addon(
  p_org_id UUID,
  p_module_slug TEXT
)
RETURNS void AS $$
BEGIN
  PERFORM public.assert_dev_mode_enabled();
  IF NOT public.is_org_owner(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied: not org owner';
  END IF;

  -- Validate: module slug must exist in modules table
  IF NOT EXISTS (
    SELECT 1 FROM public.modules
    WHERE slug = p_module_slug AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Invalid module slug: %', p_module_slug;
  END IF;

  -- Prevent concurrent duplicate inserts for the same org+module
  PERFORM pg_advisory_xact_lock(hashtext(p_org_id::text || ':' || p_module_slug));

  -- Try to reactivate any existing row (active or canceled)
  UPDATE public.organization_module_addons
  SET status = 'active', ends_at = NULL, updated_at = NOW()
  WHERE organization_id = p_org_id
    AND module_slug = p_module_slug;

  -- If no row existed at all, insert a new one
  IF NOT FOUND THEN
    INSERT INTO public.organization_module_addons (
      organization_id,
      module_slug,
      status,
      starts_at
    ) VALUES (
      p_org_id,
      p_module_slug,
      'active',
      NOW()
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

COMMENT ON FUNCTION public.dev_add_module_addon(UUID, TEXT)
  IS 'Dev-only: Add module addon. Validates slug exists in modules table.';

-- Dev: Set limit override (with limit key allowlist validation)
CREATE OR REPLACE FUNCTION public.dev_set_limit_override(
  p_org_id UUID,
  p_limit_key TEXT,
  p_override_value INTEGER
)
RETURNS void AS $$
DECLARE
  valid_limit_keys TEXT[] := ARRAY[
    'warehouse.max_products',
    'warehouse.max_locations',
    'warehouse.max_branches',
    'organization.max_users',
    'analytics.monthly_exports'
  ];
BEGIN
  PERFORM public.assert_dev_mode_enabled();
  IF NOT public.is_org_owner(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied: not org owner';
  END IF;

  -- Validate: limit key must be in allowlist
  IF NOT (p_limit_key = ANY(valid_limit_keys)) THEN
    RAISE EXCEPTION 'Invalid limit key: %. Valid keys: %', p_limit_key, array_to_string(valid_limit_keys, ', ');
  END IF;

  INSERT INTO public.organization_limit_overrides (
    organization_id,
    limit_key,
    override_value
  ) VALUES (
    p_org_id,
    p_limit_key,
    p_override_value
  )
  ON CONFLICT (organization_id, limit_key) DO UPDATE SET
    override_value = p_override_value,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

COMMENT ON FUNCTION public.dev_set_limit_override(UUID, TEXT, INTEGER)
  IS 'Dev-only: Set limit override. Validates limit key against allowlist.';

-- Re-state privilege hardening for replaced functions
REVOKE ALL ON FUNCTION public.dev_add_module_addon(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_add_module_addon(UUID, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.dev_set_limit_override(UUID, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_set_limit_override(UUID, TEXT, INTEGER) TO authenticated, service_role;
