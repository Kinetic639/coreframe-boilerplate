# IC-7 Module-Boundary Audit

Per §3/§4/§25 of the IC-7 task: verify dependency direction (BUSINESS MODULE
→ INVENTORY CORE, never the reverse), classify every cross-domain hit, and
document — not rewrite — findings, unless a security bypass is involved.

## Method

Live `prosrc` scan across every `inventory_%`-named SQL function for the
substrings `repair_order`, `purchase_order`, `workshop_source`, `matcher`,
`ticket`, `crm`, `help_desk`, `planning`. Complemented by a repo-wide grep
for every TypeScript file that calls an Inventory Core RPC, to map the
TypeScript-layer dependency direction too.

## SQL-layer findings

| Function                           | Hit                                                                                                             | Classification                                                                                   | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `inventory_add_to_container`       | Direct `JOIN repair_order_lines` inside a conditional branch (`IF v_container.reference_type = 'repair_order'`) | **A — generic core, INVALID dependency (pre-existing, accepted, tested — not a security issue)** | A GENERIC Container-domain function (Phase 10C) contains an inline special case that directly queries `repair_order_lines` to prove a placed allocation belongs to the container's own declared RepairOrder. This is real domain knowledge leaking into a core primitive. It is already live, already tested (`implementation-plan.md`'s own Handling Unit Operations Plan: "cross-RepairOrder protection (already proven Phase 10C)"), and enforces a real invariant (a container can't silently mix two different RepairOrders' stock) — not a bug, not a security bypass. **Not touched in IC-7** (no security defect; rewriting it is a broader refactor than this phase's own scope). **Recorded as a compression/boundary-cleanup candidate** — see `compression-candidates.md`: the correct end state is likely a `reference_type`-keyed generic ownership check (already how it's SHAPED — `reference_type`/`reference_id` are generic columns) with the RepairOrder-specific resolution logic (the `repair_order_lines` JOIN) moved to a small RepairOrder-domain wrapper that pre-validates before calling a genuinely reference_type-agnostic core primitive. |
| `inventory_reverse_movement`       | Sets `SET LOCAL ambra.repair_order_attribution_authoritative = 'on'`                                            | **B — domain integration hook, valid**                                                           | This is a GUC _name_ reference only — no table JOIN, no RepairOrder business logic. The function sets a narrowly-scoped, generic "defer to my caller" signal that a SEPARATE, RepairOrder-domain trigger (`repair_order_line_locations_ledger_sync`) reads. The generic engine has zero knowledge of what the GUC's own name means business-wise; it's an anonymous extension point, already documented and accepted since IC-5 (`inventory-core-architecture.md` §9C: "Fixed WITHOUT touching Zone 5 itself"). Acceptable coupling pattern — not a violation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `inventory_create_purchase_order`  | Function's own business purpose IS purchase orders                                                              | **B — domain integration/orchestrator, valid**                                                   | Despite its `inventory_`-prefixed name, this is legitimately PurchaseOrder-domain logic (PO header creation) that happens to be co-located in the same schema/naming convention as the generic engine. Matches the task's own explicit "Allowed examples: PurchaseOrder → receive stock, update PO state." Naming convention, not an architecture violation — flagged for a possible future rename/relocation (see `compression-candidates.md`), not touched here.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `inventory_receive_purchase_order` | Same as above — PO receiving wrapper                                                                            | **B — domain integration/orchestrator, valid**                                                   | Already documented in `inventory-core-architecture.md` §7A as "the PurchaseOrder wrapper," built on top of the domain-agnostic `inventory_receive_stock` primitive. Correct shape: PO-specific business rules (PO row lock, `warehouse.procurement.manage` permission, status guard, over-receipt rejection) live HERE, not in the generic primitive.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

**No other generic Inventory Core function** (movement engine, reservations,
allocations, containers' non-RepairOrder paths, branch transfers) contains
any direct reference to `repair_order_*`/`purchase_order`-specific tables,
`workshop_source_*`, `matcher`, `ticket`, `crm`, `help_desk`, or `planning`
tables. The core engine is, with the one disclosed exception above, already
domain-agnostic.

## Domain-specific logic living on a generic table (trigger-level)

`repair_order_line_locations_ledger_sync` — a trigger ON
`inventory_stock_ledger_entries` (a CORE, generic table) whose own trigger
FUNCTION contains substantial RepairOrder-domain business logic (bucket
derivation, `relation_type` inference, reversal-mirroring). Classification:
**C — projection/integration layer, valid but should not be called "core."**
This is IC-5's own accepted design (`inventory-core-architecture.md` §9C:
"all of this logic lives inside the RepairOrder-domain trigger, which
already existed") — the trigger fires on every ledger row (including
non-RepairOrder ones) but the FUNCTION itself immediately no-ops for buckets
with no attribution history. This is architecturally a projection/
integration concern bolted onto a core table's lifecycle via a trigger,
not core logic itself. **Not touched in IC-7** (reopening IC-5's projection
semantics is explicitly forbidden by this phase's own scope). Recorded in
`compression-candidates.md` as a named example of "domain-specific triggers
on generic inventory events," per the task's own §41 prompt.

## TypeScript-layer dependency direction

**Confirmed correct end to end**: every TypeScript file in the entire
repository that calls an Inventory Core RPC (`inventory_*`,
`attach_repair_order_line_movement`, `putaway_repair_order_stock`,
`receive_repair_order_stock`, `resolve_branch_receiving_location`,
`rebuild_repair_order_*`) lives under `src/server/services/` — a live,
repo-wide grep for any `.rpc("inventory_...")` call in `src/app/actions/`
or any client-side/component file returned ZERO hits. The application
layer's own dependency direction is: **UI → action → service → RPC**,
consistently, with no action-layer or component-layer RPC bypass anywhere
in the Inventory domain. See `application-entry-point-matrix.md` for the
full per-service breakdown.

Within the service layer, the dependency direction is also correct:
`RepairOrdersService` (business-domain service) calls generic Inventory
Core RPCs (`inventory_create_reservation`, `inventory_release_reservation`,
`inventory_create_allocation`, `inventory_create_container`, `inventory_
add_to_container`, `inventory_remove_from_container`, `attach_repair_
order_line_movement`) — this is the ALLOWED direction (business module
consumes core), matching the task's own explicit "RepairOrder → reserve
inventory → allocate inventory → ... → link resulting movement to
RepairOrderLine" example exactly. No generic Inventory Core service
(`InventoryMovementsService`, `InventoryEnterpriseService`, `InventoryProductsService`)
imports or references `RepairOrdersService`, any RepairOrder type, or any
RepairOrder table — confirmed by grep (zero `repair_order`/`RepairOrder`
hits in `inventory-movements.service.ts`/`inventory-enterprise.service.ts`
outside of movement-line-level generic `reference_type`/`reference_id`
columns, which are intentionally generic).

## Conclusion

Generic Inventory Core does **not** depend on RepairOrder or PurchaseOrder
_business logic_ in any load-bearing way. The one disclosed exception
(`inventory_add_to_container`'s own inline RepairOrder-ownership check) is a
narrow, tested, non-security-relevant special case — not a bypass, not
reachable by an unauthorized actor, and orthogonal to every fix this phase
makes. It is recorded for the post-IC7 architecture-compression pass, not
rewritten here, per this phase's own explicit "do not perform a risky
domain-boundary refactor in this security phase unless the current
dependency creates a security bypass" instruction — it does not.
