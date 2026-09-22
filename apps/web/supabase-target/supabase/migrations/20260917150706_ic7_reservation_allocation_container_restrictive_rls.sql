-- IC-7 -- inventory_reservations/_lines, inventory_allocations/_lines:
-- CONFIRMED live (both by direct pg_policies inspection and by an
-- empirical raw-DML probe as a real warehouse.inventory.operate-holding
-- authenticated actor) that these 4 tables carry only a single PERMISSIVE
-- ALL policy gated on that one permission, with NO RESTRICTIVE ownership-
-- aware policy and NO protective trigger of any kind -- any ordinary
-- operate-permissioned actor can raw-INSERT/UPDATE/DELETE these tables,
-- fabricating or destroying reservation/allocation records and bypassing
-- every invariant inventory_create_reservation/inventory_create_
-- allocation/inventory_release_reservation/inventory_release_allocation
-- themselves enforce (fulfilled_quantity bookkeeping, reservation<=on_hand,
-- allocation<=reservation, balance-projection sync). This has been a
-- known, disclosed gap since IC-0 (2026-09-15), explicitly deferred to
-- full IC-7. Closed using the exact same, already-proven-safe RESTRICTIVE
-- deny-by-default pattern IC-4 applied to branch transfers and IC-5
-- applied to the RepairOrder projection tables: existing PERMISSIVE
-- policies (and their own scoped SELECT policies) are left completely
-- untouched; a new RESTRICTIVE USING(false)/WITH CHECK(false) policy is
-- added for INSERT/UPDATE/DELETE on each table. Because RESTRICTIVE
-- policies are ANDed against the PERMISSIVE set, this makes every write
-- attempt fail regardless of the caller's own operate permission -- reads
-- are completely unaffected (no RESTRICTIVE policy targets SELECT).
CREATE POLICY inventory_reservations_write_restrict_insert
  ON public.inventory_reservations AS RESTRICTIVE FOR INSERT
  WITH CHECK (false);
CREATE POLICY inventory_reservations_write_restrict_update
  ON public.inventory_reservations AS RESTRICTIVE FOR UPDATE
  USING (false) WITH CHECK (false);
CREATE POLICY inventory_reservations_write_restrict_delete
  ON public.inventory_reservations AS RESTRICTIVE FOR DELETE
  USING (false);

CREATE POLICY inventory_reservation_lines_write_restrict_insert
  ON public.inventory_reservation_lines AS RESTRICTIVE FOR INSERT
  WITH CHECK (false);
CREATE POLICY inventory_reservation_lines_write_restrict_update
  ON public.inventory_reservation_lines AS RESTRICTIVE FOR UPDATE
  USING (false) WITH CHECK (false);
CREATE POLICY inventory_reservation_lines_write_restrict_delete
  ON public.inventory_reservation_lines AS RESTRICTIVE FOR DELETE
  USING (false);

CREATE POLICY inventory_allocations_write_restrict_insert
  ON public.inventory_allocations AS RESTRICTIVE FOR INSERT
  WITH CHECK (false);
CREATE POLICY inventory_allocations_write_restrict_update
  ON public.inventory_allocations AS RESTRICTIVE FOR UPDATE
  USING (false) WITH CHECK (false);
CREATE POLICY inventory_allocations_write_restrict_delete
  ON public.inventory_allocations AS RESTRICTIVE FOR DELETE
  USING (false);

CREATE POLICY inventory_allocation_lines_write_restrict_insert
  ON public.inventory_allocation_lines AS RESTRICTIVE FOR INSERT
  WITH CHECK (false);
CREATE POLICY inventory_allocation_lines_write_restrict_update
  ON public.inventory_allocation_lines AS RESTRICTIVE FOR UPDATE
  USING (false) WITH CHECK (false);
CREATE POLICY inventory_allocation_lines_write_restrict_delete
  ON public.inventory_allocation_lines AS RESTRICTIVE FOR DELETE
  USING (false);

-- IC-7 -- inventory_containers/_container_lines: the "generic (non-
-- RepairOrder-owned) rows remain unrestricted" gap documented in
-- inventory-core-architecture.md §9 predates IC-6. IC-6 (2026-09-17)
-- deleted the ONLY legacy direct-writer of these tables (`ambra-location-
-- inventory.ts`'s own 4 write actions, confirmed dead 3 separate times).
-- A fresh, live repo-wide grep confirms ZERO remaining direct-table
-- writes anywhere in the codebase -- every remaining reference is a pure
-- .select() read; every real write goes through the canonical RPCs
-- (inventory_create_container, inventory_add_to_container, inventory_
-- remove_from_container, inventory_seal_container -- all SECURITY
-- DEFINER, all already correctly authenticated/service_role-only). This
-- makes it now safe to close the previously-necessary "generic PERMISSIVE
-- ALL" gap entirely, matching the same RESTRICTIVE pattern above. The
-- existing RepairOrder-scoped RESTRICTIVE policies (Phase 10C's own
-- correction) are left untouched -- now redundant for RepairOrder-owned
-- rows specifically, but harmless, and not worth removing (additive-only
-- discipline).
CREATE POLICY inventory_containers_write_restrict_insert_all
  ON public.inventory_containers AS RESTRICTIVE FOR INSERT
  WITH CHECK (false);
CREATE POLICY inventory_containers_write_restrict_update_all
  ON public.inventory_containers AS RESTRICTIVE FOR UPDATE
  USING (false) WITH CHECK (false);
CREATE POLICY inventory_containers_write_restrict_delete_all
  ON public.inventory_containers AS RESTRICTIVE FOR DELETE
  USING (false);

CREATE POLICY inventory_container_lines_write_restrict_insert_all
  ON public.inventory_container_lines AS RESTRICTIVE FOR INSERT
  WITH CHECK (false);
CREATE POLICY inventory_container_lines_write_restrict_update_all
  ON public.inventory_container_lines AS RESTRICTIVE FOR UPDATE
  USING (false) WITH CHECK (false);
CREATE POLICY inventory_container_lines_write_restrict_delete_all
  ON public.inventory_container_lines AS RESTRICTIVE FOR DELETE
  USING (false);
