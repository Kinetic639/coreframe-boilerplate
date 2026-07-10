-- Removes the catalog-wide "seed every active product as a zero-stock line"
-- branch from inventory_create_count_session. It cross-joined the ENTIRE
-- active product catalog against every selected location whenever
-- include_zero_stock was on, regardless of whether a variant had ever been
-- stocked/assigned to that location — a brand-new, empty location still got
-- one line per catalog product (169 in the reported case). The prior
-- migration (20260710131915) already made the primary balance-based branch
-- respect include_zero_stock for EXISTING balance rows (zero or positive),
-- which is now the toggle's entire job: include already-tracked zero
-- balances at the selected locations, never invent lines for products with
-- no relationship to the location at all.
CREATE OR REPLACE FUNCTION public.inventory_create_count_session(
  p_organization_id uuid,
  p_branch_id uuid,
  p_scope jsonb DEFAULT '{}'::jsonb,
  p_notes text DEFAULT NULL,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count_id uuid;
  v_number text;
  v_count_type text;
  v_include_zero_stock boolean;
  v_location_ids uuid[];
  v_location_filter_ids uuid[];
  v_supplier_id uuid;
BEGIN
  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.audits.manage') THEN
    RAISE EXCEPTION 'Missing warehouse.audits.manage permission';
  END IF;

  v_count_type := coalesce(p_scope ->> 'count_type', 'location');
  IF v_count_type NOT IN ('location', 'supplier') THEN
    RAISE EXCEPTION 'scope.count_type must be location or supplier';
  END IF;

  v_include_zero_stock := coalesce((p_scope ->> 'include_zero_stock')::boolean, false);

  SELECT coalesce(array_agg(elem::uuid), ARRAY[]::uuid[])
  INTO v_location_ids
  FROM jsonb_array_elements_text(coalesce(p_scope -> 'location_ids', '[]'::jsonb)) AS elem;

  SELECT coalesce(array_agg(elem::uuid), ARRAY[]::uuid[])
  INTO v_location_filter_ids
  FROM jsonb_array_elements_text(coalesce(p_scope -> 'location_filter_ids', '[]'::jsonb)) AS elem;

  v_supplier_id := nullif(p_scope ->> 'supplier_id', '')::uuid;

  IF v_count_type = 'supplier' AND v_supplier_id IS NULL THEN
    RAISE EXCEPTION 'scope.supplier_id is required when count_type is supplier';
  END IF;
  IF v_count_type = 'location' AND array_length(v_location_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'scope.location_ids must not be empty when count_type is location';
  END IF;

  v_number := 'CNT-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || substr(gen_random_uuid()::text, 1, 6);

  INSERT INTO public.inventory_count_sessions (
    organization_id, branch_id, count_number, scope, notes, created_by
  )
  VALUES (
    p_organization_id, p_branch_id, upper(v_number), coalesce(p_scope, '{}'::jsonb), p_notes, p_actor_user_id
  )
  RETURNING id INTO v_count_id;

  -- Seed lines strictly from EXISTING balance rows matching the resolved
  -- scope — a (variant, location) pair with no balance row at all is never
  -- seeded, regardless of include_zero_stock. Location-subtree expansion
  -- already happened in TypeScript before this RPC was called
  -- (buildLocationTree) — v_location_ids is always the final, already-
  -- expanded list, never a set of parent-only ids to expand here.
  -- include_zero_stock only controls whether balance rows that already read
  -- zero are included alongside positive ones — it does not invent new
  -- lines for products that have no tracked relationship to the location.
  INSERT INTO public.inventory_count_lines (
    organization_id, branch_id, count_session_id, variant_id, location_id,
    lot_id, serial_id, expected_quantity, unit_id, status, source, sequence_no
  )
  SELECT
    b.organization_id, b.branch_id, v_count_id, b.variant_id, b.location_id,
    b.lot_id, b.serial_id, b.on_hand_quantity, p.base_unit_id, 'pending', 'generated',
    row_number() OVER (ORDER BY b.location_id, b.variant_id)
  FROM public.inventory_balances b
  JOIN public.inventory_variants v
    ON v.id = b.variant_id AND v.organization_id = b.organization_id
  JOIN public.inventory_products p
    ON p.id = v.product_id AND p.organization_id = b.organization_id
  WHERE b.organization_id = p_organization_id
    AND b.branch_id = p_branch_id
    AND (v_include_zero_stock OR b.on_hand_quantity > 0)
    AND (
      (v_count_type = 'location' AND b.location_id = ANY (v_location_ids))
      OR (
        v_count_type = 'supplier'
        AND v.default_supplier_id = v_supplier_id
        AND (array_length(v_location_filter_ids, 1) IS NULL OR b.location_id = ANY (v_location_filter_ids))
      )
    );

  RETURN jsonb_build_object('count_session_id', v_count_id, 'count_number', upper(v_number), 'status', 'draft');
END;
$$;
