# IC-7 Migration Summary

9 migrations, all applied live via MCP, live-verified independently
(never trusting `apply_migration`'s own success response — every fix
was re-queried via `pg_get_functiondef`/`has_function_privilege`/
`pg_policies` after applying), then mirrored locally under `apps/web/
supabase-target/supabase/migrations/` using the exact live-reported
timestamp. Applied in the order listed (each was live-verified before
the next was written, so later migrations reflect lessons learned from
earlier ones in the same session — e.g. migration 5 was required
because migration 4's own RESTRICTIVE RLS broke migration 4's own
target functions' `SECURITY INVOKER` writes, discovered live and fixed
forward in the same phase, not deferred).

## 1. `20260917145915_ic7_cancel_movement_add_actor_and_permission_check.sql`

`CREATE OR REPLACE FUNCTION inventory_cancel_movement(...)` — added
actor-identity (`28000`) + permission (`42501`, surfaced as `P0002`
"not found or not accessible") checks; `REVOKE ALL FROM PUBLIC, anon`;
explicit `GRANT EXECUTE TO authenticated, service_role`. **CRITICAL**
— closed a fully-unauthenticated, cross-tenant movement-cancellation
exploit.

## 2. `20260917150029_ic7_close_posted_header_guc_bypass.sql`

`CREATE OR REPLACE FUNCTION inventory_prevent_header_modification()`
and `inventory_prevent_line_modification()` — removed the GUC as an
authorization signal entirely; headers now validated via exact-delta +
double-link-back-to-a-real-900-type-row substance checks; lines now
unconditionally denied post-posting (no legitimate write path exists).
**CRITICAL** — closed the long-disclosed posted-header GUC "bypass."

## 3. `20260917150202_ic7_fix_null_comparison_fail_open_guard_triggers.sql`

`CREATE OR REPLACE FUNCTION inventory_guard_balance_write()` and
`inventory_guard_settings_write()` — `COALESCE(current_setting(...),
'off') <> 'on'` replacing the bare `<>` comparison that evaluated to
`NULL` (falsy) when the GUC was never set. **CRITICAL, newly
discovered this phase** — the balance-write guard failed OPEN by
default for any session that never touched the GUC at all, no bypass
trick required.

## 4. `20260917150506_ic7_harden_save_draft_and_reconcile_balances.sql`

