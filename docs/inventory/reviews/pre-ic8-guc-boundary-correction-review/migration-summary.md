# PRE-IC8 P0 — Migration Summary

9 migrations, all applied live via MCP, live-verified independently
(never trusting `apply_migration`'s own success response), then
mirrored locally under `apps/web/supabase-target/supabase/migrations/`
using the exact live-reported timestamp. Applied in the order listed —
migrations 4-6 are self-caught forward corrections to migrations 2-3,
found during this pass's own hand-authored pgTAP probes; migrations
7-9 are self-caught forward corrections found later, by full 097-112
regression runs (not the hand-authored probes) — none deferred.

## 1. `20260919150859_pre_ic8_p0_revoke_authenticated_anon_raw_write_balances_settings.sql`

`REVOKE INSERT, UPDATE, DELETE ON inventory_balances, inventory_
settings FROM authenticated, anon`. The primary structural fix —
closes the exploit at the grant layer, before RLS or any trigger is
ever reached. **Later partially corrected** by migration 6, which
restores `UPDATE` on `inventory_settings` for `authenticated` (see
below) — `inventory_balances`'s own REVOKE is untouched by that
correction and remains fully in place.

## 2. `20260919150916_pre_ic8_p0_redesign_balance_guard_substance_validation.sql`

`CREATE OR REPLACE FUNCTION inventory_guard_balance_write()` —
substance-validated delta-shape check replacing the GUC-trust-alone
logic. This version additionally required `last_movement_id IS NOT
NULL` on any on_hand-changing UPDATE — **superseded by migration 4**.

## 3. `20260919150930_pre_ic8_p0_redesign_settings_guard_column_ownership.sql`

`CREATE OR REPLACE FUNCTION inventory_guard_settings_write()` —
column-ownership check (settings-manager: any column; engine-GUC-only:
numbering counters alone) replacing the GUC-trust-alone logic. Not
itself superseded — still the live, final version.

## 4. `20260919152457_pre_ic8_p0_simplify_balance_guard_drop_movement_reference_check.sql`

Forward correction to migration 2. Dropped the `last_movement_id IS
NOT NULL` sub-check — added no real security value beyond the REVOKE
(never validated change magnitude, only non-nullness) and created
friction for legitimate non-RPC uses of a real on_hand-only update
(e.g. `107_ic5_repair_order_projection_test.sql`'s own fixture). The
core delta-shape property (on_hand cannot combine with a commitment
change; no other column may change) is unaffected. **Superseded by
migration 5** for a separate reason (see below) — not because this
correction was itself wrong.

## 5. `20260919162500_pre_ic8_p0_fix_balance_guard_exclude_generated_column.sql`

Forward correction, self-caught during live testing: `available_
quantity` is a Postgres `GENERATED ALWAYS` column that automatically
changes whenever `on_hand_quantity`/`reserved_quantity`/`allocated_
quantity` change — it was missing from the "no other column may
change" exclusion list, causing the very first legitimate on_hand
change (a real receipt) to be incorrectly rejected. Added to the
exclusion array; no other logic changed. **This is the final, live
version of the balance guard.**

## 6. `20260919162643_pre_ic8_p0_restore_settings_update_grant_keep_trigger_as_boundary.sql`

Forward correction, self-caught during live testing of the new pgTAP
file's own "real settings manager can still edit a user-managed
setting" scenario: migration 1's blanket REVOKE on `inventory_
settings` closed the intended, designed (if not-yet-built) direct-
write path for a real settings manager along with the exploit.
`GRANT UPDATE ON inventory_settings TO authenticated` restores that
path; `INSERT`/`DELETE` remain revoked (no legitimate direct-client
scenario for either), `anon` remains fully revoked on all 3
operations, and `inventory_balances`'s own full REVOKE is completely
unaffected. The trigger's own column-ownership logic (migration 3)
remains the real security boundary for this specific table.

## 7. `20260919165733_pre_ic8_p0_fix_balance_guard_allow_genuine_noop_update.sql`

Forward correction, self-caught by the full 097-112 regression run (not
a hand-authored probe): files 098/099/100/102 failed outright, because
their own established 3-statement fixture-reset pattern (introduced by
this same pass, to satisfy the migration-5 shape rule) includes a
`SET reserved_quantity = 0, allocated_quantity = 0` step that becomes a
genuine no-op whenever the row's reserved/allocated already sit at 0 —
the common/default case, including immediately after a fresh
zero-quantity INSERT (102 proved this happens even on a brand-new row).
The guard's own "changes no recognized column" rejection incorrectly
fired for this harmless no-op. Fixed by explicitly allowing a true
no-op (nothing among on_hand/reserved/allocated actually changed value,
checked via `IS DISTINCT FROM`) to pass through before the
transition-shape checks run. **Required zero further changes to any
test file** — the fix makes the already-corrected fixture pattern work
as originally intended. **This is the final, live version of the
balance guard.**

## 8. `20260919165805_pre_ic8_p0_fix_settings_warmup_via_internal_helper.sql`

Forward correction, self-caught by the full 097-112 regression run:
`111_...`'s own I1/I2/J1 scenarios failed with `42501: permission
denied for table inventory_settings` for fully legitimate,
correctly-permissioned callers — not merely adversarial ones. Root
cause: `inventory_create_product_with_default_variant` and
`inventory_create_purchase_order` are `SECURITY INVOKER` (confirmed
live, `prosecdef = false`) and each performed its own inline
`inventory_settings` warm-up INSERT, which therefore ran as the
CALLING role (`authenticated`) — broken once `INSERT` was revoked from
`authenticated` on that table (migration 1; migration 6 restored only
`UPDATE`, not `INSERT`). Cross-checked: `inventory_create_allocation`/
`inventory_create_branch_transfer`/`inventory_create_reservation` do
the identical warm-up but are already `SECURITY DEFINER`, so none of
them were affected. Fixed by extracting the warm-up into one new,
narrow `SECURITY DEFINER` internal helper
(`inventory_ensure_settings_row_internal`, `EXECUTE` revoked from
`PUBLIC`/`anon`/`authenticated` — reachable only via same-owner nesting
or `service_role`) and having both broken functions call it instead of
inlining the raw INSERT. Deliberately did NOT convert either function
to `SECURITY DEFINER` outright — that would also have elevated their
OTHER writes (`inventory_products`/`inventory_variants`/`inventory_
purchase_orders`/`inventory_purchase_order_lines`) and changed their
entire RLS-interaction model, explicitly out of this pass's own narrow
scope ("do NOT redesign Inventory Core"). No other logic in either
function changed. **Required zero further changes to any test file** —
this fixed a genuine RPC-body bug, not a fixture-pattern issue.

## 9. `20260922053110_pre_ic8_p0_fix_settings_warmup_helper_grant_authenticated.sql`

Forward correction, self-caught by a full 097-112 regression re-run
(the SAME class of check as migrations 7-8, but this time the bug was
in migration 8 itself, not in the original design): migration 8's own
`REVOKE ALL ... FROM authenticated` on the new
`inventory_ensure_settings_row_internal` helper went one role too far.
`inventory_create_product_with_default_variant`/`inventory_create_
purchase_order` (and `inventory_create_enhanced_product`, which calls
the former internally) are `SECURITY INVOKER`, confirmed live
(`prosecdef = false`) — a SECURITY INVOKER function's nested call to
another function executes under the CURRENT role (the real invoking
role, `authenticated`), not as the definer of the callee, so the
EXECUTE privilege check on the internal helper is evaluated against
`authenticated`, which migration 8 had just revoked it from.
Live-reproduced via `111_...`'s own I1/I2/J1 scenarios still failing
with `42501: permission denied for function inventory_ensure_
settings_row_internal` even for fully legitimate,
correctly-permissioned callers. Fixed by restoring `EXECUTE` on the
helper for `authenticated` only — `anon`/`PUBLIC` remain revoked, the
helper is still unreachable except through same-owner nesting or a
nested call from these two permission-gated RPCs. Live-verified via a
disposable transaction: a real `authenticated` call to `inventory_
create_product_with_default_variant` now succeeds end-to-end
(`sku`/`product_id`/`variant_id` returned), rolled back. **This is the
final, live version of the settings-warmup fix.**

## Local mirroring

All 9 mirrored under their exact live-reported timestamps. None were
edited after being applied — every correction, including the five
same-day forward fixes, is its own separate migration.

## Zero data destruction

No table dropped, no history row touched, no data migrated or backfilled.
All 9 migrations are function/grant definitions only.
