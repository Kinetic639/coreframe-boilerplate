# IC-8 — Section 16: Concurrency Final Representative Suite

## Disposition

**Not re-run from scratch.** Per this task's own Section 16 instruction
("NOT re-run every historical experiment; run a representative final
set"), this section synthesizes the genuine, real-two-connection
concurrency evidence already produced live during IC-1 through IC-4
against the accepted `inventory_finalize_posting_internal` engine and its
callers — which has not changed in any lock-relevant way since — and adds
one new structural (non-live) analysis for item (F), the only scenario
whose underlying code changed since its own original evidence was
produced.

**Tooling constraint, disclosed honestly**: this specific IC-8 pass has no
working path to genuine two-independent-OS-connection testing against the
shared `supabase-target` project. `SUPABASE_TARGET_DB_URL` is not set in
this session's environment and no `psql` binary is available (confirmed:
`which psql` → not found); the disposable clean-replay project is a
different, structurally-incomplete database (Section 2/3 — REPRODUCIBILITY
BLOCKED at migration #38 of 200) and is not a valid substitute for testing
against the accepted schema. This matches the same constraint already
disclosed for the `dblink` self-connection attempt. IC-1 through IC-4's own
`psql`-based two-connection tests were produced by earlier passes in this
project's history that evidently had that access; this pass does not, and
does not fabricate a live rerun it cannot perform.

Where the underlying lock path is unchanged since that evidence was
produced, citing it is not a weaker form of evidence than rerunning it —
it is the same evidence, still valid, because nothing about the contended
code changed. Where the underlying code DID change (item F), this is
disclosed explicitly below rather than silently reusing stale evidence.

## (A) Two physical decreases competing for the same stock

**Satisfied — genuine live evidence, IC-1.** Two independent `psql`
connections both attempted to move stock out of the same
`inventory_balances` bucket via `putaway_repair_order_stock` (Session A:
succeeded, moved the 4 genuinely-free units, held the row lock via
`pg_sleep(5)`; Session B: blocked for 3683.937ms — genuine lock
contention, not coincidental overlap — resumed within 16ms of Session A's
COMMIT, then correctly re-evaluated the now-updated balance and was
**rejected** with `P0003`). No deadlock. Final state: exactly one move
applied, the rejected attempt left zero footprint (not even an empty
balance row for its destination). See `ic-1-review/test-and-concurrency-
evidence.md`, "Genuine two-independent-connection concurrency proof."

IC-4's own test 3 (accept vs. a generic `401` adjustment on the same
destination bucket) is a second, independent live confirmation of the
same underlying mechanism (`inventory_get_or_create_balance_for_update`'s
`FOR UPDATE`) serializing two different RPC entry points against one
shared balance row — both committed successfully, serialized, not
deadlocked. See `ic-4-review/concurrency-evidence.md`, item 3.

**Lock path unchanged since**: `inventory_finalize_posting_internal` and
`inventory_get_or_create_balance_for_update` are untouched by A1-A8 in any
way that affects lock acquisition, lock order, or lock scope (A1-A8's own
changes were to RepairOrder-side attribution/projection, container
orchestration, and the public-surface security boundary — not to the
balance-row locking primitive itself). This was independently confirmed
this pass: `pg_get_functiondef` on both functions still shows the same
`FOR UPDATE` acquired as the first balance-row touch, before any
invariant check.

## (B) Reservation/allocation competing with a physical decrease

**Partially satisfied — genuine live evidence for the invariant itself,
honestly caveated on the exact caller combination.** No live test in this
project's history has literally run a `reserve`/`allocate` RPC call
concurrently against a `putaway`/`create_and_finalize` RPC call in two
separate sessions. What WAS proven live, under genuine two-connection
concurrency (IC-1, same evidence as (A) above): the commitment invariant
`reserved_quantity + allocated_quantity <= on_hand_quantity` is
re-validated **after** the contended row's lock is acquired, not merely
checked once up front — Session B's attempt was rejected specifically
because it re-read the post-A balance under its own lock and found
insufficient free stock, not because of any pre-check race. This is the
same enforcement mechanism a live reserve-vs-decrease race would exercise
(both reservation/allocation and physical-decrease paths route through
the identical `inventory_get_or_create_balance_for_update` primitive and
the identical post-lock invariant check in
`inventory_finalize_posting_internal` — reservation/allocation are not a
structurally different code path, they are the same primitive called with
a different `balance_field` target).

IC-1's own pgTAP suite (102, 14/14, single-transaction not genuinely
concurrent) additionally proves the invariant holds specifically for the
`reserved`-only case (not just `allocated`) as a first-class scenario, not
an incidental consequence — see `ic-1-review/test-and-concurrency-
evidence.md`, "102 — full assertion list."

