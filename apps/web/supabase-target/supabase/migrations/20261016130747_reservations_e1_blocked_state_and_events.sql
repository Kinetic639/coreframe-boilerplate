-- ============================================================================
-- Reservations & blocks, stage E1 (docs/RESERVATIONS_BLOCKS_PLAN.md)
-- ============================================================================
-- Stock states per location: D (available) / R (reserved + allocated) /
-- B (blocked). on_hand = D + R + B and D may never go below zero.
--
-- 1. inventory_balances.blocked (existing, unused, all zero) becomes the B
--    quantity: non-negative, part of available_quantity, a commitment change
--    for the balance guard, and counted by the posting engine's
--    "would strand committed stock" check.
-- 2. Hard invariant D >= 0 on every balance row.
-- 3. Reservation lines name their repair-order line, the movement line that
--    produced them and the line they were moved from.
-- 4. inventory_reservation_events: append-only history of every reservation
--    change.
-- Additive only: no DROP. Existing flows behave exactly as before (B is 0).
-- ============================================================================

-- 1. B -------------------------------------------------------------------------

ALTER TABLE public.inventory_balances
  ADD CONSTRAINT inventory_balances_blocked_nonnegative CHECK (blocked >= 0);

ALTER TABLE public.inventory_balances
  ALTER COLUMN available_quantity
  SET EXPRESSION AS (on_hand_quantity - reserved_quantity - allocated_quantity - blocked);

COMMENT ON COLUMN public.inventory_balances.blocked IS
  'B: quantity blocked at this location (quality check, complaint, damage...). Not available to anyone; changed only by the block engine.';
COMMENT ON COLUMN public.inventory_balances.available_quantity IS
  'D: on_hand - reserved - allocated - blocked. Never negative.';

-- 2. D >= 0 --------------------------------------------------------------------

ALTER TABLE public.inventory_balances
  ADD CONSTRAINT inventory_balances_available_nonnegative
  CHECK (on_hand_quantity - reserved_quantity - allocated_quantity - blocked >= 0);

-- Balance guard: blocked is a commitment field like reserved/allocated.
CREATE OR REPLACE FUNCTION public.inventory_guard_balance_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_engine_on boolean;
  v_on_hand_changed boolean;
  v_reserved_changed boolean;
  v_allocated_changed boolean;
  v_blocked_changed boolean;
  v_other_changed boolean;
BEGIN
  v_engine_on := COALESCE(current_setting('ambra.inventory_movement_engine', true), 'off') = 'on';

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'inventory_balances rows cannot be deleted' USING ERRCODE = '42501';
  END IF;

  IF NOT v_engine_on THEN
    RAISE EXCEPTION 'inventory_balances can only be changed by the movement engine' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.on_hand_quantity, 0) <> 0
       OR COALESCE(NEW.reserved_quantity, 0) <> 0
       OR COALESCE(NEW.allocated_quantity, 0) <> 0
       OR COALESCE(NEW.blocked, 0) <> 0 THEN
      RAISE EXCEPTION 'inventory_balances rows must be created with zero quantities' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- TG_OP = 'UPDATE'
  v_on_hand_changed := NEW.on_hand_quantity IS DISTINCT FROM OLD.on_hand_quantity;
  v_reserved_changed := NEW.reserved_quantity IS DISTINCT FROM OLD.reserved_quantity;
  v_allocated_changed := NEW.allocated_quantity IS DISTINCT FROM OLD.allocated_quantity;
  v_blocked_changed := NEW.blocked IS DISTINCT FROM OLD.blocked;

  v_other_changed := (to_jsonb(NEW) - ARRAY[
    'on_hand_quantity', 'reserved_quantity', 'allocated_quantity', 'blocked',
    'available_quantity', 'last_movement_id', 'last_movement_at', 'updated_at'
  ]) <> (to_jsonb(OLD) - ARRAY[
    'on_hand_quantity', 'reserved_quantity', 'allocated_quantity', 'blocked',
    'available_quantity', 'last_movement_id', 'last_movement_at', 'updated_at'
  ]);

  IF v_other_changed THEN
    RAISE EXCEPTION 'inventory_balances update touches a column the movement engine never changes' USING ERRCODE = '42501';
  END IF;

  -- A genuine no-op is harmless regardless of shape.
  IF NOT v_on_hand_changed AND NOT v_reserved_changed AND NOT v_allocated_changed AND NOT v_blocked_changed THEN
    RETURN NEW;
  END IF;

  IF v_on_hand_changed THEN
    IF v_reserved_changed OR v_allocated_changed OR v_blocked_changed THEN
      RAISE EXCEPTION 'inventory_balances update may not combine a physical change with a commitment change' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- Reached only if reserved / allocated / blocked changed (on_hand did not).
  RETURN NEW;
