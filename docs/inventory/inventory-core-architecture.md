# Inventory Core — Target Architecture & Invariants

> **This document defines the FINAL TARGET.** It is not an execution plan (see
> `inventory-core-implementation-plan.md`) and not a live status tracker (see
> `inventory-core-progress.md`). It supersedes, as the authoritative target, the
> findings of the 2026-09-15 Inventory Architecture Consolidation Audit
> (conversation record on branch `zone3-zone5-integration-audit`) — that audit's
> own findings are restated here only where needed for context; treat this
> document, not the audit transcript, as the source of truth going forward.

**Status:** target architecture, ACCEPTED by product owner. **Nothing in this
document has been implemented yet** except where explicitly marked otherwise in
`inventory-core-progress.md`.

---

## 0. Closed Decisions (do not reopen without new repository/live evidence)

These are product-owner decisions, restated verbatim in intent, numbered to
match the assigning brief:

1. Ambra will have **ONE canonical Inventory Core**.
2. Historical/parallel write mechanisms are **not preserved for backwards
   compatibility** — current data is test/demo data; breaking cleanup is
   acceptable.
3. Physical stock movements use **the canonical movement engine** — no
   feature module posts its own ad-hoc balance mutation.
4. **Reservation and Allocation remain dedicated first-class Inventory Core
   domain operations** — not forced into the movement-type-catalog model.
5. **Containers remain first-class Handling Units** — never a second stock
   ledger.
6. `inventory_containers.current_location_id` **must stay consistent with the
   canonical physical movement of its contents.**
7. `repair_order_line_locations` **must not remain an independent competing
   source of truth** — target: derived projection.
8. `getPhysicalStateForLine` is **transitional/diagnostic**, not guaranteed to
   survive consolidation in its current form.
9. `ambra-location-inventory.ts` legacy writers **will be removed** once the
   replacement path is proven.
10. `inventory_v1_get_or_create_balance` **will be replaced** by
    `inventory_get_or_create_balance_for_update` (already lot/serial-aware) —
    confirmed technically sound, see §1.
11. Movement code **311 is not preserved merely because it exists** — it has
    zero live usage (0 posted headers, live-confirmed) and is one-sided by its
    own type-catalog definition.
12. Inter-branch transfer **keeps the existing `inventory_branch_transfers`
    document/state-machine concept** (source reserve → in-transit →
    destination accept/decline) — the Ambra equivalent of Autostacja's
    MMJ-/MMJ+ workflow.
13. Partial branch-transfer receipt **must produce an explicit, auditable
    discrepancy** — never a silent adjustment.
14. Purchase Order and RepairOrder receiving **must share one physical
    receiving primitive** — their business wrapping may differ.
15. Ambra uses **HARD reservations**: `reserved <= on_hand` always. Backorder/
    inbound-reservation semantics are explicitly out of scope and must not
    weaken this invariant.
16. Physical movement of reserved/allocated stock is **forbidden by default**,
    permitted only through a sanctioned atomic operation that moves the
    commitment together with the physical stock.
17. **Whole-container relocation** is one such sanctioned operation.
18. **Future explicit relocation of allocated loose stock** may be another,
    but must be atomic — not designed in detail yet (§7.2).
19. **Phase 10D (QR) stays frozen** until Inventory Core consolidation is
    completed and accepted.
20. **Added during IC-1's finalization pass**: `on_hand_quantity >= 0`
    ALWAYS, with no exception — Ambra does not support negative physical
    on-hand stock. `inventory_settings.negative_stock_policy`'s `'allow'`/
    `'allow_with_approval'` values are superseded/deprecated for on-hand
    behavior and must never bypass this invariant or invariant #6. The
    column is not removed yet — its dead values are owned by IC-6's own
    cleanup scope.
21. **Added for IC-2 (product decision A)**: a posted ORIGINAL movement may
    be reversed at most once; a reversal movement may never itself be
    reversed ("undo an undo" is explicitly out of scope for MVP/pitch, not
    an open question).
22. **Added for IC-2 (product decision B)**: RepairOrder business-quantity
    attribution/netting for reversed movements is NOT implemented in IC-2.
    `RepairOrdersService.listRepairOrderLines()`'s own received/issued/
    outstanding/available formulas remain unchanged; no `repair_order_
line_movement_links` row of any `relation_type` is created for a
    reversal. This remains an explicit, later, deliberately deferred
    integration concern.

---

## 1. Live-Verified Baseline (carried forward from the consolidation audit)

Restated only where it directly justifies a design decision below; full
evidence lives in the audit's own conversation record.

- **The core posting engine (`inventory_finalize_posting`) is explicitly
  self-documented as "v1: on_hand only"** (its own `RAISE EXCEPTION 'v1 only
supports on_hand balance field, got %'` on any other `balance_field`).
  Reservations/allocations were built as a **deliberately separate** mutation
  path — this was a reasonable incremental choice, not a mistake, and this
  architecture's own §3 formalizes it as the permanent target shape (decision
  #4), not a gap to "fix" by merging them into the movement-type catalog.
- **Only 5 movement-type codes are seeded**: 101, 311, 401, 402, 801. No 201/WZ
  exists. No reversal counterpart exists for any code.
- **`inventory_v1_get_or_create_balance`** has no lot/serial parameters, unlike
  **`inventory_get_or_create_balance_for_update`** (two overloads, one
  lot/serial-aware) — confirms decision #10 is technically sound: the
  replacement already exists and is already used everywhere else (Phase
  10A/10B/10C, Zone 5, branch transfers).
- **`inventory_branch_transfers` + `inventory_accept_branch_transfer` /
  `inventory_decline_branch_transfer` already implement the target lifecycle's
  own shape** (create = reserve, accept = paired issue+receipt movements,
  decline = release) but **`inventory_accept_branch_transfer` is currently
  broken** — live-proven to crash with `42883: function
public.inventory_allocate_movement_number(uuid, uuid) does not exist`, and
  would additionally fail on a missing `movement_kind` column and `NOT NULL`
  `movement_type_id`/`movement_type_code` violations even if that were fixed.
  Zero real callers exist (service + actions exist, zero `.tsx` callers).
  **REBUILT IC-4, 2026-09-16 — see §9B**: both functions hand-wrote balances/
  ledger entries directly, entirely bypassing the canonical engine; `accept`
  fully rebuilt to route through it; `decline`'s own automatic-return-movement
  branch (for the post-shipment case) removed entirely, per a closed product
  decision that post-shipment discrepancy is represented by partial accept,
  never an automatic reversal.
- **Movement code 311** (`requires_destination_location = false`, one-sided
  `source` effect only) has **0 posted headers ever** — dead at the
  type-catalog level; the real (broken) inter-branch transfer logic bypasses
  it entirely via hand-rolled `INSERT`s. **REDEFINED IC-4** (zero live rows
  confirmed again immediately before the change): now `allows_manual_entry=
false`, posted exclusively by `inventory_send_branch_transfer`. See §9B.
- **No reversal RPC exists**, despite `inventory_movement_headers` already
  carrying `original_movement_id`/`reversal_movement_id` columns.
- **Movement immutability is already DB-enforced**: `BEFORE UPDATE OR DELETE`
  triggers on `inventory_movement_headers`/`inventory_movement_lines`
  (`inventory_prevent_header_modification`/`inventory_prevent_line_
modification`); `inventory_stock_ledger_entries` is append-only
  (`inventory_ledger_append_only`). Keep unchanged.
- **`inventory_balances` writes are GUC-gated**: a `BEFORE INSERT OR UPDATE OR
DELETE` trigger (`inventory_guard_balance_write`) requires the session GUC
  `ambra.inventory_movement_engine = 'on'`, set by every legitimate writer via
  `PERFORM set_config(...)`/`SET LOCAL`. Keep unchanged — this is the correct
  mechanism to make "no feature module bypasses the core" structurally true,
  not just conventional.
- **`ambra-location-inventory.ts`'s write actions have zero UI callers**
  (confirmed twice, this audit and Phase 10C's own).
- **Indexing is already solid** across balances/movement lines/ledger — no
  N+1 pattern found; composite org/branch-scoped indexes exist throughout.

---

## 2. Target Domain Model

```
┌──────────────────────────────── INVENTORY CORE ─────────────────────────────────┐
│                                                                                    │
│  A. PHYSICAL STOCK                                                                │
│     inventory_balances · inventory_movement_headers/lines · inventory_movement_   │
│     types/type_effects · inventory_stock_ledger_entries ·                         │
│     inventory_movement_audit_log · (new) reversal linkage                         │
│                                                                                    │
│  B. COMMITMENTS                                                                   │
│     inventory_reservations/_lines · inventory_allocations/_lines                  │
│     (dedicated operations, NOT movement-type entries — decision #4)               │
│                                                                                    │
│  C. HANDLING UNITS                                                                │
│     inventory_containers · inventory_container_lines ·                            │
│     inventory_allocation_container_links · (future) QR identity                   │
│                                                                                    │
│  D. TRANSFERS                                                                     │
│     inventory_branch_transfers/_lines (intra-branch relocation = a plain 801      │
│     physical movement, NOT part of D — D is specifically the multi-branch,        │
│     in-transit/accept-decline document)                                           │
│                                                                                    │
│  E. DERIVED PROJECTIONS / READ MODELS                                             │
│     RepairOrder physical-state projections · branch inventory views ·             │
│     reporting/search projections — NEVER written to directly by a feature module  │
│                                                                                    │
└────────────────────────────────────────────────────────────────────────────────┘
                        ▲                    ▲                    ▲
                        │                    │                    │
                 Repair Orders          Receiving           Purchase Orders
                 (Zone 3)               (generic +          (Warehouse module)
                                         RepairOrder-aware)
                        │                    │                    │
                        └────────── call Inventory Core operations only ──────────┘
                                    (never mutate balances/state directly)
```

**A/B/C/D are peers inside the Core, not a strict pipeline** — B, C, D each
have their own dedicated RPCs and their own invariants, but B (commitments)
and D (transfers, via their own reservation) both _depend on_ A's own balance
state, and C (containers) _depends on_ B's own allocation state (Phase 10C's
accepted contract, unchanged). E depends on all of A-D and is read-only.

---

## 3. Movement Semantics — The Exact Boundary

**A MOVEMENT means: physical stock changed location, entered, left, or was
adjusted.** Concretely: 101 receipt, 801 relocation (same-branch or, per the
branch-transfer rebuild, as one leg of a cross-branch transfer), 201/WZ issue,
401/402 adjustments, and reversal movements.

**Reservation and Allocation are NOT physical movements.** They never call
`inventory_finalize_posting`, never write `inventory_movement_headers/lines`
or `inventory_stock_ledger_entries`. This is the _existing, correct_ Phase
10A/10B shape — decision #4 makes it permanent, not provisional.

**Container repacking without changing physical location is NOT a physical
movement.**

