-- ============================================================================
-- Reservations & blocks, stage E5: blocked stock (docs/RESERVATIONS_BLOCKS_PLAN.md)
-- ============================================================================
-- B (blocked): a part that cannot be used, for a reason. Nobody can take it.
-- * Documents: inventory_stock_blocks (BLK/rrrr/nnnnnn, reason, optional
--   reference e.g. a complaint), inventory_stock_block_lines (part, location,
--   blocked / unblocked / moved / consumed), inventory_stock_block_events
--   (append-only history).
-- * inventory_block_stock: from D; a reserved part is first taken off its
--   reservation (event 'released' on the reservation, with the block).
-- * inventory_unblock_stock: B -> D, with a reason.
-- * inventory_move_blocked_stock: a blocked part moves (MM) and stays blocked.
-- * inventory_issue_blocked_stock: B leaves the stock as 122 "Zwrot do
--   dostawcy" (ZWD/...) or 551 "Likwidacja" (LIK/...). These two movement
--   types are not available for manual entry.
-- Every operation requires warehouse.inventory.operate.
-- ============================================================================

-- open_need runs with the caller's rights (RLS), like any read.
CREATE OR REPLACE FUNCTION public.repair_order_line_open_need(p_repair_order_line_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT rol.ordered_quantity - COALESCE((
    SELECT SUM(rl.reserved_quantity - rl.released_quantity)
    FROM public.inventory_reservation_lines rl
    JOIN public.inventory_reservations r ON r.id = rl.reservation_id
    WHERE COALESCE(rl.repair_order_line_id,
                   CASE WHEN r.reference_type = 'repair_order_line' THEN r.reference_id END) = rol.id
      AND r.status <> 'cancelled' AND r.deleted_at IS NULL
  ), 0)
  FROM public.repair_order_lines rol
  WHERE rol.id = p_repair_order_line_id;
$function$;

-- Tables ----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.inventory_stock_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  block_number text NOT NULL CHECK (length(trim(block_number)) > 0),
  reason_code text NOT NULL CHECK (reason_code IN ('quality_check', 'supplier_complaint', 'damaged', 'delivery_mismatch', 'other')),
  description text,
  reference_type text,
  reference_id text,
  reference_number text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  CONSTRAINT inventory_stock_blocks_other_needs_description
    CHECK (reason_code <> 'other' OR length(trim(COALESCE(description, ''))) > 0)
);

