-- ============================================================================
-- Transfers between units: MMJ- / MMJ+ (as in AutoStacja)
-- ============================================================================
-- Decided with the product owner 2026-10-28 (docs/INTERNAL_ORDERS_PLAN.md):
-- * A move to another unit (jednostka, i.e. another branch in Ambra) is two
--   linked documents: MMJ- (code 303, issue from the sender) and MMJ+ (code
--   305, receipt at the receiver). A move inside a unit stays a plain MM.
-- * "Nie — wstrzymaj": a draft -- parts reserved at the sender, no number,
--   the receiver sees nothing. "Tak — wyślij w drogę": in transit -- the
--   parts stay on the sender's stock, still reserved; both documents show
--   as "w drodze" without a number. The sender may withdraw it until it is
--   accepted. The receiver can only accept, always in full.
-- * Accepting posts both documents in one go: the parts leave the sender
--   (MMJ-) and land in the receiver's receiving zone (MMJ+). Only then both
--   get numbers, AutoStacja-style: MMJ-/<no>/<yy>/<unit> per unit and year.
-- Movement types 311 / 312 (the previous one-way flow, posted on send) are
-- switched off; new transfers no longer use them.
-- ============================================================================

-- 1. Numbering with the unit --------------------------------------------------
-- A document type whose template holds {unit} is numbered per unit and year
-- (inventory_document_sequences.series = unit) when the posting names the
-- unit in ambra.document_unit. Every other document numbers as before.

DO $do$
DECLARE
  v_def text;
  v_new text;
BEGIN
  v_def := pg_get_functiondef('public.inventory_finalize_posting_internal(uuid, uuid, jsonb)'::regprocedure);
  v_new := replace(v_def, $a$  v_doc_number text;
$a$, $b$  v_doc_number text;
  v_unit text;
$b$);
  v_new := replace(v_new, $a$  INSERT INTO inventory_document_sequences (organization_id, document_type_id, year)
  VALUES (v_header.organization_id, v_mvt_type.dt_id, v_year)
  ON CONFLICT DO NOTHING;

  SELECT * INTO v_seq FROM inventory_document_sequences
  WHERE organization_id = v_header.organization_id
    AND document_type_id = v_mvt_type.dt_id
    AND branch_id IS NULL
    AND series IS NULL
    AND year = v_year
  FOR UPDATE;

  v_doc_number := v_mvt_type.doc_type_code || '/' || v_year::text || '/' || lpad(v_seq.next_number::text, 6, '0');$a$,
  $b$  v_unit := NULLIF(current_setting('ambra.document_unit', true), '');
  IF v_unit IS NOT NULL AND COALESCE(v_mvt_type.numbering_template, '') LIKE '%{unit}%' THEN
    -- Numbered per unit and year: MMJ-/41/26/3252.
    INSERT INTO inventory_document_sequences (organization_id, document_type_id, year, series)
    VALUES (v_header.organization_id, v_mvt_type.dt_id, v_year, v_unit)
    ON CONFLICT DO NOTHING;

    SELECT * INTO v_seq FROM inventory_document_sequences
    WHERE organization_id = v_header.organization_id
      AND document_type_id = v_mvt_type.dt_id
      AND branch_id IS NULL
      AND series = v_unit
      AND year = v_year
    FOR UPDATE;

    v_doc_number := replace(replace(replace(v_mvt_type.numbering_template,
      '{seq}', v_seq.next_number::text),
      '{yy}', lpad((v_year % 100)::text, 2, '0')),
      '{unit}', v_unit);
  ELSE
  INSERT INTO inventory_document_sequences (organization_id, document_type_id, year)
  VALUES (v_header.organization_id, v_mvt_type.dt_id, v_year)
  ON CONFLICT DO NOTHING;

  SELECT * INTO v_seq FROM inventory_document_sequences
  WHERE organization_id = v_header.organization_id
    AND document_type_id = v_mvt_type.dt_id
    AND branch_id IS NULL
    AND series IS NULL
    AND year = v_year
  FOR UPDATE;

  v_doc_number := v_mvt_type.doc_type_code || '/' || v_year::text || '/' || lpad(v_seq.next_number::text, 6, '0');
  END IF;$b$);
  -- Accepting an MMJ+ also posts the sender's MMJ-: the acceptor acts for
  -- the sending branch only inside that operation (set by the accept RPC
  -- after its own checks, for exactly that branch).
  v_new := replace(v_new, $a$  IF NOT (
    public.has_branch_permission(v_header.organization_id, v_header.branch_id, 'warehouse.inventory.operate')
    OR public.has_branch_permission(v_header.organization_id, v_header.branch_id, 'warehouse.inventory.adjust')
  ) THEN
    RAISE EXCEPTION 'Not authorized to post inventory movements for this branch' USING ERRCODE = '42501';$a$,
  $b$  IF NOT (
    public.has_branch_permission(v_header.organization_id, v_header.branch_id, 'warehouse.inventory.operate')
    OR public.has_branch_permission(v_header.organization_id, v_header.branch_id, 'warehouse.inventory.adjust')
    OR (v_header.movement_type_code = '303'
        AND current_setting('ambra.transfer_accept_branch', true) = v_header.branch_id::text)
  ) THEN
    RAISE EXCEPTION 'Not authorized to post inventory movements for this branch' USING ERRCODE = '42501';$b$);
  IF position('v_unit := NULLIF(current_setting' in v_new) = 0
     OR position('ambra.transfer_accept_branch' in v_new) = 0 THEN
    RAISE EXCEPTION 'finalize patch did not apply';
  END IF;
  EXECUTE v_new;
