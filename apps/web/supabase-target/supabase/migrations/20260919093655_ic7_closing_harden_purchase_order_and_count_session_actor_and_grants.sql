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

  INSERT INTO public.inventory_settings (organization_id, created_by, updated_by)
  VALUES (p_organization_id, p_actor_user_id, p_actor_user_id)
  ON CONFLICT (organization_id) DO NOTHING;

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

REVOKE ALL ON FUNCTION public.inventory_create_purchase_order(uuid, uuid, uuid, jsonb, date, uuid, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_create_purchase_order(uuid, uuid, uuid, jsonb, date, uuid, text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_create_purchase_order(uuid, uuid, uuid, jsonb, date, uuid, text, text, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inventory_create_count_session(p_organization_id uuid, p_branch_id uuid, p_scope jsonb DEFAULT '{}'::jsonb, p_notes text DEFAULT NULL::text, p_actor_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count_id uuid;
  v_number text;
  v_count_type text;
  v_include_zero_stock boolean;
  v_location_ids uuid[];
  v_location_filter_ids uuid[];
  v_supplier_id uuid;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.audits.manage') THEN
    RAISE EXCEPTION 'Missing warehouse.audits.manage permission';
  END IF;

  v_count_type := coalesce(p_scope ->> 'count_type', 'location');
  IF v_count_type NOT IN ('location', 'supplier') THEN
    RAISE EXCEPTION 'scope.count_type must be location or supplier';
  END IF;

  v_include_zero_stock := coalesce((p_scope ->> 'include_zero_stock')::boolean, false);

  SELECT coalesce(array_agg(elem::uuid), ARRAY[]::uuid[])
  INTO v_location_ids
  FROM jsonb_array_elements_text(coalesce(p_scope -> 'location_ids', '[]'::jsonb)) AS elem;

  SELECT coalesce(array_agg(elem::uuid), ARRAY[]::uuid[])
  INTO v_location_filter_ids
  FROM jsonb_array_elements_text(coalesce(p_scope -> 'location_filter_ids', '[]'::jsonb)) AS elem;

  v_supplier_id := nullif(p_scope ->> 'supplier_id', '')::uuid;

  IF v_count_type = 'supplier' AND v_supplier_id IS NULL THEN
    RAISE EXCEPTION 'scope.supplier_id is required when count_type is supplier';
  END IF;
  IF v_count_type = 'location' AND array_length(v_location_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'scope.location_ids must not be empty when count_type is location';
  END IF;

  v_number := 'CNT-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || substr(gen_random_uuid()::text, 1, 6);

  INSERT INTO public.inventory_count_sessions (
    organization_id, branch_id, count_number, scope, notes, created_by
  )
  VALUES (
    p_organization_id, p_branch_id, upper(v_number), coalesce(p_scope, '{}'::jsonb), p_notes, p_actor_user_id
  )
  RETURNING id INTO v_count_id;

  INSERT INTO public.inventory_count_lines (
    organization_id, branch_id, count_session_id, variant_id, location_id,
    lot_id, serial_id, expected_quantity, unit_id, status, source, sequence_no
  )
  SELECT
    b.organization_id, b.branch_id, v_count_id, b.variant_id, b.location_id,
    b.lot_id, b.serial_id, b.on_hand_quantity, p.base_unit_id, 'pending', 'generated',
    row_number() OVER (ORDER BY b.location_id, b.variant_id)
  FROM public.inventory_balances b
  JOIN public.inventory_variants v
    ON v.id = b.variant_id AND v.organization_id = b.organization_id
  JOIN public.inventory_products p
    ON p.id = v.product_id AND p.organization_id = b.organization_id
  WHERE b.organization_id = p_organization_id
    AND b.branch_id = p_branch_id
    AND (v_include_zero_stock OR b.on_hand_quantity > 0)
    AND (
      (v_count_type = 'location' AND b.location_id = ANY (v_location_ids))
      OR (
        v_count_type = 'supplier'
        AND public.inventory_variant_matches_audit_supplier(
          p_organization_id,
          v.id,
          p.id,
          v.default_supplier_id,
          v_supplier_id
        )
        AND (array_length(v_location_filter_ids, 1) IS NULL OR b.location_id = ANY (v_location_filter_ids))
      )
    );

  RETURN jsonb_build_object('count_session_id', v_count_id, 'count_number', upper(v_number), 'status', 'draft');
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_create_count_session(uuid, uuid, jsonb, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_create_count_session(uuid, uuid, jsonb, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_create_count_session(uuid, uuid, jsonb, text, uuid) TO authenticated, service_role;
