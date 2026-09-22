# Performance Risk Handoff for IC-8

Identification only — no benchmarking, no index changes, no query
rewrites performed in this audit. Each risk states exactly what IC-8
should measure.

## 1. RepairOrder projection trigger fires per-row, with non-trivial work per firing

`repair_order_line_locations_ledger_sync` is an `AFTER ROW` trigger
firing on every qualifying ledger insert. Per firing it can run: a
header/original-movement lookup JOIN (reversal detection), for the
reversal branch a nested loop over attribution links, 2 `EXISTS`
probes, a `FOR UPDATE`-locked aggregate over the projection table, and
up to 2 INSERT/UPDATE/DELETE statements. **Note**: `module-boundary-
review.md` recommends removing this trigger entirely (Option D) —
if implemented, this risk disappears rather than needing measurement.
**If NOT implemented**: IC-8 should `EXPLAIN ANALYZE` a high-volume
movement post (e.g. 200 lines, single multi-effect type) with vs.
without this trigger enabled (in an isolated test transaction) to
isolate its marginal per-ledger-row cost.

## 2. Projection rebuild is O(buckets) RPC calls × O(joins) each, nested-loop not set-based

`rebuild_repair_order_location_projection` loops bucket-by-bucket,
each iteration doing a `FOR UPDATE` lock + DELETE + a 4-way JOIN+GROUP
BY scoped only by `(org, branch, location, variant)` — computing the
FULL attribution history for that bucket, not just one order's slice.
**IC-8 should measure**: `EXPLAIN ANALYZE` the bucket-rebuild primitive
directly for a bucket with a long ledger history (not just one order's
traffic) to see whether the join degrades linearly or worse as history
grows; also the outer RPC end-to-end for an order touching 50 distinct
buckets.

## 3. Reservation/allocation creation: sequential per-line row locks + a shared org-wide counter lock

Both RPCs take a `FOR UPDATE` lock on the org's single `inventory_
settings` row for numbering, then loop lines, each doing a variant/
product lookup JOIN, a balance-row lock/get-or-create, and an UPDATE.
**IC-8 should measure**: `EXPLAIN ANALYZE` a 50-line reservation against
50 distinct balance rows; separately, time N concurrent reservation-
creation calls for the SAME org to quantify serialization against the
shared settings-row lock (same root cause as risk 7).

## 4. Movement posting is O(lines × effects), each iteration doing lock+read+write+ledger-insert, plus a per-line 5-subquery snapshot UPDATE

`inventory_finalize_posting_internal` runs a bulk snapshot UPDATE that
executes FIVE correlated subqueries per row (product name, sku, unit
code, source/destination location name), then for each (line, effect)
pair: a balance-row lock, a balance UPDATE, a ledger INSERT (which
itself fires the per-row trigger in risk 1). For L lines × E
effects/line, roughly O(L×E) round-trip-equivalent operations inside
one function call. **IC-8 should measure**: timing for `create_and_
finalize` with a large multi-line movement (e.g. 100 lines, 2 effects
each = 200 balance-touching iterations) to establish per-line marginal
cost and linearity.

## 5. Branch transfer full lifecycle: per-line loop repeated across 3 separate RPC calls, each touching the shared counter

A transfer's total cost across create→send→accept is the sum of at
least 3 separate RPC invocations, each acquiring its own settings/
sequence lock, plus the full engine cost (risk 4) once the draft is
finalized. **IC-8 should measure**: end-to-end timing (not just one
RPC) for a 50-line transfer across the full create→send→accept
lifecycle, counting total statements executed (e.g. via `pg_stat_
statements`/`auto_explain`).

## 6. `RepairOrdersService.getPhysicalStateForLine` is a sequential multi-round-trip TS-layer read, not one SQL query

5+ sequential `await`s (scope resolution → projection select →
reservations → allocations → container placement), no `Promise.all`,
no single joined SQL view. **Note**: this method currently has zero
production callers (see `service-boundary-review.md`) — this risk is
latent, not active, but relevant if/when it is wired up, and doubly
relevant if `module-boundary-review.md`'s Option D recommendation is
implemented (this method would gain one more live-computed query).
**IC-8 should measure**: wall-clock for a line with a long reservation/
allocation/container history; whether the round-trips could be
parallelized or collapsed into one view — an application-layer N-query
pattern, needs request-level tracing, not `EXPLAIN ANALYZE` alone.

## 7. Lock-contention candidate: the single per-organization `inventory_settings` row is locked by EVERY document-numbering operation across EVERY document type

Movement create, draft create, reservation create, allocation create,
PO create, and branch-transfer create ALL take `FOR UPDATE` on the same
one row per org before incrementing their own counter column. Under
concurrent writers in the same org, these serialize regardless of how
unrelated the operations are. **IC-8 should measure**: a concurrent-
session benchmark — N parallel sessions each creating a different
document type for the SAME org, measuring wait time attributable
specifically to this row lock (`pg_locks`/`pg_stat_activity` wait-event
sampling). Separately, `inventory_document_sequences` (per org+doc\_
type+year) is a distinct, less-contended lock, worth the same
measurement if movement volume is high. **This is also the underlying
root cause of the DRY finding on document-numbering duplication** — a
future centralization pass (dry-review.md) is the natural place to also
reconsider whether numbering needs to stay a single per-org row lock,
or could be sharded, once IC-8's own measurement shows whether
contention is actually a problem in practice.

## 8. Indexes on hot-path WHERE clauses — mostly present, 2 redundancies, 1 gap

Live-checked via `pg_indexes`. `inventory_balances` has 11 indexes
including a solid primary hot-path composite unique index. Two
near-duplicate index pairs found (`inventory_balances_last_movement_
id_idx` full vs. a partial variant on the same column; two 3-column
location indexes with different leading-column order) — worth a
`pg_stat_user_indexes.idx_scan` check before dropping either. **Gap**:
`inventory_reservations` has no index covering location*id/variant_id
directly (only branch_id/cancelled_by/created_by/the org+number unique
key) — any query filtering reservations by location/variant would need
a sequential scan or route through `inventory_reservation_lines`
instead (not checked this pass whether that table has the right
index). `inventory_stock_ledger_entries` and `repair_order_line*
locations`both have solid, purpose-built index shapes. **IC-8 should
measure**:`pg_stat_user_indexes`scan counts for the 2 redundant-
looking pairs after a representative workload, before dropping either;`EXPLAIN` any actual reservation-by-location/variant query the app
issues, if one exists, to confirm whether the gap is actually hit.

## 9. Unbounded growth risk: `inventory_stock_ledger_entries` is strictly append-only with zero partitioning/archival

The append-only trigger (correct, deliberate audit-trail property)
means this table can only grow, forever — no `PARTITION BY`, no
archival job found in this pass's schema read (not an exhaustive grep
beyond the schema level). Every hot-path read that joins through this
table (the trigger in risk 1, the rebuild in risk 2, the reconciliation
diagnostic) proportionally slows as row count grows, regardless of
index quality, via buffer-cache pressure. **IC-8 should measure**:
projected growth rate at expected production movement volume vs.
current index sizes, and whether a `posted_at`-range partitioning
strategy (e.g. monthly) would keep the hot-path index small at 10x/100x
current row count — exactly the measurement class this audit defers to
IC-8 rather than deciding now.
