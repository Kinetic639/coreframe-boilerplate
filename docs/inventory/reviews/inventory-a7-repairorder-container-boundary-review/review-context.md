# Inventory Core — A7 Domain-Boundary Cleanup — Context

**Scope**: exactly one purpose — remove the one confirmed backward
dependency (generic Inventory Core → `repair_order_lines`) from
`inventory_add_to_container`, while preserving the same RepairOrder
ownership/security check, the same transaction boundary, the same
atomicity, the same error behavior, the same generic container
semantics, the same RLS/grants, and zero TOCTOU regression. IC-0
through IC-7, the IC-7 closing pass, the architecture compression
review, PRE-IC8 P0, and A1–A6 are accepted and final, not reopened. A8
is explicitly NOT started (no projection changes in this pass). IC-8
and Phase 10D are NOT started. No Inventory Core business semantics, no
container/reservation/allocation redesign, no RepairOrder projection
architecture, and no `apps/public-web` legacy-writer fix were touched.

## Starting state

- Branch: `zone3-zone5-integration-audit`.
- HEAD at start: `7df19e01` ("Inventory Core A1-A6 simplification
  pass") — **verified committed**, working tree clean
  (`git status --porcelain` returned 0 lines) before any edit this
  pass.
- A8: confirmed not started — no reference to
  `repair_order_line_locations_ledger_sync`/`repair_order_location_
attribution_sync` removal or projection-architecture change anywhere
  in this pass's diff.
- IC-8: confirmed not started (no new review bundle for it exists).
- Phase 10D: confirmed not started.

## Source of truth re-read in full before implementing

`docs/inventory/reviews/inventory-architecture-compression-review/`:
`module-boundary-review.md` (the section proposing this exact
extraction, including its own TOCTOU analysis), `simplification-plan.md`
(item A7's own scope/sizing/deploy-order guidance), `final-proposed-
architecture.md` (the target dependency-direction diagram this pass
completes).

## Re-confirming the boundary violation (live, not from the audit alone)

Live-fetched `pg_get_functiondef` for `inventory_add_to_container`
confirmed the exact inline branch the audit described, unchanged since
the audit: `IF v_container.reference_type = 'repair_order' THEN` — a
3-table JOIN (`inventory_reservation_lines` → `inventory_reservations`
→ `repair_order_lines`) resolving the allocation's own RepairOrder and
comparing it to the container's own `reference_id`.

A repo-wide `prosrc` scan (`proname LIKE 'inventory\_%'` AND references
`repair_order_lines`/`repair_orders`) confirmed **`inventory_add_to_
container` is still the ONLY generic Inventory Core primitive with this
backward dependency** — every other function referencing those tables
(`attach_repair_order_line_movement`, `materialize_repair_orders_from_
session`, `putaway_repair_order_stock`, `rebuild_repair_order_location_
projection`, `rebuild_repair_order_projection_bucket_internal`,
`receive_repair_order_stock`, `write_repair_order_line_movement_link_
internal`) is already a classified, valid RepairOrder-domain
orchestrator/projection function, not generic core.

A parallel scan confirmed **PurchaseOrder has no equivalent backward
dependency** — zero `inventory_%` functions (other than `inventory_
create_purchase_order`/`inventory_receive_purchase_order` themselves)
reference `purchase_order_lines`/`inventory_purchase_orders`.

Live code matched the audit exactly — no mismatch found, nothing to
STOP and report.

## Write-once re-verification (the TOCTOU-safety load-bearing fact)

Re-verified live, not merely trusted from the prior audit:

- **`inventory_containers.reference_type`/`reference_id`**: zero
  functions anywhere in `pg_proc` contain an `UPDATE ... SET
reference_type = ...` (or `reference_id`) statement. Zero TypeScript
  writers touch either column (`apps/web`'s own 2 real writers of this
  table only ever `.select()`; `apps/public-web`'s legacy `.insert()`
  in `createLocationContainerAction` never sets either field, and its
  `.update()` in `relocateContainerAction` only ever touches
  `current_location_id`/`updated_at`). Only `inventory_create_
container` sets `reference_type` — at creation time only.
- **`inventory_allocation_lines.reservation_line_id`**: zero functions
  anywhere in `pg_proc` contain an `UPDATE ... SET reservation_line_id
= ...` statement. Zero TypeScript writers touch this column (the one
  real reference in `RepairOrdersService` is a `.select()`). Only
  `inventory_create_allocation` sets it — at creation time only.

**No contradiction found. Both columns remain write-once, exactly as
the prior audit found.** This is documented as a load-bearing
invariant of the new wrapper's own design — see `boundary-
evidence.md` for the full TOCTOU reasoning this pass performed.

## What this pass did, in order

1. Verified starting state (above) — clean, committed baseline.
2. Re-read the 3 source docs in full; re-confirmed the boundary
   violation and PurchaseOrder's own lack of an equivalent, live, not
   from the audit's own claim alone.
3. Re-verified the write-once invariant live (both checked columns).
4. Live-fetched the current grant state of `inventory_add_to_container`
   to replicate for the new wrapper.
5. Applied migration 1 (`repair_order_add_allocation_to_container`,
   the new RepairOrder-domain wrapper) — deployed FIRST, before
   narrowing the generic primitive, per the plan's own explicit deploy
   order.
6. Live-verified the wrapper's own security model (SECURITY DEFINER,
   hardened search_path, PUBLIC/anon revoked, authenticated/service_role
   granted, single overload) and, with the OLD branch still present in
   the generic primitive, live-probed 4 scenarios (same-RepairOrder
   success, cross-RepairOrder rejection, generic-container success,
   direct-generic-call still-rejected) before narrowing anything.
7. Applied migration 2 (narrow `inventory_add_to_container` — remove
   only the RepairOrder-ownership branch and its now-dead local
   variable; every other check/statement byte-identical).
8. Re-ran the same 4 probes plus a 5th (direct generic call, cross-
   RepairOrder, now SUCCEEDS — the disclosed, accepted design
   tradeoff for any caller bypassing the wrapper) — all matched
   expectations exactly.
9. Updated the one real TypeScript caller,
   `RepairOrdersService.placeAllocationInContainer`, to call the new
   wrapper instead of the generic primitive directly — same params,
   same result shape, same error normalization (the existing
   `REPAIR_ORDER_CONTAINER_KNOWN_ERRORS` allowlist already covered
   every message the wrapper can raise, byte-for-byte, since they are
   the exact same messages the removed inline branch used to raise —
   zero allowlist changes needed).
10. Wrote a new, dedicated pgTAP file (`114_a7_repairorder_container_
boundary_test.sql`, plan(18)) covering scenarios A–J plus 3
    security-model checks. Self-caught and fixed 2 authoring bugs
    before trusting the result: an initial `plan(16)`/18-assertion
    mismatch, and a genuine test-design bug where scenario G2's own
    deliberate successful direct-generic-call placement silently
    invalidated the original J1/J2 assertions' own premise (fixed by
    re-deriving the correct expected values and using an allocation
    line with no other successful placement anywhere in the file for
    the atomicity proof).
11. Found and fixed the one pre-existing test file requiring a
    disclosed correction: `100_repair_order_container_orchestration_
phase10c_test.sql`'s own scenario T19 directly called the generic
    primitive expecting cross-RepairOrder rejection — now updated to
    call the new wrapper instead (the real production enforcement
    point post-A7), preserving 100% of the file's downstream state and
    assertions (T20 onward) completely unchanged.
12. Updated `RepairOrdersService`'s own Vitest mock-based test
    (`repair-orders.service.test.ts`) — one assertion over-specified
    the exact RPC name called; updated to the new wrapper name, params
    and result assertions unchanged.
13. Ran the full 097–114 pgTAP regression (18 files) — see
    `test-evidence.md`.
14. Ran relevant Vitest, `pnpm type-check`, `pnpm lint`, `pnpm build`,
    `git diff --check` — all clean.

## Bundle contents

- `review-context.md` (this file)
- `changed-files.md` — full file-by-file change list
- `migration-summary.md` — both migrations' full detail
- `test-evidence.md` — full regression + Vitest + static-gate results
- `boundary-evidence.md` — the write-once/TOCTOU evidence, the
  disclosed direct-caller behavior tradeoff, and the before/after
  dependency-count measurement
- `diff.patch` — the complete diff against baseline (HEAD `7df19e01`)
