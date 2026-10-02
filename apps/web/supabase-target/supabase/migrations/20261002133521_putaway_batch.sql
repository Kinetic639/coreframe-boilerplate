-- Scan-driven putaway (2026-10-02): several receiving-zone items put away in
-- one step, into one target -- an existing repair-order container, a new
-- container (created here, for one repair order), or a location (loose /
-- bulk / auto-container per line). Each line goes through the existing
-- inventory_putaway_from_receiving, so commitments and the engine are
-- exactly as for a single putaway; all lines and the new container commit
-- or roll back together. A container holds parts of ONE repair order: a
-- line of another order is refused, not silently re-routed.
CREATE OR REPLACE FUNCTION public.inventory_putaway_batch(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_location_id uuid,
  p_container_id uuid,
  p_new_container_repair_order_id uuid,
  p_lines jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_location uuid := p_location_id;
  v_container record;
  v_container_id uuid;
  v_container_code text;
  v_container_ro uuid;
  v_container_created boolean := false;
  v_ro record;
  v_n integer;
  v_code text;
  v_line jsonb;
  v_rol_id uuid;
  v_rol_ro uuid;
  v_result jsonb;
  v_results jsonb := '[]'::jsonb;
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

  IF p_container_id IS NOT NULL AND p_new_container_repair_order_id IS NOT NULL THEN
    RAISE EXCEPTION 'Pick an existing container or a new one, not both' USING ERRCODE = '22023';
  END IF;

  -- Existing container: its own location is the destination.
  IF p_container_id IS NOT NULL THEN
    SELECT id, code, current_location_id, reference_id INTO v_container
    FROM public.inventory_containers
    WHERE id = p_container_id AND organization_id = p_organization_id AND branch_id = p_branch_id
      AND reference_type = 'repair_order' AND status IN ('active', 'empty') AND deleted_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Container not found or not usable' USING ERRCODE = 'P0002';
    END IF;
    IF v_container.current_location_id IS NULL THEN
      RAISE EXCEPTION 'Container has no location' USING ERRCODE = '22023';
    END IF;
    v_location := v_container.current_location_id;
    v_container_id := v_container.id;
    v_container_code := v_container.code;
    v_container_ro := v_container.reference_id::uuid;
  END IF;

  IF v_location IS NULL THEN
    RAISE EXCEPTION 'A destination location is required' USING ERRCODE = '22023';
  END IF;

  -- New container for one repair order at the destination.
  IF p_new_container_repair_order_id IS NOT NULL THEN
    SELECT id, zl_number, status INTO v_ro
    FROM public.repair_orders
    WHERE id = p_new_container_repair_order_id AND organization_id = p_organization_id
      AND branch_id = p_branch_id AND deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Repair order not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_ro.status <> 'open' THEN
      RAISE EXCEPTION 'Repair order is not open' USING ERRCODE = '55000';
    END IF;

    SELECT count(*) + 1 INTO v_n FROM public.inventory_containers
    WHERE organization_id = p_organization_id AND reference_type = 'repair_order'
      AND reference_id = v_ro.id::text AND deleted_at IS NULL;
    LOOP
      v_code := 'K-' || COALESCE(v_ro.zl_number, 'ZL') || '-' || lpad(v_n::text, 2, '0');
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.inventory_containers
        WHERE organization_id = p_organization_id AND branch_id = p_branch_id
          AND lower(code) = lower(v_code) AND deleted_at IS NULL);
      v_n := v_n + 1;
    END LOOP;

    v_container_id := (public.inventory_create_container(
      p_actor_user_id, p_organization_id, p_branch_id, v_code, v_location,
      'container', 'repair_order', v_ro.id::text)->>'container_id')::uuid;
    v_container_code := v_code;
    v_container_ro := v_ro.id;
    v_container_created := true;
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_rol_id := NULLIF(v_line->>'repair_order_line_id', '')::uuid;

    IF v_container_id IS NOT NULL THEN
      IF v_rol_id IS NULL THEN
        RAISE EXCEPTION 'Only repair-order parts go into a repair-order container' USING ERRCODE = '22023';
      END IF;
      SELECT repair_order_id INTO v_rol_ro FROM public.repair_order_lines WHERE id = v_rol_id;
      IF v_rol_ro IS DISTINCT FROM v_container_ro THEN
        RAISE EXCEPTION 'A part of another repair order cannot go into this container' USING ERRCODE = '22023';
      END IF;
    END IF;

    v_result := public.inventory_putaway_from_receiving(
      p_actor_user_id, p_organization_id, p_branch_id,
      (v_line->>'variant_id')::uuid, (v_line->>'quantity')::numeric,
      v_location, v_rol_id, v_container_id);
    v_results := v_results || jsonb_build_array(v_result);
  END LOOP;

  RETURN jsonb_build_object(
    'location_id', v_location,
    'container_id', v_container_id,
    'container_code', v_container_code,
    'container_created', v_container_created,
    'line_count', jsonb_array_length(v_results),
    'lines', v_results);
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_putaway_batch(uuid, uuid, uuid, uuid, uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_putaway_batch(uuid, uuid, uuid, uuid, uuid, uuid, jsonb) TO authenticated;
