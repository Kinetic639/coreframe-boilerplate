# IC-7 Architecture-Compression Candidates

Per §41: every potentially-unnecessary runtime layer discovered during
this phase's own audit work, for the post-IC-7 architecture-compression/
simplification review. **Nothing in this list was acted on during IC-7
itself** — this phase's own scope was security/write-boundary closure,
not simplification.

## 1. `inventory_add_to_container`'s inline RepairOrder-ownership check

- **Current component**: `inventory_add_to_container(uuid,uuid,uuid,uuid,uuid,numeric)`.
- **Reason it exists**: Phase 10C's own correction — when a container
  declares `reference_type='repair_order'`, only allocations resolving
  to that SAME RepairOrder (via the RepairOrderLine → Reservation →
  ReservationLine → AllocationLine chain) may be placed into it.
- **Callers**: `RepairOrdersService.placeAllocationInContainer`, plus
  the generic warehouse container-add action.
- **Can it be removed?**: No — it enforces a real, tested invariant.
- **Can it be merged?**: The RepairOrder-specific resolution logic
  (the `JOIN repair_order_lines`) could be extracted into a small
  RepairOrder-domain pre-validation wrapper, leaving the generic
  primitive `reference_type`-agnostic (it already stores `reference_
type`/`reference_id` generically — only the VALIDATION of that
  reference is RepairOrder-specific).
- **Does removing it change behavior?**: Not if the extraction
  preserves the exact same validation before the generic INSERT.
- **Recommended action**: **DEFER** — narrow, tested, non-security-
  relevant; a genuine but low-priority core/domain boundary cleanup for
  a dedicated architecture-compression pass, not IC-7's own scope.

## 2. `repair_order_line_locations_ledger_sync` trigger on a core table

- **Current component**: a trigger ON `inventory_stock_ledger_entries`
  (a CORE, generic table) whose own FUNCTION contains substantial
  RepairOrder-domain business logic (bucket derivation, `relation_type`
  inference, reversal-mirroring).
- **Reason it exists**: IC-5's own accepted design — the only place
  that can observe every ledger-producing write (including from the
  generic, RepairOrder-agnostic `inventory_reverse_movement`) without
  coupling the reversal engine itself to RepairOrder semantics.
- **Callers**: fires automatically for every ledger row; no-ops
  immediately for buckets with no attribution history.
