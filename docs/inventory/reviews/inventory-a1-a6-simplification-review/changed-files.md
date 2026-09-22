# Inventory Core — A1–A6 Simplification Pass — Changed Files

**Baseline**: HEAD `96faa009` ("ic7-closing, architecture compression
review, pre-ic8-p0"). **Total**: 2 new migrations + 1 new pgTAP test file

- 1 pre-existing pgTAP test file corrected (1 disclosed assertion) + 8
  TypeScript files changed (2 modified in `apps/public-web`, 1 deleted +
  5 modified in `apps/web`) + this review bundle.

## New migrations (2 — exactly the 2 the task specified, no more)

1. `20260922063007_a1_drop_dead_inventory_convert_quantity.sql` — `DROP
FUNCTION IF EXISTS public.inventory_convert_quantity(uuid, uuid, uuid,
uuid, numeric)`.
2. `20260922063459_a4_revoke_authenticated_balance_lock_helper.sql` —
   `REVOKE EXECUTE ... FROM authenticated, PUBLIC, anon` on
   `inventory_get_or_create_balance_for_update(uuid,uuid,uuid,uuid,uuid,
uuid,uuid)`.

See `migration-summary.md` for full detail.

## New pgTAP test file

`apps/web/supabase/tests/113_a1_a4_simplification_security_test.sql` —
`plan(7)`, 7/7 live. Proves: `inventory_convert_quantity` no longer
exists for anon OR authenticated (both now `42883`, not merely
re-gated), zero rows in `pg_proc`; `inventory_get_or_create_balance_for_
update` direct calls denied for both authenticated (newly, by this pass)
and anon (already denied pre-pass, re-confirmed unaffected), a
representative canonical caller (`inventory_create_reservation`) still
succeeds end-to-end, exactly 1 overload remains (grant-only change, body
untouched).

## Pre-existing test file corrected (1, required by A1's own removal — not scope creep)

- `apps/web/supabase/tests/111_ic7_closing_security_test.sql` — scenario
  A8 previously proved `anon` got `42501` (permission denied) calling
  `inventory_convert_quantity`, matching the IC-7 closing pass's own
  grant-hardening fix. Since that function is now DROP'd entirely, ANY
  caller gets `42883` (undefined_function) instead — a strictly stronger
  closure superseding the original assertion's own premise. Corrected
  forward, matching this project's own established precedent (a
  disclosed, deliberate change updates the test that proved the old
  behavior; the change itself is never weakened to keep an old
  assertion passing). Assertion COUNT unchanged (still 24, matching
  `plan(24)`); only the expected SQLSTATE and message text for this one
  scenario changed. The "STALE-OVERLOAD" check later in the same file
  (which lists `inventory_convert_quantity` among 8 function names) is
  UNCHANGED and still correct — a `HAVING count(*) > 1` check across a
  name list is unaffected by one name now matching zero rows instead of
  one.

## TypeScript files changed

### A1 — dead code removed

- `apps/web/src/server/services/inventory-products.service.ts` —
  removed `createEnhancedProductLegacy` (175 lines) and `listSuppliers`
  (15 lines). Zero other lines touched in this file for A1 (A6's
  additions to this same file are separate, see below).
- `apps/public-web/src/server/services/inventory-products.service.ts` —
  identical removal (confirmed byte-identical to `apps/web`'s pre-pass
  content before removal).
- `apps/web/src/app/actions/warehouse/ambra-location-inventory.ts` —
  **deleted entirely**. All 3 of its exports
  (`deletePutawayRuleAction`, `findContainersByReferenceAction`,
  `createLocationPutawayRuleAction`) were the confirmed-dead A1 items;
  every remaining line in the file (2 private helpers, 2 zod schemas,
  all imports) existed only to serve them, becoming 100% inert once
  removed — not a separate scope decision, the direct, unavoidable
  consequence of removing exactly the 3 named items.
- `apps/public-web/src/app/actions/warehouse/ambra-location-inventory.ts`
  — surgically trimmed: removed the 3 matching dead actions
  (`deletePutawayRuleAction`, `findContainersByReferenceAction`,
  `createLocationPutawayRuleAction`) and their 2 exclusively-private
  schemas (`createPutawayRuleSchema`, `findByReferenceSchema`).
  `uuidSchema` and `requireStockableLocation` were KEPT — both are
  shared with 2 still-live (if legacy/broken, per PRE-IC8 P0's own
  disclosed, deliberately-not-fixed-here decision) exports:
  `createLocationContainerAction`, `addItemsToContainerAction`,
  `removeItemFromContainerAction`, `relocateContainerAction`. None of
  these 4 were touched — per this pass's own explicit instruction (§12,
  "Do NOT fix that now").

