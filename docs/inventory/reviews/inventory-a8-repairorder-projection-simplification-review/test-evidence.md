# Inventory Core — A8 RepairOrder Projection Simplification — Test Evidence

## Full pgTAP regression: 097–116 (20 files)

Run live against `supabase-target` via `mcp__supabase-target__execute_sql`,
each file's exact on-disk content executed verbatim as a single SQL
statement (each file self-wraps in its own `BEGIN ... ROLLBACK`, so no
external transaction wrapper was added, no file was modified, no
migration was applied during the run). Run twice end-to-end this pass: an
initial background-agent run was interrupted mid-flight by a session
restart (its process was lost, its partial findings discarded as
untrustworthy per this project's own established discipline of never
reporting an unconfirmed result), then re-run completely fresh
(idempotent — every file is self-contained `BEGIN`/`ROLLBACK`, so a
second full run carries no risk). All 20 files are self-contained (own
fixture creation, own `BEGIN`/`ROLLBACK`) — none depend on state from a
prior file in the sequence. Every file ended in `ROLLBACK` as authored;
none committed, so no residual test data was left in the live DB from the
regression run itself.

| #   | File                                                                                         | Plan | Pass | Fail |
| --- | -------------------------------------------------------------------------------------------- | ---- | ---- | ---- |
| 1   | `097_repair_order_line_movement_attach_phase10_test.sql`                                     | 29   | 29   | 0    |
| 2   | `098_repair_order_line_reservation_phase10a_test.sql`                                        | 17   | 17   | 0    |
| 3   | `099_repair_order_line_allocation_phase10b_test.sql`                                         | 20   | 20   | 0    |
| 4   | `100_repair_order_container_orchestration_phase10c_test.sql`                                 | 44   | 44   | 0    |
| 5   | `101_zone3_zone5_movement_engine_reserved_blindspot_characterization_test.sql` (patched: T2) | 17   | 17   | 0    |
| 6   | `102_ic1_reserved_only_hard_invariant_test.sql`                                              | 11   | 11   | 0    |
| 7   | `103_ic2_movement_reversal_test.sql`                                                         | 35   | 35   | 0    |
| 8   | `104_ic3_receiving_consolidation_test.sql` (patched: G6, G7)                                 | 44   | 44   | 0    |
| 9   | `105_ic7a_movement_engine_security_boundary_test.sql`                                        | 29   | 29   | 0    |
| 10  | `106_ic4_branch_transfer_test.sql`                                                           | 87   | 87   | 0    |
| 11  | `107_ic5_repair_order_projection_test.sql` (**REWRITTEN**)                                   | 31   | 31   | 0    |
| 12  | `108_ic6_legacy_cleanup_test.sql` (patched: D3, E7, E9, E10, E11, E12)                       | 23   | 23   | 0    |
| 13  | `109_ic6a_opening_stock_repair_test.sql`                                                     | 16   | 16   | 0    |
| 14  | `110_ic7_security_write_boundary_test.sql` (patched: N3)                                     | 25   | 25   | 0    |
| 15  | `111_ic7_closing_security_test.sql`                                                          | 24   | 24   | 0    |
| 16  | `112_pre_ic8_p0_balance_settings_guc_boundary_test.sql`                                      | 20   | 20   | 0    |
| 17  | `113_a1_a4_simplification_security_test.sql`                                                 | 7    | 7    | 0    |
| 18  | `114_a7_repairorder_container_boundary_test.sql`                                             | 18   | 18   | 0    |
| 19  | `115_a7_correction_generic_container_eligibility_test.sql`                                   | 14   | 14   | 0    |
| 20  | `116_a8_repairorder_projection_live_read_test.sql` (**NEW**)                                 | 17   | 17   | 0    |

**Total: 528 assertions, 528 passing, 0 failures, 0 errors.** (Independently
re-summed from the per-file table above; the regression agent's own
verbal summary stated 508, an arithmetic slip in its own addition — the
per-file pass/fail data itself, which is the load-bearing evidence, was
double-checked file-by-file and is accurate.) Every file's live assertion
count matched its own `plan(N)` declaration exactly.

**Files 101, 104, 108, 110** (patched mid-pass after a full repo-wide
grep found they referenced the now-removed schema objects) were each
independently re-verified live, with particular attention to whether any
missed reference would surface as a live SQL error (`relation ... does
not exist`, `function ... does not exist`) rather than a mere assertion
failure — none did. `108`'s own D3 and `110`'s own N3 (both rewritten
from a privilege-check on a now-nonexistent function to an existence
check) both correctly confirm `rebuild_repair_order_projection_bucket_internal`
has zero rows in `pg_proc`.

## Vitest

Ran the 3 test files referencing repair-orders code:

```
src/server/services/__tests__/repair-orders.service.test.ts — 161 tests
src/app/actions/workshop/__tests__/repair-orders.test.ts — 20 tests
src/lib/types/__tests__/repair-orders.test.ts — 17 tests

Test Files  3 passed (3)
     Tests  198 passed (198)
```

`repair-orders.service.test.ts` was substantially rewritten this pass
(the `getPhysicalStateForLine` mock builder extended with an `rpc` mock;
all 12 pre-existing cases updated to the new RPC shape; 2 new cases added
for the P0008 → `"inconsistent_history"` mapping and non-P0008 error
passthrough; the "unknown" case rewritten to a genuine Phase 10C
scenario) — 161/161 passing, up from the pre-pass count due to the 2
added cases.

## Static / build gates

- `pnpm type-check` — clean, zero errors (re-run after every TS edit
  this pass, including the intermediate error found and fixed: a known,
  already-documented `apps/web` tsconfig `strictNullChecks`/`ServiceResult`
  narrowing quirk in one new test's own negative-result assertion, fixed
  by casting to the failure branch shape, matching this file's own
  established pattern elsewhere).
- `pnpm lint` — 0 errors, 319 pre-existing warnings (all in unrelated
  `temp/` scratch directories, none touched by this pass).
- `pnpm build` — succeeded, full route manifest generated.
- `git diff --check` — clean on all changed/new files (no whitespace
  errors).

## Zero residual test data (independent confirmation)

Beyond every pgTAP file's own `ROLLBACK`, independently queried the live
DB after the full implementation for any leftover fixture rows matching
this pass's own test markers:

```sql
a8_repair_orders: 0, a8_branches: 0, recent_links (2h): 0, a8_movements (2h): 0
```

No residual data from this pass, from either regression run, or from the
individual live-verification probes performed throughout implementation
(the P0008 reproduction, the reversal-awareness fix verification, the
putaway concurrency-bug reproductions, the performance timing runs — all
used `BEGIN`/`ROLLBACK`).
