# Inventory Core — A7 Follow-Up Correction Pass — Test Evidence

## Full pgTAP regression: 097–115 (19 files)

Run live against `supabase-target` via `mcp__supabase-target__execute_sql`,
each file's exact on-disk content executed verbatim as a single SQL
statement (each file self-wraps in its own `BEGIN ... ROLLBACK`, so no
external transaction wrapper was added, no file was modified, no
migration was applied during the run). Delegated to a background
agent given the size (19 files); its per-file report is reproduced
below and was cross-checked against this session's own independent
live re-run of file 100 (see next section) before being trusted.

All 19 files are self-contained (own fixture creation, own
`BEGIN`/`ROLLBACK`) — none depend on state from a prior file in the
sequence. Every file ended in `ROLLBACK` as written; none committed,
so no residual test data was left in the live DB from the regression
run itself.

| #   | File                                                                           | Plan | Pass | Fail |
| --- | ------------------------------------------------------------------------------ | ---- | ---- | ---- |
| 1   | `097_repair_order_line_movement_attach_phase10_test.sql`                       | 29   | 29   | 0    |
| 2   | `098_repair_order_line_reservation_phase10a_test.sql`                          | 17   | 17   | 0    |
| 3   | `099_repair_order_line_allocation_phase10b_test.sql`                           | 20   | 20   | 0    |
| 4   | `100_repair_order_container_orchestration_phase10c_test.sql`                   | 44   | 44   | 0    |
| 5   | `101_zone3_zone5_movement_engine_reserved_blindspot_characterization_test.sql` | 17   | 17   | 0    |
| 6   | `102_ic1_reserved_only_hard_invariant_test.sql`                                | 11   | 11   | 0    |
| 7   | `103_ic2_movement_reversal_test.sql`                                           | 35   | 35   | 0    |
| 8   | `104_ic3_receiving_consolidation_test.sql`                                     | 44   | 44   | 0    |
| 9   | `105_ic7a_movement_engine_security_boundary_test.sql`                          | 29   | 29   | 0    |
| 10  | `106_ic4_branch_transfer_test.sql`                                             | 87   | 87   | 0    |
| 11  | `107_ic5_repair_order_projection_test.sql`                                     | 46   | 46   | 0    |
| 12  | `108_ic6_legacy_cleanup_test.sql`                                              | 23   | 23   | 0    |
| 13  | `109_ic6a_opening_stock_repair_test.sql`                                       | 16   | 16   | 0    |
| 14  | `110_ic7_security_write_boundary_test.sql`                                     | 25   | 25   | 0    |
| 15  | `111_ic7_closing_security_test.sql`                                            | 24   | 24   | 0    |
| 16  | `112_pre_ic8_p0_balance_settings_guc_boundary_test.sql`                        | 20   | 20   | 0    |
| 17  | `113_a1_a4_simplification_security_test.sql`                                   | 7    | 7    | 0    |
| 18  | `114_a7_repairorder_container_boundary_test.sql`                               | 18   | 18   | 0    |
| 19  | `115_a7_correction_generic_container_eligibility_test.sql`                     | 14   | 14   | 0    |

**Total: 526 assertions, 526 passing, 0 failures, 0 errors.** Every
file's live assertion count matched its own `plan(N)` declaration
exactly.

File 100 notably includes the T2/T5/T9/T15/T30 scenarios rerouted
through `repair_order_add_allocation_to_container` by this pass — all
five, plus every other assertion in that file, passed. File 114
(modified — G2 flip, J2 correction) — 18/18. File 115 (new) — 14/14.

## Independent re-verification of file 100

Before delegating the full regression, this session independently
executed the complete, fully-corrected 809-line
`100_repair_order_container_orchestration_phase10c_test.sql` live
against `supabase-target` and confirmed, via the file's own summary
query, `not_ok_count = 0, total_assertions = 44` — matching the
background agent's own later result exactly.

## Vitest

Ran the 3 test files referencing repair-orders code
(`src/server/services/__tests__/repair-orders.service.test.ts`,
`src/app/actions/workshop/__tests__/repair-orders.test.ts`,
`src/lib/types/__tests__/repair-orders.test.ts`):

```
Test Files  3 passed (3)
     Tests  196 passed (196)
```

Zero TypeScript files changed this pass, so this result was expected
unchanged from the A7 base pass — re-run anyway per this project's
established discipline of not assuming unaffected suites still pass.

## Static / build gates

- `pnpm type-check` — clean, zero errors.
- `pnpm lint` — 0 errors, 319 pre-existing warnings (all in unrelated
  `temp/` scratch directories, none touched by this pass).
- `pnpm build` — succeeded, full route manifest generated.
- `git diff --check` — clean on all changed/new files (no whitespace
  errors).

## Zero residual test data (independent confirmation)

Beyond every pgTAP file's own `ROLLBACK`, independently queried the
live DB after the full regression for any leftover fixture rows
matching this pass's own test markers:

```sql
containers: 0, repair_orders: 0, recent_links (last 1h): 0, recent_containers (last 1h): 0
```

No residual data from this pass or the regression run.
