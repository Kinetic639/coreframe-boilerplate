# Inventory Core — A7 Domain-Boundary Cleanup — Boundary Evidence

## The confirmed backward dependency (re-verified live, unchanged since the audit)

`inventory_add_to_container`'s pre-migration live body contained:

```sql
IF v_container.reference_type = 'repair_order' THEN
  SELECT rol.repair_order_id INTO v_resolved_repair_order_id
  FROM inventory_reservation_lines rl
  JOIN inventory_reservations r ON r.id = rl.reservation_id
  JOIN repair_order_lines rol ON rol.id = r.reference_id
  WHERE rl.id = v_alloc.reservation_line_id
    AND r.reference_type = 'repair_order_line';

  IF v_resolved_repair_order_id IS NULL
     OR v_resolved_repair_order_id::text IS DISTINCT FROM v_container.reference_id THEN
    RAISE EXCEPTION 'Allocation does not belong to this container''s own RepairOrder' USING ERRCODE = 'P0002';
  END IF;
END IF;
```

A generic, domain-agnostic Handling-Unit primitive (called by any
generic Warehouse "add to container" action) reaching directly into
`repair_order_lines` — real RepairOrder-module knowledge embedded in
core Inventory code.

## Re-confirmed: still the only one, live

`SELECT proname FROM pg_proc WHERE proname LIKE 'inventory\_%' AND
(prosrc ILIKE '%repair_order_lines%' OR prosrc ILIKE
'%repair_orders%')` → exactly 1 row: `inventory_add_to_container`.

A broader scan (dropping the `inventory\_%` prefix restriction, only
excluding functions already named `repair_order_*`) returned 7
additional rows — `attach_repair_order_line_movement`,
`materialize_repair_orders_from_session`, `putaway_repair_order_stock`,
`rebuild_repair_order_location_projection`, `rebuild_repair_order_
projection_bucket_internal`, `receive_repair_order_stock`,
`write_repair_order_line_movement_link_internal` — every one of them
already classified, in the architecture compression review's own
`module-boundary-review.md`, as a valid DOMAIN ORCHESTRATOR/PROJECTION
function living ABOVE generic core, not core code with embedded domain
knowledge. None are generic core primitives.

**PurchaseOrder has no equivalent**: `SELECT proname FROM pg_proc
WHERE proname LIKE 'inventory\_%' AND (prosrc ILIKE
'%purchase_order_lines%' OR prosrc ILIKE
'%inventory_purchase_orders%') AND proname NOT IN
('inventory_create_purchase_order', 'inventory_receive_purchase_
order')` → **zero rows**.

## Write-once re-verification — the TOCTOU-safety load-bearing fact

Re-verified live, from scratch, not trusted from the prior audit:

### `inventory_containers.reference_type`/`reference_id`

- SQL: `prosrc ~* 'update\s+(public\.)?inventory_containers\s+set\s+
[^;]*reference_(type|id)\s*='` across all of `pg_proc` → **zero
  rows**.
- TypeScript: every `.from("inventory_containers")` call site in both
  `apps/web` and `apps/public-web` checked individually. `apps/web`'s 2
  real references (`ambra-location-inventory.service.ts`,
  `repair-orders.service.ts`) are both read-only (`.select()`).
  `apps/public-web`'s legacy `ambra-location-inventory.ts` has 2 real
  writers: `createLocationContainerAction`'s own `.insert()` never sets
  `reference_type`/`reference_id` at all (defaults to null — a generic
  container); `relocateContainerAction`'s own `.update()` only ever
  sets `current_location_id`/`updated_at`. Neither touches the checked
  columns.
- Only setter, confirmed: `inventory_create_container`'s own `INSERT`,
  at creation time only.

### `inventory_allocation_lines.reservation_line_id`

- SQL: `prosrc ~* 'update\s+(public\.)?inventory_allocation_lines\s+
set\s+[^;]*reservation_line_id\s*='` across all of `pg_proc` →
  **zero rows**.
- TypeScript: the only real reference anywhere in the repo is a
  `.select()` in `repair-orders.service.ts`'s own
  `listAllocationsForLine`.
- Only setter, confirmed: `inventory_create_allocation`'s own `INSERT`,
  at creation time only.

