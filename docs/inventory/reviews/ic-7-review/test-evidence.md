# IC-7 Test Evidence

## New pgTAP file: `110_ic7_security_write_boundary_test.sql`

`plan(25)`, final live result: **25/25, 0 failures.**

Scope: security/write-boundary surface only (not a re-test of IC-1
through IC-6A's own business semantics — those remain covered by
097-109):

- **T1/R1/S1** (3): legitimate canonical movement/reservation/
  allocation all still succeed.
- **A1/B1/B2** (3): posted-header GUC bypass fully closed — raw UPDATE
  denied with zero GUC manipulation, denied even with the GUC
  deliberately set, and `movement_type_code` (not just `document_
number`) confirmed protected.
- **D1/D2** (2): posted movement-line UPDATE denied (0 rows affected),
  quantity genuinely unchanged.
- **C1/C2** (2): legitimate reversal lifecycle transition still works
  end to end.
- **G1/H1/I1** (3): reservation raw INSERT/UPDATE/DELETE all denied.
- **J1/K1/L1** (3): allocation raw INSERT/UPDATE/DELETE all denied.
- **M1** (1): generic container raw INSERT denied.
- **N1/N2/N3** (3): internal helpers (`inventory_finalize_posting_
internal`, `write_repair_order_line_movement_link_internal`,
  `rebuild_repair_order_projection_bucket_internal`) remain non-
  executable by `authenticated`.
- **Q1** (1): anon denied at the grant level on `inventory_cancel_
movement`.
- **O1/P1** (2): actor-spoof and NULL-actor both rejected (`28000`).
- **E1** (1): cancel with wrong actor UUID denied.
- **F1** (1): cancel with real actor identity but zero branch
  permission denied with the same non-leaking `P0002` message as
  not-found.

### Self-caught test-design bug during authoring

The first draft created a reservation (5 units) + allocation (3 units)
against the SAME movement it then tried to reverse in Scenario C —
correctly tripping IC-1's own `P0003` "would strand committed stock"
invariant (proving the invariant itself still holds, but breaking this
test's own narrower "does the reversal lifecycle transition still
work" check, since the reversal call itself failed before reaching the
trigger logic under test). Fixed by adding a second, separate 10-unit
receipt specifically for the reservation/allocation scenarios, leaving
Scenario T's own movement fully uncommitted so Scenario C's own
reversal succeeds cleanly — matching this project's established
fixture-isolation discipline.

## Full regression 097–110

First pass (background agent, live execution of every file exactly as
committed, no SQL modified): **11 of 14 files fully green (362/362
assertions), 3 files (098, 099, 100 — 81 planned assertions) could not
execute at all.**

| File | Plan | Result (1st pass)        | Notes                                                       |
| ---- | ---- | ------------------------ | ----------------------------------------------------------- |
| 097  | 29   | 29/29                    | attach_repair_order_line_movement RPC, Phase 10 attribution |
| 098  | 17   | **0/17 — could not run** | fixture setup error, see below                              |
| 099  | 20   | **0/20 — could not run** | fixture setup error, see below                              |
| 100  | 44   | **0/44 — could not run** | fixture setup error, see below                              |
| 101  | 17   | 17/17                    | zone3↔zone5 blind-spot / IC-1 closure                       |
| 102  | 11   | 11/11                    | IC-1 hard reservation invariant                             |
| 103  | 35   | 35/35                    | IC-2 movement reversal                                      |
| 104  | 44   | 44/44                    | IC-3 receiving consolidation                                |
| 105  | 29   | 29/29                    | IC-7A emergency security boundary (anon exploit closure)    |
| 106  | 87   | 87/87                    | IC-4 branch transfer                                        |
| 107  | 46   | 46/46                    | IC-5 RepairOrder projection                                 |
| 108  | 23   | 23/23                    | IC-6 legacy writer/helper removal                           |
| 109  | 16   | 16/16                    | IC-6A opening-stock repair                                  |
| 110  | 25   | 25/25                    | IC-7 security/write-boundary closure (own new test)         |

