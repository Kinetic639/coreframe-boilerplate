-- ============================================================================
-- U4: a transfer within one branch is allowed between named magazyny (MMJ)
-- ============================================================================
-- Run in the SQL editor (the Supabase MCP declines DROP).
-- ============================================================================

ALTER TABLE public.inventory_branch_transfers
  DROP CONSTRAINT IF EXISTS inventory_branch_transfers_distinct_branches;

ALTER TABLE public.inventory_branch_transfers
  ADD CONSTRAINT inventory_branch_transfers_distinct_branches
  CHECK (
    source_branch_id <> destination_branch_id
    OR (source_warehouse_id IS NOT NULL AND destination_warehouse_id IS NOT NULL
        AND source_warehouse_id <> destination_warehouse_id)
  );
