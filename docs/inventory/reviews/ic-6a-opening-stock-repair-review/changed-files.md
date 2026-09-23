# IC-6A Changed Files

**Baseline**: working tree as left at the end of IC-6 (HEAD still
`daeba1132b05295bb3a8221f6d218e77bfb36487` "ic6" — IC-6 itself remains
uncommitted, per the standing no-auto-commit policy; see review-context.md
item 1 for the full disclosure).

**Total**: 2 TypeScript files modified, 1 new pgTAP file. No migration
(none was needed — the correct canonical RPC already existed live).

## Modified

- `apps/web/src/server/services/inventory-products.service.ts` —
  `createOpeningStockMovement` (private method) rewritten: now calls
  `inventory_create_and_finalize` (movement type `401`) in a single
  atomic RPC call, instead of the old, broken two-call
  `inventory_create_draft_movement` → `inventory_post_movement`
  sequence (neither function exists live). `total_cost`/`currency`
  fields dropped from the line payload (never consumed by any live
  RPC, broken or canonical — not a loss of previously-working
  behavior). `reference_type`/`reference_id` (a concept the old broken
  code targeted but the current canonical engine's exposed RPC surface
  has no parameter for) replaced with `p_external_reference =
productId`, preserving the same product-traceability intent via the
  nearest available current mechanism.
- `apps/web/src/server/services/__tests__/inventory-products.service.test.ts`
  — new `describe("InventoryProductsService.createEnhancedProduct —
opening stock (IC-6A)")` block, 5 tests (scenarios A–E per the task's
  own required coverage): zero-quantity skip, correct-shape RPC call,
  error propagation + compensating cleanup, multi-variant independent
  quantities, and variant-identity/position-correctness under a mixed
  zero/nonzero-quantity variant list.

## New

- `apps/web/supabase/tests/109_ic6a_opening_stock_repair_test.sql` —
  `plan(16)`, 16/16 live. A dedicated live-integration proof (not a
  Vitest-mock proof) of the exact new call shape: before/after balance,
  exactly-one-movement/exactly-one-ledger-entry, movement type `401`,
  `external_reference` correctness, a real generated `document_number`,
  actor/audit metadata, and retry/idempotency safety (same idempotency
  key posted twice never double-applies the quantity).

## Not touched this phase

- No migration — the required canonical capability (`inventory_create_
and_finalize`, movement type `401`) already existed live; per §14's
  own explicit instruction, no migration was created merely to make
  old application code compile.
- `createEnhancedProductLegacy` — confirmed dead (unchanged from IC-6's
  own finding), NOT removed this pass, per the task's own explicit
  instruction (out of this pass's narrow "ACTIVE createEnhancedProduct
  path" scope; scheduled for a future, dedicated product-cleanup pass).
- `createEnhancedInventoryProductAction`'s own permission gate
  (`src/app/actions/warehouse/inventory/index.ts`) — read, confirmed
  already correctly requires `WAREHOUSE_INVENTORY_OPERATE`
  (`warehouse.inventory.operate`, exact string match with one of the
  two permissions the canonical RPC itself checks) whenever opening
  stock is involved — already properly wired, not changed.
- `inventory_create_and_finalize`/`inventory_create_draft`/`inventory_
finalize_posting_internal` and every other canonical SQL function —
  read in full to confirm exact contract/security behavior, not
  modified.
- The stale doc comment in `src/app/[locale]/dashboard/warehouse/
audits/[id]/report/page.tsx` referencing `inventory_create_draft_
movement` (describing `inventory_approve_count_session`'s own,
  unrelated, live-confirmed-clean internal implementation) — confirmed
  this is stale prose only, not a functional bug (the RPC it describes
  does not call the dead names), disclosed but not edited, since this
  pass's scope is the active `createEnhancedProduct` path only.
- Historical migration-text regression tests (`inventory-audits-
migration.test.ts`, `inventory-phase1/2/3-migrations.test.ts`,
  `inventory-cross-branch-transfers.test.ts`) that assert on OLD,
  already-applied migration files' own SQL text containing `inventory_
create_draft_movement`/`inventory_post_movement` — these are
  historical-migration-content proofs, not active callers; left
  untouched per the immutable-history convention.

## Note on `diff.patch`'s own scope

`diff.patch` is generated against HEAD (`daeba1132...`), since IC-6
itself remains uncommitted (see review-context.md item 0). This means
the diff hunks for `docs/inventory/inventory-core-implementation-
plan.md` and `docs/inventory/inventory-core-progress.md` include BOTH
IC-6's own prior uncommitted doc edits AND this pass's own new IC-6A
additions — there is no intermediate git ref representing "the tree as
IC-6 left it" to diff against instead. This is disclosed rather than
hidden. IC-6A's own actual contribution to these 2 files is precisely:
the new "HARD GATE" bullet + updated acceptance-criteria line in
`inventory-core-implementation-plan.md`'s own IC-8 section, and the new
IC-6A runtime-status block + phase-tracker row + "Overall execution"
bullet edit + the final "2026-09-17 (IC-6A — ...)" change-log entry in
`inventory-core-progress.md` — both clearly delimited by their own
"IC-6A"-labeled headings, distinguishable from IC-6's own
already-separately-documented contribution in `ic-6-review/diff.patch`.
The 2 TypeScript files and the 1 new pgTAP file are cleanly
attributable to IC-6A alone (IC-6 never touched them).
