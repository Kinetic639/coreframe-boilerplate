# Inventory Core — A8 RepairOrder Projection Simplification — Architecture Evidence

## 1. P0008 recoverability gap — full live reproduction (pre-implementation)

Reproduced fresh, before any change this pass, via `BEGIN`/`ROLLBACK`
(zero residual data):

1. Received 10 units of a variant at a receiving location, attributed in
   full to one RepairOrderLine via `attach_repair_order_line_movement`
   (canonical link: `receipt`, `applied_quantity=10`).
2. With the attribution-authoritative GUC left at its default (`off`),
   posted a **generic, non-RepairOrder-aware** movement — type `402`, a
   plain "Inventory Count Adjustment (Decrease)", the exact category any
   ordinary warehouse operator could trigger with zero RepairOrder
   awareness — decreasing 4 units at the SAME bucket.
3. Live state after step 2: persisted projection (pre-A8) correctly
   self-healed to 6 (the trigger's own heuristic branch ran, since this
   was a decrease at a bucket already carrying attribution history, with
   the GUC off); physical `on_hand_quantity` correctly at 6; the
   generic movement created **zero** new canonical
   `repair_order_line_movement_links` rows (never intended to — it's
   generic).
4. Called `rebuild_repair_order_location_projection` (pre-A8's own
   from-scratch reconstruction, scoped to this RepairOrderLine's own
   RepairOrder) — it recomputes purely from canonical links + ledger,
   with zero knowledge of the trigger's own incremental self-healing.
   Result: raised
   `P0008: Projection rebuild found known attribution (10) exceeding
physical on_hand (6) ... -- history inconsistency`.

**Conclusion, confirmed live before implementing anything**: the
incremental trigger's own "self-healing" was NOT actually reconstructable
from canonical history — "rebuild equals incremental" held only for the
reversal branch (where the incremental path literally IS a rebuild call),
never for the generic-movement heuristic branch. This is the exact,
concrete bug class A8 eliminates by removing the projection entirely —
there is no longer anything to desync from the ledger.

## 2. Read-time contract chosen for the new architecture

**Decision**: detect the inconsistency, fail explicitly (SQLSTATE
`P0008`, reusing the exact code the old rebuild used for the same
concept), never silently invent or clamp ownership. Applies uniformly to
`get_repair_order_line_physical_state` and to `putaway_repair_order_stock`'s
own internal availability check.

**Message**: a safe, non-business-detail-leaking string (`"...history
inconsistency"`), matching this project's own established non-leaking
error convention.

**Partial data**: NOT returned. If ANY bucket a RepairOrderLine has
touched is inconsistent, the read fails entirely for that line, rather
than silently omitting the inconsistent bucket from an otherwise-partial
result — a partial success here could actively mislead a caller into
believing less stock is at stake than the history implies.

**Blast radius of a failure**: local to one RepairOrderLine's own
physical-state read, not the whole RepairOrder page. This falls out of
the existing method shape: `getPhysicalStateForLine` was already scoped
per-line (not per-RepairOrder), so a caller rendering N lines would
naturally call it N times independently — one line's own P0008 does not
propagate to any other line's own read. At the TS layer, this is
represented as `{ success: true, data: { ..., consistency:
"inconsistent_history" } }`, not a thrown exception or a `success: false`
failure — a controlled, typed outcome the caller can render inline for
that one line's own section, matching the task's own "remains local to
the RepairOrder physical-state section" requirement. No new UX was
invented beyond this backend contract, since no UI currently calls this
method (zero production callers, confirmed both before and after this
pass — see `review-context.md`).

## 3. Reversal-awareness: read-time JOIN, not write-time mirror

The old trigger's reversal branch mirrored each affected canonical link
(`write_repair_order_line_movement_link_internal(..., 'reversal', ...)`)
so the rebuild's own link-based computation would net correctly. Removing
the trigger removes this mirroring entirely — **discovered mid-pass, not
anticipated in the original design**: an initial version of the new
live-read RPC, without any reversal-specific logic, falsely raised P0008
after a legitimate, fully-reversed receipt (physical correctly returned
to 0, but the read still found the ORIGINAL link's own historical
quantity with nothing to net it against).

