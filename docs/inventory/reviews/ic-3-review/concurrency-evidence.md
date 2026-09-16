# IC-3 — Concurrency Evidence

The brief's own plan states no NEW concurrency test is generally expected
for receiving (a pure `on_hand` increase, no commitment-stranding risk).
That holds. But idempotency IS a concurrency-adjacent concern this phase
specifically re-engineered around (the primitive's own graceful catch of
a concurrent unique-index collision) — so a genuine two-connection race
was performed to prove that mechanism, not merely reasoned about.

## Genuine two-independent-connection idempotency race

Real `psql` binary, two **separate OS processes/connections** against
`SUPABASE_TARGET_DB_URL` — not one transaction pretending to be
concurrent.

**Fixture** (committed, durable): a dedicated branch (`ic3-concurrency-
branch`, `branch_number=940` — originally 970, renumbered after colliding
with `103_...`'s own transaction-scoped fixture, see the change log) and
location, real organization/variant/unit anchors.

**Session A** (launched first): `BEGIN`; `SET LOCAL ROLE authenticated`;
called `inventory_receive_stock` with idempotency key `ic3-race-key-1` —
succeeded in **46.482ms**, still holding the new movement header's own
uncommitted unique-index entry; then `pg_sleep(5)`; then `COMMIT`.

**Session B** (launched ~1.5s after A): `BEGIN`; called `inventory_
receive_stock` with the SAME idempotency key `ic3-race-key-1`.

**Timings** (real, from psql's own `\timing on` output and
`clock_timestamp()` markers; bash `date +%s.%N` around each launch):

```
launch_a (bash) = 1789498644.727639217
launch_b (bash, ~1.51s after launch_a) = 1789498646.234166291

Session A (psql \timing):
  a_start                     = 2026-09-15 18:57:24.950445+00
  inventory_receive_stock call = Time: 46.482 ms (posts PZ/2026/000022)
  a_after_call_before_sleep    = 2026-09-15 18:57:25.017138+00
  pg_sleep(5)                  = Time: 5025.346 ms
  a_after_sleep_before_commit  = 2026-09-15 18:57:30.062832+00
  COMMIT                       = (immediately after)

Session B (psql \timing):
  b_start                      = 2026-09-15 18:57:26.527864+00
  inventory_receive_stock call = Time: 3560.950 ms (BLOCKED, then returned gracefully)
  b_after_call                 = 2026-09-15 18:57:30.114904+00
  COMMIT                       = (immediately after)
```

Session B's own `inventory_receive_stock` call took **3560.950ms** —
genuine lock contention on Session A's own uncommitted unique-index entry
(`inventory_movement_headers_org_idempotency_uidx`), not coincidental
overlap — and resumed within ~52ms of Session A's actual commit
(18:57:30.0628 → B's call returning at 18:57:30.1149). Both sessions
returned the **IDENTICAL** `movement_id`:
`a927d131-c8c0-40ce-866a-e8eba5285771`.

**No deadlock occurred. No raw/ugly error was surfaced to Session B** —
the primitive's own `GET STACKED DIAGNOSTICS ... CONSTRAINT_NAME` catch
correctly identified the collision was on the idempotency index
specifically and returned the winning caller's now-committed movement
gracefully, exactly as designed.

**Final state** (queried after both sessions completed):
`on_hand_quantity = 10` (the single 10-unit receipt, NOT 20 — no
double-post); exactly ONE movement header exists for this fixture
(`PZ/2026/000022`).

**Lock-order inspection**: `inventory_receive_stock` itself acquires no
new explicit row lock beyond what `inventory_create_draft`'s own INSERT
into `inventory_movement_headers` naturally contends on via the
pre-existing partial unique index — no new cross-row lock-ordering
question arises; this matches the architecture doc's own §8 lock-order
convention (unchanged by this phase).

## Residual data from the concurrency test (disclosed, not silently cleaned up)

Same immutability protection every prior concurrency test in this project
encountered — `inventory_movement_headers`/`_lines` cannot be deleted
once posted. Residual:

| Item                        | Count | Detail                                                                            |
| --------------------------- | ----- | --------------------------------------------------------------------------------- |
| Branch                      | 1     | `ic3-concurrency-branch` (renumbered `branch_number=940` after the collision fix) |
| Location                    | 1     | `ic3-concurrency-loc`, dedicated to this fixture                                  |
| Movement header (immutable) | 1     | `PZ/2026/000022`, `status='posted'`                                               |
| Balance row                 | 1     | accurately `on_hand=10`, matching the real posted history                         |

All other synthetic scaffolding (every pgTAP scenario's own branches,
RepairOrders, Purchase Orders, etc.) ran inside `BEGIN...ROLLBACK` and
left zero residual data — confirmed by direct query after the suite.

## PO wrapper's own race-safety (reasoned, not separately re-tested)

The PO wrapper's own idempotency pre-check (migration 4) relies on the
SAME `v_po` row's pre-existing `FOR UPDATE` lock (acquired as the very
first database operation in the function, unchanged from the original
design) to serialize two genuinely concurrent calls for the SAME
`purchase_order_id` — the losing session blocks on that lock, not on the
idempotency index directly, and only proceeds to its own idempotency
pre-check after the winning session has already committed. This is the
same class of proof as the primitive's own race above (a real,
pre-existing row lock providing serialization), reasoned through rather
than independently re-run with a second live two-connection test, since
it reduces to the identical, already-proven mechanism at the PO-row
level instead of the idempotency-index level.
