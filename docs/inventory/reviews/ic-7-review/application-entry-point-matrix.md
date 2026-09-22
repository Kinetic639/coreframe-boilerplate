# IC-7 Application Entry-Point Matrix

## Method confirmed: TypeScript-layer dependency direction is already clean

A live, repo-wide grep for every `.rpc("inventory_...")`/`.rpc("attach_
repair_order...")`/etc. call anywhere in `src/app/actions/` or any
client-side/component file returned **zero hits**. Every single
Inventory Core RPC call in the entire codebase originates from
`src/server/services/*.ts` — the application's own dependency direction
is consistently **UI → action → service → RPC**, with no action-layer
or component-layer bypass anywhere in the Inventory domain. This is a
positive, already-correct finding, not something this phase needed to
fix.

## Per-operation ownership

| Operation                                         | Server action                                                                       | TypeScript service                                                                                                | RPC                                                                                                                        | Owner/domain                                                                                                                                       |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generic movement create/save/post                 | `createDraftMovementAction`, `finalizePostingAction`, `createAndPostMovementAction` | `InventoryMovementsService`                                                                                       | `inventory_create_draft`/`inventory_save_draft`/`inventory_finalize_posting`/`inventory_create_and_finalize`               | Generic movement engine                                                                                                                            |
| Cancel                                            | (via `InventoryMovementsService.cancelMovement`)                                    | `InventoryMovementsService`                                                                                       | `inventory_cancel_movement`                                                                                                | Generic movement engine                                                                                                                            |
| Reverse                                           | **none — no action calls `inventory_reverse_movement` today**                       | none                                                                                                              | `inventory_reverse_movement`                                                                                               | Generic movement engine (DB-ready, no UI yet)                                                                                                      |
| Opening stock                                     | (product-creation action)                                                           | `InventoryProductsService.createOpeningStockMovement`                                                             | `inventory_create_and_finalize` (movement type 401, IC-6A)                                                                 | Product-creation integration                                                                                                                       |
| Reservation (generic warehouse)                   | `createInventoryReservationAction`, `releaseInventoryReservationAction`             | `InventoryEnterpriseService.createReservation`/`.releaseReservation`                                              | `inventory_create_reservation`/`inventory_release_reservation`                                                             | Generic reservation domain                                                                                                                         |
| Reservation (RepairOrder-line-specific)           | (RepairOrder detail-page actions)                                                   | `RepairOrdersService.reserveForLine`/`.releaseReservationForLine`                                                 | SAME `inventory_create_reservation`/`inventory_release_reservation` RPCs, called with `reference_type='repair_order_line'` | RepairOrder integration, consumes the generic primitive — **not a duplicate entry point, a distinct business operation sharing one canonical RPC** |
| Allocation (generic warehouse)                    | `createInventoryAllocationAction`, `releaseInventoryAllocationAction`               | `InventoryEnterpriseService.createAllocation`/`.releaseAllocation`                                                | `inventory_create_allocation`/`inventory_release_allocation`                                                               | Generic allocation domain                                                                                                                          |
| Allocation (RepairOrder-line-specific)            | (RepairOrder detail-page actions)                                                   | `RepairOrdersService.allocateForLine`                                                                             | SAME `inventory_create_allocation` RPC                                                                                     | RepairOrder integration — same non-duplication note as reservations                                                                                |
| Container create/add/remove                       | (RepairOrder container actions)                                                     | `RepairOrdersService.placeAllocationInContainer`/`.removeAllocationFromContainer`, plus generic warehouse actions | `inventory_create_container`/`inventory_add_to_container`/`inventory_remove_from_container`                                | Shared generic Container domain, consumed by both RepairOrder integration and generic warehouse UI                                                 |
| RepairOrder receive                               | **none — `receive_repair_order_stock` has zero current TS callers**                 | —                                                                                                                 | `receive_repair_order_stock`                                                                                               | DB-ready, no UI entry point yet                                                                                                                    |
| RepairOrder putaway                               | **none — `putaway_repair_order_stock` has zero current TS callers**                 | —                                                                                                                 | `putaway_repair_order_stock`                                                                                               | DB-ready, no UI entry point yet                                                                                                                    |
| RepairOrder attach                                | (RepairOrder detail-page actions)                                                   | `RepairOrdersService.attachMovementToRepairOrderLine`                                                             | `attach_repair_order_line_movement`                                                                                        | RepairOrder integration                                                                                                                            |
| PO receive                                        | (PO detail-page actions)                                                            | `InventoryEnterpriseService.receivePurchaseOrder`                                                                 | `inventory_receive_purchase_order`                                                                                         | PurchaseOrder integration                                                                                                                          |
| Branch transfer create/send/accept/decline/cancel | (branch-transfer actions)                                                           | `InventoryEnterpriseService`'s own 5 transfer methods                                                             | `inventory_create_branch_transfer`/`.send`/`.accept`/`.decline`/`.cancel_branch_transfer`                                  | Branch-transfer domain                                                                                                                             |
| Count session create/list/approve                 | (audit/count-session actions)                                                       | `InventoryCountSessionsService`                                                                                   | `inventory_create_count_session`/`inventory_count_session_list`/`inventory_approve_count_session`                          | Inventory-audit domain                                                                                                                             |
| RepairOrder projection rebuild                    | **none — `rebuild_repair_order_location_projection` has zero current TS callers**   | —                                                                                                                 | `rebuild_repair_order_location_projection`                                                                                 | DB-ready reconciliation tool, no UI entry point yet                                                                                                |

