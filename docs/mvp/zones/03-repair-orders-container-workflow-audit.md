# Zone 3 — Container / Allocation / QR / Location Architecture Audit

**Status:** READ-ONLY AUDIT. No migrations, no application code, no Zone 3 doc changes were made while producing this file. Supabase MCP was used strictly for `SELECT`/introspection queries (`information_schema`, `pg_proc`, `pg_policies`, `pg_class`) — zero DDL/DML executed.

**Date:** 2026-09-10
**Scope trigger:** Product-owner decision (this turn) that the **full physical container workflow is now REQUIRED FOR THE PITCH**, superseding the prior turn's PILOT classification (which was based solely on the currently-active pitch script, `docs/mvp/ambra-skrypt-prezentacji.md`, containing no container/QR/allocation workflow). Per explicit instruction, this audit treats the following as PITCH scope regardless of what the old script says: Reservation, Allocation, Container, Container QR, Container location workflow, WU-from-container. Generic reversal and Legacy Stock 105/PZ-I remain PILOT (unchanged).

**Reference documents inspected (not modified):** `docs/mvp/zones/07-normal-issue-and-legacy-stock-design.md`, `docs/mvp/zones/07-normal-issue-movement-audit.md`, `docs/mvp/zones/03-repair-orders.md`, `docs/mvp/zones/03-repair-orders-implementation-plan.md`, `docs/mvp/zones/03-repair-orders-progress.md`.

**External design frame:** the SAP EWM Handling Unit / MS Dynamics License Plate / Odoo Package minimal model — one physical container identity, contents, current location, QR scan, allocation ownership, movement history, issue-from-container — explicitly excluding nested containers, wave picking, route optimization, task orchestration, weight/dimension packing.

---

## 1. Executive Conclusion

The backend has **real, live, working primitives** for reservation and allocation (RPC-orchestrated, transactional, balance-integrated) and a **schema-only, unorchestrated** primitive for containers (tables + RLS exist; zero RPCs; zero application service beyond a read-only display path). The QR platform is a mature, generic, registry-based system already used for two live target types (`warehouse.location`, `helpdesk.ticket`, `planning.task`) but has **never been extended to inventory objects** (no `inventory.container` entry). The generic movement engine already has a `container_id` column on `inventory_movement_lines` and a `current_location_id` column on `inventory_containers`, but **no live code path writes to either** — they are schema-anticipated, functionally dormant columns.

