-- ============================================================================
-- Internal orders (ZW), stage E1 (docs/INTERNAL_ORDERS_PLAN.md)
-- ============================================================================
-- 1. internal_orders / internal_order_lines: Ambra's own ZW documents,
--    numbered like AutoStacja (ZW/<no>/<yy>/<warehouse>) from 1 per
--    warehouse and year, with the AutoStacja ZW number in external_number
--    (one Ambra ZW per AutoStacja ZW). A ZW may belong to a repair order or
--    stand alone (an order from another branch, e.g. WYSOG).
-- 2. internal_order_line_movement_links: every receipt under a ZW line is a
--    row of its own (document, quantity, time) -- nothing is overwritten.
-- 3. inventory_reservation_lines.internal_order_line_id: a reservation line
--    names its ZW line; moved copies (putaway) keep it.
-- 4. Posting a PZ from a Matcher session finds or creates the ZW of each
--    line's block and reserves the part under it: through the repair order
--    as before when the ZW belongs to one, under the ZW alone otherwise.
--    Only what is on no ZW stays free.
-- 5. The receiving zone lists parts reserved under a ZW alone (not free, not
--    for putaway as free stock).
-- 6. internal_order_line_status: R / W per ZW line, computed from the rows.
-- Additive: no existing row is changed or removed.
-- ============================================================================

-- 1. Tables -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.internal_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  order_number text NOT NULL,
  order_no integer NOT NULL CHECK (order_no > 0),
  order_year smallint NOT NULL,
  warehouse_code text NOT NULL,
  external_number text,
  external_zl_number text,
  repair_order_id uuid REFERENCES public.repair_orders(id),
  client_kind text NOT NULL CHECK (client_kind IN ('repair_order', 'branch', 'other')),
  client_name text,
  destination_code text,
  destination_branch_id uuid REFERENCES public.branches(id),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'cancelled')),
  source text NOT NULL CHECK (source IN ('matcher', 'manual')),
  source_session_id uuid,
  source_block_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT internal_orders_number_unique UNIQUE (organization_id, order_number),
  CONSTRAINT internal_orders_sequence_unique UNIQUE (organization_id, warehouse_code, order_year, order_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS internal_orders_external_number_unique
  ON public.internal_orders (organization_id, external_number)
  WHERE external_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS internal_orders_branch_idx
  ON public.internal_orders (organization_id, branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS internal_orders_repair_order_idx
  ON public.internal_orders (repair_order_id) WHERE repair_order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.internal_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_order_id uuid NOT NULL REFERENCES public.internal_orders(id),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  line_number integer NOT NULL CHECK (line_number > 0),
  product_code text,
  product_name text NOT NULL,
  variant_id uuid REFERENCES public.inventory_variants(id),
  quantity numeric NOT NULL CHECK (quantity > 0),
  -- True only for lines ordered in Ambra (status Z); lines known from a
  -- delivery document were never "ordered" here.
  ordered boolean NOT NULL DEFAULT false,
  repair_order_line_id uuid REFERENCES public.repair_order_lines(id),
  source text NOT NULL CHECK (source IN ('matcher', 'manual')),
  source_matcher_line_id uuid,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancel_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT internal_order_lines_number_unique UNIQUE (internal_order_id, line_number),
  CONSTRAINT internal_order_lines_cancel_consistent CHECK (
    (cancelled_at IS NULL AND cancel_reason IS NULL) OR
    (cancelled_at IS NOT NULL AND length(trim(COALESCE(cancel_reason, ''))) > 0))
);

CREATE UNIQUE INDEX IF NOT EXISTS internal_order_lines_matcher_line_unique
  ON public.internal_order_lines (source_matcher_line_id)
  WHERE source_matcher_line_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS internal_order_lines_order_idx
  ON public.internal_order_lines (internal_order_id);
CREATE INDEX IF NOT EXISTS internal_order_lines_rol_idx
  ON public.internal_order_lines (repair_order_line_id) WHERE repair_order_line_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.internal_order_line_movement_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_order_line_id uuid NOT NULL REFERENCES public.internal_order_lines(id),
  inventory_movement_line_id uuid NOT NULL REFERENCES public.inventory_movement_lines(id),
  applied_quantity numeric NOT NULL CHECK (applied_quantity > 0),
  relation_type text NOT NULL CHECK (relation_type IN ('receipt', 'issue', 'transfer_out')),
  -- Set when the receipt is held through the repair order (its REZ).
  repair_order_line_id uuid REFERENCES public.repair_order_lines(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT internal_order_line_movement_links_unique
    UNIQUE (internal_order_line_id, inventory_movement_line_id, relation_type)
);

CREATE INDEX IF NOT EXISTS internal_order_line_movement_links_ml_idx
  ON public.internal_order_line_movement_links (inventory_movement_line_id);

CREATE TABLE IF NOT EXISTS public.internal_order_counters (
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  warehouse_code text NOT NULL,
  order_year smallint NOT NULL,
  next_no integer NOT NULL CHECK (next_no > 0),
  PRIMARY KEY (organization_id, warehouse_code, order_year)
);

ALTER TABLE public.inventory_reservation_lines
  ADD COLUMN IF NOT EXISTS internal_order_line_id uuid REFERENCES public.internal_order_lines(id);
CREATE INDEX IF NOT EXISTS inventory_reservation_lines_iol_idx
  ON public.inventory_reservation_lines (internal_order_line_id) WHERE internal_order_line_id IS NOT NULL;

-- RLS: read with warehouse or workshop read access in the branch; every
-- write goes through SECURITY DEFINER functions.
ALTER TABLE public.internal_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_order_line_movement_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_order_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY internal_orders_select ON public.internal_orders FOR SELECT TO authenticated
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read')
      OR public.has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.read'));
CREATE POLICY internal_orders_write_restrict_insert ON public.internal_orders AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY internal_orders_write_restrict_update ON public.internal_orders AS RESTRICTIVE FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY internal_orders_write_restrict_delete ON public.internal_orders AS RESTRICTIVE FOR DELETE TO authenticated USING (false);

CREATE POLICY internal_order_lines_select ON public.internal_order_lines FOR SELECT TO authenticated
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read')
      OR public.has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.read'));
CREATE POLICY internal_order_lines_write_restrict_insert ON public.internal_order_lines AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY internal_order_lines_write_restrict_update ON public.internal_order_lines AS RESTRICTIVE FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY internal_order_lines_write_restrict_delete ON public.internal_order_lines AS RESTRICTIVE FOR DELETE TO authenticated USING (false);

CREATE POLICY internal_order_line_movement_links_select ON public.internal_order_line_movement_links FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.internal_order_lines iol
    WHERE iol.id = internal_order_line_movement_links.internal_order_line_id
      AND (public.has_branch_permission(iol.organization_id, iol.branch_id, 'warehouse.inventory.read')
        OR public.has_branch_permission(iol.organization_id, iol.branch_id, 'workshop.repair_orders.read'))));
CREATE POLICY internal_order_line_movement_links_write_restrict_insert ON public.internal_order_line_movement_links AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY internal_order_line_movement_links_write_restrict_update ON public.internal_order_line_movement_links AS RESTRICTIVE FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY internal_order_line_movement_links_write_restrict_delete ON public.internal_order_line_movement_links AS RESTRICTIVE FOR DELETE TO authenticated USING (false);

REVOKE ALL ON public.internal_order_counters FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.internal_orders, public.internal_order_lines,
  public.internal_order_line_movement_links FROM anon, authenticated;
REVOKE SELECT ON public.internal_orders, public.internal_order_lines,
  public.internal_order_line_movement_links FROM anon;