**No contradiction found — both remain write-once.** This is the exact
load-bearing invariant the wrapper's own design depends on: because
neither value can change after a row is created, the wrapper's own
**unlocked** read of `reference_type`/`reference_id` (no `FOR UPDATE`)
cannot race with the generic primitive's own later `FOR UPDATE` read of
the same rows — there is no window in which a concurrent transaction
could change the fact being checked between the wrapper's read and the
generic primitive's lock, because the fact literally cannot change,
ever, after creation.

**Deliberate design choice, documented here explicitly**: the wrapper
does NOT take its own row lock on the container or allocation-line rows
it reads. This is intentional — adding a lock there would be a NEW
lock this pass would introduce, which per the task's own §16
("If the implementation introduces a new row lock... run an actual
two-session test") would require a fresh concurrency proof. Because
the write-once invariant already makes a lock unnecessary for
correctness (nothing the wrapper reads can be concurrently mutated in
a way that matters), no new lock was added, and no new two-session
concurrency test was required. The nested call to `inventory_add_to_
container` still takes its own `FOR UPDATE` locks exactly as before —
completely unchanged.

**If either column ever becomes mutable** in a future feature (e.g.
"reassign a container to a different RepairOrder" or "re-point an
allocation to a different reservation"), this TOCTOU-safety analysis
MUST be re-opened before shipping that feature — the wrapper's own
unlocked read would no longer be safe.

## Disclosed, accepted design tradeoff: direct callers of the narrowed generic primitive

Post-narrowing, `inventory_add_to_container` no longer evaluates
RepairOrder ownership at all. A hypothetical caller that holds
`warehouse.inventory.operate` and calls this RPC **directly**
(bypassing `repair_order_add_allocation_to_container` entirely) could
place an unrelated allocation into a RepairOrder-owned container — a
protection the OLD inline branch provided for every caller, generic or
not.

**Live-proven, both pre- and post-narrowing** (see `test-evidence.md`
scenario G2 / probe P4): pre-narrowing, this direct call was rejected;
post-narrowing, it succeeds.

This is not an oversight — it is the exact, explicit design the task
itself specified: "the generic primitive... must know ONLY generic
inventory concepts... It must NOT query repair*orders/repair_order*
lines... RepairOrder ownership validation belongs in: repair*order*
add_allocation_to_container." The architecture compression review's own
proposed redesign made the identical tradeoff ("the removed branch
never activated for a non-repair_order-owned container, so behavior is
byte-identical for every OTHER caller" — implicitly, only wrapper
callers are protected for RepairOrder-owned containers going forward).

**Risk assessment, disclosed explicitly**: no product UI surface
exposes a path to call `inventory_add_to_container` directly with a
RepairOrder-owned container id and an unrelated allocation-line id —
the only production caller, `RepairOrdersService.placeAllocationIn
Container`, now goes through the wrapper. A hypothetical attacker would
need `warehouse.inventory.operate` (already a broad, trusted grant for
physical-stock manipulation) AND prior knowledge of both a specific
RepairOrder-owned container's UUID and an unrelated allocation line's
UUID, neither exposed anywhere in the product for this purpose. This
matches the architecture compression review's own original "Severity:
low" classification of the backward dependency itself — the same
low-severity judgment now applies symmetrically to its resolution.

## Complexity result

| Metric                                                                                                                                  | Before                           | After                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lines in `inventory_add_to_container` (function body)                                                                                   | ~123                             | ~104 (−19: the removed `IF` block + 1 dead variable)                                                                                                                                                                                                         |
| Lines in the new wrapper                                                                                                                | 0                                | ~55 (new function)                                                                                                                                                                                                                                           |
| RepairOrder-table (`repair_order_lines`/`repair_orders`) references remaining in generic Inventory Core (`inventory_%`-named functions) | 1 (`inventory_add_to_container`) | **0**                                                                                                                                                                                                                                                        |
| Application (TypeScript) callers changed                                                                                                | —                                | 1 (`RepairOrdersService.placeAllocationInContainer`)                                                                                                                                                                                                         |
| Generic (non-RepairOrder) application callers affected                                                                                  | —                                | 0 (none exist as direct callers of this RPC outside `RepairOrdersService`; the generic Warehouse UI action layer calls the same RPC name it always did, now narrower, completely unaffected in practice since it never passed a RepairOrder-owned container) |

Not optimized for line count — optimized for correct dependency
direction: generic Inventory Core no longer references the RepairOrder
module at all; the RepairOrder module now sits entirely above generic
core, calling down into it, matching `final-proposed-architecture.md`'s
own target diagram exactly.
