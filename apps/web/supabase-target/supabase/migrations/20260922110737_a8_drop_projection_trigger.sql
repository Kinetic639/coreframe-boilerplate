-- INVENTORY CORE A8 -- REPAIR ORDER PROJECTION SIMPLIFICATION (5 of 7)
--
-- Drops the incremental RepairOrder location projection trigger and its
-- function. Verified live before dropping: exactly one trigger
-- (repair_order_line_locations_ledger_sync, AFTER INSERT on
-- inventory_stock_ledger_entries) referenced this function, and no other
-- function/trigger in pg_proc called it. Its two jobs -- (a) reversal-link
-- mirroring and full bucket rebuild, (b) heuristic incremental-decrease
-- guessing for generic, non-attribution-authoritative movements -- are
-- both superseded: (a) by get_repair_order_line_physical_state's own
-- reversal-aware read-time JOIN (migration 1 of this set), which follows
-- inventory_movement_headers.reversal_movement_id directly rather than
-- needing a mirrored link row; (b) by removing the underlying persisted
-- projection this heuristic existed to maintain -- there is nothing left
-- to guess at incrementally.
--
-- This is a purely generic-core table (inventory_stock_ledger_entries);
-- no generic ledger/audit trigger is touched by this migration.

DROP TRIGGER repair_order_line_locations_ledger_sync ON public.inventory_stock_ledger_entries;
DROP FUNCTION public.repair_order_location_attribution_sync();