-- 2. Numbering ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.internal_order_next_number_internal(
  p_organization_id uuid,
  p_warehouse_code text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_year smallint := (extract(year from now())::int % 100)::smallint;
  v_no integer;
  v_code text := NULLIF(trim(p_warehouse_code), '');
BEGIN
  IF v_code IS NULL THEN
    RAISE EXCEPTION 'A warehouse code is required to number an internal order' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.internal_order_counters (organization_id, warehouse_code, order_year, next_no)
  VALUES (p_organization_id, v_code, v_year, 2)
  ON CONFLICT (organization_id, warehouse_code, order_year)
  DO UPDATE SET next_no = public.internal_order_counters.next_no + 1
  RETURNING next_no - 1 INTO v_no;

  RETURN jsonb_build_object(
    'order_no', v_no,
    'order_year', v_year,
    'warehouse_code', v_code,
    'order_number', 'ZW/' || v_no || '/' || lpad(v_year::text, 2, '0') || '/' || v_code);
END;
$function$;

REVOKE ALL ON FUNCTION public.internal_order_next_number_internal(uuid, text) FROM PUBLIC, anon, authenticated;

-- 3. The ZW of a Matcher line ---------------------------------------------------
-- Finds or creates the Ambra ZW for the line's block (by its AutoStacja ZW
-- number) and the ZW line for this Matcher line. NULL when the line is not
-- this branch's or its block names no ZW.

