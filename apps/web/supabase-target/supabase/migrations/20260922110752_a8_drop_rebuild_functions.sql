-- INVENTORY CORE A8 -- REPAIR ORDER PROJECTION SIMPLIFICATION (6 of 7)
--
-- Drops both rebuild RPCs. Their entire purpose was reconstructing the
-- now-removed persisted projection tables -- with no table left to
-- rebuild into, there is nothing left for them to do. Their own query
-- logic (the proportional contribution formula) was already reused,
-- verbatim, by get_repair_order_line_physical_state (migration 1 of this
-- set) before being removed here -- not independently re-derived, and not
-- lost.
--
-- Caller verification before dropping (this pass, live): zero TypeScript
-- callers of rebuild_repair_order_location_projection anywhere in
-- apps/web or apps/public-web (confirmed via repo-wide grep). The only
-- SQL caller of rebuild_repair_order_projection_bucket_internal was the
-- trigger function dropped in the prior migration of this set (already
-- gone by the time this migration runs). Both DROP statements themselves
-- additionally fail loudly with a dependency error if any caller had been
-- missed -- neither did.
--
-- Public wrapper dropped first (it is the sole caller of the internal
-- bucket helper), so the internal helper has zero remaining callers at
-- the moment it is dropped.

DROP FUNCTION public.rebuild_repair_order_location_projection(uuid, uuid, uuid, uuid);
DROP FUNCTION public.rebuild_repair_order_projection_bucket_internal(uuid, uuid, uuid, uuid);
