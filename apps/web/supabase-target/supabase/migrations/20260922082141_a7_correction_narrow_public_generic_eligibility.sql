-- A7 FOLLOW-UP CORRECTION PASS (3 of 3): narrow the PUBLIC
-- inventory_add_to_container to add a generic-eligibility gate before
-- delegating to inventory_add_to_container_internal (added by the
-- first migration of this pass; the RepairOrder wrapper was already
-- redirected to call it directly by the second migration, so this
-- narrowing cannot break the wrapper).
--
-- Eligibility rule verified live this pass before choosing it: the DB
-- has ZERO validation on reference_type/reference_id (any caller-
-- supplied text pair is accepted by inventory_create_container), and
-- there is currently exactly ONE real application caller of the whole
-- container subsystem (RepairOrdersService, via the wrapper -- always
-- passes reference_type='repair_order') -- confirmed by repo-wide grep
-- across apps/web and apps/public-web. No currently-creatable
-- container carries partial reference state (one of the two columns
-- set, the other null); the only live row found (via a full table
-- scan) has both null. The rule adopted: a container is "generic"
-- (reachable through this public entry point) iff BOTH reference_type
-- IS NULL AND reference_id IS NULL. ANY domain-owned/referenced
-- container -- RepairOrder or otherwise -- is rejected here, matching
-- the domain-agnostic design of the public API: it does not check
-- reference_type = 'repair_order' specifically, only whether ANY
-- reference exists at all.
--
-- Error contract: P0002 "Container not found" -- the EXACT existing
-- message this function (and inventory_add_to_container_internal)
-- already raise for a genuinely nonexistent container, deliberately
-- reused verbatim (not a new message) so "does not exist" and "exists
-- but is not accessible through this generic entry point" are
-- indistinguishable from the error alone -- non-leaking, domain-
-- neutral. NOT 42501: the actor may legitimately hold warehouse.
-- inventory.operate at the branch-capability level; this is not a
-- permission failure, the resource is simply unreachable through this
-- specific generic API entry point.
--
-- Actor-identity and branch-permission checks run BEFORE the
-- eligibility check (matching the established, consistent ordering
-- convention across every function in this module) -- an unauthorized
-- caller always gets 28000/42501 regardless of container ownership,
-- never reaching the eligibility check at all.

CREATE OR REPLACE FUNCTION public.inventory_add_to_container(p_actor_user_id uuid, p_organization_id uuid, p_branch_id uuid, p_container_id uuid, p_allocation_line_id uuid, p_quantity numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_reference_type text;
  v_reference_id text;
BEGIN
  IF p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  IF NOT has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission' USING ERRCODE = '42501';
  END IF;

  SELECT reference_type, reference_id
  INTO v_reference_type, v_reference_id
  FROM inventory_containers
  WHERE id = p_container_id
    AND organization_id = p_organization_id
    AND branch_id = p_branch_id
    AND deleted_at IS NULL;

  IF NOT FOUND OR v_reference_type IS NOT NULL OR v_reference_id IS NOT NULL THEN
    RAISE EXCEPTION 'Container not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN public.inventory_add_to_container_internal(
    p_actor_user_id, p_organization_id, p_branch_id, p_container_id, p_allocation_line_id, p_quantity
  );
END;
$function$;
