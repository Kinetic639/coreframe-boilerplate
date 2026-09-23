# Final Proposed Architecture (post-SAFE-simplification)

## One-page diagram

```
┌──────────────────────────────────────────────────────────────────┐
│  PUBLIC APPLICATION SERVICES / DOMAIN INTEGRATIONS                │
│  RepairOrdersService · InventoryEnterpriseService (post-SPLIT)    │
│  InventoryProductsService · InventoryCountSessionsService         │
│  WarehouseLocationsService                                        │
└───────────────────────────────┬────────────────────────────────────┘
                                 │  (RepairOrder/PO/Product/Count sit
                                 │   ABOVE generic core — never below)
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  PUBLIC DB COMMANDS (SECURITY DEFINER, actor+permission checked)  │
│  create_draft · finalize_posting · create_and_finalize            │
│  save_draft · cancel_movement · reverse_movement                  │
│  receive_stock · create_reservation/release · create_allocation/  │
│  release · create/send/accept/decline/cancel_branch_transfer      │
│  create/add/remove/seal_container                                 │
└───────────────────────────────┬────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  CANONICAL INVENTORY ENGINE                                       │
│  inventory_finalize_posting_internal (the ONE physical writer)    │
│  inventory_get_or_create_balance_for_update (the ONE lock/get)    │
└───────────────────────────────┬────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  BALANCE + LEDGER (physical truth + immutable history)            │
│  inventory_balances · inventory_stock_ledger_entries               │
└──────────────────────────────────────────────────────────────────┘

  ┌─────────────────────┐  ┌────────────────────┐  ┌───────────────┐
  │ RESERVATION/         │  │ TRANSFER            │  │ DOMAIN         │
  │ ALLOCATION            │  │ (uses the engine     │  │ PROJECTIONS    │
  │ (separate commitments │  │  above, same-owner    │  │ repair_order_  │
  │  over physical stock) │  │  nesting)             │  │ line_movement_ │
  │                        │  │                       │  │ links (source  │
  │                        │  │                       │  │ of truth) +    │
  │                        │  │                       │  │ live-computed  │
  │                        │  │                       │  │ read (post-A8) │
  └─────────────────────┘  └────────────────────┘  └───────────────┘
```

**Building blocks count**: 5 layers (services / public commands /
engine / balance+ledger / the 3 peer boxes at the bottom) = **8
conceptual blocks**, within the ~10-block target. The 3 bottom boxes
(reservation-allocation, transfer, domain-projections) are peers, not
a deeper stack — transfer and RepairOrder integration both call
straight back up into "public DB commands," they don't bypass it.

