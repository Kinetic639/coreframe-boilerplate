-- Repair-order import + PZ attribution by ZL/part code + KPZ (receipt
-- correction). Product decision 2026-10-02:
--   * The Matcher only parses, matches and saves a session. Repair orders
--     are created by a generic "repair order import" (Workshop), with the
--     Matcher as one source; the PZ import reuses the same mechanism.
--   * A PZ line is attributed to a repair order by ZL number + part code,
--     whatever created the order, capped at what is still outstanding.
--   * KPZ (102, document KPZ) corrects a posted PZ downwards and is linked
--     to it line by line; storno (900) stays for whole-document mistakes.
-- The inventory engine (inventory_create_draft / inventory_finalize_posting)
-- is reused unchanged. Additive only.

-- ---------------------------------------------------------------------
-- Part-code normalisation shared by import and attribution.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.repair_order_normalize_product_code(p_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT NULLIF(upper(regexp_replace(COALESCE(p_code, ''), '[^A-Za-z0-9]', '', 'g')), '');
$function$;

-- ---------------------------------------------------------------------
-- Generic repair-order import.
-- p_orders: [{ zl_number, order_number?, vin?, vehicle_brand?, client_name?,
--              dealer_name?, source?: { session_id, block_id },
--              lines: [{ product_code, product_name, quantity, unit?,
--                        raw_text?, matcher_line_id? }] }]
-- Per order: an existing OPEN order with that ZL is reused (missing header
-- fields filled, new parts added); a closed/archived one is a conflict and
-- left untouched; otherwise the order is created. Matcher provenance
-- (source documents/lines) makes re-importing a session a no-op; a line
-- without provenance only adds a part the order does not have yet.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.repair_orders_import(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_orders jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order jsonb;
  v_line jsonb;
  v_zl text;
  v_ro record;
  v_ro_id uuid;
  v_outcome text;
  v_session_id uuid;
  v_block_id uuid;
  v_doc_id uuid;
  v_doc_line_id uuid;
  v_rol_id uuid;
  v_qty numeric;
  v_code text;
  v_added integer;
  v_results jsonb := '[]'::jsonb;
  v_created integer := 0;
  v_updated integer := 0;
  v_unchanged integer := 0;
  v_conflicts integer := 0;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  IF NOT (
    public.has_branch_permission(p_organization_id, p_branch_id, 'workshop.repair_orders.manage_own')
    OR public.has_branch_permission(p_organization_id, p_branch_id, 'workshop.repair_orders.manage_all')
  ) THEN
    RAISE EXCEPTION 'Not authorized to import repair orders for this branch' USING ERRCODE = '42501';
  END IF;

  IF p_orders IS NULL OR jsonb_typeof(p_orders) <> 'array' OR jsonb_array_length(p_orders) = 0 THEN
    RAISE EXCEPTION 'At least one repair order is required' USING ERRCODE = '22023';
  END IF;

  FOR v_order IN SELECT * FROM jsonb_array_elements(p_orders)
  LOOP
    v_zl := NULLIF(trim(v_order->>'zl_number'), '');
    IF v_zl IS NULL THEN
      v_conflicts := v_conflicts + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'zl_number', NULL, 'outcome', 'conflict', 'reason', 'missing_zl'));
      CONTINUE;
    END IF;

    v_session_id := NULLIF(v_order #>> '{source,session_id}', '')::uuid;
    v_block_id := NULLIF(v_order #>> '{source,block_id}', '')::uuid;
    IF v_session_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.wdd_matcher_sessions s
      WHERE s.id = v_session_id AND s.organization_id = p_organization_id AND s.branch_id = p_branch_id
    ) THEN
      RAISE EXCEPTION 'Matcher session does not belong to this branch' USING ERRCODE = '42501';
    END IF;

    SELECT id, status INTO v_ro
    FROM public.repair_orders
    WHERE organization_id = p_organization_id AND branch_id = p_branch_id
      AND zl_number = v_zl AND deleted_at IS NULL
    FOR UPDATE;

    IF FOUND AND v_ro.status <> 'open' THEN
      v_conflicts := v_conflicts + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'zl_number', v_zl, 'repair_order_id', v_ro.id, 'outcome', 'conflict',
        'reason', 'repair_order_' || v_ro.status));
      CONTINUE;
    END IF;

    IF FOUND THEN
      v_ro_id := v_ro.id;
      v_outcome := 'unchanged';
      UPDATE public.repair_orders
      SET order_number = COALESCE(order_number, NULLIF(trim(v_order->>'order_number'), '')),
          vin = COALESCE(vin, NULLIF(trim(v_order->>'vin'), '')),
          vehicle_brand = COALESCE(vehicle_brand, NULLIF(trim(v_order->>'vehicle_brand'), '')),
          client_name = COALESCE(client_name, NULLIF(trim(v_order->>'client_name'), '')),
          dealer_name = COALESCE(dealer_name, NULLIF(trim(v_order->>'dealer_name'), '')),
          updated_at = now()
      WHERE id = v_ro_id;
    ELSE
      INSERT INTO public.repair_orders (
        organization_id, branch_id, zl_number, order_number, identity_status,
        vin, vehicle_brand, client_name, dealer_name, status, created_by
      ) VALUES (
        p_organization_id, p_branch_id, v_zl, NULLIF(trim(v_order->>'order_number'), ''), 'resolved',
        NULLIF(trim(v_order->>'vin'), ''), NULLIF(trim(v_order->>'vehicle_brand'), ''),
        NULLIF(trim(v_order->>'client_name'), ''), NULLIF(trim(v_order->>'dealer_name'), ''),
        'open', p_actor_user_id
      )
      ON CONFLICT (organization_id, branch_id, zl_number) WHERE zl_number IS NOT NULL AND deleted_at IS NULL
      DO NOTHING
      RETURNING id INTO v_ro_id;

      IF v_ro_id IS NULL THEN
        SELECT id INTO v_ro_id FROM public.repair_orders
        WHERE organization_id = p_organization_id AND branch_id = p_branch_id
          AND zl_number = v_zl AND deleted_at IS NULL;
        v_outcome := 'unchanged';
      ELSE
        v_outcome := 'created';
      END IF;
    END IF;

    v_doc_id := NULL;
    IF v_session_id IS NOT NULL THEN
      INSERT INTO public.workshop_source_documents (
        organization_id, branch_id, document_type, external_document_number,
        source_session_id, official_warehouse_code, block_id
      ) VALUES (
        p_organization_id, p_branch_id, 'zl', v_zl, v_session_id,
        (regexp_match(v_zl, '/(\d{3,4})/BL$'))[1], v_block_id
      )
      ON CONFLICT (organization_id, branch_id, document_type, external_document_number, source_session_id)
      DO NOTHING
      RETURNING id INTO v_doc_id;

      IF v_doc_id IS NULL THEN
        SELECT id INTO v_doc_id FROM public.workshop_source_documents
        WHERE organization_id = p_organization_id AND branch_id = p_branch_id
          AND document_type = 'zl' AND external_document_number = v_zl
          AND source_session_id = v_session_id;
      END IF;

      INSERT INTO public.repair_order_source_document_links (repair_order_id, workshop_source_document_id, linked_by)
      VALUES (v_ro_id, v_doc_id, p_actor_user_id)
      ON CONFLICT (repair_order_id, workshop_source_document_id) DO NOTHING;
    END IF;

    v_added := 0;
    FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(v_order->'lines', '[]'::jsonb))
    LOOP
      v_qty := NULLIF(v_line->>'quantity', '')::numeric;
      v_code := NULLIF(trim(v_line->>'product_code'), '');
      IF v_qty IS NULL OR v_qty <= 0 THEN
        CONTINUE;
      END IF;

      v_doc_line_id := NULL;
      IF v_doc_id IS NOT NULL AND NULLIF(v_line->>'matcher_line_id', '') IS NOT NULL THEN
        INSERT INTO public.workshop_source_document_lines (
          workshop_source_document_id, wdd_matcher_line_id, product_code, product_name, quantity, unit, raw_text
        ) VALUES (
          v_doc_id, (v_line->>'matcher_line_id')::uuid, v_code, NULLIF(trim(v_line->>'product_name'), ''),
          v_qty, NULLIF(trim(v_line->>'unit'), ''), v_line->>'raw_text'
        )
        ON CONFLICT (workshop_source_document_id, wdd_matcher_line_id) WHERE wdd_matcher_line_id IS NOT NULL
        DO NOTHING
        RETURNING id INTO v_doc_line_id;

        -- Already imported from this session: nothing to add.
        IF v_doc_line_id IS NULL THEN
          CONTINUE;
        END IF;
      END IF;

      v_rol_id := NULL;
      IF v_code IS NOT NULL THEN
        SELECT id INTO v_rol_id FROM public.repair_order_lines
        WHERE repair_order_id = v_ro_id AND deleted_at IS NULL
          AND public.repair_order_normalize_product_code(product_code)
              = public.repair_order_normalize_product_code(v_code)
        ORDER BY created_at
        LIMIT 1
        FOR UPDATE;
      END IF;

      IF v_rol_id IS NULL THEN
        INSERT INTO public.repair_order_lines (
          repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit
        ) VALUES (
          v_ro_id, NULL, v_code,
          COALESCE(NULLIF(trim(v_line->>'product_name'), ''), NULLIF(v_line->>'raw_text', ''), v_code, 'Nieznana część'),
          v_qty, NULLIF(trim(v_line->>'unit'), '')
        )
        RETURNING id INTO v_rol_id;
        v_added := v_added + 1;
      ELSIF v_doc_line_id IS NOT NULL THEN
        UPDATE public.repair_order_lines
        SET ordered_quantity = ordered_quantity + v_qty, updated_at = now()
        WHERE id = v_rol_id;
        v_added := v_added + 1;
      ELSE
        CONTINUE;
      END IF;

      IF v_doc_line_id IS NOT NULL THEN
        INSERT INTO public.repair_order_line_source_links (
          repair_order_line_id, workshop_source_document_line_id, quantity_contribution
        ) VALUES (v_rol_id, v_doc_line_id, v_qty)
        ON CONFLICT (workshop_source_document_line_id) DO NOTHING;
      END IF;
    END LOOP;

    IF v_outcome = 'unchanged' AND v_added > 0 THEN
      v_outcome := 'updated';
    END IF;

    IF v_outcome = 'created' THEN
      v_created := v_created + 1;
    ELSIF v_outcome = 'updated' THEN
      v_updated := v_updated + 1;
    ELSE
      v_unchanged := v_unchanged + 1;
    END IF;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'zl_number', v_zl, 'repair_order_id', v_ro_id, 'outcome', v_outcome, 'added_lines', v_added));
  END LOOP;

  RETURN jsonb_build_object(
    'created', v_created, 'updated', v_updated, 'unchanged', v_unchanged,
    'conflicts', v_conflicts, 'orders', v_results);
