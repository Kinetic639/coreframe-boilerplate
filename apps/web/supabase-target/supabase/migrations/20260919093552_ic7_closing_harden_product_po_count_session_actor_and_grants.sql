-- IC-7 CLOSING PASS -- add real actor-identity validation (established
-- p_actor_user_id IS NULL OR IS DISTINCT FROM auth.uid() -> 28000 pattern)
-- to the 4 mutation functions that already accept p_actor_user_id but never
-- validated it against auth.uid() -- LIVE-CONFIRMED actor-spoofing exploit
-- (an authenticated caller WITH the required permission could forge
-- created_by/updated_by to an arbitrary, real, different user's identity).
-- Also closes their anon/PUBLIC EXECUTE grant exposure (live-confirmed
-- rejected by body-level has_permission/has_branch_permission checks in
-- every tested anon/no-permission path -- "exposed but not exploitable
-- through tested path" -- hardened anyway per the established convention,
-- since a mutation API should never carry anon EXECUTE).
-- Business logic is byte-for-byte unchanged below the new check.

CREATE OR REPLACE FUNCTION public.inventory_create_product_with_default_variant(p_organization_id uuid, p_name text, p_product_type text, p_base_unit_id uuid, p_sku text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_actor_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_settings public.inventory_settings%ROWTYPE;
  v_product_id uuid;
  v_variant_id uuid;
  v_sku text;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_permission(p_organization_id, 'warehouse.products.manage') THEN
    RAISE EXCEPTION 'Missing warehouse.products.manage permission';
  END IF;

  IF p_base_unit_id IS NULL THEN
    RAISE EXCEPTION 'Base unit is required';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  INSERT INTO public.inventory_settings (organization_id, created_by, updated_by)
  VALUES (p_organization_id, p_actor_user_id, p_actor_user_id)
  ON CONFLICT (organization_id) DO NOTHING;

  SELECT *
  INTO v_settings
  FROM public.inventory_settings
  WHERE organization_id = p_organization_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory settings unavailable';
  END IF;

  IF p_sku IS NULL OR length(trim(p_sku)) = 0 THEN
    IF NOT v_settings.sku_generation_enabled THEN
      RAISE EXCEPTION 'SKU is required when SKU generation is disabled';
    END IF;

    v_sku := public.inventory_build_sku_from_pattern(
      v_settings.sku_pattern,
      v_settings.sku_prefix,
      p_name,
      coalesce(p_product_type, 'stocked'),
      v_settings.sku_next,
      v_settings.sku_sequence_padding
    );

    UPDATE public.inventory_settings
    SET sku_next = sku_next + 1,
        updated_by = p_actor_user_id
    WHERE id = v_settings.id;
  ELSE
    v_sku := trim(p_sku);
  END IF;

  INSERT INTO public.inventory_products (
    organization_id,
    name,
    description,
    product_type,
    base_unit_id,
    created_by,
    updated_by
  )
  VALUES (
    p_organization_id,
    trim(p_name),
    p_description,
    coalesce(p_product_type, 'stocked'),
    p_base_unit_id,
    p_actor_user_id,
    p_actor_user_id
  )
  RETURNING id INTO v_product_id;

  INSERT INTO public.inventory_variants (
    organization_id,
    product_id,
    sku,
    name,
    is_default,
    created_by,
    updated_by
  )
  VALUES (
    p_organization_id,
    v_product_id,
    v_sku,
    'Default',
    true,
    p_actor_user_id,
    p_actor_user_id
  )
  RETURNING id INTO v_variant_id;

  UPDATE public.inventory_products
  SET default_variant_id = v_variant_id,
      updated_by = p_actor_user_id
  WHERE id = v_product_id
    AND organization_id = p_organization_id;

  RETURN jsonb_build_object(
    'product_id', v_product_id,
    'variant_id', v_variant_id,
    'sku', v_sku
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_create_product_with_default_variant(uuid, text, text, uuid, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_create_product_with_default_variant(uuid, text, text, uuid, text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_create_product_with_default_variant(uuid, text, text, uuid, text, text, uuid) TO authenticated, service_role;
