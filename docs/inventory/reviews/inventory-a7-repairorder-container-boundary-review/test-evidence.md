# Inventory Core — A7 Domain-Boundary Cleanup — Test Evidence

## pgTAP regression, 097–114 (18 files) — full, clean

Run live against `supabase-target` via `mcp__supabase-target__execute_sql`,
each file's exact, unmodified SQL body.

| File                                                                         | plan(N) | Result                                          |
| ---------------------------------------------------------------------------- | ------- | ----------------------------------------------- |
| 097_repair_order_line_movement_attach_phase10_test.sql                       | 29      | 29/29 ok                                        |
| 098_repair_order_line_reservation_phase10a_test.sql                          | 17      | 17/17 ok                                        |
| 099_repair_order_line_allocation_phase10b_test.sql                           | 20      | 20/20 ok                                        |
| 100_repair_order_container_orchestration_phase10c_test.sql                   | 44      | 44/44 ok (disclosed T19 correction — see below) |
| 101_zone3_zone5_movement_engine_reserved_blindspot_characterization_test.sql | 17      | 17/17 ok                                        |
| 102_ic1_reserved_only_hard_invariant_test.sql                                | 11      | 11/11 ok                                        |
| 103_ic2_movement_reversal_test.sql                                           | 35      | 35/35 ok                                        |
| 104_ic3_receiving_consolidation_test.sql                                     | 44      | 44/44 ok                                        |
| 105_ic7a_movement_engine_security_boundary_test.sql                          | 29      | 29/29 ok                                        |
| 106_ic4_branch_transfer_test.sql                                             | 87      | 87/87 ok                                        |
| 107_ic5_repair_order_projection_test.sql                                     | 46      | 46/46 ok                                        |
| 108_ic6_legacy_cleanup_test.sql                                              | 23      | 23/23 ok                                        |
| 109_ic6a_opening_stock_repair_test.sql                                       | 16      | 16/16 ok                                        |
| 110_ic7_security_write_boundary_test.sql                                     | 25      | 25/25 ok                                        |
| 111_ic7_closing_security_test.sql                                            | 24      | 24/24 ok                                        |
| 112_pre_ic8_p0_balance_settings_guc_boundary_test.sql                        | 20      | 20/20 ok                                        |
| 113_a1_a4_simplification_security_test.sql                                   | 7       | 7/7 ok                                          |
| 114_a7_repairorder_container_boundary_test.sql (new)                         | 18      | 18/18 ok                                        |

**TOTAL: 512/512 assertions passing across all 18 files. Zero
failures anywhere.**

`29+17+20+44+17+11+35+44+29+87+46+23+16+25+24+20+7+18 = 512`.

File 100's scenario T19, verbatim, post-correction:

```
ok - T19: an allocation belonging to a DIFFERENT RepairOrder than the container's own owner is rejected (P0002), now enforced by the repair_order_add_allocation_to_container wrapper (A7)
```

T20/T21 and everything downstream (T22–T44) passed unchanged, exactly
as before this pass — confirming the T19 correction preserved every
other assertion's own expected value.

File 114's own 18 scenarios, all passing: A/A2 (same-RepairOrder
success + status transition), B (cross-RepairOrder rejection), C
(foreign-branch rejection), D (spoofed-actor rejection), E
(no-permission rejection), F (generic primitive unaffected for a
non-RepairOrder container), G1 (structural: zero real FROM/JOIN
references to `repair_order_lines`), G2 (behavioral: a direct call to
the narrowed generic primitive no longer enforces ownership — the
disclosed tradeoff), H1/H2 (quantity/location validation still
enforced through the wrapper), I1/I2 (no over-placement regression),
J1/J2 (atomic rollback — zero partial mutation from any rejected
attempt), SEC1/SEC2 (no stale overloads), SEC3 (anon denied at the
grant layer).