**Disclosed gap**: no genuine two-session test has exercised the EXACT
sequence "session A calls `inventory_reserve_stock` while session B
concurrently calls `inventory_create_and_finalize` against the same
bucket." Given (i) both routes provably share the identical row-lock
primitive and post-lock invariant check (verified this pass via
`pg_get_functiondef`), and (ii) the `FOR UPDATE` lock is acquired before
either caller's own effect is computed, this reduces to the same proven
mechanism as (A) — but it is reasoned, not independently re-run live, per
this pass's own disclosed tooling constraint.

## (C) Double reversal

**Satisfied — genuine live evidence, IC-2.** Two independent `psql`
connections both attempted to reverse the SAME posted movement. Session A
succeeded (691.641ms, posted `KOR/2026/000001`), held the original
header's row lock via `pg_sleep(5)`. Session B blocked for 5015.336ms
(genuine lock contention on `inventory_reverse_movement`'s own initial
`SELECT ... FOR UPDATE` on the original header), resumed within ~16ms of
A's COMMIT, then correctly re-read `status='reversed'` and was **rejected**
(`P0007`). No deadlock. Final state: exactly one reversal header exists,
exactly one `'reversed'` audit-log row — no double-compensation. See
`ic-2-review/test-and-concurrency-evidence.md`.

