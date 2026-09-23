# Simplification Plan

Recommendation threshold applied throughout: a simplification is
recommended only if it (A) reduces runtime/conceptual complexity,
(B) preserves accepted behavior, (C) preserves or improves security,
(D) preserves atomicity, (E) preserves concurrency correctness,
(F) introduces no new source of truth, (G) has meaningful
maintainability value, (H) has proportionate migration/refactor risk.
Otherwise: KEEP or DEFER.

## Required pre-IC-8 correctness item (not a simplification — flagged separately, already surfaced to the user during this audit)

**`inventory_guard_balance_write`/`inventory_guard_settings_write`
treat a caller-settable session GUC as sufficient authorization**, with
no substance or actor check — a live, currently exploitable gap
directly contradicting the frozen fact "raw writes are closed" (see
`rpc-helper-trigger-review.md`'s CRITICAL finding for full
reproduction). This is not addressed by this audit (audit-only scope)
and is not a complexity-reduction item — it is a required correctness
gate before IC-8, using the same substance-validation pattern IC-7
already proved works for the posted-header trigger. Recorded here so
it cannot be missed when this review is read on its own.

## A. SAFE simplifications before IC-8

Ordered smallest/lowest-risk first.

### A1. Remove 6 confirmed-dead code items

- **Files/functions**: `InventoryProductsService.createEnhancedProductLegacy`
  (`inventory-products.service.ts:635-809`, ~175 lines, + mirror in
  `apps/public-web`), `InventoryProductsService.listSuppliers`
  (`:1400-1414`, ~15 lines), `deletePutawayRuleAction`/`findContainers
ByReferenceAction`/`createLocationPutawayRuleAction`
  (`app/actions/warehouse/ambra-location-inventory.ts:54/90/170`, +
  mirrors), `inventory_convert_quantity` (SQL function, 1 migration
  dropping it).
- **Size**: ~250 lines TS deletion + 1 small DROP FUNCTION migration.
- **Migration required**: yes, one (`DROP FUNCTION inventory_convert_
quantity(...)`).
- **Test impact**: none expected (zero callers means zero test
  coverage depends on these); grep to confirm before deleting.
- **Rollback risk**: negligible — pure deletion of unreferenced code.
- **Order**: first — zero dependencies on anything else in this plan.

### A2. Extract `RepairOrdersService`'s duplicated ownership-check into one private helper

- **Files/functions**: `repair-orders.service.ts` — `releaseReservation
ForLine`, `allocateForLine`, `placeAllocationInContainer`. Add one
  private `verifyOwnership(row, scope, referenceType, referenceId)`.
- **Size**: ~15 lines added, ~12 lines removed net across 3 call sites.
- **Migration required**: no.
- **Test impact**: existing tests should pass unchanged (behavior-
  identical mechanical extraction) — re-run `repair-orders.service.
test.ts` to confirm.
- **Rollback risk**: negligible.
- **Order**: after A1, independent of everything else.

### A3. Extract `RepairOrdersService`'s 5 duplicated error-normalizer functions into one generic + data tables

- **Files/functions**: `repair-orders.service.ts` — the 5
  `normalize*RpcError` functions (~150 lines total) → 1
  `normalizeKnownRpcError(error, knownErrors)` (~10 lines) + 5 data
  tables (the existing allowlist arrays, unchanged content).
- **Size**: net reduction of ~120-130 lines.
- **Migration required**: no.
- **Test impact**: existing tests should pass unchanged (same
  allowlist content, same generic matching logic) — re-run the same
  test file.
- **Rollback risk**: low — mechanical, but touches 5 call sites; test
  before merging.
- **Order**: after A2 (both touch the same file; sequence to avoid
  merge conflicts, not a technical dependency).

### A4. Revoke `authenticated` EXECUTE from `inventory_get_or_create_balance_for_update`

- **Files/functions**: one migration, `REVOKE EXECUTE ... FROM
authenticated`.
- **Size**: 1-line grant migration.
- **Migration required**: yes, one.
- **Test impact**: none expected — every real caller is another
  `SECURITY DEFINER` RPC using same-owner nesting, already unaffected
  by ordinary-role grants. Add a regression assertion (matching the
  IC-7 closing-pass pattern) that `authenticated` cannot call it
  directly, post-revoke.
- **Rollback risk**: negligible — this exact decision was already
  disclosed and deferred by IC-7 itself, only the execution step
  remained.
- **Order**: independent, any time.

### A5. Consolidate the 3 independent on-hand/available rollup implementations

- **Files/functions**: `InventoryMovementsService.searchPickerItems`,
  `InventoryProductsService.enrichProducts`, `InventoryProductsService.
listVariantOptions` → one shared `rollupBalancesByVariant(balances)`
  helper.
- **Size**: small, ~20-30 lines added (helper), ~15-20 lines removed
  net across 3 call sites.
- **Migration required**: no.
- **Test impact**: existing tests should pass unchanged if the helper
  reproduces the identical `+=` reduction — verify each call site's
  own rounding/field-selection details match before consolidating (the
  three currently differ slightly in which fields they roll up).
