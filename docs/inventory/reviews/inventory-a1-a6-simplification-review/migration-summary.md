# Inventory Core — A1–A6 Simplification Pass — Migration Summary

2 migrations, exactly as the task specified ("Only expected DB changes:
A1: DROP inventory_convert_quantity. A4: REVOKE EXECUTE... No other
migration should be necessary" — confirmed true, no third migration
appeared necessary). Both applied live via MCP, live-verified
independently (never trusting `apply_migration`'s own success response),
then mirrored locally under
`apps/web/supabase-target/supabase/migrations/` using the exact
live-reported timestamp.

## 1. `20260922063007_a1_drop_dead_inventory_convert_quantity.sql`

```sql
DROP FUNCTION IF EXISTS public.inventory_convert_quantity(uuid, uuid, uuid, uuid, numeric);
```

**Pre-fix live state** (confirmed before dropping): exactly 1 overload,
signature `inventory_convert_quantity(uuid,uuid,uuid,uuid,numeric)`,
`prosecdef=false`. `prosrc` cross-search across all of `pg_proc`: zero
SQL callers. Repo grep across `apps/web`/`apps/public-web`: zero real TS
callers (only a migration-content test assertion and generated type
declarations, neither an invocation).

**Post-fix live verification**: `SELECT count(*) FROM pg_proc WHERE
proname = 'inventory_convert_quantity'` → `0`. No stale overload (there
was only ever 1 to begin with, and it is now fully gone).

**Test-file impact**: `111_ic7_closing_security_test.sql`'s own scenario
A8 required a disclosed forward correction (see `changed-files.md`) —
the assertion COUNT is unchanged, only the expected SQLSTATE.

## 2. `20260922063459_a4_revoke_authenticated_balance_lock_helper.sql`

```sql
REVOKE EXECUTE ON FUNCTION public.inventory_get_or_create_balance_for_update(uuid, uuid, uuid, uuid, uuid, uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.inventory_get_or_create_balance_for_update(uuid, uuid, uuid, uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.inventory_get_or_create_balance_for_update(uuid, uuid, uuid, uuid, uuid, uuid, uuid) FROM anon;
```

**Pre-fix live state** (confirmed before revoking): 1 overload,
`prosecdef=false` (SECURITY INVOKER — always called from inside an
already-elevated context, same-owner nesting), `authenticated_can_
execute=true`, `anon_can_execute=false` (already correctly denied
pre-pass), `service_role_can_execute=true`. `prosrc` cross-search:
exactly 6 real callers — `inventory_create_allocation`, `inventory_
create_reservation`, `inventory_finalize_posting_internal`, `inventory_
release_allocation`, `inventory_release_reservation`, `inventory_send_
branch_transfer` — all `SECURITY DEFINER` owned by `postgres`. Repo
grep: zero real TS/direct-application callers (one doc comment, one
migration-content test assertion, neither an invocation).

**Post-fix live verification**: `authenticated_can_execute=false`,
`anon_can_execute=false` (unchanged), `service_role_can_execute=true`
(unchanged), `postgres_can_execute=true` (unchanged), 1 overload (no
stale duplicate).

**Both directions proven live, in a disposable rolled-back
transaction**, before trusting the grant-inspection result alone:

- A direct `authenticated` call → `42501: permission denied for
function inventory_get_or_create_balance_for_update`.
- A representative canonical caller, `inventory_create_reservation`
  (SECURITY DEFINER, postgres-owned, nests a call to the now-restricted
  helper), called as a real `authenticated` user → succeeded end-to-end
  (`{"status": "active", "reservation_id": "...", "reservation_number":
"RES-000009"}`), confirming same-owner nesting is genuinely unaffected.

Function body, locking semantics (`FOR UPDATE` on the balance row), and
security mode (`SECURITY INVOKER`) are all completely unchanged — this
is a grant-only change, as the task required.

## Local mirroring

Both migrations mirrored under their exact live-reported timestamps
(`20260922063007`, `20260922063459`). Neither was edited after being
applied.

## Zero data destruction

No table dropped, no history row touched, no data migrated or
backfilled. Migration 1 drops one confirmed-dead function definition.
Migration 2 is a grant-only change. Both are schema/permission changes
only, zero business data affected.
