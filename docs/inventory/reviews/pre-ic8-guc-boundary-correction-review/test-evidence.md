# PRE-IC8 P0 — Test Evidence

## pgTAP regression, 097–112 — full, honest history (3 runs, not just the final clean one)

Per this project's own standing discipline ("do NOT falsely claim only-audited
as verified"), all 3 runs are recorded here, not just the final clean one.

### Run 1 (partial — background agent hit an unrelated session rate limit)

Launched after migrations 1–8 were applied. Got through files 097–103 before
the agent process hit `HTTP 429 rate_limit` (session limit, unrelated to this
work) and stopped. Captured before it stopped: **103 passed 35/35 ok**. Files
104–112 not attempted in this run. Not otherwise relied upon below — Run 2
independently re-verified 097–103 from scratch rather than trusting this
partial result.

### Run 2 (full, after migrations 1–8 — found a genuine regression)

15 of 16 files passed clean. **`111_ic7_closing_security_test.sql` failed 3 of
24 assertions** — scenarios I1, I2, J1, verbatim:

```
not ok 18 - I1: legitimate create_product_with_default_variant unexpectedly rejected: 42501 permission denied for function inventory_ensure_settings_row_internal
not ok 19 - I2: legitimate create_enhanced_product unexpectedly rejected: 42501 permission denied for function inventory_ensure_settings_row_internal
not ok 20 - J1: legitimate create_purchase_order unexpectedly rejected: 42501 permission denied for function inventory_ensure_settings_row_internal
```

Root cause (live-verified, not guessed): migration 8
(`20260919165805_pre_ic8_p0_fix_settings_warmup_via_internal_helper.sql`)
created `inventory_ensure_settings_row_internal` (`SECURITY DEFINER`, owner
`postgres`) correctly, but then ran `REVOKE ALL ... FROM authenticated` on it
alongside `anon`/`PUBLIC` — one role too many. Because
`inventory_create_product_with_default_variant`/`inventory_create_purchase_
order` are `SECURITY INVOKER` (confirmed live, `prosecdef = false`), their
nested call to the new helper executes under the CURRENT role
(`authenticated`), not the helper's own definer — so the `EXECUTE` privilege
check on the helper was evaluated against `authenticated`, which had just
been revoked. See `security-evidence.md` self-caught-bug #6 and
`migration-summary.md` migration 9 for the full root-cause writeup and fix.

Fixed forward by migration 9
(`20260922053110_pre_ic8_p0_fix_settings_warmup_helper_grant_authenticated.sql`),
which restores `EXECUTE` on the helper for `authenticated` only (`anon`/
`PUBLIC` remain revoked). Live-verified two ways before re-running the full
suite: (a) `has_function_privilege` grant inspection
(`authenticated_can_execute: true`, `anon_can_execute: false`,
`is_security_definer: true`), and (b) an actual end-to-end call —
`inventory_create_product_with_default_variant` invoked as a real
`authenticated` session inside a disposable rolled-back transaction,
returning a genuine `{sku, product_id, variant_id}` result.

### Run 3 (full, after migration 9 — clean)

**ALL 16 FILES CLEAN. 487/487 ASSERTIONS PASSING.**

| File                                                                         | plan(N) | Result   |
| ---------------------------------------------------------------------------- | ------- | -------- |
| 097_repair_order_line_movement_attach_phase10_test.sql                       | 29      | 29/29 ok |
| 098_repair_order_line_reservation_phase10a_test.sql                          | 17      | 17/17 ok |
| 099_repair_order_line_allocation_phase10b_test.sql                           | 20      | 20/20 ok |
| 100_repair_order_container_orchestration_phase10c_test.sql                   | 44      | 44/44 ok |
| 101_zone3_zone5_movement_engine_reserved_blindspot_characterization_test.sql | 17      | 17/17 ok |
| 102_ic1_reserved_only_hard_invariant_test.sql                                | 11      | 11/11 ok |
| 103_ic2_movement_reversal_test.sql                                           | 35      | 35/35 ok |
| 104_ic3_receiving_consolidation_test.sql                                     | 44      | 44/44 ok |
| 105_ic7a_movement_engine_security_boundary_test.sql                          | 29      | 29/29 ok |
| 106_ic4_branch_transfer_test.sql                                             | 87      | 87/87 ok |
| 107_ic5_repair_order_projection_test.sql                                     | 46      | 46/46 ok |
| 108_ic6_legacy_cleanup_test.sql                                              | 23      | 23/23 ok |
| 109_ic6a_opening_stock_repair_test.sql                                       | 16      | 16/16 ok |
| 110_ic7_security_write_boundary_test.sql                                     | 25      | 25/25 ok |
| 111_ic7_closing_security_test.sql                                            | 24      | 24/24 ok |
| 112_pre_ic8_p0_balance_settings_guc_boundary_test.sql                        | 20      | 20/20 ok |

`29+17+20+44+17+11+35+44+29+87+46+23+16+25+24+20 = 487`.