File 114 was additionally hand-verified directly by this pass before
delegating the full regression — including self-catching and fixing 2
authoring bugs: a `plan(16)`/18-assertion count mismatch, and a genuine
test-design bug where scenario G2's own deliberate successful
direct-generic-call placement silently invalidated the original
J1/J2 assertions (the file's own `allocline_b` gained a real,
successful container-link row from G2, so checking it for "zero" in
J1 would have been checking the wrong thing) — fixed by using
`allocline_c` (an allocation with no successful placement anywhere in
the file) for the atomicity proof instead, and recomputing J2's own
expected total (11, not 10, accounting for G2's own +1 contribution to
`container_a`).

## Vitest

### Relevant subset (RepairOrdersService + RepairOrder actions/components)

```
pnpm vitest run --reporter=verbose \
  src/server/services/__tests__/repair-orders.service.test.ts \
  src/app/actions/workshop/__tests__/repair-orders.test.ts \
  src/lib/types/__tests__/repair-orders.test.ts \
  src/app/[locale]/dashboard/workshop/_components/__tests__/repair-orders-search.test.tsx
```

**First run** (before fixing the mock's own RPC-name assertion): 1 of
199 tests failed — `RepairOrdersService.placeAllocationInContainer >
resolves allocation ownership via listAllocationsForLine and container
ownership via reference match, then maps params to inventory_add_to_
container correctly` — asserted the literal old RPC name string. This
is the exact, expected, necessary test-file update this pass's own
source change requires (the test over-specified an internal
implementation detail that legitimately changed).

**Fixed and re-run**: **4 test files, 199/199 tests — all passing,
exit code 0.** Only the RPC-name string in the assertion and the
test's own title changed; the mock setup, input params, and result
assertions are completely unchanged.

No `InventoryMovementsService` dedicated test file exists (confirmed
by search, matching the A1-A6 pass's own prior finding) — not
applicable, and this pass made zero changes to that service anyway.

## Type-check

`pnpm type-check` (`tsc --noEmit`) — **clean, exit code 0.**

## Lint

`pnpm lint` — **0 errors, 319 warnings, exit code 0.** Identical to the
pre-existing baseline confirmed in every prior phase this session —
none introduced by this pass.

## Build

`pnpm build` (Next.js, Turbopack) — **clean, exit code 0.** "Compiled
successfully." Full production build succeeded, run after both
migrations and the full 097-114 regression.

## Formatting / diff-check

`git diff --check` — **clean, exit code 0** on the final staged diff
(6 files: 2 migrations, 1 new test file, 1 corrected test file, 1
service file, 1 mock test file).

## Concurrency / TOCTOU

**Write-once assumptions re-verified live and confirmed still valid**
(see `boundary-evidence.md` for the full re-verification). The
wrapper's own validation and the nested generic call execute in one
DB transaction (a single PL/pgSQL function invocation calling another
function — no second client round-trip, confirmed by the migration's
own `RETURN public.inventory_add_to_container(...)` call shape). The
wrapper introduces **no new row lock** (its own read of `inventory_
containers`/`inventory_allocation_lines` is deliberately unlocked,
relying on the write-once invariant for safety — see `boundary-
evidence.md`'s explicit design-choice disclosure), **no new lock
order**, and **no mutable checked field** — matching the "a new
two-session concurrency test is not automatically required" condition
the task's own §16 describes. No new two-session concurrency test was
run; none was required. No `concurrency-evidence.md` in this bundle.

## Zero residual data

Live-confirmed after both migrations, all manual live-probe runs
(pre- and post-narrowing), and the full 18-file regression:

```sql
SELECT
  (SELECT count(*) FROM repair_orders WHERE order_number LIKE '114-%' OR order_number LIKE '100-test%') AS stray_repair_orders, -- 0
  (SELECT count(*) FROM inventory_containers WHERE code LIKE '114-%') AS stray_114_containers,                                  -- 0
  (SELECT count(*) FROM inventory_balances WHERE updated_at > now() - interval '25 minutes') AS recent_balance_updates,        -- 0
  (SELECT count(*) FROM branches WHERE name LIKE '114-test%') AS stray_branches;                                               -- 0
```

All zero. Every pgTAP file is self-contained `BEGIN...ROLLBACK`; every
manual live-probe this pass used the same disposable-transaction
pattern. No table dropped, no row permanently inserted/updated/deleted
outside a rolled-back transaction, across the entire pass.
