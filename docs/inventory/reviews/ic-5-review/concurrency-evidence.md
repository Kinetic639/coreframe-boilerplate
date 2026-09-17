# IC-5 Concurrency Evidence

**No dedicated two-connection concurrency test was performed this
phase.** Per the task's own explicit instruction ("real two-session
test ONLY if a genuine race exists; otherwise explain/prove the
relevant lock path"), this file documents the structural argument for
why no such race exists, rather than fabricating a test for its own
sake.

## The lock path

Every write to a `(organization_id, branch_id, location_id,
variant_id)` bucket's own projection state — whether via the
incremental trigger path, `attach_repair_order_line_movement`'s own
auto-rebuild, or the standalone `rebuild_repair_order_location_
projection` RPC — ultimately funnels through `rebuild_repair_order_
projection_bucket_internal`, which opens with:

```sql
SELECT on_hand_quantity INTO v_physical_on_hand
FROM inventory_balances
WHERE organization_id = p_organization_id AND branch_id = p_branch_id
  AND location_id = p_location_id AND variant_id = p_variant_id
FOR UPDATE;
```

This is the SAME row, and the SAME lock, that every other bucket-
mutating writer in this project already acquires before touching a
bucket's own balance (the canonical movement-posting engine itself
locks this row via `inventory_finalize_posting_internal`). No new lock
primitive was introduced by IC-5.

Two consequences follow directly from this:

1. **Two concurrent rebuilds of the SAME bucket** (whether both
   incremental, both explicit rebuilds, or one of each) serialize on
   this row lock — the second waits for the first's own transaction to
   commit or roll back before it can even read `on_hand_quantity`,
   let alone recompute anything. There is no window where two
   rebuilds can interleave their own DELETE+recompute against the same
   bucket.

2. **A rebuild and an ordinary movement post against the SAME bucket**
   also serialize on this same row — a rebuild cannot run against a
   half-posted movement's own balance, and a movement cannot post
   while a rebuild holds the lock. This is the same guarantee IC-1's
   own commitment invariant already relies on for every other writer;
   IC-5 did not need to invent a new mechanism, only reuse the
   existing one inside the new rebuild primitive.

## Why this differs from IC-3/IC-4's own genuine concurrency tests

IC-3 and IC-4 each performed real two-connection tests because those
phases introduced NEW contention scenarios not already covered by an
existing lock (e.g., two concurrent branch-transfer accepts racing to
create the SAME `312` header). IC-5 introduces no new contention
scenario — every writer that touches the projection was already
required to hold the `inventory_balances` row lock for that bucket
before this phase (to post the underlying movement in the first
place), and the new rebuild primitive deliberately reuses that exact
lock rather than operating outside it. A genuine two-connection test
here would be expected, with very high confidence, to simply reproduce
the well-established Postgres row-lock blocking behavior already
proven (with real wall-clock measurements) in IC-1/IC-2/IC-3/IC-4's own
concurrency tests — adding no new information, per the task's own
"only if necessary" instruction.

## What WAS verified live (not a concurrency test, a lock-path proof)

`pg_get_functiondef` on `rebuild_repair_order_projection_bucket_
internal` was re-read after the final migration to confirm the `FOR
UPDATE` clause is present, targets the correct bucket-identifying
columns, and is the FIRST statement in the function body (i.e., no
read of `repair_order_line_movement_links`/ledger data happens before
the lock is acquired, which would otherwise leave a TOCTOU window).
