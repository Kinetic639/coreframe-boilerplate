# IC-4 — Concurrency Evidence

Three genuine two-independent-PostgreSQL-connection tests, real `psql`
binary (`/nix/store/.../bin/psql`), two separate OS-level connections
against `SUPABASE_TARGET_DB_URL` — not one transaction pretending to be
concurrent. `\timing on`, `date +%s.%N` wall-clock markers around each
session. Committed fixtures (org `9f98fe91-...`, branches `ic4-
concurrency-src`/`ic4-concurrency-dst`, branch_number 962/963) — residual
disclosed below, not silently cleaned up.

## 1. Double-send — exactly one source movement, no deadlock

A transfer (`6988fb97-0b37-4844-871d-db8709ef0fbb`, 3 units) was created
and left `status='prepared'`. Session A called `inventory_send_branch_
transfer`, then held the transaction open via `pg_sleep(4)` before
COMMIT. Session B, started ~1.5s later, called the SAME RPC on the SAME
transfer.

- **Session A**: `inventory_send_branch_transfer` returned in **36.4ms**
  (`status: in_transit`, `source_movement_id: 899921a9-...`), then slept
  4030ms, then COMMIT.
- **Session B**: blocked on the transfer row's own `FOR UPDATE` lock for
  **2672.7ms** (real wall time, matching A's remaining sleep), resumed
  only after A's COMMIT, then correctly re-evaluated `status` against
  the now-`in_transit` row and was rejected: `ERROR: Only prepared
transfers can be sent (status=in_transit)`, SQLSTATE `P0007`.

**Result**: exactly one `311` movement exists for this transfer. No
deadlock. The row lock in `inventory_send_branch_transfer`'s own initial
`SELECT ... FOR UPDATE` is what makes this safe — not merely the
idempotency-key unique index (defense in depth, not the primary
mechanism here, since B never reaches the INSERT at all).

## 2. Double-accept — exactly one destination movement, idempotent retry

A transfer (`024e3210-9fda-4ab9-bc5c-cc16ea2cfcfa`, 4 units, already
`in_transit` from an earlier run) was accepted concurrently. Session A
called `inventory_accept_branch_transfer`, held the transaction open via
`pg_sleep(4)`, then COMMIT. Session B, started ~1.5s later, called the
SAME RPC on the SAME transfer.

- **Session A**: returned in **986.3ms** (`status: accepted`,
  `destination_movement_id: d3ab05f4-...`), then slept 4037ms, then
  COMMIT.
- **Session B**: blocked for **3778.7ms** (matching A's remaining sleep),
  resumed after A's COMMIT, then hit the idempotent-status short-circuit
  (`status IN ('accepted','partially_accepted')`) and returned the SAME
  `destination_movement_id: d3ab05f4-...` with `already_processed: true`
  — no exception, no duplicate movement, no duplicate discrepancy.

**Result**: exactly one `312` movement exists for this transfer. No
deadlock. No double-post.

## 3. Accept vs. a generic movement on the same destination bucket

A transfer (`092866da-3edd-444f-9123-3ce542679b90`, 2 units) was sent,
leaving it `in_transit` against the destination bucket (branch
`ic4-concurrency-dst`, location `...9612`, `variant_1`). Session A
posted an ordinary generic `401` (inventory count adjustment increase,
+1 unit) against that SAME bucket via `inventory_create_and_finalize`,
held the transaction open via `pg_sleep(4)`, then COMMIT. Session B,
started ~1.5s later, called `inventory_accept_branch_transfer` on the
transfer targeting the SAME bucket.

- **Session A**: `inventory_create_and_finalize` returned in **58.9ms**
  (`status: posted`, `document_number: INW/2026/000018`), then slept
  4026ms, then COMMIT.
- **Session B**: blocked for **2628.9ms** (matching A's remaining
  sleep), resumed after A's COMMIT, then succeeded (`status: accepted`,
  `total_accepted: 2`, `destination_movement_id: 3dfa23a5-...`).

**Result**: both movements posted successfully, serialized (not
deadlocked) via the shared `inventory_balances` row's own `FOR UPDATE`
lock (`inventory_get_or_create_balance_for_update`, the same primitive
every canonical movement path already uses) — reported here exactly as
observed, not assumed in advance. No new lock-ordering logic was
introduced; this test exercises the existing, already-proven-safe
single-balance-row locking strategy against a new caller (the accept
RPC), not a new mechanism.

## Residual data (disclosed, not silently cleaned up)

Matching this project's own established pattern (IC-1/IC-2/IC-3): once
a movement is posted, `inventory_movement_headers`/`_lines` are
immutable (`inventory_prevent_line_modification`/`_header_modification`
triggers) and cannot be deleted. As a direct, permanent result:

- 2 branches (`ic4-concurrency-src`/`-dst`, branch_number 962/963), 2
  warehouse_locations.
- 5 real, permanently-posted movement headers and their lines/ledger
  entries: 1 receipt (`PZ/2026/000023`), 2 `311` issues (`MM/2026/
000005`, `MM/2026/000006`), 2 `312` receipts (`MM/2026/000007`, `MM/
2026/000009`), 1 generic `401` (`INW/2026/000018`).
- 3 `inventory_branch_transfers` rows (`BT-000005`/`BT-000006`/`BT-
000007`, all reaching a terminal `accepted` status) and their lines.
- 3 `inventory_reservations` rows, all `status='fulfilled'`.
- The `inventory_balances` rows accurately reflecting this real,
  permanent history — internally consistent with the ledger, not
  orphaned, not part of any production customer/RepairOrder data,
  clearly tagged (`ic4-concurrency-*`, `BT-0000{05,06,07}`).

All other fixtures used elsewhere in this phase (the pgTAP file's own
scenarios, the ad-hoc smoke-test probes) ran inside `BEGIN...ROLLBACK`
and left zero residual data, confirmed by direct query after each.