## Duplicate application entry points for the same physical write?

**None found.** The apparent "duplication" between `InventoryEnterpriseService`'s
generic reservation/allocation methods and `RepairOrdersService`'s own
`reserveForLine`/`allocateForLine` is NOT a duplicate entry point for
the same operation — they are two DIFFERENT business operations
(generic warehouse reservation vs. RepairOrder-line-specific
reservation, distinguished by `reference_type`) that correctly SHARE
one canonical RPC, exactly matching the task's own "many domain
wrappers, one canonical primitive" allowed pattern. No consolidation is
needed or recommended here.

## DB-ready canonical RPCs with zero current application entry point

Three IC-3/IC-5-era canonical primitives have **zero TypeScript callers
anywhere in the repository** (confirmed via repo-wide grep, not just
`InventoryMovementsService`/`RepairOrdersService`):

- `receive_repair_order_stock` — the documented canonical RepairOrder
  receiving wrapper (architecture.md §7A).
- `putaway_repair_order_stock` — the documented canonical RepairOrder
  putaway wrapper.
- `rebuild_repair_order_location_projection` — the IC-5 reconciliation
  entry point.

This is NOT a security concern (all three are correctly hardened,
`authenticated`/`service_role`-only, actor+permission checked) — it is
an **application-completeness** observation: these RPCs exist and are
fully tested (pgTAP), but the corresponding UI/action layer that would
call them has not been built yet. Recorded here per the task's own
§23 instruction to "make it obvious whether the application has one
sanctioned entry path or multiple competing entry paths" — in this
case, the answer is "zero entry paths, not multiple," which is a
different kind of gap (a build-completeness gap, not a security or
architecture gap) worth flagging for whoever picks up the RepairOrder
receiving/putaway UI work next.

## `inventory_reverse_movement` — also zero current UI entry point

Same observation: the reversal RPC is fully built, tested, and hardened
(IC-2/IC-7 both), but no server action calls it yet. Disclosed for
completeness, not a security finding.

## Conclusion

The application's own entry-point shape is already correct and does
NOT require consolidation: one canonical RPC per generic operation,
multiple domain-specific wrappers where genuinely different business
rules apply (RepairOrder vs. generic warehouse), zero action-layer RPC
bypass, zero duplicate competing entry points for the same physical
write. The only "gaps" found are DB-ready-but-not-yet-wired-to-a-UI
primitives (receive/putaway/rebuild/reverse for RepairOrder) — an
application-completeness matter for a future feature-build phase, not
an IC-7 security or architecture finding.