**Root cause of 098/099/100's non-execution (investigated, not
assumed)**: all three predate IC-7 and each has a fixture-setup block
that raw-`INSERT`s a deterministic starting balance into
`inventory_balances` (`ON CONFLICT ... DO UPDATE`) without first
setting `ambra.inventory_movement_engine = 'on'`. Before IC-7's own
NULL-comparison fail-open fix
(`20260917150202_ic7_fix_null_comparison_fail_open_guard_triggers.sql`),
`inventory_guard_balance_write()` silently allowed this (the bug being
fixed). After the fix, the guard correctly fails closed and rejects
the raw insert with `P0001: inventory_balances can only be changed by
the movement engine` — before a single pgTAP assertion in these files
could run. This is the exact, intended effect of a disclosed IC-7
security fix, not a business-logic regression: every RPC these three
files exercise (`inventory_create_reservation`, `inventory_create_
allocation`, `inventory_add_to_container`, etc.) is proven working
end-to-end elsewhere in this same suite (097, 106, 110).

**Fix applied**: added `SET LOCAL ambra.inventory_movement_engine =
'on';` immediately before each raw fixture `INSERT INTO
inventory_balances`, matching the convention already used by 102/106/
107 (which never hit this problem because they already followed it).
This is a TEST FILE edit, not a migration edit — no already-applied
migration was touched — matching the exact precedent set by IC-6's own
fix to `102_ic1_reserved_only_hard_invariant_test.sql` (a test-fixture
correction to match a deliberate, intentional schema/behavior change,
not a code rollback).

**Second live finding during re-verification (also disclosed, also
fixed)**: after the fixture fix, file 100 itself surfaced two genuine
assertion failures — **T41/T42, "not ok"**, expecting a direct raw
`UPDATE` against a GENERIC (non-RepairOrder-owned) container to still
succeed (`have: 0, want: 1`). This was NOT a fixture problem — it
correctly detected that IC-7's own migration
`20260917150706_ic7_reservation_allocation_container_restrictive_rls.sql`
deliberately closed raw writes on `inventory_containers`/
`inventory_container_lines` for **all** rows, not just RepairOrder-
owned ones (that migration's own header comment explains: IC-6 had
already deleted the only legacy direct-writer, `ambra-location-
inventory.ts`'s 4 write actions, as confirmed-dead code, and a live
repo-wide grep during IC-7 confirmed zero remaining direct-table
writes anywhere — see `write-boundary-matrix.md`'s "generic rows" row,
already documented as "Closed (newly safe post-IC-6)" before this
regression run). T41/T42 simply predate that decision (they were
written for Phase 10C, when the legacy writer was still live). Updated
both assertions' own expected values (0 rows, not 1) and their
messages to state the current, correct, post-IC-7 contract, with an
inline comment explaining the full history. Re-ran 100 live after both
fixes.

**Second pass (after fixture + T41/T42 fixes, all three files
re-executed live in full)**:

| File | Plan | Result (2nd pass) |
| ---- | ---- | ----------------- |
| 098  | 17   | **17/17**         |
| 099  | 20   | **20/20**         |
| 100  | 44   | **44/44**         |

**Final regression totals, 097–110**: 14/14 files executable, **443/443
assertions passing, 0 failures.** Full 097-110 regression is clean.

Files 098, 099, 100 were modified this phase (fixture-only + two
corrected assertion expectations in 100 — no RPC, no migration, no
business-logic assertion changed). This is an addition to IC-7's own
changed-file list beyond the original 9 migrations + 1 new pgTAP file;
see `changed-files.md` for the updated count.

## New pgTAP file: `111_ic7_closing_security_test.sql`

`plan(24)`, final live result: **24/24, 0 failures.**

Covers the closing pass's own 8 hardened product/procurement/audit
functions:

- **A1-A8** (8): `anon` denied at the grant level on all 5 mutation
  functions plus the 3 tenant-sensitive read functions.
- **N1** (1): `inventory_build_sku_from_pattern` (genuinely pure,
  no table access) remains callable by `anon` — confirms hardening was
  targeted, not a blanket lockdown.