- **Can it be removed?**: No — it is the mechanism that makes
  `repair_order_line_locations` a genuinely derived projection rather
  than a second source of truth (architecture doc decision #7).
- **Can it be merged?**: Already the minimal shape — a trigger IS the
  correct mechanism for "react to every ledger write, regardless of
  source, without the ledger's own writer needing to know about it."
- **Does removing it change behavior?**: Yes, fundamentally (this is
  the core of IC-5's own projection-consistency guarantee).
- **Recommended action**: **KEEP** — this is a named example of
  "domain-specific triggers on generic inventory events" per the task's
  own §41 prompt, but it is a DELIBERATE, ALREADY-ACCEPTED design
  choice (IC-5), not an accidental complexity layer. Recorded for
  completeness, not because it should change.

## 3. `receive_repair_order_stock`/`putaway_repair_order_stock`/`rebuild_repair_order_location_projection` — zero application callers

- **Current component**: 3 fully-built, fully-tested, fully-hardened
  canonical RPCs with no TypeScript caller anywhere in the repository
  (see `application-entry-point-matrix.md`).
- **Reason it exists**: built ahead of the UI (IC-3's own receiving
  consolidation, IC-5's own projection consolidation) — DB-layer work
  completed before the corresponding application feature.
- **Callers**: none currently.
- **Can it be removed?**: No — removing a correct, tested, documented
  canonical primitive because the UI hasn't caught up yet would be
  actively harmful (the next RepairOrder-receiving feature build would
  need to reinvent it).
- **Recommended action**: **KEEP, DEFER UI WORK** — not a compression
  candidate at all in the "remove/merge" sense; flagged here only
  because the task's own §41 prompt asks for "read-model helpers
  duplicating DB behavior" and similar unused-layer patterns, and this
  is the closest analogous finding (an unused layer, but for the
  opposite reason — too early, not redundant).

## 4. `InventoryProductsService.createEnhancedProductLegacy`

- **Current component**: a 175-line, confirmed-dead (zero callers)
  legacy product-creation method, already disclosed by IC-6.
- **Reason it exists**: pre-IC consolidation product-creation code path,
  superseded by `createEnhancedProduct`.
- **Callers**: none.
- **Can it be removed?**: Yes, confirmed dead.
- **Recommended action**: **REMOVE**, but in a dedicated PRODUCT-
  CREATION-scoped cleanup pass, not IC-7 (out of this phase's own
  physical-stock-movement charter — restated from IC-6's own disclosure,
  not a new finding this phase).

## 5. `ambra-location-inventory.ts`'s remaining 3 dead functions

- **Current component**: `deletePutawayRuleAction`, `findContainersByReferenceAction`,
  `createLocationPutawayRuleAction` — confirmed dead (zero callers),
  already disclosed by IC-6, deliberately retained at the time since
  they touch `inventory_putaway_rules` (unrelated to Inventory Core's
  own balance/ledger write surface).
- **Recommended action**: **REMOVE** in a future general dead-code
  cleanup pass — not Inventory-Core-security-relevant, restated from
  IC-6's own disclosure.

## 6. Product/procurement/audit-domain functions still carrying default `anon` EXECUTE

**RESOLVED — 2026-09-19, IC-7 closing pass.** All 7 functions
originally listed here (`inventory_create_enhanced_product`,
`inventory_create_product_with_default_variant`, `inventory_create_
purchase_order`, `inventory_create_valuation_snapshot`, `inventory_
create_count_session`, `inventory_count_session_list`, `inventory_
find_sku_collisions`), plus 1 newly-found item during the closing
pass's own classification sweep (`inventory_convert_quantity`, zero
permission check of any kind — a genuine tenant-configuration-data
exposure, not merely a grant formality), were hardened: `REVOKE ALL
FROM PUBLIC, anon` on all 8, plus a real actor-identity check
(`28000`) added to the 4 that already accepted `p_actor_user_id`
(during which a genuine, previously-undisclosed actor-spoofing
vulnerability was found and closed — see `security-evidence.md`'s own
"IC-7 CLOSING PASS" section, items 11-15). No longer a compression
candidate — this item is now fully closed, not merely deferred.

## 7. `inventory_convert_quantity` — dead code (found during the IC-7 closing pass)

- **Current component**: `inventory_convert_quantity(uuid,uuid,uuid,uuid,numeric)`.
- **Reason it exists**: appears to be a unit-conversion helper intended
  for general use, but a live repo-wide grep found ZERO TypeScript
  callers and ZERO other SQL function callers (`prosrc` search across
  all of `pg_proc`) — genuinely unreferenced from anywhere.
- **Recommended action**: **DEFER** — its security exposure (zero
  permission check, tenant-scoped conversion-factor read) was already
  closed this pass via grant revocation (`security-evidence.md` item
  13). Full removal is a dead-code cleanup decision, not a security
  one, and belongs to the architecture-compression pass, not this
  narrow security-closing pass.

## Not compression candidates (confirmed correct, no action needed)

- The "many domain wrappers, one canonical RPC" pattern for reservation/
  allocation (RepairOrder-specific vs. generic warehouse) — this is
  CORRECT architecture, not duplication (see `application-entry-point-
matrix.md`).
- `InventoryMovementsService`/`InventoryEnterpriseService`/`InventoryProductsService`/
  `InventoryCountSessionsService`/`RepairOrdersService` as 5 separate
  services — each owns a distinct, coherent operation set; no evidence
  of a "god-service" or fragmentation problem worth consolidating.
