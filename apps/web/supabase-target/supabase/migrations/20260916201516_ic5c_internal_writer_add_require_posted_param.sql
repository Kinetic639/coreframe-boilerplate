-- IC-5 CORRECTION PASS -- self-caught, live-caught (via re-running the
-- exact Finding-A reproduction after routing the trigger's reversal-
-- mirror call through the shared internal writer): the internal writer's
-- own generic `status = 'posted'` check is legitimately load-bearing for
-- attach/putaway (both call it only against already-committed movement
-- lines), but is structurally inapplicable to the reversal trigger's own
-- mirror call -- that call fires from the ledger-row INSERT INSIDE
-- inventory_finalize_posting_internal's own effect-application loop,
-- which happens BEFORE that same function flips the header's own status
-- to 'posted' (posted_at/status update happens only after ALL lines'
-- effects are applied). The reversal's own effect is already durably
-- applied within the same transaction by the time the trigger fires, and
-- atomicity guarantees the header WILL reach 'posted' (or the whole
-- transaction, including this link, rolls back together) -- so requiring
-- status='posted' at this exact call site was never a meaningful
-- invariant, only a timing artifact. Adds a narrow, explicit opt-out
-- parameter (default true, preserving the check for every existing
-- caller unchanged) rather than weakening the check universally --
-- Phase-10 receipt/issue validation via attach is NOT weakened.
--
-- Arity change: DROP the old 4-arg overload explicitly (this project's
-- own established pitfall -- CREATE OR REPLACE with a different argument
-- list creates a NEW overload and strands the old one) before creating
-- the 5-arg replacement.
DROP FUNCTION public.write_repair_order_line_movement_link_internal(uuid, uuid, numeric, text);

CREATE FUNCTION public.write_repair_order_line_movement_link_internal(
  p_repair_order_line_id uuid,
  p_inventory_movement_line_id uuid,
  p_applied_quantity numeric,
  p_relation_type text,
  p_require_posted boolean DEFAULT true
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

  IF p_require_posted AND v_ml.status <> 'posted' THEN
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

REVOKE ALL ON FUNCTION public.write_repair_order_line_movement_link_internal(uuid, uuid, numeric, text, boolean)
  FROM PUBLIC, anon, authenticated, service_role;