| Scenario                                                                                  | Movement?                                                                                                                                                                |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BOX-A → BOX-B`, same BIN                                                                 | **No** — Handling Unit operation only (Container domain, §2.C)                                                                                                           |
| `BOX-B @ BIN-A → BIN-B` (whole container relocation)                                      | **Yes** — one sanctioned 801-class physical movement of every distinct (variant, lot, serial) inside, plus a container-pointer update, in one transaction (decision #17) |
| Splitting an allocation's own quantity across two containers at the _same_ location       | **No** movement — pure Handling Unit operation, exactly Phase 10C's own `inventory_add_to_container` today                                                               |
| Partial contents of a container moved to a different location (decontainerize + relocate) | **Yes**, for the moved quantity only — repack/remove from the source container, then a physical movement, then (optionally) re-place into a container at the destination |

---

## 4. Source-of-Truth Contract (Final, Authoritative)

| Question                             | Canonical source                                                                                                                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Physical stock quantity              | `inventory_balances.on_hand_quantity`                                                                                                                                                                                   |
| Physical stock location              | The location identity on `inventory_balances` (its own `location_id` column, part of the balance row's own composite identity)                                                                                          |
| Movement history / why stock changed | `inventory_movement_headers` + `inventory_movement_lines` + `inventory_stock_ledger_entries`                                                                                                                            |
| Reserved stock                       | `inventory_reservations`/`inventory_reservation_lines` (event-sourced truth) **+** `inventory_balances.reserved_quantity` (current-state projection, kept in sync by the reservation RPCs themselves)                   |
| Allocated stock                      | `inventory_allocations`/`inventory_allocation_lines` (event-sourced truth) **+** `inventory_balances.allocated_quantity` (current-state projection)                                                                     |
| Container contents                   | `inventory_container_lines`, cross-referenced with `inventory_allocation_container_links` wherever business allocation identity matters (which RepairOrder/allocation this content represents)                          |
| Container location                   | `inventory_containers.current_location_id`                                                                                                                                                                              |
| RepairOrder attribution              | Canonical movement attribution (`repair_order_line_movement_links`, written exclusively by `attach_repair_order_line_movement`) **+** the reservation/allocation reference chain (`reference_type='repair_order_line'`) |
| Inter-branch in-transit stock        | `inventory_branch_transfers`/`inventory_branch_transfer_lines`                                                                                                                                                          |
| Audit actor / operation              | `inventory_movement_audit_log` + the actor/timestamp columns already present on every canonical header                                                                                                                  |
| Derived RepairOrder location views   | **DERIVED ONLY** — `repair_order_line_locations` (post-consolidation), `getPhysicalStateForLine` (transitional)                                                                                                         |

**Refinement required by repository reality** (per the brief's own "document
explicitly, do not silently create a second source of truth" instruction):
`inventory_balances.reserved_quantity`/`allocated_quantity` are _projections_
of the event-sourced reservation/allocation tables, not independently
authoritative — but they are the value every invariant check (§5) and every
other domain (containers, transfers) actually reads at transaction time, for
performance (avoiding a `SUM()` over line tables on every check). They must
therefore be **kept exactly in sync, inside the same transaction, by the
reservation/allocation RPCs themselves** — never recomputed lazily, never
independently written by any other path. This is already how Phase 10A/10B
work today; this document makes it an explicit, permanent contract rather
than an implicit convention.

---

## 5. Core Invariants

**Domain of every invariant below: one stock identity bucket** =
`(organization_id, branch_id, location_id, variant_id, lot_id, serial_id)`
(NULL lot/serial coalesced to the sentinel UUID, matching the established
`inventory_balances_unique_stock_identity_uidx` convention).

| #   | Invariant                                                                                                                                                                                                                 | Enforced by                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| 1   | `on_hand_quantity >= 0`, **ALWAYS, with no exception** — Ambra does not support negative physical on-hand stock                                                                                                           | **CHECK**, ✅ ADDED (IC-1: `inventory_balances_on_hand_nonnegative`) — IC-0 live-confirmed it was genuinely absent before this. **Product-owner FINAL DECISION (IC-1 finalization pass, see `inventory-core-progress.md`'s own IC-1 change log for the date and full record)**: `inventory_settings.negative_stock_policy`'s `'allow'`/`'allow_with_approval'` values are **superseded/deprecated for on-hand behavior** — they must never bypass this CHECK or invariant #6 below. The column remains in the schema temporarily for backward-compatibility/cleanup sequencing only (retirement owned by IC-6, see the implementation plan's own IC-6 scope) — it must not be read as still meaningfully controlling canonical movement behavior.                                                                                                                                                                                                    |
| 2   | `reserved_quantity >= 0`                                                                                                                                                                                                  | **CHECK** — IC-0 live-confirmed already present (`inventory_balances_reserved_nonnegative`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 3   | `allocated_quantity >= 0`                                                                                                                                                                                                 | **CHECK** — IC-0 live-confirmed already present (`inventory_balances_allocated_nonnegative`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 4   | `allocated_quantity <= reserved_quantity`                                                                                                                                                                                 | **RPC transaction logic** (already enforced by `inventory_create_allocation`'s own row-locked check; a bare CHECK can't express "at the reservation-LINE level," which is where this actually lives)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 5   | `reserved_quantity <= on_hand_quantity` (decision #15, hard reservations)                                                                                                                                                 | **RPC transaction logic** (`inventory_create_reservation`'s own row-locked check, already correct)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 6   | No physical movement may strand a reserved/allocated commitment: a movement that would push `on_hand < reserved + allocated` at that bucket is rejected, UNLESS it is a sanctioned atomic commitment-relocation operation | **RPC transaction logic**, ✅ IMPLEMENTED (IC-1, `inventory_finalize_posting`) — the core engine itself, not a per-caller convention. **Corrected during IC-1 implementation** from this document's original `on_hand < reserved` OR `on_hand < allocated` phrasing: live-verified (`inventory_create_allocation`'s own body) that reserved and allocated are non-overlapping, ADDITIVE commitment buckets — a reservation-backed allocation decrements `reserved_quantity` by exactly the amount it increments `allocated_quantity` in the same UPDATE. The OR-of-either-alone formula is strictly weaker and was a genuine under-protection: e.g. reserved=6, allocated=4, on_hand=8 passes both `on_hand >= reserved` and `on_hand >= allocated` individually even though the true combined commitment (10) exceeds on_hand (8). Only the SUM is correct. See §6 below, also corrected to match.                                                  |     |
| 7   | Allocation cannot exceed its own reservation line                                                                                                                                                                         | **RPC transaction logic** — already enforced (Phase 10B)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 8   | Reservation cannot exceed currently-reservable physical stock (`on_hand - reserved` at reserve time, row-locked)                                                                                                          | **RPC transaction logic** — already enforced (Phase 10A)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 9   | Quantity conservation across container placement/removal (`SUM(active link qty) <= allocation_line.allocated_quantity`)                                                                                                   | **RPC transaction logic** — already enforced, live-proven under real concurrency (Phase 10C)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 10  | Container contents cannot claim a different physical location than the allocation/stock they represent                                                                                                                    | **RPC transaction logic** — already enforced (Phase 10C's own correction pass: `container.current_location_id = allocation_line.location_id` at placement time)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 11  | Cross-org mixing impossible                                                                                                                                                                                               | **RLS + explicit re-scoping in every RPC** — already the established, consistent pattern                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 12  | Branch/location ownership valid                                                                                                                                                                                           | **FK** (composite `(id, organization_id, branch_id)` pattern, already established)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 13  | Posted movement history immutable — **wording corrected, IC-2 security-boundary pass, 2026-09-15, see §7 and §9 for the full finding**                                                                                    | **trigger, but WEAKER than previously documented**: `inventory_prevent_header/line_modification` blocks any UPDATE/DELETE on a `posted`/`cancelled`/`reversed` row **unless** the session-level GUC `ambra.inventory_movement_engine = 'on'` is set — but the trigger only checks THAT the GUC is on, never WHICH columns changed. Live-proven this pass: an ordinary `authenticated` actor holding `warehouse.inventory.operate`/`.adjust`/`.reverse` (the RLS `UPDATE` policy's own `with_check` has no column restriction) can call `set_config('ambra.inventory_movement_engine','on',true)` themselves and then raw-`UPDATE` **any** column, including `document_number`, on a posted header — the trigger does not distinguish this from a canonical RPC's own internal use of the same GUC. This is a **pre-existing, not IC-2-introduced** gap (the GUC and the trigger both predate IC-2) — owned by IC-7 (see §9), not fixed in this pass. |
| 14  | Idempotent retry does not double-post                                                                                                                                                                                     | **UNIQUE INDEX** on `idempotency_key` + **RPC transaction logic** (existence check before insert) — already the established pattern                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 15  | Reversal is structurally linked to the original movement                                                                                                                                                                  | **FK** + **RPC**, ✅ IMPLEMENTED (IC-2, `inventory_reverse_movement`) — bidirectional linkage live-proven to agree; a reversal may happen at most once per original, and a reversal itself can never be reversed (product decision A, §7)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 16  | No destructive deletion of posted inventory history                                                                                                                                                                       | **RLS** (`_delete_deny` policies, already present on movement headers/lines) + **trigger**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 17  | Deterministic lock ordering                                                                                                                                                                                               | **RPC transaction logic**, formalized as a documented convention (§8) — not itself a DB mechanism, but must be followed identically by every RPC that touches more than one lockable row                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 18  | Partial transaction failure rolls back every inventory mutation                                                                                                                                                           | **Postgres transactional guarantee** — already true for every audited RPC (single PL/pgSQL function body = one transaction)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

**Explicitly NOT a bare CHECK**: invariants #4-#10 require reading a _related_
row (a reservation line, an allocation line, a container's own contents) —
Postgres CHECK constraints cannot reference another table. These remain RPC
transaction logic, matching how Phase 10A-10C already implement their own
piece of this — this document's contribution is making the **movement engine
itself** (currently the one RPC family with NO such check at all) hold to the
same standard.

---

## 6. Sanctioned Movement of Committed Stock

**Default rule (corrected during IC-1 implementation — see invariant #6's own
note above for the full derivation):**

```
available_to_move (generic physical movement) = on_hand_quantity - (reserved_quantity + allocated_quantity)
```

A generic movement request that would reduce `on_hand_quantity` below
`reserved_quantity + allocated_quantity` at that bucket is **REJECTED** by the
core engine itself (invariant #6, live-implemented in IC-1 as SQLSTATE
`P0003`). This document originally read `- allocated` only, on the theory that
reserved-but-not-allocated stock was still "available to move." That theory is
**superseded**: decision #15 (this document's own §0) establishes HARD
reservations — `reserved_quantity <= on_hand_quantity` must ALWAYS hold, with
backorder semantics explicitly out of scope — so a generic physical movement
that would push `on_hand` below outstanding `reserved_quantity` (even with
zero allocation against it) would itself violate decision #15, not merely
create an inconvenience for a future re-pointing operation. IC-1's own live
regression (`102_ic1_reserved_only_hard_invariant_test.sql`) proves the engine
rejects such a movement even when `allocated_quantity = 0`. Re-pointing a
reservation's own location without a physical move remains a separate,
un-built reservation-domain operation (out of scope until a concrete business
need arises — **do not build reserved-stock relocation speculatively**); the
point corrected here is only that the movement engine itself must never permit
a _physical_ move to strand outstanding `reserved_quantity`, exactly as it
must never permit one to strand `allocated_quantity`.

**A sanctioned operation instead performs, atomically, in ONE transaction:**

1. the physical move (through the same core movement primitive the generic
   path uses — not a separate code path),
2. the commitment relocation (updating the allocation line's own `location_id`
   to match),
3. the container pointer update, where applicable,
4. the ledger/audit entries the physical move itself produces.

**Two sanctioned operations are planned** (design only, per decision #18 — **do
not implement either in IC-1**):

1. **Whole-container relocation** (decision #17) — the container's own
   contents are, by construction, a fully-known, fully-enumerable set of
   (variant, lot, serial, quantity) — moving all of them together with the
   container's own pointer is well-defined and low-risk. Planned for IC-8/
   Phase 10E (see roadmap).
2. **Future allocated loose-stock relocation** — moving a specific allocation
   line's own stock without a container. Genuinely harder (must not
   accidentally move a _different_ allocation line's stock at the same
   bucket) and has no confirmed business requirement yet. **Design only when
   a real use case appears** — flagged as a residual open question, not
   scheduled in the IC roadmap below.

---

## 7. Reversals

**✅ IMPLEMENTED (IC-2, 2026-09-15)**. Uses the existing `original_
movement_id`/`reversal_movement_id` columns — no new columns required.

**`inventory_reverse_movement(p_movement_id uuid, p_actor_user_id uuid,
p_reason text) RETURNS jsonb`** — final signature, as implemented:

- **Which statuses may be reversed**: only `posted`. A `draft` movement is
  cancelled (`inventory_cancel_movement`, already exists), never "reversed" —
  reversal is specifically for undoing a _posted_, immutable effect.
  Rejected with SQLSTATE `P0007` (see the P0004-reserved-code note below
  for why not `P0004`).
- **Who may reverse**: same permission gate as posting
  (`warehouse.inventory.operate`), plus a mandatory reason. Actor-identity
  spoofing (`p_actor_user_id != auth.uid()`) is rejected first, `28000`,
  independent of the target movement's own existence. A genuinely
  nonexistent movement and one the actor lacks branch permission on both
  raise the identical `P0002` "not found" — this is deliberate:
  wrong-org/wrong-branch/inaccessible movements must not leak existence via
  a distinguishable error.
- **PRODUCT DECISION A (CLOSED, 2026-09-15)** — reversal-of-reversal is
  **NOT supported for MVP/pitch**: `original.reversal_movement_id IS NOT
