-- ============================================================================
-- IC-7A EMERGENCY SECURITY PASS: harden inventory_create_and_finalize
-- ============================================================================
-- The most important combined path (create + post in one call). Already
-- transitively protected by this pass's own hardening of inventory_
-- create_draft and inventory_finalize_posting_internal (both of which it
-- calls), but per explicit instruction this function gets its own
-- explicit actor-identity + permission check too, as defense in depth --
-- not merely relying on the inner functions never being weakened
-- independently in the future. REVOKE anon EXECUTE explicitly (was still
-- live -- the inner functions' own new checks already made an anon call
-- fail, but the grant itself remained open until now).
--
-- Same caller-graph reasoning as the companion migrations: `authenticated`
-- EXECUTE is KEPT (real server actions -- createAndPostMovementAction --
-- call this directly as the browser session's own authenticated role).

CREATE OR REPLACE FUNCTION public.inventory_create_and_finalize(p_organization_id uuid, p_branch_id uuid, p_movement_type_code text, p_lines jsonb, p_operation_date date DEFAULT NULL::date, p_document_date date DEFAULT NULL::date, p_counterparty_name text DEFAULT NULL::text, p_external_reference text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text, p_actor_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_draft jsonb;
  v_movement_id uuid;
  v_posted jsonb;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  IF NOT (
    public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate')
    OR public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.adjust')
  ) THEN
    RAISE EXCEPTION 'Not authorized to create inventory movements for this branch' USING ERRCODE = '42501';
  END IF;

  v_draft := inventory_create_draft(
    p_organization_id, p_branch_id, p_movement_type_code, p_lines,
    p_operation_date, p_document_date, p_counterparty_name, p_external_reference,
    p_note, p_idempotency_key, p_actor_user_id
  );

  v_movement_id := (v_draft ->> 'movement_id')::uuid;

  IF (v_draft ->> 'status') = 'posted' THEN
    RETURN v_draft;
  END IF;

  v_posted := inventory_finalize_posting(v_movement_id, p_actor_user_id);
  RETURN v_posted;
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_create_and_finalize(uuid, uuid, text, jsonb, date, date, text, text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_create_and_finalize(uuid, uuid, text, jsonb, date, date, text, text, text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_create_and_finalize(uuid, uuid, text, jsonb, date, date, text, text, text, text, uuid) TO authenticated, service_role;