File 111's I1/I2/J1, verbatim, now passing:

```
ok 18 - I1: legitimate create_product_with_default_variant succeeds, created_by = real caller (not forgeable)
ok 19 - I2: legitimate create_enhanced_product succeeds
ok 20 - J1: legitimate create_purchase_order succeeds, created_by = real caller (not forgeable)
```

File 112 (this pass's own new test file): 20/20 exactly as its `plan(20)`
declares — every adversarial scenario (A–G) denied, every legitimate scenario
(H–Q) succeeds, both invariant scenarios (R–S) hold.

Files 097/101/103/104/105/108/109 (expected fully unaffected by this pass):
confirmed passing at their pre-existing counts — no collateral regression.

## Vitest

### Inventory-scoped (the relevant subset for this pass)

Ran explicitly, even though zero TypeScript files changed this pass (per the
task's own requirement): `pnpm vitest run` scoped to
`src/server/services/__tests__/inventory-*` and
`src/app/actions/warehouse/inventory/__tests__/`.

**20 test files, 214 tests — all passing, exit code 0.**

### Full suite (context, not a gate for this pass)

Also ran the complete, unscoped Vitest suite for full honesty: **26 of 316
test files failed, 32 of 4505 tests failed** (288 files / 4456 tests passed,
8 skipped, 9 todo). Confirmed these are pre-existing and unrelated to this
pass — this pass changed zero `.ts`/`.tsx` files (`git status` confirms 0
TypeScript files touched), so nothing in this pass's diff could have caused
any of them. Two examples inspected directly: a Tools-module tab-selection
assertion (`tools-unified-client.test.tsx`) and a branch-field-mapping
assertion (`load-app-context.v2.test.ts`) — both entirely outside Inventory
Core, unrelated to `inventory_balances`/`inventory_settings` or either guard
trigger. Not investigated further or fixed — genuinely out of this pass's own
narrow scope, and pre-existing (not introduced by this pass).

## Type-check

`pnpm type-check` (`tsc --noEmit`) — **clean, exit code 0.**

## Lint

`pnpm lint` — **0 errors, 319 warnings, exit code 0.** Warning count matches
the project's known pre-existing baseline (unrelated files under `temp/` and
elsewhere); none introduced by this pass (zero TypeScript files changed).

## Build

`pnpm build` (Next.js 16.1.7, Turbopack) — **clean, exit code 0.** Full
production build (static + dynamic routes) succeeded, run after all 9
migrations and the third (clean) pgTAP regression.

## Concurrency — unaffected

No row-lock acquisition point, lock order, or lock scope changed by this
pass. Verified by re-reading the final bodies of both guard trigger
functions end to end: neither contains any explicit locking (`FOR UPDATE`,
advisory locks, etc.) of its own — they are `BEFORE INSERT/UPDATE/DELETE`
triggers that inspect `NEW`/`OLD` and either `RAISE EXCEPTION` or
`RETURN NEW`. The actual row locks in every write path (`SELECT ... FOR
UPDATE` inside `inventory_get_or_create_balance_for_update` and every
canonical RPC that calls it) are in RPC bodies this pass did not touch,
except for the 2 lines swapped for a `PERFORM ...ensure_settings_row_
internal(...)` call in migration 8 — a straight-line substitution for an
inline `INSERT ... ON CONFLICT DO NOTHING`, with the exact same statement,
same table, same conflict target, same transaction, executed at the exact
same point in control flow, just now inside a `SECURITY DEFINER` helper
instead of inlined. No new lock is acquired, no existing lock is held longer
or shorter, no lock is acquired in a different order relative to any other
lock in the same transaction. No concurrency proof needed re-running; no
`concurrency-evidence.md` in this bundle.

## Zero residual data

Live-confirmed after all 9 migrations, all live reproduction/verification
probes (including migration 9's own end-to-end `authenticated`-role
verification call), and all 3 pgTAP regression runs:

```sql
SELECT
  (SELECT count(*) FROM inventory_products WHERE name LIKE '%pre-ic8-p0-fix-verify%') AS verify_products,      -- 0
  (SELECT count(*) FROM branches WHERE name LIKE '097-test%' OR branch_number IN (850,851,993)) AS stray_branches, -- 0
  (SELECT count(*) FROM organizations WHERE name LIKE '097-test%') AS stray_orgs,                              -- 0
  (SELECT count(*) FROM inventory_balances WHERE updated_at > now() - interval '15 minutes') AS recent_balance_updates, -- 0
  (SELECT count(*) FROM inventory_settings WHERE updated_at > now() - interval '15 minutes') AS recent_settings_updates; -- 0
```

All zero. Every pgTAP file is self-contained `BEGIN...ROLLBACK`; every
manual live-reproduction/verification probe this pass used the same
disposable-transaction pattern. No table dropped, no row permanently
inserted/updated/deleted outside a rolled-back transaction, across the
entire pass.
