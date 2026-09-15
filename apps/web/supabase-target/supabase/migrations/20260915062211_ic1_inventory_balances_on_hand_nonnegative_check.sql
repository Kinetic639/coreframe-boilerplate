-- IC-1 (Inventory Core consolidation, Canonical Movement Engine / Hard Stock
-- Invariants): add the missing non-negative CHECK constraint on
-- `inventory_balances.on_hand_quantity`. IC-0's own live verification
-- confirmed `allocated_quantity >= 0` and `reserved_quantity >= 0` already
-- exist (`inventory_balances_allocated_nonnegative`,
-- `inventory_balances_reserved_nonnegative`); `on_hand_quantity >= 0` did
-- NOT. Pre-migration data safety check (live-queried, IC-0): all 37 existing
-- `inventory_balances` rows already satisfy this -- safe forward migration,
-- no data repair required.
ALTER TABLE public.inventory_balances
  ADD CONSTRAINT inventory_balances_on_hand_nonnegative
  CHECK (on_hand_quantity >= 0);
