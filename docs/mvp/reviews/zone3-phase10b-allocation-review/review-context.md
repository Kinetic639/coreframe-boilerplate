# Zone 3 Phase 10B Allocation Integration — Review Context

Baseline: `HEAD` `6e06330b` (Phase 9 + Phase 10 FINAL + Phase 10's write-boundary correction + Phase 10A FINAL + Phase 10A's UI/cache correction, all committed). Diff: `zone3-phase10b-allocation.diff` (1903 lines, 152742 bytes, 8 files). Manifest: `changed-files.md`. No `migration-summary.md` — no migration was created in either version of this phase.

**This is the SECOND version of this document.** The allocation architecture described in §A-§X below is **ACCEPTED** from the first review round. This version adds §Y, documenting a narrow, external-review-driven domain-integrity correction pass (2026-09-14) that hardened `allocateForLine`/`listAllocationsForLine`/`listReservationsForLine` with an exact reservation-line-variant identity check — no generic engine change, no schema change, no UI change.

Phase 10A and its correction pass are **ACCEPTED and FINAL**. This phase wires a RepairOrderLine's existing reservation into the _existing, live, generic_ inventory allocation engine (`inventory_create_allocation`), with reservation-backed allocation enforced as a **hard Zone 3 invariant** — the platform's own direct-allocation-without-reservation path (`reservation_line_id` omitted) exists and remains available to other callers, but is never exercised by this domain. Nothing in the generic allocation engine was changed, in either review round.

## A. Baseline

`HEAD 6e06330b` ("phase 10a"), confirmed genuinely committed (not assumed) via `git log -1` and a clean `git status --porcelain` at the start of this pass. This is Phase 9 + Phase 10 (base scope) + Phase 10's write-boundary correction + Phase 10A (base scope) + Phase 10A's own UI/cache correction pass, all as one real commit.

## B. Live `inventory_create_allocation` contract

Inspected via `pg_get_functiondef`, not assumed from the plan's own prior text:

- **`SECURITY INVOKER`** (`prosecdef = false`), owner `postgres` — same security model as Phase 10A's reservation RPCs, materially different from Phase 10's own `SECURITY DEFINER` movement RPC. RLS on `inventory_allocations`/`inventory_allocation_lines` genuinely governs every call.
- **Signature**: `(p_organization_id uuid, p_branch_id uuid, p_lines jsonb, p_reservation_id uuid DEFAULT NULL, p_reference_type text DEFAULT NULL, p_reference_id uuid DEFAULT NULL, p_reference_number text DEFAULT NULL, p_actor_user_id uuid DEFAULT NULL) RETURNS jsonb`.
- **Correcting the plan's own prior assumption**: the line-level reservation link is `reservation_line_id`, a field **inside each element of the `p_lines` jsonb array** — there is no top-level `p_reservation_line_id` parameter. The top-level `p_reservation_id` sets the allocation _header's_ own `reservation_id` column (a real FK to `inventory_reservations(id)`, `ON DELETE SET NULL`) — informational/grouping, not what drives the handshake.
- **The handshake, when `reservation_line_id` is present in a line** (verbatim, from the function body): `UPDATE inventory_reservation_lines SET fulfilled_quantity = fulfilled_quantity + qty WHERE id = ...` then `UPDATE inventory_balances SET reserved_quantity = greatest(0, reserved_quantity - qty), allocated_quantity = allocated_quantity + qty WHERE id = ...` — both inside the RPC's own transaction, both under `FOR UPDATE` locks (the reservation line's own row lock; the balance row via `inventory_get_or_create_balance_for_update`).
- **When `reservation_line_id` is absent**: a direct allocation — checks `available_quantity >= quantity` on the balance and only increments `allocated_quantity`. This path exists in the generic engine and is **never used** by `RepairOrdersService.allocateForLine` (see §D).
- **Permission gate**: `has_branch_permission(p_organization_id, p_branch_id, 'warehouse.inventory.operate')` — same slug as reservations, no new permission needed.
- **Variant check**: the RPC validates the allocation line's own `variant_id` is active/non-deleted and belongs to `p_organization_id` — but does **not** cross-check it against the reservation line's own `variant_id` (see §E).

## C. RLS / security

`pg_policies` inspected directly for both allocation tables — identical two-policy shape to the reservation tables (confirmed the same pattern, not assumed by analogy):