END;
$function$;

-- ---------------------------------------------------------------------
-- What is still outstanding on a repair-order line: ordered minus received
-- on posted PZs, plus whatever a posted KPZ took back.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.repair_order_line_outstanding_receipt(p_repair_order_line_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT rol.ordered_quantity
    - COALESCE((
        SELECT SUM(l.applied_quantity)
        FROM public.repair_order_line_movement_links l
        JOIN public.inventory_movement_lines ml ON ml.id = l.inventory_movement_line_id
        JOIN public.inventory_movement_headers h ON h.id = ml.movement_id
        WHERE l.repair_order_line_id = rol.id AND l.relation_type = 'receipt' AND h.status = 'posted'
      ), 0)
    + COALESCE((
        SELECT SUM(l.applied_quantity)
        FROM public.repair_order_line_movement_links l
        JOIN public.inventory_movement_lines ml ON ml.id = l.inventory_movement_line_id
        JOIN public.inventory_movement_headers h ON h.id = ml.movement_id
        WHERE l.repair_order_line_id = rol.id AND l.relation_type = 'reversal'
          AND h.status = 'posted' AND h.reference_type = 'movement_correction'
      ), 0)
  FROM public.repair_order_lines rol
  WHERE rol.id = p_repair_order_line_id;
$function$;

-- ---------------------------------------------------------------------
-- Attribute a posted PZ's lines to repair orders by ZL + part code.
-- p_lines: [{ movement_line_id, zl_number, product_code }]
-- Only open orders; capped at what is outstanding (a re-imported delivery
-- never receives the same part twice -- the excess stays free stock).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inventory_attribute_receipt_to_repair_orders(
  p_actor_user_id uuid,
  p_movement_id uuid,
  p_lines jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_header record;
  v_line jsonb;
  v_ml record;
  v_zl text;
  v_code text;
  v_ro record;
  v_rol record;
  v_outstanding numeric;
  v_apply numeric;
  v_attributed jsonb := '[]'::jsonb;
  v_skipped jsonb := '[]'::jsonb;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  SELECT h.id, h.organization_id, h.branch_id, h.status, t.category
  INTO v_header
  FROM public.inventory_movement_headers h
  JOIN public.inventory_movement_types t ON t.id = h.movement_type_id
  WHERE h.id = p_movement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movement not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.has_branch_permission(v_header.organization_id, v_header.branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;

  IF v_header.status <> 'posted' OR v_header.category <> 'receipt' THEN
    RAISE EXCEPTION 'Only a posted receipt can be attributed' USING ERRCODE = '55000';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb))
  LOOP
    SELECT id, variant_id, quantity INTO v_ml
    FROM public.inventory_movement_lines
    WHERE id = NULLIF(v_line->>'movement_line_id', '')::uuid
      AND movement_id = p_movement_id AND deleted_at IS NULL;

    v_zl := NULLIF(trim(v_line->>'zl_number'), '');
    v_code := public.repair_order_normalize_product_code(v_line->>'product_code');

    IF v_ml.id IS NULL OR v_zl IS NULL OR v_code IS NULL THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'movement_line_id', v_line->>'movement_line_id', 'reason', 'invalid_line'));
      CONTINUE;
    END IF;

    SELECT id, status INTO v_ro
    FROM public.repair_orders
    WHERE organization_id = v_header.organization_id AND branch_id = v_header.branch_id
      AND zl_number = v_zl AND deleted_at IS NULL;

    IF NOT FOUND THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'movement_line_id', v_ml.id, 'zl_number', v_zl, 'reason', 'no_repair_order'));
      CONTINUE;
    END IF;

    IF v_ro.status <> 'open' THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'movement_line_id', v_ml.id, 'zl_number', v_zl, 'reason', 'repair_order_' || v_ro.status));
      CONTINUE;
    END IF;

    SELECT id, variant_id INTO v_rol
    FROM public.repair_order_lines
    WHERE repair_order_id = v_ro.id AND deleted_at IS NULL
      AND public.repair_order_normalize_product_code(product_code) = v_code
    ORDER BY created_at
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'movement_line_id', v_ml.id, 'zl_number', v_zl, 'reason', 'no_repair_order_line'));
      CONTINUE;
    END IF;

    IF v_rol.variant_id IS NOT NULL AND v_rol.variant_id <> v_ml.variant_id THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'movement_line_id', v_ml.id, 'zl_number', v_zl, 'reason', 'variant_mismatch'));
      CONTINUE;
    END IF;

    v_outstanding := public.repair_order_line_outstanding_receipt(v_rol.id);
    v_apply := LEAST(v_ml.quantity, GREATEST(v_outstanding, 0));
    IF v_apply <= 0 THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'movement_line_id', v_ml.id, 'zl_number', v_zl, 'reason', 'already_received'));
      CONTINUE;
    END IF;

    -- An order line from a document carries only a part code; the posted
    -- receipt resolves it to a catalog variant.
    IF v_rol.variant_id IS NULL THEN
      UPDATE public.repair_order_lines SET variant_id = v_ml.variant_id, updated_at = now()
      WHERE id = v_rol.id AND variant_id IS NULL;
    END IF;

    BEGIN
      PERFORM public.attach_repair_order_line_movement(p_actor_user_id, v_rol.id, v_ml.id, v_apply, 'receipt');
      v_attributed := v_attributed || jsonb_build_array(jsonb_build_object(
        'movement_line_id', v_ml.id, 'repair_order_id', v_ro.id, 'repair_order_line_id', v_rol.id,
        'zl_number', v_zl, 'quantity', v_apply, 'free_quantity', v_ml.quantity - v_apply));
    EXCEPTION WHEN unique_violation THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'movement_line_id', v_ml.id, 'zl_number', v_zl, 'reason', 'already_attributed'));
    END;
  END LOOP;

  RETURN jsonb_build_object('movement_id', p_movement_id, 'attributed', v_attributed, 'skipped', v_skipped);
