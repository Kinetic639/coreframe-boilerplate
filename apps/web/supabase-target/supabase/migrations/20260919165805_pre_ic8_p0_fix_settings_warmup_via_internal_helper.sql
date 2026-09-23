-- PRE-IC8 P0 -- forward correction, self-caught by the full 097-112
-- regression run. `inventory_create_product_with_default_variant` and
-- `inventory_create_purchase_order` are SECURITY INVOKER (confirmed
-- live, prosecdef=false) and each does its own inline org-settings
-- warm-up (`INSERT ... ON CONFLICT (organization_id) DO NOTHING`)
-- BEFORE this pass's own REVOKE. Because they are INVOKER, that INSERT
-- runs as the CALLING role (`authenticated`), and the REVOKE of INSERT
-- on inventory_settings from authenticated (settings kept only UPDATE,
-- for the real settings-manager path) now breaks this warm-up for
-- every legitimate, correctly-permissioned caller of these two RPCs
-- (and transitively `inventory_create_enhanced_product`, which calls
-- `inventory_create_product_with_default_variant` internally -- also
-- INVOKER, so the nested call is not elevated either). Live-confirmed:
-- `inventory_create_allocation`/`inventory_create_branch_transfer`/
-- `inventory_create_reservation` all already do this same warm-up but
-- are already SECURITY DEFINER, so they were never affected.
--
-- Fix: extract the warm-up into one narrow SECURITY DEFINER internal
-- helper (matching the established pattern already used throughout
-- this project -- e.g. inventory_get_or_create_balance_for_update,
-- inventory_finalize_posting_internal) and have the two broken
-- functions call it instead of inlining the raw INSERT. This is
-- deliberately narrower than converting either function to SECURITY
-- DEFINER outright, which would also elevate their OTHER writes
-- (inventory_products/inventory_variants/inventory_purchase_orders/
-- inventory_purchase_order_lines) and change their RLS-interaction
-- model well beyond this pass's own narrow scope ("do NOT redesign
-- Inventory Core"). No other logic in either function changes.

CREATE OR REPLACE FUNCTION public.inventory_ensure_settings_row_internal(p_organization_id uuid, p_actor_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.inventory_settings (organization_id, created_by, updated_by)
  VALUES (p_organization_id, p_actor_user_id, p_actor_user_id)
  ON CONFLICT (organization_id) DO NOTHING;
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_ensure_settings_row_internal(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_ensure_settings_row_internal(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.inventory_ensure_settings_row_internal(uuid, uuid) FROM authenticated;

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

  PERFORM public.inventory_ensure_settings_row_internal(p_organization_id, p_actor_user_id);

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

CREATE OR REPLACE FUNCTION public.inventory_create_purchase_order(p_organization_id uuid, p_branch_id uuid, p_supplier_id uuid, p_lines jsonb, p_expected_delivery_date date DEFAULT NULL::date, p_delivery_location_id uuid DEFAULT NULL::uuid, p_currency text DEFAULT 'PLN'::text, p_notes text DEFAULT NULL::text, p_actor_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_settings public.inventory_settings%ROWTYPE;
  v_po_id uuid;
  v_po_number text;
  v_line jsonb;
  v_line_number integer := 0;
  v_total numeric(18, 6) := 0;
  v_product_id uuid;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.procurement.manage') THEN
    RAISE EXCEPTION 'Missing warehouse.procurement.manage permission';
  END IF;

  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one purchase order line is required';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  PERFORM public.inventory_ensure_settings_row_internal(p_organization_id, p_actor_user_id);

  SELECT * INTO v_settings
  FROM public.inventory_settings
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  v_po_number :=
    v_settings.purchase_order_number_prefix || '-' || lpad(v_settings.purchase_order_number_next::text, 6, '0');

  UPDATE public.inventory_settings
  SET purchase_order_number_next = purchase_order_number_next + 1,
      updated_by = p_actor_user_id
  WHERE id = v_settings.id;

  INSERT INTO public.inventory_purchase_orders (
    organization_id, branch_id, po_number, supplier_id, status,
    expected_delivery_date, delivery_location_id, currency, notes, created_by
  )
  VALUES (
    p_organization_id, p_branch_id, v_po_number, p_supplier_id, 'ordered',
    p_expected_delivery_date, p_delivery_location_id, coalesce(p_currency, 'PLN'), p_notes, p_actor_user_id
  )
  RETURNING id INTO v_po_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_line_number := v_line_number + 1;

    SELECT p.id INTO v_product_id
    FROM public.inventory_variants v
    JOIN public.inventory_products p
      ON p.id = v.product_id AND p.organization_id = v.organization_id
    WHERE v.id = (v_line ->> 'variant_id')::uuid
      AND v.organization_id = p_organization_id
      AND v.deleted_at IS NULL
      AND p.deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Purchase order variant is invalid';
    END IF;

    v_total := v_total + ((v_line ->> 'quantity')::numeric * coalesce(nullif(v_line ->> 'unit_cost', '')::numeric, 0));

    INSERT INTO public.inventory_purchase_order_lines (
      organization_id, branch_id, purchase_order_id, line_number, product_id, variant_id,
      unit_id, ordered_quantity, unit_cost, total_cost
    )
    VALUES (
      p_organization_id, p_branch_id, v_po_id, v_line_number, v_product_id,
      (v_line ->> 'variant_id')::uuid,
      (v_line ->> 'unit_id')::uuid,
      (v_line ->> 'quantity')::numeric,
      coalesce(nullif(v_line ->> 'unit_cost', '')::numeric, 0),
      (v_line ->> 'quantity')::numeric * coalesce(nullif(v_line ->> 'unit_cost', '')::numeric, 0)
    );
  END LOOP;

  UPDATE public.inventory_purchase_orders
  SET total = v_total
  WHERE id = v_po_id;

  RETURN jsonb_build_object('purchase_order_id', v_po_id, 'po_number', v_po_number, 'status', 'ordered');
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_create_product_with_default_variant(uuid, text, text, uuid, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_create_product_with_default_variant(uuid, text, text, uuid, text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_create_product_with_default_variant(uuid, text, text, uuid, text, text, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.inventory_create_purchase_order(uuid, uuid, uuid, jsonb, date, uuid, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_create_purchase_order(uuid, uuid, uuid, jsonb, date, uuid, text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_create_purchase_order(uuid, uuid, uuid, jsonb, date, uuid, text, text, uuid) TO authenticated, service_role;