| table                        | policy                               | cmd    | predicate                                                                                 |
| ---------------------------- | ------------------------------------ | ------ | ----------------------------------------------------------------------------------------- |
| `inventory_allocations`      | `inventory_allocations_operate`      | ALL    | `has_branch_permission(org, branch, 'warehouse.inventory.operate')`                       |
| `inventory_allocations`      | `inventory_allocations_select`       | SELECT | `(deleted_at IS NULL) AND has_branch_permission(org, branch, 'warehouse.inventory.read')` |
| `inventory_allocation_lines` | `inventory_allocation_lines_operate` | ALL    | `has_branch_permission(org, branch, 'warehouse.inventory.operate')`                       |
| `inventory_allocation_lines` | `inventory_allocation_lines_select`  | SELECT | `has_branch_permission(org, branch, 'warehouse.inventory.read')`                          |

Effective SELECT boundary: `.operate` **OR** `.read` (permissive policies OR together), exactly matching the reservation tables and the already-corrected Phase 10A documentation on this point.

## D. Reservation-first invariant

`RepairOrdersService.allocateForLine` **always** sets `reservation_line_id` inside `p_lines[0]` — there is no code path in this service that omits it. The generic engine's own direct-allocation capability remains available to other, non-RepairOrder callers of the same RPC elsewhere in the platform; it was not removed, disabled, or otherwise touched.

## E. Ownership verification — reused, not reinvented

Before calling the RPC, `allocateForLine`:

1. Resolves the RepairOrderLine's own authoritative scope (`resolveRepairOrderLineScope`, unchanged from Phase 10A).
2. Reads the target `reservationLineId` row directly (`inventory_reservation_lines`).
3. Reads that row's own parent reservation header (`inventory_reservations`).
4. Verifies the header's `organization_id`/`branch_id`/`reference_type`/`reference_id` genuinely match the caller's own resolved RepairOrderLine scope — the exact same ownership-check shape `releaseReservationForLine` already established in Phase 10A, reused rather than reinvented.
5. On any mismatch (wrong RepairOrderLine, wrong org, wrong branch, or genuinely missing), returns the same generic `"Reservation line not found"` either way — no existence leak.

