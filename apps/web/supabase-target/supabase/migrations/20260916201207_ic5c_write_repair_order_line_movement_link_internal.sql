-- IC-5 CORRECTION PASS -- Finding B: repair_order_line_movement_links now
-- has THREE genuine direct writers (attach_repair_order_line_movement,
-- putaway_repair_order_stock for 'relocation', the reversal-aware trigger
-- for 'reversal') -- the documented claim that attach alone is the sole
-- writer is false. This creates ONE narrow internal canonical writer that
-- all three will be refactored (in subsequent migrations) to funnel
-- through, preserving the load-bearing generic invariants that apply to
-- EVERY relation type (existence, org/branch compatibility, posted
-- status, variant compatibility where applicable, positive quantity, the
-- global per-movement-line applied-quantity cap, and duplicate/unique
-- handling). Relation-specific validation (category/reference match for
-- receipt/issue; exact correlation ownership for relocation; mirroring-
-- only trust for reversal) stays in each caller, unchanged.
--
-- Internal-only: SECURITY DEFINER, hardened search_path, EXECUTE revoked
-- from PUBLIC/anon/authenticated/service_role. Reachable only via
-- same-owner (postgres) SECURITY DEFINER callers, matching this
-- project's established `_internal` pattern (e.g.
-- rebuild_repair_order_projection_bucket_internal,
-- inventory_finalize_posting_internal). Does NOT expose a new client RPC
-- and does NOT touch the projection tables at all -- projection
-- rebuild/write remains each caller's own responsibility, unchanged.
--
-- SUPERSEDED by 20260916201516_ic5c_internal_writer_add_require_posted_
-- param.sql (arity change: 4 args -> 5 args, self-caught live during
-- this same correction pass). Kept as its own forward migration per this
-- project's own never-edit-an-applied-migration discipline.
CREATE OR REPLACE FUNCTION public.write_repair_order_line_movement_link_internal(
  p_repair_order_line_id uuid,
  p_inventory_movement_line_id uuid,
  p_applied_quantity numeric,
  p_relation_type text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ro record;
  v_ml record;
  v_existing_sum numeric;
  v_new_id uuid;
BEGIN
  IF p_applied_quantity IS NULL OR p_applied_quantity <= 0 THEN
    RAISE EXCEPTION 'applied_quantity must be greater than zero' USING ERRCODE = '22023';
  END IF;

  IF p_relation_type NOT IN ('receipt', 'issue', 'relocation', 'reversal') THEN
    RAISE EXCEPTION 'relation_type must be one of receipt, issue, relocation, reversal' USING ERRCODE = '22023';
  END IF;

  SELECT rol.id AS line_id, ro.id AS repair_order_id, ro.organization_id, ro.branch_id, rol.variant_id
    INTO v_ro
    FROM repair_order_lines rol
    JOIN repair_orders ro ON ro.id = rol.repair_order_id
   WHERE rol.id = p_repair_order_line_id
     AND rol.deleted_at IS NULL
     AND ro.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RepairOrderLine not found: %', p_repair_order_line_id USING ERRCODE = 'P0002';
  END IF;

  SELECT iml.id, iml.organization_id, iml.branch_id, iml.quantity, iml.variant_id,
         iml.source_location_id, iml.destination_location_id, imh.status
    INTO v_ml
    FROM inventory_movement_lines iml
    JOIN inventory_movement_headers imh ON imh.id = iml.movement_id
   WHERE iml.id = p_inventory_movement_line_id
     AND iml.deleted_at IS NULL
   FOR UPDATE OF iml;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory movement line not found: %', p_inventory_movement_line_id USING ERRCODE = 'P0002';
  END IF;

  IF v_ml.organization_id <> v_ro.organization_id OR v_ml.branch_id <> v_ro.branch_id THEN
    RAISE EXCEPTION 'Movement line organization/branch does not match the RepairOrder' USING ERRCODE = '42501';
  END IF;

  IF v_ml.status <> 'posted' THEN
    RAISE EXCEPTION 'Only posted movement lines can be attributed to a RepairOrderLine' USING ERRCODE = '55000';
  END IF;

  IF v_ro.variant_id IS NOT NULL AND v_ro.variant_id <> v_ml.variant_id THEN
    RAISE EXCEPTION 'Movement line product/variant does not match the RepairOrderLine''s own variant'
      USING ERRCODE = '55000';
  END IF;

  SELECT COALESCE(SUM(applied_quantity), 0) INTO v_existing_sum
    FROM repair_order_line_movement_links
   WHERE inventory_movement_line_id = p_inventory_movement_line_id;

  IF v_existing_sum + p_applied_quantity > v_ml.quantity THEN
    RAISE EXCEPTION 'applied_quantity exceeds the movement line''s own remaining quantity (already applied %, line quantity %)',
      v_existing_sum, v_ml.quantity USING ERRCODE = '22023';
  END IF;

  INSERT INTO repair_order_line_movement_links
    (repair_order_line_id, inventory_movement_line_id, applied_quantity, relation_type)
  VALUES
    (p_repair_order_line_id, p_inventory_movement_line_id, p_applied_quantity, p_relation_type)
  ON CONFLICT (repair_order_line_id, inventory_movement_line_id, relation_type) DO NOTHING
  RETURNING id INTO v_new_id;

  IF v_new_id IS NULL THEN
    RAISE EXCEPTION 'This movement line is already attributed to this RepairOrderLine with this relation type'
      USING ERRCODE = '23505';
  END IF;

  RETURN jsonb_build_object(
    'id', v_new_id,
    'repair_order_line_id', p_repair_order_line_id,
    'inventory_movement_line_id', p_inventory_movement_line_id,
    'applied_quantity', p_applied_quantity,
    'relation_type', p_relation_type,
    'organization_id', v_ro.organization_id,
    'branch_id', v_ro.branch_id,
    'variant_id', v_ml.variant_id,
    'source_location_id', v_ml.source_location_id,
    'destination_location_id', v_ml.destination_location_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.write_repair_order_line_movement_link_internal(uuid, uuid, numeric, text)
  FROM PUBLIC, anon, authenticated, service_role;