CREATE TABLE IF NOT EXISTS public.inventory_stock_block_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  block_id uuid NOT NULL REFERENCES public.inventory_stock_blocks(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.inventory_products(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.inventory_variants(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.warehouse_locations(id) ON DELETE CASCADE,
  blocked_quantity numeric(18, 6) NOT NULL CHECK (blocked_quantity > 0),
  unblocked_quantity numeric(18, 6) NOT NULL DEFAULT 0 CHECK (unblocked_quantity >= 0),
  moved_quantity numeric(18, 6) NOT NULL DEFAULT 0 CHECK (moved_quantity >= 0),
  consumed_quantity numeric(18, 6) NOT NULL DEFAULT 0 CHECK (consumed_quantity >= 0),
  released_reservation_line_id uuid REFERENCES public.inventory_reservation_lines(id) ON DELETE SET NULL,
  moved_from_line_id uuid REFERENCES public.inventory_stock_block_lines(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_stock_block_lines_qty_check
    CHECK (unblocked_quantity + moved_quantity + consumed_quantity <= blocked_quantity)
);

CREATE TABLE IF NOT EXISTS public.inventory_stock_block_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  block_id uuid NOT NULL REFERENCES public.inventory_stock_blocks(id) ON DELETE CASCADE,
  block_line_id uuid REFERENCES public.inventory_stock_block_lines(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('blocked', 'unblocked', 'moved', 'returned_to_supplier', 'scrapped')),
  quantity numeric(18, 6) NOT NULL CHECK (quantity > 0),
  location_id uuid REFERENCES public.warehouse_locations(id) ON DELETE CASCADE,
  to_location_id uuid REFERENCES public.warehouse_locations(id) ON DELETE CASCADE,
  movement_id uuid REFERENCES public.inventory_movement_headers(id) ON DELETE CASCADE,
  movement_line_id uuid REFERENCES public.inventory_movement_lines(id) ON DELETE CASCADE,
  reservation_line_id uuid REFERENCES public.inventory_reservation_lines(id) ON DELETE CASCADE,
  reason text,
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_reservation_events
  ADD CONSTRAINT inventory_reservation_events_block_id_fkey
  FOREIGN KEY (block_id) REFERENCES public.inventory_stock_blocks(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_stock_blocks_number_uidx
  ON public.inventory_stock_blocks (organization_id, block_number);
CREATE INDEX IF NOT EXISTS inventory_stock_blocks_branch_idx
  ON public.inventory_stock_blocks (organization_id, branch_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_stock_block_lines_block_idx
  ON public.inventory_stock_block_lines (block_id);
CREATE INDEX IF NOT EXISTS inventory_stock_block_lines_stock_idx
  ON public.inventory_stock_block_lines (location_id, variant_id);
CREATE INDEX IF NOT EXISTS inventory_stock_block_events_block_idx
  ON public.inventory_stock_block_events (block_id, created_at);
CREATE INDEX IF NOT EXISTS inventory_reservation_events_block_idx
  ON public.inventory_reservation_events (block_id) WHERE block_id IS NOT NULL;

COMMENT ON TABLE public.inventory_stock_blocks IS
  'Blocked-stock documents (BLK/rrrr/nnnnnn): parts that cannot be used, with the reason. Written only by engine functions.';
COMMENT ON TABLE public.inventory_stock_block_events IS
  'Append-only history of blocked stock: blocked, unblocked, moved, returned_to_supplier, scrapped.';

CREATE OR REPLACE FUNCTION public.inventory_stock_block_events_no_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'Block history is append-only. Cannot % block events.', TG_OP USING ERRCODE = '42501';
END;
$function$;

CREATE TRIGGER inventory_stock_block_events_no_update
  BEFORE UPDATE ON public.inventory_stock_block_events
  FOR EACH ROW EXECUTE FUNCTION public.inventory_stock_block_events_no_update();

ALTER TABLE public.inventory_stock_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock_block_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock_block_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_stock_blocks_select ON public.inventory_stock_blocks
  FOR SELECT TO authenticated
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read'));
CREATE POLICY inventory_stock_block_lines_select ON public.inventory_stock_block_lines
  FOR SELECT TO authenticated
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read'));
CREATE POLICY inventory_stock_block_events_select ON public.inventory_stock_block_events
  FOR SELECT TO authenticated
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read'));

REVOKE ALL ON public.inventory_stock_blocks, public.inventory_stock_block_lines, public.inventory_stock_block_events FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.inventory_stock_blocks, public.inventory_stock_block_lines, public.inventory_stock_block_events FROM authenticated;
GRANT SELECT ON public.inventory_stock_blocks, public.inventory_stock_block_lines, public.inventory_stock_block_events TO authenticated;

-- Document / movement types -----------------------------------------------------

CREATE OR REPLACE FUNCTION public.inventory_ensure_blocked_stock_types_internal(p_organization_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doc_id uuid;
  v_type_id uuid;
  v_def record;
BEGIN
  INSERT INTO public.inventory_document_types (
    organization_id, code, name, name_pl, name_en, category, numbering_template, is_system
  ) VALUES (
    p_organization_id, 'BLK', 'Stock block', 'Blokada', 'Stock block', 'other', 'BLK/{year}/{seq:6}', true
  )
  ON CONFLICT (organization_id, code) WHERE deleted_at IS NULL DO NOTHING;

  FOR v_def IN
    SELECT * FROM (VALUES
      ('ZWD', 'Return to supplier', 'Zwrot do dostawcy', '122', 'Return to supplier (blocked stock)', 'Zwrot do dostawcy'),
      ('LIK', 'Scrapping', 'Likwidacja', '551', 'Scrapping (blocked stock)', 'Likwidacja')
    ) AS d(doc_code, doc_name, doc_name_pl, type_code, type_name, type_name_pl)
  LOOP
    INSERT INTO public.inventory_document_types (
      organization_id, code, name, name_pl, name_en, category, numbering_template, is_system
    ) VALUES (
      p_organization_id, v_def.doc_code, v_def.doc_name, v_def.doc_name_pl, v_def.doc_name, 'issue',
      v_def.doc_code || '/{year}/{seq:6}', true
    )
    ON CONFLICT (organization_id, code) WHERE deleted_at IS NULL DO NOTHING;

    SELECT id INTO v_doc_id FROM public.inventory_document_types
    WHERE organization_id = p_organization_id AND code = v_def.doc_code AND deleted_at IS NULL;

    INSERT INTO public.inventory_movement_types (
      organization_id, code, document_type_id, name, name_pl, name_en, category,
      requires_source_location, requires_destination_location, cost_impact, is_system, allows_manual_entry
    ) VALUES (
      p_organization_id, v_def.type_code, v_doc_id, v_def.type_name, v_def.type_name_pl, v_def.type_name, 'issue',
      true, false, 'decrease', true, false
    )
    ON CONFLICT (organization_id, code) WHERE deleted_at IS NULL DO NOTHING;

    SELECT id INTO v_type_id FROM public.inventory_movement_types
    WHERE organization_id = p_organization_id AND code = v_def.type_code AND deleted_at IS NULL;

    INSERT INTO public.inventory_movement_type_effects (
      movement_type_id, effect_order, target, balance_field, direction, is_required, description
    ) VALUES (
      v_type_id, 1, 'source', 'on_hand', 'decrease', true, v_def.type_name_pl || ' z towaru zablokowanego'
    )
    ON CONFLICT (movement_type_id, effect_order) DO NOTHING;
  END LOOP;
END;
$function$;

-- Next number of a document type (yearly sequence, like movement documents).
CREATE OR REPLACE FUNCTION public.inventory_next_document_number_internal(p_organization_id uuid, p_doc_code text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doc_id uuid;
  v_year integer := extract(year from now())::integer;
  v_seq record;
BEGIN
  SELECT id INTO v_doc_id FROM public.inventory_document_types
  WHERE organization_id = p_organization_id AND code = p_doc_code AND deleted_at IS NULL;
  IF v_doc_id IS NULL THEN
    RAISE EXCEPTION 'Document type % not configured', p_doc_code USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.inventory_document_sequences (organization_id, document_type_id, year)
  VALUES (p_organization_id, v_doc_id, v_year)
  ON CONFLICT DO NOTHING;

  SELECT * INTO v_seq FROM public.inventory_document_sequences
  WHERE organization_id = p_organization_id AND document_type_id = v_doc_id
    AND branch_id IS NULL AND series IS NULL AND year = v_year
  FOR UPDATE;

  UPDATE public.inventory_document_sequences SET next_number = next_number + 1 WHERE id = v_seq.id;

  RETURN p_doc_code || '/' || v_year::text || '/' || lpad(v_seq.next_number::text, 6, '0');
END;
$function$;

CREATE OR REPLACE FUNCTION public.inventory_stock_block_log_internal(
  p_block_line_id uuid, p_event_type text, p_quantity numeric, p_to_location_id uuid,
  p_movement_id uuid, p_movement_line_id uuid, p_reservation_line_id uuid, p_reason text, p_actor_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.inventory_stock_block_events (
    organization_id, branch_id, block_id, block_line_id, event_type, quantity,
    location_id, to_location_id, movement_id, movement_line_id, reservation_line_id, reason, actor_user_id)
  SELECT bl.organization_id, bl.branch_id, bl.block_id, bl.id, p_event_type, p_quantity,
         bl.location_id, p_to_location_id, p_movement_id, p_movement_line_id, p_reservation_line_id,
         NULLIF(trim(p_reason), ''), p_actor_user_id
  FROM public.inventory_stock_block_lines bl WHERE bl.id = p_block_line_id;
END;
$function$;

-- A block document closes when nothing is left blocked on it.
CREATE OR REPLACE FUNCTION public.inventory_stock_block_refresh_status_internal(p_block_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.inventory_stock_blocks b
  SET status = CASE WHEN x.open_qty > 0 THEN 'active' ELSE 'closed' END,
      closed_at = CASE WHEN x.open_qty > 0 THEN NULL ELSE COALESCE(b.closed_at, now()) END,
      updated_at = now()
  FROM (
    SELECT COALESCE(SUM(blocked_quantity - unblocked_quantity - moved_quantity - consumed_quantity), 0) AS open_qty
    FROM public.inventory_stock_block_lines WHERE block_id = p_block_id
  ) x
  WHERE b.id = p_block_id;
END;
$function$;

-- Put a quantity into B on a block document (internal; takes D).
CREATE OR REPLACE FUNCTION public.inventory_stock_block_add_line_internal(
  p_block_id uuid, p_variant_id uuid, p_location_id uuid, p_quantity numeric,
  p_released_reservation_line_id uuid, p_moved_from_line_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_block public.inventory_stock_blocks%ROWTYPE;
  v_product_id uuid;
  v_balance public.inventory_balances%ROWTYPE;
  v_line_id uuid;
BEGIN
  SELECT * INTO v_block FROM public.inventory_stock_blocks WHERE id = p_block_id;

  SELECT p.id INTO v_product_id
  FROM public.inventory_variants v
  JOIN public.inventory_products p ON p.id = v.product_id AND p.organization_id = v.organization_id
  WHERE v.id = p_variant_id AND v.organization_id = v_block.organization_id AND v.deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);
  v_balance := public.inventory_get_or_create_balance_for_update(
    v_block.organization_id, v_block.branch_id, p_location_id, p_variant_id, NULL, NULL, NULL);
  IF v_balance.available_quantity < p_quantity THEN
    RAISE EXCEPTION 'Only % available to block at this location', v_balance.available_quantity USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.inventory_stock_block_lines (
    organization_id, branch_id, block_id, product_id, variant_id, location_id, blocked_quantity,
    released_reservation_line_id, moved_from_line_id)
  VALUES (
    v_block.organization_id, v_block.branch_id, v_block.id, v_product_id, p_variant_id, p_location_id, p_quantity,
    p_released_reservation_line_id, p_moved_from_line_id)
  RETURNING id INTO v_line_id;

  UPDATE public.inventory_balances SET blocked = blocked + p_quantity WHERE id = v_balance.id;
  RETURN v_line_id;
END;
$function$;

-- Take a quantity off B (internal): field = unblocked / moved / consumed.
CREATE OR REPLACE FUNCTION public.inventory_stock_block_take_internal(p_block_line_id uuid, p_quantity numeric, p_field text)
 RETURNS public.inventory_stock_block_lines
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_line public.inventory_stock_block_lines%ROWTYPE;
  v_open numeric;
  v_balance public.inventory_balances%ROWTYPE;
BEGIN
  SELECT * INTO v_line FROM public.inventory_stock_block_lines WHERE id = p_block_line_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Block line not found' USING ERRCODE = 'P0002';
  END IF;
  v_open := v_line.blocked_quantity - v_line.unblocked_quantity - v_line.moved_quantity - v_line.consumed_quantity;
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity > v_open THEN
    RAISE EXCEPTION 'Only % is still blocked on this line', v_open USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);
  v_balance := public.inventory_get_or_create_balance_for_update(
    v_line.organization_id, v_line.branch_id, v_line.location_id, v_line.variant_id, NULL, NULL, NULL);
  UPDATE public.inventory_balances SET blocked = blocked - p_quantity WHERE id = v_balance.id;

  UPDATE public.inventory_stock_block_lines
  SET unblocked_quantity = unblocked_quantity + CASE WHEN p_field = 'unblocked' THEN p_quantity ELSE 0 END,
      moved_quantity = moved_quantity + CASE WHEN p_field = 'moved' THEN p_quantity ELSE 0 END,
      consumed_quantity = consumed_quantity + CASE WHEN p_field = 'consumed' THEN p_quantity ELSE 0 END
  WHERE id = v_line.id
  RETURNING * INTO v_line;
  RETURN v_line;
END;
$function$;

-- Public operations ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.inventory_block_stock(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_lines jsonb,
  p_reason_code text,
  p_description text DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_reference_id text DEFAULT NULL,
  p_reference_number text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_block_id uuid;
  v_number text;
  v_line jsonb;
  v_index integer := 0;
  v_qty numeric;
  v_variant uuid;
  v_location uuid;
  v_rl record;
  v_rl_id uuid;
  v_line_id uuid;
  v_reason text;
  v_lines jsonb := '[]'::jsonb;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;
  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;
  IF p_reason_code IS NULL OR p_reason_code NOT IN ('quality_check', 'supplier_complaint', 'damaged', 'delivery_mismatch', 'other') THEN
    RAISE EXCEPTION 'A valid block reason is required' USING ERRCODE = '22023';
  END IF;
  IF p_reason_code = 'other' AND length(trim(COALESCE(p_description, ''))) = 0 THEN
    RAISE EXCEPTION 'Describe the reason for "other"' USING ERRCODE = '22023';
  END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one line is required' USING ERRCODE = '22023';
  END IF;

  PERFORM public.inventory_ensure_blocked_stock_types_internal(p_organization_id);
  v_number := public.inventory_next_document_number_internal(p_organization_id, 'BLK');
  v_reason := v_number || ' (' || p_reason_code || ')'
    || CASE WHEN length(trim(COALESCE(p_description, ''))) > 0 THEN ': ' || trim(p_description) ELSE '' END;

  INSERT INTO public.inventory_stock_blocks (
    organization_id, branch_id, block_number, reason_code, description,
    reference_type, reference_id, reference_number, created_by)
  VALUES (
    p_organization_id, p_branch_id, v_number, p_reason_code, NULLIF(trim(p_description), ''),
    NULLIF(trim(p_reference_type), ''), NULLIF(trim(p_reference_id), ''), NULLIF(trim(p_reference_number), ''),
    p_actor_user_id)
  RETURNING id INTO v_block_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_index := v_index + 1;
    v_qty := NULLIF(v_line->>'quantity', '')::numeric;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Line % quantity must be positive', v_index USING ERRCODE = '22023';
    END IF;

    v_rl_id := NULL;
    IF NULLIF(v_line->>'reservation_line_id', '') IS NOT NULL THEN
      -- A reserved part: off its reservation first (the order then shows it missing).
      SELECT rl.id, rl.variant_id, rl.location_id,
             rl.reserved_quantity - rl.released_quantity - rl.fulfilled_quantity AS remaining
      INTO v_rl
      FROM public.inventory_reservation_lines rl
      WHERE rl.id = (v_line->>'reservation_line_id')::uuid
        AND rl.organization_id = p_organization_id AND rl.branch_id = p_branch_id
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Line %: reservation not found', v_index USING ERRCODE = 'P0002';
      END IF;
      IF v_qty > v_rl.remaining THEN
        RAISE EXCEPTION 'Line %: only % reserved here (parts in a container are taken out of it first)',
          v_index, v_rl.remaining USING ERRCODE = '22023';
      END IF;
      v_rl_id := v_rl.id;
      v_variant := v_rl.variant_id;
      v_location := v_rl.location_id;

      PERFORM public.inventory_reservation_release_internal(v_rl.id, v_qty, 'moved', NULL, p_actor_user_id);
      INSERT INTO public.inventory_reservation_events (
        organization_id, branch_id, reservation_id, reservation_line_id, event_type, quantity,
        location_id, repair_order_line_id, block_id, reason, actor_user_id)
      SELECT rl.organization_id, rl.branch_id, rl.reservation_id, rl.id, 'released', v_qty,
             rl.location_id,
             COALESCE(rl.repair_order_line_id, CASE WHEN r.reference_type = 'repair_order_line' THEN r.reference_id END),
             v_block_id, 'Blokada ' || v_reason, p_actor_user_id
      FROM public.inventory_reservation_lines rl
      JOIN public.inventory_reservations r ON r.id = rl.reservation_id
      WHERE rl.id = v_rl.id;
    ELSE
      v_variant := NULLIF(v_line->>'variant_id', '')::uuid;
      v_location := NULLIF(v_line->>'location_id', '')::uuid;
      IF v_variant IS NULL OR v_location IS NULL THEN
        RAISE EXCEPTION 'Line % needs an item and a location', v_index USING ERRCODE = '22023';
      END IF;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.warehouse_locations
      WHERE id = v_location AND organization_id = p_organization_id AND branch_id = p_branch_id AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Line %: not a location of this branch', v_index USING ERRCODE = '22023';
    END IF;

    v_line_id := public.inventory_stock_block_add_line_internal(
      v_block_id, v_variant, v_location, v_qty, v_rl_id, NULL);
    PERFORM public.inventory_stock_block_log_internal(
      v_line_id, 'blocked', v_qty, NULL, NULL, NULL, v_rl_id, v_reason, p_actor_user_id);

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'block_line_id', v_line_id, 'variant_id', v_variant, 'location_id', v_location,
      'quantity', v_qty, 'released_reservation_line_id', v_rl_id));
  END LOOP;

  RETURN jsonb_build_object('block_id', v_block_id, 'block_number', v_number, 'lines', v_lines);
END;
$function$;

CREATE OR REPLACE FUNCTION public.inventory_unblock_stock(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_lines jsonb,
  p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_line jsonb;
  v_index integer := 0;
  v_bl record;
  v_qty numeric;
  v_total numeric := 0;
  v_blocks uuid[] := ARRAY[]::uuid[];
  v_b uuid;
  v_reason text := NULLIF(trim(p_reason), '');
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;
  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A reason is required to unblock stock' USING ERRCODE = '22023';
  END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one line is required' USING ERRCODE = '22023';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_index := v_index + 1;
    SELECT id, block_id, blocked_quantity - unblocked_quantity - moved_quantity - consumed_quantity AS open_qty
    INTO v_bl
    FROM public.inventory_stock_block_lines
    WHERE id = NULLIF(v_line->>'block_line_id', '')::uuid
      AND organization_id = p_organization_id AND branch_id = p_branch_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Line %: block not found', v_index USING ERRCODE = 'P0002';
    END IF;
    v_qty := COALESCE(NULLIF(v_line->>'quantity', '')::numeric, v_bl.open_qty);

    PERFORM public.inventory_stock_block_take_internal(v_bl.id, v_qty, 'unblocked');
    PERFORM public.inventory_stock_block_log_internal(
      v_bl.id, 'unblocked', v_qty, NULL, NULL, NULL, NULL, v_reason, p_actor_user_id);
    v_total := v_total + v_qty;
    v_blocks := array_append(v_blocks, v_bl.block_id);
  END LOOP;

  FOREACH v_b IN ARRAY v_blocks LOOP
    PERFORM public.inventory_stock_block_refresh_status_internal(v_b);
  END LOOP;

  RETURN jsonb_build_object('line_count', v_index, 'unblocked_quantity', v_total);
END;
$function$;

CREATE OR REPLACE FUNCTION public.inventory_move_blocked_stock(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_block_line_id uuid,
  p_quantity numeric,
  p_destination_location_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_bl public.inventory_stock_block_lines%ROWTYPE;
  v_unit uuid;
  v_mm jsonb;
  v_mm_id uuid;
  v_mm_line uuid;
  v_new_line uuid;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;
  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_bl FROM public.inventory_stock_block_lines
  WHERE id = p_block_line_id AND organization_id = p_organization_id AND branch_id = p_branch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Block not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_destination_location_id IS NULL OR p_destination_location_id = v_bl.location_id OR NOT EXISTS (
    SELECT 1 FROM public.warehouse_locations
    WHERE id = p_destination_location_id AND organization_id = p_organization_id AND branch_id = p_branch_id
      AND can_store_inventory = true AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Destination is not a valid stock location of this branch' USING ERRCODE = '22023';
  END IF;

  SELECT p.base_unit_id INTO v_unit
  FROM public.inventory_variants v JOIN public.inventory_products p ON p.id = v.product_id
  WHERE v.id = v_bl.variant_id;

  -- Off B here, MM, back into B there: the part is never available on the way.
  PERFORM public.inventory_stock_block_take_internal(v_bl.id, p_quantity, 'moved');
  v_mm := public.inventory_create_and_finalize(
    p_organization_id, p_branch_id, '801',
    jsonb_build_array(jsonb_build_object(
      'variant_id', v_bl.variant_id, 'unit_id', v_unit, 'quantity', p_quantity,
      'source_location_id', v_bl.location_id, 'destination_location_id', p_destination_location_id, 'note', NULL)),
    NULL, NULL, NULL, NULL, NULL, NULL, p_actor_user_id);
  v_mm_id := (v_mm->>'movement_id')::uuid;
  SELECT id INTO v_mm_line FROM public.inventory_movement_lines WHERE movement_id = v_mm_id ORDER BY line_number LIMIT 1;

  v_new_line := public.inventory_stock_block_add_line_internal(
    v_bl.block_id, v_bl.variant_id, p_destination_location_id, p_quantity, NULL, v_bl.id);
  PERFORM public.inventory_stock_block_log_internal(
    v_bl.id, 'moved', p_quantity, p_destination_location_id, v_mm_id, v_mm_line, NULL,
    'Przeniesienie ' || COALESCE(v_mm->>'document_number', ''), p_actor_user_id);
  PERFORM public.inventory_stock_block_refresh_status_internal(v_bl.block_id);

  RETURN jsonb_build_object(
    'block_line_id', v_new_line, 'movement_id', v_mm_id, 'document_number', v_mm->>'document_number',
    'quantity', p_quantity);
END;
$function$;

-- Blocked stock leaves: 122 return to supplier / 551 scrapping.
CREATE OR REPLACE FUNCTION public.inventory_issue_blocked_stock(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_kind text,
  p_lines jsonb,
  p_reason text,
  p_counterparty_name text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_code text;
  v_type_id uuid;
  v_event text;
  v_movement_id uuid := gen_random_uuid();
  v_line jsonb;
  v_index integer := 0;
  v_bl public.inventory_stock_block_lines%ROWTYPE;
  v_qty numeric;
  v_unit uuid;
  v_meta jsonb := '[]'::jsonb;
  v_posted jsonb;
  v_ml_ids uuid[];
  v_i integer;
  v_blocks uuid[] := ARRAY[]::uuid[];
  v_b uuid;
  v_reason text := NULLIF(trim(p_reason), '');
  v_block_ref uuid;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;
  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;
  IF p_kind = 'return_to_supplier' THEN
    v_code := '122'; v_event := 'returned_to_supplier';
  ELSIF p_kind = 'scrap' THEN
    v_code := '551'; v_event := 'scrapped';
  ELSE
    RAISE EXCEPTION 'Kind must be return_to_supplier or scrap' USING ERRCODE = '22023';
  END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A reason is required' USING ERRCODE = '22023';
  END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one line is required' USING ERRCODE = '22023';
  END IF;

  PERFORM public.inventory_ensure_blocked_stock_types_internal(p_organization_id);
  SELECT id INTO v_type_id FROM public.inventory_movement_types
  WHERE organization_id = p_organization_id AND code = v_code AND deleted_at IS NULL;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  -- System document (not available for manual entry): written here and
  -- posted by the engine, like a reversal.
  INSERT INTO public.inventory_movement_headers (
    id, organization_id, branch_id, movement_type_id, movement_type_code,
    status, reference_type, counterparty_name, note, created_by
  ) VALUES (
    v_movement_id, p_organization_id, p_branch_id, v_type_id, v_code,
    'draft', 'stock_block', NULLIF(trim(p_counterparty_name), ''), v_reason, p_actor_user_id
  );

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_index := v_index + 1;
    SELECT * INTO v_bl FROM public.inventory_stock_block_lines
    WHERE id = NULLIF(v_line->>'block_line_id', '')::uuid
      AND organization_id = p_organization_id AND branch_id = p_branch_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Line %: block not found', v_index USING ERRCODE = 'P0002';
    END IF;
    v_qty := COALESCE(NULLIF(v_line->>'quantity', '')::numeric,
                      v_bl.blocked_quantity - v_bl.unblocked_quantity - v_bl.moved_quantity - v_bl.consumed_quantity);

    -- B down first, so the posting may take exactly this quantity.
    PERFORM public.inventory_stock_block_take_internal(v_bl.id, v_qty, 'consumed');

    SELECT p.base_unit_id INTO v_unit
    FROM public.inventory_variants v JOIN public.inventory_products p ON p.id = v.product_id
    WHERE v.id = v_bl.variant_id;

    INSERT INTO public.inventory_movement_lines (
      id, movement_id, organization_id, branch_id, line_number, variant_id, unit_id, quantity,
      source_location_id, destination_location_id, note)
    VALUES (
      gen_random_uuid(), v_movement_id, p_organization_id, p_branch_id, v_index, v_bl.variant_id, v_unit, v_qty,
      v_bl.location_id, NULL, NULL);

    v_meta := v_meta || jsonb_build_array(jsonb_build_object('block_line_id', v_bl.id, 'quantity', v_qty));
    v_blocks := array_append(v_blocks, v_bl.block_id);
    v_block_ref := COALESCE(v_block_ref, v_bl.block_id);
  END LOOP;

  UPDATE public.inventory_movement_headers SET reference_id = v_block_ref::text WHERE id = v_movement_id;

  v_posted := public.inventory_finalize_posting_internal(v_movement_id, p_actor_user_id, NULL);

  SELECT array_agg(id ORDER BY line_number) INTO v_ml_ids
  FROM public.inventory_movement_lines WHERE movement_id = v_movement_id;

  FOR v_i IN 1..jsonb_array_length(v_meta)
  LOOP
    PERFORM public.inventory_stock_block_log_internal(
      (v_meta->(v_i - 1)->>'block_line_id')::uuid, v_event, (v_meta->(v_i - 1)->>'quantity')::numeric,
      NULL, v_movement_id, v_ml_ids[v_i], NULL,
      COALESCE(v_posted->>'document_number', '') || ': ' || v_reason, p_actor_user_id);
  END LOOP;

  FOREACH v_b IN ARRAY v_blocks LOOP
    PERFORM public.inventory_stock_block_refresh_status_internal(v_b);
  END LOOP;

  RETURN jsonb_build_object(
    'movement_id', v_movement_id, 'document_number', v_posted->>'document_number',
    'movement_type_code', v_code, 'line_count', v_index);
END;
$function$;

-- Grants -------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.inventory_ensure_blocked_stock_types_internal(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inventory_next_document_number_internal(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inventory_stock_block_log_internal(uuid, text, numeric, uuid, uuid, uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inventory_stock_block_refresh_status_internal(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inventory_stock_block_add_line_internal(uuid, uuid, uuid, numeric, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inventory_stock_block_take_internal(uuid, numeric, text) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.inventory_block_stock(uuid, uuid, uuid, jsonb, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_block_stock(uuid, uuid, uuid, jsonb, text, text, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.inventory_unblock_stock(uuid, uuid, uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_unblock_stock(uuid, uuid, uuid, jsonb, text) TO authenticated;
REVOKE ALL ON FUNCTION public.inventory_move_blocked_stock(uuid, uuid, uuid, uuid, numeric, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_move_blocked_stock(uuid, uuid, uuid, uuid, numeric, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.inventory_issue_blocked_stock(uuid, uuid, uuid, text, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_issue_blocked_stock(uuid, uuid, uuid, text, jsonb, text, text) TO authenticated;