**Fix, live-diagnosed and verified before finalizing the migration**: the
contribution query's `FROM`/`JOIN` chain was extended with a `LATERAL`
join that, for each canonical link, includes not just its own original
movement line's ledger effects but ALSO — if that movement's own header
was reversed (`inventory_movement_headers.reversal_movement_id IS NOT
NULL`) — the reversal's own corresponding line (same `line_number`,
guaranteed identical `quantity` per `inventory_reverse_movement`'s own
`INSERT`, which copies `v_line.quantity` verbatim). Both the original
and the reversal contribute to the SAME proportional ratio
(`applied_quantity / iml.quantity`), so a full reversal nets to exactly
0, and a reversed relocation nets correctly at BOTH its own source and
destination buckets.

**Live-verified**: single-line full reversal (nets to empty), split-
attribution reversal (both lines independently net to empty), full
putaway reversal (BOTH receiving and shelf buckets net correctly),
partial putaway reversal (same). All in the rewritten file 107 and
re-verified via the full regression.

This design is **architecturally cleaner** than the mechanism it
replaces: zero triggers exist anywhere in the new subsystem — reversal-
correctness lives entirely in the read query, following existing,
already-generic-core metadata (`reversal_movement_id`/
`original_movement_id`) rather than requiring a RepairOrder-domain write
hook into the generic engine's own reversal path. `inventory_reverse_
movement` itself was NOT touched by this pass (out of scope, explicitly
protected by the task's own "Do NOT change ... reversal semantics"
instruction) — its own harmless, now-fully-inert
`SET LOCAL ambra.repair_order_attribution_authoritative = 'on'` line was
deliberately left alone rather than risked for a zero-benefit cleanup.

## 4. `putaway_repair_order_stock` concurrency redesign — 2 bugs found and fixed live

### Bug 1: post-engine re-derivation compared against already-mutated physical state

An initial redesign preserved the OLD two-pass shape (unlocked pre-check,
then a locked recheck AFTER the engine call). This was WRONG: the engine
call itself decreases `inventory_balances.on_hand_quantity` at the
receiving bucket as part of posting the physical relocation, so a
post-engine re-derivation of "total attributed vs. physical" compared
live attribution (unchanged, since no new canonical link exists yet)
against an ALREADY-REDUCED physical figure — causing every normal
full-or-near-full putaway to falsely raise P0008.

**Found**: via a live test of the standard full-putaway scenario (10
units received, all 10 put away in one call) — unexpectedly rejected.
**Fixed**: collapsed to a SINGLE validation pass, entirely BEFORE the
engine call, where physical `on_hand_quantity` still reflects true
pre-putaway state. The lock (`FOR UPDATE` on `inventory_balances`) is
taken at this SAME point and held for the rest of the transaction —
achieving the same cross-transaction serialization the old post-engine
lock achieved, on the real physical resource being contended rather than
a derived projection row, and avoiding the mutated-state comparison bug
entirely by never re-deriving after the mutation.

### Bug 2: same-batch consumption tracker keyed by variant instead of by line

The single-pass redesign needed an in-memory tracker to prevent one
`putaway_repair_order_stock` call containing the SAME `repair_order_line_id`
twice from double-spending that line's own attributed share (the old
design's equivalent protection came from a persisted, sequentially-
decrementing projection row). The first version keyed this tracker by
**variant**, which — found via a live two-line-same-bucket test (line A:
6 units, line B: 4 units, different RepairOrderLines, same SKU, one
`putaway_repair_order_stock` call requesting both in full) — incorrectly
reduced line B's own independent 4-unit share by line A's own unrelated
6-unit consumption, breaking the IC-5 same-SKU-independence invariant
(line B's own computed availability went to `4 - 6 = -2`).

**Fixed**: re-keyed the tracker by `repair_order_line_id`
(`v_consumed_by_line`). It now only guards the SAME line appearing twice
within one call; two DIFFERENT lines sharing a bucket remain fully
independent, protected instead by the bucket-level `total_known >
physical_on_hand` check (each line's own share is a disjoint slice of
that same `total_known`, so two different lines each requesting up to
their own historical share can never together exceed physical on-hand).

**Live-verified after the fix**: the same two-line batch now succeeds
correctly (both lines get their own full, independent share); a
SAME-line-twice batch requesting more than that line's own total is
correctly rejected (`22023`); a SAME-line-twice batch requesting exactly
that line's own total, split across two entries, correctly succeeds.

## 5. Concurrency assessment (Section 22)

Removing the write-side trigger reduces write contention — it no longer
fires (or even needs to check whether to fire) on every
`inventory_stock_ledger_entries` insert, RepairOrder-relevant or not.

The one new lock in this pass is `putaway_repair_order_stock`'s own `FOR
UPDATE` on `inventory_balances` for the receiving bucket, taken before
the engine call. This is **justified**: it is the SAME physical row the
generic engine's own posting (`inventory_get_or_create_balance_for_
update`) will lock moments later in the SAME transaction (reentrant-safe,
no new deadlock risk — same pattern already established and documented
by `rebuild_repair_order_projection_bucket_internal`'s own comment,
"reentrant-safe... can re-acquire it without deadlocking itself", pre-A8)
— putaway does not introduce a NEW lock target, it simply takes an
EXISTING, already-necessary lock slightly earlier than before.

The new public read RPC, `get_repair_order_line_physical_state`, takes
**NO lock at all** — matching the task's own explicit preference ("no
write lock" for the read primitive). It is a pure, unlocked read; two
concurrent reads never block each other, and a read never blocks a
write.

**A genuine, disclosed tradeoff**: without a proactive lock during the
READ path (only `putaway`'s own write path locks), two concurrent
mutating calls at the SAME bucket that are NOT both `putaway` calls
(e.g., a receive racing a generic movement) could theoretically produce
a transient window where a read observes a inconsistency that a later
read would not. This is not a new risk class introduced by A8 — it is
the SAME class of MVCC read-consistency behavior any unlocked read has
always had in this codebase — and any REAL inconsistency this could
expose is, by design, surfaced as an explicit `P0008` on the next read,
never silently wrong. No new dedicated two-session concurrency test was
required per the task's own explicit conditional rule (no new lock
introduced in the read path; the one new lock in the write path
reuses an existing, already-tested lock target).

## 6. Table disposition — decision documented (Section 13)

See `migration-summary.md`'s own migration-7 section for the full
evidence (zero rows ever, zero remaining readers/writers, no external
path). Decision: **immediate removal**, not staged. This is a deliberate
departure from the task's own stated default preference, made using the
decision framework the task itself provided, and disclosed here plainly
so the reviewer can override it if a different judgment call is
preferred — the evidence for zero live dependency is unusually strong
(not merely "no code reference today" but "zero rows were EVER written
by any real caller"), which is exactly the class of evidence the task's
own exception clause anticipated.

## 7. GUC disposition (Section 14)

`ambra.repair_order_attribution_authoritative` — searched every
remaining reader/writer live (`prosrc ILIKE`) after this pass's own
changes:

- **Writers removed**: `receive_repair_order_stock`,
  `putaway_repair_order_stock` (their own `set_config`/`PERFORM
