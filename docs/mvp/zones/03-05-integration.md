# Zone 3 ↔ Zone 5 Integration — Physical-State Read Model

**Status:** ✅ First additive integration layer DONE (2026-09-15), on branch `zone3-zone5-integration-audit`.
**Source of truth for the audit that preceded this work:** the Zone 3 ↔ Zone 5 integration audit (conversation record; no separate audit doc was requested — its findings are restated and superseded where relevant below).
**Phase 10C status:** remains ✅ DONE and FINAL. Not modified, not reopened by this work.

---

## 1. Accepted product decision: the normal RepairOrder stock lifecycle

Zone 5 (Receiving/Putaway) and Zone 3's own Reservation → Allocation → Containerization chain are **sequential stages of one normal RepairOrder stock lifecycle**, not competing or alternative stock models:

```
101 RECEIVE            (Zone 5 -- receive_repair_order_stock)
  ↓
801 PUTAWAY             (Zone 5 -- putaway_repair_order_stock)
  ↓
RESERVATION             (Zone 3 Phase 10A -- inventory_create_reservation)
  ↓
ALLOCATION               (Zone 3 Phase 10B -- inventory_create_allocation)
  ↓
CONTAINER                (Zone 3 Phase 10C -- inventory_create_container / inventory_add_to_container)
  ↓
QR                       (Zone 3 Phase 10D -- NOT STARTED)
  ↓
801 CONTAINER RELOCATION (Zone 3 Phase 10E -- NOT STARTED)
  ↓
201/WZ ISSUE             (Zone 3 Phase 10F -- NOT STARTED)
```

**Explicitly recorded, per instruction:**

- **Putaway-after-reservation is NOT the normal product workflow.** The normal sequence reserves/allocates stock that has already been put away at its final storage location. The characterization test (`101_...`, see §3 below) deliberately exercises the ABNORMAL order (reserve+allocate BEFORE putaway) specifically to probe whether the shared engine itself would prevent it. It does not — see §3.
- **The generic movement-engine reserved/allocated blind spot remains an open base-engine hardening task.** It is NOT fixed by this integration layer, and fixing it is explicitly out of this branch's own scope (it would touch `inventory_finalize_posting`, used by every movement type across every zone, not just Zone 3/Zone 5).
- **This integration does not claim to fix that base-engine concern.** §2's own read model surfaces the _symptom_ (a `location_mismatch`/`uncontainerized` bucket) when it occurs; it does not prevent the cause.
- **Phase 10C remains frozen.** No Phase 10C RPC, RLS policy, or accepted invariant was touched by this work.

## 2. The shared read model

**`RepairOrdersService.getPhysicalStateForLine(supabase, repairOrderLineId)`** — `apps/web/src/server/services/repair-orders.service.ts`.

Answers: _"what is the current physical stock state for this RepairOrderLine?"_, reconciling Zone 5's own spatial projection (`repair_order_line_locations`) with Zone 3's own reservation/allocation/container chain, as a **pure read** — it mutates neither side.

### Shape

Inspected this project's own established Zone 3 read-model conventions first (`RepairOrderLineReservation`/`RepairOrderLineAllocationLine`, `getByIdForWorkshop`'s own singular-read `T | null` convention) before designing this one. The illustrative shape given in the assigning task was kept largely as-is — it already matched this codebase's own style — with two adjustments: `physicalQuantity` (not `locations[].physicalQuantity` under a different name) matches Zone 5's own column name (`repair_order_line_locations.quantity`) conceptually, and the method returns `ServiceResult<RepairOrderLinePhysicalState | null>`, matching `getByIdForWorkshop`'s own no-existence-leak convention, rather than always returning a (possibly-empty) object.

```ts
export interface RepairOrderLinePhysicalStateContainer {
  containerId: string;
  containerCode: string;
  quantity: number; // this container's own share of THIS location bucket
  currentLocationId: string | null;
  status: string;
}

export interface RepairOrderLinePhysicalStateLocation {
  locationId: string;
  physicalQuantity: number; // Zone 5's own repair_order_line_locations.quantity
  reservedQuantity: number; // outstanding reservation-line quantity here
  allocatedQuantity: number; // outstanding allocation-line quantity here
  containerizedQuantity: number; // sum of active container-link quantity here
  uncontainerizedAllocatedQuantity: number; // allocatedQuantity - containerizedQuantity, floored at 0
  containers: RepairOrderLinePhysicalStateContainer[];
}

export type RepairOrderLinePhysicalStateConsistency =
  | "consistent"
  | "uncontainerized"
  | "location_mismatch"
  | "unknown";

export interface RepairOrderLinePhysicalState {
  repairOrderLineId: string;
  locations: RepairOrderLinePhysicalStateLocation[];
  consistency: RepairOrderLinePhysicalStateConsistency;
}
```

### Reconciliation algorithm (never guesses)

