-- ============================================================================
-- Internal orders (ZW), stage E4: between branches (docs/INTERNAL_ORDERS_PLAN.md)
-- ============================================================================
-- 1. branches.external_codes: the codes a branch goes by in SVWMS / AutoStacja
--    (note field WYSOG, unit 3642). A ZW for another branch finds its
--    destination branch by them.
-- 2. internal_order_ship: a stand-alone ZW leaves straight from where its
--    parts lie (normally the receiving zone): its reservations are released
--    into ONE branch transfer, sent at once (ONE MM 311). Every shipped
--    quantity is a 'transfer_out' row of its ZW line (W).
-- 3. internal_order_request_from_branch: parts for a ZW reserved at another
--    branch (a prepared transfer there, to be sent by them).
-- 4. internal_order_accept_transfer: accepting such a transfer (MM 312) into
--    the receiving zone reserves what arrived under its ZW lines (through the
--    repair order when the ZW has one).
-- 5. internal_order_stock_elsewhere: what the other branches have of parts.
-- 6. internal_order_line_status counts shipped quantities as W.
-- Additive: no existing row is changed or removed.
-- ============================================================================

ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS external_codes text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.inventory_branch_transfers
  ADD COLUMN IF NOT EXISTS internal_order_id uuid REFERENCES public.internal_orders(id);
ALTER TABLE public.inventory_branch_transfer_lines
  ADD COLUMN IF NOT EXISTS internal_order_line_id uuid REFERENCES public.internal_order_lines(id);
CREATE INDEX IF NOT EXISTS inventory_branch_transfers_internal_order_idx
  ON public.inventory_branch_transfers (internal_order_id) WHERE internal_order_id IS NOT NULL;

-- 1. Branch codes ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.branch_set_external_codes(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_codes text[]
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_codes text[];
  v_taken text;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;
  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.settings.manage') THEN
    RAISE EXCEPTION 'Missing warehouse.settings.manage permission' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.branches WHERE id = p_branch_id AND organization_id = p_organization_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Branch not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT c ORDER BY c), '{}') INTO v_codes
  FROM (SELECT upper(trim(x)) AS c FROM unnest(COALESCE(p_codes, '{}')) x) s
  WHERE c <> '';

  SELECT c INTO v_taken
  FROM public.branches b, unnest(b.external_codes) c
  WHERE b.organization_id = p_organization_id AND b.id <> p_branch_id AND b.deleted_at IS NULL
    AND c = ANY (v_codes)
  LIMIT 1;
  IF v_taken IS NOT NULL THEN
    RAISE EXCEPTION 'Code % already belongs to another branch', v_taken USING ERRCODE = '23505';
  END IF;

  UPDATE public.branches SET external_codes = v_codes WHERE id = p_branch_id;
  RETURN jsonb_build_object('branch_id', p_branch_id, 'external_codes', to_jsonb(v_codes));
END;
$function$;

