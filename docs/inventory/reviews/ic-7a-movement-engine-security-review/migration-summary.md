# IC-7A — Migration Summary

4 forward migrations, applied via Supabase MCP `apply_migration`, live-
verified via `pg_get_functiondef`/`has_function_privilege`/`pg_proc`
overload queries after each apply, then mirrored locally under their
exact live-reported version/timestamp. No already-applied migration was
edited in place — every fix (including the one self-caught defect) is a
new forward migration.

## 1. `20260916050440_ic7a_harden_inventory_create_draft`

`CREATE OR REPLACE FUNCTION public.inventory_create_draft(...)` — same
11-arg signature as before (no overload risk). Adds, as the FIRST two
checks in the function body: `p_actor_user_id IS NULL OR IS DISTINCT
FROM auth.uid()` → `28000`; `NOT (has_branch_permission(..., 'warehouse.
inventory.operate') OR (..., '.adjust'))` → `42501`. Also adds a guard
against manually creating a movement type flagged `is_system OR NOT
allows_manual_entry` — **this exact guard was found wrong by live
inspection immediately after applying it** (see migration 4).
`REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated,
service_role`.

**Live-verified immediately after apply**: `pg_proc` shows exactly one
`inventory_create_draft` overload; grant matrix confirms `anon=false`,
`authenticated=true`, `service_role=true`.

## 2. `20260916050528_ic7a_harden_inventory_finalize_posting_internal`

`CREATE OR REPLACE FUNCTION public.inventory_finalize_posting_internal(
...)` — same 3-arg signature as before. Adds the SAME actor-identity +
permission check, positioned immediately after the header row's own
pre-existing `FOR UPDATE` lock/not-found check (org/branch must be read
from the locked row first) and BEFORE the "already posted" short-circuit
— an unauthorized caller must not learn a movement's status before being
rejected. Re-issues `REVOKE ALL FROM PUBLIC, anon, authenticated,
service_role` on the internal function (IC-2's own frozen contract,
unchanged) and `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO
authenticated, service_role` on the public 2-arg wrapper.

**Safe for the reversal path, verified by reading `inventory_reverse_
movement`'s own body (unchanged)**: it already validates actor+
permission against the ORIGINAL movement's own org/branch before ever
calling this internal function, and the reversal movement it creates
always shares the original's own organization_id/branch_id — the new
checks, re-validated against the movement actually being finalized, pass
trivially (redundant, not harmful) for this caller.

**Live-verified immediately after apply**: exactly one overload each for
both functions; `inventory_finalize_posting_internal` grant matrix
unchanged (`anon`/`authenticated`/`service_role` all `false`, only
`postgres` `true`); public `inventory_finalize_posting` grant matrix
`anon=false`, `authenticated=true`, `service_role=true`.

## 3. `20260916050557_ic7a_harden_inventory_create_and_finalize`

`CREATE OR REPLACE FUNCTION public.inventory_create_and_finalize(...)` —
same 11-arg signature. Adds the SAME actor-identity + permission check
directly, as defense in depth (already transitively protected via
migration 1's own hardening of `inventory_create_draft`, which this
function calls first). `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO
authenticated, service_role`.

**Live-verified immediately after apply**: exactly one overload; grant
matrix `anon=false`, `authenticated=true`, `service_role=true`.

## 4. `20260916050815_ic7a_fix_system_type_guard_overly_broad`

**Self-caught defect, fixed BEFORE any regression test ran**: after
applying migration 1, a live query (`SELECT code, is_system, allows_
manual_entry FROM inventory_movement_types WHERE code IN ('101','401',
'402','801','900')`) showed `is_system=true` for EVERY seeded catalog
type — not just 900. Migration 1's own guard (`is_system OR NOT allows_
manual_entry`) would therefore have rejected manual creation of EVERY
movement type, including the legitimate 101 receipt, 401/402 adjustment,
and 801 relocation flows. `allows_manual_entry` (`false` only for 900)
is the sole correct signal.

`CREATE OR REPLACE FUNCTION public.inventory_create_draft(...)` — same
signature, same actor/permission checks from migration 1 unchanged, only
the guard condition corrected to `NOT allows_manual_entry` alone.

**Live-verified before writing any pgTAP assertion**: a real 101 draft
and a real 401 draft both succeed post-fix (`status='draft'` each); a 900
draft attempt still correctly rejected (`42501`).

## Post-apply live verification performed (every migration)

- `pg_get_functiondef` re-fetch after every function change, confirming
  the body matches exactly what was applied.
- `SELECT oid::regprocedure FROM pg_proc WHERE proname = ...` after
  every migration, confirming exactly one overload survives for each of
  the 3 hardened functions plus `inventory_finalize_posting`/`_internal`
  — no arity ever changed in this pass, so no new-overload risk, but
  re-checked anyway per this project's own established discipline.
- `has_function_privilege('anon'/'authenticated'/'service_role'/
'postgres', ..., 'EXECUTE')` grant-matrix queries after every
  migration, not summarized from migration text.
- A live smoke test (101/401 draft succeed, 900 draft rejected) run
  BEFORE writing the pgTAP file, catching the migration-1 defect early.
- The exact original exploit payload replayed post-fix (see
  `security-evidence.md`).
- The full 097-105 pgTAP regression suite (see `test-evidence.md`).
