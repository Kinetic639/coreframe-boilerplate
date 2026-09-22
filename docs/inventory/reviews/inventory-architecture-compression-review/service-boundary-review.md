# Service-Layer Audit

**Correction to the task's own service list**: no `RepairOrderStorageService`
exists anywhere in the codebase (confirmed twice by grep). All
RepairOrder container/storage logic lives as methods directly on
`RepairOrdersService`. Audited in place there.

The prior IC-7 review concluded "the current service split is coherent,
no duplicate competing entry points." That conclusion was checking a
different, narrower question (duplicate _write paths across_ services)
than this audit checks (is each service _internally_ cohesive) — it
does not survive inspection of `InventoryEnterpriseService`'s own
internal structure.

## Summary table

| Service                       | Cohesive?                                                               | Duplicated business rules                                          | Dead methods                                                                             | Classification                                                  |
| ----------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| InventoryMovementsService     | Yes                                                                     | None                                                               | None                                                                                     | **KEEP**                                                        |
| InventoryEnterpriseService    | **No — 10 unrelated sub-domains**                                       | Custom-field-value writing (2 independent implementations)         | None                                                                                     | **SPLIT**                                                       |
| InventoryProductsService      | Yes (one real domain: catalog)                                          | On-hand/available rollup (3 independent implementations, low risk) | `listSuppliers`, `createEnhancedProductLegacy`                                           | **KEEP, REMOVE 2 methods**                                      |
| InventoryCountSessionsService | Yes                                                                     | None                                                               | None                                                                                     | **KEEP**                                                        |
| WarehouseLocationsService     | Yes (explicitly documents "no stock/movement coupling" and holds to it) | None                                                               | None                                                                                     | **KEEP**                                                        |
| RepairOrdersService           | Yes (large because the domain is large, not a god-service)              | Ownership-verification check, copy-pasted 3×                       | `attachMovementToRepairOrderLine`, `getPhysicalStateForLine` (both 0 production callers) | **KEEP, MOVE 1 method (extract helper), flag 2 unused methods** |

## InventoryMovementsService (812 lines) — KEEP unchanged

Every method is either a direct wrapper around the canonical
movement-engine RPCs or a read model for the movement list/detail/
type-catalog/picker UI. No business rule appears twice. Caller counts
confirm no dead code (`createDraft`=10, `finalizePosting`=6,
`listMovementTypes`=4, `getMovementDetail`=3, all others 1-2).

## InventoryEnterpriseService (997 lines) — SPLIT

The strongest finding of this audit. Reading it top to bottom, it
contains 10 unrelated sub-domains with zero shared internal state or
theme beyond "touches an `inventory_*` table": product-catalog option
groups/values + `generateVariants`, variant pricing/details CRUD,
lots/serials, reservation/allocation thin RPC wrappers, suppliers +
purchase orders, unit conversions (a _second_, independent conversion
table/logic pair from `InventoryProductsService`'s own product-level
conversions), custom fields, collections, saved views, import/export
jobs, valuation snapshots, branch transfers. The name itself is a tell
— a real bounded context would be named "reservations," "catalog
attributes," "procurement," not "Enterprise."

