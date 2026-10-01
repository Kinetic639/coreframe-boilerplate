-- Zone 5 -- receiving zone and putaway (product decisions 2026-10-01).
--
--  1. Stock in a branch's receiving location (purpose='receiving') is not
--     available: no reservation or allocation line may point at it.
--  2. inventory_product_branch_settings: per product, per branch handling
--     mode ('standard' | 'bulk') and an optional fixed location.
--  3. inventory_attribute_receipt_lines: after a PZ (101) is posted, link
--     its lines to RepairOrderLines through their Matcher source lines.
--  4. inventory_receiving_pending: what waits in the receiving zone, split
--     per RepairOrderLine (attributed) and free remainder.
--  5. inventory_putaway_from_receiving: put one item away out of the
--     receiving zone, atomically:
--       free stock             -> 801 to the scanned location;
--       RepairOrder, bulk      -> 801 (attributed) + reservation for the line
--                                 at its fixed/scanned location;
--       RepairOrder, standard  -> 801 (attributed) + reservation + allocation
--                                 + placement into that RepairOrder's
--                                 container at the scanned location (the
--                                 existing one, or a new K-<ZL>-NN).

-- ---------------------------------------------------------------------------
-- 1. Receiving zone is not available stock
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inventory_block_commitment_at_receiving()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.location_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.warehouse_locations
    WHERE id = NEW.location_id AND purpose = 'receiving'
  ) THEN
    RAISE EXCEPTION 'Stock in the receiving zone is not available until it is put away'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER inventory_reservation_lines_not_at_receiving
  BEFORE INSERT OR UPDATE OF location_id ON public.inventory_reservation_lines
  FOR EACH ROW EXECUTE FUNCTION public.inventory_block_commitment_at_receiving();

CREATE TRIGGER inventory_allocation_lines_not_at_receiving
  BEFORE INSERT OR UPDATE OF location_id ON public.inventory_allocation_lines
  FOR EACH ROW EXECUTE FUNCTION public.inventory_block_commitment_at_receiving();

-- ---------------------------------------------------------------------------
-- 2. Per-branch product handling
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_product_branch_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.inventory_products(id) ON DELETE CASCADE,
  handling_mode text NOT NULL DEFAULT 'standard' CHECK (handling_mode IN ('standard', 'bulk')),
  default_location_id uuid,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_product_branch_settings_branch_org_fk
    FOREIGN KEY (branch_id, organization_id) REFERENCES public.branches(id, organization_id),
  CONSTRAINT inventory_product_branch_settings_location_fk
    FOREIGN KEY (default_location_id, organization_id, branch_id)
    REFERENCES public.warehouse_locations(id, organization_id, branch_id),
  CONSTRAINT inventory_product_branch_settings_uniq UNIQUE (branch_id, product_id)
);

CREATE INDEX IF NOT EXISTS inventory_product_branch_settings_org_branch_idx
  ON public.inventory_product_branch_settings (organization_id, branch_id);

CREATE TRIGGER inventory_product_branch_settings_updated_at
  BEFORE UPDATE ON public.inventory_product_branch_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.inventory_product_branch_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_product_branch_settings FORCE ROW LEVEL SECURITY;

CREATE POLICY inventory_product_branch_settings_select ON public.inventory_product_branch_settings
  FOR SELECT TO authenticated
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read'));

CREATE POLICY inventory_product_branch_settings_insert ON public.inventory_product_branch_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.products.manage'));

CREATE POLICY inventory_product_branch_settings_update ON public.inventory_product_branch_settings
  FOR UPDATE TO authenticated
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.products.manage'))
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.products.manage'));

CREATE POLICY inventory_product_branch_settings_delete ON public.inventory_product_branch_settings
  FOR DELETE TO authenticated
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.products.manage'));