CREATE OR REPLACE FUNCTION public.internal_order_for_matcher_line_internal(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_matcher_line_id uuid,
  p_variant_id uuid,
  p_quantity numeric
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_line record;
  v_block record;
  v_meta jsonb;
  v_order_meta jsonb := '{}'::jsonb;
  v_brand_id uuid;
  v_zw text;
  v_zl text;
  v_note text;
  v_client text;
  v_wh text;
  v_num jsonb;
  v_ro_id uuid;
  v_io public.internal_orders%ROWTYPE;
  v_iol_id uuid;
  v_n integer;
BEGIN
  SELECT l.id, l.block_id, l.product_code, l.product_name, s.id AS session_id, s.branch_id
  INTO v_line
  FROM public.wdd_matcher_lines l
  JOIN public.wdd_matcher_sessions s ON s.id = l.session_id
  WHERE l.id = p_matcher_line_id AND l.organization_id = p_organization_id;
  IF NOT FOUND OR v_line.branch_id IS DISTINCT FROM p_branch_id THEN
    RETURN NULL;
  END IF;

  SELECT id, block_type, COALESCE(metadata, '{}'::jsonb) AS metadata INTO v_block
  FROM public.wdd_matcher_blocks
  WHERE id = v_line.block_id AND organization_id = p_organization_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  v_meta := v_block.metadata;

  -- A WDD line belongs to the brand order block it was matched with (same
  -- choice as the PZ import: the most confident match).
  IF v_block.block_type = 'wdd_reconciliation' THEN
    SELECT m.brand_block_id INTO v_brand_id
    FROM public.wdd_matcher_block_matches m
    WHERE m.organization_id = p_organization_id
      AND COALESCE(m.bc_block_id, m.wdd_block_id) = v_block.id
    ORDER BY m.block_confidence DESC
    LIMIT 1;
    IF v_brand_id IS NOT NULL THEN
      SELECT COALESCE(metadata, '{}'::jsonb) INTO v_order_meta
      FROM public.wdd_matcher_blocks WHERE id = v_brand_id;
    END IF;
  END IF;

  v_zw := NULLIF(trim(COALESCE(v_order_meta->>'zw_number', v_meta->>'zw_number')), '');
  IF v_zw IS NULL THEN
    RETURN NULL;
  END IF;
  v_zw := upper(v_zw);
  v_zl := NULLIF(trim(COALESCE(v_order_meta->>'zl_number', v_meta->>'zl_number')), '');
  v_note := NULLIF(trim(COALESCE(v_order_meta->>'manual_note', v_meta->>'manual_note')), '');
  v_client := NULLIF(trim(COALESCE(v_order_meta->>'client_name', v_meta->>'client_name')), '');

  SELECT * INTO v_io
  FROM public.internal_orders
  WHERE organization_id = p_organization_id AND external_number = v_zw
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Same unit/warehouse as the AutoStacja number: ZW/466/26/3142 -> 3142.
    v_wh := NULLIF(split_part(v_zw, '/', 4), '');
    v_wh := COALESCE(v_wh, NULLIF(v_order_meta->>'zl_warehouse_code', ''), NULLIF(v_meta->>'zl_warehouse_code', ''));
    IF v_wh IS NULL THEN
      SELECT code INTO v_wh FROM public.branch_warehouses
      WHERE organization_id = p_organization_id AND branch_id = p_branch_id AND deleted_at IS NULL
      ORDER BY created_at LIMIT 1;
    END IF;
    IF v_wh IS NULL THEN
      RETURN NULL;
    END IF;

    IF v_zl IS NOT NULL THEN
      SELECT id INTO v_ro_id FROM public.repair_orders
      WHERE organization_id = p_organization_id AND branch_id = p_branch_id
        AND zl_number = v_zl AND deleted_at IS NULL;
    END IF;

    v_num := public.internal_order_next_number_internal(p_organization_id, v_wh);
    INSERT INTO public.internal_orders (
      organization_id, branch_id, order_number, order_no, order_year, warehouse_code,
      external_number, external_zl_number, repair_order_id, client_kind, client_name,
      destination_code, source, source_session_id, source_block_id, created_by
    ) VALUES (
      p_organization_id, p_branch_id, v_num->>'order_number', (v_num->>'order_no')::int,
      (v_num->>'order_year')::smallint, v_num->>'warehouse_code',
      v_zw, v_zl, v_ro_id,
      CASE WHEN v_zl IS NOT NULL THEN 'repair_order' WHEN v_note IS NOT NULL THEN 'branch' ELSE 'other' END,
      v_client,
      CASE WHEN v_zl IS NULL THEN v_note END,
      'matcher', v_line.session_id, COALESCE(v_brand_id, v_block.id), p_actor_user_id
    )
    RETURNING * INTO v_io;
  ELSIF v_io.repair_order_id IS NULL AND COALESCE(v_io.external_zl_number, v_zl) IS NOT NULL THEN
    -- The repair order may have been created since the ZW was.
    SELECT id INTO v_ro_id FROM public.repair_orders
    WHERE organization_id = p_organization_id AND branch_id = v_io.branch_id
      AND zl_number = COALESCE(v_io.external_zl_number, v_zl) AND deleted_at IS NULL;
    IF v_ro_id IS NOT NULL THEN
      UPDATE public.internal_orders
      SET repair_order_id = v_ro_id, external_zl_number = COALESCE(external_zl_number, v_zl), updated_at = now()
      WHERE id = v_io.id;
      v_io.repair_order_id := v_ro_id;
    END IF;
  END IF;

  IF v_io.branch_id IS DISTINCT FROM p_branch_id THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_iol_id FROM public.internal_order_lines
  WHERE source_matcher_line_id = p_matcher_line_id;

  IF v_iol_id IS NULL THEN
    SELECT COALESCE(max(line_number), 0) + 1 INTO v_n
    FROM public.internal_order_lines WHERE internal_order_id = v_io.id;
    INSERT INTO public.internal_order_lines (
      internal_order_id, organization_id, branch_id, line_number, product_code, product_name,
      variant_id, quantity, source, source_matcher_line_id, created_by
    ) VALUES (
      v_io.id, p_organization_id, p_branch_id, v_n, v_line.product_code,
      COALESCE(NULLIF(trim(v_line.product_name), ''), v_line.product_code, '-'),
      p_variant_id, p_quantity, 'matcher', p_matcher_line_id, p_actor_user_id
    )
    RETURNING id INTO v_iol_id;
  END IF;

  RETURN jsonb_build_object(
    'internal_order_id', v_io.id,
    'internal_order_line_id', v_iol_id,
    'order_number', v_io.order_number,
    'external_number', v_io.external_number,
    'zl_number', COALESCE(v_io.external_zl_number, v_zl),
    'repair_order_id', v_io.repair_order_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.internal_order_for_matcher_line_internal(uuid, uuid, uuid, uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;

-- 4. Reservation lines keep their ZW line when they move ----------------------

CREATE OR REPLACE FUNCTION public.inventory_reservation_add_line_internal(p_reservation_id uuid, p_variant_id uuid, p_location_id uuid, p_quantity numeric, p_repair_order_line_id uuid, p_source_movement_line_id uuid, p_moved_from_line_id uuid, p_actor_user_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_res public.inventory_reservations%ROWTYPE;
  v_product_id uuid;
  v_balance public.inventory_balances%ROWTYPE;
  v_line_id uuid;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Reservation quantity must be positive' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_res FROM public.inventory_reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT p.id INTO v_product_id
  FROM public.inventory_variants v
  JOIN public.inventory_products p ON p.id = v.product_id AND p.organization_id = v.organization_id
  WHERE v.id = p_variant_id AND v.organization_id = v_res.organization_id AND v.deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation variant not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  v_balance := public.inventory_get_or_create_balance_for_update(
    v_res.organization_id, v_res.branch_id, p_location_id, p_variant_id, NULL, NULL, NULL);

  IF v_balance.available_quantity < p_quantity THEN
    RAISE EXCEPTION 'Insufficient available stock to reserve (available %, requested %)',
      v_balance.available_quantity, p_quantity USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.inventory_reservation_lines (
    organization_id, branch_id, reservation_id, product_id, variant_id, location_id,
    reserved_quantity, repair_order_line_id, source_movement_line_id, moved_from_line_id,
    internal_order_line_id
  ) VALUES (
    v_res.organization_id, v_res.branch_id, v_res.id, v_product_id, p_variant_id, p_location_id,
    p_quantity, p_repair_order_line_id, p_source_movement_line_id, p_moved_from_line_id,
    -- A moved copy stays under the same ZW line -- unless it moved to another repair order.
    (SELECT src.internal_order_line_id FROM public.inventory_reservation_lines src
     WHERE src.id = p_moved_from_line_id
       AND src.repair_order_line_id IS NOT DISTINCT FROM p_repair_order_line_id)
  )
  RETURNING id INTO v_line_id;

  UPDATE public.inventory_balances
  SET reserved_quantity = reserved_quantity + p_quantity
  WHERE id = v_balance.id;

  IF p_moved_from_line_id IS NULL THEN
    PERFORM public.inventory_reservation_log_internal(
      v_line_id, 'created', p_quantity, p_location_id, NULL, NULL, p_source_movement_line_id,
      p_reason, p_actor_user_id);
  END IF;

  RETURN v_line_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_reservation_add_line_internal(uuid, uuid, uuid, numeric, uuid, uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;

-- 5. Posting a PZ reserves under the ZW -----------------------------------------

CREATE OR REPLACE FUNCTION public.inventory_attribute_receipt_to_repair_orders(p_actor_user_id uuid, p_movement_id uuid, p_lines jsonb)
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
  v_rest numeric;
  v_reason text;
  v_rol_id uuid;
  v_io jsonb;
  v_iol_id uuid;
  v_attributed jsonb := '[]'::jsonb;
  v_skipped jsonb := '[]'::jsonb;
  v_res_id uuid;
  v_res_number text;
  v_rl_id uuid;
  -- One reservation document per repair order and one per stand-alone ZW of
  -- this PZ: {id: {id, number}}.
  v_docs jsonb := '{}'::jsonb;
  v_zw_docs jsonb := '{}'::jsonb;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  SELECT h.id, h.organization_id, h.branch_id, h.status, h.document_number, t.category
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
    v_ml := NULL;
    SELECT id, variant_id, quantity, destination_location_id INTO v_ml
    FROM public.inventory_movement_lines
    WHERE id = NULLIF(v_line->>'movement_line_id', '')::uuid
      AND movement_id = p_movement_id AND deleted_at IS NULL;

    IF v_ml.id IS NULL THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'movement_line_id', v_line->>'movement_line_id', 'reason', 'invalid_line'));
      CONTINUE;
    END IF;

    BEGIN
      v_code := public.repair_order_normalize_product_code(v_line->>'product_code');
      v_zl := NULLIF(trim(v_line->>'zl_number'), '');

      -- The ZW of the Matcher line the part came from (when it names one).
      v_io := NULL;
      v_iol_id := NULL;
      IF NULLIF(v_line->>'source_line_id', '') IS NOT NULL THEN
        v_io := public.internal_order_for_matcher_line_internal(
          p_actor_user_id, v_header.organization_id, v_header.branch_id,
          (v_line->>'source_line_id')::uuid, v_ml.variant_id, v_ml.quantity);
        IF v_io IS NOT NULL THEN
          v_iol_id := (v_io->>'internal_order_line_id')::uuid;
          -- The document's own ZL, never the "order number" fallback.
          v_zl := v_io->>'zl_number';
        END IF;
      END IF;

      IF v_iol_id IS NULL AND (v_zl IS NULL OR v_code IS NULL) THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'movement_line_id', v_ml.id, 'reason', 'invalid_line'));
        CONTINUE;
      END IF;

      -- Through the repair order, as before.
      v_apply := 0;
      v_rol_id := NULL;
      v_reason := NULL;
      IF v_zl IS NULL OR v_code IS NULL THEN
        v_reason := 'no_repair_order';
      ELSE
        v_ro := NULL;
        SELECT id, status INTO v_ro
        FROM public.repair_orders
        WHERE organization_id = v_header.organization_id AND branch_id = v_header.branch_id
          AND zl_number = v_zl AND deleted_at IS NULL;

        IF v_ro.id IS NULL THEN
          v_reason := 'no_repair_order';
        ELSIF v_ro.status <> 'open' THEN
          v_reason := 'repair_order_' || v_ro.status;
        ELSE
          v_rol := NULL;
          SELECT id, variant_id INTO v_rol
          FROM public.repair_order_lines
          WHERE repair_order_id = v_ro.id AND deleted_at IS NULL
            AND public.repair_order_normalize_product_code(product_code) = v_code
          ORDER BY created_at
          LIMIT 1
          FOR UPDATE;

          IF v_rol.id IS NULL THEN
            v_reason := 'no_repair_order_line';
          ELSIF v_rol.variant_id IS NOT NULL AND v_rol.variant_id <> v_ml.variant_id THEN
            v_reason := 'variant_mismatch';
          ELSE
            v_outstanding := public.repair_order_line_outstanding_receipt(v_rol.id);
            v_apply := LEAST(v_ml.quantity, GREATEST(v_outstanding, 0));
            IF v_apply <= 0 THEN
              v_apply := 0;
              v_reason := 'already_received';
            END IF;
          END IF;
        END IF;
      END IF;

      IF v_apply > 0 THEN
        IF v_rol.variant_id IS NULL THEN
          UPDATE public.repair_order_lines SET variant_id = v_ml.variant_id, updated_at = now()
          WHERE id = v_rol.id AND variant_id IS NULL;
        END IF;

        PERFORM public.attach_repair_order_line_movement(p_actor_user_id, v_rol.id, v_ml.id, v_apply, 'receipt');

        IF v_docs ? v_ro.id::text THEN
          v_res_id := (v_docs -> v_ro.id::text ->> 'id')::uuid;
          v_res_number := v_docs -> v_ro.id::text ->> 'number';
        ELSE
          v_res_number := public.inventory_next_commitment_number_internal(
            v_header.organization_id, 'reservation', p_actor_user_id);
          INSERT INTO public.inventory_reservations (
            organization_id, branch_id, reservation_number, reference_type, reference_id,
            reference_number, notes, created_by
          ) VALUES (
            v_header.organization_id, v_header.branch_id, v_res_number, 'repair_order', v_ro.id,
            v_zl, 'Przyjęcie ' || COALESCE(v_header.document_number, ''), p_actor_user_id
          )
          RETURNING id INTO v_res_id;
          v_docs := v_docs || jsonb_build_object(v_ro.id::text, jsonb_build_object('id', v_res_id, 'number', v_res_number));
        END IF;

        v_rl_id := public.inventory_reservation_add_line_internal(
          v_res_id, v_ml.variant_id, v_ml.destination_location_id, v_apply,
          v_rol.id, v_ml.id, NULL, p_actor_user_id,
          'Przyjęcie ' || COALESCE(v_header.document_number, ''));
        v_rol_id := v_rol.id;

        IF v_iol_id IS NOT NULL THEN
          UPDATE public.inventory_reservation_lines SET internal_order_line_id = v_iol_id WHERE id = v_rl_id;
          UPDATE public.internal_order_lines SET repair_order_line_id = v_rol.id
          WHERE id = v_iol_id AND repair_order_line_id IS NULL;
          INSERT INTO public.internal_order_line_movement_links (
            internal_order_line_id, inventory_movement_line_id, applied_quantity, relation_type, repair_order_line_id
          ) VALUES (v_iol_id, v_ml.id, v_apply, 'receipt', v_rol.id);
        END IF;

        v_attributed := v_attributed || jsonb_build_array(jsonb_build_object(
          'movement_line_id', v_ml.id, 'repair_order_id', v_ro.id, 'repair_order_line_id', v_rol.id,
          'zl_number', v_zl, 'quantity', v_apply,
          'free_quantity', CASE WHEN v_iol_id IS NULL THEN v_ml.quantity - v_apply ELSE 0 END,
          'reservation_id', v_res_id, 'reservation_number', v_res_number,
          'internal_order_id', v_io->>'internal_order_id',
          'internal_order_number', v_io->>'order_number'));
      END IF;

      -- What the repair order does not take stays under the ZW alone.
      v_rest := v_ml.quantity - v_apply;
      IF v_iol_id IS NOT NULL AND v_rest > 0 THEN
        IF v_zw_docs ? (v_io->>'internal_order_id') THEN
          v_res_id := (v_zw_docs -> (v_io->>'internal_order_id') ->> 'id')::uuid;
          v_res_number := v_zw_docs -> (v_io->>'internal_order_id') ->> 'number';
        ELSE
          v_res_number := public.inventory_next_commitment_number_internal(
            v_header.organization_id, 'reservation', p_actor_user_id);
          INSERT INTO public.inventory_reservations (
            organization_id, branch_id, reservation_number, reference_type, reference_id,
            reference_number, notes, created_by
          ) VALUES (
            v_header.organization_id, v_header.branch_id, v_res_number, 'internal_order',
            (v_io->>'internal_order_id')::uuid, v_io->>'order_number',
            'Przyjęcie ' || COALESCE(v_header.document_number, ''), p_actor_user_id
          )
          RETURNING id INTO v_res_id;
          v_zw_docs := v_zw_docs || jsonb_build_object(v_io->>'internal_order_id',
            jsonb_build_object('id', v_res_id, 'number', v_res_number));
        END IF;

        v_rl_id := public.inventory_reservation_add_line_internal(
          v_res_id, v_ml.variant_id, v_ml.destination_location_id, v_rest,
          NULL, v_ml.id, NULL, p_actor_user_id,
          'Przyjęcie ' || COALESCE(v_header.document_number, ''));
        UPDATE public.inventory_reservation_lines SET internal_order_line_id = v_iol_id WHERE id = v_rl_id;
        INSERT INTO public.internal_order_line_movement_links (
          internal_order_line_id, inventory_movement_line_id, applied_quantity, relation_type
        ) VALUES (v_iol_id, v_ml.id, v_rest, 'receipt');

        v_attributed := v_attributed || jsonb_build_array(jsonb_build_object(
          'movement_line_id', v_ml.id, 'repair_order_id', NULL, 'repair_order_line_id', NULL,
          'zl_number', v_zl, 'quantity', v_rest, 'free_quantity', 0,
          'reservation_id', v_res_id, 'reservation_number', v_res_number,
          'internal_order_id', v_io->>'internal_order_id',
          'internal_order_number', v_io->>'order_number',
          'repair_order_reason', v_reason));
      ELSIF v_apply = 0 THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'movement_line_id', v_ml.id, 'zl_number', v_zl, 'reason', v_reason));
      END IF;
    EXCEPTION WHEN unique_violation THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'movement_line_id', v_ml.id, 'zl_number', v_zl, 'reason', 'already_attributed'));
    END;
  END LOOP;

  RETURN jsonb_build_object('movement_id', p_movement_id, 'attributed', v_attributed, 'skipped', v_skipped);
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_attribute_receipt_to_repair_orders(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_attribute_receipt_to_repair_orders(uuid, uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.inventory_create_and_finalize_receipt(p_organization_id uuid, p_branch_id uuid, p_lines jsonb, p_operation_date date DEFAULT NULL::date, p_document_date date DEFAULT NULL::date, p_counterparty_name text DEFAULT NULL::text, p_external_reference text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text, p_actor_user_id uuid DEFAULT NULL::uuid, p_attribution jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_posted jsonb;
  v_movement_id uuid;
  v_ids uuid[];
  v_attr_lines jsonb := '[]'::jsonb;
  v_item jsonb;
  v_index integer;
  v_attribution jsonb;
BEGIN
  v_posted := public.inventory_create_and_finalize(
    p_organization_id, p_branch_id, '101', p_lines,
    p_operation_date, p_document_date, p_counterparty_name, p_external_reference,
    p_note, p_idempotency_key, p_actor_user_id);

  IF p_attribution IS NULL OR jsonb_typeof(p_attribution) <> 'array' OR jsonb_array_length(p_attribution) = 0 THEN
    RETURN v_posted;
  END IF;

  v_movement_id := (v_posted->>'movement_id')::uuid;
  SELECT array_agg(id ORDER BY line_number) INTO v_ids
  FROM public.inventory_movement_lines
  WHERE movement_id = v_movement_id AND deleted_at IS NULL;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_attribution)
  LOOP
    v_index := NULLIF(v_item->>'line_index', '')::integer;
    IF v_index IS NULL OR v_index < 1 OR v_index > COALESCE(array_length(v_ids, 1), 0) THEN
      CONTINUE;
    END IF;
    v_attr_lines := v_attr_lines || jsonb_build_array(jsonb_build_object(
      'movement_line_id', v_ids[v_index],
      'zl_number', v_item->>'zl_number',
      'product_code', v_item->>'product_code',
      'source_line_id', v_item->>'source_line_id'));
  END LOOP;

  v_attribution := public.inventory_attribute_receipt_to_repair_orders(p_actor_user_id, v_movement_id, v_attr_lines);
  RETURN v_posted || jsonb_build_object('attribution', v_attribution);
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_create_and_finalize_receipt(uuid, uuid, jsonb, date, date, text, text, text, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_create_and_finalize_receipt(uuid, uuid, jsonb, date, date, text, text, text, text, uuid, jsonb) TO authenticated;

-- 6. Receiving zone: parts held under a ZW alone ---------------------------------

CREATE OR REPLACE FUNCTION public.inventory_receiving_pending(p_organization_id uuid, p_branch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_receiving uuid;
  v_rows jsonb;
BEGIN
  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.read') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.read permission' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_receiving
  FROM public.warehouse_locations
  WHERE organization_id = p_organization_id AND branch_id = p_branch_id
    AND purpose = 'receiving' AND deleted_at IS NULL AND can_store_inventory = true;

  IF v_receiving IS NULL THEN
    RETURN jsonb_build_object('receiving_location_id', NULL, 'items', '[]'::jsonb);
  END IF;

  WITH stock AS (
    SELECT b.variant_id, b.on_hand_quantity AS on_hand
    FROM public.inventory_balances b
    WHERE b.organization_id = p_organization_id AND b.branch_id = p_branch_id
      AND b.location_id = v_receiving AND b.on_hand_quantity > 0
  ),
  attributed AS (
    SELECT sle.variant_id, rolml.repair_order_line_id,
      SUM(CASE WHEN sle.direction = 'increase' THEN 1 ELSE -1 END
          * sle.quantity * (rolml.applied_quantity / iml.quantity)) AS qty,
      MAX(CASE WHEN rolml.relation_type = 'receipt' THEN imh_orig.document_number END) AS document_number
    FROM public.repair_order_line_movement_links rolml
    JOIN public.inventory_movement_lines iml ON iml.id = rolml.inventory_movement_line_id
    JOIN public.inventory_movement_headers imh_orig ON imh_orig.id = iml.movement_id
    JOIN LATERAL (
      SELECT iml.id AS ml_id
      UNION ALL
      SELECT rev_line.id
      FROM public.inventory_movement_lines rev_line
      WHERE imh_orig.reversal_movement_id IS NOT NULL
        AND rev_line.movement_id = imh_orig.reversal_movement_id
        AND rev_line.line_number = iml.line_number
    ) candidate ON true
    JOIN public.inventory_stock_ledger_entries sle
      ON sle.movement_line_id = candidate.ml_id AND sle.balance_field = 'on_hand'
    WHERE iml.organization_id = p_organization_id AND iml.branch_id = p_branch_id
      AND sle.location_id = v_receiving
    GROUP BY sle.variant_id, rolml.repair_order_line_id
    HAVING SUM(CASE WHEN sle.direction = 'increase' THEN 1 ELSE -1 END
               * sle.quantity * (rolml.applied_quantity / iml.quantity)) > 0
  ),
  -- Parts reserved under a ZW alone (no repair order) still in the zone.
  zw AS (
    SELECT rl.variant_id, rl.internal_order_line_id,
      SUM(rl.reserved_quantity - rl.released_quantity - rl.fulfilled_quantity) AS qty,
      MAX(h.document_number) AS document_number
    FROM public.inventory_reservation_lines rl
    JOIN public.inventory_reservations r ON r.id = rl.reservation_id
    LEFT JOIN public.inventory_movement_lines iml ON iml.id = rl.source_movement_line_id
    LEFT JOIN public.inventory_movement_headers h ON h.id = iml.movement_id
    WHERE rl.organization_id = p_organization_id AND rl.branch_id = p_branch_id
      AND rl.location_id = v_receiving
      AND rl.internal_order_line_id IS NOT NULL AND rl.repair_order_line_id IS NULL
      AND r.status <> 'cancelled' AND r.deleted_at IS NULL
    GROUP BY rl.variant_id, rl.internal_order_line_id
    HAVING SUM(rl.reserved_quantity - rl.released_quantity - rl.fulfilled_quantity) > 0
  ),
  free AS (
    SELECT s.variant_id,
      s.on_hand
      - COALESCE((SELECT SUM(a.qty) FROM attributed a WHERE a.variant_id = s.variant_id), 0)
      - COALESCE((SELECT SUM(z.qty) FROM zw z WHERE z.variant_id = s.variant_id), 0) AS qty
    FROM stock s
  ),
  last_pz AS (
    SELECT DISTINCT ON (iml.variant_id) iml.variant_id, h.document_number
    FROM public.inventory_movement_lines iml
    JOIN public.inventory_movement_headers h ON h.id = iml.movement_id
    WHERE h.organization_id = p_organization_id AND h.branch_id = p_branch_id
      AND h.status = 'posted' AND h.movement_type_code = '101'
      AND iml.destination_location_id = v_receiving AND iml.deleted_at IS NULL
    ORDER BY iml.variant_id, h.posted_at DESC
  ),
  items AS (
    SELECT a.variant_id, a.repair_order_line_id, NULL::uuid AS internal_order_line_id,
      LEAST(a.qty, s.on_hand) AS qty, a.document_number
    FROM attributed a JOIN stock s ON s.variant_id = a.variant_id
    UNION ALL
    SELECT z.variant_id, NULL::uuid, z.internal_order_line_id, LEAST(z.qty, s.on_hand), z.document_number
    FROM zw z JOIN stock s ON s.variant_id = z.variant_id
    UNION ALL
    SELECT f.variant_id, NULL::uuid, NULL::uuid, f.qty, lp.document_number
    FROM free f LEFT JOIN last_pz lp ON lp.variant_id = f.variant_id
    WHERE f.qty > 0
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'variant_id', i.variant_id,
      'product_id', p.id,
      'sku', v.sku,
      'product_name', p.name,
      'unit_id', p.base_unit_id,
      'unit_code', u.code,
      'quantity', i.qty,
      'document_number', i.document_number,
      'repair_order_line_id', i.repair_order_line_id,
      'repair_order_id', ro.id,
      'zl_number', ro.zl_number,
      'vehicle_brand', ro.vehicle_brand,
      'internal_order_line_id', i.internal_order_line_id,
      'internal_order_id', io.id,
      'internal_order_number', io.order_number,
      'internal_order_external_number', io.external_number,
      'internal_order_client', io.client_name,
      'internal_order_destination', io.destination_code,
      'handling_mode', COALESCE(st.handling_mode, 'standard'),
      'default_location_id', st.default_location_id,
      'default_location_code', dl.code,
      'default_location_name', dl.name,
      'container_id', c.id,
      'container_code', c.code,
      'container_location_id', c.current_location_id,
      'container_location_code', cl.code,
      'container_location_name', cl.name
    ) ORDER BY ro.zl_number NULLS LAST, io.order_number NULLS LAST, v.sku), '[]'::jsonb)
  INTO v_rows
  FROM items i
  JOIN public.inventory_variants v ON v.id = i.variant_id
  JOIN public.inventory_products p ON p.id = v.product_id
  LEFT JOIN public.inventory_units u ON u.id = p.base_unit_id
  LEFT JOIN public.repair_order_lines rol ON rol.id = i.repair_order_line_id
  LEFT JOIN public.repair_orders ro ON ro.id = rol.repair_order_id
  LEFT JOIN public.internal_order_lines iol ON iol.id = i.internal_order_line_id
  LEFT JOIN public.internal_orders io ON io.id = iol.internal_order_id
  LEFT JOIN public.inventory_product_branch_settings st
    ON st.product_id = p.id AND st.branch_id = p_branch_id
  LEFT JOIN public.warehouse_locations dl ON dl.id = st.default_location_id
  LEFT JOIN LATERAL (
    SELECT ic.id, ic.code, ic.current_location_id
    FROM public.inventory_containers ic
    WHERE ro.id IS NOT NULL
      AND ic.organization_id = p_organization_id AND ic.branch_id = p_branch_id
      AND ic.reference_type = 'repair_order' AND ic.reference_id = ro.id::text
      AND ic.deleted_at IS NULL AND ic.status IN ('active', 'empty')
    ORDER BY (ic.status = 'active') DESC, ic.created_at
    LIMIT 1
  ) c ON true
  LEFT JOIN public.warehouse_locations cl ON cl.id = c.current_location_id;

  RETURN jsonb_build_object('receiving_location_id', v_receiving, 'items', v_rows);
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_receiving_pending(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_receiving_pending(uuid, uuid) TO authenticated;

-- 7. R / W per ZW line ----------------------------------------------------------
-- R: still committed (reserved, or allocated into a container and not issued).
-- W: gone out for it (issued on RW, or shipped). Received: the receipt rows.

CREATE OR REPLACE VIEW public.internal_order_line_status
WITH (security_invoker = true) AS
SELECT
  iol.id AS internal_order_line_id,
  iol.internal_order_id,
  COALESCE((SELECT SUM(k.applied_quantity) FROM public.internal_order_line_movement_links k
            WHERE k.internal_order_line_id = iol.id AND k.relation_type = 'receipt'), 0) AS received_quantity,
  COALESCE(SUM(rl.reserved_quantity - rl.released_quantity - rl.fulfilled_quantity), 0)
    + COALESCE(SUM(al.allocated - al.fulfilled), 0) AS reserved_quantity,
  COALESCE(SUM(rl.fulfilled_quantity), 0) - COALESCE(SUM(al.allocated), 0)
    + COALESCE(SUM(al.fulfilled), 0) AS issued_quantity
FROM public.internal_order_lines iol
LEFT JOIN (
  public.inventory_reservation_lines rl
  JOIN public.inventory_reservations r
    ON r.id = rl.reservation_id AND r.status <> 'cancelled' AND r.deleted_at IS NULL
) ON rl.internal_order_line_id = iol.id
LEFT JOIN LATERAL (
  SELECT SUM(a.allocated_quantity) AS allocated, SUM(a.fulfilled_quantity) AS fulfilled
  FROM public.inventory_allocation_lines a
  WHERE a.reservation_line_id = rl.id
) al ON true
GROUP BY iol.id, iol.internal_order_id;

REVOKE ALL ON public.internal_order_line_status FROM anon;
GRANT SELECT ON public.internal_order_line_status TO authenticated;

-- 8. Putaway: parts held under a ZW are not free stock ------------------------------
CREATE OR REPLACE FUNCTION public.inventory_putaway_internal(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_location_id uuid,
  p_container_id uuid,
  p_lines jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_receiving uuid;
  v_line jsonb;
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_i integer := 0;
  v_variant uuid;
  v_qty numeric;
  v_rol_id uuid;
  v_product record;
  v_handling text;
  v_rol record;
  v_container_ro uuid;
  v_free jsonb := '{}'::jsonb;
  v_pending jsonb;
  v_key text;
  v_req numeric;
  v_on_hand numeric;
  v_attributed numeric;
  v_consumed jsonb := '{}'::jsonb;
  v_physical numeric;
  v_total_known numeric;
  v_available numeric;
  v_already numeric;
  v_contribution record;
  v_src record;
  v_take numeric;
  v_left numeric;
  v_moved jsonb := '{}'::jsonb;
  v_moved_i jsonb;
  v_engine jsonb := '[]'::jsonb;
  v_mm jsonb;
  v_movement_id uuid;
  v_doc text;
  v_ml_ids uuid[];
  v_ml uuid;
  v_mv record;
  v_new_line uuid;
  v_reserved numeric;
  v_need numeric;
  v_rest numeric;
  v_res_docs jsonb := '{}'::jsonb;
  v_res_id uuid;
  v_res_number text;
  v_dest jsonb := '[]'::jsonb;
  v_results jsonb := '[]'::jsonb;
  v_ro_id uuid;
  v_ro_zl text;
  v_cid uuid;
  v_ccode text;
  v_container_created boolean;
  v_containers jsonb := '{}'::jsonb;
  v_code text;
  v_n integer;
  v_alloc_lines jsonb;
  v_single_res uuid;
  v_alloc jsonb;
  v_al record;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;
  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one line is required' USING ERRCODE = '22023';
  END IF;

  v_receiving := public.resolve_branch_receiving_location(p_organization_id, p_branch_id);

  IF p_location_id IS NULL OR p_location_id = v_receiving OR NOT EXISTS (
    SELECT 1 FROM public.warehouse_locations
    WHERE id = p_location_id AND organization_id = p_organization_id
      AND branch_id = p_branch_id AND can_store_inventory = true AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Destination is not a valid stockable location in this branch' USING ERRCODE = '22023';
  END IF;

  IF p_container_id IS NOT NULL THEN
    SELECT reference_id::uuid INTO v_container_ro
    FROM public.inventory_containers
    WHERE id = p_container_id AND organization_id = p_organization_id AND branch_id = p_branch_id
      AND reference_type = 'repair_order' AND current_location_id = p_location_id
      AND status IN ('active', 'empty') AND deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Container does not belong to this repair order at this location' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Parse and check every line before anything moves.
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_i := v_i + 1;
    v_variant := NULLIF(v_line->>'variant_id', '')::uuid;
    v_qty := (v_line->>'quantity')::numeric;
    v_rol_id := NULLIF(v_line->>'repair_order_line_id', '')::uuid;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Quantity must be positive' USING ERRCODE = '22023';
    END IF;

    SELECT p.id, p.base_unit_id INTO v_product
    FROM public.inventory_variants v
    JOIN public.inventory_products p ON p.id = v.product_id AND p.organization_id = v.organization_id
    WHERE v.id = v_variant AND v.organization_id = p_organization_id AND v.deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found' USING ERRCODE = 'P0002';
    END IF;

    SELECT COALESCE(handling_mode, 'standard') INTO v_handling
    FROM public.inventory_product_branch_settings
    WHERE product_id = v_product.id AND branch_id = p_branch_id;
    v_handling := COALESCE(v_handling, 'standard');

    IF v_rol_id IS NULL THEN
      IF p_container_id IS NOT NULL THEN
        RAISE EXCEPTION 'Only repair-order parts go into a repair-order container' USING ERRCODE = '22023';
      END IF;
      v_free := v_free || jsonb_build_object(
        v_variant::text, COALESCE((v_free->>v_variant::text)::numeric, 0) + v_qty);
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'idx', v_i, 'variant_id', v_variant, 'unit_id', v_product.base_unit_id,
        'quantity', v_qty, 'handling', v_handling));
    ELSE
      SELECT rol.id, rol.variant_id, rol.ordered_quantity, ro.id AS repair_order_id, ro.zl_number
      INTO v_rol
      FROM public.repair_order_lines rol
      JOIN public.repair_orders ro ON ro.id = rol.repair_order_id
      WHERE rol.id = v_rol_id AND rol.deleted_at IS NULL AND ro.deleted_at IS NULL
        AND ro.organization_id = p_organization_id AND ro.branch_id = p_branch_id
      FOR UPDATE OF rol;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'RepairOrderLine not found' USING ERRCODE = 'P0002';
      END IF;
      IF v_rol.variant_id IS NOT NULL AND v_rol.variant_id <> v_variant THEN
        RAISE EXCEPTION 'Item does not match the RepairOrderLine''s product' USING ERRCODE = '22023';
      END IF;
      IF p_container_id IS NOT NULL AND v_rol.repair_order_id IS DISTINCT FROM v_container_ro THEN
        RAISE EXCEPTION 'A part of another repair order cannot go into this container' USING ERRCODE = '22023';
      END IF;
      IF v_rol.variant_id IS NULL THEN
        UPDATE public.repair_order_lines SET variant_id = v_variant, updated_at = now() WHERE id = v_rol.id;
      END IF;
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'idx', v_i, 'variant_id', v_variant, 'unit_id', v_product.base_unit_id,
        'quantity', v_qty, 'handling', v_handling,
        'repair_order_line_id', v_rol.id, 'repair_order_id', v_rol.repair_order_id,
        'zl_number', v_rol.zl_number, 'ordered_quantity', v_rol.ordered_quantity));
    END IF;
  END LOOP;

  -- Free stock: what lies in the receiving zone minus what belongs to orders.
  IF v_free <> '{}'::jsonb THEN
    v_pending := public.inventory_receiving_pending(p_organization_id, p_branch_id);
    FOR v_key, v_req IN SELECT key, value::numeric FROM jsonb_each_text(v_free)
    LOOP
      PERFORM 1 FROM public.inventory_balances
      WHERE organization_id = p_organization_id AND branch_id = p_branch_id
        AND location_id = v_receiving AND variant_id = v_key::uuid
      FOR UPDATE;

      SELECT COALESCE(SUM((it->>'quantity')::numeric), 0) INTO v_attributed
      FROM jsonb_array_elements(v_pending->'items') it
      WHERE (it->>'variant_id')::uuid = v_key::uuid
        AND (it->>'repair_order_line_id' IS NOT NULL OR it->>'internal_order_line_id' IS NOT NULL);

      v_on_hand := NULL;
      SELECT on_hand_quantity INTO v_on_hand
      FROM public.inventory_balances
      WHERE organization_id = p_organization_id AND branch_id = p_branch_id
        AND location_id = v_receiving AND variant_id = v_key::uuid;

      IF COALESCE(v_on_hand, 0) - v_attributed < v_req THEN
        RAISE EXCEPTION 'Not enough free stock of this item in the receiving zone' USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END IF;

  -- Repair-order parts: what the receipt links say is in the receiving zone
  -- for each line (same check as putaway_repair_order_stock, A8).
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) WHERE value ? 'repair_order_line_id'
  LOOP
    v_i := (v_item->>'idx')::integer;
    v_rol_id := (v_item->>'repair_order_line_id')::uuid;
    v_variant := (v_item->>'variant_id')::uuid;
    v_qty := (v_item->>'quantity')::numeric;

    PERFORM on_hand_quantity FROM public.inventory_balances
    WHERE organization_id = p_organization_id AND branch_id = p_branch_id
      AND location_id = v_receiving AND variant_id = v_variant
    FOR UPDATE;

    v_physical := NULL;
    SELECT on_hand_quantity INTO v_physical
    FROM public.inventory_balances
    WHERE organization_id = p_organization_id AND branch_id = p_branch_id
      AND location_id = v_receiving AND variant_id = v_variant;
    v_physical := COALESCE(v_physical, 0);

    v_total_known := 0;
    v_available := 0;
    FOR v_contribution IN
      SELECT rol.id AS repair_order_line_id,
        SUM(
          CASE WHEN sle.direction = 'increase' THEN 1 ELSE -1 END
          * sle.quantity * (rolml.applied_quantity / iml.quantity)
        ) AS net_qty
      FROM public.repair_order_line_movement_links rolml
      JOIN public.repair_order_lines rol ON rol.id = rolml.repair_order_line_id
      JOIN public.inventory_movement_lines iml ON iml.id = rolml.inventory_movement_line_id
      JOIN public.inventory_movement_headers imh_orig ON imh_orig.id = iml.movement_id
      JOIN LATERAL (
        SELECT iml.id AS ml_id
        UNION ALL
        SELECT rev_line.id
        FROM public.inventory_movement_lines rev_line
        WHERE imh_orig.reversal_movement_id IS NOT NULL
          AND rev_line.movement_id = imh_orig.reversal_movement_id
          AND rev_line.line_number = iml.line_number
      ) candidate ON true
      JOIN public.inventory_stock_ledger_entries sle
        ON sle.movement_line_id = candidate.ml_id AND sle.balance_field = 'on_hand'
      WHERE iml.organization_id = p_organization_id AND iml.branch_id = p_branch_id
        AND sle.location_id = v_receiving AND sle.variant_id = v_variant
      GROUP BY rol.id
      HAVING SUM(
        CASE WHEN sle.direction = 'increase' THEN 1 ELSE -1 END
        * sle.quantity * (rolml.applied_quantity / iml.quantity)
      ) <> 0
    LOOP
      IF v_contribution.net_qty < 0 THEN
        RAISE EXCEPTION 'Line %: attribution history at the receiving location is inconsistent -- putaway is not permitted until it is reconciled', v_i
          USING ERRCODE = 'P0008';
      END IF;
      v_total_known := v_total_known + v_contribution.net_qty;
      IF v_contribution.repair_order_line_id = v_rol_id THEN
        v_available := v_contribution.net_qty;
      END IF;
    END LOOP;

    IF v_total_known > v_physical THEN
      RAISE EXCEPTION 'Line %: attribution history at the receiving location is inconsistent -- putaway is not permitted until it is reconciled', v_i
        USING ERRCODE = 'P0008';
    END IF;

    v_already := COALESCE((v_consumed->>(v_rol_id::text))::numeric, 0);
    v_available := v_available - v_already;
    IF v_available < v_qty THEN
      RAISE EXCEPTION 'Line % requests % but only % is currently attributed to this RepairOrderLine at the receiving location', v_i, v_qty, v_available
        USING ERRCODE = '22023';
    END IF;
    v_consumed := jsonb_set(v_consumed, ARRAY[v_rol_id::text], to_jsonb(v_already + v_qty));

    -- Its reservation leaves the receiving zone with it (re-added at the
    -- destination once the MM is posted).
    v_left := v_qty;
    v_moved_i := '[]'::jsonb;
    FOR v_src IN
      SELECT rl.id, rl.reservation_id,
             rl.reserved_quantity - rl.released_quantity - rl.fulfilled_quantity AS remaining
      FROM public.inventory_reservation_lines rl
      JOIN public.inventory_reservations r ON r.id = rl.reservation_id
      WHERE rl.organization_id = p_organization_id AND rl.branch_id = p_branch_id
        AND rl.location_id = v_receiving AND rl.variant_id = v_variant
        AND COALESCE(rl.repair_order_line_id,
                     CASE WHEN r.reference_type = 'repair_order_line' THEN r.reference_id END) = v_rol_id
        AND r.status <> 'cancelled' AND r.deleted_at IS NULL
        AND rl.reserved_quantity - rl.released_quantity - rl.fulfilled_quantity > 0
      ORDER BY rl.created_at
      FOR UPDATE OF rl
    LOOP
      EXIT WHEN v_left <= 0;
      v_take := LEAST(v_left, v_src.remaining);
      PERFORM public.inventory_reservation_release_internal(v_src.id, v_take, 'moved', NULL, p_actor_user_id);
      v_moved_i := v_moved_i || jsonb_build_array(jsonb_build_object(
        'line_id', v_src.id, 'reservation_id', v_src.reservation_id, 'quantity', v_take));
      v_left := v_left - v_take;
    END LOOP;
    v_moved := v_moved || jsonb_build_object(v_i::text, v_moved_i);
  END LOOP;

  -- ONE MM for every part of the selection.
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items)
  LOOP
    v_engine := v_engine || jsonb_build_array(jsonb_build_object(
      'variant_id', v_item->>'variant_id', 'unit_id', v_item->>'unit_id',
      'quantity', (v_item->>'quantity')::numeric,
      'source_location_id', v_receiving, 'destination_location_id', p_location_id, 'note', NULL));
  END LOOP;

  v_mm := public.inventory_create_and_finalize(
    p_organization_id, p_branch_id, '801', v_engine,
    NULL, NULL, NULL, NULL, NULL, NULL, p_actor_user_id);
  v_movement_id := (v_mm->>'movement_id')::uuid;
  v_doc := v_mm->>'document_number';

  SELECT array_agg(id ORDER BY line_number) INTO v_ml_ids
  FROM public.inventory_movement_lines WHERE movement_id = v_movement_id;

  -- Per part: relocation link, reservation at the destination.
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items)
  LOOP
    v_i := (v_item->>'idx')::integer;
    v_ml := v_ml_ids[v_i];
    v_variant := (v_item->>'variant_id')::uuid;
    v_qty := (v_item->>'quantity')::numeric;

    IF NOT v_item ? 'repair_order_line_id' THEN
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'mode', 'free', 'movement_id', v_movement_id, 'document_number', v_doc,
        'destination_location_id', p_location_id, 'quantity', v_qty, 'variant_id', v_variant));
      CONTINUE;
    END IF;

    v_rol_id := (v_item->>'repair_order_line_id')::uuid;
    v_ro_id := (v_item->>'repair_order_id')::uuid;
    v_ro_zl := v_item->>'zl_number';

    BEGIN
      PERFORM public.write_repair_order_line_movement_link_internal(v_rol_id, v_ml, v_qty, 'relocation');
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;

    v_reserved := 0;
    FOR v_mv IN
      SELECT * FROM jsonb_to_recordset(COALESCE(v_moved->(v_i::text), '[]'::jsonb))
        AS x(line_id uuid, reservation_id uuid, quantity numeric)
    LOOP
      v_new_line := public.inventory_reservation_add_line_internal(
        v_mv.reservation_id, v_variant, p_location_id, v_mv.quantity,
        v_rol_id, v_ml, v_mv.line_id, p_actor_user_id);
      PERFORM public.inventory_reservation_log_internal(
        v_new_line, 'moved', v_mv.quantity, v_receiving, p_location_id,
        v_movement_id, v_ml, 'Rozlokowanie ' || COALESCE(v_doc, ''), p_actor_user_id);
      v_dest := v_dest || jsonb_build_array(jsonb_build_object(
        'repair_order_id', v_ro_id, 'zl_number', v_ro_zl, 'handling', v_item->>'handling',
        'variant_id', v_variant, 'line_id', v_new_line,
        'reservation_id', v_mv.reservation_id, 'quantity', v_mv.quantity));
      v_reserved := v_reserved + v_mv.quantity;
    END LOOP;

    -- Not reserved yet (e.g. received before reservations existed): reserve
    -- what the order still needs, on one REZ per order for this batch.
    v_rest := v_qty - v_reserved;
    IF v_rest > 0 THEN
      SELECT (v_item->>'ordered_quantity')::numeric
             - COALESCE(SUM(rl.reserved_quantity - rl.released_quantity), 0)
      INTO v_need
      FROM public.inventory_reservation_lines rl
      JOIN public.inventory_reservations r ON r.id = rl.reservation_id
      WHERE COALESCE(rl.repair_order_line_id,
                     CASE WHEN r.reference_type = 'repair_order_line' THEN r.reference_id END) = v_rol_id
        AND r.status <> 'cancelled' AND r.deleted_at IS NULL;
      v_rest := LEAST(v_rest, GREATEST(COALESCE(v_need, (v_item->>'ordered_quantity')::numeric), 0));

      IF v_rest > 0 THEN
        IF v_res_docs ? v_ro_id::text THEN
          v_res_id := (v_res_docs->>(v_ro_id::text))::uuid;
        ELSE
          v_res_number := public.inventory_next_commitment_number_internal(
            p_organization_id, 'reservation', p_actor_user_id);
          INSERT INTO public.inventory_reservations (
            organization_id, branch_id, reservation_number, reference_type, reference_id,
            reference_number, notes, created_by
          ) VALUES (
            p_organization_id, p_branch_id, v_res_number, 'repair_order', v_ro_id,
            v_ro_zl, 'Rozlokowanie ' || COALESCE(v_doc, ''), p_actor_user_id
          )
          RETURNING id INTO v_res_id;
          v_res_docs := v_res_docs || jsonb_build_object(v_ro_id::text, v_res_id);
        END IF;

        v_new_line := public.inventory_reservation_add_line_internal(
          v_res_id, v_variant, p_location_id, v_rest, v_rol_id, v_ml, NULL, p_actor_user_id,
          'Rozlokowanie ' || COALESCE(v_doc, ''));
        v_dest := v_dest || jsonb_build_array(jsonb_build_object(
          'repair_order_id', v_ro_id, 'zl_number', v_ro_zl, 'handling', v_item->>'handling',
          'variant_id', v_variant, 'line_id', v_new_line,
          'reservation_id', v_res_id, 'quantity', v_rest));
        v_reserved := v_reserved + v_rest;
      END IF;
    END IF;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'mode', CASE WHEN v_item->>'handling' = 'bulk' THEN 'bulk' ELSE 'container' END,
      'movement_id', v_movement_id, 'document_number', v_doc,
      'destination_location_id', p_location_id, 'quantity', v_qty,
      'reserved_quantity', v_reserved, 'variant_id', v_variant,
      'repair_order_line_id', v_rol_id, 'repair_order_id', v_ro_id, 'zl_number', v_ro_zl));
  END LOOP;

  -- Per repair order: its container at the destination and ONE KON with
  -- every part that goes into it (bulk items stay loose and reserved).
  FOR v_ro_id IN
    SELECT DISTINCT (d->>'repair_order_id')::uuid
    FROM jsonb_array_elements(v_dest) d
    WHERE d->>'handling' <> 'bulk'
  LOOP
    SELECT d->>'zl_number' INTO v_ro_zl
    FROM jsonb_array_elements(v_dest) d
    WHERE (d->>'repair_order_id')::uuid = v_ro_id LIMIT 1;

    v_cid := NULL;
    v_ccode := NULL;
    v_container_created := false;
    IF p_container_id IS NOT NULL THEN
      SELECT id, code INTO v_cid, v_ccode FROM public.inventory_containers WHERE id = p_container_id;
    ELSE
      SELECT id, code INTO v_cid, v_ccode FROM public.inventory_containers
      WHERE organization_id = p_organization_id AND branch_id = p_branch_id
        AND reference_type = 'repair_order' AND reference_id = v_ro_id::text
        AND current_location_id = p_location_id
        AND status IN ('active', 'empty') AND deleted_at IS NULL
      ORDER BY (status = 'active') DESC, created_at
      LIMIT 1;
    END IF;

    IF v_cid IS NULL THEN
      SELECT count(*) + 1 INTO v_n FROM public.inventory_containers
      WHERE organization_id = p_organization_id AND reference_type = 'repair_order'
        AND reference_id = v_ro_id::text AND deleted_at IS NULL;
      LOOP
        v_code := 'K-' || COALESCE(v_ro_zl, 'ZL') || '-' || lpad(v_n::text, 2, '0');
        EXIT WHEN NOT EXISTS (
          SELECT 1 FROM public.inventory_containers
          WHERE organization_id = p_organization_id AND branch_id = p_branch_id
            AND lower(code) = lower(v_code) AND deleted_at IS NULL);
        v_n := v_n + 1;
      END LOOP;
      SELECT (c->>'container_id')::uuid, v_code INTO v_cid, v_ccode
      FROM (SELECT public.inventory_create_container(
        p_actor_user_id, p_organization_id, p_branch_id, v_code, p_location_id,
        'container', 'repair_order', v_ro_id::text) AS c) x;
      v_container_created := true;
    END IF;

    SELECT jsonb_agg(jsonb_build_object(
             'variant_id', d->>'variant_id', 'location_id', p_location_id,
             'quantity', (d->>'quantity')::numeric, 'reservation_line_id', d->>'line_id')),
           CASE WHEN count(DISTINCT d->>'reservation_id') = 1
                THEN (min(d->>'reservation_id'))::uuid END
    INTO v_alloc_lines, v_single_res
    FROM jsonb_array_elements(v_dest) d
    WHERE (d->>'repair_order_id')::uuid = v_ro_id AND d->>'handling' <> 'bulk';

    v_alloc := public.inventory_create_allocation(
      p_organization_id, p_branch_id, v_alloc_lines, v_single_res,
      'repair_order', v_ro_id, v_ro_zl, p_actor_user_id);

    FOR v_al IN
      SELECT id, allocated_quantity FROM public.inventory_allocation_lines
      WHERE allocation_id = (v_alloc->>'allocation_id')::uuid
    LOOP
      PERFORM public.repair_order_add_allocation_to_container(
        p_actor_user_id, p_organization_id, p_branch_id, v_cid, v_al.id, v_al.allocated_quantity);
    END LOOP;

    v_containers := v_containers || jsonb_build_object(v_ro_id::text, jsonb_build_object(
      'id', v_cid, 'code', v_ccode, 'created', v_container_created,
      'allocation_number', v_alloc->>'allocation_number'));
  END LOOP;

  SELECT COALESCE(jsonb_agg(
           CASE
             WHEN r->>'mode' = 'free' THEN r
             ELSE r || jsonb_build_object(
               'container_id', v_containers->(r->>'repair_order_id')->'id',
               'container_code', v_containers->(r->>'repair_order_id')->'code',
               'container_created',
                 COALESCE((v_containers->(r->>'repair_order_id')->>'created')::boolean, false)
                 AND r->>'mode' = 'container',
               'allocation_number', v_containers->(r->>'repair_order_id')->'allocation_number')
           END
           ORDER BY ord), '[]'::jsonb)
  INTO v_results
  FROM jsonb_array_elements(v_results) WITH ORDINALITY AS t(r, ord);

  -- Bulk items never get a container.
  SELECT jsonb_agg(
           CASE WHEN r->>'mode' = 'bulk'
                THEN r || jsonb_build_object('container_id', NULL, 'container_code', NULL, 'container_created', false)
                ELSE r END
           ORDER BY ord)
  INTO v_results
  FROM jsonb_array_elements(v_results) WITH ORDINALITY AS t(r, ord);

  RETURN jsonb_build_object(
    'movement_id', v_movement_id,
    'document_number', v_doc,
    'location_id', p_location_id,
    'containers', v_containers,
    'line_count', jsonb_array_length(v_results),
    'lines', v_results);
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_putaway_internal(uuid, uuid, uuid, uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
