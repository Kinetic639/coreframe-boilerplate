# IC-1 — Test & Concurrency Evidence

All results below are from this session's own live runs against
`supabase-target`, via Supabase MCP `execute_sql` (pgTAP) or a real `psql`
binary against two independent OS-level connections (concurrency). Nothing
here is inferred or fabricated.

## pgTAP regression (141/141, 0 failures — 102 extended 6→14 in the finalization pass)

| File                                                        | Result | Notes                                                                                                                                     |
| ----------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 097 (movement-line attach, Phase 10)                        | 29/29  | Unaffected by IC-1 (RepairOrderLine attribution, not the movement engine's own invariant).                                                |
| 098 (reservation, Phase 10A)                                | 17/17  | Unaffected (dedicated reservation RPC, never routes through `inventory_finalize_posting`).                                                |
| 099 (allocation, Phase 10B)                                 | 20/20  | Unaffected (dedicated allocation RPC).                                                                                                    |
| 100 (container orchestration, Phase 10C)                    | 44/44  | Unaffected (containers never touch `inventory_balances`).                                                                                 |
| 101 (movement-engine blind spot — **rewritten this phase**) | 17/17  | Expectations intentionally inverted; see below. Fixture fixed in the correction pass (below) to use its own isolated branch.              |
| 102 (reserved-only hard invariant — **new, then extended**) | 14/14  | New file (6/6); extended in the finalization pass with Scenario C (the permanent `negative_stock_policy` regression) to 14/14. See below. |

### Correction-pass finding: 101/102 fixture collision (fixed, not a code regression)

Re-running 101/102 via a fresh `psql` connection (rather than the original
MCP session) surfaced a real `duplicate key value violates unique
constraint "warehouse_locations_one_receiving_per_branch"` error. Root
cause: IC-1's own genuine two-session concurrency test (below) permanently
left a real `warehouse_locations` row occupying the shared test org/branch
pair's own "one receiving location per branch" slot (a live partial UNIQUE
INDEX), carrying a real, non-zero, undeletable balance residual for the
same shared `variant_1` fixture UUID. 101/102's own fixtures unconditionally
inserted a _new_ receiving location for that same shared branch, which now
always collides — and reusing the existing one instead would have silently
corrupted their own "before" balance assertions (it already carries 6
on-hand / 6 allocated). **Fixed**: both files now create their own fresh,
isolated `branches` row per run (mirroring 099/100's own established
`branch_b` convention). Re-verified live after the fix: 101 17/17, 102 6/6
(later extended to 14/14, see below), zero residual. This is a
test-fixture robustness fix only — no RPC, migration, or invariant logic
was touched.

### 101 — full assertion list (all passing)

T1-T6: fixture setup (receive 10, reserve 6, allocate 6 — reserved fully
converts to allocated) unaffected by IC-1, all pass exactly as before.

- **T7**: putaway of the full 10 units is now **REJECTED** (was: succeeded,
  pre-IC-1).
- **T8**: rejection carries SQLSTATE `P0003`.
- **T9**: source `on_hand` unchanged (still 10) — no partial write.
- **T10**: source `allocated` unchanged (still 6).
- **T11**: source `reserved` unchanged (still 0).
- **T12**: zero orphan `inventory_movement_headers` rows from the rejected
  attempt (header count identical before/after).
- **T13**: allocation line itself completely unaffected (still 6).
- **T14** (control): moving exactly the free 4 units **SUCCEEDS**.
- **T15-T17**: post-control balances correct (source on_hand=6, allocated=6
  unaffected, destination on_hand=4).

### 102 — full assertion list (all passing, new fixture: reserved=6, allocated=0)

- **T1**: moving all 10 (6 reserved, 0 allocated) **REJECTED**.
- **T2**: SQLSTATE `P0003`.
- **T3**: moving 5 (only 4 truly free) also **REJECTED**.
- **T4-T5**: balance unchanged after both rejections (on_hand=10,
  reserved=6).
- **T6** (control): moving exactly 4 **SUCCEEDS**.

This proves the engine protects the HARD-reservation invariant
(`reserved_quantity <= on_hand_quantity`) as a first-class case, not merely
as an incidental consequence of protecting `allocated_quantity`.

## Legitimate-movement regression (live, genuinely free stock)

Via `inventory_create_and_finalize` directly, fresh location pair, zero
reservation/allocation:

| Movement | Effect                                              | Result   |
| -------- | --------------------------------------------------- | -------- |
| 101      | destination increase, +20                           | `posted` |
| 401      | destination increase (surplus), +3                  | `posted` |
| 402      | source decrease (shortage), -5                      | `posted` |
| 801      | source decrease / dest increase (bin-to-bin), -6/+6 | `posted` |

Final balances: source = 20+3-5-6 = 12 (matches arithmetic exactly),
destination = 6. No legitimate movement was blocked.

## Genuine two-independent-connection concurrency proof

Real `psql` binary, two **separate OS processes/connections** against
`SUPABASE_TARGET_DB_URL` — not one transaction pretending to be concurrent.

**Fixture** (committed, durable): receive 10 → reserve 6 → allocate 6 (4
genuinely free) at a dedicated location.

**Session A** (launched first): `BEGIN`; `SET LOCAL ROLE authenticated`;
called `putaway_repair_order_stock` to move the exact free 4 units —
succeeded in 56ms, still holding the row lock; then `pg_sleep(5)`; then
`COMMIT`.