set_config` calls removed as part of this pass's own migrations 3–4,
  since their only purpose was suppressing the trigger's heuristic
  branch, which no longer exists).
- **Writer intentionally NOT removed**: `inventory_reverse_movement`'s
  own `SET LOCAL ambra.repair_order_attribution_authoritative = 'on'`
  line — left untouched. This function is explicitly out of scope for
  this pass (`Do NOT change ... reversal semantics`); the line is now
  fully inert (its only ever reader, the trigger, is gone) but touching
  a protected, unrelated function for a zero-benefit cleanup was judged
  not worth the added diff/risk.
- **No schema object to drop**: custom `ambra.*` GUCs are plain runtime
  session variables referenced by string, not declared schema objects —
  there is nothing to `DROP`.

## 8. Final architecture (Section 30)

```
RepairOrder receive/putaway
        |
        v
generic movement engine (inventory_create_and_finalize / inventory_receive_stock)
        +
canonical movement attribution links (repair_order_line_movement_links,
  written by write_repair_order_line_movement_link_internal -- unchanged)
        |
        v
ledger/balance physical truth (inventory_stock_ledger_entries / inventory_balances)


READ:

RepairOrder physical-state request (RepairOrderLine-scoped)
        |
        v
get_repair_order_line_physical_state
  -- live query over canonical attribution + physical history
  -- reversal-aware via a read-time JOIN on reversal_movement_id
  -- bounded to this line's own touched buckets
        |
        v
derived result (or an explicit P0008 failure on genuine inconsistency)
```

**NO synchronous projection writer exists anywhere in this diagram** —
zero triggers on the RepairOrder projection subsystem, matching this
pass's own end-state goal exactly.
