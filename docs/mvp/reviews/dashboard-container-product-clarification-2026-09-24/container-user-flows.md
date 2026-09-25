# Container User Flows — Accepted (2026-09-24)

Plain-language flow descriptions for the accepted container operating model, for reference by whoever eventually designs/implements Phase 10E's partial-move extension or reviews Phase 10D-F against product intent. No implementation detail assumed beyond what's already in the accepted Phase 10D/10E/10F plan.

## Flow 1 — Whole-container relocation (Phase 10E, existing, unchanged)

1. Worker scans or opens a container (via Phase 10D's QR scan flow).
2. Worker chooses "Move Container."
3. Worker scans or selects the destination location.
4. Worker confirms.
5. System: the container and all its contents move to the new location. Same container ID. One atomic operation (real 801 movement for the container's contents + `current_location_id` update together).

## Flow 2 — Partial move, creating a new container (NOT YET DESIGNED — recorded as a gap)

1. Worker scans or opens a source container.
2. Worker selects one or more part lines and the quantities to move (not the whole container).
3. Worker scans or selects the destination location.
4. UI offers: "Move selected parts and create a new container."
5. Worker confirms.
6. System (accepted behavior, not yet designed at the RPC/schema level):
   - Creates a NEW container.
   - Auto-assigns the new container to the SAME RepairOrder as the source container (no re-prompt).
   - Removes the selected quantities from the source container.
   - Assigns the selected quantities to the new container.
   - Sets the new container's location to the destination.
   - Generates a new container QR/label for printing/assignment.
   - Leaves the source container at its original location with its remaining (unselected) contents.

**This flow has no existing phase, RPC, or task covering it.** It is a genuinely new requirement, first recorded in this pass. Implementing it would require, at minimum: a design decision on whether this is a new RPC or an extension of the Phase 10E relocation RPC; atomicity between the source-container decrement and new-container creation; ownership of QR/label generation timing (reuses Phase 10D's registry entry, or needs its own?); and its own pgTAP coverage proving no quantity is lost or duplicated across the split. None of this is decided here — this file records the accepted USER-FACING behavior only.

## Flow 3 — Adding to an existing container (Phase 10C, existing, already implemented)

1. Worker has additional parts belonging to a RepairOrder that already has one or more containers.
2. Worker chooses to add the parts to an existing container of that same RepairOrder, OR create a new container.
3. System (already live): `inventory_add_to_container` enforces that the container's own RepairOrder (resolved via the allocation → reservation → RepairOrderLine → RepairOrder chain) matches the allocation being placed — a cross-RepairOrder placement is rejected (`P0002`).

## Flow 4 — Issue from container, whole (Phase 10F, existing, unchanged)

1. Worker scans/opens a container.
2. Worker chooses "Issue all contents."
3. Worker confirms (with override/reason flow if this exceeds what's reserved, per the existing accepted override-permission decision).
4. System: all remaining container line quantities are issued (real WU 201/WZ movement), the container's `status` becomes `'empty'`.

## Flow 5 — Issue from container, partial (Phase 10F, existing, unchanged)

1. Worker scans/opens a container.
2. Worker selects specific part lines/quantities to issue (not the whole container).
3. Worker confirms.
4. System: only the selected quantities are issued; the remaining quantities stay in the same container, which remains in its current (non-empty) state.

## Flow 6 — Free/standalone stock (future scope, not pitch)

Not a container flow — recorded here only to make the boundary explicit. Free stock exists independent of any RepairOrder, always has a known location, but is not (in current pitch scope) individually QR-identified. A future, explicitly non-pitch, PILOT-or-later extension may add unit-level QR to standalone stock, usable as an action context (Ticket/Task/move/assign-to-RepairOrder/add-to-container/history) — this pass does not design that extension, only confirms it stays out of pitch scope.