`CREATE OR REPLACE FUNCTION inventory_save_draft(...)` — same actor+
permission pattern as #1. `CREATE OR REPLACE FUNCTION inventory_
reconcile_balances(uuid,uuid,uuid)` — new 3-arg signature (actor param
added), `LANGUAGE sql` → `LANGUAGE plpgsql` (to permit the actor
check), old 2-arg signature explicitly `DROP FUNCTION`ed. **CRITICAL**
— closed two more fully-unauthenticated exploits (a draft-rewrite
exploit and a cross-tenant diagnostic-read exploit).

## 5. `20260917150706_ic7_reservation_allocation_container_restrictive_rls.sql`

New `RESTRICTIVE` `USING(false)`/`WITH CHECK(false)` policies for
`INSERT`/`UPDATE`/`DELETE` on `inventory_reservations`, `inventory_
reservation_lines`, `inventory_allocations`, `inventory_allocation_
lines`, `inventory_containers`, `inventory_container_lines` — the exact
pattern IC-4/IC-5 already proved safe. Existing `PERMISSIVE`/`SELECT`
policies untouched. **Long-disclosed IC-0 finding, finally closed.**

## 6. `20260917150959_ic7_harden_reservation_allocation_rpcs.sql`

`CREATE OR REPLACE FUNCTION inventory_create_reservation(...)`,
`inventory_release_reservation(...)`, `inventory_create_allocation
(...)`, `inventory_release_allocation(...)` — converted from implicit
`SECURITY INVOKER` to `SECURITY DEFINER` (required for migration #5's
own RLS not to also block these RPCs' own legitimate writes — discovered
live, fixed forward in the same phase); added actor-identity checks;
unified the two release functions' own existence-leak error messages
to `P0002`. All business logic byte-for-byte unchanged.

## 7. `20260917151236_ic7_close_status_blind_insert_gap.sql`

New `RESTRICTIVE` policies on `inventory_movement_headers`/`inventory_
movement_lines`'s own `INSERT`, requiring `status='draft'` (headers) or
a `status='draft'` parent header (lines). **IC-0's own finding, plus a
newly-discovered extension to lines** (fabricated-new-line injection
into an already-posted, genuine movement) — both closed.

## 8. `20260917151417_ic7_harden_approve_count_session.sql`

`CREATE OR REPLACE FUNCTION inventory_approve_count_session(...)` —
added actor-identity check; `REVOKE ALL FROM PUBLIC, anon`. Remains
`SECURITY INVOKER` (its own nested calls into the hardened engine
already provide the real boundary for non-trivial approvals).

## 9. `20260917151537_ic7_grant_hygiene_internal_helper_and_triggers.sql`

`REVOKE ALL ... FROM PUBLIC, anon` on `inventory_get_or_create_
balance_for_update` (kept `authenticated`/`service_role`) and 8 trigger
functions (`RETURNS trigger`, not meaningfully PostgREST-RPC-callable
regardless). Grant-hygiene only, no live exploit found for these 9.

## Order and dependency reasoning

1 → 2 → 3 are independent CRITICAL fixes, applied in discovery order.
4 continues the same actor/permission pattern. 5 → 6 are a dependent
pair (5's own RLS would have broken 6's own targets' legitimate writes
without 6; discovered live and fixed within the same phase, not
deferred — see `security-evidence.md` item 6 for the full narrative).
7, 8, 9 are independent, applied last as lower-urgency hardening/
hygiene items once the critical exploits were closed.

## Local mirroring

All 9 mirrored under their exact live-reported timestamps in `apps/web/
supabase-target/supabase/migrations/`, matching this project's
established live-first, mirror-second discipline. None were edited
after being applied — each fix (including the mid-phase 5→6 correction)
is its own separate forward migration.

## Zero data destruction

No table dropped, no history row deleted. `inventory_reconcile_
balances`'s own old 2-arg overload was dropped (a function signature,
not data) after confirming zero application callers. No pre-existing
`inventory_settings`/`inventory_balances`/`inventory_reservations`/
`inventory_allocations`/`inventory_containers` row was touched by any
of these 9 migrations — all are function/trigger/policy definitions
only.

## IC-7 CLOSING PASS (2026-09-19) — 4 additional migrations

A narrow follow-up pass closing the 7 disclosed-but-deferred product/
procurement/audit-domain mutation/read functions, plus 1 newly-found
item (`inventory_convert_quantity`, zero permission check). Core IC-7
(the 9 migrations above) remained completely frozen — none were
touched, edited, or reopened.

10. `20260919093552_ic7_closing_harden_product_po_count_session_actor_
and_grants.sql` — `inventory_create_product_with_default_variant`:
    added the standard actor-identity check; `REVOKE ALL FROM PUBLIC,
anon` + explicit `GRANT ... TO authenticated, service_role`.
11. `20260919093630_ic7_closing_harden_enhanced_product_actor_and_
grants.sql` — `inventory_create_enhanced_product`: same pattern
    (its own internal call into #10 already passes the now-validated
    actor through, so this is a defense-in-depth double-check, not
    redundant given it is independently reachable).
12. `20260919093655_ic7_closing_harden_purchase_order_and_count_
session_actor_and_grants.sql` — `inventory_create_purchase_order`
    and `inventory_create_count_session`: same pattern, bundled since
    both are Procurement/Audit-domain mutation functions with an
    identical fix shape.
13. `20260919093709_ic7_closing_grant_hardening_valuation_and_
sensitive_reads.sql` — grant-only (no body change) hardening for
    `inventory_create_valuation_snapshot` (no actor param exists, see
    `security-evidence.md` item 14), `inventory_count_session_list`,
    `inventory_find_sku_collisions`, and `inventory_convert_quantity`
    (the newly-found zero-permission-check item).

All 4 live-verified via `pg_get_function_identity_arguments`/
`has_function_privilege` for `anon`/`public`/`authenticated`/
`service_role`, plus a live duplicate-signature check (0 found) — see
`function-grant-matrix.md`'s own updated tables. Zero data destruction:
all 4 are function/grant definitions only, no table/row touched.
Mirrored locally under their exact live-reported timestamps, same as
the original 9.
