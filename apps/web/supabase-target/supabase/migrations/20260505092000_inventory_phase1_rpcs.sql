-- =============================================================================
-- Migration: inventory_phase1_rpcs
-- Project:   rjeraydumwechpjjzrus (TARGET)
-- Phase:     Ambra Inventory V2 Phase 1 — Transactional RPCs
-- =============================================================================
-- These functions are called with the authenticated Supabase client. They keep
-- stock changes server-side, validate exact permissions, use row locks for
-- sequence/balance writes, and mark protected writes with a transaction-local
-- engine flag consumed by table triggers.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.inventory_create_product_with_default_variant(
  p_organization_id uuid,
  p_name text,
  p_product_type text,
  p_base_unit_id uuid,
  p_sku text default null,
  p_description text default null,
  p_actor_user_id uuid default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_settings public.inventory_settings%ROWTYPE;
  v_product_id uuid;
  v_variant_id uuid;
  v_sku text;
BEGIN
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

    v_sku := v_settings.sku_prefix || '-' || lpad(v_settings.sku_next::text, 6, '0');

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
$$;

CREATE OR REPLACE FUNCTION public.inventory_create_draft_movement(
  p_organization_id uuid,
  p_branch_id uuid,
  p_movement_kind text,
  p_lines jsonb,
  p_adjustment_direction text default null,
  p_reason_id uuid default null,
  p_note text default null,
  p_reference_type text default null,
  p_reference_id text default null,
  p_idempotency_key text default null,
  p_actor_user_id uuid default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_settings public.inventory_settings%ROWTYPE;
  v_reason public.inventory_movement_reasons%ROWTYPE;
  v_movement_id uuid;
  v_movement_number text;
  v_line jsonb;
  v_line_number integer := 0;
  v_existing public.inventory_movement_headers%ROWTYPE;
BEGIN
  IF p_movement_kind NOT IN ('receipt', 'issue', 'transfer', 'adjustment', 'opening_balance') THEN
    RAISE EXCEPTION 'Unsupported movement kind';
  END IF;

  IF p_movement_kind = 'adjustment' THEN
    IF p_adjustment_direction NOT IN ('increase', 'decrease') THEN
      RAISE EXCEPTION 'Adjustment direction is required';
    END IF;
    IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.adjust') THEN
      RAISE EXCEPTION 'Missing warehouse.inventory.adjust permission';
    END IF;
  ELSE
    IF p_adjustment_direction IS NOT NULL THEN
      RAISE EXCEPTION 'Adjustment direction is only valid for adjustment movements';
    END IF;
    IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate') THEN
      RAISE EXCEPTION 'Missing warehouse.inventory.operate permission';
    END IF;
  END IF;

  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one movement line is required';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT *
    INTO v_existing
    FROM public.inventory_movement_headers
    WHERE organization_id = p_organization_id
      AND idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'movement_id', v_existing.id,
        'movement_number', v_existing.movement_number,
        'status', v_existing.status
      );
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.branches
    WHERE id = p_branch_id
      AND organization_id = p_organization_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Branch does not belong to organization';
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

  v_movement_number :=
    v_settings.movement_number_prefix || '-' || lpad(v_settings.movement_number_next::text, 6, '0');

  UPDATE public.inventory_settings
  SET movement_number_next = movement_number_next + 1,
      updated_by = p_actor_user_id
  WHERE id = v_settings.id;

  IF p_reason_id IS NOT NULL THEN
    SELECT *
    INTO v_reason
    FROM public.inventory_movement_reasons
    WHERE id = p_reason_id
      AND organization_id = p_organization_id
      AND deleted_at IS NULL
      AND is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Movement reason is invalid';
    END IF;

    IF array_length(v_reason.applies_to, 1) IS NOT NULL
       AND NOT (p_movement_kind = ANY(v_reason.applies_to)) THEN
      RAISE EXCEPTION 'Movement reason does not apply to movement kind';
    END IF;

    IF v_reason.requires_note AND (p_note IS NULL OR length(trim(p_note)) = 0) THEN
      RAISE EXCEPTION 'Movement reason requires a note';
    END IF;
  END IF;

  INSERT INTO public.inventory_movement_headers (
    organization_id,
    branch_id,
    movement_number,
    movement_kind,
    adjustment_direction,
    status,
    reason_id,
    reason_code,
    note,
    reference_type,
    reference_id,
    idempotency_key,
    created_by
  )
  VALUES (
    p_organization_id,
    p_branch_id,
    v_movement_number,
    p_movement_kind,
    p_adjustment_direction,
    'draft',
    p_reason_id,
    v_reason.code,
    p_note,
    p_reference_type,
    p_reference_id,
    p_idempotency_key,
    p_actor_user_id
  )
  RETURNING id INTO v_movement_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_line_number := v_line_number + 1;

    INSERT INTO public.inventory_movement_lines (
      organization_id,
      branch_id,
      movement_id,
      line_number,
      variant_id,
      source_location_id,
      destination_location_id,
      unit_id,
      quantity,
      unit_cost,
      total_cost,
      currency,
      note
    )
    VALUES (
      p_organization_id,
      p_branch_id,
      v_movement_id,
      v_line_number,
      (v_line ->> 'variant_id')::uuid,
      nullif(v_line ->> 'source_location_id', '')::uuid,
      nullif(v_line ->> 'destination_location_id', '')::uuid,
      (v_line ->> 'unit_id')::uuid,
      (v_line ->> 'quantity')::numeric,
      nullif(v_line ->> 'unit_cost', '')::numeric,
      nullif(v_line ->> 'total_cost', '')::numeric,
      nullif(v_line ->> 'currency', ''),
      nullif(v_line ->> 'note', '')
    );
  END LOOP;

  RETURN jsonb_build_object(
    'movement_id', v_movement_id,
    'movement_number', v_movement_number,
    'status', 'draft'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.inventory_get_or_create_balance_for_update(
  p_organization_id uuid,
  p_branch_id uuid,
  p_location_id uuid,
  p_variant_id uuid,
  p_movement_id uuid
)
RETURNS public.inventory_balances
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_balance public.inventory_balances%ROWTYPE;
BEGIN
  INSERT INTO public.inventory_balances (
    organization_id,
    branch_id,
    location_id,
    variant_id,
    last_movement_id,
    last_movement_at
  )
  VALUES (
    p_organization_id,
    p_branch_id,
    p_location_id,
    p_variant_id,
    p_movement_id,
    now()
  )
  ON CONFLICT (
    organization_id,
    branch_id,
    location_id,
    variant_id,
    coalesce(lot_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(serial_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  DO NOTHING;

  SELECT *
  INTO v_balance
  FROM public.inventory_balances
  WHERE organization_id = p_organization_id
    AND branch_id = p_branch_id
    AND location_id = p_location_id
    AND variant_id = p_variant_id
    AND lot_id IS NULL
    AND serial_id IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unable to lock inventory balance row';
  END IF;

  RETURN v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.inventory_post_movement(
  p_movement_id uuid,
  p_actor_user_id uuid default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_header public.inventory_movement_headers%ROWTYPE;
  v_settings public.inventory_settings%ROWTYPE;
  v_line public.inventory_movement_lines%ROWTYPE;
  v_balance public.inventory_balances%ROWTYPE;
  v_product_type text;
  v_product_base_unit_id uuid;
  v_delta numeric(18, 6);
  v_location_id uuid;
BEGIN
  SELECT *
  INTO v_header
  FROM public.inventory_movement_headers
  WHERE id = p_movement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movement not found';
  END IF;

  IF v_header.status = 'posted' THEN
    RETURN jsonb_build_object(
      'movement_id', v_header.id,
      'movement_number', v_header.movement_number,
      'status', v_header.status
    );
  END IF;

  IF v_header.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft movements can be posted';
  END IF;

  IF v_header.original_movement_id IS NOT NULL THEN
    IF NOT public.has_branch_permission(v_header.organization_id, v_header.branch_id, 'warehouse.inventory.reverse') THEN
      RAISE EXCEPTION 'Missing warehouse.inventory.reverse permission';
    END IF;
  ELSIF v_header.movement_kind = 'adjustment' THEN
    IF NOT public.has_branch_permission(v_header.organization_id, v_header.branch_id, 'warehouse.inventory.adjust') THEN
      RAISE EXCEPTION 'Missing warehouse.inventory.adjust permission';
    END IF;
  ELSE
    IF NOT public.has_branch_permission(v_header.organization_id, v_header.branch_id, 'warehouse.inventory.operate') THEN
      RAISE EXCEPTION 'Missing warehouse.inventory.operate permission';
    END IF;
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  SELECT *
  INTO v_settings
  FROM public.inventory_settings
  WHERE organization_id = v_header.organization_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory settings unavailable';
  END IF;

  FOR v_line IN
    SELECT *
    FROM public.inventory_movement_lines
    WHERE movement_id = v_header.id
      AND organization_id = v_header.organization_id
      AND branch_id = v_header.branch_id
      AND deleted_at IS NULL
    ORDER BY
      coalesce(source_location_id, destination_location_id),
      variant_id,
      line_number
    FOR UPDATE
  LOOP
    SELECT p.product_type, p.base_unit_id
    INTO v_product_type, v_product_base_unit_id
    FROM public.inventory_variants v
    JOIN public.inventory_products p
      ON p.id = v.product_id
     AND p.organization_id = v.organization_id
    WHERE v.id = v_line.variant_id
      AND v.organization_id = v_header.organization_id
      AND v.status = 'active'
      AND v.deleted_at IS NULL
      AND p.status = 'active'
      AND p.deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Movement line variant is not active';
    END IF;

    IF v_product_type IN ('service', 'bundle') THEN
      RAISE EXCEPTION 'Service and bundle products cannot be posted to stock';
    END IF;

    IF v_line.unit_id <> v_product_base_unit_id THEN
      RAISE EXCEPTION 'Phase 1 movement line unit must equal product base unit';
    END IF;

    IF (v_line.unit_cost IS NOT NULL AND v_line.unit_cost < 0)
       OR (v_line.total_cost IS NOT NULL AND v_line.total_cost < 0) THEN
      RAISE EXCEPTION 'Movement cost metadata must be nonnegative';
    END IF;

    IF v_header.movement_kind IN ('receipt', 'opening_balance')
       OR (v_header.movement_kind = 'adjustment' AND v_header.adjustment_direction = 'increase') THEN
      v_location_id := v_line.destination_location_id;
      v_delta := v_line.quantity;

      v_balance := public.inventory_get_or_create_balance_for_update(
        v_header.organization_id,
        v_header.branch_id,
        v_location_id,
        v_line.variant_id,
        v_header.id
      );

      UPDATE public.inventory_balances
      SET on_hand_quantity = on_hand_quantity + v_delta,
          last_movement_id = v_header.id,
          last_movement_at = now()
      WHERE id = v_balance.id;

    ELSIF v_header.movement_kind = 'issue'
       OR (v_header.movement_kind = 'adjustment' AND v_header.adjustment_direction = 'decrease') THEN
      v_location_id := v_line.source_location_id;
      v_delta := v_line.quantity;

      v_balance := public.inventory_get_or_create_balance_for_update(
        v_header.organization_id,
        v_header.branch_id,
        v_location_id,
        v_line.variant_id,
        v_header.id
      );

      IF NOT v_settings.allow_negative_stock AND v_balance.available_quantity < v_delta THEN
        RAISE EXCEPTION 'Insufficient available stock';
      END IF;

      UPDATE public.inventory_balances
      SET on_hand_quantity = on_hand_quantity - v_delta,
          last_movement_id = v_header.id,
          last_movement_at = now()
      WHERE id = v_balance.id;

    ELSIF v_header.movement_kind = 'transfer' THEN
      v_balance := public.inventory_get_or_create_balance_for_update(
        v_header.organization_id,
        v_header.branch_id,
        v_line.source_location_id,
        v_line.variant_id,
        v_header.id
      );

      IF NOT v_settings.allow_negative_stock AND v_balance.available_quantity < v_line.quantity THEN
        RAISE EXCEPTION 'Insufficient available stock';
      END IF;

      UPDATE public.inventory_balances
      SET on_hand_quantity = on_hand_quantity - v_line.quantity,
          last_movement_id = v_header.id,
          last_movement_at = now()
      WHERE id = v_balance.id;

      v_balance := public.inventory_get_or_create_balance_for_update(
        v_header.organization_id,
        v_header.branch_id,
        v_line.destination_location_id,
        v_line.variant_id,
        v_header.id
      );

      UPDATE public.inventory_balances
      SET on_hand_quantity = on_hand_quantity + v_line.quantity,
          last_movement_id = v_header.id,
          last_movement_at = now()
      WHERE id = v_balance.id;
    ELSE
      RAISE EXCEPTION 'Unsupported movement kind';
    END IF;
  END LOOP;

  UPDATE public.inventory_movement_headers
  SET status = 'posted',
      posted_at = now(),
      posted_by = p_actor_user_id,
      updated_at = now()
  WHERE id = v_header.id;

  RETURN jsonb_build_object(
    'movement_id', v_header.id,
    'movement_number', v_header.movement_number,
    'status', 'posted'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.inventory_reverse_movement(
  p_movement_id uuid,
  p_actor_user_id uuid default null,
  p_note text default null,
  p_idempotency_key text default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_original public.inventory_movement_headers%ROWTYPE;
  v_settings public.inventory_settings%ROWTYPE;
  v_line public.inventory_movement_lines%ROWTYPE;
  v_reversal_id uuid;
  v_reversal_kind text;
  v_reversal_adjustment_direction text;
  v_movement_number text;
  v_source uuid;
  v_destination uuid;
  v_existing public.inventory_movement_headers%ROWTYPE;
BEGIN
  SELECT *
  INTO v_original
  FROM public.inventory_movement_headers
  WHERE id = p_movement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Original movement not found';
  END IF;

  IF NOT public.has_branch_permission(v_original.organization_id, v_original.branch_id, 'warehouse.inventory.reverse') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.reverse permission';
  END IF;

  IF v_original.status <> 'posted' THEN
    IF v_original.status = 'reversed' AND v_original.reversal_movement_id IS NOT NULL THEN
      SELECT *
      INTO v_existing
      FROM public.inventory_movement_headers
      WHERE id = v_original.reversal_movement_id;

      RETURN jsonb_build_object(
        'movement_id', v_existing.id,
        'movement_number', v_existing.movement_number,
        'status', v_existing.status
      );
    END IF;

    RAISE EXCEPTION 'Only posted movements can be reversed';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  SELECT *
  INTO v_settings
  FROM public.inventory_settings
  WHERE organization_id = v_original.organization_id
    AND deleted_at IS NULL
  FOR UPDATE;

  v_movement_number :=
    v_settings.movement_number_prefix || '-' || lpad(v_settings.movement_number_next::text, 6, '0');

  UPDATE public.inventory_settings
  SET movement_number_next = movement_number_next + 1,
      updated_by = p_actor_user_id
  WHERE id = v_settings.id;

  IF v_original.movement_kind IN ('receipt', 'opening_balance') THEN
    v_reversal_kind := 'issue';
    v_reversal_adjustment_direction := null;
  ELSIF v_original.movement_kind = 'issue' THEN
    v_reversal_kind := 'receipt';
    v_reversal_adjustment_direction := null;
  ELSIF v_original.movement_kind = 'transfer' THEN
    v_reversal_kind := 'transfer';
    v_reversal_adjustment_direction := null;
  ELSIF v_original.movement_kind = 'adjustment' THEN
    v_reversal_kind := 'adjustment';
    IF v_original.adjustment_direction = 'increase' THEN
      v_reversal_adjustment_direction := 'decrease';
    ELSE
      v_reversal_adjustment_direction := 'increase';
    END IF;
  END IF;

  INSERT INTO public.inventory_movement_headers (
    organization_id,
    branch_id,
    movement_number,
    movement_kind,
    adjustment_direction,
    status,
    reason_code,
    note,
    reference_type,
    reference_id,
    idempotency_key,
    original_movement_id,
    created_by
  )
  VALUES (
    v_original.organization_id,
    v_original.branch_id,
    v_movement_number,
    v_reversal_kind,
    v_reversal_adjustment_direction,
    'draft',
    'REVERSAL',
    p_note,
    'inventory_movement',
    v_original.id::text,
    p_idempotency_key,
    v_original.id,
    p_actor_user_id
  )
  RETURNING id INTO v_reversal_id;

  FOR v_line IN
    SELECT *
    FROM public.inventory_movement_lines
    WHERE movement_id = v_original.id
      AND deleted_at IS NULL
    ORDER BY line_number
  LOOP
    IF v_original.movement_kind IN ('receipt', 'opening_balance') THEN
      v_source := v_line.destination_location_id;
      v_destination := null;
    ELSIF v_original.movement_kind = 'issue' THEN
      v_source := null;
      v_destination := v_line.source_location_id;
    ELSIF v_original.movement_kind = 'transfer' THEN
      v_source := v_line.destination_location_id;
      v_destination := v_line.source_location_id;
    ELSIF v_original.movement_kind = 'adjustment' THEN
      IF v_original.adjustment_direction = 'increase' THEN
        v_source := v_line.destination_location_id;
        v_destination := null;
      ELSE
        v_source := null;
        v_destination := v_line.source_location_id;
      END IF;
    END IF;

    INSERT INTO public.inventory_movement_lines (
      organization_id,
      branch_id,
      movement_id,
      line_number,
      variant_id,
      source_location_id,
      destination_location_id,
      unit_id,
      quantity,
      unit_cost,
      total_cost,
      currency,
      note
    )
    VALUES (
      v_line.organization_id,
      v_line.branch_id,
      v_reversal_id,
      v_line.line_number,
      v_line.variant_id,
      v_source,
      v_destination,
      v_line.unit_id,
      v_line.quantity,
      v_line.unit_cost,
      v_line.total_cost,
      v_line.currency,
      'Reversal of movement ' || v_original.movement_number
    );
  END LOOP;

  PERFORM public.inventory_post_movement(v_reversal_id, p_actor_user_id);

  UPDATE public.inventory_movement_headers
  SET status = 'reversed',
      reversal_movement_id = v_reversal_id,
      reversed_at = now(),
      reversed_by = p_actor_user_id,
      updated_at = now()
  WHERE id = v_original.id;

  SELECT *
  INTO v_existing
  FROM public.inventory_movement_headers
  WHERE id = v_reversal_id;

  RETURN jsonb_build_object(
    'movement_id', v_existing.id,
    'movement_number', v_existing.movement_number,
    'status', v_existing.status,
    'original_movement_id', v_original.id
  );
END;
$$;