END;
$function$;

-- ---------------------------------------------------------------------
-- KPZ: catalog entry (document KPZ, movement 102, source on_hand decrease).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inventory_ensure_receipt_correction_type(p_organization_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_doc_id uuid;
  v_type_id uuid;
BEGIN
  INSERT INTO public.inventory_document_types (
    organization_id, code, name, name_pl, name_en, category, numbering_template, is_system
  ) VALUES (
    p_organization_id, 'KPZ', 'Goods Receipt Correction', 'Korekta przyjęcia zewnętrznego',
    'Goods Receipt Correction', 'adjustment', 'KPZ/{year}/{seq:6}', true
  )
  ON CONFLICT (organization_id, code) WHERE deleted_at IS NULL DO NOTHING
  RETURNING id INTO v_doc_id;

  IF v_doc_id IS NULL THEN
    SELECT id INTO v_doc_id FROM public.inventory_document_types
    WHERE organization_id = p_organization_id AND code = 'KPZ' AND deleted_at IS NULL;
  END IF;

  INSERT INTO public.inventory_movement_types (
    organization_id, code, document_type_id, name, name_pl, name_en, category,
    requires_source_location, requires_destination_location, cost_impact, is_system
  ) VALUES (
    p_organization_id, '102', v_doc_id, 'Goods Receipt Correction (KPZ)',
    'Korekta przyjęcia (KPZ)', 'Goods Receipt Correction', 'adjustment',
    true, false, 'decrease', true
  )
  ON CONFLICT (organization_id, code) WHERE deleted_at IS NULL DO NOTHING
  RETURNING id INTO v_type_id;

  IF v_type_id IS NULL THEN
    SELECT id INTO v_type_id FROM public.inventory_movement_types
    WHERE organization_id = p_organization_id AND code = '102' AND deleted_at IS NULL;
  END IF;

  INSERT INTO public.inventory_movement_type_effects (
    movement_type_id, effect_order, target, balance_field, direction, is_required, description
  ) VALUES (
    v_type_id, 1, 'source', 'on_hand', 'decrease', true, 'Take back stock a corrected PZ put in'
  )
  ON CONFLICT (movement_type_id, effect_order) DO NOTHING;

  RETURN v_type_id;
END;
$function$;

SELECT public.inventory_ensure_receipt_correction_type(o.organization_id)
FROM (SELECT DISTINCT organization_id FROM public.inventory_movement_types WHERE deleted_at IS NULL) o;

-- Which PZ line each KPZ line corrects, and by how much.
CREATE TABLE IF NOT EXISTS public.inventory_movement_correction_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  correction_movement_id uuid NOT NULL REFERENCES public.inventory_movement_headers(id),
  correction_line_id uuid NOT NULL UNIQUE REFERENCES public.inventory_movement_lines(id),
  original_movement_id uuid NOT NULL REFERENCES public.inventory_movement_headers(id),
  original_line_id uuid NOT NULL REFERENCES public.inventory_movement_lines(id),
  quantity numeric NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_movement_correction_lines_original_line_idx
  ON public.inventory_movement_correction_lines (original_line_id);
CREATE INDEX IF NOT EXISTS inventory_movement_correction_lines_original_movement_idx
  ON public.inventory_movement_correction_lines (original_movement_id);

ALTER TABLE public.inventory_movement_correction_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movement_correction_lines FORCE ROW LEVEL SECURITY;

CREATE POLICY inventory_movement_correction_lines_select
  ON public.inventory_movement_correction_lines FOR SELECT
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read'));

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.inventory_movement_correction_lines FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.inventory_movement_correction_lines TO authenticated;

-- ---------------------------------------------------------------------
-- Post a KPZ against a posted PZ.
-- p_lines: [{ original_line_id, quantity }]
-- Each line takes back at most what the PZ line brought in minus earlier
-- posted corrections, from the location the PZ put it. The free part of a
-- PZ line is corrected first; only beyond that does the KPZ take back the
-- repair-order receipt (relation 'reversal' on the KPZ line). The engine
-- refuses if the stock has moved on or is committed (P0003).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inventory_post_receipt_correction(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_movement_id uuid,
  p_lines jsonb,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_pz record;
  v_line jsonb;
  v_ml record;
  v_qty numeric;
  v_done numeric;
  v_remaining numeric;
  v_ro_remaining numeric;
  v_ro_take numeric;
  v_take numeric;
  v_link record;
  v_link_left numeric;
  v_engine_lines jsonb := '[]'::jsonb;
  v_meta jsonb := '[]'::jsonb;
  v_ro_takes jsonb;
  v_seen uuid[] := ARRAY[]::uuid[];
  v_draft jsonb;
  v_movement_id uuid;
  v_posted jsonb;
  v_ml_ids uuid[];
  v_i integer;
  v_take_row jsonb;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A correction reason is required' USING ERRCODE = '22023';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one line is required' USING ERRCODE = '22023';
  END IF;

  SELECT id, document_number, status, movement_type_code INTO v_pz
  FROM public.inventory_movement_headers
  WHERE id = p_movement_id AND organization_id = p_organization_id AND branch_id = p_branch_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receipt not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_pz.movement_type_code <> '101' OR v_pz.status <> 'posted' THEN
    RAISE EXCEPTION 'Only a posted PZ can be corrected' USING ERRCODE = '55000';
  END IF;

  PERFORM public.inventory_ensure_receipt_correction_type(p_organization_id);
  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_qty := NULLIF(v_line->>'quantity', '')::numeric;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    SELECT id, variant_id, unit_id, quantity, destination_location_id INTO v_ml
    FROM public.inventory_movement_lines
    WHERE id = NULLIF(v_line->>'original_line_id', '')::uuid
      AND movement_id = p_movement_id AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Line does not belong to this PZ' USING ERRCODE = '22023';
    END IF;

    IF v_ml.id = ANY (v_seen) THEN
      RAISE EXCEPTION 'A PZ line may appear only once per correction' USING ERRCODE = '22023';
    END IF;
    v_seen := array_append(v_seen, v_ml.id);

    SELECT COALESCE(SUM(c.quantity), 0) INTO v_done
    FROM public.inventory_movement_correction_lines c
    JOIN public.inventory_movement_headers h ON h.id = c.correction_movement_id
    WHERE c.original_line_id = v_ml.id AND h.status = 'posted';

    v_remaining := v_ml.quantity - v_done;
    IF v_qty > v_remaining THEN
      RAISE EXCEPTION 'Only % left to correct on this line', v_remaining USING ERRCODE = '22023';
    END IF;

    -- Repair-order part of this PZ line still standing (receipt minus what
    -- earlier KPZs took back from it).
    SELECT COALESCE(SUM(l.applied_quantity), 0) INTO v_ro_remaining
    FROM public.repair_order_line_movement_links l
    WHERE l.inventory_movement_line_id = v_ml.id AND l.relation_type = 'receipt';
    v_ro_remaining := v_ro_remaining - COALESCE((
      SELECT SUM(l.applied_quantity)
      FROM public.inventory_movement_correction_lines c
      JOIN public.inventory_movement_headers h ON h.id = c.correction_movement_id AND h.status = 'posted'
      JOIN public.repair_order_line_movement_links l
        ON l.inventory_movement_line_id = c.correction_line_id AND l.relation_type = 'reversal'
      WHERE c.original_line_id = v_ml.id
    ), 0);

    -- Free part first; only the rest comes off the repair order(s).
    v_ro_take := GREATEST(v_qty - (v_remaining - GREATEST(v_ro_remaining, 0)), 0);
    v_ro_takes := '[]'::jsonb;
    FOR v_link IN
      SELECT l.repair_order_line_id, l.applied_quantity
      FROM public.repair_order_line_movement_links l
      WHERE l.inventory_movement_line_id = v_ml.id AND l.relation_type = 'receipt'
      ORDER BY l.created_at
    LOOP
      EXIT WHEN v_ro_take <= 0;
      v_link_left := v_link.applied_quantity - COALESCE((
        SELECT SUM(l2.applied_quantity)
        FROM public.inventory_movement_correction_lines c
        JOIN public.inventory_movement_headers h ON h.id = c.correction_movement_id AND h.status = 'posted'
        JOIN public.repair_order_line_movement_links l2
          ON l2.inventory_movement_line_id = c.correction_line_id AND l2.relation_type = 'reversal'
        WHERE c.original_line_id = v_ml.id AND l2.repair_order_line_id = v_link.repair_order_line_id
      ), 0);
      v_take := LEAST(v_ro_take, GREATEST(v_link_left, 0));
      IF v_take > 0 THEN
        v_ro_takes := v_ro_takes || jsonb_build_array(jsonb_build_object(
          'repair_order_line_id', v_link.repair_order_line_id, 'quantity', v_take));
        v_ro_take := v_ro_take - v_take;
      END IF;
    END LOOP;

    v_engine_lines := v_engine_lines || jsonb_build_array(jsonb_build_object(
      'variant_id', v_ml.variant_id,
      'unit_id', v_ml.unit_id,
      'quantity', v_qty,
      'source_location_id', v_ml.destination_location_id,
      'note', NULL));
    v_meta := v_meta || jsonb_build_array(jsonb_build_object(
      'original_line_id', v_ml.id, 'quantity', v_qty, 'ro_takes', v_ro_takes));
  END LOOP;

  IF jsonb_array_length(v_meta) = 0 THEN
    RAISE EXCEPTION 'At least one line with a positive quantity is required' USING ERRCODE = '22023';
  END IF;

  v_draft := public.inventory_create_draft(
    p_organization_id, p_branch_id, '102', v_engine_lines,
    NULL, NULL, NULL, v_pz.document_number, trim(p_reason), NULL, p_actor_user_id);
  v_movement_id := (v_draft->>'movement_id')::uuid;

  UPDATE public.inventory_movement_headers
  SET reference_type = 'movement_correction', reference_id = v_pz.id::text
  WHERE id = v_movement_id;

  SELECT array_agg(id ORDER BY line_number) INTO v_ml_ids
  FROM public.inventory_movement_lines WHERE movement_id = v_movement_id;

  v_posted := public.inventory_finalize_posting(v_movement_id, p_actor_user_id);

  FOR v_i IN 1..jsonb_array_length(v_meta)
  LOOP
    INSERT INTO public.inventory_movement_correction_lines (
      organization_id, branch_id, correction_movement_id, correction_line_id,
      original_movement_id, original_line_id, quantity
    ) VALUES (
      p_organization_id, p_branch_id, v_movement_id, v_ml_ids[v_i],
      v_pz.id, (v_meta->(v_i - 1)->>'original_line_id')::uuid, (v_meta->(v_i - 1)->>'quantity')::numeric
    );

    FOR v_take_row IN SELECT * FROM jsonb_array_elements(v_meta->(v_i - 1)->'ro_takes')
    LOOP
      PERFORM public.write_repair_order_line_movement_link_internal(
        (v_take_row->>'repair_order_line_id')::uuid, v_ml_ids[v_i],
        (v_take_row->>'quantity')::numeric, 'reversal');
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'movement_id', v_movement_id,
    'document_number', v_posted->>'document_number',
    'line_count', jsonb_array_length(v_meta),
    'original_movement_id', v_pz.id);
END;
$function$;

-- ---------------------------------------------------------------------
-- Grants.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.repair_order_normalize_product_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.repair_order_normalize_product_code(text) TO authenticated;

REVOKE ALL ON FUNCTION public.repair_orders_import(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.repair_orders_import(uuid, uuid, uuid, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.repair_order_line_outstanding_receipt(uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.inventory_attribute_receipt_to_repair_orders(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_attribute_receipt_to_repair_orders(uuid, uuid, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.inventory_ensure_receipt_correction_type(uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.inventory_post_receipt_correction(uuid, uuid, uuid, uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_post_receipt_correction(uuid, uuid, uuid, uuid, jsonb, text) TO authenticated;
