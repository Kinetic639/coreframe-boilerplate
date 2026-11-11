-- A4 SIMPLIFICATION -- internalize inventory_get_or_create_balance_for_update.
-- Live-confirmed: exactly 6 real callers (inventory_create_allocation,
-- inventory_create_reservation, inventory_finalize_posting_internal,
-- inventory_release_allocation, inventory_release_reservation,
-- inventory_send_branch_transfer), all SECURITY DEFINER owned by
-- postgres -- same-owner nesting, entirely unaffected by this REVOKE.
-- Zero real TS/direct application callers (repo grep: only a doc
-- comment and one migration-content test assertion, neither an
-- invocation). This is the exact "genuine DRY helper, only its
-- lingering authenticated grant is a simplification target" residual
-- item the architecture compression review disclosed and deferred to
-- this pass (simplification-plan.md item A4). The function itself is
-- NOT converted to SECURITY DEFINER, NOT rewritten, and its locking
-- semantics (FOR UPDATE on the balance row) are entirely unchanged --
-- this is a grant-only change.

REVOKE EXECUTE ON FUNCTION public.inventory_get_or_create_balance_for_update(uuid, uuid, uuid, uuid, uuid, uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.inventory_get_or_create_balance_for_update(uuid, uuid, uuid, uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.inventory_get_or_create_balance_for_update(uuid, uuid, uuid, uuid, uuid, uuid, uuid) FROM anon;