- **Rollback risk**: low.
- **Order**: independent.

### A6. MOVE `InventoryEnterpriseService`'s catalog-domain methods into `InventoryProductsService`

- **Files/functions**: `updateVariantPricing`, `updateVariantDetails`,
  `createOptionGroup`, `createOptionValue`, `generateVariants`,
  `createLot`, `createSerial` — move from `inventory-enterprise.
service.ts` to `inventory-products.service.ts`; update the ~7 action-
  layer call sites' import paths.
- **Size**: medium — ~400-500 lines relocated (not rewritten), 7 import
  updates.
- **Migration required**: no (pure TS move, no RPC/signature change).
- **Test impact**: existing unit tests for these methods move with
  them; update test file imports; re-run both services' test suites.
- **Rollback risk**: low-medium — larger diff surface than A1-A5, but
  no behavior change, no DB change. The main risk is a missed import
  update, caught immediately by `pnpm type-check`.
- **Order**: after A1-A5 (independent of them, sequenced last among
  the small items to keep each PR reviewable).

### A7 (larger, still SAFE, most testing required). `inventory_add_to_container` RepairOrder-boundary extraction

- **Files/functions**: new migration adding `repair_order_add_
allocation_to_container(...)` wrapper RPC; `inventory_add_to_
container` migration removing the inline RepairOrder JOIN branch;
  `RepairOrdersService.placeAllocationInContainer` updated to call the
  new wrapper.
- **Size**: 2 migrations (~40-60 lines SQL each) + ~10 lines TS change.
- **Migration required**: yes, two (add wrapper, narrow the generic
  primitive) — apply and live-verify in the order "add wrapper" then
  "narrow generic primitive" so nothing is ever unreachable mid-
  deploy.
- **Test impact**: re-run the full container test suite (`100_...`)
  plus RepairOrder container placement tests; add a new pgTAP scenario
  for the wrapper's own cross-RepairOrder rejection (currently tested
  inside the generic primitive, needs to move with the logic).
- **Rollback risk**: medium — the TOCTOU analysis in `module-boundary-
review.md` proves this is safe given the write-once column
  invariant, but it is still a live-behavior SQL change touching a
  security-adjacent check; deploy behind the same live-verify-every-
  grant discipline established since IC-7.
- **Order**: independent of A1-A6; do this and A8 as their own,
  separately reviewed changes, not bundled with the small mechanical
  items above.

### A8 (largest, still SAFE per the threshold, most testing required). Remove the RepairOrder incremental projection (Option D)

- **Files/functions**: DROP the `repair_order_line_locations_ledger_
sync` trigger + its function; remove the direct-write portions of
  `receive_repair_order_stock`/`putaway_repair_order_stock` (keep their
  `write_repair_order_line_movement_link_internal` calls — that stays
  the source of truth); add a new read-only live-computation query
  (reusing `rebuild_repair_order_projection_bucket_internal`'s own
  join shape) for `RepairOrdersService.getPhysicalStateForLine` to call
  instead of selecting from the now-removed persisted table; DROP
  `repair_order_line_locations`/`repair_order_location_attribution_
uncertain` (or keep the tables but stop writing them, if a staged
  rollback path is wanted — recommend keeping them unwritten for one
  release cycle before dropping, as an extra safety margin, since nothing
  currently reads them anyway).
- **Size**: largest item in this plan — removes ~185 lines of trigger
  PL/pgSQL, removes the direct-write blocks in 2 orchestrator RPCs
  (~30-40 lines combined), adds ~30-50 lines of new live-read query
  logic, and requires **rewriting** (not just deleting) a meaningful
  fraction of the 664-line `107_ic5_repair_order_projection_test.sql`
  suite to test the new live-read model instead of the old incremental
  one.
- **Migration required**: yes, several (drop trigger, drop trigger
  function, modify the 2 orchestrator RPCs, optionally drop the 2
  projection tables).
- **Test impact**: the largest in this plan — most of `107_...`'s own
  scenarios test incremental-write behavior that no longer exists;
  expect a substantial rewrite, not a small patch. Full regression
  (097-111 equivalent) required after.
- **Rollback risk**: medium-high in effort terms (large diff, large
  test rewrite) but **low in correctness-risk terms** — the evidence
  in `module-boundary-review.md` shows the removal eliminates a latent
  bug (the P0008 gap) rather than introducing risk, and nothing in
  production currently reads the data being removed, so there is no
  live consumer to regress.
- **Order**: do this LAST, as its own dedicated, separately-reviewed
  phase — not bundled with anything else in this plan. Given its size,
  it may warrant its own mini-review-and-report cycle rather than being
  folded silently into a general "simplification pass."