**A genuine correctness/security finding, disclosed and designed around**: `pg_get_functiondef` showed the engine does **not** itself cross-check that an allocation line's `variant_id`/`location_id` agrees with its own `reservation_line_id` — it updates the balance row keyed by whatever `p_lines` supplies, independent of the reservation line's own true location/variant. If `allocateForLine` had accepted a client-supplied `locationId` (as the plan's own illustrative signature suggested), a mismatched value would silently decrement `reserved_quantity` on a balance row the original reservation never actually incremented, corrupting it — a correctness defect, not just a security one. **Fix**: `allocateForLine` derives `variant_id`/`location_id`/`lot_id`/`serial_id` directly from the reservation line's own row, never from client input. This is a deliberate, disclosed deviation from the plan's own prior illustrative `{ ..., locationId, ... }` signature — not a generic-engine change, and not a silent redesign.

**A second, independent, engine-level defense was found live** (not assumed): `inventory_balances` carries a real composite FK, `(location_id, organization_id, branch_id) -> warehouse_locations(id, organization_id, branch_id)`. A location genuinely belonging to a different branch than `p_branch_id` is rejected with `23503` before the RPC ever reaches its own reservation-line lookup — discovered while building this bundle's own pgTAP cross-branch test (T17), which needed a real, branch-b-scoped location fixture specifically to isolate the assertion it makes (a `reservation_line_id` branch mismatch) from this separate, earlier check.

## F. RepairOrderLine → ReservationLine → AllocationLine relationship

The authoritative relational chain, per this phase's own explicit instruction not to add a redundant RepairOrderLine FK to either allocation table:

```
RepairOrderLine.id
  = inventory_reservations.reference_id (reference_type='repair_order_line')
    → inventory_reservation_lines (reservation_id)
      → inventory_allocation_lines (reservation_line_id, a real FK, ON DELETE SET NULL)
        → inventory_allocations (allocation_id)
```

`listAllocationsForLine` reads exactly this chain (two bounded queries: this line's own reservation-line ids, then allocation lines filtered by those ids + org/branch). No RepairOrderLine FK was added anywhere. Already indexed: `inventory_allocation_lines_reservation_line_id_idx` (LIVE VERIFIED to already exist — no migration needed for this read path).

## G. Allocation cardinality

No 1:1 assumed anywhere. LIVE VERIFIED: no uniqueness constraint restricts `inventory_allocation_lines.reservation_line_id` — one reservation line can have many allocation lines (pgTAP T10/T12, a second, independent allocation against the same reservation line, verified 2 distinct rows summing correctly). `listAllocationsForLine` returns a flat array (not grouped by allocation header — each line already carries its own parent allocation's number/status inline), explicitly not assuming any particular cardinality.

## H. Balance handshake — proven live

pgTAP T4/T5: `inventory_balances.reserved_quantity` decreases by exactly the allocated amount; `allocated_quantity` increases by exactly the allocated amount. Proven against a real balance row, real RPC, not asserted from reading the function body alone.

## I. Reservation-fulfilled handshake — proven live

pgTAP T3: `inventory_reservation_lines.fulfilled_quantity` increases by exactly the allocated amount. T9/T11: the reservation's own outstanding formula (`reserved - released - fulfilled`) reflects this correctly, both mid-way (partial) and at full exhaustion.

## J. Allocation read model

`listAllocationsForLine` returns `RepairOrderLineAllocationLine[]`: `id, allocationId, allocationNumber, allocationStatus, reservationLineId, variantId, locationId, lotId, serialId, allocatedQuantity, fulfilledQuantity, outstandingQuantity`. Defensively filters out a soft-deleted allocation header (`deleted_at !== null`) rather than relying on RLS alone — LIVE VERIFIED the `ALL`/`.operate` policy has no `deleted_at` check of its own (the same asymmetry Phase 10A's reservation read model already defends against identically).

## K. Outstanding formula

`outstandingQuantity = allocated_quantity - fulfilled_quantity` — LIVE VERIFIED from `inventory_release_allocation`'s own body (this table has **no** `released_quantity` column, unlike reservation lines). Proven live, pgTAP T8.

## L. Partial allocation

Proven live (pgTAP T2/T10): a 10-unit reservation line is allocated 4, then the remaining 6, across two separate `inventory_create_allocation` calls — both succeed, both correctly update the same reservation line's `fulfilled_quantity` cumulatively (0→4→10) and the same balance row cumulatively.

## M. Over-allocation

Proven live (pgTAP T13/T14): with the reservation line fully exhausted (outstanding 0), attempting to allocate even 1 more unit is rejected by the real RPC (`P0001`, "Allocation exceeds remaining reservation quantity"), and T14 confirms no partial write — the allocation-line count for that reservation line is unchanged.

## N. Same-SKU independence

Proven live (pgTAP T15/T16): a second RepairOrderLine sharing the same variant/SKU reserves and allocates its own, fully independent quantity; the first line's own allocation state (line count, sum) is completely unaffected — never merged, never inferred by SKU.

## O. Location validation

See §E for the two independent findings (the engine's own composite FK on `inventory_balances`, and the deeper variant/location-derivation design decision). The RepairOrder path cannot select a cross-branch location: it never accepts a client-supplied location at all — the location is always the one the reservation itself was pinned to at reserve time (Phase 2's own "hard reservations require location_id" rule, established in Phase 10A).

## P. Permission checks

`warehouse.inventory.operate` reused as-is (no new slug), matching decision 5 and the existing (Warehouse-module) allocation-adjacent convention. pgTAP T18 proves permission denial live after stripping the grant.

## Q. Error normalization

`normalizeAllocationRpcError` — an 8-entry code+message-pattern allowlist, every message copied verbatim from `pg_get_functiondef` output (not guessed): `Missing warehouse.inventory.operate permission`, `At least one allocation line is required`, `Allocation quantity must be positive`, `Allocation variant is not active`, `Reservation line not found for allocation`, `Allocation exceeds remaining reservation quantity`, `Insufficient available stock to allocate`, `Unable to lock inventory balance row` (shared with reservations via the common balance-lock helper).

## R. Event/audit decision

One new Mode-A event, `workshop.repair_orders.allocation_created`, genuinely new (no prior allocation event existed in the registry). Matches the exact shape of Phase 10A's own reservation events.

## S. UI decision

**None built.** The accepted Phase 10B plan's own "Repository areas affected"/"Implementation tasks" sections never called for a UI (service + read-model + tests only) — confirmed against the current plan/progress docs before writing any code, per the explicit "do not invent a large allocation interface merely because Phase 10A had a minimal reservation popover" instruction. Two server actions were added (matching the plan's own explicit "expose allocation through the current Workshop server-action pattern" requirement) but no hooks and no component were built on top of them — they are consumable by a future UI without further service/action-layer changes. UI ownership is recorded for the later Magazyn/Phase 11 surface.

## T. Cache/invalidation

Not applicable — no client-side query hooks were added this phase (see §S).

## U. Concurrency assurance

**Sequential only, honestly disclosed.** pgTAP's single-connection limitation means the over-allocation rejection (T13) and the partial-allocation sequence (T10) prove correct behavior along a real sequence of calls, not genuine multi-session concurrent access. The row-locking guarantee (`FOR UPDATE` on both the reservation line and the balance row, inside the RPC's own transaction) is inspected and relied upon, not independently re-proven under real concurrency — matching Phase 10A's own precedent and this project's standing Phase 3/Phase 15 precedent for the same class of limitation.

## V. Regressions

`098_repair_order_line_reservation_phase10a_test.sql` re-run live, byte-for-byte unmodified: 17/17, unaffected (re-confirmed again after the domain-integrity correction pass, §Y). `097_repair_order_line_movement_attach_phase10_test.sql` (Phase 10 write boundary) reconfirmed 29/29 earlier in this same session; not re-run a second time in either pass since nothing in Phase 10B touched any RPC, RLS policy, or migration it depends on. Scoped Vitest regression (Zone 3 + CRM sibling + Inventory-movement suites, including the Workshop actions test file, 18 files): 273/273 passing pre-correction, **279/279 passing after the correction pass** (§Y, +6 new tests).

## W. Phase 10C boundary

Confirmed not crossed: no `inventory_containers`, container RPC, `inventory_allocation_container_links`, `'empty'` container status, container ownership, or container QR work was touched, read, or modified.

## X. Zone 5 boundary

Confirmed not crossed: `repair_order_line_locations`, `repair_order_location_attribution_uncertain`, the Zone 5 sync trigger, `receive_repair_order_stock`, `putaway_repair_order_stock`, and any `pitch/zone5-receiving`-branch file were not read, called, or modified. No new overlap was discovered beyond what was already recorded in the Phase 10 write-boundary correction's own change-log entry.

## Y. Domain-integrity correction (2026-09-14) — reservation-line variant identity

### Y.1 The finding, verified before any code change

External review's hypothesis: a reservation can correctly reference a RepairOrderLine at the HEADER level (`reference_type='repair_order_line'`, `reference_id=L.id`) while one of that reservation's own LINES carries a variant different from `L`'s own `variant_id`. The existing ownership checks (org/branch/`reference_type`/`reference_id`) never compared `reservationLine.variant_id` to the RepairOrderLine's own authoritative variant.

Verified by direct code inspection, item by item, before writing any fix:

- **A. `resolveRepairOrderLineScope` has the authoritative variant** — confirmed: it returns `variantId: line.variant_id` from `repair_order_lines`, already used by `reserveForLine` to always write the correct variant at reserve time.
- **B. `allocateForLine` never compared `reservationLine.variant_id` to `scope.variantId`** — confirmed by reading the method: the ownership check verified `organization_id`/`branch_id`/`reference_type`/`reference_id` only; `reservationLine.variant_id` was passed straight into `p_lines[0].variant_id` for the RPC call with no cross-check against `scope.variantId` anywhere.
- **C. `listAllocationsForLine` reached allocation lines through every reservation-line id matching the header reference, with no independent variant filter** — confirmed: the method selected `inventory_reservation_lines(id)` (not even `variant_id`) and collected every id unconditionally.
- **D. The generic reservation infrastructure can technically persist a mismatched header/line combination, with no FK preventing it** — confirmed two ways: (i) `inventory_reservations.reference_id` has no FK (already established in Phase 10A); (ii) `createInventoryReservationAction`'s own `createReservationSchema` accepts `reference_type` (a free `z.string().max(100)`) and `reference_id` (any nullable UUID) as **unrestricted client input**, gated only on `warehouse.inventory.operate` — a broad, common Warehouse permission entirely independent of any Workshop/RepairOrder access. **No current UI calls this action** (confirmed: zero `.tsx` files and zero hooks reference `createInventoryReservationAction`, matching Phase 10A's own prior "currently UI-less" finding) — the mismatch is real and reachable via the generic API/action, but not exposed through any live UI today.

All four items confirmed true. The fix proceeded as scoped.

### Y.2 The fix

`allocateForLine`: after the existing header-ownership check, added `if (!scope.variantId || reservationLine.variant_id !== scope.variantId) return { success: false, error: "Reservation line not found" };` — same generic, non-leaking message the ownership check itself already used; the RPC is never called and no event is emitted on this path.

`listAllocationsForLine`: now selects `variant_id` on the embedded reservation lines and filters `l.variant_id === scope.variantId` **before** collecting reservation-line ids — a wrong-variant line's own allocation lines are never even queried.

`listReservationsForLine`: filters each reservation's own `inventory_reservation_lines` array to lines whose `variant_id === scope.variantId`; a reservation left with zero matching lines after that filter is omitted from the result entirely (not returned as an empty-lines placeholder).

`reserveForLine`: **unchanged** — already derives `scope.variantId` server-side and writes it as the reservation line's own variant at creation time; nothing to harden.

`releaseReservationForLine`: **unchanged, by deliberate decision**. Releasing/cancelling a reservation genuinely attributed to this RepairOrderLine — even one whose line carries a mismatched variant — remains a legitimate cleanup action and does not itself misattribute physical stock the way allocation would. No concrete correctness problem was found requiring a change here, per the explicit instruction not to touch it absent one.

### Y.3 Location semantics — explicitly not touched

No change requires `reservationLine.location_id` to equal any RepairOrderLine field — RepairOrderLine has no canonical storage location, and the existing Phase 10B design (location/lot/serial always derived from the reservation line itself) remains correct. Only variant has an authoritative RepairOrderLine identity to compare against.

### Y.4 Live evidence — demonstrates, does not prove

`099_...` gained one new assertion, `T-evidence` (`plan(19)` → `plan(20)`), placed after T17 while the actor still holds full permission. It calls the real `inventory_create_reservation` RPC exactly the way `createInventoryReservationAction` would, creating a reservation whose header references `line_a` but whose own line carries a different real, active variant — **and it succeeds**. This is explicitly classified, in the file's own header and inline comments, as "DB demonstrates why the app-layer guard is required," never as "DB proves the app-layer guard" (the guard itself is TypeScript domain logic, proven exclusively in `repair-orders.service.test.ts`, which pgTAP cannot exercise). T1-T18 are byte-for-byte unchanged.

### Y.5 No DB migration

No FK, trigger, CHECK constraint, or generic-engine validation was added. The fix is Zone 3 application-layer hardening only, per the explicit "expected fix is Zone-3 service/read-model hardening only" instruction — no storage-layer invariant was found to be required.

### Y.6 Testing

6 new Vitest tests (2 `allocateForLine`, 2 `listAllocationsForLine`, 2 `listReservationsForLine`) — 130/130 passing in `repair-orders.service.test.ts` (was 124). `099_...` re-run live: 20/20 (was 19/19). `098_...` re-run live, byte-for-byte unmodified: 17/17, unaffected. Scoped Vitest regression (18 files): 279/279 passing (was 273). `pnpm type-check`/`pnpm lint` clean (0 errors, same 319 pre-existing unrelated warnings). Zero residual test data confirmed live after this pass.

## External-review questions

1. Does Phase 10B reuse `inventory_create_allocation` rather than duplicate it?
2. Is `reservation_line_id` mandatory (never omitted) for every RepairOrder allocation?
3. Can the client forge another line's `reservationLineId`?
4. Is reservation-line ownership verified against exact RepairOrderLine identity?
5. Is org/branch scope server-authoritative throughout?
6. Is `warehouse.inventory.operate` still the correct, sole permission?
7. Does allocation creation change `reservation_line.fulfilled_quantity` exactly once?
8. Does `inventory_balances.reserved_quantity` decrease correctly?
9. Does `inventory_balances.allocated_quantity` increase correctly?
10. Is allocation outstanding exactly `allocated_quantity - fulfilled_quantity`?
11. Are partial allocations supported and proven correctly?
12. Can one reservation line have multiple allocations, and is this proven?
13. Is over-allocation atomically rejected, with no partial write?
14. Do same-SKU RepairOrderLines remain independent?
15. Can a cross-branch location be used, and is this genuinely prevented (not merely believed to be)?
16. Are errors normalized without raw leakage, using real inspected messages?
17. Was any generic allocation engine code, table, or RLS policy changed?
18. Was any Phase 10C (container) work started, even partially?
19. Was Zone 5 touched in any way?
20. Was Phase 10's write boundary or Phase 10A's own accepted contract weakened?
21. Is the future Phase 10F double-counting rule (allocation increments `reservation_line.fulfilled_quantity`; a future WU issue must increment `allocation_line.fulfilled_quantity` only, never re-touch the reservation line) explicitly documented, even though not implemented?
22. Is the decision to build no UI this phase appropriate and well-justified against the actual accepted plan, rather than assumed?
23. Is Phase 10B genuinely complete and ready to hand off to Phase 10C, with no unresolved open question?
