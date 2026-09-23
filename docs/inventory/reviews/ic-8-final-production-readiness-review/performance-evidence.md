# IC-8 — Sections 13-15: Performance Baseline, EXPLAIN ANALYZE, Table Growth

This section explicitly closes out the 9-item performance-risk handoff
from `inventory-architecture-compression-review/performance-handoff.md`,
which named itself as the authoritative "IC-8 should measure" list.
Addressed item-by-item below, plus the general table-growth/EXPLAIN
baseline the task's own Section 13-15 asks for.

## Section 13 — Performance baseline / table growth (live, this pass)

| Table                              | Live rows | Total size |
| ---------------------------------- | --------- | ---------- |
| `repair_order_lines`               | 167       | 160 kB     |
| `inventory_movement_lines`         | 126       | 344 kB     |
| `inventory_stock_ledger_entries`   | 118       | 192 kB     |
| `inventory_movement_headers`       | 54        | 320 kB     |
| `inventory_balances`               | 43        | 248 kB     |
| `repair_orders`                    | 29        | 168 kB     |
| `inventory_reservation_lines`      | 7         | 184 kB     |
| `inventory_reservations`           | 6         | 128 kB     |
| `inventory_container_lines`        | 2         | 88 kB      |
| `inventory_containers`             | 1         | 112 kB     |
| `repair_order_line_movement_links` | 0         | 96 kB      |
| `inventory_allocations`            | 0         | 112 kB     |
| `inventory_allocation_lines`       | 0         | 200 kB     |

**Honest framing**: this is dev/staging-scale data (tens to low hundreds
of rows), not production-representative volume. There is no historical
time series and no production traffic to review growth trends against.

## Section 14 — EXPLAIN ANALYZE on hot paths (live, this pass)

### Index audit — the two hottest paths

**Balance row lock**: `inventory_balances_unique_stock_identity_uidx`
(UNIQUE, `organization_id, branch_id, location_id, variant_id,
COALESCE(lot_id,...), COALESCE(serial_id,...)`) — byte-for-byte match of
`inventory_get_or_create_balance_for_update`'s own WHERE clause. Correct.

**Ledger history read**: `inventory_stock_ledger_location_variant_idx`
(`organization_id, branch_id, location_id, variant_id, balance_field,
posted_at`) — matches both filter and sort columns. Correct.

### EXPLAIN output

```
inventory_balances lock-row lookup: Seq Scan (Total Cost: 3.40, Plan Rows: 1)
inventory_stock_ledger_entries history read: Seq Scan (Total Cost: 8.24, Plan Rows: 1)
```

Expected, correct planner behavior at 43/118 live rows (a full scan is
genuinely cheaper than an index scan at this size) — not a defect. The
correct indexes exist and are correctly shaped for when volume grows
past the planner's own crossover point; this can only be demonstrated via
the index definitions themselves at current scale, not via cost numbers.

## Section 15 / Handoff disposition — item by item

**1. RepairOrder projection trigger per-row cost** — **OBSOLETE.** A8
removed `repair_order_line_locations_ledger_sync` entirely (confirmed
live, `test-evidence.md` file 116, assertion A1: 0 rows in `pg_trigger`).
The handoff itself said this risk "disappears rather than needing
measurement" if the trigger were removed — it was.

**2. Projection rebuild O(buckets) cost** — **OBSOLETE.** Both
`rebuild_repair_order_location_projection` and its internal bucket
helper no longer exist (A8; confirmed live, file 116 assertions C1/C2).

**3. Reservation/allocation per-line lock + shared counter lock** —
**NOT MEASURED.** Requires either large synthetic fixture data (a
50-line reservation) or genuine concurrent-session load, neither of
which this pass can safely/honestly produce: generating large synthetic
data against the shared live target for a one-off timing measurement
is exactly the kind of scope creep Section 37 prohibits (residual test
data, no lasting value), and genuine concurrent-session tooling is
unavailable this session (same constraint disclosed in
`concurrency-evidence.md`). Structurally confirmed unchanged: the
`FOR UPDATE` lock on the org's `inventory_settings` row is still the
first operation in both RPCs (verified via `pg_get_functiondef`).