END
$do$;

-- 2. Document and movement types ----------------------------------------------

CREATE OR REPLACE FUNCTION public.inventory_ensure_unit_transfer_types_internal(p_organization_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_out_doc uuid;
  v_in_doc uuid;
  v_out_type uuid;
  v_in_type uuid;
BEGIN
  INSERT INTO public.inventory_document_types (
    organization_id, code, name, name_pl, name_en, category, numbering_template, is_system
  ) VALUES
    (p_organization_id, 'MMJ-', 'Transfer to another unit — issue', 'Przesunięcie do innej jednostki — wydanie',
     'Transfer to another unit — issue', 'transfer', 'MMJ-/{seq}/{yy}/{unit}', true),
    (p_organization_id, 'MMJ+', 'Transfer from another unit — receipt', 'Przesunięcie z innej jednostki — przyjęcie',
     'Transfer from another unit — receipt', 'transfer', 'MMJ+/{seq}/{yy}/{unit}', true)
  ON CONFLICT (organization_id, code) WHERE deleted_at IS NULL DO NOTHING;

  SELECT id INTO v_out_doc FROM public.inventory_document_types
  WHERE organization_id = p_organization_id AND code = 'MMJ-' AND deleted_at IS NULL;
  SELECT id INTO v_in_doc FROM public.inventory_document_types
  WHERE organization_id = p_organization_id AND code = 'MMJ+' AND deleted_at IS NULL;

  INSERT INTO public.inventory_movement_types (
    organization_id, code, document_type_id, name, name_pl, name_en, category,
    requires_source_location, requires_destination_location, cost_impact, is_system, allows_manual_entry
  ) VALUES
    (p_organization_id, '303', v_out_doc, 'Transfer to another unit — issue (MMJ-)',
     'Przesunięcie do innej jednostki — wydanie (MMJ-)', 'Transfer to another unit — issue (MMJ-)', 'transfer',
     true, false, 'neutral', true, false),
    (p_organization_id, '305', v_in_doc, 'Transfer from another unit — receipt (MMJ+)',
     'Przesunięcie z innej jednostki — przyjęcie (MMJ+)', 'Transfer from another unit — receipt (MMJ+)', 'transfer',
     false, true, 'neutral', true, false)
  ON CONFLICT (organization_id, code) WHERE deleted_at IS NULL DO NOTHING;

  SELECT id INTO v_out_type FROM public.inventory_movement_types
  WHERE organization_id = p_organization_id AND code = '303' AND deleted_at IS NULL;
  SELECT id INTO v_in_type FROM public.inventory_movement_types
  WHERE organization_id = p_organization_id AND code = '305' AND deleted_at IS NULL;

  INSERT INTO public.inventory_movement_type_effects (
    movement_type_id, effect_order, target, balance_field, direction, is_required, description
  ) VALUES
    (v_out_type, 1, 'source', 'on_hand', 'decrease', true, 'MMJ-: the parts leave the sending unit'),
    (v_in_type, 1, 'destination', 'on_hand', 'increase', true, 'MMJ+: the parts arrive at the receiving unit')
  ON CONFLICT (movement_type_id, effect_order) DO NOTHING;

  -- The earlier one-way transfer types are no longer offered.
  UPDATE public.inventory_movement_types SET is_active = false
  WHERE organization_id = p_organization_id AND code IN ('311', '312') AND deleted_at IS NULL AND is_active;
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_ensure_unit_transfer_types_internal(uuid) FROM PUBLIC, anon, authenticated;

DO $do$
DECLARE
  v_org uuid;
BEGIN
  FOR v_org IN SELECT id FROM public.organizations LOOP
    PERFORM public.inventory_ensure_unit_transfer_types_internal(v_org);
  END LOOP;
END
$do$;

-- 3. The units of a transfer ------------------------------------------------------

ALTER TABLE public.inventory_branch_transfers
  ADD COLUMN IF NOT EXISTS source_unit_code text,
  ADD COLUMN IF NOT EXISTS destination_unit_code text;

-- A branch's unit for numbering: the chosen one, else its first warehouse,
-- else the unit of its latest ZW / repair order, else its branch number.
CREATE OR REPLACE FUNCTION public.inventory_branch_unit_code_internal(p_organization_id uuid, p_branch_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(
    (SELECT code FROM public.branch_warehouses
     WHERE organization_id = p_organization_id AND branch_id = p_branch_id AND deleted_at IS NULL
     ORDER BY created_at LIMIT 1),
    (SELECT warehouse_code FROM public.internal_orders
     WHERE organization_id = p_organization_id AND branch_id = p_branch_id
     ORDER BY created_at DESC LIMIT 1),
    (SELECT warehouse_code FROM public.repair_orders
     WHERE organization_id = p_organization_id AND branch_id = p_branch_id
       AND deleted_at IS NULL AND NULLIF(warehouse_code, '') IS NOT NULL
     ORDER BY created_at DESC LIMIT 1),
    (SELECT branch_number::text FROM public.branches WHERE id = p_branch_id));
$function$;

REVOKE ALL ON FUNCTION public.inventory_branch_unit_code_internal(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 4. Send: in transit, still reserved at the sender (nothing posted) ---------------

CREATE OR REPLACE FUNCTION public.inventory_send_branch_transfer(p_transfer_id uuid, p_actor_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_transfer public.inventory_branch_transfers%ROWTYPE;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_transfer FROM public.inventory_branch_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Branch transfer not found or not accessible' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (
    public.has_branch_permission(v_transfer.organization_id, v_transfer.source_branch_id, 'warehouse.inventory.operate')
    OR public.has_branch_permission(v_transfer.organization_id, v_transfer.source_branch_id, 'warehouse.inventory.adjust')
  ) THEN
    RAISE EXCEPTION 'Branch transfer not found or not accessible' USING ERRCODE = 'P0002';
  END IF;
  IF v_transfer.status <> 'prepared' THEN
    RAISE EXCEPTION 'Only prepared transfers can be sent (status=%)', v_transfer.status USING ERRCODE = 'P0007';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.inventory_branch_transfer_lines WHERE transfer_id = v_transfer.id) THEN
    RAISE EXCEPTION 'Transfer has no lines to send' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.inventory_branch_transfer_lines SET sent_quantity = quantity WHERE transfer_id = v_transfer.id;
  UPDATE public.inventory_branch_transfers
  SET status = 'in_transit',
      sent_by = p_actor_user_id,
      sent_at = now(),
      source_unit_code = COALESCE(source_unit_code,
        public.inventory_branch_unit_code_internal(organization_id, source_branch_id)),
      destination_unit_code = COALESCE(destination_unit_code,
        public.inventory_branch_unit_code_internal(organization_id, destination_branch_id)),
      updated_at = now()
  WHERE id = v_transfer.id;

  RETURN jsonb_build_object(
    'transfer_id', v_transfer.id,
    'transfer_number', v_transfer.transfer_number,
    'status', 'in_transit',
    'source_movement_id', NULL,
    'source_document_number', NULL);
END;
$function$;

-- 5. Accept: post MMJ- at the sender and MMJ+ at the receiver, in full -------------

CREATE OR REPLACE FUNCTION public.inventory_accept_branch_transfer(p_transfer_id uuid, p_destination_location_id uuid, p_actor_user_id uuid DEFAULT NULL::uuid, p_line_acceptances jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_transfer public.inventory_branch_transfers%ROWTYPE;
  v_out_type uuid;
  v_in_type uuid;
  v_out_id uuid;
  v_in_id uuid;
  v_out jsonb;
  v_in jsonb;
  v_line record;
  v_n integer := 0;
  v_res_line public.inventory_reservation_lines%ROWTYPE;
  v_remaining numeric;
  v_balance public.inventory_balances%ROWTYPE;
  v_src_unit text;
  v_dst_unit text;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_transfer FROM public.inventory_branch_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Branch transfer not found or not accessible' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (
    public.has_branch_permission(v_transfer.organization_id, v_transfer.destination_branch_id, 'warehouse.inventory.operate')
    OR public.has_branch_permission(v_transfer.organization_id, v_transfer.destination_branch_id, 'warehouse.inventory.adjust')
  ) THEN
    RAISE EXCEPTION 'Branch transfer not found or not accessible' USING ERRCODE = 'P0002';
  END IF;

  IF v_transfer.status IN ('accepted', 'partially_accepted') THEN
    RETURN jsonb_build_object(
      'transfer_id', v_transfer.id, 'transfer_number', v_transfer.transfer_number,
      'status', v_transfer.status, 'destination_movement_id', v_transfer.destination_movement_id,
      'source_movement_id', v_transfer.source_movement_id, 'already_processed', true);
  END IF;
  IF v_transfer.status <> 'in_transit' THEN
    RAISE EXCEPTION 'Only in-transit transfers can be accepted (status=%)', v_transfer.status USING ERRCODE = 'P0007';
  END IF;
  -- The receiver accepts what was sent, in full (no partial acceptance).
  IF p_line_acceptances IS NOT NULL THEN
    RAISE EXCEPTION 'A transfer is accepted in full' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.warehouse_locations
    WHERE id = p_destination_location_id AND organization_id = v_transfer.organization_id
      AND branch_id = v_transfer.destination_branch_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Destination location must belong to the destination branch';
  END IF;

  PERFORM public.inventory_ensure_unit_transfer_types_internal(v_transfer.organization_id);
  SELECT id INTO v_out_type FROM public.inventory_movement_types
  WHERE organization_id = v_transfer.organization_id AND code = '303' AND deleted_at IS NULL;
  SELECT id INTO v_in_type FROM public.inventory_movement_types
  WHERE organization_id = v_transfer.organization_id AND code = '305' AND deleted_at IS NULL;

  v_src_unit := COALESCE(v_transfer.source_unit_code,
    public.inventory_branch_unit_code_internal(v_transfer.organization_id, v_transfer.source_branch_id));
  v_dst_unit := COALESCE(v_transfer.destination_unit_code,
    public.inventory_branch_unit_code_internal(v_transfer.organization_id, v_transfer.destination_branch_id));

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  -- Sent before 2026-10-28 (the old flow posted the issue on send): the
  -- sender's stock already left; only the receipt is posted now.
  IF v_transfer.source_movement_id IS NOT NULL THEN
    v_out_id := v_transfer.source_movement_id;
    SELECT jsonb_build_object('document_number', document_number) INTO v_out
    FROM public.inventory_movement_headers WHERE id = v_out_id;
  END IF;

  -- The sender's reservation is consumed exactly once, before its stock
  -- decreases (same order as the engine's own issues).
  IF v_transfer.source_movement_id IS NULL AND v_transfer.reservation_id IS NOT NULL THEN
    FOR v_res_line IN
      SELECT * FROM public.inventory_reservation_lines
      WHERE reservation_id = v_transfer.reservation_id
      FOR UPDATE
    LOOP
      v_remaining := v_res_line.reserved_quantity - v_res_line.released_quantity - v_res_line.fulfilled_quantity;
      IF v_remaining > 0 THEN
        v_balance := public.inventory_get_or_create_balance_for_update(
          v_res_line.organization_id, v_res_line.branch_id, v_res_line.location_id,
          v_res_line.variant_id, NULL, v_res_line.lot_id, v_res_line.serial_id);
        UPDATE public.inventory_balances
        SET reserved_quantity = greatest(0, reserved_quantity - v_remaining)
        WHERE id = v_balance.id;
        UPDATE public.inventory_reservation_lines
        SET fulfilled_quantity = fulfilled_quantity + v_remaining
        WHERE id = v_res_line.id;
      END IF;
    END LOOP;
    UPDATE public.inventory_reservations SET status = 'fulfilled', updated_at = now()
    WHERE id = v_transfer.reservation_id;
  END IF;

  -- MMJ- at the sender.
  IF v_transfer.source_movement_id IS NULL THEN
  v_out_id := gen_random_uuid();
  INSERT INTO public.inventory_movement_headers (
    id, organization_id, branch_id, movement_type_id, movement_type_code,
    status, reference_type, reference_id, external_reference, idempotency_key, created_by
  ) VALUES (
    v_out_id, v_transfer.organization_id, v_transfer.source_branch_id, v_out_type, '303',
    'draft', 'branch_transfer', v_transfer.id::text, v_transfer.transfer_number,
    'branch-transfer-out-' || v_transfer.id::text, p_actor_user_id);
  v_n := 0;
  FOR v_line IN
    SELECT * FROM public.inventory_branch_transfer_lines WHERE transfer_id = v_transfer.id ORDER BY created_at, id
  LOOP
    v_n := v_n + 1;
    INSERT INTO public.inventory_movement_lines (
      movement_id, organization_id, branch_id, line_number, variant_id, unit_id, quantity,
      source_location_id, lot_id, serial_id, note
    ) VALUES (
      v_out_id, v_transfer.organization_id, v_transfer.source_branch_id, v_n, v_line.variant_id, v_line.unit_id,
      COALESCE(v_line.sent_quantity, v_line.quantity), v_line.source_location_id, v_line.lot_id, v_line.serial_id,
      'Przesunięcie ' || v_transfer.transfer_number);
  END LOOP;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'Transfer has no lines' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('ambra.document_unit', v_src_unit, true);
  PERFORM set_config('ambra.transfer_accept_branch', v_transfer.source_branch_id::text, true);
  v_out := public.inventory_finalize_posting_internal(v_out_id, p_actor_user_id, NULL);
  PERFORM set_config('ambra.transfer_accept_branch', '', true);
  END IF;

  -- MMJ+ at the receiver, naming its MMJ-.
  v_in_id := gen_random_uuid();
  INSERT INTO public.inventory_movement_headers (
    id, organization_id, branch_id, movement_type_id, movement_type_code,
    status, reference_type, reference_id, external_reference, idempotency_key, created_by
  ) VALUES (
    v_in_id, v_transfer.organization_id, v_transfer.destination_branch_id, v_in_type, '305',
    'draft', 'branch_transfer', v_transfer.id::text, v_out->>'document_number',
    'branch-transfer-in-' || v_transfer.id::text, p_actor_user_id);
  v_n := 0;
  FOR v_line IN
    SELECT * FROM public.inventory_branch_transfer_lines WHERE transfer_id = v_transfer.id ORDER BY created_at, id
  LOOP
    v_n := v_n + 1;
    INSERT INTO public.inventory_movement_lines (
      movement_id, organization_id, branch_id, line_number, variant_id, unit_id, quantity,
      destination_location_id, lot_id, serial_id, note
    ) VALUES (
      v_in_id, v_transfer.organization_id, v_transfer.destination_branch_id, v_n, v_line.variant_id, v_line.unit_id,
      COALESCE(v_line.sent_quantity, v_line.quantity), p_destination_location_id, v_line.lot_id, v_line.serial_id,
      'Przesunięcie ' || v_transfer.transfer_number);
    UPDATE public.inventory_branch_transfer_lines
    SET accepted_quantity = COALESCE(v_line.sent_quantity, v_line.quantity),
        destination_location_id = p_destination_location_id
    WHERE id = v_line.id;
  END LOOP;

  PERFORM set_config('ambra.document_unit', v_dst_unit, true);
  v_in := public.inventory_finalize_posting_internal(v_in_id, p_actor_user_id, NULL);
  PERFORM set_config('ambra.document_unit', '', true);

  UPDATE public.inventory_branch_transfers
  SET status = 'accepted',
      source_movement_id = v_out_id,
      destination_movement_id = v_in_id,
      source_unit_code = v_src_unit,
      destination_unit_code = v_dst_unit,
      accepted_by = p_actor_user_id,
      accepted_at = now(),
      updated_at = now()
  WHERE id = v_transfer.id;

  RETURN jsonb_build_object(
    'transfer_id', v_transfer.id,
    'transfer_number', v_transfer.transfer_number,
    'status', 'accepted',
    'source_movement_id', v_out_id,
    'source_document_number', v_out->>'document_number',
    'destination_movement_id', v_in_id,
    'destination_document_number', v_in->>'document_number');
END;
$function$;

-- 6. Withdraw: the sender cancels a draft or an in-transit transfer ------------------

CREATE OR REPLACE FUNCTION public.inventory_cancel_branch_transfer(p_transfer_id uuid, p_actor_user_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_transfer public.inventory_branch_transfers%ROWTYPE;
  v_line record;
  v_doc jsonb;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_transfer FROM public.inventory_branch_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Branch transfer not found or not accessible' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (
    public.has_branch_permission(v_transfer.organization_id, v_transfer.source_branch_id, 'warehouse.inventory.operate')
    OR public.has_branch_permission(v_transfer.organization_id, v_transfer.source_branch_id, 'warehouse.inventory.adjust')
  ) THEN
    RAISE EXCEPTION 'Branch transfer not found or not accessible' USING ERRCODE = 'P0002';
  END IF;
  -- Nothing is posted before acceptance, so the sender can withdraw until then.
  IF v_transfer.status NOT IN ('prepared', 'in_transit') THEN
    RAISE EXCEPTION 'Only a transfer not yet accepted can be withdrawn (status=%)', v_transfer.status
      USING ERRCODE = 'P0007';
  END IF;
  -- Sent the old way (issue posted on send): the parts already left.
  IF v_transfer.source_movement_id IS NOT NULL THEN
    RAISE EXCEPTION 'This transfer was already issued (sent before MMJ) and can only be accepted'
      USING ERRCODE = 'P0007';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);
  IF v_transfer.reservation_id IS NOT NULL THEN
    PERFORM public.inventory_release_reservation(v_transfer.reservation_id, p_actor_user_id, true);
  END IF;

  -- Parts of our own ZW that were on their way go back under the ZW.
  IF v_transfer.internal_order_id IS NOT NULL THEN
    FOR v_line IN
      SELECT tl.internal_order_line_id, tl.source_location_id, tl.quantity
      FROM public.inventory_branch_transfer_lines tl
      JOIN public.internal_order_lines iol ON iol.id = tl.internal_order_line_id
      WHERE tl.transfer_id = v_transfer.id AND iol.branch_id = v_transfer.source_branch_id
    LOOP
      IF v_doc IS NULL THEN
        v_doc := public.internal_order_reservation_doc_internal(
          p_actor_user_id, v_transfer.internal_order_id, 'Wycofanie ' || v_transfer.transfer_number);
      END IF;
      PERFORM public.internal_order_reserve_line_internal(
        p_actor_user_id, (v_doc->>'id')::uuid, v_line.internal_order_line_id, v_line.source_location_id,
        v_line.quantity, 'Wycofanie ' || v_transfer.transfer_number);
    END LOOP;
    UPDATE public.internal_orders SET status = 'open', updated_at = now()
    WHERE id = v_transfer.internal_order_id AND status = 'completed';
  END IF;

  UPDATE public.inventory_branch_transfers
  SET status = 'cancelled', cancel_reason = p_reason, cancelled_by = p_actor_user_id,
      cancelled_at = now(), updated_at = now()
  WHERE id = v_transfer.id;

  RETURN jsonb_build_object(
    'transfer_id', v_transfer.id, 'transfer_number', v_transfer.transfer_number,
    'status', 'cancelled', 'reservation_id', v_transfer.reservation_id);
END;
$function$;

-- 7. A ZW ships through the same flow -------------------------------------------------
-- internal_order_dispatch: the ZW's reservations move onto the transfer (its
-- reservation lines keep the ZW line, so R stays on the ZW until accepted;
-- then fulfilled = W). p_send = false keeps it as a draft ("wstrzymaj").
-- internal_order_ship (earlier name, same arguments but p_send) sends at once.

CREATE OR REPLACE FUNCTION public.internal_order_dispatch(
  p_actor_user_id uuid,
  p_internal_order_id uuid,
  p_destination_branch_id uuid,
  p_send boolean
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
  v_note text;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;
  SELECT id, organization_id, branch_id, order_number, external_number, repair_order_id, status, warehouse_code
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

  v_note := v_io.order_number || COALESCE(' (' || v_io.external_number || ')', '') || ' → ' || v_dest_name;

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
      AND COALESCE(r.reference_type, '') <> 'branch_transfer'
      AND rl.reserved_quantity - rl.released_quantity - rl.fulfilled_quantity > 0
    ORDER BY iol.line_number, rl.created_at
    FOR UPDATE OF rl
  LOOP
    PERFORM public.inventory_reservation_release_internal(v_rl.id, v_rl.open_qty, 'released', 'Przesunięcie ' || v_note, p_actor_user_id);
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
  UPDATE public.inventory_branch_transfers
  SET internal_order_id = v_io.id, source_unit_code = v_io.warehouse_code
  WHERE id = (v_t->>'transfer_id')::uuid;

  -- Each transfer line, and its reservation line, names its ZW line.
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
    UPDATE public.inventory_reservation_lines
    SET internal_order_line_id = (v_g->>'iol')::uuid
    WHERE id = (
      SELECT rl.id FROM public.inventory_reservation_lines rl
      WHERE rl.reservation_id = (v_t->>'reservation_id')::uuid AND rl.internal_order_line_id IS NULL
        AND rl.variant_id = (v_g->>'variant_id')::uuid
        AND rl.location_id = (v_g->>'source_location_id')::uuid
        AND rl.reserved_quantity = (v_g->>'quantity')::numeric
      LIMIT 1);
  END LOOP;

  UPDATE public.internal_orders SET destination_branch_id = v_dest, updated_at = now() WHERE id = v_io.id;

  IF p_send THEN
    PERFORM public.inventory_send_branch_transfer((v_t->>'transfer_id')::uuid, p_actor_user_id);
  END IF;

  RETURN jsonb_build_object(
    'transfer_id', v_t->>'transfer_id',
    'transfer_number', v_t->>'transfer_number',
    'status', CASE WHEN p_send THEN 'in_transit' ELSE 'prepared' END,
    'destination_branch_id', v_dest,
    'destination_branch_name', v_dest_name,
    'line_count', jsonb_array_length(v_groups));
END;
$function$;

REVOKE ALL ON FUNCTION public.internal_order_dispatch(uuid, uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_order_dispatch(uuid, uuid, uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.internal_order_ship(
  p_actor_user_id uuid,
  p_internal_order_id uuid,
  p_destination_branch_id uuid DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.internal_order_dispatch(p_actor_user_id, p_internal_order_id, p_destination_branch_id, true);
$function$;

-- 8. Accepting a ZW's transfer: W on the sender's ZW, R on the receiver's -------------

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
  SELECT id, organization_id, source_branch_id, destination_branch_id, internal_order_id, status, transfer_number
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

  SELECT io.id, io.branch_id, io.order_number INTO v_io
  FROM public.internal_orders io WHERE io.id = v_t.internal_order_id;
  IF v_io.id IS NULL THEN
    RETURN v_result;
  END IF;

  -- The sender's ZW: the shipped lines are W (their transfer reservation is
  -- fulfilled); one 'transfer_out' row per line on the MMJ- for the trail.
  IF v_io.branch_id = v_t.source_branch_id THEN
    FOR v_tl IN
      SELECT tl.internal_order_line_id, tl.variant_id, tl.source_location_id,
             COALESCE(tl.sent_quantity, tl.quantity) AS qty
      FROM public.inventory_branch_transfer_lines tl
      WHERE tl.transfer_id = p_transfer_id AND tl.internal_order_line_id IS NOT NULL
    LOOP
      SELECT ml.id INTO v_ml
      FROM public.inventory_movement_lines ml
      WHERE ml.movement_id = (v_result->>'source_movement_id')::uuid
        AND ml.variant_id = v_tl.variant_id AND ml.source_location_id = v_tl.source_location_id
        AND ml.quantity = v_tl.qty AND NOT (ml.id = ANY (v_used))
      ORDER BY ml.line_number LIMIT 1;
      IF v_ml.id IS NULL THEN CONTINUE; END IF;
      v_used := v_used || v_ml.id;
      INSERT INTO public.internal_order_line_movement_links (
        internal_order_line_id, inventory_movement_line_id, applied_quantity, relation_type)
      VALUES (v_tl.internal_order_line_id, v_ml.id, v_tl.qty, 'transfer_out')
      ON CONFLICT DO NOTHING;
    END LOOP;
    UPDATE public.internal_orders io SET status = 'completed', updated_at = now()
    WHERE io.id = v_io.id AND NOT EXISTS (
      SELECT 1 FROM public.internal_order_lines iol
      JOIN public.internal_order_line_status s ON s.internal_order_line_id = iol.id
      WHERE iol.internal_order_id = io.id AND iol.cancelled_at IS NULL
        AND s.issued_quantity < iol.quantity);
    RETURN v_result;
  END IF;

  -- The receiver's ZW (parts reserved at another branch for it): what
  -- arrived is reserved under its lines, through the repair order.
  IF v_io.branch_id <> v_t.destination_branch_id THEN
    RETURN v_result;
  END IF;
  v_used := '{}';
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
    ORDER BY ml.line_number LIMIT 1;
    IF v_ml.id IS NULL THEN CONTINUE; END IF;
    v_used := v_used || v_ml.id;

    IF v_doc IS NULL THEN
      v_doc := public.internal_order_reservation_doc_internal(
        p_actor_user_id, v_io.id, 'Przyjęcie ' || COALESCE(v_result->>'destination_document_number', v_t.transfer_number));
    END IF;
    IF v_tl.repair_order_line_id IS NOT NULL THEN
      PERFORM public.write_repair_order_line_movement_link_internal(
        v_tl.repair_order_line_id, v_ml.id, v_tl.qty, 'receipt');
    END IF;
    v_rl := public.inventory_reservation_add_line_internal(
      (v_doc->>'id')::uuid, v_tl.variant_id, v_receiving, v_tl.qty,
      v_tl.repair_order_line_id, v_ml.id, NULL, p_actor_user_id,
      'Przyjęcie ' || COALESCE(v_result->>'destination_document_number', v_t.transfer_number));
    UPDATE public.inventory_reservation_lines SET internal_order_line_id = v_tl.internal_order_line_id WHERE id = v_rl;
    INSERT INTO public.internal_order_line_movement_links (
      internal_order_line_id, inventory_movement_line_id, applied_quantity, relation_type, repair_order_line_id)
    VALUES (v_tl.internal_order_line_id, v_ml.id, v_tl.qty, 'receipt', v_tl.repair_order_line_id);
  END LOOP;

  RETURN v_result || jsonb_build_object('reservation_number', v_doc->>'number');
END;
$function$;

-- 9. W comes from fulfilled reservations only (the transfer rows are the trail) ----------

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

-- 10. Receiving zone: a ZW's parts already on their way say so ------------------------

DO $do$
DECLARE
  v_def text;
  v_new text;
BEGIN
  v_def := pg_get_functiondef('public.inventory_receiving_pending(uuid, uuid)'::regprocedure);
  v_new := replace(v_def, $a$    SELECT rl.variant_id, rl.internal_order_line_id,
      SUM(rl.reserved_quantity - rl.released_quantity - rl.fulfilled_quantity) AS qty,$a$,
  $b$    SELECT rl.variant_id, rl.internal_order_line_id,
      CASE WHEN r.reference_type = 'branch_transfer' THEN r.reference_id END AS transfer_id,
      SUM(rl.reserved_quantity - rl.released_quantity - rl.fulfilled_quantity) AS qty,$b$);
  v_new := replace(v_new, $a$    GROUP BY rl.variant_id, rl.internal_order_line_id
    HAVING$a$, $b$    GROUP BY rl.variant_id, rl.internal_order_line_id,
      CASE WHEN r.reference_type = 'branch_transfer' THEN r.reference_id END
    HAVING$b$);
  v_new := replace(v_new, $a$    SELECT a.variant_id, a.repair_order_line_id, NULL::uuid AS internal_order_line_id,
      LEAST(a.qty, s.on_hand) AS qty, a.document_number$a$, $b$    SELECT a.variant_id, a.repair_order_line_id, NULL::uuid AS internal_order_line_id,
      NULL::uuid AS transfer_id, LEAST(a.qty, s.on_hand) AS qty, a.document_number$b$);
  v_new := replace(v_new, $a$    SELECT z.variant_id, NULL::uuid, z.internal_order_line_id, LEAST(z.qty, s.on_hand), z.document_number$a$,
  $b$    SELECT z.variant_id, NULL::uuid, z.internal_order_line_id, z.transfer_id, LEAST(z.qty, s.on_hand), z.document_number$b$);
  v_new := replace(v_new, $a$    SELECT f.variant_id, NULL::uuid, NULL::uuid, f.qty, lp.document_number$a$,
  $b$    SELECT f.variant_id, NULL::uuid, NULL::uuid, NULL::uuid, f.qty, lp.document_number$b$);
  v_new := replace(v_new, $a$      'internal_order_destination', io.destination_code,$a$, $b$      'internal_order_destination', io.destination_code,
      'transfer_id', i.transfer_id,
      'transfer_number', bt.transfer_number,
      'transfer_status', bt.status,$b$);
  v_new := replace(v_new, $a$  LEFT JOIN public.internal_orders io ON io.id = iol.internal_order_id$a$,
  $b$  LEFT JOIN public.internal_orders io ON io.id = iol.internal_order_id
  LEFT JOIN public.inventory_branch_transfers bt ON bt.id = i.transfer_id$b$);
  IF position('bt.transfer_number' in v_new) = 0 OR position('z.transfer_id, LEAST' in v_new) = 0
     OR position('NULL::uuid, NULL::uuid, NULL::uuid, f.qty' in v_new) = 0 THEN
    RAISE EXCEPTION 'receiving patch did not apply';
  END IF;
  EXECUTE v_new;
END
$do$;
