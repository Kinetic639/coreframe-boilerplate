-- Add current inventory movement contract for inter-branch transfer out.
-- 311 = sender is the active/current branch, recipient is another branch.

CREATE OR REPLACE FUNCTION public.inventory_seed_movement_types(
  p_organization_id uuid,
  p_actor_user_id uuid DEFAULT NULL::uuid
)
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
  v_type_311_id uuid;
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

DO $$
DECLARE
  v_org record;
BEGIN
  FOR v_org IN
    SELECT id FROM public.organizations WHERE deleted_at IS NULL
  LOOP
    PERFORM public.inventory_seed_movement_types(v_org.id, NULL);
  END LOOP;
END $$;

WITH seeded AS (
  SELECT
    mt.organization_id,
    mt.id AS movement_type_id,
    mt.code AS movement_type_code,
    fd.id AS field_definition_id,
    fd.field_key,
    CASE
      WHEN fd.field_key IN ('line.variant_id', 'line.unit_id', 'line.quantity') THEN 'required'
      WHEN fd.field_key = 'line.source_location_id' THEN 'required'
      WHEN fd.field_key = 'line.destination_location_id' THEN 'forbidden'
      WHEN fd.field_key IN (
        'header.sender_name',
        'header.sender_details',
        'header.recipient_name',
        'header.recipient_details'
      ) THEN 'required'
      WHEN fd.field_key IN ('header.reference_type', 'header.reference_id') THEN 'system'
      ELSE 'optional'
    END AS policy,
    CASE
      WHEN fd.field_key = 'header.operation_date' THEN 'current_date'
      ELSE 'none'
    END AS default_strategy,
    CASE
      WHEN fd.field_key = 'line.quantity' THEN '{"positive": true}'::jsonb
      WHEN fd.field_key = 'header.external_reference' THEN '{"maxLength": 200}'::jsonb
      WHEN fd.field_key = 'header.note' THEN '{"maxLength": 2000}'::jsonb
      WHEN fd.field_key = 'line.note' THEN '{"maxLength": 500}'::jsonb
      ELSE '{}'::jsonb
    END AS validation,
    row_number() OVER (PARTITION BY mt.id ORDER BY fd.field_scope, fd.field_key)::integer AS display_order
  FROM public.inventory_movement_types mt
  JOIN public.inventory_movement_field_definitions fd
    ON fd.organization_id = mt.organization_id
   AND fd.deleted_at IS NULL
  WHERE mt.deleted_at IS NULL
    AND mt.code = '311'
)
INSERT INTO public.inventory_movement_type_field_policies (
  organization_id,
  movement_type_id,
  movement_type_code,
  field_definition_id,
  field_key,
  policy,
  default_strategy,
  validation,
  display_order
)
SELECT
  organization_id,
  movement_type_id,
  movement_type_code,
  field_definition_id,
  field_key,
  policy,
  default_strategy,
  validation,
  display_order
FROM seeded
ON CONFLICT (organization_id, movement_type_id, field_key) WHERE deleted_at IS NULL DO UPDATE
SET policy = EXCLUDED.policy,
    default_strategy = EXCLUDED.default_strategy,
    validation = EXCLUDED.validation,
    display_order = EXCLUDED.display_order,
    deleted_at = NULL,
    updated_at = now();
