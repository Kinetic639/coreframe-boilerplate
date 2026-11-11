-- IC-7 -- inventory_approve_count_session accepted p_actor_user_id
-- without ever validating it against auth.uid() (unlike its own nested
-- calls into inventory_create_draft/inventory_finalize_posting, which DO
-- check it -- but only when this function's own increase/decrease line
-- arrays are non-empty; a zero-net-variance approval never reaches those
-- nested calls at all, leaving a narrow actor-spoofing gap on the
-- approved_by audit column). It also carried live anon EXECUTE despite
-- being SECURITY INVOKER with its own has_branch_permission check -- an
-- anon caller has no real session/membership so that check should
-- already reject it in practice, but per this project's own standing
-- convention every canonical RPC's grants are hardened explicitly, not
-- left to an internal check alone. Fixed: added the standard actor-
-- identity check as the first line (matching every other canonical RPC),
-- and explicitly revoked anon/PUBLIC EXECUTE. The function remains
-- SECURITY INVOKER (unchanged) -- its own nested calls into the hardened
-- engine already provide the real security boundary for any non-trivial
-- (line-posting) approval; this fix closes the audit-trail-only gap for
-- the zero-variance case and removes the unnecessary anon exposure.
-- Business logic (all-or-nothing posting gate, movement-type seeding,
-- increase/decrease line construction) is byte-for-byte unchanged.
CREATE OR REPLACE FUNCTION public.inventory_approve_count_session(p_count_session_id uuid, p_actor_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_session public.inventory_count_sessions%ROWTYPE;
  v_require_reason boolean;
  v_line record;
  v_increase_lines jsonb := '[]'::jsonb;
  v_decrease_lines jsonb := '[]'::jsonb;
  v_result jsonb;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  SELECT *
  INTO v_session
  FROM public.inventory_count_sessions
  WHERE id = p_count_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory count session not found';
  END IF;

  IF NOT public.has_branch_permission(v_session.organization_id, v_session.branch_id, 'warehouse.inventory.adjust') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.adjust permission';
  END IF;

  IF v_session.status NOT IN ('draft', 'counting', 'submitted') THEN
    RAISE EXCEPTION 'Inventory count cannot be approved in current status';
  END IF;

  v_require_reason := coalesce((v_session.scope ->> 'require_reason_for_variance')::boolean, true);

  IF EXISTS (
    SELECT 1 FROM public.inventory_count_lines
    WHERE count_session_id = v_session.id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Cannot post: session has unresolved pending lines';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.inventory_count_lines
    WHERE count_session_id = v_session.id AND status = 'needs_recount'
  ) THEN
    RAISE EXCEPTION 'Cannot post: session has lines flagged for recount';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.inventory_count_lines
    WHERE count_session_id = v_session.id AND status = 'counted' AND variance_quantity <> 0
  ) THEN
    RAISE EXCEPTION 'Cannot post: session has counted variance lines that were not reviewed and approved';
  END IF;

  IF v_require_reason AND EXISTS (
    SELECT 1 FROM public.inventory_count_lines
    WHERE count_session_id = v_session.id
      AND status = 'approved'
      AND variance_quantity <> 0
      AND reason_code IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot post: session has approved variance lines missing a required reason code';
  END IF;

  PERFORM public.inventory_seed_movement_types(v_session.organization_id, p_actor_user_id);

  FOR v_line IN
    SELECT *
    FROM public.inventory_count_lines
    WHERE count_session_id = v_session.id
      AND status = 'approved'
      AND variance_quantity <> 0
    ORDER BY location_id, variant_id
  LOOP
    IF v_line.variance_quantity > 0 THEN
      v_increase_lines := v_increase_lines || jsonb_build_array(jsonb_build_object(
        'variant_id', v_line.variant_id,
        'destination_location_id', v_line.location_id,
        'unit_id', v_line.unit_id,
        'quantity', v_line.variance_quantity
      ));
    ELSE
      v_decrease_lines := v_decrease_lines || jsonb_build_array(jsonb_build_object(
        'variant_id', v_line.variant_id,
        'source_location_id', v_line.location_id,
        'unit_id', v_line.unit_id,
        'quantity', abs(v_line.variance_quantity)
      ));
    END IF;
  END LOOP;

  IF jsonb_array_length(v_increase_lines) > 0 THEN
    v_result := public.inventory_create_draft(
      v_session.organization_id,
      v_session.branch_id,
      '401',
      v_increase_lines,
      NULL,
      NULL,
      NULL,
      v_session.count_number,
      'Inventory count ' || v_session.count_number,
      'count-increase-' || v_session.id::text,
      p_actor_user_id
    );
    PERFORM public.inventory_finalize_posting((v_result ->> 'movement_id')::uuid, p_actor_user_id);
  END IF;

  IF jsonb_array_length(v_decrease_lines) > 0 THEN
    v_result := public.inventory_create_draft(
      v_session.organization_id,
      v_session.branch_id,
      '402',
      v_decrease_lines,
      NULL,
      NULL,
      NULL,
      v_session.count_number,
      'Inventory count ' || v_session.count_number,
      'count-decrease-' || v_session.id::text,
      p_actor_user_id
    );
    PERFORM public.inventory_finalize_posting((v_result ->> 'movement_id')::uuid, p_actor_user_id);
  END IF;

  UPDATE public.inventory_count_sessions
  SET status = 'approved',
      approved_at = now(),
      approved_by = p_actor_user_id
  WHERE id = v_session.id;

  RETURN jsonb_build_object(
    'count_session_id', v_session.id,
    'count_number', v_session.count_number,
    'status', 'approved',
    'increase_lines', jsonb_array_length(v_increase_lines),
    'decrease_lines', jsonb_array_length(v_decrease_lines)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_approve_count_session(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_approve_count_session(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_approve_count_session(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_approve_count_session(uuid, uuid) TO service_role;