REVOKE ALL ON FUNCTION public.branch_set_external_codes(uuid, uuid, uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.branch_set_external_codes(uuid, uuid, uuid, text[]) TO authenticated;

-- The branch a ZW goes to: its note code (WYSOG) or the unit number its
-- client starts with ("3642 Blacharnia Audi").
CREATE OR REPLACE FUNCTION public.internal_order_destination_branch_internal(p_internal_order_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(io.destination_branch_id, (
    SELECT b.id FROM public.branches b
    WHERE b.organization_id = io.organization_id AND b.deleted_at IS NULL AND b.id <> io.branch_id
      AND (upper(COALESCE(io.destination_code, '')) = ANY (b.external_codes)
           OR substring(COALESCE(io.client_name, '') from '^\s*(\d{3,6})\M') = ANY (b.external_codes))
    ORDER BY (upper(COALESCE(io.destination_code, '')) = ANY (b.external_codes)) DESC
    LIMIT 1))
  FROM public.internal_orders io
  WHERE io.id = p_internal_order_id;
$function$;

REVOKE ALL ON FUNCTION public.internal_order_destination_branch_internal(uuid) FROM PUBLIC, anon, authenticated;

-- 2. Ship a stand-alone ZW ----------------------------------------------------------

CREATE OR REPLACE FUNCTION public.internal_order_ship(
  p_actor_user_id uuid,
  p_internal_order_id uuid,
  p_destination_branch_id uuid DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_io record;
  v_dest uuid;
  v_dest_name text;
  v_rl record;
  v_groups jsonb := '[]'::jsonb;
  v_g jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_t jsonb;
  v_s jsonb;
  v_tl record;
  v_ml_id uuid;
  v_note text;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;
  SELECT id, organization_id, branch_id, order_number, external_number, repair_order_id, status
  INTO v_io FROM public.internal_orders WHERE id = p_internal_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Internal order not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.has_branch_permission(v_io.organization_id, v_io.branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;
  IF v_io.repair_order_id IS NOT NULL THEN
    RAISE EXCEPTION 'A ZW of a repair order is issued to it, not shipped' USING ERRCODE = '55000';
  END IF;
  IF v_io.status <> 'open' THEN
    RAISE EXCEPTION 'Internal order is not open' USING ERRCODE = '55000';
  END IF;

  v_dest := COALESCE(p_destination_branch_id, public.internal_order_destination_branch_internal(v_io.id));
  IF v_dest IS NULL THEN
    RAISE EXCEPTION 'No branch has this ZW''s code: set it in the warehouse settings or pick the branch' USING ERRCODE = '22023';
  END IF;
  SELECT name INTO v_dest_name FROM public.branches
  WHERE id = v_dest AND organization_id = v_io.organization_id AND deleted_at IS NULL;
  IF v_dest_name IS NULL OR v_dest = v_io.branch_id THEN
    RAISE EXCEPTION 'Destination must be another branch of the organization' USING ERRCODE = '22023';
  END IF;

  v_note := 'Wysyłka ' || v_io.order_number || COALESCE(' (' || v_io.external_number || ')', '') || ' na ' || v_dest_name;

  -- What is reserved under the ZW alone, per line and location.
  FOR v_rl IN
    SELECT rl.id, rl.internal_order_line_id, rl.variant_id, rl.location_id, p.base_unit_id,
           rl.reserved_quantity - rl.released_quantity - rl.fulfilled_quantity AS open_qty
    FROM public.inventory_reservation_lines rl
    JOIN public.inventory_reservations r ON r.id = rl.reservation_id
    JOIN public.internal_order_lines iol ON iol.id = rl.internal_order_line_id
    JOIN public.inventory_variants v ON v.id = rl.variant_id
    JOIN public.inventory_products p ON p.id = v.product_id
    WHERE iol.internal_order_id = v_io.id AND iol.cancelled_at IS NULL
      AND rl.repair_order_line_id IS NULL AND rl.branch_id = v_io.branch_id
      AND r.status <> 'cancelled' AND r.deleted_at IS NULL
      AND rl.reserved_quantity - rl.released_quantity - rl.fulfilled_quantity > 0
    ORDER BY iol.line_number, rl.created_at
    FOR UPDATE OF rl
  LOOP
    PERFORM public.inventory_reservation_release_internal(v_rl.id, v_rl.open_qty, 'released', v_note, p_actor_user_id);
    v_groups := v_groups || jsonb_build_array(jsonb_build_object(
      'iol', v_rl.internal_order_line_id, 'variant_id', v_rl.variant_id,
      'source_location_id', v_rl.location_id, 'unit_id', v_rl.base_unit_id, 'quantity', v_rl.open_qty));
  END LOOP;

  IF jsonb_array_length(v_groups) = 0 THEN
    RAISE EXCEPTION 'Nothing of this ZW is here to ship' USING ERRCODE = '55000';
  END IF;

  SELECT jsonb_agg(g - 'iol') INTO v_lines FROM jsonb_array_elements(v_groups) g;
  v_t := public.inventory_create_branch_transfer(
    v_io.organization_id, v_io.branch_id, v_dest, v_lines, v_note, p_actor_user_id);
  UPDATE public.inventory_branch_transfers SET internal_order_id = v_io.id WHERE id = (v_t->>'transfer_id')::uuid;

  -- Each transfer line names its ZW line (equal lines are interchangeable).
  FOR v_g IN SELECT * FROM jsonb_array_elements(v_groups)
  LOOP
    UPDATE public.inventory_branch_transfer_lines
    SET internal_order_line_id = (v_g->>'iol')::uuid
    WHERE id = (
      SELECT id FROM public.inventory_branch_transfer_lines
      WHERE transfer_id = (v_t->>'transfer_id')::uuid AND internal_order_line_id IS NULL
        AND variant_id = (v_g->>'variant_id')::uuid
        AND source_location_id = (v_g->>'source_location_id')::uuid
        AND quantity = (v_g->>'quantity')::numeric
      LIMIT 1);
  END LOOP;

  v_s := public.inventory_send_branch_transfer((v_t->>'transfer_id')::uuid, p_actor_user_id);

  -- W: one 'transfer_out' row per shipped ZW line, on the MM 311 line.
  FOR v_tl IN
    SELECT tl.internal_order_line_id, tl.variant_id, tl.source_location_id, tl.quantity
    FROM public.inventory_branch_transfer_lines tl
    WHERE tl.transfer_id = (v_t->>'transfer_id')::uuid AND tl.internal_order_line_id IS NOT NULL
  LOOP
    SELECT ml.id INTO v_ml_id
    FROM public.inventory_movement_lines ml
    WHERE ml.movement_id = (v_s->>'source_movement_id')::uuid
      AND ml.variant_id = v_tl.variant_id AND ml.source_location_id = v_tl.source_location_id
      AND ml.quantity = v_tl.quantity
      AND NOT EXISTS (
        SELECT 1 FROM public.internal_order_line_movement_links k
        WHERE k.inventory_movement_line_id = ml.id AND k.relation_type = 'transfer_out')
    ORDER BY ml.line_number
    LIMIT 1;
    IF v_ml_id IS NOT NULL THEN
      INSERT INTO public.internal_order_line_movement_links (
        internal_order_line_id, inventory_movement_line_id, applied_quantity, relation_type)
      VALUES (v_tl.internal_order_line_id, v_ml_id, v_tl.quantity, 'transfer_out');
    END IF;
  END LOOP;

  UPDATE public.internal_orders SET destination_branch_id = v_dest, updated_at = now() WHERE id = v_io.id;
  UPDATE public.internal_orders io SET status = 'completed', updated_at = now()
  WHERE io.id = v_io.id AND NOT EXISTS (
    SELECT 1 FROM public.internal_order_lines iol
    JOIN public.internal_order_line_status s ON s.internal_order_line_id = iol.id
    WHERE iol.internal_order_id = io.id AND iol.cancelled_at IS NULL
      AND s.issued_quantity < iol.quantity);

  RETURN jsonb_build_object(
    'transfer_id', v_t->>'transfer_id',
    'transfer_number', v_t->>'transfer_number',
    'movement_id', v_s->>'source_movement_id',
    'document_number', v_s->>'source_document_number',
    'destination_branch_id', v_dest,
    'destination_branch_name', v_dest_name,
    'line_count', jsonb_array_length(v_groups));
END;
$function$;

REVOKE ALL ON FUNCTION public.internal_order_ship(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_order_ship(uuid, uuid, uuid) TO authenticated;

-- 3. Reserve at another branch -------------------------------------------------------

CREATE OR REPLACE FUNCTION public.internal_order_request_from_branch(
  p_actor_user_id uuid,
  p_internal_order_id uuid,
  p_source_branch_id uuid,
  p_lines jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_io record;
  v_line jsonb;
  v_iol record;
  v_groups jsonb := '[]'::jsonb;
  v_g jsonb;
  v_lines jsonb;
  v_t jsonb;
  v_need numeric;
  v_asked jsonb := '{}'::jsonb;
  v_n integer := 0;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;
  SELECT id, organization_id, branch_id, order_number, external_number, status
  INTO v_io FROM public.internal_orders WHERE id = p_internal_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Internal order not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.has_branch_permission(v_io.organization_id, v_io.branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;
  IF v_io.status <> 'open' THEN
    RAISE EXCEPTION 'Internal order is not open' USING ERRCODE = '55000';
  END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one line is required' USING ERRCODE = '22023';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_n := v_n + 1;
    SELECT iol.id, iol.variant_id, iol.quantity, iol.cancelled_at, s.reserved_quantity, s.issued_quantity, p.base_unit_id
    INTO v_iol
    FROM public.internal_order_lines iol
    JOIN public.internal_order_line_status s ON s.internal_order_line_id = iol.id
    LEFT JOIN public.inventory_variants v ON v.id = iol.variant_id
    LEFT JOIN public.inventory_products p ON p.id = v.product_id
    WHERE iol.id = NULLIF(v_line->>'internal_order_line_id', '')::uuid AND iol.internal_order_id = v_io.id;
    IF NOT FOUND OR v_iol.cancelled_at IS NOT NULL OR v_iol.variant_id IS NULL THEN
      RAISE EXCEPTION 'Line %: not an open catalogue line of this internal order', v_n USING ERRCODE = 'P0002';
    END IF;
    -- Already asked from other branches counts as covered.
    v_need := v_iol.quantity - v_iol.reserved_quantity - v_iol.issued_quantity
      - COALESCE((SELECT SUM(tl.quantity) FROM public.inventory_branch_transfer_lines tl
                  JOIN public.inventory_branch_transfers t ON t.id = tl.transfer_id
                  WHERE tl.internal_order_line_id = v_iol.id AND t.destination_branch_id = v_io.branch_id
                    AND t.status IN ('prepared', 'in_transit')), 0)
      - COALESCE((v_asked->>v_iol.id::text)::numeric, 0);
    IF COALESCE((v_line->>'quantity')::numeric, 0) <= 0 OR (v_line->>'quantity')::numeric > v_need THEN
      RAISE EXCEPTION 'Line %: only % still needed', v_n, trim_scale(GREATEST(v_need, 0)) USING ERRCODE = '22023';
    END IF;
    v_asked := v_asked || jsonb_build_object(v_iol.id::text,
      COALESCE((v_asked->>v_iol.id::text)::numeric, 0) + (v_line->>'quantity')::numeric);
    v_groups := v_groups || jsonb_build_array(jsonb_build_object(
      'iol', v_iol.id, 'variant_id', v_iol.variant_id,
      'source_location_id', NULLIF(v_line->>'location_id', '')::uuid,
      'unit_id', v_iol.base_unit_id, 'quantity', (v_line->>'quantity')::numeric));
  END LOOP;

  SELECT jsonb_agg(g - 'iol') INTO v_lines FROM jsonb_array_elements(v_groups) g;
  -- Reserved at the source branch (needs operate there, as in AutoStacja).
  v_t := public.inventory_create_branch_transfer(
    v_io.organization_id, p_source_branch_id, v_io.branch_id, v_lines,
    'Dla ' || v_io.order_number || COALESCE(' (' || v_io.external_number || ')', ''), p_actor_user_id);
  UPDATE public.inventory_branch_transfers SET internal_order_id = v_io.id WHERE id = (v_t->>'transfer_id')::uuid;
  FOR v_g IN SELECT * FROM jsonb_array_elements(v_groups)
  LOOP
    UPDATE public.inventory_branch_transfer_lines
    SET internal_order_line_id = (v_g->>'iol')::uuid
    WHERE id = (
      SELECT id FROM public.inventory_branch_transfer_lines
      WHERE transfer_id = (v_t->>'transfer_id')::uuid AND internal_order_line_id IS NULL
        AND variant_id = (v_g->>'variant_id')::uuid
        AND source_location_id = (v_g->>'source_location_id')::uuid
        AND quantity = (v_g->>'quantity')::numeric
      LIMIT 1);
  END LOOP;

  RETURN v_t;
END;
$function$;

REVOKE ALL ON FUNCTION public.internal_order_request_from_branch(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_order_request_from_branch(uuid, uuid, uuid, jsonb) TO authenticated;

-- 4. Accept a transfer into the receiving zone, under its ZW -----------------------------

CREATE OR REPLACE FUNCTION public.internal_order_accept_transfer(
  p_actor_user_id uuid,
  p_transfer_id uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_t record;
  v_receiving uuid;
  v_result jsonb;
  v_io record;
  v_ml record;
  v_tl record;
  v_doc jsonb;
  v_rl uuid;
  v_used uuid[] := '{}';
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;
  SELECT id, organization_id, destination_branch_id, internal_order_id, status, transfer_number
  INTO v_t FROM public.inventory_branch_transfers WHERE id = p_transfer_id;
  IF NOT FOUND OR NOT public.has_branch_permission(v_t.organization_id, v_t.destination_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Branch transfer not found or not accessible' USING ERRCODE = 'P0002';
  END IF;
  v_receiving := public.resolve_branch_receiving_location(v_t.organization_id, v_t.destination_branch_id);
  IF v_receiving IS NULL THEN
    RAISE EXCEPTION 'No active receiving location in this branch' USING ERRCODE = 'P0002';
  END IF;

  v_result := public.inventory_accept_branch_transfer(p_transfer_id, v_receiving, p_actor_user_id, NULL);
  IF COALESCE((v_result->>'already_processed')::boolean, false) OR v_result->>'destination_movement_id' IS NULL THEN
    RETURN v_result;
  END IF;

  -- Only a ZW of the receiving branch reserves what arrived.
  SELECT io.id, io.branch_id, io.order_number INTO v_io
  FROM public.internal_orders io WHERE io.id = v_t.internal_order_id;
  IF v_io.id IS NULL OR v_io.branch_id <> v_t.destination_branch_id THEN
    RETURN v_result;
  END IF;

  FOR v_tl IN
    SELECT tl.internal_order_line_id, tl.variant_id, COALESCE(tl.accepted_quantity, tl.quantity) AS qty,
           iol.repair_order_line_id
    FROM public.inventory_branch_transfer_lines tl
    JOIN public.internal_order_lines iol ON iol.id = tl.internal_order_line_id
    WHERE tl.transfer_id = p_transfer_id AND COALESCE(tl.accepted_quantity, tl.quantity) > 0
  LOOP
    SELECT ml.id, ml.quantity INTO v_ml
    FROM public.inventory_movement_lines ml
    WHERE ml.movement_id = (v_result->>'destination_movement_id')::uuid
      AND ml.variant_id = v_tl.variant_id AND ml.quantity = v_tl.qty AND NOT (ml.id = ANY (v_used))
    ORDER BY ml.line_number
    LIMIT 1;
    IF v_ml.id IS NULL THEN CONTINUE; END IF;
    v_used := v_used || v_ml.id;

    IF v_doc IS NULL THEN
      v_doc := public.internal_order_reservation_doc_internal(
        p_actor_user_id, v_io.id, 'Przyjęcie ' || v_t.transfer_number);
    END IF;
    IF v_tl.repair_order_line_id IS NOT NULL THEN
      -- An MM 312 is a receipt of the position (it is not a PZ, so the
      -- engine-level link is written directly, as putaway does).
      PERFORM public.write_repair_order_line_movement_link_internal(
        v_tl.repair_order_line_id, v_ml.id, v_tl.qty, 'receipt');
    END IF;
    v_rl := public.inventory_reservation_add_line_internal(
      (v_doc->>'id')::uuid, v_tl.variant_id, v_receiving, v_tl.qty,
      v_tl.repair_order_line_id, v_ml.id, NULL, p_actor_user_id, 'Przyjęcie ' || v_t.transfer_number);
    UPDATE public.inventory_reservation_lines SET internal_order_line_id = v_tl.internal_order_line_id WHERE id = v_rl;
    INSERT INTO public.internal_order_line_movement_links (
      internal_order_line_id, inventory_movement_line_id, applied_quantity, relation_type, repair_order_line_id)
    VALUES (v_tl.internal_order_line_id, v_ml.id, v_tl.qty, 'receipt', v_tl.repair_order_line_id);
  END LOOP;

  RETURN v_result || jsonb_build_object('reservation_number', v_doc->>'number');
END;
$function$;

REVOKE ALL ON FUNCTION public.internal_order_accept_transfer(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_order_accept_transfer(uuid, uuid) TO authenticated;

-- 5. Stock at the other branches ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.internal_order_stock_elsewhere(
  p_organization_id uuid,
  p_branch_id uuid,
  p_variant_ids uuid[]
)
 RETURNS TABLE (
   branch_id uuid, branch_name text, variant_id uuid,
   location_id uuid, location_code text, location_name text, available numeric
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.read') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.read permission' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT b.id, b.name, bal.variant_id, l.id, l.code, l.name, bal.available_quantity
  FROM public.inventory_balances bal
  JOIN public.branches b ON b.id = bal.branch_id AND b.deleted_at IS NULL
  JOIN public.warehouse_locations l ON l.id = bal.location_id AND l.deleted_at IS NULL
  WHERE bal.organization_id = p_organization_id AND bal.branch_id <> p_branch_id
    AND bal.variant_id = ANY (p_variant_ids) AND bal.available_quantity > 0
    AND COALESCE(l.purpose, '') <> 'receiving'
  ORDER BY b.name, l.code;
END;
$function$;

REVOKE ALL ON FUNCTION public.internal_order_stock_elsewhere(uuid, uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_order_stock_elsewhere(uuid, uuid, uuid[]) TO authenticated;

-- 6. Shipped counts as W ------------------------------------------------------------------------

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
    + COALESCE(SUM(al.fulfilled), 0)
    + COALESCE((SELECT SUM(k.applied_quantity) FROM public.internal_order_line_movement_links k
                WHERE k.internal_order_line_id = iol.id AND k.relation_type = 'transfer_out'), 0) AS issued_quantity
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