**Lock path unchanged since**: `inventory_reverse_movement`'s own
`FOR UPDATE` on the original header, and its downstream call into
`inventory_finalize_posting_internal`, are untouched by A1-A8 (confirmed
via `pg_get_functiondef` this pass — the only change in this function's
history since IC-2 is the IC-2 security-boundary correction itself, which
changed which internal function it calls, not any lock acquisition, as
IC-2's own review already disclosed and re-verified).

## (D) Double branch-transfer send/accept

**Satisfied — genuine live evidence, IC-4.** Two independent tests:

- **Double-send**: Session A called `inventory_send_branch_transfer`
  (36.4ms, `status: in_transit`), held the transfer row's `FOR UPDATE`
  lock via `pg_sleep(4)`. Session B blocked 2672.7ms, resumed after A's
  COMMIT, correctly re-evaluated `status` and was **rejected** (`P0007`,
  "Only prepared transfers can be sent"). Exactly one `311` movement
  exists. No deadlock.
- **Double-accept**: Session A called `inventory_accept_branch_transfer`
  (986.3ms, `status: accepted`), held the lock via `pg_sleep(4)`. Session
  B blocked 3778.7ms, resumed after A's COMMIT, hit the idempotent-status
  short-circuit and returned the SAME `destination_movement_id` with
  `already_processed: true` — no exception, no duplicate movement.
  Exactly one `312` movement exists. No deadlock.

See `ic-4-review/concurrency-evidence.md`, items 1-2.

**Lock path unchanged since**: `inventory_send_branch_transfer`/
`inventory_accept_branch_transfer` are untouched by A1-A8 (confirmed via
`pg_get_functiondef` this pass — no A-phase migration references either
function).

## (E) Idempotent receiving retry

**Satisfied — genuine live evidence, IC-3.** Two independent connections
both called `inventory_receive_stock` with the identical idempotency key.
Session A succeeded (46.482ms, posted `PZ/2026/000022`), held the new
header's uncommitted unique-index entry via `pg_sleep(5)`. Session B
blocked for 3560.950ms on that same partial unique index
(`inventory_movement_headers_org_idempotency_uidx`), resumed within ~52ms
of A's COMMIT, and — via the primitive's own `GET STACKED DIAGNOSTICS ...
CONSTRAINT_NAME` catch — returned the SAME `movement_id` gracefully, no
exception surfaced to the caller. Final state: `on_hand_quantity = 10`
(single receipt, not doubled), exactly one movement header. No deadlock.
See `ic-3-review/concurrency-evidence.md`.

**Lock path unchanged since**: `inventory_receive_stock` and the
idempotency unique index are untouched by A1-A8 (confirmed this pass —
no A-phase migration touches this function or index).

## (F) RepairOrder/container contention

**Not satisfied by prior evidence — IC-5's own concurrency evidence for
this exact scenario is now OBSOLETE, not merely stale.** IC-5's
`concurrency-evidence.md` documents a lock-path argument for
`rebuild_repair_order_projection_bucket_internal`'s own `FOR UPDATE` on
`inventory_balances`. **That function no longer exists** — confirmed live
this pass (`SELECT proname FROM pg_proc ... WHERE proname ILIKE
'%rebuild_repair_order%'` → zero rows). A8 ("remove incremental
RepairOrder location projection") dropped the entire incremental
projection subsystem IC-5's own evidence was about. Citing IC-5's old
evidence here would misrepresent code that was deliberately removed three
phases later — disclosed as obsolete rather than silently reused.

**What actually exists post-A8, checked live this pass**: two functions in
the current RepairOrder/container surface carry `FOR UPDATE` locks:

- `putaway_repair_order_stock` — locks the same `inventory_balances` row
  via the same canonical engine path already proven safe under real
  concurrency in (A) above (this function's own core balance-mutation path
  is unchanged; A8 only removed the incremental-projection side-effect
  that used to run alongside it, per this pass's own zone5 reconstruction
  work — see `migration-reproducibility.md`).
- `inventory_add_to_container_internal` — locks, in order: (1) the
  `inventory_containers` row (`FOR UPDATE`), (2) the
  `inventory_allocation_lines` row (`FOR UPDATE`), (3) an existing
  `inventory_container_lines` row if one already matches the same
  container/variant/lot/serial tuple (`FOR UPDATE`). Verified live this
  pass via `pg_get_functiondef` — the container lock is acquired first, in
  a single consistent order, before any allocation or container-line
  read. Two concurrent calls placing different allocations into the SAME
  container would serialize on the container row lock; two concurrent
  calls placing the SAME allocation line would additionally serialize on
  the allocation-line lock, preventing the same allocated quantity from
  being placed twice (the `v_existing_sum + p_quantity >
v_alloc.allocated_quantity` check runs after both locks are held, so
  it sees the other session's already-committed placement, not a stale
  pre-lock read).

This is a genuine lock-order analysis of the CURRENT code (same class of
evidence IC-5 originally provided, for the function that replaced it), but
it is **static, not live-tested** — this pass's own disclosed tooling
constraint (no `psql`/DB-URL access to `supabase-target`) applies here as
much as to (B)'s gap. No cross-row lock-ordering hazard was found (each
function acquires its own locks in one fixed, consistent order — container
before allocation before container-line — matching the architecture's own
§8 lock-order convention), but this is reasoned from the function body,
not proven via `clock_timestamp()` wall-clock blocking measurements the
way (A)-(E) were.

## CHECK-constraint backstop (supplementary, not a substitute for the above)

`inventory_balances` carries three DB-level, interleaving-proof-by-
construction CHECK constraints (verified live this pass):

```
inventory_balances_on_hand_nonnegative   CHECK (on_hand_quantity >= 0)
inventory_balances_reserved_nonnegative  CHECK (reserved_quantity >= 0)
inventory_balances_allocated_nonnegative CHECK (allocated_quantity >= 0)
```

These are enforced atomically by Postgres itself at commit time,
regardless of any application-level lock discipline — no interleaving of
two transactions can ever commit a negative value into any of these three
columns, full stop. **Disclosed limitation**: the CROSS-field commitment
invariant this whole suite cares about most
(`reserved_quantity + allocated_quantity <= on_hand_quantity`) is **not**
a raw CHECK constraint — it is enforced by the application-level `P0003`
check inside `inventory_finalize_posting_internal`, which depends entirely
on the `FOR UPDATE` row lock being held first (exactly what (A)/(B)/(F)
above are about). The CHECK constraints are a genuine, real backstop
against the narrower failure mode (any single column going negative) but
are not, by themselves, sufficient evidence for the broader cross-field
invariant — that still rests on the lock-discipline evidence above.

## Summary

| Scenario                                         | Live 2-session evidence                             | Status                                                                      |
| ------------------------------------------------ | --------------------------------------------------- | --------------------------------------------------------------------------- |
| (A) Two physical decreases, same stock           | IC-1 (exact), IC-4#3 (corroborating)                | Satisfied                                                                   |
| (B) Reservation/allocation vs. physical decrease | IC-1 (same mechanism, different exact caller combo) | Partially satisfied — reasoned from shared primitive, not literally re-run  |
| (C) Double reversal                              | IC-2 (exact)                                        | Satisfied                                                                   |
| (D) Double branch-transfer send/accept           | IC-4 (exact, both cases)                            | Satisfied                                                                   |
| (E) Idempotent receiving retry                   | IC-3 (exact)                                        | Satisfied                                                                   |
| (F) RepairOrder/container contention             | None (IC-5's own evidence obsolete post-A8)         | Not satisfied by live evidence — static lock-order analysis only, disclosed |

No over-consumption, no double posting, no partial write, and no
unexplained deadlock was observed in any of the five genuine live tests
(A, C, D×2, E). (B) and (F) do not have their own dedicated live proof in
this pass and are documented above as reasoned-but-not-directly-tested,
per this pass's own disclosed environment constraint — not fabricated as
passing.
