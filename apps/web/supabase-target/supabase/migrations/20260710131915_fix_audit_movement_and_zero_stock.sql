-- Fix 1: inventory_create_count_session's zero-stock branch (Branch 1) never
-- filtered on quantity, so any location with an EXISTING balance row sitting
-- at exactly 0 was always included regardless of the include_zero_stock
-- toggle — the toggle only ever gated Branch 2 (catalog variants with no
-- balance row at all). Add the missing quantity guard to Branch 1.
CREATE OR REPLACE FUNCTION public.inventory_create_count_session(
  p_organization_id uuid,
  p_branch_id uuid,
  p_scope jsonb DEFAULT '{}'::jsonb,
  p_notes text DEFAULT NULL,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count_id uuid;
  v_number text;
  v_count_type text;
  v_include_zero_stock boolean;
  v_location_ids uuid[];
  v_location_filter_ids uuid[];
  v_supplier_id uuid;
  v_seq_offset integer;
BEGIN
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

  -- Branch 1: seed lines from existing balances matching the resolved scope.
  -- Location-subtree expansion already happened in TypeScript before this RPC
  -- was called (buildLocationTree) — v_location_ids is always the final,
  -- already-expanded list, never a set of parent-only ids to expand here.
  -- FIX: a balance row that already reads zero must respect the
  -- include_zero_stock toggle too, same as the catalog-wide Branch 2 below —
  -- previously every existing balance row was included unconditionally,
  -- regardless of on_hand_quantity, so zero-quantity positions leaked into
  -- audits even with the toggle off.
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
        AND v.default_supplier_id = v_supplier_id
        AND (array_length(v_location_filter_ids, 1) IS NULL OR b.location_id = ANY (v_location_filter_ids))
      )
    );

  -- Branch 2: optionally seed zero-stock catalog items that have no existing
  -- balance row. Scoped strictly to the explicit location set already
  -- resolved above (v_location_ids for count_type=location,
  -- v_location_filter_ids for count_type=supplier). If a supplier-scoped
  -- session sets include_zero_stock=true without a location_filter_ids
  -- narrowing, unnest() over the empty v_location_filter_ids array yields zero
  -- rows and this branch intentionally contributes nothing — rather than
  -- iterating every location in the branch for every matching-supplier
  -- variant, which would be an unbounded cross product. This boundary is
  -- documented in the implementation report as a concrete scope decision.
  IF v_include_zero_stock THEN
    SELECT coalesce(max(sequence_no), 0) INTO v_seq_offset
    FROM public.inventory_count_lines
    WHERE count_session_id = v_count_id;

    INSERT INTO public.inventory_count_lines (
      organization_id, branch_id, count_session_id, variant_id, location_id,
      lot_id, serial_id, expected_quantity, unit_id, status, source, sequence_no
    )
    SELECT
      p_organization_id, p_branch_id, v_count_id, v.id, loc_id,
      NULL, NULL, 0, p.base_unit_id, 'pending', 'generated',
      v_seq_offset + row_number() OVER (ORDER BY loc_id, v.id)
    FROM public.inventory_variants v
    JOIN public.inventory_products p
      ON p.id = v.product_id AND p.organization_id = v.organization_id
    CROSS JOIN unnest(
      CASE WHEN v_count_type = 'location' THEN v_location_ids ELSE v_location_filter_ids END
    ) AS loc_id
    WHERE v.organization_id = p_organization_id
      AND v.status = 'active'
      AND (v_count_type = 'location' OR v.default_supplier_id = v_supplier_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.inventory_count_lines existing
        WHERE existing.count_session_id = v_count_id
          AND existing.variant_id = v.id
          AND existing.location_id = loc_id
          AND existing.lot_id IS NULL
          AND existing.serial_id IS NULL
      );
  END IF;

  RETURN jsonb_build_object('count_session_id', v_count_id, 'count_number', upper(v_number), 'status', 'draft');
END;
$$;