**RepairOrder/PO sit above generic core**: confirmed by the module-
boundary review — every RepairOrder/PO orchestrator (`receive_repair_
order_stock`, `putaway_repair_order_stock`, `attach_repair_order_line_
movement`, `inventory_receive_purchase_order`) calls DOWN into the
generic public commands layer; the one exception found
(`inventory_add_to_container`'s inline RepairOrder JOIN) is exactly the
inverted dependency this review flags for correction (simplification
plan item A7) — it is the exception being fixed, not the rule.

## Why exactly these 8 blocks, not fewer

- **Services layer** cannot merge into the RPC layer — TypeScript-side
  request shaping, cross-cutting event emission, and multi-RPC
  orchestration (e.g. count-session approval's 0-2 posting cycles) live
  here for real reasons, not historical accident.
- **Public DB commands** cannot merge into the engine — this is the
  actor/permission/grant boundary; collapsing it would mean every
  caller re-implements its own security check inline, the opposite of
  centralization.
- **The engine** cannot merge into balance+ledger — it is the only
  thing allowed to touch those 2 tables directly, by design (this
  boundary IS the "one canonical writer" guarantee).
- **Reservation/allocation, transfer, and domain projections** are
  necessarily separate from each other — they are different kinds of
  commitment/derivation over the same physical truth, not
  alternative implementations of the same thing. Collapsing any two
  would mean, e.g., a reservation accidentally behaving like a
  transfer, or a derived projection being mistaken for physical truth
  — exactly the confusion the architecture's own frozen facts exist to
  prevent.

If simplification item A8 (remove the incremental RepairOrder
projection) is implemented, the "domain projections" box gets
strictly simpler (one source-of-truth table + a live query, no
trigger, no second persisted table) without changing the block count.

## Simplicity test (developer onboarding)

1. **Where do I add a new stock movement?** `InventoryMovementsService`
   → `inventory_create_draft`/`inventory_create_and_finalize`. One
   place, one public entry family.
2. **Where do I reserve stock?** `inventory_create_reservation` — one
   RPC, called either generically or with a RepairOrder-line reference.
   No RepairOrder-specific reservation mechanism exists.
3. **Where do I allocate stock?** `inventory_create_allocation` — same
   shape.
4. **How do I transfer stock?** `inventory_create_branch_transfer` →
   `send` → `accept`/`decline`. **Caveat surfaced by this audit**: as
   shipped today, `send` has no UI, so the lifecycle is not actually
   end-to-end usable from the product — a genuine onboarding surprise
   an new developer would hit immediately trying to demo this feature.
   Not an architecture defect; a product-completeness gap this audit
   surfaces for awareness.
5. **How do I reverse a mistake?** `inventory_reverse_movement` — one
   mechanism, compensating movement not history mutation. **Caveat**:
   it has no UI/action caller at all yet — a new developer would need
   to know this exists and is tested, not discover it by looking for a
   "reverse" button.
6. **Where is physical truth?** `inventory_balances` (current state) +
   `inventory_stock_ledger_entries` (append-only history) — one answer,
   consistently true across every operation traced in this audit.
7. **Where is history?** Same ledger table, plus `inventory_movement_
audit_log` for the actor/action-level audit trail. Two tables, two
   distinct purposes, no ambiguity found.
8. **How does RepairOrder use stock?** Through the exact same public
   commands as any other caller (`create_reservation`, `create_
allocation`, `create_and_finalize` via `receive_repair_order_stock`/
   `putaway_repair_order_stock`), plus its own attribution layer
   (`attach_repair_order_line_movement` → `repair_order_line_movement_
links`) recording WHICH RepairOrderLine a given generic movement/
   commitment belongs to. A new developer needs to learn one extra
   concept (attribution links) beyond the generic model, not a parallel
   stock system.
9. **Can RepairOrder affect Inventory without going through public
   primitives?** No, with one narrow, already-identified exception
   (`inventory_add_to_container`'s own inline RepairOrder-ownership
   check, flagged for extraction in simplification plan item A7) — not
   a case of RepairOrder bypassing the physical write path, only a
   generic primitive containing a domain-specific _read_ check inline.
10. **How do I rebuild a derived RepairOrder projection?**
    `rebuild_repair_order_location_projection` — one admin/reconciliation
    entry point, currently unwired to any UI (by design, not built
    speculatively). **If simplification item A8 is implemented**, this
    answer simplifies further: "you don't — it's computed live on
    read, there is nothing to rebuild."

**Does answering these require explaining historical migration
accidents or unrelated helpers?** Mostly no. The two places a new
developer WOULD hit historical-accident-shaped surprises: (a) the
branch-transfer `send`-has-no-UI gap (question 4), and (b) needing to
know `inventory_reverse_movement`/several RepairOrder RPCs exist and
are production-ready despite having no UI yet (questions 5, 8, 10) —
this is architecture debt in the sense of "built ahead of its UI," not
"accidental complexity," and is already correctly disclosed rather than
hidden (see `application-entry-point-matrix.md` and this review's own
runtime-operation-graph.md).

## Overengineering verdict

**Not generally overengineered.** Every mechanism examined in this
audit — the internal-helper/public-RPC split, the immutability
triggers, the shared balance-lock helper, the per-function inline
actor-identity check, the multiple domain wrappers over shared
primitives — has a specific, traceable, already-documented reason to
exist, most of them closing a real, previously-exploited or
previously-drifted defect. The IC-5/IC-6/IC-7 passes already did real
consolidation (dropped the old balance helper, a stale overload,
`negative_stock_policy`, 4 dead legacy actions).

**Where genuine overengineering/misplaced-complexity WAS found**,
concentrated in three specific spots, not a general pattern:

1. **`InventoryEnterpriseService`** — a genuine "kitchen sink" service
   with 10 unrelated sub-domains bolted together under a non-descriptive
   name. This is the clearest instance of accidental complexity in the
   whole audit (simplification plan A6).
2. **The RepairOrder incremental projection** (trigger + 2 persisted
   tables) — currently pure overhead: a real write-side cost and a
   real latent correctness gap (P0008), maintaining data that nothing
   in production reads. Not overengineered at the time it was built
   (the reasoning was sound before this audit's own read-frequency
   check), but overengineered relative to its CURRENT, evidence-checked
   value (simplification plan A8).
3. **Document-numbering and idempotency-check logic**, each
   independently reimplemented ~10 times — not overengineering in the
   "too many layers" sense, but real, unmanaged duplication with proven
   drift risk (one idempotency-ordering bug already shipped and was
   fixed once, in isolation).

Everything else audited — triggers, GUCs, internal helpers, the RPC
surface, the service split outside of Enterprise, the module boundary
outside of one container function — earns its complexity.