**If the SAFE list feels too large to execute in one pass**: A1-A6 are
genuinely small, mechanical, same-day-reviewable changes with near-zero
risk. A7 and A8 are real, evidence-backed simplifications but are each
their own project-sized piece of work, not "tiny." Do not treat A7/A8
as obligatory parts of a single "simplification sprint" — they are
independently justified and can be scheduled separately, including
after IC-8 if preferred, since neither blocks IC-8's own reproducibility
gate.

## B. KEEP — complexity that is justified

- **The `SECURITY DEFINER`/`_internal` split pattern** (`inventory_
finalize_posting_internal`, `write_repair_order_line_movement_link_
internal`, `inventory_seed_movement_types_internal`) — each is a real
  privilege boundary that closed a proven exploit or centralizes a
  genuinely shared, previously-drifting invariant. Removing any of them
  re-opens the specific problem they were built to close.
- **Movement header/line immutability triggers** — the sole defense
  against rewriting posted content (RLS alone permits the UPDATE at the
  permission level); cannot be replaced by RLS since the substance
  check needs a cross-row `EXISTS` a `WITH CHECK` clause can't express.
- **Ledger/audit append-only triggers** — textbook-correct, minimal,
  nothing to simplify.
- **`inventory_get_or_create_balance_for_update`** as a shared helper
  (6 genuine independent callers) — only its lingering `authenticated`
  grant is a simplification target (A4), not the helper itself.
- **Quantity-cap checks NOT centralized** — each guards a conceptually
  distinct lifecycle transition (reserve/allocate/post); a shared
  function would need enough parameters to not meaningfully reduce
  risk.
- **Actor-identity check NOT centralized** — a security check must stay
  inline and per-function-auditable; a shared helper would be a worse
  security-review property, not a better one.
- **Multiple domain wrappers over one canonical RPC** (generic +
  RepairOrder-line reservation/allocation callers sharing one RPC) —
  the correct, already-accepted architecture, not duplication.
- **`RepairOrdersService` as one large file** — genuinely one domain;
  splitting it would separate coupled ownership-verification logic.
- **`ambra.repair_order_attribution_authoritative` GUC** — a clean,
  already-correct orchestration signal, not an authorization mechanism.
- **Zero-caller canonical primitives** (`inventory_reverse_movement`,
  `receive_repair_order_stock`, `putaway_repair_order_stock`,
  `rebuild_repair_order_location_projection`) — deliberately built
  ahead, tested, documented as accepted invariants; "no UI yet" is not
  "dead."

## C. DEFER / do not touch yet

- **Custom-field-value writer consolidation** (`InventoryEnterprise
Service.setCustomFieldValue` vs. `InventoryProductsService.
writeCustomFieldValues`) — genuine duplication, but the two
  implementations currently have DIFFERENT guard behavior (one allows
  an all-null upsert, one filters empty values) — merging them silently
  picks a winner and changes behavior for whichever caller relied on
  the other's guard. Needs a product/domain decision on which behavior
  is correct before any code change, not a mechanical merge.
- **Document-numbering centralization** — a real DRY violation (10
  sites), but a shared helper touches every document type's numbering
  path simultaneously; higher blast radius than any SAFE item above.
  Design it carefully, ideally informed by IC-8's own lock-contention
  measurement (`performance-handoff.md` risk 7) in case the fix should
  also address sharding, not just DRY.
- **Idempotency-ordering re-audit of the other ~10 sites** — the
  investigation itself (re-check each site for the exact "mutate
  before check" bug class already fixed once) is cheap and should
  happen soon, but any FIXES found are unpredictable in size until the
  audit is done — do not schedule fixes until the audit's own findings
  are known.
- **`inventory_create_enhanced_product` vs. `inventory_create_product_
with_default_variant` overlap** — flagged, not resolved; needs a
  product-domain decision on whether the simple path should become a
  thin parameter-subset call of the enhanced one, not an architecture-
  audit-level call.
- **Valuation snapshot** — explicitly DEFER per its own disposition in
  `dry-review.md`; needs a combined SQL-fix + UI-build decision, not
  urgent given zero current usage.
- **Branch-transfer UI gaps** (`send`/`cancel` have no UI) — a product
  completeness gap, not an architecture-simplification item; flagged
  for product awareness, out of this audit's own remit to resolve.
- **The two near-duplicate `apps/web`/`apps/public-web` app trees** —
  observed as a secondary finding during dead-code verification, out of
  this audit's scope; worth its own separate architecture question.
- **Index redundancy pairs and the reservation-table index gap**
  (`performance-handoff.md` risk 8) — defer to IC-8's own measurement
  before touching any index.

## Expected total footprint if A1-A6 are executed as one small pass

Roughly 250 lines deleted (dead code) + ~150 lines net reduction
(de-duplication) + ~400-500 lines relocated (not rewritten) + 2 small
migrations (1 DROP FUNCTION, 1 REVOKE). No behavior change expected in
any of A1-A6; `pnpm type-check`/`pnpm lint`/`pnpm build`/relevant Vitest
should be the only verification needed beyond a diff review. A7 and A8
are each their own, larger, separately-scheduled pieces of work with
their own migration/test footprints as detailed above.
