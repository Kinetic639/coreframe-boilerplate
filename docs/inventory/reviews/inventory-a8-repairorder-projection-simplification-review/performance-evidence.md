# Inventory Core — A8 RepairOrder Projection Simplification — Performance Evidence

Narrow comparison only, per the task's own explicit scope ("NOT full IC-8
benchmarking"). No index changes made — none were objectively needed; any
future index need is left for IC-8 per the task's own instruction.

## A. Write-path cost change

**Before**: every `INSERT` into `inventory_stock_ledger_entries` fired
`repair_order_line_locations_ledger_sync` (`AFTER ROW`), which — for the
reversal branch — did a header/original-movement lookup JOIN, a nested
loop over attribution links, and a FULL bucket recompute (calling
`rebuild_repair_order_projection_bucket_internal`, itself a `FOR UPDATE`
lock + `DELETE` + 4-way JOIN+GROUP BY); for the non-reversal,
GUC-off branch, 2 `EXISTS` probes, a locked aggregate, and up to 2
INSERT/UPDATE/DELETE statements — on **every** qualifying ledger row,
including ledger rows with zero RepairOrder relevance (the trigger's own
early-exit check only short-circuited if the touched bucket already had
projection history).

**After**: zero trigger overhead on any ledger insert, unconditionally —
the trigger no longer exists. `receive_repair_order_stock`,
`putaway_repair_order_stock`, and `attach_repair_order_line_movement`'s
own write-path cost is now exactly: the canonical link write (`write_
repair_order_line_movement_link_internal` — unchanged, was already
required) and, for `putaway_repair_order_stock` only, one additional
`FOR UPDATE` lock + live contribution computation per line (replacing the
old table read+lock it already performed) — no NET new write-side work
for putaway, and a pure removal of write-side work everywhere else
(receive, attach, and every non-RepairOrder ledger insert).

This is a strict write-path improvement, matching `performance-handoff.md`'s
own risk 1 prediction: "if implemented, this risk disappears rather than
needing measurement."

## B. Live-read cost — EXPLAIN ANALYZE

Fixture: a RepairOrderLine with a genuinely multi-bucket history (2
receipts, 3 putaways to 3 distinct shelves, 1 reversal of the last
putaway) — 4 distinct `(location, variant)` buckets touched.

Internal bucket-discovery query (the first query
`get_repair_order_line_physical_state` runs), `EXPLAIN (ANALYZE,
BUFFERS)`:

```
Unique  (cost=54.92..54.93 rows=1 width=32) (actual time=8.369..8.375 rows=4 loops=1)
  ->  Sort (Sort Method: quicksort  Memory: 25kB)
        ->  Nested Loop  (actual time=3.672..8.359 rows=8 loops=1)
              ->  Nested Loop  (actual time=3.428..7.966 rows=8 loops=1)
                    ->  Index Only Scan using repair_order_line_movement_links_unique
                          Index Cond: (repair_order_line_id = ...)
                          Heap Fetches: 5
                    ->  Index Scan using inventory_stock_ledger_line_effect_uidx on inventory_stock_ledger_entries
                          Index Cond: (movement_line_id = rolml.inventory_movement_line_id)
              ->  Index Scan using inventory_movement_lines_pkey on inventory_movement_lines
                    Index Cond: (id = sle.movement_line_id)
Planning Time: 0.768 ms
Execution Time: 8.460 ms
```

**Index usage**: every real-table access is an Index Scan or Index Only
Scan (`repair_order_line_movement_links_unique`,
`inventory_stock_ledger_line_effect_uidx`,
`inventory_movement_lines_pkey`) — zero sequential scans on any real
table (only on the test's own tiny in-memory temp fixture table, which
is irrelevant to production cost). **Rows scanned**: 8 rows through the
join chain to discover 4 distinct buckets for a line with 3 canonical
links — proportional to this line's own history size, not the org's.
**A visible, expected cost driver**: `has_branch_permission(...)` (the
RLS policy predicate) is evaluated per row at 2 join steps, appearing
nested inside the plan — a real, structural RLS cost inherent to every
RLS-scoped query in this codebase, not specific to this new function; not
something A8 introduces or should fix.

## C. End-to-end function-call timing (external measurement)

| Scenario                                        | Buckets touched | Time    |
| ----------------------------------------------- | --------------- | ------- |
| Small line (1 receipt, 1 bucket)                | 1               | 14.5 ms |
| Multi-line (2 receipts, 3 putaways, 1 reversal) | 4               | 32.5 ms |

Scales with the number of buckets the line has touched (roughly linear
across this 2-point sample), not with organization-wide data volume —
consistent with the deliberately bounded "narrowest useful query" design
(Section 6 of the task). At workshop-scale traffic (the module's own
documented usage pattern, not high-frequency retail), both figures are
comfortably within an acceptable single-request read latency, and are
directly comparable in cost class to the 4-6 sequential queries
`getPhysicalStateForLine` already issues for its own
reservation/allocation/container reconciliation (unchanged by this
pass) — `performance-handoff.md`'s own risk 6 already anticipated this
comparison point.

## D. Conclusion

Narrow performance result: **acceptable**. No index changes made. If a
future high-frequency read path is wired up and this cost is shown to
matter in practice at production scale, that is exactly the kind of
finding `performance-handoff.md`'s own risk 6/8 already flagged for
IC-8's own dedicated measurement pass — re-open there with then-current
read-frequency numbers, not decided speculatively here.