NULL` → reject as already reversed (`P0006` at the constraint level; in
  practice the original's own `status` transitions to `'reversed'`
  atomically with `reversal_movement_id`, so this manifests live as the
  same `P0007` "not posted" rejection — `P0006` remains a defensive
  second check, not the primary path, live-verified). `movement.original_
movement_id IS NOT NULL` → reject, `P0005` — a reversal movement can
  never itself be reversed. "Undo an undo" is explicitly out of scope for
  MVP, not an open question.
- **How quantity/effects are inverted**: for every `inventory_movement_type_
effects` row the original posting applied, the reversal RPC computes the
  exact inverse (`direction` flipped; `target`/`balance_field` unchanged)
  against the same location/variant/lot/serial/unit as the original line,
  in a NEW movement header (type `900`/`KOR` — see the movement-type note
  below) linked via `original_movement_id`, posted through the SAME
  `inventory_finalize_posting` path (not a bespoke balance write) so every
  invariant (§5) is re-checked on the reversal too — **live-proven**: a
  reversal that would strand a reserved/allocated commitment is rejected
  by the identical `P0003` check, atomically, no partial writes.
  **Live discovery**: `inventory_movement_type_effects` is TYPE-level, not
  INSTANCE-level — no existing type (101/311/401/402/801) can serve as a
  correct inverse for every other type (801 needs a combined source-
  increase+destination-decrease pair that exists nowhere in the catalog).
  Resolved with a narrow, additive, fully backward-compatible extension:
  `inventory_finalize_posting` gained one new optional trailing parameter,
  `p_explicit_effects jsonb DEFAULT NULL` — NULL (every pre-existing
  caller) is byte-identical to before; non-NULL (only the reversal RPC)
  supplies per-line, per-instance effects instead of the type-catalog
  lookup. This is the same engine, not a second one.
- **Ledger entries**: created exactly as any other posting would. The
  ledger's own `effect_id` (NOT NULL, FK to `inventory_movement_type_
effects`) is populated with the ORIGINAL effect's own id (since the new
  `900` type deliberately carries zero effect rows of its own) — correctly
  traces which original effect each compensating entry undoes.
- **Document numbering**: the reversal gets its own real, sequential
  document number, live-proven distinct from the original (e.g.
  `PZ/2026/000021` reversed by `KOR/2026/000001`) — a new, minimal,
  generic, system-only document type (`KOR`, `is_correction=true`,
  `corrects_document_type_code=NULL` — generic, not one per original type)
  and movement type (`900`, `is_system=true`, `allows_manual_entry=false`)
  were added via the existing per-org seeding function (`inventory_seed_
movement_types_internal`), never reusing or mutating the original's own
  number.
- **Audit reason/comment**: **mandatory**, enforced (`NULLIF(TRIM(...), '')
IS NULL` rejects NULL and whitespace-only, `22023`), recorded verbatim in
  `inventory_movement_audit_log.reason_text`.
- **Relationship to reservations/allocations**: a reversal must itself
  respect invariant #6 (cannot strand a commitment) — **live-proven**: if
  reversing a receipt would pull `on_hand` below stock already reserved/
  allocated from it, the reversal is rejected (`P0003`) atomically, no
  partial writes, original remains `posted`, `reversal_movement_id`
  remains NULL.
- **PRODUCT DECISION B (CLOSED, 2026-09-15) — RepairOrder movement
  attribution**: IC-2 does **NOT** call `attach_repair_order_line_movement`
  for the reversal and does **NOT** create any `repair_order_line_
movement_links` row (`relation_type='reversal'` or otherwise) for it.
  `RepairOrdersService.listRepairOrderLines()`'s own `receivedQuantity`/
  `issuedQuantity`/`outstandingToReceive`/`availableForIssue` formulas are
  completely unchanged — they already, intentionally, exclude any
  `relation_type='reversal'` netting (there is no explicit linkage
  identifying which receipt/issue link a reversal reverses). Physical
  reversal is correct and complete independently of this read model.
  RepairOrder business-quantity attribution/netting for reversals remains
  an explicit, later, deliberately deferred integration concern — IC-2
  does not invent it.
- **Zone 5 compatibility (live-verified, read-only investigation per
  explicit scope)**: reversing a `receive_repair_order_stock`-created
  movement was found to make Zone 5's own `repair_order_line_locations_
ledger_sync` trigger actively corrupt `repair_order_line_locations`
  (delete-then-reinsert the same, now-physically-absent quantity at the
  same location). Fixed WITHOUT touching Zone 5 itself: the reversal RPC
  sets the same `ambra.repair_order_attribution_authoritative` GUC
  `receive_repair_order_stock`/`putaway_repair_order_stock` already use
  around their own ledger-producing calls, converting active corruption
  into disclosed, known staleness (`repair_order_line_locations` may
  continue showing quantity at a location IC-2 has physically reversed) —
  an explicit, already-planned IC-5 concern (decision #7: `repair_order_
line_locations` must become a derived projection), not resolved here.

**Never (via `inventory_reverse_movement` itself)**: delete or edit posted
business content. The reversal is always a new, forward-only, fully-audited
row. **Wording correction (IC-2 security-boundary pass, 2026-09-15)**: the
prior wording — "the original is never edited" — was technically imprecise
and is corrected here. Precisely:

- **`inventory_reverse_movement`'s own only UPDATE to the original** is
  narrowly limited to four reversal-lifecycle columns: `status`,
  `reversal_movement_id`, `reversed_by`, `reversed_at`. No quantity, type,
  source/destination, document-identity, or other business-content column
  is ever touched by this RPC — live-verified by reading its own body
  (`pg_get_functiondef`).
- **This is a statement about `inventory_reverse_movement`'s own code, not
  a database-enforced guarantee.** The backing trigger
  (`inventory_prevent_header_modification`, see invariant #13 in §5 and
  §9) does not itself restrict which columns may change once its own GUC
  gate is open — it only checks that the GUC is `'on'`. Live-proven this
  pass: because `ambra.inventory_movement_engine` is an ordinary
  session-level custom parameter (not a superuser-only setting) and the
  `inventory_movement_headers` UPDATE RLS policy imposes no `WITH CHECK`
  column restriction, any `authenticated` actor already holding
  `warehouse.inventory.operate`/`.adjust`/`.reverse` on the branch — the
  same permission required to post or reverse a movement legitimately —
  can set that GUC themselves and then raw-`UPDATE` **any** column
  (including `document_number`, quantities, or type) of **any** posted
  header, bypassing the trigger entirely. **This is a pre-existing gap,
  not introduced by IC-2** (both the GUC convention and the trigger
  predate IC-2's own work) — it is the same class of raw-write exposure
  already flagged in §9's table (previously scoped to INSERT; this pass's
  live probe additionally proves the UPDATE side). **Not fixed in this
  pass** — out of IC-2's own narrow security-boundary scope (the P0 fixed
  this pass was a brand-new capability IC-2 itself introduced;
  this is old, pre-existing infrastructure). Ownership: **IC-7**, which
  already owns the broader raw-write/RLS-hardening audit for Inventory
  Core (see §9).

---

## 7A. Receiving Consolidation

**✅ IMPLEMENTED (IC-3, 2026-09-16)**. Decision #14 (§0) — "Purchase Order
and RepairOrder receiving must share one physical receiving primitive" —
is now live.

**Canonical physical primitive**: `inventory_receive_stock(p_actor_user_id
uuid, p_organization_id uuid, p_branch_id uuid, p_lines jsonb,
p_operation_date date DEFAULT NULL, p_document_date date DEFAULT NULL,
p_external_reference text DEFAULT NULL, p_note text DEFAULT NULL,
p_idempotency_key text DEFAULT NULL) RETURNS jsonb`. `SECURITY DEFINER`,
owner `postgres`, `SET search_path TO 'public', 'pg_temp'`. Domain-agnostic
by design: knows nothing about RepairOrders, Matcher provenance, or
Purchase Orders. Each `p_lines` entry is `{variant_id, unit_id, quantity,
destination_location_id, unit_cost?, note?}` — a pre-resolved per-line
destination, not a single top-level one, because the two real wrappers
resolve destination differently (RepairOrder: one branch receiving
location for every line, via `resolve_branch_receiving_location`; PO:
per-line override falling back to the PO's own `delivery_location_id`) —
that resolution POLICY lives in each wrapper, never in the primitive.
Delegates every physical effect through the existing `inventory_create_
and_finalize` → `inventory_finalize_posting` (public, catalog-effects-
only, the frozen IC-2 contract) path — movement type is the existing
canonical `101` receipt (single destination-increase effect,
catalog-only). `inventory_finalize_posting_internal` is never called by
any IC-3 code.

**Security**: actor-identity check (`p_actor_user_id = auth.uid()`,
`28000`) and `has_branch_permission(..., 'warehouse.inventory.operate')
OR (..., 'warehouse.inventory.adjust')` (`42501`) run FIRST, before any
call into the (separately, more severely exposed — see §9's new row
below) lower engine layer. `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO
authenticated, service_role` — live-verified, no stale overload (this
function's own arity never changed across its migrations).

**Line-correlation contract**: the primitive returns `lines: [{line_number,
movement_line_id, variant_id, quantity, destination_location_id}]`,
ordered by `line_number`, in exact 1:1 input-array order — never by SKU/
variant/product code (multiple same-variant lines are valid and are
live-proven to map to distinct `movement_line_id`s, never merged). Both
wrappers correlate their own input lines to created movement lines purely
by this ordinal, matching the pre-existing convention `receive_repair_
order_stock` already used.

**Idempotency**: `inventory_movement_headers_org_idempotency_uidx` (a
pre-existing partial UNIQUE index on `(organization_id, idempotency_key)
WHERE idempotency_key IS NOT NULL`) already makes double-posting
structurally impossible, even under genuine concurrency — but `inventory_
create_draft` does not itself catch the resulting `23505`. The primitive
catches it (via `GET STACKED DIAGNOSTICS ... CONSTRAINT_NAME`, not
message-text matching) and returns the WINNING caller's now-committed
movement gracefully. **Live-proven with a genuine two-PostgreSQL-
connection race** (not merely reasoned about): Session A's call succeeded
in 46ms, held its transaction open 5s (`pg_sleep`); Session B, launched
~1.5s later with the SAME idempotency key, blocked for 3560.950ms on
Session A's uncommitted index entry, then resumed and returned the
IDENTICAL `movement_id` — zero double-post, zero raw/ugly error surfaced.
Final on-hand balance: exactly the single-receipt quantity, confirmed via
direct query.

**RepairOrder wrapper** (`receive_repair_order_stock`, refactored):
KEEPS EXACTLY its own pre-existing business rules — actor/permission
checks, branch receiving-location resolution, `source_line_id` provenance
resolution (`workshop_source_document_lines` → `repair_order_line_source_
links` → `repair_order_lines`, hard-reject on 0 or >1 candidates, wrong
org/branch, or variant mismatch), the `ambra.repair_order_attribution_
authoritative` GUC (unchanged, needed by Zone 5's own trigger regardless
of which function issues the ledger insert), the post-posting `attach_
repair_order_line_movement` + `repair_order_line_locations` upsert loop.
CHANGED ONLY the physical-posting call itself (now `inventory_receive_
stock` instead of `inventory_create_and_finalize` directly) and the
line-correlation source (the primitive's own returned array, instead of a
second `SELECT` against `inventory_movement_lines`) — one fewer query,
same correlation guarantee.

**Purchase Order wrapper** (`inventory_receive_purchase_order`,
refactored/fixed): **live-confirmed DEAD/BROKEN before this phase** — it
called `inventory_create_draft_movement`/`inventory_post_movement`,
neither of which exists in this database (`42883` on every real
invocation, confirmed via `pg_proc`); zero UI callers, zero server-action
callers reached from any component (confirmed via repo-wide grep); the
only prior test coverage was a static string-match against the migration
file's own text, never a behavioral test. Per explicit instruction not to
fake parity with behavior that never worked, this phase fixed the
physical-posting step (now `inventory_receive_stock`) while preserving
every genuine, already-correct PO business rule byte-for-byte: PO row
lock, `warehouse.procurement.manage` permission check, PO status guard
(`received`/`closed`/`cancelled` reject), per-line PO-line lock and
over-receipt rejection, destination resolution (per-line override falling
back to `delivery_location_id`), `received_quantity` increment, final
status recomputation (`received` iff no line remains open, else
`partially_received`). Also hardened as genuinely NEW IC-3 code (not an
IC-7 pre-existing-gap fix, since the prior code never had a working
security contract to weaken): added `SECURITY DEFINER` (was implicitly
INVOKER, with **zero** actor-identity check) and the same `auth.uid()`
check every sibling canonical RPC uses. **Self-caught defect, fixed before
any test exercised it**: the first refactor incremented `received_
quantity` BEFORE calling the idempotency-aware primitive, so a retry with
the same derived key would have double-counted PO received quantity even
though the physical movement stayed correctly deduplicated. Fixed by
pre-checking for an existing movement under the derived idempotency key
immediately after acquiring the PO row's own `FOR UPDATE` lock (already
present, unchanged) and BEFORE touching any PO line — this lock, not a
new mechanism, is what makes the pre-check race-safe against a genuinely
concurrent retry for the same PO.

**Generic Warehouse Movements UI decision**: **left unchanged** (Option
A). Live-verified (`createAndPostMovementAction` →
`InventoryMovementsService.createAndFinalize` → `inventory_create_and_
finalize`, reachable from `/dashboard/warehouse/inventory/movements/new`)
that the generic UI already calls the correct underlying engine directly,
with zero RepairOrder/PO coupling — routing it through the new named
primitive would be a purely cosmetic rename with no behavior change and a
real (if small) regression-testing cost, so it was not done. Documented
as a considered, deliberate decision, not an oversight.

**Lot/serial**: NOT exposed by the primitive's `p_lines` shape.
Live-verified `inventory_create_draft`'s own `jsonb_to_recordset`
extraction does not read `lot_id`/`serial_id`/`currency` from `p_lines` at
all, and `inventory_finalize_posting_internal` hardcodes `NULL::uuid` for
both when resolving/creating the balance row regardless of what a
movement line carries — a pre-existing "v1: on_hand only, lot/serial-
blind" engine limitation (already self-documented as v1 elsewhere in this
engine), not something IC-3 invents partial support for. Honestly
disclosed rather than silently worked around.

**Reference metadata**: `inventory_movement_headers.reference_type`/
`reference_id` are NOT threaded through by the primitive. Neither real
wrapper's actual (working) behavior ever set them on a receiving movement
before this phase; deliberately deferred rather than invented.

---

## 8. Global Lock-Order Convention

**One deterministic order, for every operation, regardless of domain:**

```
1. Transfer header (inventory_branch_transfers), if applicable
2. Balance row(s) — inventory_balances, sorted by stable identity
   (organization_id, branch_id, location_id, variant_id, lot_id, serial_id)
   when an operation touches MORE THAN ONE balance row in one transaction
   (e.g. a movement with both a source and destination effect)