### A2/A3 — RepairOrdersService de-duplication

- `apps/web/src/server/services/repair-orders.service.ts`:
  - Added one private helper, `belongsToRepairOrderLine(row, scope,
repairOrderLineId): boolean`, used by `releaseReservationForLine`
    and `allocateForLine` (the only 2 genuinely byte-identical sites —
    see `review-context.md`'s stale-claim correction).
    `placeAllocationInContainer` was NOT touched (its own check is a
    different shape entirely); `removeAllocationFromContainer`'s
    similar-but-not-identical check was also NOT touched (merging it
    would not be purely mechanical).
  - Replaced the 5 `normalize*RpcError` function bodies with 3-line
    calls to one new generic `normalizeKnownRpcError(error,
knownErrors)`. All 5 allowlist arrays (their DATA) are completely
    unchanged. All 5 function names/signatures/fallback messages are
    unchanged. Zero call sites changed.

### A6 — catalog-method move

- `apps/web/src/server/services/inventory-enterprise.service.ts` —
  removed all 7 catalog methods (`createOptionGroup`, `createOptionValue`,
  `generateVariants`, `updateVariantPricing`, `updateVariantDetails`,
  `createLot`, `createSerial`) verbatim; removed 5 now-unused type
  imports/re-exports (`CreateOptionGroupInput`, `CreateOptionValueInput`,
  `GenerateVariantInput`, `CreateLotInput`, `CreateSerialInput` —
  confirmed zero remaining usage in this file, confirmed zero external
  importer relies on this file's own re-export of them). `errorMessage`
  helper KEPT here (still used by ~25 other, non-catalog methods).
- `apps/web/src/server/services/inventory-products.service.ts` — added
  the same 5 type imports/re-exports, added a local `errorMessage`
  helper (a required, minimal duplication — this file has no equivalent
  and the 7 moved methods need it; `InventoryEnterpriseService` keeps
  its own copy since it's still used elsewhere there), inserted all 7
  methods verbatim (byte-for-byte body, only the `errorMessage`
  reference now resolves to this file's own local copy).
- `apps/web/src/app/actions/warehouse/inventory/index.ts` — updated all
  7 real call sites from `InventoryEnterpriseService.X` to
  `InventoryProductsService.X`. `InventoryEnterpriseService`'s own
  import stays (26 other real usages remain in this file).
- `apps/web/src/server/services/__tests__/inventory-enterprise-update-
variant-details.test.ts` — updated its import and all 4 test-body
  references from `InventoryEnterpriseService` to
  `InventoryProductsService` (the only dedicated test coverage among
  the 7 moved methods; the other 6 had no dedicated unit tests before
  this pass and none were added, matching "existing unit tests for
  these methods move with them" — there was nothing else to move).

## A5 — rejected, zero files touched

`InventoryMovementsService.searchPickerItems`,
`InventoryProductsService.enrichProducts`,
`InventoryProductsService.listVariantOptions` — all 3 read, compared,
and left completely unchanged. See `simplification-evidence.md`.

## Review bundle

`docs/inventory/reviews/inventory-a1-a6-simplification-review/` — this
bundle (`review-context.md`, `changed-files.md`, `migration-summary.md`,
`test-evidence.md`, `simplification-evidence.md`, `diff.patch`).

## Not touched this pass

- A7 (`inventory_add_to_container` RepairOrder-boundary extraction) —
  not started.
- A8 (RepairOrder incremental projection removal) — not started.
- IC-8, Phase 10D — not started.
- The DEFER items from `simplification-plan.md`/`dry-review.md`
  (custom-field-value writer consolidation, document-numbering
  centralization, idempotency-ordering re-audit, the enhanced-product
  RPC overlap, valuation snapshot, branch-transfer UI gaps, index
  changes, ledger partitioning) — none touched.
- `apps/public-web`'s own broken raw-write container feature
  (`addItemsToContainerAction`/`removeItemFromContainerAction`/
  `relocateContainerAction`, left intentionally broken by the PRE-IC8 P0
  pass's own disclosed decision) — not migrated to a canonical RPC, not
  fixed, not further touched beyond removing the 3 unrelated dead
  actions that happened to live in the same file.
- Any Inventory Core business semantic — movement, reservation,
  allocation, transfer, reversal, opening-stock, count-session behavior
  all unchanged, re-confirmed by the full 097–113 regression.
