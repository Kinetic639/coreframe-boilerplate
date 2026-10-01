# Phase 10E — Whole-container relocation (2026-10-01)

Scope: move a whole container and its contents to another location of the
same branch. A partial move into a new container (audit §31.C) is out of
scope. The product owner confirmed on 2026-09-30 that it is not needed for the demo.

## Design deviation from the plan

The plan (implementation-plan §10E) assumed a plain 801 per container line. In
practice, that cannot work. Since IC-1, `inventory_finalize_posting` rejects
(P0003) any on_hand decrease that would leave `on_hand < reserved + allocated`.
Container contents are allocated stock by construction (Phase 10C), so a plain
801 always fails.

`inventory_relocate_container` therefore moves the commitment together with
the stock, in one transaction:

1. Lock the container, then its lines, then the linked allocation lines, in id order.
2. For each linked allocation line:
   - check that it is at the container's location and that its link sums are consistent;
   - release `allocated_quantity` at the source balance;
   - move the allocation line to the destination. When the whole outstanding
     allocation is in this container, the line moves in place. Otherwise the
     moved part is split onto a new allocation line (same allocation, same
     reservation line), and only this container's links are re-pointed to it.
3. Post an 801 through the unchanged `inventory_create_draft` and
   `inventory_finalize_posting`. `container_id` is set on the draft lines
   before posting, so the core functions were not modified.
4. Re-apply `allocated_quantity` at the destination balance.
5. Update `inventory_containers.current_location_id`.

An empty container only has its pointer moved, with no movement posted.

There is no idempotency key. A retry after a successful move fails with
"already at this location" (22023).

## Security

- The function is `SECURITY DEFINER`. It checks that the actor is the caller
  (`28000`) and that the caller holds `warehouse.inventory.operate` on the
  container's branch (`42501`).
- EXECUTE is revoked from PUBLIC and from anon, and granted to authenticated only.
- The server action `relocateContainerAction` is gated on
  `warehouse.inventory.operate`. It takes org, actor and branch from server
  context and from the container row that RLS lets the caller see. A
  container outside the active branch is reported as not found.

## Tests

- **pgTAP:** `apps/web/supabase/tests/117_phase10e_container_relocation_test.sql`,
  24/24 live, rolled back, no residue. It covers:
  - the 801 with `container_id`;
  - on_hand and allocated at source and destination;
  - an allocation line moved in place, and one split;
  - re-pointing of links;
  - a sibling container left untouched;
  - an empty container;
  - rejection of: same location, non-stockable destination, unknown container,
    actor mismatch, archived container, and anon EXECUTE;
  - atomicity under a forced failure after the commitment step.
- **Vitest:**
  - service `relocate`: RPC args, result mapping, and 9 error mappings;
  - action: gate, input, branch scoping, identity;
  - dialog: scan a location sticker → confirm → refresh, plus refusal of a
    sticker that is not a location, of the current location, and of an
    unavailable location, an error toast, and confirm disabled until a
    destination is chosen.

## Known limits

- Zone 5 attribution links (`repair_order_line_movement_links`) are not written
  for the move. `getPhysicalStateForLine`, which is not used by any UI, may
  report a location mismatch for moved RepairOrder lines.
- Loose allocations still sitting at the old location cannot be placed into
  the moved container, because placement requires matching locations. This is
  the intended physical rule.
- The pre-existing, unrelated `warehouse/__tests__/placeholder-pages.test.tsx`
  failure (`next/navigation` module resolution) is still there.
