-- ============================================================================
-- IC-2: Movement Reversal
-- ============================================================================
-- Adds:
--   1. A new, generic, system-only reversal document type ('KOR') and
--      movement type ('900') -- seeded via the existing per-org seeding
--      function (`inventory_seed_movement_types_internal`), matching the
--      established convention. `is_system=true`, `allows_manual_entry=
--      false`/`is_correction=true` so it can never be created through any
--      generic manual-entry UI path -- only `inventory_reverse_movement`
--      creates headers of this type. Deliberately carries NO rows in
--      `inventory_movement_type_effects` -- a reversal's own effects are
--      computed per-instance (the exact inverse of whatever the ORIGINAL
--      movement's own type-catalog effects were), which the existing
--      type-level effects model cannot express. Live-verified: none of the
--      5 existing movement types (101/311/401/402/801) can serve as a
--      correct, honestly-labeled inverse for every other type (in
--      particular 801 needs a combined source-increase+destination-decrease
--      effect pair that does not exist as any single type, and 402/311's
--      own "source decrease" has no "source increase" sibling type) -- so
--      this narrow, additive extension was required per the task's own
--      explicit "STOP before inventing a shadow type system" / "create the
--      minimum generic representation" guidance.
--
-- Product decisions (frozen, recorded in inventory-core-architecture.md):
--   A. A posted ORIGINAL may be reversed at most once; a reversal itself
--      may never be reversed ("undo an undo" is out of scope for MVP).
--   B. RepairOrder business-quantity attribution/netting (received/
--      issued/outstanding/available formulas) is NOT touched by IC-2 --
--      physical reversal is implemented correctly and independently of
--      that read model, which remains a later, explicit integration
--      concern.
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

  -- IC-2: generic reversal/correction document type. is_correction=true,
  -- corrects_document_type_code=NULL (generic -- applies regardless of
  -- which document type the original movement carried; building one
  -- correction document type per original type would violate the "minimum
  -- generic representation" instruction).
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

  INSERT INTO inventory_movement_types (
    organization_id, code, document_type_id, name, name_pl, name_en, category,
    requires_source_location, requires_destination_location, cost_impact, is_system
  )
  VALUES (
    p_organization_id, '311', v_mm_doc_id, 'Inter-Branch Transfer Out',
    'Transfer między oddziałami - wydanie', 'Inter-Branch Transfer Out',
    'transfer', true, false, 'neutral', true
  )
  ON CONFLICT (organization_id, code) WHERE deleted_at IS NULL DO NOTHING
  RETURNING id INTO v_type_311_id;

  IF v_type_311_id IS NULL THEN
    SELECT id INTO v_type_311_id
    FROM inventory_movement_types
    WHERE organization_id = p_organization_id AND code = '311' AND deleted_at IS NULL;
  END IF;

  -- IC-2: generic system reversal movement type. is_system=true,
  -- allows_manual_entry=false -- can only ever be created by
  -- `inventory_reverse_movement`, never through a generic "create draft
  -- movement" UI/action path. Deliberately no requires_source_location/
  -- requires_destination_location enforcement (each reversal line's own
  -- locations are copied directly from the original line it reverses) and
  -- deliberately NO `inventory_movement_type_effects` rows (effects are
  -- computed per-instance by the reversal RPC itself, passed explicitly to
  -- `inventory_finalize_posting`'s new `p_explicit_effects` parameter).
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
    (v_type_311_id, 1, 'source', 'on_hand', 'decrease', true, 'Issue stock from source branch')
  ON CONFLICT (movement_type_id, effect_order) DO NOTHING;
END;
$function$;

-- Backfill the new KOR/900 types for every org that already had the
-- original seed run (idempotent -- ON CONFLICT DO NOTHING guards every
-- insert inside the function).
DO $$
DECLARE v_org RECORD;
BEGIN
  FOR v_org IN SELECT id FROM organizations WHERE deleted_at IS NULL LOOP
    PERFORM public.inventory_seed_movement_types_internal(v_org.id);
  END LOOP;
END $$;
