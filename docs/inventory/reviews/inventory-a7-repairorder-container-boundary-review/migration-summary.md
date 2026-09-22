# Inventory Core — A7 Domain-Boundary Cleanup — Migration Summary

2 migrations, exactly the 2 the task specified. Deployed in the
requested order (wrapper first, generic primitive narrowed second) so
a safe path exists before the old branch is removed — though since
this project deploys forward migrations directly against a live target
(not a rolling multi-instance deploy), there is no real "mid-deploy
unreachable" window either way; the order was still followed for
discipline/audit-trail clarity, matching the task's own explicit
preference. Both applied live via MCP, live-verified independently
(never trusting `apply_migration`'s own success response), then
mirrored locally under `apps/web/supabase-target/supabase/migrations/`
using the exact live-reported timestamp.

## 1. `20260922072503_a7_add_repair_order_container_wrapper.sql`

Creates `repair_order_add_allocation_to_container(p_actor_user_id,
p_organization_id, p_branch_id, p_container_id, p_allocation_line_id,
p_quantity)` — the exact conceptual signature the module-boundary
review itself proposed, confirmed still consistent with the current
`inventory_add_to_container` signature it nests a call into.

**Body**: actor-identity check (`28000`) → branch permission check
(`warehouse.inventory.operate`, `42501`) → unlocked read of the
container's own `reference_type`/`reference_id` (`P0002` if not
found) → if `reference_type = 'repair_order'`: read the allocation
line's own `reservation_line_id` (`P0002` if not found), resolve its
own RepairOrder via the same 3-table JOIN the removed branch used,
reject (`P0002`) if it doesn't match the container's own `reference_id`
→ nested call to `inventory_add_to_container` with the same 6
parameters, returning its result unchanged.

**Security**: `SECURITY DEFINER`, `SET search_path TO 'public',
'pg_temp'` (matching `inventory_add_to_container`'s own hardened
convention), owner `postgres`. `REVOKE ALL FROM PUBLIC, anon`; `GRANT
EXECUTE TO authenticated, service_role` (matching `inventory_add_to_
container`'s own exact grant shape, live-queried before writing this
migration).

**Live-verified pre-narrowing** (with the OLD branch still present in
`inventory_add_to_container`, so both layers were briefly active
together): same-RepairOrder placement succeeds, cross-RepairOrder
placement rejected, generic-container placement succeeds (no ownership
check applies), a direct call to the still-unnarrowed generic primitive
remained rejected for the cross-RepairOrder case (expected — migration
2 had not yet run).

## 2. `20260922072704_a7_narrow_inventory_add_to_container.sql`

`CREATE OR REPLACE FUNCTION inventory_add_to_container` — removes
ONLY the `IF v_container.reference_type = 'repair_order' THEN ... END
IF;` block (the 3-table JOIN resolving RepairOrder ownership) and its
now-unused `v_resolved_repair_order_id` local variable declaration.
Every other statement is byte-identical to the pre-migration body:
actor-identity check, permission check, quantity check, container
lookup+lock+status check, allocation lookup+lock, location-match check,
over-placement cap check, unit resolution, container-line upsert,
allocation-container-link insert, empty→active status transition,
result shape. Confirmed via direct diff of the two live function
bodies before and after.

**Post-migration live verification**: a precise regex check
(`(from|join)\s+(public\.)?repair_order_lines\M`, not a naive substring
match — the function's own explanatory comment about the removal does
mention "repair_order_lines" in prose, which a naive check would have
false-positived on) confirms **zero real FROM/JOIN references** to
`repair_order_lines`/`repair_orders` remain. `SECURITY DEFINER`,
`search_path`, grants (`authenticated`=true, `anon`=false), and
overload count (1, no stale duplicate) all confirmed unchanged.

**Live-verified post-narrowing** (both migrations now live): same-
RepairOrder placement via the wrapper still succeeds; cross-RepairOrder
placement via the wrapper is still correctly rejected; a **direct**
call to the now-narrowed generic primitive (bypassing the wrapper
entirely) with a cross-RepairOrder allocation **now succeeds** — the
disclosed, accepted design tradeoff this pass's own task explicitly
authorized (the generic primitive "must know ONLY generic inventory
concepts... must NOT query repair_orders/repair_order_lines" —
enforcement for RepairOrder-owned containers now exists only at the
wrapper, not at the generic primitive, for any caller that bypasses
it). See `boundary-evidence.md` for the full disclosure and its
accepted-risk reasoning.

## Local mirroring

Both migrations mirrored under their exact live-reported timestamps
(`20260922072503`, `20260922072704`). Neither was edited after being
applied.

## Zero data destruction

No table dropped, no history row touched, no data migrated or
backfilled. Migration 1 adds one new function definition + grants.
Migration 2 is a function-body replacement removing dead logic only —
both are schema/function changes, zero business data affected.