- **F1-F4** (4): actor-spoofing rejected (`28000`) on all 4
  actor-bearing mutation functions, using a REAL, different, existing
  user id (not a synthetic UUID, which would only trip an unrelated FK
  constraint and produce a false negative).
- **G1** (1): NULL actor rejected on `inventory_create_purchase_order`.
- **H1/H2/V1** (3): authenticated, real actor, zero permission —
  rejected at the permission check (`P0001`), not the actor check,
  isolating exactly which layer denies.
- **I1/I2/J1/K1** (4): legitimate operations succeed, and
  `created_by` is confirmed to equal the REAL caller (no longer
  forgeable, directly proving F1-F4's own fix).
- **V2** (1): the disclosed pre-existing `inventory_balance_
analytics` missing-relation bug in `inventory_create_valuation_
snapshot` is isolated — a permission-holding caller passes the
  authz boundary cleanly and fails only on `42P01`, not a permission
  error, distinguishing "denied by design" from "broken dependency."
- **GRANT-REGRESSION** (1): a classification-based live query (every
  `inventory_*` non-trigger function whose body writes via raw
  `INSERT`/`UPDATE`/`DELETE`) confirms zero such functions carry
  `anon` EXECUTE — this replaces a hardcoded function list and is
  designed to fail automatically if a FUTURE mutation RPC accidentally
  inherits `anon` EXECUTE from the schema-wide default privilege.
- **STALE-OVERLOAD** (1): zero duplicate signatures among the 8
  functions touched this pass.

### Genuine finding during authoring (not a test-design bug — a real vulnerability)

The first live probe of the actor-bearing functions used a synthetic
`gen_random_uuid()` as the "spoofed" actor and got a false negative
(`23503` FK-constraint violation, since that UUID doesn't exist in
`auth.users` — `created_by` columns are FK-constrained to real users).
Re-tested using a genuine second real user id from `auth.users`
(confirmed present in this org's own membership) and the spoofing
attempt SUCCEEDED pre-fix in all 4 cases — a real, previously
undisclosed actor-identity-forgery vulnerability, not a false alarm.
See `security-evidence.md` item 11 for the full account.

### Disclosed, out-of-scope, pre-existing defect found (not fixed, not a regression)

`inventory_create_valuation_snapshot`'s own body references `public.
inventory_balance_analytics`, which does not exist in this database
(`to_regclass(...)` returns `NULL`, live-confirmed). This function's
body was NOT edited by this pass (grant-only change), so this bug
predates the closing pass entirely — recorded rather than silently
worked around. Scenario V2 above proves the authorization boundary is
unaffected by this unrelated defect.

## Full regression 097–111 (closing pass)

Full live re-execution of all 15 files, exactly as committed, no SQL
modified, each in its own `BEGIN...ROLLBACK`:

| File | Plan | Result | Notes                                                                     |
| ---- | ---- | ------ | ------------------------------------------------------------------------- |
| 097  | 29   | 29/29  | attach_repair_order_line_movement RPC, Phase 10 attribution               |
| 098  | 17   | 17/17  | Phase 10A reservation integration                                         |
| 099  | 20   | 20/20  | Phase 10B allocation integration                                          |
| 100  | 44   | 44/44  | Phase 10C container orchestration (incl. post-IC-7 generic-container RLS) |
| 101  | 17   | 17/17  | zone3↔zone5 blind-spot / IC-1 closure                                     |
| 102  | 11   | 11/11  | IC-1 hard reservation invariant                                           |
| 103  | 35   | 35/35  | IC-2 movement reversal                                                    |
| 104  | 44   | 44/44  | IC-3 receiving consolidation                                              |
| 105  | 29   | 29/29  | IC-7A emergency security boundary                                         |
| 106  | 87   | 87/87  | IC-4 branch transfer                                                      |
| 107  | 46   | 46/46  | IC-5 RepairOrder projection                                               |
| 108  | 23   | 23/23  | IC-6 legacy writer/helper removal                                         |
| 109  | 16   | 16/16  | IC-6A opening-stock repair                                                |
| 110  | 25   | 25/25  | IC-7 security/write-boundary closure                                      |
| 111  | 24   | 24/24  | IC-7 closing pass (independently reproduced in this run)                  |

**Total: 467/467 assertions passing across all 15 files, 0 failures, 0
files that could not execute.** The full Inventory Core pgTAP suite is
clean after the closing pass's own grant/actor-identity changes —
confirming files 097-100's own IC-7-era fixes (fixture GUC + T41/T42)
remain correct, and confirming the closing pass's 4 new migrations did
not affect any of the physical-stock-movement surface (101-110), which
remained completely untouched this pass.

## Relevant Vitest / typecheck / lint / build

**No TypeScript or application file was changed** by either IC-7 or
its closing pass (13 migrations total, 2 new pgTAP files, 3 pgTAP
files fixture-corrected — 0 TypeScript files). Live-verified via grep
that neither `inventory_reconcile_balances` (arity change, original
IC-7) nor any of the closing pass's 8 hardened functions had their own
parameter names/positions changed — only internal validation logic
(actor checks) and grants were added.

Per this project's established convention, `pnpm build` is only
required when application/action TypeScript changes, which did not
happen here — but the closing pass's own task brief explicitly required
running the static/build gates regardless. All 4 were run directly
(not skipped):

- **`pnpm type-check`**: clean, zero errors.
- **`pnpm lint`**: **0 errors, 319 warnings** — all pre-existing,
  entirely inside `apps/web/temp/` scaffold directories unrelated to
  Inventory Core or this pass's own files (unused-import/no-img-element
  warnings in prototype components). Zero new errors introduced.
- **`pnpm build`**: succeeded, exit code 0, full route manifest
  generated cleanly.
- **`git diff --check`**: clean, zero whitespace/conflict-marker
  issues, across both the original IC-7 diff and the closing pass's
  own additions.

Relevant Vitest suites (every one touching a hardened RPC's own
TypeScript call site, run live):

- `inventory-count-sessions.service.test.ts` (approve_count_session,
  create_count_session)
- `count-sessions.test.ts` (server action layer for count sessions)
- `inventory-cross-branch-transfers.test.ts`
- `inventory-products.service.test.ts` (createProduct,
  createEnhancedProduct)
- `repair-orders.service.test.ts` (reservation/allocation RPCs)
- `wdd-matcher.service.test.ts`
- `wdd-matcher-movement-import-candidates.test.ts`
- `inventory-enterprise-update-variant-details.test.ts`

**Result: 8/8 files passing, 283/283 tests passing, 0 failures.**
(This includes the original IC-7's own 7-file/250-test run, re-run
together with `count-sessions.test.ts` added for the closing pass's
own product/procurement/audit-domain scope.)

## Zero residual data

Every security probe (both the ones performed ad hoc during
investigation and the new `110_...` pgTAP file itself) ran inside
`BEGIN...ROLLBACK`. Explicit final-state checks were run after each ad
hoc investigation transaction (branch/header/balance/reservation/
allocation/container row counts) confirming zero residue in every
case. `110_...`'s own branch number (780) is documented here for future
test-authoring collision avoidance, matching this project's established
convention.

## Concurrency

No dedicated concurrency test was added or is required — IC-7's own
changes are strictly RLS policies, grants, actor checks, and a trigger
redesign that preserves the exact same row-lock acquisition points
every legitimate caller already used (the `FOR UPDATE` statements
inside `inventory_finalize_posting_internal`/`inventory_create_
reservation`/etc. were not touched). No new lock primitive was
introduced; no change to lock order or which rows are locked by any
hardened function. IC-1 through IC-5's own genuine two-connection
concurrency proofs remain valid and were not re-run (matching this
project's own established "no new concurrency algorithm, no dedicated
rerun" convention when a phase is strictly a security/grant/RLS pass).
No `concurrency-evidence.md` file is included in this bundle, per the
task's own explicit instruction to omit it when no concurrency
behavior was genuinely tested/changed.