**Session B** (launched ~1.5s after A): `BEGIN`; attempted to move 4 units
to a _different_ destination.

**Timings** (wall-clock, `clock_timestamp()` markers + bash `date +%s.%N`):

```
launch_a                 = t+0.000s
a_start (after BEGIN/SET)= t+0.30s
a call succeeds           = t+0.38s   (56ms)
a begins pg_sleep(5)      = t+0.38s
launch_b                  = t+1.51s
b_start (after BEGIN/SET) = t+1.79s
b's putaway call BLOCKS...
a's pg_sleep ends, COMMIT = t+5.48s
b's call finally returns  = t+5.50s   (blocked ~3684ms)
b COMMIT                  = t+5.55s
```

Session B's own `putaway_repair_order_stock` call took **3683.937ms** —
genuine lock contention, not coincidental overlap — and resumed within 16ms
of Session A's actual COMMIT. Session B's call, once unblocked, correctly
re-evaluated the invariant against A's now-updated balance (on_hand=6 after
A's move, 6 still committed) and was **REJECTED**: `P0003 ... only
2.000000 would remain on hand`.

**No deadlock occurred.**

**Final state** (queried after both sessions completed): source balance
on_hand=6, allocated=6 (only A's move applied); destination_a on_hand=4;
destination_b has **no balance row at all** — B's rejected attempt left
zero footprint, not even an empty row.

**Lock-order inspection** (not rewritten): `inventory_finalize_posting`
locks one balance row per (line, effect) via `inventory_get_or_create_
balance_for_update`'s own `FOR UPDATE`. This phase's test constructs only a
single contended balance row per session — no cross-row lock-ordering
question arises here, and none was found requiring a change to the
architecture's own §8 lock-order convention.

## Residual data from the concurrency test (disclosed)

`inventory_movement_headers`/`inventory_movement_lines` are immutable once
posted (`inventory_prevent_line_modification` trigger — the same protection
IC-0 documented). Attempting to DELETE them during cleanup was correctly
blocked by the database itself:

```
ERROR: P0001: Cannot delete lines of a finalized movement (status=posted)
```

This is the system working as designed, not a bug — it was **not**
bypassed. As a result, 2 real, legitimately-posted movement headers
(`PZ/2026/000020` the receipt, `MM/2026/000004` Session A's move) and their
lines, the 3 `ic1-concurrency-*` `warehouse_locations` rows they reference
(undeletable once referenced by immutable lines), and 2 `inventory_
balances` rows accurately reflecting that real history remain live —
clearly named, internally consistent, not orphaned, not production
RepairOrder/customer data. All other synthetic scaffolding (reservation,
allocation, RepairOrder, RepairOrderLine, provenance chain, matcher
session) was successfully deleted after the test.

Every other test/probe this session ran inside `BEGIN ... ROLLBACK` and
left zero residual data — confirmed by direct query after each.

## `negative_stock_policy` — FINAL product contract (resolved 2026-09-15)

See `negative-stock-policy-conflict.md` for the full investigation and the
product-owner decision record (**OPTION A**: global non-negative on-hand is
the permanent contract; `'allow'`/`'allow_with_approval'` are superseded for
on-hand behavior). No code/DB change was required — the diagnostic below,
originally run before the decision, already showed the already-applied
CHECK/P0003 invariant matches the decision exactly.

Fixture: on_hand=2, reserved=0, allocated=0. Attempted a real physical
decrease of 5 via `inventory_create_and_finalize`.

| `negative_stock_policy` | Result | SQLSTATE | Balance after | Orphan headers |
| ----------------------- | ------ | -------- | ------------- | -------------- |
| `'allow'`               | FAILED | `P0003`  | unchanged (2) | 0              |
| `'block'`               | FAILED | `P0003`  | unchanged (2) | 0              |

Both produce the byte-identical rejection message ("0.000000 reserved +
0.000000 allocated = 0.000000 committed ... but only -3.000000 would remain
on hand"). No raw `23514` CHECK violation ever surfaces from this path — the
P0003 check always fires first when `committed=0`, since `v_new_qty <
committed` then reduces exactly to `v_new_qty < 0`.

**This is now a permanent regression, not merely a diagnostic**:
`102_ic1_reserved_only_hard_invariant_test.sql`'s own Scenario C (T7-T14)
encodes exactly this fixture/expectation pair as part of the accepted test
suite (plan extended 6 → 14). Live-verified after the decision: **14/14**,
zero residual (fresh isolated branch, rolled back), zero ledger mutation
(`inventory_stock_ledger_entries` count unchanged in addition to the header
count already checked above).

## Vitest (395/395, 0 failures — 229 of these re-confirmed live in the finalization pass)

| Suite                                                               | Result  | Re-confirmed in finalization pass?        |
| ------------------------------------------------------------------- | ------- | ----------------------------------------- |
| `repair-orders.service.test.ts`                                     | 159/159 | Yes                                       |
| Inventory movement/field-policy + inventory-actions suite (4 files) | 31/31   | Yes                                       |
| Broader inventory sibling suite (19 files)                          | 166/166 | No — unaffected, nothing in scope changed |
| CRM sibling suite (4 files)                                         | 39/39   | Yes                                       |

## `pnpm type-check`

0 errors.

## `pnpm lint`

0 errors. 319 pre-existing warnings, all in unrelated `apps/web/temp/`
scaffold prototypes (`cycle-count`, `warehouse-movement-editor`) — none
touch any file this phase changed.