Concretely: **Reservation = LIVE VERIFIED. Allocation = LIVE VERIFIED. Container = SCHEMA READY, NOT ORCHESTRATED. Container relocation (move-whole-container) = MISSING. QR-for-container = MISSING (but the registry pattern makes it a small, well-bounded addition). WU-from-container = MISSING (WU itself doesn't exist yet, per the prior movement audit).**

The product-requested pitch chain — RepairOrderLine → Reservation → Allocation → Container → QR → Location → relocation → WU 201 → Issue history — is **roughly 40% built** (the demand/commitment half: reservation+allocation) and **roughly 0% orchestrated** on the physical/container half. Nothing here is a redesign problem: the container table shape is a reasonable match for the target model, and the QR registry is a clean extension point. The gap is entirely **missing orchestration RPCs and missing registry/link-table wiring**, not schema rework. Phase 3 can proceed, but the container workflow itself is new build, not "finish existing work" — this needs to be sized as such before commitment.

---

## 2. Current Backend Primitives (Inventory of what exists)

| Primitive             | Tables                                                  | RPCs                                                                                                              | Application service                                                                                | Status                                                                  |
| --------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Reservation           | `inventory_reservations`, `inventory_reservation_lines` | `inventory_create_reservation`, `inventory_release_reservation`                                                   | none found dedicated (RPC called directly where used)                                              | LIVE VERIFIED                                                           |
| Allocation            | `inventory_allocations`, `inventory_allocation_lines`   | `inventory_create_allocation`, `inventory_release_allocation`                                                     | none found dedicated                                                                               | LIVE VERIFIED                                                           |
| Container             | `inventory_containers`, `inventory_container_lines`     | **none**                                                                                                          | `AmbraLocationInventoryService.listContainers` (read-only, for a location inventory snapshot view) | SCHEMA READY, NOT ORCHESTRATED                                          |
| QR                    | `qr_codes`, `qr_assignments`                            | none (pure app-layer: `QrCodesService`, `QrAssignmentsService`, `target-registry.ts`, `public-token-resolver.ts`) | full CRUD/assign/revoke service, live                                                              | LIVE VERIFIED (for 3 registered target types; container not among them) |
| Location              | `warehouse_locations`                                   | n/a (direct CRUD + audits module)                                                                                 | multiple services                                                                                  | LIVE VERIFIED, mature                                                   |
| Bin-to-bin move (801) | `inventory_movement_headers/lines` via generic engine   | `inventory_create_draft`, `inventory_finalize_posting`                                                            | movement services                                                                                  | LIVE VERIFIED for on_hand only; does not touch containers               |

---

## 3. Reservation Model

Live-verified schema and RPC bodies (already confirmed in the prior movement-engine audit turn; restated here for completeness):

- `inventory_reservations`: `id, organization_id, branch_id, reservation_number, status CHECK IN ('active','partial','fulfilled','expired','cancelled'), reference_type, reference_id, reference_number, expires_at, priority, notes, created_by, cancelled_by, cancelled_at, deleted_at`.
- `inventory_reservation_lines`: `reserved_quantity, released_quantity, fulfilled_quantity, location_id (nullable at schema level; RPC enforces it), lot_id, serial_id, product_id, variant_id`.
- `inventory_create_reservation` checks `has_branch_permission(...,'warehouse.inventory.operate')`, validates `available_quantity >= requested` off `inventory_balances`, inserts header+lines, `UPDATE inventory_balances SET reserved_quantity += qty`.
- `inventory_release_reservation`: outstanding formula (verbatim) `v_remaining := reserved_quantity - released_quantity - fulfilled_quantity`. Decrements `inventory_balances.reserved_quantity` by `greatest(0, reserved_quantity - v_remaining)`; increments `released_quantity` by `v_remaining`; optional `p_cancel` sets `status='cancelled'`.
- **`fulfilled_quantity` on a reservation line already means "converted into an allocation," not "physically issued."** This is set by `inventory_create_allocation`, not by any issue movement (see §4). Any future WU flow must not re-touch this field a second time on issue — it would double-count.
- `reference_type`/`reference_id` are generic (text+uuid), so `RepairOrderLine` can be a reservation reference today with **zero schema change** — but there is no dedicated FK/link table; the relationship is untyped/inferred (see §11).

Gate: `warehouse.inventory.operate` only — no dedicated `warehouse.inventory.reserve` permission exists. Anyone who can post any inventory movement can also reserve/release. Flagged for §16 (permissions gap), not a blocker.

---

## 4. Allocation Model

- `inventory_allocations`: `id, organization_id, branch_id, allocation_number, status CHECK IN ('active','released','fulfilled','cancelled'), reservation_id (FK → inventory_reservations, ON DELETE SET NULL, nullable), reference_type, reference_id, reference_number, created_by, deleted_at`.
- `inventory_allocation_lines`: `allocated_quantity, fulfilled_quantity, reservation_line_id (nullable FK), product_id, variant_id, location_id (NOT NULL — always pinned to one bin), lot_id, serial_id`. **No `released_quantity` column** — confirmed live; `inventory_release_allocation`'s outstanding formula is `v_remaining := allocated_quantity - fulfilled_quantity`.
- **Critical live behavior**: `inventory_create_allocation`, when given `p_reservation_line_id`, performs in the same transaction:
  1. `UPDATE inventory_reservation_lines SET fulfilled_quantity += qty`
  2. `UPDATE inventory_balances SET reserved_quantity = greatest(0, reserved_quantity - qty), allocated_quantity += qty`

  This is the reservation→allocation handoff, fully live and transactional. An allocation can also be created **without** a reservation (`p_reservation_line_id` nullable) — a direct allocation, which is the more likely path for "pick this exact stock for this RepairOrderLine" without a prior soft reservation, depending on product decision (see §29 open decision).

- **Asymmetry vs. reservation**: allocation status has no `'partial'` value (reservation does). A reservation can be partially fulfilled across multiple allocations while itself staying `'active'`/`'partial'`; an allocation, once created, is binary active/released/fulfilled/cancelled per line via the quantity math, not a header-level partial state. Not a defect, just worth the product decision being aware of.
- Same reference_type/reference_id generic pattern as reservations — no RepairOrderLine FK exists yet.

Gate: same `warehouse.inventory.operate`, no dedicated allocation permission.

---

## 5. Container Model

- `inventory_containers`: `id, organization_id, branch_id, code (CHECK non-blank), type, status CHECK IN ('active','sealed','in_transit','archived'), current_location_id (NOT NULL), reference_type, reference_id (nullable generic reference), created_by, updated_by, deleted_at`.
- `inventory_container_lines`: `container_id, variant_id, unit_id, lot_id, serial_id, quantity (real physical quantity — not label metadata), deleted_at`.
- **No `'empty'` status value** exists in the CHECK constraint — see §22.
- **No RPC creates, populates, seals, relocates, or empties a container.** RLS grants direct `ALL` (insert/update/delete) to any caller holding `warehouse.inventory.operate` (see §16/§17) — meaning today a container could only be created/edited by a raw Supabase client `.insert()`/`.update()` call bypassing all business rules (no orchestration exists to bypass, in fact — there is no orchestration). No application code currently performs a write to these tables at all (only the read-only `AmbraLocationInventoryService.listContainers`, used to render a location's contents snapshot including any containers sitting in it).
- `inventory_movement_lines.container_id` (nullable uuid) **exists on the movement-line table** but `inventory_create_draft`'s `jsonb_to_recordset` line-destructuring (`variant_id, unit_id, quantity, source_location_id, destination_location_id, unit_cost, note`) **does not include `container_id`, `lot_id`, or `serial_id`** — any of these passed in `p_lines` today would be silently dropped, not persisted. Confirmed by reading the live function body directly. This is the same column-not-wired pattern already flagged for `inventory_finalize_posting`'s reserved/allocated balance fields in the prior audit.
- Consuming evidence: `AmbraLocationInventoryService`'s movement-row mapper hardcodes `containerId: null, containerCode: null` on every returned movement line — i.e. the UI already has a placeholder slot for "which container was this movement line's stock in," permanently null today because nothing populates it.

**Conclusion**: Container is the least-built of the five primitives. Schema shape is sound and matches the target Handling-Unit model reasonably well (identity, contents, one current location, generic reference). What's missing is 100% orchestration: create, add/remove lines, seal, relocate (update `current_location_id` + emit history), issue-from-container, and the QR binding.

---

## 6. QR Platform

Two tables, no Postgres functions (`proname ILIKE '%qr%'` → zero rows; QR logic is pure application TypeScript):

- `qr_codes`: `id, organization_id, token, label, notes, status ('active'|'revoked'), created_by, created_at, updated_at, deleted_at`. An **abstract label/token identity** — carries no `target_type`/`target_id` itself.
- `qr_assignments`: `id, qr_code_id (FK), organization_id, branch_id (nullable), target_type (text), target_id (uuid), assigned_by, assigned_at, revoked_by, revoked_at, revocation_reason`. This is where the generic target reference actually lives, **decoupled from the QR code entity** — a QR code can be revoked from one target and reassigned to another over its lifetime.
- **Bidirectional uniqueness enforced at the DB via partial unique indexes** (`qra_one_active_per_qr_idx`, `qra_one_active_per_target_idx`, referenced by name in `qr.service.ts`'s `mapUniqueViolation`): one active assignment per QR code, one active QR per target. A container therefore can hold exactly one live QR at a time, and re-labeling requires an explicit revoke-then-assign — this is the correct semantic for a physical relabel/replacement workflow.
- **Target registry** (`apps/web/src/server/qr/target-registry.ts`) is the single extension point. Each entry supplies: `validate()` (existence + org + soft-delete check), `requiredAssignPermission`, `requiredReadPermission`, `resolverPath()` / `resolvePathAsync()` (redirect target for a scanned QR), `getLabelContext()` (what prints on the label PDF). **Currently registered: `warehouse.location`, `helpdesk.ticket`, `planning.task`. No `inventory.container` entry exists.**
- Adding `inventory.container` as a target type is **not** a config-only/data-row change — it requires a new `QrTargetDescriptor` object in this file (a small, well-scoped TypeScript addition following the existing 3-entry pattern exactly), plus a permission constant for `requiredAssignPermission`/`requiredReadPermission` (reusing `WAREHOUSE_INVENTORY_OPERATE`/`WAREHOUSE_INVENTORY_READ` is the natural default — no new permission table row is strictly required). This is genuinely small and low-risk: the registry was clearly designed for exactly this kind of extension.
- `QrAssignmentsService.assignToTarget` enforces a **compound permission check**: caller needs both `qr.assign` (platform gate) AND the target descriptor's `requiredAssignPermission` (domain gate) — this pattern transfers directly to containers with no redesign.
- `public-token-resolver.ts` (`resolvePublicQrToken`) is the scan-to-redirect path: resolves token → qr_codes row → active assignment → registry descriptor → validated target → localized redirect path. Runs on the **service-role client** (`createServiceClient()`), by design (a scan happens before/without a session in some flows), and re-validates the target through the same registry `validate()` used elsewhere — no bypass of target-existence/soft-delete checks.
- RLS on `qr_codes`/`qr_assignments`: enabled but **not FORCED** (`relforcerowsecurity = false`), unlike `inventory_containers`/`inventory_container_lines` which **are FORCED**. This is an inconsistency worth flagging (see §16), though not a live vulnerability by itself since no service-role write path bypasses intended checks in the code read so far — `resolvePublicQrToken`'s service-role reads are read-only and pre-validated by the registry.

---

## 7. Part Label vs. Container QR

Not yet a live distinction — there is exactly one QR identity model (`qr_codes`+`qr_assignments`+registry) and it currently only targets `warehouse.location` among inventory-adjacent objects. There is no separate "part label" QR concept found anywhere in the schema or registry. If the pitch requires scanning an individual part (not a container) to identify it, that would need its own registry entry (e.g. `inventory.container_line` or a product/variant-level target) — **not currently planned or scaffolded anywhere**. Recommendation: scope the pitch to **container-level QR only** (scan the container, see its contents) unless product confirms a genuine need to scan a single loose part independent of any container — that would be new surface, not a wiring gap.

---

## 8. Location Model

- `warehouse_locations` is mature and heavily featured: hierarchical (`parent_id`, `level`), physical dimensions, `location_type`, `can_receive/can_pick/can_ship/can_reserve/can_store_inventory` flags, `status`, soft delete, and **its own legacy `qr_code text NOT NULL DEFAULT gen_random_uuid()::text` column** — a second, older, simpler QR mechanism that predates and coexists with the new `qr_codes`/`qr_assignments` platform (the new platform's `warehouse.location` target-registry entry is the _current_ way locations get QR'd; the legacy `qr_code` column appears to be a vestigial/parallel identity). This dual-QR situation on locations is an existing inconsistency, not something this turn introduces — flagged for awareness, not requiring action here.
- **`inventory_balances`** is the authoritative per-location stock ledger: `location_id (NOT NULL), variant_id (NOT NULL), lot_id, serial_id, on_hand_quantity, reserved_quantity, allocated_quantity, available_quantity, blocked, consignment`, uniquely keyed by (org, branch, location, variant, lot, serial) in practice. This is the single source of truth for "how much of X is at location Y," independent of any container.
- **`inventory_containers.current_location_id`** is a separate, second location pointer — the container's own current physical location, which is conceptually "where this box is sitting" rather than "where this stock is counted." **No code keeps these in sync.** If a container moves, nothing updates `inventory_balances.location_id` for the stock inside it, and nothing updates `current_location_id` on a stock-level move. This is the central open architecture question for §10 (source of truth) — a container-relocation RPC must decide whether it also rewrites the balance rows for everything inside the container, or whether balance stays keyed to a "container's home location" concept that never changes while the container itself is treated as the addressable unit for picking. This decision was not resolved by any code found and needs an explicit product/architecture answer before building relocation (see §29).

---

## 9. Current 801 Behavior

Live-confirmed (prior audit, restated): 801 = Bin-to-Bin Move / MMZ, category `bin_operation`, two `inventory_movement_type_effects` rows (effect_order 1: `-source.on_hand`; effect_order 2: `+destination.on_hand`). Fully generic — `inventory_finalize_posting` loops the effect rows and only supports `balance_field = 'on_hand'` (hard `RAISE EXCEPTION` otherwise). 801 today moves **on-hand stock quantity between two locations**; it has **no concept of a container** — `container_id` is not in `inventory_create_draft`'s accepted line shape (§5), so an 801 move today cannot be "move this whole container," only "move N units of variant X from location A to location B." It also never touches `inventory_containers.current_location_id` — confirmed, zero functions reference that column.

---

## 10. Container Relocation Contract

**Does not exist.** There is no RPC, trigger, or generic-engine hook that updates `inventory_containers.current_location_id`. Building "move whole container" (the pitch's explicit relocation step) requires a **new orchestration RPC** — most naturally modeled as a thin wrapper that: (a) validates the container belongs to org/branch and is in a movable status (`active`/`sealed`, not `archived`), (b) either delegates to the generic engine (one 801 draft+finalize per container line, tagging each line with `container_id` — which requires first wiring `container_id` through `inventory_create_draft`/lines, per §5) or performs the location-pointer update directly plus its own audit row, and (c) updates `inventory_containers.current_location_id` and appends to whatever audit trail is chosen (§18). This is genuinely new code, not a fix to something broken — flagged plainly as MISSING, not SCHEMA READY.

Two viable designs surfaced by this audit, to be decided by product/architecture (§29), not chosen here:

1. **Container-as-movement-carrier**: reuse 801 per contained variant, now writing `container_id` on each line; container's `current_location_id` is derived/denormalized from its lines' balances all agreeing. More consistent with the generic engine's ledger model, more moving parts.
2. **Container-as-independent-pointer**: a dedicated `inventory_relocate_container` RPC that only updates the container header + its own dedicated history rows, deliberately NOT touching `inventory_balances` (balances stay location-scoped to wherever the container physically sits, i.e. balance location_id already reflects "in that container's home bin" and doesn't need per-relocation rewriting because the container's bin is itself the addressable location). Simpler, but diverges from the generic ledger being the sole source of truth.

---

## 11. Container / Allocation Source of Truth

No FK exists between `inventory_allocation_lines` and `inventory_container_lines` today. The only structural link imaginable currently is **inferred matching** on `(variant_id, location_id, lot_id, serial_id)` — fragile, and breaks the moment two allocations or two containers share the same bin and variant. **Recommendation (not implemented): add `inventory_allocation_lines.container_id` (nullable FK → inventory_containers) and/or a link row, so "this allocation's stock lives in this container" is explicit**, not inferred. This is the single most important schema addition this audit surfaces — everything else (relocation, WU-from-container, RepairOrder read model) is easier and safer once this FK exists.

---

## 12. Exact Relationship Graph

```
RepairOrderLine
  │  (untyped: reference_type/reference_id on reservation header — NO FK, NO link table)
  ▼
Reservation (header) ──has many──▶ ReservationLine
  │  (LIVE: reservation_line.fulfilled_quantity += qty, on allocation create)
  ▼
Allocation (header, reservation_id FK, nullable) ──has many──▶ AllocationLine (location_id NOT NULL)
  │  (MISSING: no FK/link table to a Container or ContainerLine)
  ▼
Container ──has many──▶ ContainerLine (variant/lot/serial/quantity)
  │  (MISSING: current_location_id never written by any RPC)
  ▼
Location (warehouse_locations) — separately, inventory_balances.location_id is the real stock ledger key
  │  (MISSING: no QR target-registry entry for inventory.container)
  ▼
QR (qr_codes + qr_assignments, target_type='inventory.container' — does not exist yet)
  │  (MISSING entirely: WU/201 movement type doesn't exist per the prior movement audit,
  │   and even once it does, nothing wires it to consume from a specific container)
  ▼
WU (201) → repair_order_line_movement_links (EXISTS, live Zone 3 table) → Issue history
```

Existing explicit (FK/link-table) relations found live: `Allocation.reservation_id → Reservation`, `AllocationLine.reservation_line_id → ReservationLine`, `MovementLine.container_id → Container` (column exists, unused), `repair_order_line_movement_links` (Zone 3, already live, links RepairOrderLine ↔ movement lines by relation_type). Everything above the "Container" node and between "Container" and "QR" is currently either generic reference_type/reference_id (untyped) or altogether absent.

---

## 13. RepairOrder Ownership

No code found anywhere that has RepairOrder or RepairOrderLine create/touch a reservation, allocation, or container. Zone 3's domain files (`repair-orders.ts`, `repair-orders.service.ts`) contain zero references to container/allocation/reservation. Ownership today is: none — this entire chain from RepairOrderLine downward is unbuilt for Zone 3 specifically, even though the underlying reservation/allocation primitives are otherwise live and used (their live usage sites were not traced in this audit — out of scope — but confirmed unused by Zone 3).

---

## 14. Part Label Identity

Covered in §7 — no distinct identity from container QR exists today. If pitch needs per-part (not per-container) scanning, that is new scope, not a gap in existing wiring.

---

## 15. WU From Container

Cannot exist yet: WU/201 movement type itself does not exist (confirmed live-absent in the prior movement-engine audit: only 101/311/401/402/801 are seeded). Once WU exists (per the design in `07-normal-issue-and-legacy-stock-design.md`), "issue from a specific container" additionally requires: (a) the allocation↔container FK from §11, (b) `container_id` wired through `inventory_create_draft`/lines (§5/§9), and (c) a decision on whether issuing from a container decrements the container line's `quantity` (and whether that can bring a container to zero-contents → empty, §22). All three are net-new.

---

## 16. Transaction Boundaries / Permissions / RLS (combined — all three verified together)

**Permissions**: Only 4 inventory permission slugs exist: `warehouse.inventory.read`, `.operate`, `.adjust`, `.reverse` (confirmed in `packages/contracts/src/permissions.ts:114-117`). QR has 5: `qr.read`, `qr.create`, `qr.assign`, `qr.revoke`, `qr.export` (`:318-323`). **No dedicated reservation/allocation/container permission exists** — all container/allocation/reservation RPCs and the container table's RLS gate on the same `warehouse.inventory.operate` used for ordinary stock movements. This is a coarse-grained but _consistent_ model — not a defect, but means today there's no way to grant "can reserve/allocate" without also granting "can post arbitrary movements." Product should confirm this granularity is acceptable for pitch roles.

**RLS** (all confirmed live via `pg_policies`/`pg_class`):
| Table | RLS enabled | FORCED | Policies |
|---|---|---|---|
| `inventory_containers` | yes | **yes** | `_manage` (ALL, `operate`), `_select` (`read` + not-deleted) |
| `inventory_container_lines` | yes | **yes** | same shape |
| `qr_codes` | yes | **no** | insert=`qr.create`, select=`qr.read`+not-deleted, update=`qr.revoke`, delete=`false` (hard-blocked) |
| `qr_assignments` | yes | **no** | insert=`qr.assign` (org- or branch-scoped), select=`qr.read`, update=`qr.revoke`, delete=`false` |

The container tables being FORCE-RLS while the QR tables are not is an asymmetry: FORCE RLS matters specifically for table owners/superuser-ish roles bypassing RLS by default: on Supabase this mainly protects against service-role misuse patterns that forget to filter. Since `resolvePublicQrToken` deliberately and correctly uses the service-role client for anonymous scan resolution (by necessity — a scanning visitor may have no session), NOT forcing RLS there is arguably intentional/required, not an oversight. Flagged as worth an explicit one-line confirmation from whoever owns the QR platform, not as a bug to fix in this pass.

**Transaction boundaries**: Reservation/allocation RPCs are each single-transaction (`SECURITY DEFINER` plpgsql function body — Postgres wraps a single function call as one transaction by default), so create-reservation and create-allocation are atomic today. Container has no RPCs, so there is no transaction boundary to evaluate yet — this is itself a risk: once container CRUD is built directly against the table (its current RLS shape), a client-side flow doing "create container, then create N lines" one row at a time is **not atomic** — a page refresh mid-flow leaves an orphaned empty container row. This is a strong argument for building container creation as an RPC (mirroring `inventory_create_reservation`'s pattern: one call, one array of lines, one transaction) rather than continuing the current implicit "direct table CRUD" shape.

---

## 17. Concurrency

No row-locking evidence found specific to containers (no RPC exists to inspect). Reservation/allocation RPCs use `inventory_get_or_create_balance_for_update` (confirmed via the balance-resolution function name — `FOR UPDATE` row locking, lot/serial-aware), so concurrent reservation/allocation creation against the same balance row is safe today. A future container-relocation RPC should lock the container row (`SELECT ... FOR UPDATE` on `inventory_containers`) before reading/writing `current_location_id`, and if design option 1 from §10 is chosen (container-as-movement-carrier), it inherits the existing balance-row locking for free via the generic engine. No live evidence of a race condition today, because there's no live code path to race on — this is a forward-looking design requirement, not a found bug.

---

## 18. Audit Trail

Two independent audit mechanisms exist in the codebase (established in the prior movement-engine audit): `inventory_movement_audit_log` (movement-domain-specific, written by `inventory_create_draft`/`inventory_finalize_posting`) and `platform_events` via `eventService.emit()` (app-side, best-effort, the pattern Zone 3 itself uses — `workshop.repair_orders.materialized`). **Neither currently logs anything for reservation, allocation, or container create/release/relocate** — none of `inventory_create_reservation`/`inventory_release_reservation`/`inventory_create_allocation`/`inventory_release_allocation` were seen inserting into `inventory_movement_audit_log` (they touch `inventory_reservations`/`inventory_allocations`/`inventory_balances` only), and no `eventService.emit()` call site was found wrapping any of them. A container-relocation RPC needs its own explicit audit decision (§10) plus, per the established Zone 3 pattern, likely an `eventService.emit()` call for the app-level audit trail (e.g. `warehouse.container.relocated`).

---

## 19. Mobile / Scanner UX

A reusable camera-based QR scanner component already exists live (`apps/web/src/components/features/qr/qr-camera-scanner.tsx` and a second copy at `apps/web/src/components/qr/qr-camera-scanner.tsx` — two copies found, worth a dedup note but not this audit's concern) and is already used for location-assignment and audit-count flows (`assign-qr-location-dialog.tsx`, `guided-count/count-scan-trigger.tsx`). This is a **positive finding**: a container-scan-to-open-container-detail flow can reuse this component and the existing `resolvePublicQrToken` redirect path almost as-is, once `inventory.container` is registered (§6). No container-specific mobile UI exists yet.

---

## 20. RepairOrder Read Model

None of the current RepairOrder domain types (`apps/web/src/lib/types/repair-orders.ts`) or the materialization RPC/service reference reservation, allocation, or container in any way. Building the pitch chain's read-side ("show me this RepairOrderLine's reservation status, its allocated container, the container's current location") requires new query/service code that joins across `repair_order_lines` → (new link) → `inventory_reservations`/`inventory_allocations` → (new FK, §11) → `inventory_containers` → `warehouse_locations`. Nothing here exists; this is a from-scratch read-model build once the write-side link tables exist.

---

## 21. RepairOrder Close Interaction

No code found handling "what happens to an open reservation/allocation/container when its owning RepairOrder is closed/archived." This needs an explicit product decision (§29): does closing a RepairOrder auto-release any outstanding reservation/allocation for its lines (mirroring `inventory_release_reservation`/`inventory_release_allocation`'s existing release semantics), or does it leave them dangling for manual cleanup? Zone 3's existing `status` model (`open/closed/archived`, from the earlier correction pass) gives a natural hook point, but no hook exists today.

---

## 22. Empty Container

`inventory_containers.status` CHECK constraint is `IN ('active','sealed','in_transit','archived')` — **no `'empty'` value exists**. Two options for product: (a) add `'empty'` to the CHECK via a future migration (clean, explicit) or (b) infer emptiness from `SUM(inventory_container_lines.quantity) = 0` for that container without a dedicated status value (avoids a migration but pushes "is this container empty" logic into every consumer instead of the database being the source of truth). Recommendation: (a) — a status value is cheap, explicit, and matches how `sealed`/`archived` already work as first-class states. Not implemented here per the read-only constraint.

---

## 23. Container Ownership

No `owner`/`assigned_to`/`held_by` concept exists on `inventory_containers` beyond the generic `reference_type`/`reference_id` pair (which could point at a RepairOrder, but nothing sets it today) and `current_location_id`. If "ownership" means "which RepairOrder is this container reserved for," that's the same §11 FK gap. If it means "which user/tech currently has custody," that's new schema (not found anywhere) and should be scoped explicitly by product before being assumed part of pitch (§29).

---

## 24. Pitch Scope (restated per this turn's override)

Per explicit instruction, PITCH now includes: Reservation ✅ (live), Allocation ✅ (live), Container ⚠️ (schema only — needs orchestration RPCs), Container QR ❌ (needs registry entry), Container location workflow / relocation ❌ (needs new RPC + a source-of-truth decision, §10), WU-from-container ❌ (blocked on WU 201 itself not existing yet, per the separate movement-contract design). Generic reversal and Legacy Stock 105/PZ-I remain PILOT, unaffected by this turn.

---

## 25. Pilot / Later Scope

Nested containers, nesting hierarchies, weight/dimension capacity, wave picking, route optimization, warehouse task orchestration, multi-QR-per-target history/versioning UI, per-part (non-container) QR identity (§7), dedicated reservation/allocation/container permission slugs (§16), FORCE RLS parity between QR and container tables (§16), container ownership/custody tracking beyond location (§23) — all explicitly out of pitch scope per the SAP/Dynamics/Odoo minimal-model framing given this turn.

---

## 26. Required Schema Changes (for product/architecture sign-off — NOT implemented)

1. `inventory_allocation_lines.container_id` (nullable FK → `inventory_containers`) — or an explicit link table — to make allocation↔container an explicit relation instead of inferred (§11). **Highest-priority schema change.**
2. `inventory_containers.status` CHECK: add `'empty'` (§22), or explicitly decide to derive it instead.
3. A typed FK or link table from `repair_order_lines` to `inventory_reservations`/`inventory_reservation_lines`, replacing the generic `reference_type`/`reference_id` pattern for this specific relationship if stronger integrity is wanted (optional — the generic pattern technically works today, this is a robustness/query-ergonomics upgrade, not a blocker).
4. Decide and implement the `container_id`/`lot_id`/`serial_id` wiring gap in `inventory_create_draft` (§5/§9) if design option 1 (container-as-movement-carrier) from §10 is chosen.

## 27. Required Generic Engine Changes

1. `inventory_create_draft` line shape must accept `container_id` (currently silently dropped) if §10 option 1 is chosen.
2. `inventory_finalize_posting` remains untouched for on_hand-only movement effects — no engine change needed for container relocation if §10 option 2 (independent pointer) is chosen instead; the relocation RPC would sit beside the generic engine, not inside it.
3. No change needed to `inventory_create_reservation`/`inventory_create_allocation` — they already do exactly what §3/§4 need.

## 28. Required Domain (Zone 3) Changes

Net-new: a `RepairOrdersService`/RPC surface for reserving stock for a RepairOrderLine, allocating it, and (once containers are orchestrated) associating/relocating a container — plus the read-model joins from §20. None of this exists yet; sizing should treat it as new feature work layered on top of Phase 3's materialization RPC, not a Phase-3-adjacent tweak.

## 29. Open Product Decisions (blocking further design, not blocking Phase 3 itself)

1. **Container relocation model** — §10 option 1 (movement-carrier, reuses 801/engine) vs option 2 (independent pointer, dedicated RPC). This determines whether `inventory_balances` stays the sole ledger or whether container location becomes a second source of truth that must be kept consistent.
2. **Does allocation require a prior reservation for the RepairOrder flow**, or can RepairOrderLine go straight to allocation (schema already supports both — `reservation_id` is nullable on `inventory_allocations`)?
3. **RepairOrder close behavior** on outstanding reservations/allocations/containers (§21) — auto-release vs. manual.
4. **Empty container semantics** — add `'empty'` status vs. derive from line sum (§22).
5. **Container ownership/custody** — is this in scope at all for pitch, or is "current_location_id" sufficient (§23)?
6. **Per-part QR** vs. container-only QR (§7) — confirm pitch only needs container-level scanning.
7. **Permission granularity** — accept `warehouse.inventory.operate` covering reserve/allocate/container-manage for pitch, or split now (§16)?

---

## 30. Test Plan (design-only — not implemented)

Mirroring the existing pgTAP + Vitest conventions already used in Zone 3 (`apps/web/supabase/tests/09x_*.sql`, colocated `__tests__/*.test.ts`):

- pgTAP: container CRUD-via-RPC (once built) happy path; relocation RPC atomicity (container row lock, `current_location_id` update, audit row insert, all-or-nothing on failure); RLS negative tests for container tables (already FORCE-RLS, so this is mostly confirming existing policies, not new coverage); allocation↔container FK integrity (cannot allocate to a container in the wrong branch/org).
- Vitest: `RepairOrdersService` extension for reserve→allocate→container-associate call chain, mocked RPC calls exactly like `repair-orders.service.test.ts`'s existing pattern; QR registry unit test for the new `inventory.container` descriptor's `validate()`/`getLabelContext()` (mirroring the 3 existing descriptors' shape).
- Manual/mobile: scan a container QR → resolves to a container detail view showing contents + current location, reusing `qr-camera-scanner.tsx` and `resolvePublicQrToken` end-to-end.

---
