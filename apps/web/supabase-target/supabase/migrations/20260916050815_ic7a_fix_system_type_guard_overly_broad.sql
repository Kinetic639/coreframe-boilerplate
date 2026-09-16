-- ============================================================================
-- IC-7A self-caught defect, fixed BEFORE any regression test ran: the
-- previous migration's system-movement-type guard in inventory_create_
-- draft used `is_system OR NOT allows_manual_entry`. Live-verified
-- (queried inventory_movement_types directly) that `is_system=true` for
-- EVERY seeded movement type in this catalog -- 101, 401, 402, 801, AND
-- 900 -- it is a "this is a built-in/seeded type" marker, not a manual-
-- entry restriction. Only `allows_manual_entry` (false ONLY for 900) is
-- the correct, sole authoritative signal for "must never be manually
-- created." The previous guard would have rejected manual creation of
-- EVERY movement type, including the legitimate 101 receipt, 401/402
-- adjustment, and 801 relocation flows -- a severe regression, caught by
-- live inspection before any pgTAP test or real caller exercised it.

CREATE OR REPLACE FUNCTION public.inventory_create_draft(p_organization_id uuid, p_branch_id uuid, p_movement_type_code text, p_lines jsonb, p_operation_date date DEFAULT NULL::date, p_document_date date DEFAULT NULL::date, p_counterparty_name text DEFAULT NULL::text, p_external_reference text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text, p_actor_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_mvt_type RECORD;
  v_settings RECORD;
  v_draft_number text;
  v_header_id uuid;
  v_line RECORD;
  v_line_number integer := 0;
  v_existing_id uuid;
  v_existing_draft text;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  IF NOT (
    public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate')
    OR public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.adjust')
  ) THEN
    RAISE EXCEPTION 'Not authorized to create inventory movements for this branch' USING ERRCODE = '42501';
  END IF;

  SET LOCAL ambra.inventory_movement_engine = 'on';

  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, draft_number INTO v_existing_id, v_existing_draft
    FROM inventory_movement_headers
    WHERE organization_id = p_organization_id AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object('movement_id', v_existing_id, 'draft_number', v_existing_draft, 'status', 'draft');
    END IF;
  END IF;

  -- Validate movement type
  SELECT mt.id, mt.code, mt.document_type_id, mt.category,
         mt.requires_source_location, mt.requires_destination_location,
         mt.requires_reference, mt.requires_note,
         mt.is_system, mt.allows_manual_entry,
         dt.code AS doc_type_code
  INTO v_mvt_type
  FROM inventory_movement_types mt
  JOIN inventory_document_types dt ON dt.id = mt.document_type_id
  WHERE mt.organization_id = p_organization_id
    AND mt.code = p_movement_type_code
    AND mt.deleted_at IS NULL
    AND mt.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movement type "%" not found or inactive', p_movement_type_code;
  END IF;

  -- Defense in depth (this pass): movement types explicitly flagged
  -- `allows_manual_entry = false` (currently only 900, the system
  -- reversal type) must never be manually/directly draftable. `is_system`
  -- is a separate, unrelated flag (true for every seeded catalog type,
  -- including 101/401/402/801) and must NOT be used as a manual-entry
  -- gate -- live-verified before this fix; an earlier version of this
  -- migration incorrectly rejected every seeded type using `is_system`.
  IF NOT v_mvt_type.allows_manual_entry THEN
    RAISE EXCEPTION 'Movement type "%" is system-managed and cannot be manually created', p_movement_type_code
      USING ERRCODE = '42501';
  END IF;

  -- Validate lines
  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one line is required';
  END IF;

  -- Validate field requirements
  IF v_mvt_type.requires_reference AND (p_external_reference IS NULL OR length(trim(p_external_reference)) = 0) THEN
    RAISE EXCEPTION 'External reference is required for movement type %', p_movement_type_code;
  END IF;
  IF v_mvt_type.requires_note AND (p_note IS NULL OR length(trim(p_note)) = 0) THEN
    RAISE EXCEPTION 'Note is required for movement type %', p_movement_type_code;
  END IF;

  -- Generate draft number
  SELECT * INTO v_settings FROM inventory_settings
  WHERE organization_id = p_organization_id FOR UPDATE;

  v_draft_number := v_settings.draft_number_prefix || '-' || lpad(v_settings.draft_number_next::text, 6, '0');

  UPDATE inventory_settings
  SET draft_number_next = draft_number_next + 1, updated_at = now()
  WHERE organization_id = p_organization_id;

  -- Insert header
  INSERT INTO inventory_movement_headers (
    organization_id, branch_id, movement_type_id, movement_type_code,
    draft_number, status, operation_date, document_date,
    counterparty_name, external_reference, note,
    idempotency_key, created_by
  ) VALUES (
    p_organization_id, p_branch_id, v_mvt_type.id, v_mvt_type.code,
    v_draft_number, 'draft', COALESCE(p_operation_date, CURRENT_DATE), p_document_date,
    p_counterparty_name, p_external_reference, p_note,
    p_idempotency_key, p_actor_user_id
  ) RETURNING id INTO v_header_id;

  -- Insert lines
  FOR v_line IN SELECT * FROM jsonb_to_recordset(p_lines)
    AS x(variant_id uuid, unit_id uuid, quantity numeric,
         source_location_id uuid, destination_location_id uuid,
         unit_cost numeric, note text)
  LOOP
    v_line_number := v_line_number + 1;

    IF v_line.quantity IS NULL OR v_line.quantity <= 0 THEN
      RAISE EXCEPTION 'Line % quantity must be positive', v_line_number;
    END IF;

    -- Validate source location
    IF v_mvt_type.requires_source_location THEN
      IF v_line.source_location_id IS NULL THEN
        RAISE EXCEPTION 'Line %: source location required for type %', v_line_number, p_movement_type_code;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM warehouse_locations
        WHERE id = v_line.source_location_id
          AND organization_id = p_organization_id
          AND branch_id = p_branch_id
          AND can_store_inventory = true
          AND deleted_at IS NULL
      ) THEN
        RAISE EXCEPTION 'Line %: source location is not a valid stockable bin in this branch', v_line_number;
      END IF;
    END IF;

    -- Validate destination location
    IF v_mvt_type.requires_destination_location THEN
      IF v_line.destination_location_id IS NULL THEN
        RAISE EXCEPTION 'Line %: destination location required for type %', v_line_number, p_movement_type_code;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM warehouse_locations
        WHERE id = v_line.destination_location_id
          AND organization_id = p_organization_id
          AND branch_id = p_branch_id
          AND can_store_inventory = true
          AND deleted_at IS NULL
      ) THEN
        RAISE EXCEPTION 'Line %: destination location is not a valid stockable bin in this branch', v_line_number;
      END IF;
    END IF;

    INSERT INTO inventory_movement_lines (
      organization_id, branch_id, movement_id, line_number,
      variant_id, unit_id, quantity,
      source_location_id, destination_location_id,
      unit_cost, note
    ) VALUES (
      p_organization_id, p_branch_id, v_header_id, v_line_number,
      v_line.variant_id, v_line.unit_id, v_line.quantity,
      v_line.source_location_id, v_line.destination_location_id,
      v_line.unit_cost, v_line.note
    );
  END LOOP;

  -- Audit log
  INSERT INTO inventory_movement_audit_log (
    organization_id, movement_id, action, new_status,
    entity_type, entity_id, actor_user_id,
    transaction_id
  ) VALUES (
    p_organization_id, v_header_id, 'created', 'draft',
    'header', v_header_id, p_actor_user_id,
    txid_current()::text
  );

  RETURN jsonb_build_object(
    'movement_id', v_header_id,
    'draft_number', v_draft_number,
    'status', 'draft'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_create_draft(uuid, uuid, text, jsonb, date, date, text, text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_create_draft(uuid, uuid, text, jsonb, date, date, text, text, text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_create_draft(uuid, uuid, text, jsonb, date, date, text, text, text, text, uuid) TO authenticated, service_role;