REVOKE ALL ON public.inventory_product_branch_settings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_product_branch_settings TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Attribute posted PZ lines to RepairOrderLines via their Matcher lines
-- ---------------------------------------------------------------------------
-- p_lines: [{ "movement_line_id": uuid, "source_line_id": uuid (wdd_matcher_lines.id) }]
-- Lines that do not resolve to exactly one RepairOrderLine of this branch, or
-- whose variant disagrees, are skipped and reported -- the PZ itself stands;
-- skipped quantities simply show up as free stock in the receiving zone.
CREATE OR REPLACE FUNCTION public.inventory_attribute_receipt_lines(
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
  v_count integer;
  v_rol_id uuid;
  v_rol_variant uuid;
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
    WHERE id = (v_line->>'movement_line_id')::uuid AND movement_id = p_movement_id AND deleted_at IS NULL;

    IF NOT FOUND OR NULLIF(v_line->>'source_line_id', '') IS NULL THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object('movement_line_id', v_line->>'movement_line_id', 'reason', 'invalid_line'));
      CONTINUE;
    END IF;

    SELECT count(*), min(rol.id::text)::uuid, min(rol.variant_id::text)::uuid
    INTO v_count, v_rol_id, v_rol_variant
    FROM public.workshop_source_document_lines wsdl
    JOIN public.repair_order_line_source_links rols ON rols.workshop_source_document_line_id = wsdl.id
    JOIN public.repair_order_lines rol ON rol.id = rols.repair_order_line_id AND rol.deleted_at IS NULL
    JOIN public.repair_orders ro ON ro.id = rol.repair_order_id AND ro.deleted_at IS NULL
    WHERE wsdl.wdd_matcher_line_id = (v_line->>'source_line_id')::uuid
      AND ro.organization_id = v_header.organization_id
      AND ro.branch_id = v_header.branch_id;

    IF v_count <> 1 THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'movement_line_id', v_ml.id, 'reason', CASE WHEN v_count = 0 THEN 'no_repair_order_line' ELSE 'ambiguous' END));
      CONTINUE;
    END IF;

    IF v_rol_variant IS NOT NULL AND v_rol_variant <> v_ml.variant_id THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object('movement_line_id', v_ml.id, 'reason', 'variant_mismatch'));
      CONTINUE;
    END IF;

    -- A Matcher-materialized RepairOrderLine carries only a product code;
    -- the posted receipt is what resolves it to a catalog variant.
    IF v_rol_variant IS NULL THEN
      UPDATE public.repair_order_lines SET variant_id = v_ml.variant_id, updated_at = now()
      WHERE id = v_rol_id AND variant_id IS NULL;
    END IF;

    BEGIN
      PERFORM public.attach_repair_order_line_movement(p_actor_user_id, v_rol_id, v_ml.id, v_ml.quantity, 'receipt');
      v_attributed := v_attributed || jsonb_build_array(jsonb_build_object('movement_line_id', v_ml.id, 'repair_order_line_id', v_rol_id));
    EXCEPTION WHEN unique_violation THEN
      v_attributed := v_attributed || jsonb_build_array(jsonb_build_object('movement_line_id', v_ml.id, 'repair_order_line_id', v_rol_id));
    END;
  END LOOP;

  RETURN jsonb_build_object('movement_id', p_movement_id, 'attributed', v_attributed, 'skipped', v_skipped);
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. What waits in the receiving zone
-- ---------------------------------------------------------------------------
-- One row per (variant, RepairOrderLine) still attributed at the receiving
-- location, plus one row per variant for the unattributed (free) remainder.
-- Attribution is the same live, reversal-aware ledger formula
-- putaway_repair_order_stock uses.
CREATE OR REPLACE FUNCTION public.inventory_receiving_pending(
  p_organization_id uuid,
  p_branch_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
  free AS (
    SELECT s.variant_id, s.on_hand - COALESCE((SELECT SUM(a.qty) FROM attributed a WHERE a.variant_id = s.variant_id), 0) AS qty
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
    SELECT a.variant_id, a.repair_order_line_id, LEAST(a.qty, s.on_hand) AS qty, a.document_number
    FROM attributed a JOIN stock s ON s.variant_id = a.variant_id
    UNION ALL
    SELECT f.variant_id, NULL::uuid, f.qty, lp.document_number
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
      'handling_mode', COALESCE(st.handling_mode, 'standard'),
      'default_location_id', st.default_location_id,
      'default_location_code', dl.code,
      'default_location_name', dl.name,
      'container_id', c.id,
      'container_code', c.code,
      'container_location_id', c.current_location_id,
      'container_location_code', cl.code,
      'container_location_name', cl.name
    ) ORDER BY ro.zl_number NULLS LAST, v.sku), '[]'::jsonb)
  INTO v_rows
  FROM items i
  JOIN public.inventory_variants v ON v.id = i.variant_id
  JOIN public.inventory_products p ON p.id = v.product_id
  LEFT JOIN public.inventory_units u ON u.id = p.base_unit_id
  LEFT JOIN public.repair_order_lines rol ON rol.id = i.repair_order_line_id
  LEFT JOIN public.repair_orders ro ON ro.id = rol.repair_order_id
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

