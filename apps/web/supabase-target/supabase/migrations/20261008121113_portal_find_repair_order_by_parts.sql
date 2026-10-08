-- Ambra Zapytania: find a repair order by number + warehouse through the split columns
-- (order_no / warehouse_code, migration 20261008120213) instead of a LIKE on the full number.
-- Same signature, scope and result as before; the newest year wins when a number repeats.

CREATE OR REPLACE FUNCTION public.portal_find_repair_order(p_org_id uuid, p_order_number text, p_warehouse text)
 RETURNS TABLE(id uuid, zl_number text, branch_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT ro.id, ro.zl_number, ro.branch_id
  FROM public.repair_orders ro
  WHERE p_order_number ~ '^\d{3,10}$'
    AND p_warehouse ~ '^\d{3,5}$'
    AND public.is_org_member(p_org_id)
    AND ro.organization_id = p_org_id
    AND ro.deleted_at IS NULL
    AND ro.order_no = p_order_number
    AND ro.warehouse_code = p_warehouse
    AND public.has_branch_permission(p_org_id, ro.branch_id, 'helpdesk.tickets.create')
  ORDER BY ro.order_year DESC NULLS LAST, ro.created_at DESC
  LIMIT 1;
$function$;