3. Reservation line(s) — inventory_reservation_lines
4. Allocation line(s) — inventory_allocation_lines
5. Container row — inventory_containers
6. Container line row — inventory_container_lines
7. Ledger insert — inventory_stock_ledger_entries (append-only, no lock
   contention by nature, always last)
```

**Rationale**: this exact order (2→3→4→5→6) is already what Phase 10A→10B→10C
independently converged on, verified consistent across every RPC audited this
session. Extending it with **transfer header first** (new, for the
branch-transfer rebuild — a transfer touches its own header row, then
potentially two branches' own balance rows) and **an explicit sort rule for
multi-balance-row operations** (new — 801 and the future transfer-accept both
touch two distinct balance rows in one transaction; without a stable sort,
two concurrent transfers moving stock in opposite directions between the same
two buckets could deadlock) closes the two real gaps found.

**Deadlock avoidance for multi-identity operations**: when an operation needs
to lock N balance rows, it must acquire them in a single query ordered by the
full composite identity tuple (`ORDER BY organization_id, branch_id,
location_id, variant_id, lot_id, serial_id`) — never lock them one at a time
in caller-supplied order. This is a **new, explicit requirement** for IC-1 and
IC-4 (branch transfer), since no currently-audited RPC needs more than one
balance row per call.

---

## 9. Security / Raw-Write Boundary (Target)

**Goal (restated): feature modules cannot bypass Inventory Core invariants
using direct writes.**

| Table                                                                                                                                                                                                                  | Current raw-write exposure                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Target                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inventory_balances`                                                                                                                                                                                                   | GUC-gated trigger already blocks it structurally                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | **Keep** — this is the strongest mechanism available and already correct                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `inventory_movement_headers`/`_lines`                                                                                                                                                                                  | **Sharpened, IC-2 security-boundary pass, 2026-09-15**: the posting-immutability trigger backstops UPDATE/DELETE only by checking that `ambra.inventory_movement_engine='on'` — it does NOT check which columns changed. Live-proven: any `authenticated` actor holding `warehouse.inventory.operate`/`.adjust`/`.reverse` (the UPDATE RLS policy's own permission set, no `WITH CHECK` column restriction) can self-set that ordinary session GUC and then raw-UPDATE **any** column of **any** posted header — full business-content rewrite, not just a status-blind INSERT. Pre-existing (not IC-2-introduced); see §7's own corrected wording and invariant #13 in §5. | **Close in IC-7**: the trigger must be redesigned to either (a) restrict which columns may change even when the GUC is on (e.g. only allow the canonical RPCs' own known column sets via a second, non-guessable signal), or (b) move the GUC to a mechanism ordinary roles cannot set (e.g. a `SECURITY DEFINER` wrapper, or checking `session_user`/a claim only `postgres`-owned functions can assert) — a bare custom GUC name is not a security boundary. Also close the previously-flagged INSERT-side gap in the same pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `inventory_reservations`/`_lines`, `inventory_allocations`/`_lines`                                                                                                                                                    | Not audited for raw-write policy shape this pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | **Verify in IC-0**; apply Phase 10C's own RESTRICTIVE-policy pattern if a gap is found                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `inventory_containers`/`_container_lines`                                                                                                                                                                              | Generic rows: existing PERMISSIVE `ALL`; RepairOrder-owned rows: RESTRICTIVE-closed (Phase 10C correction, already done)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | **Keep as-is** — already the correct target shape                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `inventory_allocation_container_links`                                                                                                                                                                                 | SELECT + explicit `INSERT ... WITH CHECK (false)`, no UPDATE/DELETE policy (implicit deny)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | **Keep as-is** — already correct                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `inventory_branch_transfers`/`_lines` — **CLOSED IC-4, 2026-09-16**                                                                                                                                                    | Was: raw PERMISSIVE `ALL` policy (`_operate`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | **Closed.** Old PERMISSIVE `ALL` policy dropped; explicit RESTRICTIVE `USING(false)`/`WITH CHECK(false)` policies added for INSERT/UPDATE/DELETE on both tables (scoped SELECT unchanged). The same pattern was applied to the new `inventory_branch_transfer_discrepancies` table from its own creation. See §9B.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `repair_order_line_locations`                                                                                                                                                                                          | Currently written directly by Zone 5's own RPCs (by design, pre-consolidation)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Once converted to a derived projection (IC-5), **no INSERT/UPDATE/DELETE policy for any role except the maintaining trigger's own `postgres` execution context**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `repair_order_line_locations` staleness after IC-2 reversal                                                                                                                                                            | **New, IC-2-discovered**: reversing a RepairOrder-attributed receipt leaves this table stale (shows quantity at a location the canonical ledger now shows as physically empty) -- the active-corruption variant was fixed in IC-2 itself by GUC-gating the reversal's own ledger inserts, but the underlying staleness remains                                                                                                                                                                                                                                                                                                                                              | **Resolve in IC-5** -- once `repair_order_line_locations` is a genuine derived projection (not a directly-written table), a reversal's own compensating ledger entries should correctly re-derive it, closing this gap structurally rather than via a GUC workaround                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Function-level `anon` EXECUTE grants (new functions)                                                                                                                                                                   | **New, IC-2-discovered**: this database applies a default-privilege grant giving `anon` EXECUTE on functions in schema `public` -- it silently re-applies on every `CREATE OR REPLACE FUNCTION` of the SAME function, even after an explicit `REVOKE ALL FROM PUBLIC`. Live-confirmed on both `inventory_finalize_posting` (pre-existing, before IC-1/IC-2) and `inventory_reverse_movement` (re-appeared twice during IC-2's own iterative fixes, corrected with a final explicit re-grant)                                                                                                                                                                                | **Audit systematically in IC-7** -- every canonical Inventory Core RPC needs its EXECUTE grants re-verified as the LAST step after its own migration sequence is fully applied, not just once after first creation; consider whether the default privilege itself should be altered (`ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ... FROM anon`) at the schema level to close this permanently rather than per-function                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `inventory_finalize_posting`'s `p_explicit_effects` parameter (IC-2 security-boundary pass, 2026-09-15)                                                                                                                | **P0, CLOSED this pass**: the 3-arg extension IC-2 originally added to the externally-callable canonical `inventory_finalize_posting(uuid,uuid,jsonb)` was live-proven exploitable by an ordinary `authenticated` caller — supplying two different real `destination`/`increase` effect ids against their own legitimately-created draft doubled `on_hand` (10 → 20) with zero extra permission. Root cause: `p_explicit_effects` had no caller-identity restriction of its own, and the function carried live `anon`/`authenticated` EXECUTE (the same default-privilege behavior in the row above).                                                                       | **Fixed**: logic moved to a new `inventory_finalize_posting_internal(uuid,uuid,jsonb)`, `EXECUTE` revoked from every role except its owner (`postgres`); the public `inventory_finalize_posting` was restored to its original 2-arg signature (catalog effects only, no explicit-effects capability at all) as a thin wrapper; the vulnerable public-named 3-arg overload was dropped outright (a `CREATE OR REPLACE` with a NEW arity does not remove an OLD-arity overload — this project's own recurring pitfall, hit again here and fixed forward). Only `inventory_reverse_movement` (itself `SECURITY DEFINER`, owner `postgres`) can reach the internal function — ordinary Postgres same-owner `SECURITY DEFINER` privilege semantics, not a GUC/trust convention. Live-reverified: direct call to the internal function by `authenticated` → `42501`; the old 3-arg public signature → `42883` (does not exist); `has_function_privilege('anon'/'authenticated', ...) = false` on the internal function; ordinary 2-arg finalize and full reversal end-to-end unaffected. Defense-in-depth added inside the internal function itself, narrow and not a second reversal engine: (a) `p_explicit_effects` may only be supplied when the movement's own REAL `movement_type_code` — read from the locked row itself, never trusted from the caller — is exactly `'900'` (the system reversal type), categorically ruling out the exact attack proven above (which targeted a `'101'` movement) even for a hypothetical future internal caller; (b) each supplied effect's `target`/`direction` is explicitly validated against its exact allowed domain (`{source,destination}`/`{increase,decrease}`) and rejected outright rather than silently falling through the existing CASE/IF logic. (`effect_id` itself is still backstopped only by the pre-existing `inventory_stock_ledger_entries.effect_id` FK — not a new check added this pass.) |
| `inventory_create_and_finalize`/`inventory_create_draft`/public `inventory_finalize_posting` — **CRITICAL, IC-3-discovered 2026-09-16, CLOSED IC-7A 2026-09-16 (emergency pass, pulled forward out of roadmap order)** | Was: all three carried live `anon` EXECUTE and performed ZERO actor-identity or permission check of their own. Live-proven via a safe, rolled-back probe: a fully unauthenticated `anon` session posted a real, immutable movement to an arbitrary organization/branch. Full details of the original finding preserved below for historical record.                                                                                                                                                                                                                                                                                                                         | **CLOSED.** `inventory_create_draft` and `inventory_finalize_posting_internal` (the shared choke point both the public 2-arg finalize wrapper and `inventory_reverse_movement` call into) each gained the standard actor-identity (`28000`) + `has_branch_permission(...operate` OR `...adjust)` (`42501`) check. `inventory_create_and_finalize` gained the same checks directly too, as defense in depth (not merely relying on transitive protection via `inventory_create_draft`). `anon`/PUBLIC EXECUTE explicitly revoked from all three; `authenticated`/`service_role` EXECUTE KEPT (caller-graph audit found 5 real Next.js server actions and the non-`SECURITY DEFINER` `inventory_approve_count_session` call these three DIRECTLY as `authenticated` — full internalization would have broken them; hardening in place, not internalizing, was the correct fix here). Also closed: `inventory_create_draft` now rejects manual creation of `allows_manual_entry=false` movement types (currently only `900`) — a self-caught defect (an early draft of this same fix incorrectly used `is_system`, which is `true` for every seeded type including 101/401/402/801, and would have blocked all manual movement creation; corrected before any regression ran, via a same-day forward migration). Live-reverified: the exact original exploit payload replayed post-fix → `42501`, zero physical mutation. Full evidence: `docs/inventory/reviews/ic-7a-movement-engine-security-review/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

**Standing requirements for every canonical RPC (already the established
convention, restated as permanent policy):**

- `SECURITY DEFINER`, owner `postgres` (`rolbypassrls=true`, confirmed live).
- `SET search_path TO 'public', 'pg_temp'`.
- First line: `IF p_actor_user_id IS DISTINCT FROM auth.uid() THEN RAISE
EXCEPTION ... USING ERRCODE = '28000'`.
- Second: `has_branch_permission(...)` check, `ERRCODE = '42501'`.
- `REVOKE ALL ... FROM PUBLIC` **and** the separate explicit `REVOKE ALL ...
FROM anon` (both, in the same migration — learned the hard way in Phase
  10C, apply proactively everywhere going forward).
- `GRANT EXECUTE ... TO authenticated` only.
- Every org/branch/reference value re-validated against the actor's own
  resolved scope inside the function body — never trusted from a parameter
  alone, even when the caller is itself a trusted service layer.

---

## 9A. IC-7A — Emergency Movement Engine Security Boundary Closure

**✅ CLOSED (IC-7A, 2026-09-16, emergency pass — NOT the full IC-7 phase)**.
Pulled forward, out of roadmap order, because IC-3's own live verification
proved the CRITICAL finding in §9's table above: a fully unauthenticated
`anon` caller could post arbitrary physical inventory movements through
the shared engine layer. This section documents ONLY this narrow closure
— the broader IC-7 phase (header-immutability GUC bypass, reservation/
allocation raw-write RLS, container generic raw-write policies, the
systemic `anon` default-privilege re-grant behavior) remains fully OPEN
and NOT addressed here, per explicit scope.

**Reproduced live, fresh, not trusted from the prior report**: a safe,
transaction-scoped, rolled-back probe confirmed all three functions
(`inventory_create_draft`, `inventory_finalize_posting`, `inventory_
create_and_finalize`) carried live `anon` EXECUTE and performed zero
actor/permission check. Three separate exploit calls succeeded as a
genuinely unauthenticated `anon` role (no JWT claims, no `auth.uid()`).

**Caller-graph audit performed BEFORE any grant was touched** (per
explicit instruction not to revoke blindly): 5 real, reachable Next.js
server actions (`createDraftMovementAction`, `finalizePostingAction`,
`createAndPostMovementAction`, `quickReceiptAction`/`receiveStockAction`,
`quickBinMoveAction`/`transferStockAction`) call these three RPCs
DIRECTLY via `supabase.rpc(...)` as the browser session's own
`authenticated` role — not through any SQL-level wrapper. Additionally,
`inventory_approve_count_session` (the live 401/402 adjustment flow) is
itself **NOT** `SECURITY DEFINER` — its own nested calls into these
functions execute as the real, non-elevated invoking role. This ruled out
full internalization (revoking `authenticated` EXECUTE) as the fix — it
would have broken every one of these real, working flows. **Option B**
(harden in place) was the correct, caller-graph-driven choice, per this
pass's own explicit decision framework.

**Fix applied**: `inventory_create_draft` and `inventory_finalize_
posting_internal` (the single shared choke point both the public 2-arg
`inventory_finalize_posting` wrapper AND `inventory_reverse_movement`
call into — hardening here once correctly protects both callers without
duplicating the check) each gained the standard actor-identity (`28000`)

- `has_branch_permission(..., 'warehouse.inventory.operate') OR (...,
'.adjust')` (`42501`) check, matching the established pattern every other
  canonical RPC already used. `inventory_create_and_finalize` gained the
  same checks directly too, as defense in depth. `REVOKE ALL FROM PUBLIC,
anon` on all three; `authenticated`/`service_role` EXECUTE explicitly
  KEPT (required by the real caller graph above). `inventory_finalize_
posting_internal`'s own EXECUTE remains revoked from every ordinary role
  (IC-2's own frozen contract, re-verified unchanged, never reopened).

**Also closed**: `inventory_create_draft` now rejects manual creation of
any movement type with `allows_manual_entry = false` (currently only
`900`, the system reversal type) — closing the "system-only movement
types must not become manually creatable" requirement. **Self-caught
defect, fixed before any regression test ran**: the first version of this
guard used `is_system OR NOT allows_manual_entry` — live inspection
(queried `inventory_movement_types` directly) showed `is_system=true` for
EVERY seeded catalog type, including 101/401/402/801, not just 900. That
guard would have blocked ALL manual movement creation — caught by direct
live inspection before any test exercised it, corrected the same day via
a forward migration to use `allows_manual_entry` alone (the only column
that is actually `false` exclusively for `900`).

**Live-caught regression from the fix itself, also caught and fixed
before final sign-off**: `103_ic2_movement_reversal_test.sql`'s own
Scenario E (added in the prior IC-2 security-correction pass) ran AFTER
Scenario C's own permission-stripping negative test, which is a
permanent, org-wide mutation for the rest of that file's shared
transaction (the established, documented convention). Scenario E's own
`inventory_create_draft` call previously succeeded regardless of the
already-stripped actor, since `inventory_create_draft` had no permission
check to trip on before this pass. Now that it correctly does, Scenario E
was **repositioned** (not rewritten — every assertion, fixture value, and
line of its own logic is unchanged) to run immediately after Scenario D,
mirroring Scenario D's own already-established "run before Scenario C's
strip" pattern. Caught by the full regression suite itself (103 failed
with a genuine `42501` at the exact new checkpoint), diagnosed, and fixed
the same session.

**Post-fix exploit replay** (required evidence the fix genuinely closes
the live exploit, not merely the pgTAP-level assertions): the exact
original attack (unauthenticated `anon`, arbitrary org/branch, 777 units)
was replayed against the post-fix database — rejected with `42501`
(`permission denied for function`, a grant-level denial, not even
reaching the function body), zero movement headers created, zero balance
rows created.

**Deliberately NOT changed this pass** (per explicit scope, recorded for
the full IC-7 phase):

- The posted-header GUC UPDATE bypass (§9's own `inventory_movement_
headers`/`_lines` row) — its own mechanism is unrelated to this pass's
  own actor/permission boundary and was not needed to close the P0.
- `ALTER DEFAULT PRIVILEGES` for schema `public`/role `postgres` — root
  cause investigated and CONFIRMED (`pg_default_acl` shows the exact
  default-privilege rule granting `anon`/`authenticated`/`service_role`
  EXECUTE on every future function `postgres` creates in `public`), but
  NOT changed: altering it is schema-wide, not movement-engine-specific,
  and this database has other legitimate, intentionally public-facing
  RPC surfaces (QR platform, public warehouse maps) whose own reliance on
  this same default privilege was not independently audited this pass —
  changing it blind risked silently breaking unrelated, unaudited
  functionality. Per the pass's own explicit fallback instruction, this
  is reported rather than guessed at; each of this pass's own 4
  migrations instead issues its own explicit, final `REVOKE`, matching
  the already-proven-safe IC-2 pattern.
- Reservation/allocation raw-write RLS, container generic raw-write
  policies, and any other function's grants — untouched, remain full
  IC-7 scope.

**Concurrency**: no new algorithm, no new lock, no change to lock order
or which rows are locked by any of the three hardened functions — the
new checks are pure validation inserted before/immediately-after each
function's own pre-existing row acquisition. IC-1/IC-2/IC-3's own genuine
two-session concurrency proofs remain valid and were not re-run.

**Full evidence**: `docs/inventory/reviews/ic-7a-movement-engine-security-review/`.

---

## 9B. IC-4 — Branch Transfer / MMJ Rebuild

**✅ DONE (2026-09-16)**. **Corrected (2026-09-16, narrow correction
pass, same day)**: external review found `inventory_accept_branch_
transfer` unconditionally created a draft `312` movement header before
evaluating accepted quantities, leaving a permanent orphan draft (with
a discrepancy row pointing at it) whenever a receipt was 100% missing.
Fixed by gating header creation on `total_accepted > 0`, decided via a
set-based query before any mutation. The same pass also made the
explicit `p_line_acceptances` payload fail-closed (previously an
incomplete/mistyped payload silently defaulted an omitted line to full
acceptance) and fixed an audit-event metadata bug (`partial` was
derived from the shape of the input, not the RPC's own result status).
The accepted lifecycle/architecture itself was not touched. Full
evidence: `docs/inventory/reviews/ic-4-review/` (updated in place).

**Closed product-owner decision, implemented exactly**: `in_transit`
means the goods have physically left the source branch, never merely
reserved. Final lifecycle: `prepared` (reserved, not shipped) →
`in_transit` (real `311` movement posted, source `SECURITY DEFINER` RPC
`inventory_send_branch_transfer`) → `accepted` | `partially_accepted`
(real `312` movement posted for the accepted quantity, any shortfall
persisted as an `inventory_branch_transfer_discrepancies` row, never
auto-adjusted back to source) → `declined` (destination, pre-shipment
only) | `cancelled` (source, pre-shipment only, new dedicated RPC). Once
shipped, decline/cancel are hard-rejected (`P0007`) — there is no
automatic return movement; a post-shipment shortfall is represented
exclusively by partial acceptance.

**Both pre-existing accept/decline RPCs were fully rebuilt, not
patched**: live inspection (not trusted from the pre-IC-1 audit) found
both hand-wrote `inventory_movement_headers`/`_lines`/`inventory_
balances` directly, bypassing the canonical engine entirely (in addition
to `accept`'s already-known crash on a nonexistent function). Both are
now `SECURITY DEFINER`, actor/permission-checked, and post exclusively
through `inventory_finalize_posting_internal` with `p_explicit_effects=
NULL` (reusing `311`/`312`'s own type-catalog effects — IC-2's frozen
"explicit effects only for type 900" contract is untouched). A
genuinely new, previously undisclosed finding: both old RPCs carried
live `anon` EXECUTE, and `inventory_create_branch_transfer` itself never
validated `p_actor_user_id` at all — the same class of gap IC-7A closed
on the generic engine, on an entirely different set of functions IC-7A's
own narrow scope did not touch. All five branch-transfer RPCs (create/
send/accept/decline/cancel, the last two new) now carry the standard
IC-7A-grade actor-identity + permission checks and `anon`-revoked
grants.

**Movement-type catalog**: `311` (Inter-Branch Transfer Out) redefined
— zero live posted headers ever existed for it (re-confirmed live
immediately before the change), and its own pre-existing effect (source
`on_hand` decrease) was already exactly correct; only `allows_manual_
entry` flipped to `false` (system-managed — the RPC posts it directly,
bypassing `inventory_create_draft`'s own manual-entry guard, the same
pattern `inventory_reverse_movement` already uses for `900`). New `312`
(Inter-Branch Transfer In) seeded, same pattern, destination `on_hand`
increase, backfilled for all 4 existing organizations.

**Reservation handshake, proven exactly**: `inventory_send_branch_
transfer` consumes the reservation (decrements `inventory_balances.
reserved_quantity`, increments `reservation_lines.fulfilled_quantity`)
BEFORE posting the physical decrease, in the same transaction — this is
what allows the decrease down to exactly the committed boundary without
tripping IC-1's own P0003 invariant against its own reservation, and
what makes a failed post roll back the reservation consumption too (no
intermediate "unreserved but not shipped" state possible). Live-proven
worked example, exact match: on_hand=10/reserved=6 → after send:
on_hand=4/reserved=0 → after accept: destination on_hand=6.

**Raw-write RLS closed** on `inventory_branch_transfers`/`_lines` (old
permissive `ALL` policy dropped, explicit RESTRICTIVE deny added) and on
the new `inventory_branch_transfer_discrepancies` table (RPC-only write
from its own creation).

**Live-proven, all required scenarios**: full accept; partial accept
with a persisted, arithmetic-CHECK-enforced discrepancy; pre-shipment
decline and cancel (reservation released, zero movements); post-shipment
decline/cancel hard-rejected; NULL-actor and actor-impersonation
rejection on every RPC; no-permission rejection (source-side for create/
send/cancel, destination-side for accept/decline); cross-org and
same-branch rejection; `anon` EXECUTE denial on all five RPCs; raw-write
denial on all three tables as a real permissioned actor; idempotent
retry (double-send/double-accept both resolve to exactly one movement,
proven via two genuinely independent PostgreSQL connections, not merely
sequential re-calls); an unrelated commitment on the same bucket blocking
`send` (IC-1 protection, not merely inherited by assumption); same-SKU
line independence via `transfer_line_id` correlation (never SKU); the
source `311` movement's own physical reversibility via the unmodified
`inventory_reverse_movement`, explicitly distinguished from (and not
exposing) a business-level transfer-lifecycle reversal.

**Full evidence**: `docs/inventory/reviews/ic-4-review/`.

---

## 9C. IC-5 — RepairOrder Physical Projection Consolidation

**✅ DONE (2026-09-16)**.

**Three concepts, now explicit and never conflated**:

- **A. Physical stock truth**: `inventory_balances`/`inventory_stock_
ledger_entries` — unchanged, still the sole physical truth, IC-1's own
  invariants untouched.
- **B. RepairOrder business attribution**: `repair_order_line_movement_
links` — the sole attribution-history TABLE (already fully closed to
  raw writes since IC-2's own correction pass). **Corrected by the IC-5
  narrow correction pass (2026-09-16, same day)**: this doc previously
  claimed `attach_repair_order_line_movement` was the sole direct
  INSERT writer of this table — false after IC-5's own original pass,
  which added two more direct writers (`putaway_repair_order_stock` for
  `'relocation'`, the reversal-aware trigger for `'reversal'`). All
  THREE now funnel through one shared internal primitive,
  `write_repair_order_line_movement_link_internal` — see the
  correction-pass subsection below for the full writer-boundary model.
  Now carries a 4th `relation_type`, `'relocation'` (see below),
  alongside the pre-existing `'receipt'`/`'issue'`/`'reversal'`.
- **C. RepairOrder location projection**: `repair_order_line_locations`
  - `repair_order_location_attribution_uncertain` — now a genuinely
    DERIVED projection of A joined through B, never an independent source
    of truth, with a live-verified, deterministic, idempotent rebuild.

**Derivation model**: both an incremental fast path (unchanged
`receive_repair_order_stock`/`putaway_repair_order_stock` direct writes,
plus the pre-existing ledger-sync trigger's own confidence-based
inference for genuinely generic movements) AND an authoritative
deterministic rebuild (new), exactly the "healthy design uses both"
option. The rebuild formula: for every `repair_order_line_movement_
links` row, join its own `inventory_movement_line_id` to the ledger rows
that line produced at the target bucket, prorate the ledger's own
physical quantity by `applied_quantity / movement_line.quantity`,
signed by the ledger's own `direction`. `relation_type` does not need
special-casing in this formula — a `'reversal'`-typed link's own
ledger row already carries the inverted direction (from `inventory_
finalize_posting_internal`'s own explicit-effects mechanism), and a
`'relocation'`-typed link's own SINGLE movement line naturally produces
BOTH a source-decrease and a destination-increase ledger row, netting
correctly with zero extra logic.

**Reversal-awareness (closes the IC-2 staleness compromise)**: the
existing `repair_order_line_locations_ledger_sync` trigger (on
`inventory_stock_ledger_entries`, unavoidably fires for every ledger row
including reversal-generated ones) now detects a reversal (`header.
original_movement_id IS NOT NULL`), finds the ORIGINAL movement's own
corresponding line by ordinal position (`line_number` — never SKU),
mirrors its own `receipt`/`issue`/`relocation` links onto the reversal's
own movement line as new `'reversal'`-typed links (idempotent), and
calls the SAME rebuild primitive for the affected bucket(s). Rebuild-
equals-incremental holds BY CONSTRUCTION for reversal, not merely by
separate testing, since the incremental reversal path literally IS a
rebuild call. `inventory_reverse_movement` itself was NOT touched and
remains entirely RepairOrder-agnostic — all of this logic lives inside
the RepairOrder-domain trigger, which already existed and already
contained significant domain logic before this pass.

**Two genuinely new, previously undisclosed gaps found and closed** (not
merely the reversal case the phase was scoped around):

1. `attach_repair_order_line_movement` — a real, standalone, authenticated
   -callable writer of business attribution — left the projection
   completely untouched when called on its own (live-confirmed: 0 known
   rows after a real attach call). Fixed to call the SAME rebuild
   primitive for its own affected bucket, but ONLY when no authoritative
   orchestrator (receive/putaway) is already managing the same
   transaction (checked via the same GUC) — a live-caught, self-corrected
   double-write defect (see review bundle) found this exact interaction
   and fixed it forward.
2. `putaway_repair_order_stock`'s own relocations were entirely invisible
   to canonical business-attribution history (no link row written at
   all), making a full rebuild AFTER a receipt+putaway sequence
   incorrectly double-count the original receipt. Fixed by extending
   `relation_type` to include `'relocation'` and having putaway record
   its own relocation as a link, correlated to its own posted movement
   line by ordinal position (this project's own established contract,
   fixed forward after a self-caught field-matching correlation bug).

**UNKNOWN semantics, reconfirmed unchanged**: bucket-scoped (`org`,
`branch`, `location`, `variant`), never RepairOrder-scoped — a boolean
marker, sticky (never cleared by a later known contribution alone,
matching decision-accepted Zone-5 semantics), representable alongside
known contributions at the same bucket (mixed known+unknown, live-
proven). `putaway_repair_order_stock`'s own pre-existing hard-error
UNKNOWN-source gate was NOT reopened.

**Projection invariants added**: `CHECK (quantity >= 0)` on `repair_
order_line_locations` (zero live rows at the time, safe) — the rebuild
primitive never clamps a negative or over-attributed result, it raises
`P0008` (a new, project-consistent SQLSTATE for projection-reconciliation
inconsistencies). UNKNOWN marker uniqueness was already enforced (PK on
`org, branch, location, variant`).

**Raw-write closure**: both projection tables carried only a SELECT
policy (implicit-deny already in effect for INSERT/UPDATE/DELETE) —
explicit RESTRICTIVE deny policies added for self-documentation,
matching the established pattern.

**Rebuild API**: `rebuild_repair_order_projection_bucket_internal`
(internal-only, one bucket) is the single authoritative derivation
primitive; `rebuild_repair_order_location_projection` (public, actor/
permission-checked, one RepairOrder — finds every bucket that order's
own history has touched via the same ledger+links join) is the
user-callable reconciliation entry point. Rebuild-vs-incremental
equality and idempotency both live-proven. No genuine race was found
between rebuild and live receive/putaway (each locks the SAME
`inventory_balances` row every other writer already locks — no new lock
primitive), so no dedicated two-connection concurrency test was required
beyond that structural argument.

**IC-2 GUC disposition**: `ambra.repair_order_attribution_authoritative`
is NOT removed — it remains the correct, narrow "defer to the
orchestrating caller" signal, now used consistently by three callers
(receive, putaway, and — newly — a standalone attach call correctly
NOT deferring). Its own staleness-causing SIDE EFFECT (silently skipping
projection updates on reversal, forever) is eliminated: reversal is now
detected independently of the GUC's own "on" value and always triggers
a real rebuild. Full removal of the GUC itself is not warranted — it is
still doing real, correct work — and is left as-is, not scheduled for
IC-6.

**Trigger disposition**: retained and extended (§18 option A), not
replaced. The pre-existing generic-inference logic is untouched,
byte-for-byte, for the genuinely-generic-movement case.

**Live-caught defects, all fixed forward (never editing an already-
applied migration)**: (1) a redundant `putaway_repair_order_stock`
line↔movement-line correlation bug (field-value matching instead of
ordinal position), self-caught before any pgTAP ran; (2) the attach/
receive double-write interaction above, live-caught by the FULL
regression suite itself (101/104 both broke: "have 20, want 10") and
fixed forward the same session.

### IC-5 Narrow Correction Pass (2026-09-16, same day)

External review of the IC-5 diff found two issues, both closed forward
(no migration edited, no redesign):

**Finding A (BLOCKER) — reversed putaway rebuilt the wrong bucket
set.** The original reversal-aware trigger derived the buckets to
rebuild from `NEW.location_id` (the single ledger row that happened to
fire the trigger) plus `movement_line.destination_location_id` — for a
relocation reversal, BOTH of these resolve to the SAME bucket (the
destination), since the only `direction='decrease'` ledger row a
relocation reversal produces is the destination-decrease effect
(`inventory_reverse_movement` preserves `source_location_id`/
`destination_location_id` verbatim and only inverts each effect's own
direction). The trigger therefore rebuilt the destination bucket
TWICE and never rebuilt the source/receiving bucket at all — live-
reproduced exactly before any fix: after reversing a full 5-unit
putaway (Receiving→Shelf-A), physical balances correctly restored
(Receiving=5, Shelf-A=0) but the projection left Receiving stale at
its pre-reversal value (0) while Shelf-A's own row happened to read
correctly (0) only because its own two contributing ledger effects
(the original relocation's +5 and the reversal's own mirrored −5)
canceled out arithmetically, not because the right bucket was
rebuilt. **Fix**: the reversal branch now derives BOTH affected
buckets directly from the reversal movement LINE's own
`source_location_id`/`destination_location_id` columns (never from
`NEW.direction`/`NEW.location_id`), and rebuilds each exactly once
(guarded against `source = destination`). Live-reproduced fixed for
both a FULL putaway reversal (Receiving restored to 5, Shelf-A
absent/0) and a PARTIAL putaway reversal (Receiving restored from 2 to
the full 5, Shelf-B absent/0) — both cases also proven byte-identical
to a full-order rebuild. New pgTAP Scenarios Q/R in `107_...`.

**Finding B — the "attach is the sole writer" claim was false.**
After IC-5's own original pass, THREE functions directly INSERTed into
`repair_order_line_movement_links`: `attach_repair_order_line_movement`
(receipt/issue), `putaway_repair_order_stock` (relocation, added by
IC-5), and the reversal-aware trigger (reversal, added by IC-5). This
correction does not merely relabel the documentation — it creates ONE
narrow internal canonical writer,
`write_repair_order_line_movement_link_internal(repair_order_line_id,
inventory_movement_line_id, applied_quantity, relation_type,
p_require_posted default true)`, internal-only (`SECURITY DEFINER`,
hardened `search_path`, `EXECUTE` revoked from `PUBLIC`/`anon`/
`authenticated`/`service_role`, reachable only via same-owner
`SECURITY DEFINER` callers — no new client RPC exposed), and refactors
all three call sites onto it. The internal writer owns every
load-bearing GENERIC invariant that applies to every relation type
(RepairOrderLine/movement-line existence, org/branch compatibility,
posted status, variant compatibility where applicable, positive
quantity, the global per-movement-line applied-quantity cap, duplicate/
unique handling, the `relation_type` domain check). Relation-SPECIFIC
validation stays in each caller: `attach`'s own category/reference-type
checks (receipt/issue), `putaway`'s own exact ordinal correlation
(relocation), the trigger's own "mirror an already-valid original link"
trust (reversal) — none of these are reimplemented inside the shared
primitive. **Public contract frozen**: `attach_repair_order_line_
movement` still only accepts `relation_type IN ('receipt', 'issue')` —
unchanged check, re-proven live (an authenticated caller submitting
`'relocation'`/`'reversal'` is still rejected `22023`, pgTAP Scenario
S) — the system-owned relation types are reachable only through trusted
domain orchestration (putaway, the trigger), never directly by an
ordinary caller.

**Self-caught defect during this correction** (found live, before the
fix was considered final): the internal writer's own generic
`status = 'posted'` check — correct and load-bearing for `attach`/
`putaway` (both call it only against already-committed movement lines)
— broke the reversal trigger's own mirror call, because that call
fires from the ledger-row INSERT INSIDE `inventory_finalize_posting_
internal`'s own effect-application loop, which happens BEFORE that
same function flips the header's own status to `'posted'` (a pure
timing artifact, not a business-meaningful draft state — the effect is
already durably applied within the same transaction, and atomicity
guarantees the header reaches `'posted'` or the whole transaction,
including the mirrored link, rolls back together). Fixed via a narrow,
explicit `p_require_posted` opt-out parameter (default `true`,
preserving the check for every other caller unchanged — Phase-10
receipt/issue validation is NOT weakened), passed `false` only from the
trigger's own reversal-mirror call site. This required one arity
change (4 args → 5 args), handled via explicit `DROP FUNCTION` of the
old 4-arg overload before creating the 5-arg replacement, per this
project's own established forward-migration discipline.

New pgTAP: Scenarios Q (full putaway reversal, source+destination),
R (partial putaway reversal, source+destination), S (public attach
relocation/reversal rejection), T (internal writer unreachable
directly) added to `107_...` (33/33 → 46/46). Full regression 097-107
re-run, 097 specifically re-run in full (touches the Phase-10
attribution-write boundary) — see `test-evidence.md` for the complete
per-file breakdown.

**Full evidence**: `docs/inventory/reviews/ic-5-review/`.

---

## 9D. IC-6 — Legacy Writer/Helper Removal

**✅ DONE (2026-09-17)**.

**Goal**: cleanup/consolidation only — no new behavior. Identify every
legacy/superseded Inventory write/helper/config path, prove whether it
is genuinely dead (repo callers + live SQL-to-SQL callers + app
callers + intentional test/doc references, not TypeScript-compiler
non-use alone), delete/drop only confirmed-dead paths, and remove dead
compatibility/config surface that no longer represents real product
behavior. IC-0 through IC-5 and IC-7A's own accepted architecture was
NOT reopened; full IC-7, IC-8, and Phase 10D were NOT started.

**Call-graph method**: every canonical Inventory Core function was
enumerated live from `pg_proc` (org/branch/movement/receiving/
reservation/allocation/transfer/container/RepairOrder-projection
surface), classified A (canonical active) / B (canonical internal) /
C (compatibility wrapper still required) / D (confirmed dead) / E
(uncertain, therefore untouched). SQL-to-SQL callers were found via a
live `prosrc` scan across every function in `pg_proc` (not merely
name-pattern matches) — this is the mechanism that caught the stale
overload below, which a name-only audit would have missed entirely.

**1. Old `inventory_v1_get_or_create_balance` helper (§4) — DROPPED,
confirmed dead.** Re-verified live: a `prosrc` scan across every
function in the database found zero SQL callers (IC-1 had already
replaced every internal call site with `inventory_get_or_create_
balance_for_update`, the lot/serial-aware replacement). A repo-wide
grep found zero TypeScript callers — the only two repo hits were the
auto-generated `target.types.ts` type declaration (generated metadata,
not a caller) and IC-1's own historical migration text (evidence of
evolution, not a live caller). Dropped via a forward migration;
`to_regprocedure` confirmed absence live.

**2. Stale `inventory_get_or_create_balance_for_update` 5-arg overload
(§14) — DROPPED, confirmed dead.** This function carried TWO live
overloads: a 5-arg form (no lot/serial support, hardcodes `lot_id IS
NULL AND serial_id IS NULL`) and the canonical 7-arg form (`p_lot_id`/
`p_serial_id`, both `DEFAULT NULL` — IC-1's own lot/serial-aware
replacement). A live `prosrc` scan found all 6 real callers
(`inventory_create_reservation`, `inventory_create_allocation`,
`inventory_release_reservation`, `inventory_release_allocation`,
`inventory_finalize_posting_internal`, `inventory_send_branch_
transfer`) already call the 7-arg form explicitly, every time — zero
callers of the 5-arg form exist. This was a genuine landmine: because
the 7-arg form's own trailing 2 params both have `DEFAULT`s, a future
5-positional-arg call would have resolved to the OLD, lot/serial-blind
overload (Postgres prefers the exact-arity match), silently landing on
stale logic. Dropped via a forward migration; exactly one overload
remains live.

**3. `negative_stock_policy` dead configuration (§5) — Option A
chosen, column DROPPED entirely.** Re-verified the IC-1 finding is
still true: zero application (TypeScript) readers or writers (repo-
wide grep, zero hits); the column's own sole SQL reader was
`inventory_finalize_posting_internal`'s own `IF v_new_qty < 0 AND
v_settings.negative_stock_policy = 'block' THEN ...` branch. **Went
further than "still unused" — proved it UNREACHABLE**: `inventory_
balances` carries `CHECK (reserved_quantity >= 0)` and `CHECK
(allocated_quantity >= 0)`, so `reserved_quantity + allocated_quantity`
can never be negative; the P0003 "would strand committed stock" check
immediately above the dead branch fires whenever `v_new_qty < (reserved

- allocated)`, which is structurally guaranteed true whenever
`v_new_qty`is negative (a negative number is always less than a
non-negative one). The`negative_stock_policy='block'`branch could
therefore never execute, for ANY value of the column, live or
hypothetical — confirmed empirically by pgTAP 102's own Scenario C
(T7/T8), which observed SQLSTATE`P0003`(the strand-check), never the
dead branch's own bare`RAISE`, for a bare zero-commitment negative-
on-hand attempt. Fixed forward in two migrations: (1) `CREATE OR
  REPLACE` `inventory_finalize_posting_internal`removing only the
3-line dead conditional — the`SELECT \* INTO v_settings ... FOR UPDATE`statement itself was preserved byte-for-byte in its own original
position, since IC-6 must not alter locking/concurrency behavior and
that row lock serves purposes independent of this one field; (2)`ALTER TABLE inventory_settings DROP COLUMN negative_stock_policy`(its own CHECK constraint dropped automatically with it). Data-impact
proof: exactly one live row, value`'block'`(the column's own
DEFAULT) — no meaningful state lost.`'allow'`/`'allow_with_approval'`
no longer exist as a selectable value at all; IC-1's own hard invariant
(`on_hand_quantity >= 0`always,`reserved+allocated <= on_hand`
  always) is completely unchanged and unweakened.

**Regression surfaced and fixed**: the full 097-107 pgTAP regression run
(after the column drop) found that `102_ic1_reserved_only_hard_
invariant_test.sql`'s own Scenario C directly `UPDATE`d the now-dropped
`negative_stock_policy` column to prove parity between `'allow'` and
`'block'` — a genuine SQL-to-SQL caller this audit's `prosrc`-scan
methodology could not see, since raw column references from pgTAP test
files are not `pg_proc` bodies. This is a real, disclosed consequence of
Option A (column drop), not a silent breakage: the whole transaction
aborted with `42703: column "negative_stock_policy" ... does not exist`
before reaching Scenarios A/B's own tally, making the entire file
unscored. Fixed by editing the TEST FILE (not a migration — test files
are not subject to the immutable-migration rule): Scenario C's own two
`UPDATE`-then-attempt passes (policy='allow', policy='block') were
collapsed into a single unconditional pass, since there is no longer a
policy value to vary — the assertion set (rejected, SQLSTATE P0003,
on_hand unchanged, no orphan header/ledger row) is preserved, `plan(14)`
reduced to `plan(11)` (T12-T14's own redundant second pass removed, T1-
T9 renumbered as T1-T9, T10/T11 kept). Both the file's own top header
comment and Scenario C's own comment block were updated to record this
history. Re-run live: 11/11, 0 failures.

**4. Legacy movement helpers (§6) — already absent, documented only.**
`inventory_allocate_movement_number`, `inventory_create_draft_
movement`, `inventory_post_movement` are all confirmed absent from
live `pg_proc` — no DB action needed. **New, disclosed finding**: `src/
server/services/inventory-products.service.ts`'s own `createOpeningStock
Movement` private helper — called from the ACTIVE, UI-reachable
`createEnhancedProduct` (via `src/app/actions/warehouse/inventory/
index.ts`) whenever a product is created with `track_inventory` +
`opening_location_id` — calls exactly these two nonexistent RPCs
(`inventory_create_draft_movement`, `inventory_post_movement`). This is
a genuine, currently-live PRODUCTION BUG (opening-stock-on-product-
creation is currently broken, would fail with a Postgres "function does
not exist" error), NOT fixed in this phase — fixing an application bug
is out of IC-6's own explicit "no new behavior" charter. Flagged for a
separate, appropriately-scoped fix.

**5. Document-sequence/movement-number helpers (§7) — already
consolidated, documented only.** No separate numbering helper function
exists at all; the numbering logic (`inventory_document_sequences`
lookup + `FOR UPDATE` lock + increment) already lives inline, once,
inside `inventory_finalize_posting_internal` — the single canonical
posting path. §7's own goal ("only one supported numbering path") was
already satisfied before this phase began.

**6. Direct balance/ledger writers (§8) — audited, all accounted for,
one dead parallel writer found and removed.** A live `prosrc` regex scan
confirmed exactly ONE function writes `inventory_balances.on_hand_
quantity` and exactly ONE function inserts into `inventory_stock_
ledger_entries` — both are `inventory_finalize_posting_internal`,
matching accepted architecture exactly. Six functions write `reserved_
quantity`/`allocated_quantity` directly — all are the accepted Phase
10A/10B reservation/allocation engine (`inventory_create_reservation`,
`inventory_release_reservation`, `inventory_create_allocation`,
`inventory_release_allocation`, plus `inventory_finalize_posting_
internal`'s own read path and `inventory_send_branch_transfer`'s own
reservation-consumption step) — none superseded, none dead. **Finding,
corrected mid-phase**: `src/app/actions/warehouse/ambra-location-
inventory.ts` performed direct Supabase-client `.update({allocated_
quantity: ...})`/`.insert(...)` calls against `inventory_balances`/
`inventory_containers`/`inventory_container_lines`, entirely bypassing
`inventory_create_allocation`/`inventory_release_allocation`. An
initial draft of this section incorrectly judged this file "active,
required" based on a half-remembered, unverified reference to an IC-4
test comment. A fresh, independent caller-trace (grepping the exact
exported function names, not the module path) found this was WRONG:
`createLocationContainerAction`, `addItemsToContainerAction`,
`removeItemFromContainerAction`, and `relocateContainerAction` have
**zero callers anywhere in the repository** — the one real UI import
from the "ambra-location-inventory" namespace
(`src/app/[locale]/dashboard/warehouse/locations/page.tsx`) goes to a
completely different, read-only file, `ambra-location-inventory.
service.ts`, not the actions file with the writes. This matches the
implementation plan's own pre-existing IC-6 scope note, which already
named these same 4 functions as "confirmed zero UI callers, twice,
across two separate audits" — this session's own trace is a third,
independent confirmation. **Action taken**: all 4 functions, plus their
exclusively-owned zod schemas (`createContainerSchema`, `addItemsSchema`,
`removeItemSchema`, `relocateContainerSchema`) and the now-unused
`InventoryMovementsService` import, were deleted from `ambra-location-
inventory.ts` (618 → 218 lines). The remaining 3 exported functions in
that file (`deletePutawayRuleAction`, `findContainersByReferenceAction`,
`createLocationPutawayRuleAction`) are ALSO confirmed dead (zero callers)
but were deliberately RETAINED: they write to/read `inventory_putaway_
rules`/`inventory_containers` (find-only), an unrelated table outside
this phase's "Inventory Core balance/ledger writer" charter, and are not
named in the implementation plan's own IC-6 scope — removing them would
be general dead-code cleanup, not Inventory Core legacy-writer removal.
Disclosed as a retained-but-dead candidate for a future cleanup pass.
`pnpm type-check`/`pnpm lint`/`pnpm build` all re-run clean after this
deletion (0 type errors; 0 lint errors, 319 pre-existing warnings,
unchanged baseline; production build succeeded including the `/dashboard/
warehouse/locations` route). Full Vitest re-run (4500 tests) showed 32
pre-existing failures across unrelated areas (auth/invitations/sidebar/
QR-label rendering/org RLS) — confirmed via `git stash` on this one file
that all 32 fail identically without this change, i.e. pre-existing
baseline noise on this branch, not a regression introduced here.

**7. RepairOrder/Zone-5 legacy writers (§9) — clean, nothing to
remove.** Every `attach`/`putaway`/`rebuild`/`write_repair_order_line_
movement_link_internal`/`repair_order_location_attribution_sync`
function live is the CURRENT, accepted IC-5(-correction) version; no
orphaned/superseded predecessor function was found still live.

**8. GUC audit (§10) — both retained, justified, unchanged.** `ambra.
inventory_movement_engine`: set by ~20 orchestrating RPCs, read by
`inventory_guard_balance_write`/`inventory_guard_settings_write`
(direct-write guard triggers) and the posted-header immutability
triggers. **Explicitly NOT touched** — the posted-header GUC-bypass
security gap this GUC is entangled with (an ordinary permission-holding
actor can self-set it and rewrite posted-header business content) is a
known, already-disclosed FULL IC-7 finding; superficially "cleaning up"
its own surface here without fixing the actual security issue would be
misleading. `ambra.repair_order_attribution_authoritative`: readers/
setters reconfirmed as EXACTLY the accepted IC-5 set (`attach`,
`putaway`, `receive_repair_order_stock`, the reversal-aware trigger,
`inventory_reverse_movement`) — genuinely still required, unchanged.

**9. Stale overloads (§14) — one found (item 2 above), fixed; audit
otherwise clean.** Every other canonical Inventory Core function/helper
name was confirmed to carry exactly one live signature.

**10. TypeScript/application legacy paths (§16) — three findings,
none removed this phase.** `InventoryProductsService.
createEnhancedProductLegacy` (175 lines) has ZERO callers anywhere in
the repository (not even tests) — genuinely dead code, but it is
PRODUCT-creation scope, not Inventory Core movement/writer scope;
retained and disclosed rather than removed, to keep this phase's own
diff tightly scoped to the architecture this IC-phase project actually
owns. `inventory_cancel_movement` (§2's own broader function audit) —
**new, disclosed, security-relevant finding**: this function is ACTIVE
(real caller: `InventoryMovementsService.cancelMovement`, reachable
from a real server action and a real UI component,
`inventory-movement-detail-panel.tsx`) but carries `anon` EXECUTE and
performs NO actor-identity or permission check at all — the exact
class of gap IC-7A closed on `inventory_create_draft`/`inventory_
finalize_posting`/`inventory_create_and_finalize`, but on a function
IC-7A's own narrow scope did not touch. A fully unauthenticated caller
can currently cancel any DRAFT movement. Not fixed here — squarely full
IC-7's own job — flagged prominently.

**Third finding, confirmed not suspected**: `InventoryProductsService.
createOpeningStockMovement` calls `.rpc("inventory_create_draft_
movement", ...)` then `.rpc("inventory_post_movement", ...)`. A live
`pg_proc` query for these exact two names returns ZERO rows — neither
function exists under any signature; the only live functions in this
name family are `inventory_create_draft(uuid,uuid,text,jsonb,date,
date,text,text,text,text,uuid)` and `inventory_finalize_posting(uuid,
uuid)` (different names entirely, not a renamed/re-aritied match).
This is NOT dead code — the method is reachable via `createEnhanced
Product` (the live, active product-creation path, called from a real
server action) whenever any variant has `opening_quantity > 0`, and
will throw a PostgREST "function not found" runtime error when
exercised. Fixing it (repointing the calls at the correct current RPC
names/signatures) is a BUG FIX, new behavior — explicitly out of IC-6's
own "no architecture change" charter — not fixed here, flagged
prominently for a dedicated fix.

**11. Zone-5 local migration-mirroring gap (§17/§18) — Option A,
documented, not fabricated.** Confirmed live and precisely: NO locally-
mirrored migration creates the `repair_order_line_locations` or
`repair_order_location_attribution_uncertain` TABLES, creates the
`repair_order_location_attribution_sync` TRIGGER binding, or contains
the ORIGINAL `CREATE FUNCTION` for `resolve_branch_receiving_location`
or `receive_repair_order_stock` (IC-3's own locally-mirrored migration
is a `CREATE OR REPLACE`, assuming a pre-existing definition). These
objects were created by 7 live `zone5_*`-named migrations
(`zone5_receiving_location_purpose`, `zone5_repair_order_spatial_
attribution_schema`, `zone5_attribution_sync_trigger`, `zone5_
attribution_sync_trigger_max_uuid_fix`, `zone5_receive_repair_order_
stock_rpc_v2`, `zone5_putaway_repair_order_stock_rpc`, `zone5_receive_
repair_order_stock_use_canonical_attach`) that exist live but were
never locally mirrored — predates this IC-phase project's own
mirroring discipline. **Decision**: leave the gap explicitly
documented (this list) rather than fabricate a "baseline snapshot"
migration reconstructing complex historical schema/RLS/trigger state
from current live introspection — the risk of a subtle, silent
omission in a hand-reconstructed baseline was judged higher than the
cost of leaving an honestly-documented, precisely-itemized gap for a
future phase to close deliberately. No fake historical timestamps were
created.

**12. From-scratch reproducibility (§18) — confirmed BROKEN,
pre-existing, disclosed.** No local Docker/Supabase instance was
available in this environment; the check performed was the strongest
static one available: confirming, live, that the local migration tree
lacks the schema-creation statements item 11 lists. A `supabase db
reset` (or equivalent) replayed against ONLY the currently-mirrored
migration files would fail once it reached the first migration
referencing `repair_order_line_locations` (a "relation does not exist"
error), because no local migration creates that table. This is a
PRE-EXISTING condition (inherited from before this IC-phase project's
own discipline began), not something IC-6 introduced or worsened — but
it is now, for the first time, precisely itemized rather than merely
"flagged."

**13. Zero data destruction / zero residual test data.** No inventory
table was dropped (none were even candidates — every table audited
carries a confirmed accepted-architecture role). `107_...`'s own
pgTAP file continues to run inside `BEGIN...ROLLBACK`; the new `108_
ic6_legacy_cleanup_test.sql` likewise. The `negative_stock_policy`
column drop is the only data-shape change in this phase, and its own
data-impact proof (above) shows zero meaningful state lost.

**14. No locking/concurrency change.** The one behavioral edit
(`inventory_finalize_posting_internal`) preserved its own `FOR UPDATE`
lock acquisition byte-for-byte; no new lock primitive was introduced;
no dedicated concurrency test was required or performed (§23's own
"only if cleanup forces a change" condition was never triggered).

**Full evidence**: `docs/inventory/reviews/ic-6-review/`.

---

## 10. Performance Plan

- **No microservices, no event sourcing** — PostgreSQL/Supabase remains the
  canonical transactional engine for the whole Inventory Core, per explicit
  instruction.
- **Hot-path balance lookup**: already indexed
  (`inventory_balances_unique_stock_identity_uidx` and several composite
  `(organization_id, branch_id, ...)` indexes) — no change needed.
- **Movement history / list views**: already indexed on
  `(movement_id, organization_id, branch_id)` and per-location composite
  indexes on `inventory_movement_lines` — sufficient for now.
- **Container contents**: `inventory_container_lines`/`inventory_allocation_
container_links` already indexed by container/allocation-line id
  (partial, `WHERE deleted_at IS NULL`) — sufficient.
- **Transfer inbox** (a destination branch's own list of in-transit
  transfers): needs a new index on `inventory_branch_transfers
(destination_branch_id, status)` — not present today (table has almost no
  real usage yet); add in IC-4.
- **RepairOrder physical-state read**: once `repair_order_line_locations`
  becomes a derived, maintained projection (IC-5), reads become a single
  indexed lookup instead of `getPhysicalStateForLine`'s own current
  multi-query composition — a real performance win, not just an architecture
  one.
- **Branch stock views**: no dedicated view exists yet; defer until a
  concrete UI need is scoped — **do not build speculatively.**
- **Derived vs. normalized reads — explicit split**: `inventory_balances`
  itself stays normalized (it already IS the derived current-state
  projection of the ledger, kept in sync transactionally — this is correct
  and should not be further denormalized). `repair_order_line_locations`
  becomes a maintained projection (IC-5). Nothing else in this plan proposes
  a new derived table — avoid denormalizing without a measured, real
  query-shape reason, per explicit instruction.

---

## 11. Audit Trail — Ledger vs. Audit Log Boundary

**`inventory_stock_ledger_entries`**: the append-only, per-**effect** record
of _what quantity changed, on which balance field, in which direction, on
which bucket, because of which movement line_. One row per `(movement_line,
effect)` pair (already enforced via `inventory_stock_ledger_line_effect_
uidx`). This is the **quantitative** history.

**`inventory_movement_audit_log`**: the append-only record of _state
transitions and administrative actions_ on a movement (created → posted,
posted → cancelled/reversed) — actor, old/new status, a free-form `changes`
payload, `transaction_id`. This is the **procedural** history. It does not
duplicate quantities; it duplicates _who did what, when, to which header_.

**No overlap, by design**: the ledger never records an actor or a status
transition; the audit log never records a balance delta. Every canonical
operation must write **both**: a ledger entry for every quantitative effect,
and an audit-log entry for the header-level action that caused it. This
split already exists correctly in `inventory_finalize_posting`'s own body —
this document makes it an explicit, permanent contract for every future
canonical operation (reversal, branch-transfer accept/decline once rebuilt,
etc.), not merely today's convention.

**Minimum fields every canonical operation must record** (already true for
`inventory_finalize_posting`, made an explicit requirement for everything
built in IC-1 through IC-4): organization, branch, actor, timestamp,
operation/movement type, source location, destination location, variant,
lot/serial, quantity, business reference type/id, document number,
idempotency/correlation identity, reason (where the operation is a
correction/reversal/decline), original/reversal relationship (where
relevant).

---

## 12. Legal / Compliance Boundary

**No claim of Polish legal compliance is made anywhere in this document or
the implementation plan.** The following are **technical** capabilities this
architecture provides as a foundation, explicitly separated from a legal
determination:

- Sequential, per-document-type numbering (`inventory_document_sequences`) —
  technically present; whether its exact format/reset rules satisfy PZ/WZ/MM
  numbering law needs accountant/legal review.
- A `ksef_reference` column already exists on `inventory_movement_headers` —
  suggests KSeF integration was anticipated; no integration exists yet, and
  whether one is even required for Ambra's own use case is a legal/business
  question, not decided here.
- Immutable posted history + a real reversal mechanism (§7, once built) —
  technically supports a "never edit, always correct forward" audit
  posture, which is generally the right _shape_ for accounting-grade
  history, but whether it meets specific Polish retention/correction-
  document rules (e.g. correction notes, specific document types for
  reversals) requires legal verification.

**A dedicated legal-validation gate is required before any PILOT or
production claim of compliance** — tracked as an explicit, separate,
non-technical work item, out of the IC roadmap's own scope (§ Implementation
Plan).

---

## 13. What This Document Deliberately Does Not Design

Per explicit instruction, the following are **named and scoped for a later
phase**, not designed in detail here:

- The exact final shape of the "future allocated loose-stock relocation"
  operation (§6.2).
- Container split/repack/nested-container hierarchies beyond what Phase 10C
  already supports (no nesting is planned unless a real business need
  appears — restated per instruction, not to be designed speculatively).
- Phase 10D (QR), 10E (container relocation — only the _invariant_ it must
  respect is designed here, §6.1; the RPC itself is planned, not built,
  under the IC roadmap's own final gate), 10F (issue/201/WZ — only its
  movement-code slot is reserved, §Movement Catalog in the implementation
  plan).