-- ---------------------------------------------------------------------------
-- 5. Put one item away out of the receiving zone
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inventory_putaway_from_receiving(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_variant_id uuid,
  p_quantity numeric,
  p_destination_location_id uuid,
  p_repair_order_line_id uuid DEFAULT NULL,
  p_container_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_receiving uuid;
  v_product record;
  v_handling text;
  v_on_hand numeric;
  v_attributed_total numeric;
  v_rol record;
  v_result jsonb;
  v_movement_id uuid;
  v_need numeric;
  v_reserve_qty numeric := 0;
  v_reservation jsonb;
  v_reservation_id uuid;
  v_reservation_line_id uuid;
  v_allocation jsonb;
  v_allocation_line_id uuid;
  v_container record;
  v_container_created boolean := false;
  v_code text;
  v_n integer;
  v_mode text;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive' USING ERRCODE = '22023';
  END IF;

  v_receiving := public.resolve_branch_receiving_location(p_organization_id, p_branch_id);

  IF p_destination_location_id IS NULL OR p_destination_location_id = v_receiving OR NOT EXISTS (
    SELECT 1 FROM public.warehouse_locations
    WHERE id = p_destination_location_id AND organization_id = p_organization_id
      AND branch_id = p_branch_id AND can_store_inventory = true AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Destination is not a valid stockable location in this branch' USING ERRCODE = '22023';
  END IF;

  SELECT p.id, p.base_unit_id INTO v_product
  FROM public.inventory_variants v
  JOIN public.inventory_products p ON p.id = v.product_id AND p.organization_id = v.organization_id
  WHERE v.id = p_variant_id AND v.organization_id = p_organization_id AND v.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(handling_mode, 'standard') INTO v_handling
  FROM public.inventory_product_branch_settings
  WHERE product_id = v_product.id AND branch_id = p_branch_id;
  v_handling := COALESCE(v_handling, 'standard');

  -- ---- Free stock --------------------------------------------------------
  IF p_repair_order_line_id IS NULL THEN
    PERFORM 1 FROM public.inventory_balances
    WHERE organization_id = p_organization_id AND branch_id = p_branch_id
      AND location_id = v_receiving AND variant_id = p_variant_id
    FOR UPDATE;

    SELECT COALESCE(SUM((it->>'quantity')::numeric), 0) INTO v_attributed_total
    FROM jsonb_array_elements(public.inventory_receiving_pending(p_organization_id, p_branch_id)->'items') it
    WHERE (it->>'variant_id')::uuid = p_variant_id AND it->>'repair_order_line_id' IS NOT NULL;

    SELECT COALESCE(on_hand_quantity, 0) INTO v_on_hand
    FROM public.inventory_balances
    WHERE organization_id = p_organization_id AND branch_id = p_branch_id
      AND location_id = v_receiving AND variant_id = p_variant_id;

    IF COALESCE(v_on_hand, 0) - v_attributed_total < p_quantity THEN
      RAISE EXCEPTION 'Not enough free stock of this item in the receiving zone' USING ERRCODE = '22023';
    END IF;

    v_result := public.inventory_create_and_finalize(
      p_organization_id, p_branch_id, '801',
      jsonb_build_array(jsonb_build_object(
        'variant_id', p_variant_id, 'unit_id', v_product.base_unit_id, 'quantity', p_quantity,
        'source_location_id', v_receiving, 'destination_location_id', p_destination_location_id, 'note', NULL)),
      NULL, NULL, NULL, NULL, NULL, NULL, p_actor_user_id
    );

    RETURN jsonb_build_object(
      'mode', 'free',
      'movement_id', v_result->>'movement_id',
      'document_number', v_result->>'document_number',
      'destination_location_id', p_destination_location_id,
      'quantity', p_quantity
    );
  END IF;

  -- ---- RepairOrder stock -------------------------------------------------
  SELECT rol.id, rol.variant_id, rol.ordered_quantity, ro.id AS repair_order_id, ro.zl_number
  INTO v_rol
  FROM public.repair_order_lines rol
  JOIN public.repair_orders ro ON ro.id = rol.repair_order_id
  WHERE rol.id = p_repair_order_line_id AND rol.deleted_at IS NULL AND ro.deleted_at IS NULL
    AND ro.organization_id = p_organization_id AND ro.branch_id = p_branch_id
  FOR UPDATE OF rol;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RepairOrderLine not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_rol.variant_id IS NOT NULL AND v_rol.variant_id <> p_variant_id THEN
    RAISE EXCEPTION 'Item does not match the RepairOrderLine''s product' USING ERRCODE = '22023';
  END IF;
  IF v_rol.variant_id IS NULL THEN
    UPDATE public.repair_order_lines SET variant_id = p_variant_id, updated_at = now() WHERE id = v_rol.id;
  END IF;

  -- Physical move out of the receiving zone, attributed to the line
  -- (validates the line really has this much at the receiving zone).
  v_result := public.putaway_repair_order_stock(
    p_actor_user_id, p_organization_id, p_branch_id,
    jsonb_build_array(jsonb_build_object(
      'repair_order_line_id', v_rol.id, 'variant_id', p_variant_id,
      'unit_id', v_product.base_unit_id, 'quantity', p_quantity)),
    p_destination_location_id, NULL
  );
  v_movement_id := (v_result->>'movement_id')::uuid;

  -- Reserve for the line what it still needs (never more than ordered).
  SELECT v_rol.ordered_quantity - COALESCE(SUM(rl.reserved_quantity - rl.released_quantity), 0)
  INTO v_need
  FROM public.inventory_reservation_lines rl
  JOIN public.inventory_reservations r ON r.id = rl.reservation_id
  WHERE r.reference_type = 'repair_order_line' AND r.reference_id = v_rol.id
    AND r.status <> 'cancelled' AND r.deleted_at IS NULL;
  v_reserve_qty := LEAST(p_quantity, GREATEST(COALESCE(v_need, v_rol.ordered_quantity), 0));

  v_mode := CASE WHEN v_handling = 'bulk' THEN 'bulk' ELSE 'container' END;

  IF v_reserve_qty > 0 THEN
    v_reservation := public.inventory_create_reservation(
      p_organization_id, p_branch_id,
      jsonb_build_array(jsonb_build_object(
        'variant_id', p_variant_id, 'location_id', p_destination_location_id, 'quantity', v_reserve_qty)),
      'repair_order_line', v_rol.id, v_rol.zl_number, NULL, NULL, p_actor_user_id
    );
    v_reservation_id := (v_reservation->>'reservation_id')::uuid;
    SELECT id INTO v_reservation_line_id FROM public.inventory_reservation_lines WHERE reservation_id = v_reservation_id;

    IF v_mode = 'container' THEN
      v_allocation := public.inventory_create_allocation(
        p_organization_id, p_branch_id,
        jsonb_build_array(jsonb_build_object(
          'variant_id', p_variant_id, 'location_id', p_destination_location_id,
          'quantity', v_reserve_qty, 'reservation_line_id', v_reservation_line_id)),
        v_reservation_id, 'repair_order_line', v_rol.id, v_rol.zl_number, p_actor_user_id
      );
      SELECT id INTO v_allocation_line_id FROM public.inventory_allocation_lines
      WHERE allocation_id = (v_allocation->>'allocation_id')::uuid;

      IF p_container_id IS NOT NULL THEN
        SELECT id, code INTO v_container FROM public.inventory_containers
        WHERE id = p_container_id AND organization_id = p_organization_id AND branch_id = p_branch_id
          AND reference_type = 'repair_order' AND reference_id = v_rol.repair_order_id::text
          AND current_location_id = p_destination_location_id
          AND status IN ('active', 'empty') AND deleted_at IS NULL;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Container does not belong to this repair order at this location' USING ERRCODE = '22023';
        END IF;
      ELSE
        SELECT id, code INTO v_container FROM public.inventory_containers
        WHERE organization_id = p_organization_id AND branch_id = p_branch_id
          AND reference_type = 'repair_order' AND reference_id = v_rol.repair_order_id::text
          AND current_location_id = p_destination_location_id
          AND status IN ('active', 'empty') AND deleted_at IS NULL
        ORDER BY (status = 'active') DESC, created_at
        LIMIT 1;
      END IF;

      IF v_container.id IS NULL THEN
        SELECT count(*) + 1 INTO v_n FROM public.inventory_containers
        WHERE organization_id = p_organization_id AND reference_type = 'repair_order'
          AND reference_id = v_rol.repair_order_id::text AND deleted_at IS NULL;
        LOOP
          v_code := 'K-' || COALESCE(v_rol.zl_number, 'ZL') || '-' || lpad(v_n::text, 2, '0');
          EXIT WHEN NOT EXISTS (
            SELECT 1 FROM public.inventory_containers
            WHERE organization_id = p_organization_id AND branch_id = p_branch_id
              AND lower(code) = lower(v_code) AND deleted_at IS NULL);
          v_n := v_n + 1;
        END LOOP;
        SELECT (c->>'container_id')::uuid AS id, v_code AS code INTO v_container
        FROM (SELECT public.inventory_create_container(
          p_actor_user_id, p_organization_id, p_branch_id, v_code, p_destination_location_id,
          'container', 'repair_order', v_rol.repair_order_id::text) AS c) x;
        v_container_created := true;
      END IF;

      PERFORM public.repair_order_add_allocation_to_container(
        p_actor_user_id, p_organization_id, p_branch_id, v_container.id, v_allocation_line_id, v_reserve_qty);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'mode', v_mode,
    'movement_id', v_movement_id,
    'document_number', v_result->>'document_number',
    'destination_location_id', p_destination_location_id,
    'quantity', p_quantity,
    'reserved_quantity', v_reserve_qty,
    'repair_order_id', v_rol.repair_order_id,
    'zl_number', v_rol.zl_number,
    'container_id', CASE WHEN v_mode = 'container' THEN v_container.id END,
    'container_code', CASE WHEN v_mode = 'container' THEN v_container.code END,
    'container_created', v_container_created
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_attribute_receipt_lines(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_attribute_receipt_lines(uuid, uuid, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.inventory_receiving_pending(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_receiving_pending(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.inventory_putaway_from_receiving(uuid, uuid, uuid, uuid, numeric, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_putaway_from_receiving(uuid, uuid, uuid, uuid, numeric, uuid, uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.inventory_block_commitment_at_receiving() FROM PUBLIC, anon;