**Concrete duplicated business rule found**: custom-field-_value_
writing exists independently in two places — `InventoryEnterpriseService.
setCustomFieldValue` (read-existing-then-upsert-by-hand, no "is this
value actually populated" guard) and `InventoryProductsService.
writeCustomFieldValues` (private, unconditional bulk insert during
product creation, with its own separate empty-value filter). Neither
calls the other; both independently encode "what counts as a populated
custom-field value," and the guards differ. A genuine, citable,
inconsistent duplication on the same table.

**Deliberately-NOT-duplicated, verified**: `RepairOrdersService.
reserveForLine`/`releaseReservationForLine`/`allocateForLine` call the
reservation/allocation RPCs directly rather than through
`InventoryEnterpriseService`'s own thin wrappers. This looks like
duplication but is disclosed and accurate in the source: the Enterprise
wrappers discard the Postgres `error.code`, which RepairOrdersService's
own hardened error-normalization allowlist needs. Verified live — not a
stale comment, not an accidental duplicate implementation of the
reservation algorithm (which lives in exactly one place, the RPC).

Every method in this file has 1+ real caller — no dead code found here,
only misplacement.

**Recommendation (priority order)**:

1. MOVE `updateVariantPricing`/`updateVariantDetails`/`createOptionGroup`/
   `createOptionValue`/`generateVariants`/`createLot`/`createSerial`
   into `InventoryProductsService`, which already owns product/variant
   CRUD.
2. Consolidate the two custom-field-value writers into one, in
   whichever service ends up owning custom fields.
3. Lower priority, no duplication risk found: the reservation/
   allocation wrappers and branch-transfer methods could become their
   own `InventoryCommitmentsService`, or merge into
   `InventoryMovementsService` (both are "physical-adjacent"). Not
   urgent. Suppliers/POs/collections/saved-views/import-export/
   valuation-snapshots have no duplication risk found — defer to a
   later, lower-priority pass.

## InventoryProductsService (2913 lines) — KEEP, remove 2 dead methods

Large but genuinely one domain (product/variant/unit/tag/brand/option/
image/SKU catalog master data), unlike Enterprise.

- **`listSuppliers` (lines 1400-1414) — zero callers anywhere**, not
  even internally. A new, previously-undisclosed finding (prior
  dead-code sweeps were scoped to the movement/writer surface, never
  touched product-catalog read methods). **REMOVE.**
- `createEnhancedProductLegacy` (175 lines) — confirmed 0 callers,
  matches IC-6's own prior disclosure, still present. **REMOVE**
  (same candidate as `dry-review.md`'s dead-code table).
- **Duplicated business rule, low priority**: on-hand/available rollup
  logic (reduce `inventory_balances` rows into a per-variant total) is
  independently hand-rolled 3 times — `InventoryMovementsService.
searchPickerItems`, `InventoryProductsService.enrichProducts`,
  `InventoryProductsService.listVariantOptions`. All three do the
  identical `+=` reduction. Low risk of divergence (simple summation),
  but a real, citable duplication a shared `rollupBalancesByVariant()`
  helper would eliminate. Not urgent.

## InventoryCountSessionsService (784 lines) / WarehouseLocationsService (847 lines) — KEEP unchanged

Both audited in full. Both cohesive, no duplicated business rules, no
dead methods (every method has 1+ real caller), no cross-domain
knowledge. The two best-designed services in the set.

## RepairOrdersService (3502 lines) — KEEP as one unit, apply 2 mechanical de-duplications

The biggest file, correctly so — genuinely one domain (materialization,
header CRUD, line read-model, provenance, RepairOrder-scoped wrappers
around the generic reservation/allocation/container RPCs with real
ownership-security logic layered on top). Not a god-service: every
method is RepairOrder-specific, none belongs in a generic Inventory
Core service. Splitting it would separate genuinely coupled
ownership-verification logic.

**Finding 1 — duplicated ownership-check, copy-pasted verbatim 3
times**, despite a shared scope-resolution helper already existing for
the other half of the check:

```
const belongsToThisLine =
  reservation &&
  reservation.organization_id === scope.organizationId &&
  reservation.branch_id === scope.branchId &&
  reservation.reference_type === "repair_order_line" &&
  reservation.reference_id === input.repairOrderLineId;
```

Present byte-identically (adapted per context) in `releaseReservation
ForLine`, `allocateForLine`, and `placeAllocationInContainer`. **MOVE
METHOD recommendation**: extract a private `verifyOwnership(row, scope,
referenceType, referenceId)` used by all three — pure mechanical
de-duplication, zero behavior change.

**Finding 2 — duplicated infrastructure pattern, not a business rule**:
5 near-identical "known-safe-RPC-error allowlist" normalizer functions
(`normalizeMaterializationRpcError`, `normalizeMovementLinkRpcError`,
`normalizeReservationRpcError`, `normalizeAllocationRpcError`,
`normalizeContainerRpcError`), each the same 4-line "match against my
own allowlist array, else generic message" shape, differing only in
which allowlist table they close over (~150 lines of repeated
scaffolding). Could become one ~10-line generic `normalizeKnownRpcError
(error, knownErrors)` plus 5 data tables. Real, low-risk simplification
— NOT a correctness issue (each allowlist's content is independently
correct).

**Finding 3, corrects the prior IC-7 review**: `attachMovementToRepair
OrderLine` and `getPhysicalStateForLine` both have **zero production
callers** — every reference outside the service file itself is inside
the test file. The RepairOrder action layer
(`app/actions/workshop/repair-orders.ts`) exposes 13 other methods but
NOT these two. This directly contradicts `application-entry-point-
matrix.md`'s own table, which implies a real UI path exists for
`attachMovementToRepairOrderLine`. It does not, as of this audit — both
should move to the same "DB-ready canonical RPC/method with zero
current application entry point" disclosure list as `receive_repair_
order_stock`/`putaway_repair_order_stock`/`rebuild_repair_order_
location_projection`. This is directly relevant to the projection-
trigger challenge in `module-boundary-review.md`: the one TypeScript
reader of the projection table these feed is itself unreachable from
production today.

**Verdict**: KEEP the service as one unit; apply Finding 1's mechanical
extraction; optionally apply Finding 2's infra simplification; flag
Finding 3's two methods for the same "wire up or explicitly defer"
product decision already made for their SQL counterparts.