-- Fix 2: inventory_seed_movement_types previously only seeded a receipt
-- (101) and a bin-to-bin (801) movement type. It never seeded any
-- "adjustment" category type, so inventory count posting had no movement
-- type to post against on any organization. Add an INW (inventory
-- adjustment) document type plus 401 (increase) / 402 (decrease) movement
-- types with the matching balance effects, using the same idempotent
-- ON CONFLICT DO NOTHING pattern as the existing seeds.
CREATE OR REPLACE FUNCTION public.inventory_seed_movement_types(p_organization_id uuid, p_actor_user_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pz_doc_id uuid;
  v_mm_doc_id uuid;
  v_inw_doc_id uuid;
  v_type_101_id uuid;
  v_type_801_id uuid;
  v_type_401_id uuid;
  v_type_402_id uuid;
BEGIN
  -- PZ document type
  INSERT INTO inventory_document_types (organization_id, code, name, name_pl, name_en, category, numbering_template, is_system)
  VALUES (p_organization_id, 'PZ', 'External Receipt', 'Przyjęcie Zewnętrzne', 'External Receipt', 'receipt', 'PZ/{year}/{seq:6}', true)
  ON CONFLICT (organization_id, code) WHERE deleted_at IS NULL DO NOTHING
  RETURNING id INTO v_pz_doc_id;

  IF v_pz_doc_id IS NULL THEN
    SELECT id INTO v_pz_doc_id FROM inventory_document_types
    WHERE organization_id = p_organization_id AND code = 'PZ' AND deleted_at IS NULL;
  END IF;

  -- MM document type
  INSERT INTO inventory_document_types (organization_id, code, name, name_pl, name_en, category, numbering_template, is_system)
  VALUES (p_organization_id, 'MM', 'Internal Transfer', 'Przesunięcie Międzymagazynowe', 'Internal Transfer', 'transfer', 'MM/{year}/{seq:6}', true)
  ON CONFLICT (organization_id, code) WHERE deleted_at IS NULL DO NOTHING
  RETURNING id INTO v_mm_doc_id;

  IF v_mm_doc_id IS NULL THEN
    SELECT id INTO v_mm_doc_id FROM inventory_document_types
    WHERE organization_id = p_organization_id AND code = 'MM' AND deleted_at IS NULL;
  END IF;

  -- INW document type (inventory count adjustment)
  INSERT INTO inventory_document_types (organization_id, code, name, name_pl, name_en, category, numbering_template, is_system)
  VALUES (p_organization_id, 'INW', 'Inventory Adjustment', 'Korekta Inwentaryzacyjna', 'Inventory Adjustment', 'adjustment', 'INW/{year}/{seq:6}', true)
  ON CONFLICT (organization_id, code) WHERE deleted_at IS NULL DO NOTHING
  RETURNING id INTO v_inw_doc_id;

  IF v_inw_doc_id IS NULL THEN
    SELECT id INTO v_inw_doc_id FROM inventory_document_types
    WHERE organization_id = p_organization_id AND code = 'INW' AND deleted_at IS NULL;
  END IF;

  -- 101 PZ receipt type
  INSERT INTO inventory_movement_types (organization_id, code, document_type_id, name, name_pl, name_en, category,
    requires_source_location, requires_destination_location, cost_impact, is_system)
  VALUES (p_organization_id, '101', v_pz_doc_id, 'Goods Receipt (PZ)', 'Przyjęcie z zamówienia', 'Goods Receipt from PO', 'receipt',
    false, true, 'increase', true)
  ON CONFLICT (organization_id, code) WHERE deleted_at IS NULL DO NOTHING
  RETURNING id INTO v_type_101_id;

  IF v_type_101_id IS NULL THEN
    SELECT id INTO v_type_101_id FROM inventory_movement_types
    WHERE organization_id = p_organization_id AND code = '101' AND deleted_at IS NULL;
  END IF;

  -- 801 bin-to-bin type
  INSERT INTO inventory_movement_types (organization_id, code, document_type_id, name, name_pl, name_en, category,
    requires_source_location, requires_destination_location, cost_impact, is_system)
  VALUES (p_organization_id, '801', v_mm_doc_id, 'Bin-to-Bin Move (MMZ)', 'Przesunięcie BIN', 'Bin-to-Bin Move', 'bin_operation',
    true, true, 'neutral', true)
  ON CONFLICT (organization_id, code) WHERE deleted_at IS NULL DO NOTHING
  RETURNING id INTO v_type_801_id;

  IF v_type_801_id IS NULL THEN
    SELECT id INTO v_type_801_id FROM inventory_movement_types
    WHERE organization_id = p_organization_id AND code = '801' AND deleted_at IS NULL;
  END IF;

  -- 401 inventory count adjustment (increase / surplus)
  INSERT INTO inventory_movement_types (organization_id, code, document_type_id, name, name_pl, name_en, category,
    requires_source_location, requires_destination_location, cost_impact, is_system)
  VALUES (p_organization_id, '401', v_inw_doc_id, 'Inventory Count Adjustment (Increase)', 'Korekta z inwentaryzacji (nadwyżka)', 'Inventory Count Adjustment (Increase)', 'adjustment',
    false, true, 'increase', true)
  ON CONFLICT (organization_id, code) WHERE deleted_at IS NULL DO NOTHING
  RETURNING id INTO v_type_401_id;

  IF v_type_401_id IS NULL THEN
    SELECT id INTO v_type_401_id FROM inventory_movement_types
    WHERE organization_id = p_organization_id AND code = '401' AND deleted_at IS NULL;
  END IF;

  -- 402 inventory count adjustment (decrease / shortage)
  INSERT INTO inventory_movement_types (organization_id, code, document_type_id, name, name_pl, name_en, category,
    requires_source_location, requires_destination_location, cost_impact, is_system)
  VALUES (p_organization_id, '402', v_inw_doc_id, 'Inventory Count Adjustment (Decrease)', 'Korekta z inwentaryzacji (niedobór)', 'Inventory Count Adjustment (Decrease)', 'adjustment',
    true, false, 'decrease', true)
  ON CONFLICT (organization_id, code) WHERE deleted_at IS NULL DO NOTHING
  RETURNING id INTO v_type_402_id;

  IF v_type_402_id IS NULL THEN
    SELECT id INTO v_type_402_id FROM inventory_movement_types
    WHERE organization_id = p_organization_id AND code = '402' AND deleted_at IS NULL;
  END IF;

  -- Effects for 101: destination on_hand increase
  INSERT INTO inventory_movement_type_effects (movement_type_id, effect_order, target, balance_field, direction, is_required, description)
  VALUES (v_type_101_id, 1, 'destination', 'on_hand', 'increase', true, 'Receive stock into destination bin')
  ON CONFLICT (movement_type_id, effect_order) DO NOTHING;

  -- Effects for 801: source on_hand decrease + destination on_hand increase
  INSERT INTO inventory_movement_type_effects (movement_type_id, effect_order, target, balance_field, direction, is_required, description)
  VALUES (v_type_801_id, 1, 'source', 'on_hand', 'decrease', true, 'Remove from source bin')
  ON CONFLICT (movement_type_id, effect_order) DO NOTHING;

  INSERT INTO inventory_movement_type_effects (movement_type_id, effect_order, target, balance_field, direction, is_required, description)
  VALUES (v_type_801_id, 2, 'destination', 'on_hand', 'increase', true, 'Place into destination bin')
  ON CONFLICT (movement_type_id, effect_order) DO NOTHING;

  -- Effects for 401: destination on_hand increase (surplus found during count)
  INSERT INTO inventory_movement_type_effects (movement_type_id, effect_order, target, balance_field, direction, is_required, description)
  VALUES (v_type_401_id, 1, 'destination', 'on_hand', 'increase', true, 'Apply inventory count surplus to location')
  ON CONFLICT (movement_type_id, effect_order) DO NOTHING;

  -- Effects for 402: source on_hand decrease (shortage found during count)
  INSERT INTO inventory_movement_type_effects (movement_type_id, effect_order, target, balance_field, direction, is_required, description)
  VALUES (v_type_402_id, 1, 'source', 'on_hand', 'decrease', true, 'Apply inventory count shortage to location')
  ON CONFLICT (movement_type_id, effect_order) DO NOTHING;
END;
$function$;

-- Fix 3: inventory_approve_count_session called inventory_create_draft_movement
-- / inventory_post_movement, which no longer exist — they were dropped by the
-- movement-v1 rewrite (migrations dated 2026-06-22) in favor of
-- inventory_create_draft / inventory_finalize_posting, which post against a
-- per-org movement TYPE CODE instead of a free-form kind+direction pair. No
-- "adjustment" type code was ever seeded for any org (fixed above), so this
-- also seeds 401/402 for the session's org before posting, guaranteeing it
-- works even for organizations that predate this fix. lot_id/serial_id are
-- dropped from the line payload — the new movement-line schema has no lot or
-- serial columns at all (a real reduction in fidelity vs. the old engine,
-- out of scope to restore here).
CREATE OR REPLACE FUNCTION public.inventory_approve_count_session(
  p_count_session_id uuid,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_session public.inventory_count_sessions%ROWTYPE;
  v_require_reason boolean;
  v_line record;
  v_increase_lines jsonb := '[]'::jsonb;
  v_decrease_lines jsonb := '[]'::jsonb;
  v_result jsonb;
BEGIN
  SELECT *
  INTO v_session
  FROM public.inventory_count_sessions
  WHERE id = p_count_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory count session not found';
  END IF;

  IF NOT public.has_branch_permission(v_session.organization_id, v_session.branch_id, 'warehouse.inventory.adjust') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.adjust permission';
  END IF;

  IF v_session.status NOT IN ('draft', 'counting', 'submitted') THEN
    RAISE EXCEPTION 'Inventory count cannot be approved in current status';
  END IF;

  v_require_reason := coalesce((v_session.scope ->> 'require_reason_for_variance')::boolean, true);

  -- All-or-nothing posting gate (plan §5). No partial posting exists — there
  -- is no scope flag or parameter that bypasses any of these four checks.
  IF EXISTS (
    SELECT 1 FROM public.inventory_count_lines
    WHERE count_session_id = v_session.id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Cannot post: session has unresolved pending lines';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.inventory_count_lines
    WHERE count_session_id = v_session.id AND status = 'needs_recount'
  ) THEN
    RAISE EXCEPTION 'Cannot post: session has lines flagged for recount';
  END IF;

  -- A counted line with variance_quantity = 0 is already resolved and is
  -- intentionally excluded from this check (plan §4/§5) — only counted lines
  -- with an actual discrepancy that were never approved block posting.
  IF EXISTS (
    SELECT 1 FROM public.inventory_count_lines
    WHERE count_session_id = v_session.id AND status = 'counted' AND variance_quantity <> 0
  ) THEN
    RAISE EXCEPTION 'Cannot post: session has counted variance lines that were not reviewed and approved';
  END IF;

  IF v_require_reason AND EXISTS (
    SELECT 1 FROM public.inventory_count_lines
    WHERE count_session_id = v_session.id
      AND status = 'approved'
      AND variance_quantity <> 0
      AND reason_code IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot post: session has approved variance lines missing a required reason code';
  END IF;

  -- Guarantee the inventory-count adjustment movement types (401/402) exist
  -- for this org before posting — idempotent, no-ops if already seeded.
  PERFORM public.inventory_seed_movement_types(v_session.organization_id, p_actor_user_id);

  -- Only approved lines with nonzero variance ever contribute to a movement.
  -- Skipped lines and zero-variance counted lines are excluded by this WHERE
  -- clause and never reach the increase/decrease arrays below.
  FOR v_line IN
    SELECT *
    FROM public.inventory_count_lines
    WHERE count_session_id = v_session.id
      AND status = 'approved'
      AND variance_quantity <> 0
    ORDER BY location_id, variant_id
  LOOP
    IF v_line.variance_quantity > 0 THEN
      v_increase_lines := v_increase_lines || jsonb_build_array(jsonb_build_object(
        'variant_id', v_line.variant_id,
        'destination_location_id', v_line.location_id,
        'unit_id', v_line.unit_id,
        'quantity', v_line.variance_quantity
      ));
    ELSE
      v_decrease_lines := v_decrease_lines || jsonb_build_array(jsonb_build_object(
        'variant_id', v_line.variant_id,
        'source_location_id', v_line.location_id,
        'unit_id', v_line.unit_id,
        'quantity', abs(v_line.variance_quantity)
      ));
    END IF;
  END LOOP;

  IF jsonb_array_length(v_increase_lines) > 0 THEN
    v_result := public.inventory_create_draft(
      v_session.organization_id,
      v_session.branch_id,
      '401',
      v_increase_lines,
      NULL,
      NULL,
      NULL,
      v_session.count_number,
      'Inventory count ' || v_session.count_number,
      'count-increase-' || v_session.id::text,
      p_actor_user_id
    );
    PERFORM public.inventory_finalize_posting((v_result ->> 'movement_id')::uuid, p_actor_user_id);
  END IF;

  IF jsonb_array_length(v_decrease_lines) > 0 THEN
    v_result := public.inventory_create_draft(
      v_session.organization_id,
      v_session.branch_id,
      '402',
      v_decrease_lines,
      NULL,
      NULL,
      NULL,
      v_session.count_number,
      'Inventory count ' || v_session.count_number,
      'count-decrease-' || v_session.id::text,
      p_actor_user_id
    );
    PERFORM public.inventory_finalize_posting((v_result ->> 'movement_id')::uuid, p_actor_user_id);
  END IF;

  UPDATE public.inventory_count_sessions
  SET status = 'approved',
      approved_at = now(),
      approved_by = p_actor_user_id
  WHERE id = v_session.id;

  RETURN jsonb_build_object(
    'count_session_id', v_session.id,
    'count_number', v_session.count_number,
    'status', 'approved',
    'increase_lines', jsonb_array_length(v_increase_lines),
    'decrease_lines', jsonb_array_length(v_decrease_lines)
  );
END;
$$;