**4. Movement posting O(lines × effects) cost** — **NOT MEASURED**, same
constraint as item 3. Structurally confirmed unchanged: `pg_get_
functiondef` on `inventory_finalize_posting_internal` shows the same
five-subquery snapshot UPDATE and per-(line,effect) lock+write+ledger-
insert loop the handoff described; A1-A8 did not touch this function's
own core loop (only the security-boundary/explicit-effects surface,
per IC-2).

**5. Branch-transfer 3-RPC lifecycle cost** — **NOT MEASURED**, same
constraint. Structurally unchanged since IC-4's own original
implementation (confirmed via `pg_get_functiondef` — no A-phase
migration touches `inventory_send_branch_transfer`/`inventory_accept_
branch_transfer`).

**6. `getPhysicalStateForLine` multi-round-trip TS read** — **RESOLVED,
not merely obsolete.** A8 replaced this entire pattern: the read is now
`get_repair_order_line_physical_state`, a single `SECURITY INVOKER` SQL
function call (one round trip, not 5+ sequential `await`s). This is a
net performance improvement over what the handoff flagged, not just a
removed risk — confirmed via `pg_get_functiondef` (one function, no
nested RPC calls to other multi-step TS methods) and via the caller-audit
agent's confirmation this is the sole live-read path now used.

**7. Shared `inventory_settings` row lock across all document types** —
**NOT MEASURED**, same concurrent-session tooling constraint as items 3-5.
Structurally confirmed still true: every document-numbering RPC
(movement, reservation, allocation, PO, branch-transfer) still locks the
same one row per org (unchanged by A1-A8, confirmed via `pg_get_
functiondef` spot-checks). This remains a legitimate, disclosed,
NOT-YET-MEASURED contention risk for the deferred-debt list — not
resolved, not newly discovered, carried forward.

**8. Index redundancy/gap audit** — **RE-VERIFIED, gap CLOSED, redundancy
CONFIRMED.** The handoff's suspected `inventory_reservations`
location/variant index gap is **closed**: `inventory_reservation_lines_
variant_idx` (`organization_id, branch_id, variant_id, location_id`)
exists and covers exactly that query shape (confirmed live this pass —
not present at handoff time, or missed by that pass; either way, closed
now). The redundant-index pair the handoff flagged (`last_movement_id`,
partial vs. full) is confirmed still present this pass (see Section 14
above) — carried to `deferred-debt.md`, not fixed (no correctness/
security impact, not a Section 37 blocker).

**9. `inventory_stock_ledger_entries` unbounded growth, no partitioning**
— **UNCHANGED, confirmed still true.** Still strictly append-only
(correct, deliberate), still no `PARTITION BY`, no archival job found.
At 118 current rows this is not an active problem; it remains a real,
disclosed future-scaling item, not something IC-8 itself needs to
resolve at pre-production volume. Carried to `deferred-debt.md`.

## Summary

| Handoff item                                  | Disposition                                                             |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| 1. Projection trigger per-row cost            | Obsolete (A8 removed the trigger)                                       |
| 2. Projection rebuild O(buckets)              | Obsolete (A8 removed the RPCs)                                          |
| 3. Reservation/allocation lock cost           | Not measured — no safe load/concurrency tooling this pass               |
| 4. Movement posting O(L×E) cost               | Not measured — same constraint                                          |
| 5. Branch-transfer 3-RPC lifecycle            | Not measured — same constraint                                          |
| 6. `getPhysicalStateForLine` multi-round-trip | Resolved (A8's single-query replacement)                                |
| 7. Shared settings-row lock                   | Not measured — same constraint; carried forward as real, undecided risk |
| 8. Index redundancy/gap                       | Gap closed; 1 redundant pair confirmed, deferred                        |
| 9. Unbounded ledger growth                    | Unchanged, confirmed, deferred (not urgent at current volume)           |

**Three items (3, 4, 5, 7) remain genuinely unmeasured** due to this
pass's own disclosed tooling constraint (no safe way to generate
large synthetic load or run genuine concurrent sessions against the
shared live target without leaving residual data or exceeding Section
37's scope). This is not fabricated as resolved — flagged explicitly
for the final readiness assessment as an open performance-verification
gap, distinct from the reproducibility gap but real in its own right.