END;
$function$;

-- Posting engine: committed stock now includes B.
CREATE OR REPLACE FUNCTION public.inventory_finalize_posting_internal(p_movement_id uuid, p_actor_user_id uuid DEFAULT NULL::uuid, p_explicit_effects jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_header RECORD;
  v_mvt_type RECORD;
  v_settings RECORD;
  v_seq RECORD;
  v_doc_number text;
  v_line RECORD;
  v_effect RECORD;
  v_location_id uuid;
  v_balance inventory_balances%ROWTYPE;
  v_current_qty numeric;
  v_new_qty numeric;
  v_now timestamptz := now();
  v_year integer := extract(year from v_now)::integer;
BEGIN
  SET LOCAL ambra.inventory_movement_engine = 'on';

  SELECT * INTO v_header FROM inventory_movement_headers
  WHERE id = p_movement_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movement not found';
  END IF;

  -- IC-7A: actor-identity + permission check, added this pass. Runs
  -- BEFORE any status-based branching so an unauthorized caller cannot
  -- distinguish "posted"/"draft"/"not found" from a permission denial.
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  IF NOT (
    public.has_branch_permission(v_header.organization_id, v_header.branch_id, 'warehouse.inventory.operate')
    OR public.has_branch_permission(v_header.organization_id, v_header.branch_id, 'warehouse.inventory.adjust')
  ) THEN
    RAISE EXCEPTION 'Not authorized to post inventory movements for this branch' USING ERRCODE = '42501';
  END IF;

  -- Defense in depth: explicit effects may ONLY ever apply to the system
  -- reversal type. The movement's own real type_code is read from the
  -- locked row itself, never trusted from any caller-supplied value.
  IF p_explicit_effects IS NOT NULL AND v_header.movement_type_code <> '900' THEN
    RAISE EXCEPTION 'Explicit effects are only permitted for system reversal movements (type 900)' USING ERRCODE = '42501';
  END IF;

  IF v_header.status = 'posted' THEN
    RETURN jsonb_build_object(
      'movement_id', v_header.id,
      'document_number', v_header.document_number,
      'status', 'posted'
    );
  END IF;

  IF v_header.status != 'draft' THEN
    RAISE EXCEPTION 'Cannot post movement with status "%"', v_header.status;
  END IF;

  SELECT mt.*, dt.code AS doc_type_code, dt.numbering_template, dt.id AS dt_id
  INTO v_mvt_type
  FROM inventory_movement_types mt
  JOIN inventory_document_types dt ON dt.id = mt.document_type_id
  WHERE mt.id = v_header.movement_type_id;

  SELECT * INTO v_settings FROM inventory_settings
  WHERE organization_id = v_header.organization_id FOR UPDATE;

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

  UPDATE inventory_document_sequences
  SET next_number = next_number + 1
  WHERE id = v_seq.id;

  -- Freeze line snapshots using subqueries instead of JOIN on target table
  UPDATE inventory_movement_lines SET
    snapshot_product_name = (
      SELECT p.name FROM inventory_variants v
      JOIN inventory_products p ON p.id = v.product_id AND p.organization_id = v.organization_id
      WHERE v.id = inventory_movement_lines.variant_id AND v.organization_id = inventory_movement_lines.organization_id
    ),
    snapshot_sku = (
      SELECT v.sku FROM inventory_variants v
      WHERE v.id = inventory_movement_lines.variant_id AND v.organization_id = inventory_movement_lines.organization_id
    ),
    snapshot_unit_code = (
      SELECT u.code FROM inventory_units u
      WHERE u.id = inventory_movement_lines.unit_id AND u.organization_id = inventory_movement_lines.organization_id
    ),
    snapshot_source_location_name = (
      SELECT wl.name FROM warehouse_locations wl
      WHERE wl.id = inventory_movement_lines.source_location_id
    ),
    snapshot_destination_location_name = (
      SELECT wl.name FROM warehouse_locations wl
      WHERE wl.id = inventory_movement_lines.destination_location_id
    )
  WHERE movement_id = p_movement_id AND deleted_at IS NULL;

  -- Apply effects per line
  FOR v_line IN
    SELECT * FROM inventory_movement_lines
    WHERE movement_id = p_movement_id AND deleted_at IS NULL
    ORDER BY line_number
  LOOP
    FOR v_effect IN
      SELECT id, target, balance_field, direction, effect_order, is_required
      FROM inventory_movement_type_effects
      WHERE movement_type_id = v_header.movement_type_id AND p_explicit_effects IS NULL
      UNION ALL
      SELECT
        (e->>'id')::uuid,
        (e->>'target')::text,
        (e->>'balance_field')::text,
        (e->>'direction')::text,
        (e->>'effect_order')::integer,
        COALESCE((e->>'is_required')::boolean, true)
      FROM jsonb_array_elements(COALESCE(p_explicit_effects -> v_line.line_number::text, '[]'::jsonb)) e
      WHERE p_explicit_effects IS NOT NULL
      ORDER BY effect_order
    LOOP
      -- Defense in depth: reject any effect whose target/direction is not
      -- exactly one of the supported domain values, rather than silently
      -- defaulting via the fallthrough branches below.
      IF v_effect.target NOT IN ('source', 'destination') THEN
        RAISE EXCEPTION 'Invalid effect target "%" for line %', v_effect.target, v_line.line_number;
      END IF;
      IF v_effect.direction NOT IN ('increase', 'decrease') THEN
        RAISE EXCEPTION 'Invalid effect direction "%" for line %', v_effect.direction, v_line.line_number;
      END IF;

      IF v_effect.target = 'source' THEN
        v_location_id := v_line.source_location_id;
      ELSE
        v_location_id := v_line.destination_location_id;
      END IF;

      IF v_location_id IS NULL AND v_effect.is_required THEN
        RAISE EXCEPTION 'Line %: % location required for effect but is NULL',
          v_line.line_number, v_effect.target;
      END IF;

      IF v_location_id IS NULL THEN
        CONTINUE;
      END IF;

      v_balance := inventory_get_or_create_balance_for_update(
        v_header.organization_id, v_header.branch_id, v_location_id, v_line.variant_id, p_movement_id,
        NULL::uuid, NULL::uuid
      );

      IF v_effect.balance_field = 'on_hand' THEN
        v_current_qty := v_balance.on_hand_quantity;
      ELSE
        RAISE EXCEPTION 'v1 only supports on_hand balance field, got %', v_effect.balance_field;
      END IF;

      IF v_effect.direction = 'increase' THEN
        v_new_qty := v_current_qty + v_line.quantity;
      ELSE
        v_new_qty := v_current_qty - v_line.quantity;
      END IF;

      -- Committed stock = R (reserved + allocated) + B (blocked). A decrease
      -- may only take D.
      IF v_effect.balance_field = 'on_hand' AND v_effect.direction = 'decrease' THEN
        IF v_new_qty < (v_balance.reserved_quantity + v_balance.allocated_quantity + v_balance.blocked) THEN
          RAISE EXCEPTION 'Movement would strand committed stock: variant % has % reserved + % allocated + % blocked = % committed at this location, but only % would remain on hand (line %)',
            v_line.variant_id, v_balance.reserved_quantity, v_balance.allocated_quantity, v_balance.blocked,
            (v_balance.reserved_quantity + v_balance.allocated_quantity + v_balance.blocked), v_new_qty, v_line.line_number
            USING ERRCODE = 'P0003';
        END IF;
      END IF;

      UPDATE inventory_balances
      SET on_hand_quantity = v_new_qty,
          last_movement_id = p_movement_id,
          last_movement_at = v_now,
          updated_at = v_now
      WHERE id = v_balance.id;

      INSERT INTO inventory_stock_ledger_entries (
        organization_id, branch_id, location_id, variant_id,
        movement_id, movement_line_id, movement_type_code,
        document_number, document_type_code,
        effect_id, balance_field, direction,
        quantity, balance_after,
        unit_cost, currency, posted_at
      ) VALUES (
        v_header.organization_id, v_header.branch_id, v_location_id, v_line.variant_id,
        p_movement_id, v_line.id, v_header.movement_type_code,
        v_doc_number, v_mvt_type.doc_type_code,
        v_effect.id, v_effect.balance_field, v_effect.direction,
        v_line.quantity, v_new_qty,
        v_line.unit_cost, v_line.currency, v_now
      );
    END LOOP;
  END LOOP;

  UPDATE inventory_movement_headers SET
    status = 'posted',
    document_number = v_doc_number,
    document_type_code = v_mvt_type.doc_type_code,
    posted_at = v_now,
    posted_by = p_actor_user_id,
    updated_at = v_now
  WHERE id = p_movement_id;

  INSERT INTO inventory_movement_audit_log (
    organization_id, movement_id, action, old_status, new_status,
    entity_type, entity_id, actor_user_id,
    changes, transaction_id
  ) VALUES (
    v_header.organization_id, p_movement_id, 'posted', 'draft', 'posted',
    'header', p_movement_id, p_actor_user_id,
    jsonb_build_object('document_number', v_doc_number),
    txid_current()::text
  );

  RETURN jsonb_build_object(
    'movement_id', p_movement_id,
    'document_number', v_doc_number,
    'status', 'posted'
  );
END;
$function$;

-- 3. Reservation lines: repair-order line, origin, move chain -------------------

ALTER TABLE public.inventory_reservation_lines
  ADD COLUMN repair_order_line_id uuid
    REFERENCES public.repair_order_lines(id) ON DELETE SET NULL,
  ADD COLUMN source_movement_line_id uuid
    REFERENCES public.inventory_movement_lines(id) ON DELETE SET NULL,
  ADD COLUMN moved_from_line_id uuid
    REFERENCES public.inventory_reservation_lines(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.inventory_reservation_lines.repair_order_line_id IS
  'The repair-order line this quantity is reserved for (one reservation document per repair order, one line per part).';
COMMENT ON COLUMN public.inventory_reservation_lines.source_movement_line_id IS
  'The movement line that produced this reserved quantity (the PZ line, or the MM line it was moved with).';
COMMENT ON COLUMN public.inventory_reservation_lines.moved_from_line_id IS
  'The reservation line this one continues after a move (putaway MM, container relocation).';

CREATE INDEX IF NOT EXISTS inventory_reservation_lines_rol_idx
  ON public.inventory_reservation_lines (repair_order_line_id) WHERE repair_order_line_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS inventory_reservation_lines_source_ml_idx
  ON public.inventory_reservation_lines (source_movement_line_id) WHERE source_movement_line_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS inventory_reservation_lines_moved_from_idx
  ON public.inventory_reservation_lines (moved_from_line_id) WHERE moved_from_line_id IS NOT NULL;

-- Existing per-line repair-order reservations name their line.
UPDATE public.inventory_reservation_lines rl
SET repair_order_line_id = r.reference_id
FROM public.inventory_reservations r
WHERE r.id = rl.reservation_id
  AND r.reference_type = 'repair_order_line'
  AND rl.repair_order_line_id IS NULL
  AND EXISTS (SELECT 1 FROM public.repair_order_lines rol WHERE rol.id = r.reference_id);

-- 4. Reservation history (append-only) -----------------------------------------

CREATE TABLE IF NOT EXISTS public.inventory_reservation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL REFERENCES public.inventory_reservations(id) ON DELETE CASCADE,
  reservation_line_id uuid REFERENCES public.inventory_reservation_lines(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('created', 'moved', 'allocated', 'issued', 'released', 'transferred')),
  quantity numeric(18, 6) NOT NULL CHECK (quantity > 0),
  location_id uuid REFERENCES public.warehouse_locations(id) ON DELETE CASCADE,
  to_location_id uuid REFERENCES public.warehouse_locations(id) ON DELETE CASCADE,
  repair_order_line_id uuid REFERENCES public.repair_order_lines(id) ON DELETE CASCADE,
  to_repair_order_line_id uuid REFERENCES public.repair_order_lines(id) ON DELETE CASCADE,
  movement_id uuid REFERENCES public.inventory_movement_headers(id) ON DELETE CASCADE,
  movement_line_id uuid REFERENCES public.inventory_movement_lines(id) ON DELETE CASCADE,
  block_id uuid,
  reason text,
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.inventory_reservation_events IS
  'Append-only history of every reservation change: created (from PZ / from stock / migration), moved (MM), allocated (container), issued (RW), released (manual / PZ reversal / PZ correction / order close / block), transferred (to another repair order). Written only by engine functions.';

CREATE INDEX IF NOT EXISTS inventory_reservation_events_reservation_idx
  ON public.inventory_reservation_events (reservation_id, created_at);
CREATE INDEX IF NOT EXISTS inventory_reservation_events_line_idx
  ON public.inventory_reservation_events (reservation_line_id) WHERE reservation_line_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS inventory_reservation_events_rol_idx
  ON public.inventory_reservation_events (repair_order_line_id) WHERE repair_order_line_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS inventory_reservation_events_branch_time_idx
  ON public.inventory_reservation_events (organization_id, branch_id, created_at DESC);

-- Rows never change. Deletes are refused by RLS (no policy); only cascades
-- from a demo-org reset remove them.
CREATE OR REPLACE FUNCTION public.inventory_reservation_events_no_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'Reservation history is append-only. Cannot % reservation events.', TG_OP
    USING ERRCODE = '42501';
END;
$function$;

CREATE TRIGGER inventory_reservation_events_no_update
  BEFORE UPDATE ON public.inventory_reservation_events
  FOR EACH ROW EXECUTE FUNCTION public.inventory_reservation_events_no_update();

ALTER TABLE public.inventory_reservation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_reservation_events_select ON public.inventory_reservation_events
  FOR SELECT TO authenticated
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read'));

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.inventory_reservation_events FROM anon, authenticated;
REVOKE ALL ON public.inventory_reservation_events FROM anon;
GRANT SELECT ON public.inventory_reservation_events TO authenticated;
