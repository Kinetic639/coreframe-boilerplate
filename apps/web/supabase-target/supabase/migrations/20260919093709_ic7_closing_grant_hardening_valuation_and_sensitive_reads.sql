-- IC-7 CLOSING PASS -- grant-only hardening, no body change.
--
-- inventory_create_valuation_snapshot: mutation (INSERT ... ON CONFLICT DO
-- UPDATE into inventory_valuation_snapshots), but has NO p_actor_user_id
-- parameter and inventory_valuation_snapshots has no created_by/actor-
-- tracking column at all -- adding an actor parameter here would be a
-- signature change with no corresponding column to validate against, per
-- the task's own "do not casually proliferate new parameters" guidance.
-- Its real security boundary is the existing has_permission/
-- has_branch_permission('warehouse.reports.read') check, LIVE-CONFIRMED
-- to correctly reject anon and no-permission callers. Grant hardened for
-- defense-in-depth only (mutation APIs should never carry anon EXECUTE).
REVOKE ALL ON FUNCTION public.inventory_create_valuation_snapshot(uuid, uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_create_valuation_snapshot(uuid, uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_create_valuation_snapshot(uuid, uuid, date) TO authenticated, service_role;

-- inventory_count_session_list: read-only, tenant-sensitive (count-session
-- audit data), already correctly gated by has_branch_permission(...,
-- 'warehouse.audits.read') -- LIVE-CONFIRMED anon/no-permission rejected.
-- Grant hardened since it exposes tenant business data to a caller who
-- should never reach it via anon EXECUTE in the first place.
REVOKE ALL ON FUNCTION public.inventory_count_session_list(uuid, uuid, text, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_count_session_list(uuid, uuid, text, text, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_count_session_list(uuid, uuid, text, text, integer, integer) TO authenticated, service_role;

-- inventory_find_sku_collisions: read-only, filters rows via
-- has_permission(v.organization_id, 'warehouse.products.read') as a WHERE
-- predicate (not a RAISE guard) -- an anon/no-permission caller gets a
-- correctly empty result set, not a leak, but the grant itself is
-- unnecessary exposure of a tenant-scoped lookup. Hardened for
-- defense-in-depth.
REVOKE ALL ON FUNCTION public.inventory_find_sku_collisions(uuid, text[], uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_find_sku_collisions(uuid, text[], uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_find_sku_collisions(uuid, text[], uuid[]) TO authenticated, service_role;

-- inventory_convert_quantity: reads inventory_product_unit_conversions/
-- inventory_unit_conversions (tenant configuration data -- conversion
-- factors) scoped by p_organization_id with ZERO permission check of any
-- kind -- a genuine tenant-data exposure to anon, not merely a grant-level
-- formality (LIVE-CONFIRMED zero TypeScript callers and zero other SQL
-- function callers -- effectively dead code, but still reachable and still
-- leaking cross-tenant conversion-factor existence/values to anon today).
-- Closed by revoking anon/PUBLIC; kept authenticated/service_role rather
-- than fully removing the function, since full removal is out of this
-- narrow security-closing pass's own scope (dead-code cleanup belongs to
-- the architecture-compression pass).
REVOKE ALL ON FUNCTION public.inventory_convert_quantity(uuid, uuid, uuid, uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_convert_quantity(uuid, uuid, uuid, uuid, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_convert_quantity(uuid, uuid, uuid, uuid, numeric) TO authenticated, service_role;
