-- ============================================================================
-- MMJ- / MMJ+: the movement editor's field policies
-- ============================================================================
-- The editor shows and requires header / line fields from
-- inventory_movement_type_field_policies. 303 / 305 had none, so an MMJ-
-- showed no recipient (the destination branch) and did not ask for the
-- source location. They get the policies of the transfer types they replace
-- (311 -> 303, 312 -> 305): sender = this branch (required), recipient = a
-- branch (required), source location required, no destination location on
-- the MMJ-. Organizations without 311 / 312 rows get them when their types
-- are ensured. Only rows that do not exist yet are added.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.inventory_copy_field_policies_internal(
  p_organization_id uuid,
  p_from_code text,
  p_to_code text
)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_to uuid;
  v_n integer;
BEGIN
  SELECT id INTO v_to FROM public.inventory_movement_types
  WHERE organization_id = p_organization_id AND code = p_to_code AND deleted_at IS NULL;
  IF v_to IS NULL THEN
    RETURN 0;
  END IF;
  INSERT INTO public.inventory_movement_type_field_policies (
    organization_id, movement_type_id, movement_type_code, field_definition_id, field_key,
    policy, default_strategy, default_value, validation, display_order
  )
  SELECT p.organization_id, v_to, p_to_code, p.field_definition_id, p.field_key,
         p.policy, p.default_strategy, p.default_value, p.validation, p.display_order
  FROM public.inventory_movement_type_field_policies p
  WHERE p.organization_id = p_organization_id AND p.movement_type_code = p_from_code
    AND p.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.inventory_movement_type_field_policies q
      WHERE q.organization_id = p_organization_id AND q.movement_type_id = v_to
        AND q.field_key = p.field_key AND q.deleted_at IS NULL);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_copy_field_policies_internal(uuid, text, text) FROM PUBLIC, anon, authenticated;

DO $do$
DECLARE
  v_org uuid;
BEGIN
  FOR v_org IN SELECT id FROM public.organizations LOOP
    PERFORM public.inventory_copy_field_policies_internal(v_org, '311', '303');
    PERFORM public.inventory_copy_field_policies_internal(v_org, '312', '305');
  END LOOP;
END
$do$;

-- New organizations: the types are ensured with their policies.
DO $do$
DECLARE
  v_def text;
  v_new text;
BEGIN
  v_def := pg_get_functiondef('public.inventory_ensure_unit_transfer_types_internal(uuid)'::regprocedure);
  v_new := replace(v_def, $a$  UPDATE public.inventory_movement_types SET is_active = false$a$,
  $b$  PERFORM public.inventory_copy_field_policies_internal(p_organization_id, '311', '303');
  PERFORM public.inventory_copy_field_policies_internal(p_organization_id, '312', '305');

  UPDATE public.inventory_movement_types SET is_active = false$b$);
  IF v_new = v_def THEN
    RAISE EXCEPTION 'ensure patch did not apply';
  END IF;
  EXECUTE v_new;
END
$do$;
