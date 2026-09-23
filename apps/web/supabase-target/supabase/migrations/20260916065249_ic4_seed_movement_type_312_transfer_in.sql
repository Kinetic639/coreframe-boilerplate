CREATE OR REPLACE FUNCTION public.inventory_seed_movement_types_internal(p_organization_id uuid, p_actor_user_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pz_doc_id uuid;
  v_mm_doc_id uuid;
  v_inw_doc_id uuid;
  v_kor_doc_id uuid;
  v_type_101_id uuid;
  v_type_801_id uuid;
  v_type_401_id uuid;
  v_type_402_id uuid;
  v_type_311_id uuid;
  v_type_312_id uuid;
  v_type_900_id uuid;
BEGIN
  INSERT INTO inventory_document_types (
    organization_id, code, name, name_pl, name_en, category, numbering_template, is_system
  )
  VALUES (
    p_organization_id, 'PZ', 'External Receipt', 'Przyjęcie Zewnętrzne',
    'External Receipt', 'receipt', 'PZ/{year}/{seq:6}', true
  )
  ON CONFLICT (organization_id, code) WHERE deleted_at IS NULL DO NOTHING
  RETURNING id INTO v_pz_doc_id;

  IF v_pz_doc_id IS NULL THEN
    SELECT id INTO v_pz_doc_id
    FROM inventory_document_types
    WHERE organization_id = p_organization_id AND code = 'PZ' AND deleted_at IS NULL;
  END IF;

  INSERT INTO inventory_document_types (
    organization_id, code, name, name_pl, name_en, category, numbering_template, is_system
  )
  VALUES (
    p_organization_id, 'MM', 'Internal Transfer', 'Przesunięcie Międzymagazynowe',
    'Internal Transfer', 'transfer', 'MM/{year}/{seq:6}', true
  )
  ON CONFLICT (organization_id, code) WHERE deleted_at IS NULL DO NOTHING
  RETURNING id INTO v_mm_doc_id;

  IF v_mm_doc_id IS NULL THEN
    SELECT id INTO v_mm_doc_id
    FROM inventory_document_types
    WHERE organization_id = p_organization_id AND code = 'MM' AND deleted_at IS NULL;
  END IF;

  INSERT INTO inventory_document_types (
    organization_id, code, name, name_pl, name_en, category, numbering_template, is_system
  )
  VALUES (
    p_organization_id, 'INW', 'Inventory Adjustment', 'Korekta Inwentaryzacyjna',
    'Inventory Adjustment', 'adjustment', 'INW/{year}/{seq:6}', true
  )
  ON CONFLICT (organization_id, code) WHERE deleted_at IS NULL DO NOTHING
  RETURNING id INTO v_inw_doc_id;

  IF v_inw_doc_id IS NULL THEN
    SELECT id INTO v_inw_doc_id
    FROM inventory_document_types
    WHERE organization_id = p_organization_id AND code = 'INW' AND deleted_at IS NULL;
  END IF;

  INSERT INTO inventory_document_types (
    organization_id, code, name, name_pl, name_en, category, numbering_template,
    is_system, is_correction, corrects_document_type_code
  )
  VALUES (
    p_organization_id, 'KOR', 'Movement Reversal', 'Korekta / Storno Ruchu',
    'Movement Reversal', 'other', 'KOR/{year}/{seq:6}', true, true, NULL
  )
  ON CONFLICT (organization_id, code) WHERE deleted_at IS NULL DO NOTHING
  RETURNING id INTO v_kor_doc_id;

  IF v_kor_doc_id IS NULL THEN
    SELECT id INTO v_kor_doc_id
    FROM inventory_document_types
    WHERE organization_id = p_organization_id AND code = 'KOR' AND deleted_at IS NULL;
  END IF;

  INSERT INTO inventory_movement_types (
    organization_id, code, document_type_id, name, name_pl, name_en, category,
    requires_source_location, requires_destination_location, cost_impact, is_system
  )
  VALUES (
    p_organization_id, '101', v_pz_doc_id, 'Goods Receipt (PZ)',
    'Przyjęcie z zamówienia', 'Goods Receipt from PO', 'receipt',
    false, true, 'increase', true
  )
  ON CONFLICT (organization_id, code) WHERE deleted_at IS NULL DO NOTHING
  RETURNING id INTO v_type_101_id;

  IF v_type_101_id IS NULL THEN
    SELECT id INTO v_type_101_id
    FROM inventory_movement_types
    WHERE organization_id = p_organization_id AND code = '101' AND deleted_at IS NULL;
  END IF;

  INSERT INTO inventory_movement_types (
    organization_id, code, document_type_id, name, name_pl, name_en, category,
    requires_source_location, requires_destination_location, cost_impact, is_system
  )
  VALUES (
    p_organization_id, '801', v_mm_doc_id, 'Bin-to-Bin Move (MMZ)',
    'Przesunięcie BIN', 'Bin-to-Bin Move', 'bin_operation',
    true, true, 'neutral', true
  )
  ON CONFLICT (organization_id, code) WHERE deleted_at IS NULL DO NOTHING
  RETURNING id INTO v_type_801_id;

  IF v_type_801_id IS NULL THEN
    SELECT id INTO v_type_801_id
    FROM inventory_movement_types
    WHERE organization_id = p_organization_id AND code = '801' AND deleted_at IS NULL;
  END IF;

  INSERT INTO inventory_movement_types (
    organization_id, code, document_type_id, name, name_pl, name_en, category,
    requires_source_location, requires_destination_location, cost_impact, is_system
  )
  VALUES (
    p_organization_id, '401', v_inw_doc_id, 'Inventory Count Adjustment (Increase)',
    'Korekta z inwentaryzacji (nadwyżka)', 'Inventory Count Adjustment (Increase)',
    'adjustment', false, true, 'increase', true
  )
  ON CONFLICT (organization_id, code) WHERE deleted_at IS NULL DO NOTHING
  RETURNING id INTO v_type_401_id;

  IF v_type_401_id IS NULL THEN
    SELECT id INTO v_type_401_id
    FROM inventory_movement_types
    WHERE organization_id = p_organization_id AND code = '401' AND deleted_at IS NULL;
  END IF;

  INSERT INTO inventory_movement_types (
    organization_id, code, document_type_id, name, name_pl, name_en, category,
    requires_source_location, requires_destination_location, cost_impact, is_system
  )
  VALUES (
    p_organization_id, '402', v_inw_doc_id, 'Inventory Count Adjustment (Decrease)',
    'Korekta z inwentaryzacji (niedobór)', 'Inventory Count Adjustment (Decrease)',
    'adjustment', true, false, 'decrease', true
  )
  ON CONFLICT (organization_id, code) WHERE deleted_at IS NULL DO NOTHING
  RETURNING id INTO v_type_402_id;

  IF v_type_402_id IS NULL THEN
    SELECT id INTO v_type_402_id
    FROM inventory_movement_types
    WHERE organization_id = p_organization_id AND code = '402' AND deleted_at IS NULL;
  END IF;

  -- IC-4: 311 redefined as system-managed (allows_manual_entry=false) --
  -- zero live posted headers ever existed for this code (live-verified
  -- before this change); its own pre-existing effect (source on_hand
  -- decrease) is exactly correct for the branch-transfer issue leg, so
  -- only the manual-entry flag changes here, not its semantics.
  INSERT INTO inventory_movement_types (
    organization_id, code, document_type_id, name, name_pl, name_en, category,
    requires_source_location, requires_destination_location, cost_impact, is_system,
    allows_manual_entry
  )
  VALUES (
    p_organization_id, '311', v_mm_doc_id, 'Inter-Branch Transfer Out',
    'Transfer między oddziałami - wydanie', 'Inter-Branch Transfer Out',
    'transfer', true, false, 'neutral', true, false
  )
  ON CONFLICT (organization_id, code) WHERE deleted_at IS NULL DO NOTHING
  RETURNING id INTO v_type_311_id;

  IF v_type_311_id IS NULL THEN
    SELECT id INTO v_type_311_id
    FROM inventory_movement_types
    WHERE organization_id = p_organization_id AND code = '311' AND deleted_at IS NULL;
  END IF;

  -- IC-4: new 312, the destination-side pair for 311. System-managed
  -- (only inventory_accept_branch_transfer posts it); on_hand increase.
  INSERT INTO inventory_movement_types (
    organization_id, code, document_type_id, name, name_pl, name_en, category,
    requires_source_location, requires_destination_location, cost_impact, is_system,
    allows_manual_entry
  )
  VALUES (
    p_organization_id, '312', v_mm_doc_id, 'Inter-Branch Transfer In',
    'Transfer między oddziałami - przyjęcie', 'Inter-Branch Transfer In',
    'transfer', false, true, 'neutral', true, false
  )
  ON CONFLICT (organization_id, code) WHERE deleted_at IS NULL DO NOTHING
  RETURNING id INTO v_type_312_id;

  IF v_type_312_id IS NULL THEN
    SELECT id INTO v_type_312_id
    FROM inventory_movement_types
    WHERE organization_id = p_organization_id AND code = '312' AND deleted_at IS NULL;
  END IF;

  INSERT INTO inventory_movement_types (
    organization_id, code, document_type_id, name, name_pl, name_en, category,
    requires_source_location, requires_destination_location, cost_impact,
    is_system, allows_manual_entry
  )
  VALUES (
    p_organization_id, '900', v_kor_doc_id, 'System Reversal',
    'Storno Systemowe', 'System Reversal', 'other',
    false, false, 'neutral', true, false
  )
  ON CONFLICT (organization_id, code) WHERE deleted_at IS NULL DO NOTHING
  RETURNING id INTO v_type_900_id;

  INSERT INTO inventory_movement_type_effects (
    movement_type_id, effect_order, target, balance_field, direction, is_required, description
  )
  VALUES
    (v_type_101_id, 1, 'destination', 'on_hand', 'increase', true, 'Receive stock into destination bin'),
    (v_type_801_id, 1, 'source', 'on_hand', 'decrease', true, 'Remove from source bin'),
    (v_type_801_id, 2, 'destination', 'on_hand', 'increase', true, 'Place into destination bin'),
    (v_type_401_id, 1, 'destination', 'on_hand', 'increase', true, 'Apply inventory count surplus to location'),
    (v_type_402_id, 1, 'source', 'on_hand', 'decrease', true, 'Apply inventory count shortage to location'),
    (v_type_311_id, 1, 'source', 'on_hand', 'decrease', true, 'Issue stock from source branch'),
    (v_type_312_id, 1, 'destination', 'on_hand', 'increase', true, 'Receive stock into destination branch')
  ON CONFLICT (movement_type_id, effect_order) DO NOTHING;
END;
$function$;

-- Backfill for all existing organizations (mirrors the IC-2 900/KOR backfill).
DO $$
DECLARE
  v_org RECORD;
BEGIN
  FOR v_org IN SELECT id FROM organizations WHERE deleted_at IS NULL LOOP
    PERFORM public.inventory_seed_movement_types_internal(v_org.id, NULL);
  END LOOP;
END;
$$;

-- Existing 311 rows (seeded before this migration) also flip to system-managed.
UPDATE inventory_movement_types
SET allows_manual_entry = false
WHERE code = '311' AND allows_manual_entry = true;
