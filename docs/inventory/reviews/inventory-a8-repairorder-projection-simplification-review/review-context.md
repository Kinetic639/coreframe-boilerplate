# Inventory Core — A8 RepairOrder Projection Simplification — Context

**Scope**: remove the now-unjustified incremental RepairOrder location
projection (trigger + 2 persisted tables) and replace it with canonical
attribution history (`repair_order_line_movement_links`, unchanged, kept
as the sole persisted attribution source) plus a live, read-only
computation on top of it. IC-0 through IC-7, the IC-7 closing pass, the
architecture compression review, PRE-IC8 P0, A1–A6, A7 (base + follow-up
correction) are accepted and final, not reopened. IC-8 and Phase 10D are
explicitly NOT started. No new product feature was added; no
movement/reservation/allocation/transfer/reversal semantics changed; no
RepairOrder receiving/putaway physical behavior changed; the `apps/public-web`
legacy raw writer was not touched; numbering/idempotency/custom-field logic
was not centralized; no unrelated cleanup was performed.

## Starting state

- Branch: `zone3-zone5-integration-audit`.
- HEAD at start: `ea615451` ("Inventory Core A7 follow-up correction: close
  generic-container ownership bypass") — verified committed, working tree
  clean (`git status --porcelain` returned 0 lines) before any edit this
  pass.
- IC-8: confirmed not started (no review bundle for it exists under
  `docs/inventory/reviews/`).
- Phase 10D: confirmed not started (zero references anywhere in
  `apps/web/supabase`).

## Source of truth re-read in full before implementing

`docs/inventory/reviews/inventory-architecture-compression-review/`:
`module-boundary-review.md` (the section proposing Option D — no
incremental projection, compute live on read — including its own 4-option
comparison and the "OVERTURN the prior KEEP" recommendation),
`simplification-plan.md` (item A8's own scope/sizing/deploy-order
guidance, explicitly scheduled LAST, its own dedicated pass), `final-
proposed-architecture.md` (the target end-state: "domain projections"
box becomes "one source-of-truth table + a live query, no trigger, no
second persisted table"), `performance-handoff.md` (risk 1 — the
projection trigger's own per-row write cost — explicitly deferred to
"disappears rather than needing measurement" if Option D is implemented).

Also inspected live (via `pg_get_functiondef`, not assumed from docs):
`repair_order_location_attribution_sync` (the trigger function),
`rebuild_repair_order_projection_bucket_internal`,
`rebuild_repair_order_location_projection`, `receive_repair_order_stock`,
`putaway_repair_order_stock`, `write_repair_order_line_movement_link_internal`,
`attach_repair_order_line_movement`, `inventory_reverse_movement`, and the
TS implementation of `RepairOrdersService.getPhysicalStateForLine`.

## Re-confirmed evidence before changing architecture (Section 2)

- **A. `repair_order_line_locations` zero production readers** — confirmed.
  Only production reader anywhere in `apps/web`/`apps/public-web`:
  `RepairOrdersService.getPhysicalStateForLine`, itself with zero
  production callers (only 13 test call sites in its own test file).
- **B. `repair_order_location_attribution_uncertain` zero production
  readers** — confirmed, same single reader as above.
- **C. `getPhysicalStateForLine` zero production callers** — re-confirmed
  live via a fresh, exhaustive repo-wide grep this pass (not merely
  trusted from the prior audit) — still zero, no new caller appeared
  since the architecture compression review.
- **D. `repair_order_line_movement_links` remains the canonical persisted
  attribution history** — confirmed, unchanged, kept as-is.
- **E. No business process relies on projection-table writes as a
  trigger/input** — confirmed: the only "consumer" of the writes was the
  trigger's own later reads of the same tables (self-contained), and
  `putaway_repair_order_stock`'s own read of
  `repair_order_location_attribution_uncertain` (a gate, replaced by the
  new live-read's own explicit P0008 contract, see below).
- **F. No UI reads the persisted projection directly** — confirmed, zero
  references anywhere in `apps/web/src/components` or `apps/web/src/app`.
- **G. No external/reporting path reads those tables** — confirmed via
  repo-wide grep; no BI/reporting layer references either table.

**Zero-reader assumption holds. No STOP condition triggered.**

## P0008 recoverability gap — reproduced live, pre-implementation

Reproduced fresh, before any change this pass (BEGIN/ROLLBACK, zero
residual data): received 10 units, attributed fully to one RepairOrderLine
(canonical link). Then a **generic, non-RepairOrder-aware** movement (type
`402`, a plain inventory count adjustment — the same category any
warehouse operator could trigger with zero RepairOrder awareness)
decreased 4 units at the SAME bucket, with the attribution-authoritative
GUC off (the exact condition under which the old trigger's own heuristic
branch used to run). The incremental trigger "self-healed" the persisted
projection correctly (6 remaining), but the rebuild primitive — which
recomputes strictly from canonical links + ledger — found the ORIGINAL
link's own historical 10 still recorded, now exceeding the post-decrease
physical on-hand of 6, and raised:

```
P0008: Projection rebuild found known attribution (10.00000000000000000000000000)
exceeding physical on_hand (6.000000) at location ..., variant ...
-- history inconsistency
```

This proves the audit's own finding — "rebuild equals incremental" does
NOT hold for the generic-movement heuristic branch — with fresh, live,
pre-implementation evidence, not merely re-asserted from the prior audit.
See `architecture-evidence.md` for the full reproduction transcript and
how the new architecture eliminates this bug class entirely (there is no
longer a projection to desync from the ledger).

## Bundle contents

- `review-context.md` (this file)
- `changed-files.md` — full file-by-file change list, including the 4
  pre-existing pgTAP files found to reference the removed schema objects
  during blast-radius investigation and fixed
- `migration-summary.md` — all 7 migrations' full detail
- `test-evidence.md` — full 097-116 regression + Vitest + static-gate
  results
- `architecture-evidence.md` — the P0008 reproduction, the reversal-
  awareness redesign (read-time JOIN vs. write-time mirror), the putaway
  concurrency-lock redesign and the same-SKU-independence bug found and
  fixed mid-pass, the eligibility/disposition decisions and their
  reasoning, and the final architecture diagram
- `performance-evidence.md` — EXPLAIN ANALYZE results and write-path
  comparison
- `diff.patch` — the complete diff against baseline (HEAD `ea615451`)
