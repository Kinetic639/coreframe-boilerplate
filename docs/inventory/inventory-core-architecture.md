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
- **Movement code 311** (`requires_destination_location = false`, one-sided
  `source` effect only) has **0 posted headers ever** — dead at the
  type-catalog level; the real (broken) inter-branch transfer logic bypasses
  it entirely via hand-rolled `INSERT`s.
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

| #   | Invariant                                                                                                                                                                                                                 | Enforced by                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| 1   | `on_hand_quantity >= 0`, **ALWAYS, with no exception** — Ambra does not support negative physical on-hand stock                                                                                                           | **CHECK**, ✅ ADDED (IC-1: `inventory_balances_on_hand_nonnegative`) — IC-0 live-confirmed it was genuinely absent before this. **Product-owner FINAL DECISION (IC-1 finalization pass, see `inventory-core-progress.md`'s own IC-1 change log for the date and full record)**: `inventory_settings.negative_stock_policy`'s `'allow'`/`'allow_with_approval'` values are **superseded/deprecated for on-hand behavior** — they must never bypass this CHECK or invariant #6 below. The column remains in the schema temporarily for backward-compatibility/cleanup sequencing only (retirement owned by IC-6, see the implementation plan's own IC-6 scope) — it must not be read as still meaningfully controlling canonical movement behavior.                                                                                                                                                   |
| 2   | `reserved_quantity >= 0`                                                                                                                                                                                                  | **CHECK** — IC-0 live-confirmed already present (`inventory_balances_reserved_nonnegative`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 3   | `allocated_quantity >= 0`                                                                                                                                                                                                 | **CHECK** — IC-0 live-confirmed already present (`inventory_balances_allocated_nonnegative`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 4   | `allocated_quantity <= reserved_quantity`                                                                                                                                                                                 | **RPC transaction logic** (already enforced by `inventory_create_allocation`'s own row-locked check; a bare CHECK can't express "at the reservation-LINE level," which is where this actually lives)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 5   | `reserved_quantity <= on_hand_quantity` (decision #15, hard reservations)                                                                                                                                                 | **RPC transaction logic** (`inventory_create_reservation`'s own row-locked check, already correct)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 6   | No physical movement may strand a reserved/allocated commitment: a movement that would push `on_hand < reserved + allocated` at that bucket is rejected, UNLESS it is a sanctioned atomic commitment-relocation operation | **RPC transaction logic**, ✅ IMPLEMENTED (IC-1, `inventory_finalize_posting`) — the core engine itself, not a per-caller convention. **Corrected during IC-1 implementation** from this document's original `on_hand < reserved` OR `on_hand < allocated` phrasing: live-verified (`inventory_create_allocation`'s own body) that reserved and allocated are non-overlapping, ADDITIVE commitment buckets — a reservation-backed allocation decrements `reserved_quantity` by exactly the amount it increments `allocated_quantity` in the same UPDATE. The OR-of-either-alone formula is strictly weaker and was a genuine under-protection: e.g. reserved=6, allocated=4, on_hand=8 passes both `on_hand >= reserved` and `on_hand >= allocated` individually even though the true combined commitment (10) exceeds on_hand (8). Only the SUM is correct. See §6 below, also corrected to match. |     |
| 7   | Allocation cannot exceed its own reservation line                                                                                                                                                                         | **RPC transaction logic** — already enforced (Phase 10B)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 8   | Reservation cannot exceed currently-reservable physical stock (`on_hand - reserved` at reserve time, row-locked)                                                                                                          | **RPC transaction logic** — already enforced (Phase 10A)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 9   | Quantity conservation across container placement/removal (`SUM(active link qty) <= allocation_line.allocated_quantity`)                                                                                                   | **RPC transaction logic** — already enforced, live-proven under real concurrency (Phase 10C)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 10  | Container contents cannot claim a different physical location than the allocation/stock they represent                                                                                                                    | **RPC transaction logic** — already enforced (Phase 10C's own correction pass: `container.current_location_id = allocation_line.location_id` at placement time)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 11  | Cross-org mixing impossible                                                                                                                                                                                               | **RLS + explicit re-scoping in every RPC** — already the established, consistent pattern                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 12  | Branch/location ownership valid                                                                                                                                                                                           | **FK** (composite `(id, organization_id, branch_id)` pattern, already established)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 13  | Posted movement history immutable                                                                                                                                                                                         | **trigger** — already enforced (`inventory_prevent_header/line_modification`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 14  | Idempotent retry does not double-post                                                                                                                                                                                     | **UNIQUE INDEX** on `idempotency_key` + **RPC transaction logic** (existence check before insert) — already the established pattern                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 15  | Reversal is structurally linked to the original movement                                                                                                                                                                  | **FK** (`original_movement_id`/`reversal_movement_id`, columns exist, no RPC yet — IC-2)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 16  | No destructive deletion of posted inventory history                                                                                                                                                                       | **RLS** (`_delete_deny` policies, already present on movement headers/lines) + **trigger**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 17  | Deterministic lock ordering                                                                                                                                                                                               | **RPC transaction logic**, formalized as a documented convention (§8) — not itself a DB mechanism, but must be followed identically by every RPC that touches more than one lockable row                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 18  | Partial transaction failure rolls back every inventory mutation                                                                                                                                                           | **Postgres transactional guarantee** — already true for every audited RPC (single PL/pgSQL function body = one transaction)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

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

**Mandatory before Inventory Core is production-grade** (decision, this
brief). Uses the existing `original_movement_id`/`reversal_movement_id`
columns — no new columns required.

**`inventory_reverse_movement(p_movement_id, p_actor_user_id, p_reason)`**
(exact signature to be finalized in IC-2):

- **Which statuses may be reversed**: only `posted`. A `draft` movement is
  cancelled (`inventory_cancel_movement`, already exists), never "reversed" —
  reversal is specifically for undoing a _posted_, immutable effect.
- **Who may reverse**: same permission gate as posting
  (`warehouse.inventory.operate`), plus (recommend, confirm with product
  owner in IC-2) a mandatory reason — see audit requirement below.
- **Can an already-reversed movement be reversed again?** No — a movement with
  a non-null `reversal_movement_id` is rejected (`already reversed`,
  idempotent-safe: reversing twice must never double-compensate). A
  _reversal_ movement itself (one with a non-null `original_movement_id`) can
  be reversed once more (this is how you "undo an undo," i.e. re-apply the
  original effect) — but this needs explicit product confirmation in IC-2,
  flagged here as an open question, not assumed.
- **How quantity/effects are inverted**: for every `inventory_movement_type_
effects` row the original posting applied, create the exact inverse
  (`direction` flipped) against the same location/variant/lot/serial, in a
  NEW movement header linked via `original_movement_id`, posted through the
  SAME `inventory_finalize_posting` path (not a bespoke balance write) so
  every invariant (§5) is re-checked on the reversal too.
- **Ledger entries**: created exactly as any other posting would — the ledger
  itself needs no special-casing; its own `movement_id` naturally points at
  the reversal movement.
- **Document numbering**: the reversal gets its own real, sequential document
  number (via the existing `inventory_document_sequences` mechanism) — never
  reuses or mutates the original's own number.
- **Idempotency**: same `idempotency_key` convention as every other canonical
  writer.
- **Audit reason/comment**: **mandatory**, not optional — `p_reason` should be
  `NOT NULL` at the RPC boundary, recorded in `inventory_movement_audit_log`.
- **Relationship to reservations/allocations**: a reversal must itself respect
  invariant #6 (cannot strand a commitment) — if reversing a receipt would
  pull `on_hand` below stock already allocated from that receipt, the
  reversal is rejected with a clear error, not silently forced through.
- **Relationship to RepairOrder movement attribution**: if the original
  movement line had a `repair_order_line_movement_links` row
  (`relation_type='receipt'`), the reversal should create a symmetric
  `relation_type='reversal'` (or similar — exact `relation_type` value to be
  finalized in IC-2) row via the SAME canonical `attach_repair_order_line_
movement` RPC, never a raw insert.

**Never**: delete or edit posted history. The reversal is always a new,
forward-only, fully-audited row.

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

| Table                                                               | Current raw-write exposure                                                                                                                                     | Target                                                                                                                                                                                                    |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inventory_balances`                                                | GUC-gated trigger already blocks it structurally                                                                                                               | **Keep** — this is the strongest mechanism available and already correct                                                                                                                                  |
| `inventory_movement_headers`/`_lines`                               | INSERT/UPDATE policies exist but posting-immutability trigger backstops UPDATE/DELETE; INSERT itself is only meaningful through the canonical RPCs in practice | **Verify** INSERT policy is permission-gated only (not ownership-aware) — if a raw INSERT of a `posted`-status row is possible, close it in IC-1/IC-7 the same way Phase 10C closed its own container gap |
| `inventory_reservations`/`_lines`, `inventory_allocations`/`_lines` | Not audited for raw-write policy shape this pass                                                                                                               | **Verify in IC-0**; apply Phase 10C's own RESTRICTIVE-policy pattern if a gap is found                                                                                                                    |
| `inventory_containers`/`_container_lines`                           | Generic rows: existing PERMISSIVE `ALL`; RepairOrder-owned rows: RESTRICTIVE-closed (Phase 10C correction, already done)                                       | **Keep as-is** — already the correct target shape                                                                                                                                                         |
| `inventory_allocation_container_links`                              | SELECT + explicit `INSERT ... WITH CHECK (false)`, no UPDATE/DELETE policy (implicit deny)                                                                     | **Keep as-is** — already correct                                                                                                                                                                          |
| `inventory_branch_transfers`/`_lines`                               | Raw PERMISSIVE `ALL` policy (`_operate`) — **currently open**, though inert since nothing calls it raw today                                                   | **Close with RESTRICTIVE policies** as part of IC-4 (the branch-transfer rebuild), same pattern as Phase 10C                                                                                              |
| `repair_order_line_locations`                                       | Currently written directly by Zone 5's own RPCs (by design, pre-consolidation)                                                                                 | Once converted to a derived projection (IC-5), **no INSERT/UPDATE/DELETE policy for any role except the maintaining trigger's own `postgres` execution context**                                          |

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