1. Resolve org/branch/variant scope from the RepairOrderLine's own authoritative row (`resolveRepairOrderLineScope`) — never trusted from a caller, matching every other Zone 3 read method.
2. Query Zone 5's own `repair_order_line_locations` (quantity > 0 only), explicitly re-scoped by org/branch/variant.
3. **Reuse**, not re-derive: `listReservationsForLine`/`listAllocationsForLine` (both already enforce the 2026-09-14 domain-integrity variant-identity correction) supply this line's own outstanding reservation/allocation quantities.
4. For every outstanding allocation line, look up active (`deleted_at IS NULL`) `inventory_allocation_container_links` → `inventory_container_lines` → `inventory_containers`, via three plain sequential queries (matching this file's own established style, not a fragile multi-level embed).
5. Build the UNION of every location either side mentions into one bucket per location — a location claimed by only one side still appears, with the other side's own quantities honestly at 0.
6. **Consistency, in precedence order:**
   - **`unknown`** — either (a) Zone 5's own `repair_order_location_attribution_uncertain` marker exists for a touched (location, variant) bucket (Zone 5's own documented "treat as UNKNOWN regardless of what the projection currently holds" contract, honored verbatim), or (b) an active container link's own container disagrees with its own allocation line's `location_id` (an internal Phase 10C invariant that should never be violated given the correction pass — if it ever is, this method refuses to guess which side is right).
   - **`location_mismatch`** — the set of locations Zone 5 claims (`physicalQuantity > 0`) and the set of locations this line's own outstanding allocations claim (`allocatedQuantity > 0`) are both non-empty and differ.
   - **`uncontainerized`** — allocated stock exists that has not (yet) been placed into any container — a normal, expected mid-lifecycle read-model state (this bucket, not a user-facing workflow choice). **Clarified 2026-09-24**: per the accepted container operating model (`03-repair-orders-container-workflow-audit.md` §31.B), this diagnostic bucket describes a transitional technical state a RepairOrder allocation may pass through — it is not, and must not be presented as, an intended normal END state; the normal user workflow always continues on to container placement.
   - **`consistent`** — everything available agrees, or there is simply nothing yet to disagree about.

### No hard schema coupling

No FK, trigger, or other schema-level dependency was added between `repair_order_line_locations` and `inventory_containers`/`inventory_allocation_container_links`. They remain two independent projections; the reconciliation lives entirely in this one application-layer read method.

## 3. Movement-engine reserved/allocated blind-spot — characterization result

**Confirmed, live, using the real Zone 5 RPCs end-to-end** (`apps/web/supabase/tests/101_zone3_zone5_movement_engine_reserved_blindspot_characterization_test.sql`, 11/11 passing):

1. `receive_repair_order_stock` receives 10 units into the branch's designated receiving location.
2. 6 of those 10 are reserved, then allocated (an intentionally ABNORMAL ordering relative to §1's own accepted lifecycle, used only to probe the engine).
3. `putaway_repair_order_stock` is invoked to relocate the FULL 10 units away from the receiving location.
4. **Result: the putaway SUCCEEDS.** Nothing in `inventory_finalize_posting` (LIVE VERIFIED: its own body contains no reference to `reserved_quantity`/`allocated_quantity`) checks whether the quantity being moved is already committed elsewhere.
5. **Consequence, live-proven:** after the putaway, the source (receiving) location's own balance row reads `on_hand_quantity = 0` while `allocated_quantity` is still `6` — an inconsistent balance row (`allocated > on_hand`) the engine created and does not itself flag. The destination location correctly shows `on_hand_quantity = 10`, but `allocated_quantity = 0` — the allocation's own claim did not travel with the physically-relocated stock.

This is a **pre-existing gap in the shared, base movement engine**, not a Zone 3 or Zone 5 defect individually — it predates both. Zone 5's `putaway_repair_order_stock` is simply the first real, RepairOrder-aware caller that makes it reachable against RepairOrder-owned, already-allocated stock. **Not fixed here, by explicit instruction.** §2's own read model would surface this exact scenario as `consistency: "location_mismatch"` once wired to real data (Zone 5 claims the destination, the allocation still claims the source) — a read-time symptom detector, not a write-time preventer.

## 4. Files changed

| File                                                                                                   | What                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/server/services/repair-orders.service.ts`                                                | New types (`RepairOrderLinePhysicalState` + 3 supporting types) and the new `getPhysicalStateForLine` method.                             |
| `apps/web/src/server/services/__tests__/repair-orders.service.test.ts`                                 | New `buildPhysicalStateSupabaseMock` helper + 11 new tests (the 9 required scenarios + a not-found case + an uncertain-marker case).      |
| `apps/web/supabase/tests/101_zone3_zone5_movement_engine_reserved_blindspot_characterization_test.sql` | New, 11 live pgTAP assertions characterizing the blind spot end-to-end via the real Zone 5 RPCs.                                          |
| `docs/mvp/zones/03-05-integration.md`                                                                  | This document.                                                                                                                            |
| `docs/mvp/zones/03-repair-orders-progress.md`                                                          | A new change-log entry recording this integration layer (Zone 3's own progress tracker; Zone 5 has no equivalent tracker file to update). |

**Not touched, per explicit instruction:** Phase 10C RPCs, Phase 10C RLS, Zone 5's own `receive_repair_order_stock`/`putaway_repair_order_stock` bodies, `inventory_finalize_posting`, `ambra-location-inventory.ts`, any Phase 10D/10E/10F code.

## 5. Residual risks

- The blind spot in §3 remains open and reachable in production today by ANY caller of `putaway_repair_order_stock` (or any other movement) against already-allocated stock — not just the abnormal ordering this characterization test used to prove it exists. Closing it requires a base-engine change explicitly out of this branch's own scope.
- The read model's `location_mismatch`/`unknown` states are informational only — nothing currently _acts_ on them (no UI, no alert, no block). They are a foundation for a future read surface, not yet a safeguard.
- Neither `getPhysicalStateForLine` nor any other code path is wired to any UI yet — this remains, like both Phase 10C's own container methods and Zone 5's own receive/putaway RPCs, reachable only from server-side code/tests today.
