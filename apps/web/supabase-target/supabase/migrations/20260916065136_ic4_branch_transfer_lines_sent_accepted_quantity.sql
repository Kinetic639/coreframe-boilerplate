ALTER TABLE public.inventory_branch_transfer_lines
  ADD COLUMN sent_quantity numeric(18, 6),
  ADD COLUMN accepted_quantity numeric(18, 6);

ALTER TABLE public.inventory_branch_transfer_lines
  ADD CONSTRAINT inventory_branch_transfer_lines_sent_quantity_nonnegative
    CHECK (sent_quantity IS NULL OR sent_quantity >= 0),
  ADD CONSTRAINT inventory_branch_transfer_lines_accepted_quantity_nonnegative
    CHECK (accepted_quantity IS NULL OR accepted_quantity >= 0),
  ADD CONSTRAINT inventory_branch_transfer_lines_accepted_le_sent
    CHECK (accepted_quantity IS NULL OR sent_quantity IS NULL OR accepted_quantity <= sent_quantity);

COMMENT ON COLUMN public.inventory_branch_transfer_lines.quantity IS
  'Requested/reserved quantity at transfer creation time.';
COMMENT ON COLUMN public.inventory_branch_transfer_lines.sent_quantity IS
  'Set at SEND time (IC-4). Always equals quantity in the current design (no partial-ship modeled) -- persisted as its own historical fact, separate from the original request, for discrepancy accounting.';
COMMENT ON COLUMN public.inventory_branch_transfer_lines.accepted_quantity IS
  'Set at ACCEPT/PARTIAL-ACCEPT time (IC-4). 0 <= accepted_quantity <= sent_quantity. sent_quantity - accepted_quantity, if positive, becomes a persisted inventory_branch_transfer_discrepancies row.';
