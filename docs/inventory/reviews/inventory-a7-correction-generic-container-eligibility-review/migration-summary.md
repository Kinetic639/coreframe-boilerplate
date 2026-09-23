# Inventory Core — A7 Follow-Up Correction Pass — Migration Summary

3 migrations, applied live via MCP in the order below, each
independently live-verified (never trusting `apply_migration`'s own
success response — grants, `proacl`, `pg_get_functiondef`, and
overload counts all confirmed via direct SQL), then mirrored locally
under `apps/web/supabase-target/supabase/migrations/` using the exact
live-reported timestamps. Order matters: the internal helper is
created first (harmless, unwired), then the RepairOrder wrapper is
redirected to it (so its own safe path is never broken mid-deploy),
and only then is the public generic entry point narrowed.

## 1. `20260922082042_a7_correction_extract_add_to_container_internal.sql`

Creates `inventory_add_to_container_internal(p_actor_user_id uuid,
p_organization_id uuid, p_branch_id uuid, p_container_id uuid,
p_allocation_line_id uuid, p_quantity numeric) RETURNS jsonb` — a
byte-identical copy of the pre-correction `inventory_add_to_container`
body: actor-identity check (`28000`) -> branch-permission check
(`42501`) -> quantity check (`22023`) -> container lookup+lock+status
check (`P0002`/`55000`) -> allocation lookup+lock (`P0002`) ->
location-match check (`22023`) -> over-placement cap (`22023`) -> unit
resolution (`P0002`) -> container-line upsert -> allocation-container-
link insert -> empty->active status transition -> jsonb result.

**Security**: `SECURITY DEFINER`, `SET search_path TO 'public',
'pg_temp'`, owner `postgres`. Immediately followed by:

```sql
REVOKE ALL ON FUNCTION public.inventory_add_to_container_internal(...) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_add_to_container_internal(...) FROM anon;
REVOKE ALL ON FUNCTION public.inventory_add_to_container_internal(...) FROM authenticated;
REVOKE ALL ON FUNCTION public.inventory_add_to_container_internal(...) FROM service_role;
```

Matches the established `_internal` convention
(`inventory_finalize_posting_internal`,
`write_repair_order_line_movement_link_internal`) exactly: EXECUTE
granted to **no role at all**, not even `service_role` — reachable
only via same-owner nesting from another `postgres`-owned `SECURITY
DEFINER` function. Determined this was correct (vs. A1-A6's own
`inventory_ensure_settings_row_internal`, which needed an
`authenticated` grant) because both of this helper's own callers are
`SECURITY DEFINER` owned by `postgres` — no non-owner-context
invocation path exists.

**Live-verified**: `proacl = {postgres=X/postgres}`, `prosecdef =
true`, 1 overload. Not yet wired to anything — harmless addition,
zero behavior change from this migration alone.

## 2. `20260922082057_a7_correction_wrapper_calls_internal.sql`

`CREATE OR REPLACE FUNCTION public.repair_order_add_allocation_to_container`
— body unchanged from the A7 base pass (actor check -> permission
check -> unlocked container reference read (`P0002` if not found) ->
if `reference_type = 'repair_order'`: allocation lookup (`P0002` if
not found) -> resolve RepairOrder via the 3-table JOIN
(`inventory_reservation_lines` -> `inventory_reservations` ->
`repair_order_lines`) -> reject (`P0002`) on mismatch) — **only the
final line changed**, from `RETURN
public.inventory_add_to_container(...)` to `RETURN
public.inventory_add_to_container_internal(...)`.

Deliberately applied before narrowing the public entry point, so the
wrapper's own nested call is never left pointing at a not-yet-existing
or differently-behaving target.

**Live-verified**: functional (same-RepairOrder placement still
succeeds, cross-RepairOrder placement still rejected `P0002`), grants
unchanged (`authenticated=true, anon=false, service_role=true`, 1
overload).

## 3. `20260922082141_a7_correction_narrow_public_generic_eligibility.sql`

`CREATE OR REPLACE FUNCTION public.inventory_add_to_container` — body
shortened to: actor-identity check (`28000`) -> branch-permission
check (`42501`) -> unlocked read of the container's own
`reference_type`/`reference_id` -> reject (`P0002`, reusing the exact
"Container not found" message a genuinely missing container already
produces) if not found **or** either reference field is non-null ->
delegate to `inventory_add_to_container_internal` with the same 6
parameters.

The read is deliberately **unlocked** (no `FOR UPDATE`) — safe because
both `reference_type`/`reference_id` remain write-once (re-confirmed
live this pass: zero SQL/TS mutations anywhere touch either column;
only `inventory_create_container` sets them, at creation time only),
matching the exact reasoning already established for the wrapper's own
equivalent read in the A7 base pass. No new lock introduced, so no new
two-session concurrency test was required.

**Live-verified**: `has_branch_permission`/actor checks unchanged;
eligibility gate functional against 6 pgTAP scenarios in file 115
(RepairOrder-owned rejected, arbitrary-other-domain rejected,
partial-state rejected both directions, genuinely-generic still
succeeds, check-ordering preserved). Final grants:
`authenticated=true, anon=false, service_role=true`, 1 overload.

## Local mirroring

All 3 migrations mirrored under their exact live-reported timestamps
(`20260922082042`, `20260922082057`, `20260922082141`). None was
edited after being applied — each subsequent fix (e.g. the eligibility
rule's exact wording) was applied as its own forward migration during
this pass's own live-iteration phase, not as an edit to an
already-applied migration.

## Zero data destruction

No table dropped, no history row touched, no data migrated or
backfilled. Migration 1 adds one new function definition + revokes.
Migrations 2 and 3 are function-body replacements — all three are
schema/function changes only, zero business data affected.
