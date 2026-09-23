# Inventory Core — A1–A6 Simplification Pass — Test Evidence

## pgTAP regression, 097–113 (17 files) — full, clean

Run live against `supabase-target` via `mcp__supabase-target__execute_sql`,
each file's exact, unmodified SQL body (self-contained `BEGIN`...`SELECT
plan(N)`...assertions...`ROLLBACK`).

| File                                                                         | plan(N) | Result                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 097_repair_order_line_movement_attach_phase10_test.sql                       | 29      | 29/29 ok                                                                                                                                                                                                                                                              |
| 098_repair_order_line_reservation_phase10a_test.sql                          | 17      | 17/17 ok                                                                                                                                                                                                                                                              |
| 099_repair_order_line_allocation_phase10b_test.sql                           | 20      | 20/20 ok                                                                                                                                                                                                                                                              |
| 100_repair_order_container_orchestration_phase10c_test.sql                   | 44      | 44/44 ok                                                                                                                                                                                                                                                              |
| 101_zone3_zone5_movement_engine_reserved_blindspot_characterization_test.sql | 17      | 17/17 ok                                                                                                                                                                                                                                                              |
| 102_ic1_reserved_only_hard_invariant_test.sql                                | 11      | 11/11 ok                                                                                                                                                                                                                                                              |
| 103_ic2_movement_reversal_test.sql                                           | 35      | 35/35 ok                                                                                                                                                                                                                                                              |
| 104_ic3_receiving_consolidation_test.sql                                     | 44      | 44/44 ok                                                                                                                                                                                                                                                              |
| 105_ic7a_movement_engine_security_boundary_test.sql                          | 29      | 29/29 ok                                                                                                                                                                                                                                                              |
| 106_ic4_branch_transfer_test.sql                                             | 87      | 87/87 ok                                                                                                                                                                                                                                                              |
| 107_ic5_repair_order_projection_test.sql                                     | 46      | 46/46 ok                                                                                                                                                                                                                                                              |
| 108_ic6_legacy_cleanup_test.sql                                              | 23      | 23/23 ok                                                                                                                                                                                                                                                              |
| 109_ic6a_opening_stock_repair_test.sql                                       | 16      | 16/16 ok                                                                                                                                                                                                                                                              |
| 110_ic7_security_write_boundary_test.sql                                     | 25      | 25/25 ok                                                                                                                                                                                                                                                              |
| 111_ic7_closing_security_test.sql                                            | 24      | 24/24 ok (including the corrected scenario A8, verbatim: `A8: inventory_convert_quantity no longer exists (removed as dead code by the A1 simplification pass, superseding the grant-hardening closure this scenario originally proved)`, SQLSTATE 42883 as expected) |
| 112_pre_ic8_p0_balance_settings_guc_boundary_test.sql                        | 20      | 20/20 ok                                                                                                                                                                                                                                                              |
| 113_a1_a4_simplification_security_test.sql (new)                             | 7       | 7/7 ok                                                                                                                                                                                                                                                                |

**TOTAL: 494/494 assertions passing across all 17 files. Zero
failures anywhere.**

`29+17+20+44+17+11+35+44+29+87+46+23+16+25+24+20+7 = 494`.

Every file's `BEGIN...ROLLBACK` wrapper executed cleanly; no residual
state was left in the live target DB by any file, confirmed both by the
regression run itself and by an independent zero-residual query below.

File 113 (this pass's own new file) was additionally hand-verified
directly by this pass before delegating the full regression, including
self-catching and fixing 2 authoring bugs before trusting any result: a
top-level `PERFORM` (invalid outside a PL/pgSQL block — must be
`SELECT` at top level) used in 6 places, and a `plan(8)` declared
against only 7 real assertions (fixed to `plan(7)`).

## Vitest

### Relevant subset (RepairOrdersService, InventoryProductsService, InventoryEnterpriseService-derived, and their callers)

```
pnpm vitest run --reporter=verbose \
  src/server/services/__tests__/repair-orders.service.test.ts \
  src/server/services/__tests__/inventory-products.service.test.ts \
  src/server/services/__tests__/inventory-enterprise-update-variant-details.test.ts \
  src/app/actions/workshop/__tests__/repair-orders.test.ts \
  src/lib/types/__tests__/repair-orders.test.ts \
  src/app/[locale]/dashboard/workshop/_components/__tests__/repair-orders-search.test.tsx
```

**6 test files, 218 tests — all passing, exit code 0.** No existing
behavioral assertion needed its expected outcome changed (the one
dedicated test for a moved method, `updateVariantDetails`, needed only
an import/reference update from `InventoryEnterpriseService` to
`InventoryProductsService` — its own expectations were untouched and
still pass unmodified).

`InventoryMovementsService` has no dedicated unit test file in this
repo (confirmed by search) — not applicable, and moot regardless since
A5 (the only item touching that service) was rejected with zero code
changes.

## Type-check

`pnpm type-check` (`tsc --noEmit`) — **clean, exit code 0.**

## Lint

`pnpm lint` — **0 errors, 319 warnings, exit code 0.** Warning count
identical to the pre-existing baseline confirmed in every prior phase
this session — none introduced by this pass.

## Build

`pnpm build` (Next.js, Turbopack) — **clean, exit code 0.** "Compiled
successfully." Full production build (static + dynamic routes)
succeeded, run after both migrations and the full 097-113 regression.

## Formatting / diff-check

`git diff --check` — **clean, exit code 0**, on the final staged diff.
One genuine issue was caught and fixed during this pass: a trailing
blank line in `apps/public-web/.../ambra-location-inventory.ts` (a
failed `python3`-based trim attempt earlier in the pass silently did
nothing, since `python3` is not installed in this environment — caught
by `git diff --check` itself, not missed). Fixed with a working `sed`
command that trims trailing blank lines while preserving exactly one
final newline; re-checked clean.

## Concurrency

Not applicable / unaffected. A1 removes a function nothing calls. A2/A3
are pure TypeScript refactors with zero DB interaction of their own
(no new query, no new lock). A4 is a grant-only change — the function's
own `FOR UPDATE` locking statement, lock scope, and lock order are
completely untouched (confirmed by not modifying the function body at
all, only its grants). A5 made no changes. A6 is a pure code relocation
with zero RPC/query changes. No `concurrency-evidence.md` needed.

## Zero residual data

Live-confirmed after both migrations, the new pgTAP file's own manual
verification runs, and the full 17-file regression:

```sql
SELECT
  (SELECT count(*) FROM pg_proc WHERE proname = 'inventory_convert_quantity') AS convert_quantity_still_exists, -- 0
  (SELECT count(*) FROM warehouse_locations WHERE code LIKE '113-%') AS stray_113_locations,                    -- 0
  (SELECT count(*) FROM inventory_balances WHERE updated_at > now() - interval '20 minutes') AS recent_balance_updates, -- 0
  (SELECT count(*) FROM inventory_reservations WHERE reservation_number = 'RES-000009') AS stray_reservation;   -- 0 (rolled back)
```

All zero. No table dropped, no row permanently inserted/updated/deleted
outside a rolled-back transaction across the entire pass. Both applied
migrations are schema/permission-only (one `DROP FUNCTION`, one
`REVOKE`) — neither touches business data.
