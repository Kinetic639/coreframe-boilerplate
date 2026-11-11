-- IC-7 grant hygiene -- inventory_get_or_create_balance_for_update is the
-- shared, internal-only balance-getter every canonical RPC calls
-- internally (never meant to be called directly by any client). It
-- carried live anon+PUBLIC EXECUTE. Revoking these does not affect any
-- legitimate internal caller: every caller is itself SECURITY DEFINER
-- owned by postgres, so nested calls execute with postgres's own
-- effective identity (which always implicitly has EXECUTE on everything
-- it owns) regardless of this function's own explicit grants -- the
-- exact same same-owner SECURITY DEFINER nesting semantics already
-- relied on for inventory_finalize_posting_internal and write_repair_
-- order_line_movement_link_internal. Kept callable by authenticated/
-- service_role explicitly (rather than fully internalized to zero grants)
-- since it is not itself SECURITY DEFINER and revoking authenticated
-- entirely was not verified safe against every possible direct caller in
-- this pass -- anon/PUBLIC removal alone closes the actual exposure.
--
-- The 8 trigger functions below (RETURNS trigger) are not meaningfully
-- callable via PostgREST's RPC surface at all (PostgREST requires a
-- normal return type), so their own anon/PUBLIC grants carry no real
-- attack surface -- revoked anyway for consistency with the project's
-- own "every Inventory Core function's grants are hardened explicitly"
-- convention, not because a live exploit was found or possible here.
REVOKE ALL ON FUNCTION public.inventory_get_or_create_balance_for_update(uuid,uuid,uuid,uuid,uuid,uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_get_or_create_balance_for_update(uuid,uuid,uuid,uuid,uuid,uuid,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_get_or_create_balance_for_update(uuid,uuid,uuid,uuid,uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_get_or_create_balance_for_update(uuid,uuid,uuid,uuid,uuid,uuid,uuid) TO service_role;

REVOKE ALL ON FUNCTION public.inventory_count_lines_guard_session() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_count_lines_guard_session() FROM anon;
REVOKE ALL ON FUNCTION public.inventory_count_sessions_guard_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_count_sessions_guard_status() FROM anon;
REVOKE ALL ON FUNCTION public.inventory_guard_balance_write() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_guard_balance_write() FROM anon;
REVOKE ALL ON FUNCTION public.inventory_guard_settings_write() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_guard_settings_write() FROM anon;
REVOKE ALL ON FUNCTION public.inventory_ledger_append_only() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_ledger_append_only() FROM anon;
REVOKE ALL ON FUNCTION public.inventory_prevent_header_modification() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_prevent_header_modification() FROM anon;
REVOKE ALL ON FUNCTION public.inventory_prevent_line_modification() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_prevent_line_modification() FROM anon;
REVOKE ALL ON FUNCTION public.inventory_validate_lot_serial_product() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_validate_lot_serial_product() FROM anon;
