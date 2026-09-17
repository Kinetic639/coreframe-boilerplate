DROP POLICY inventory_branch_transfers_operate ON public.inventory_branch_transfers;
DROP POLICY inventory_branch_transfer_lines_operate ON public.inventory_branch_transfer_lines;

-- IC-4: close the raw-write gap IC-0/architecture §9 flagged. All writes
-- to these two tables must go through the canonical, actor/permission-
-- checked RPCs (all SECURITY DEFINER, owned by postgres, which bypasses
-- RLS entirely regardless of policy content). Scoped SELECT is preserved
-- unchanged. RESTRICTIVE-false policies make the closure explicit and
-- future-proof (a later broad PERMISSIVE policy added by mistake would
-- still be blocked), on top of the implicit "zero PERMISSIVE = deny"
-- behavior that already results from simply dropping the old ALL policy.
CREATE POLICY inventory_branch_transfers_deny_insert
  ON public.inventory_branch_transfers AS RESTRICTIVE FOR INSERT
  TO authenticated WITH CHECK (false);
CREATE POLICY inventory_branch_transfers_deny_update
  ON public.inventory_branch_transfers AS RESTRICTIVE FOR UPDATE
  TO authenticated USING (false);
CREATE POLICY inventory_branch_transfers_deny_delete
  ON public.inventory_branch_transfers AS RESTRICTIVE FOR DELETE
  TO authenticated USING (false);

CREATE POLICY inventory_branch_transfer_lines_deny_insert
  ON public.inventory_branch_transfer_lines AS RESTRICTIVE FOR INSERT
  TO authenticated WITH CHECK (false);
CREATE POLICY inventory_branch_transfer_lines_deny_update
  ON public.inventory_branch_transfer_lines AS RESTRICTIVE FOR UPDATE
  TO authenticated USING (false);
CREATE POLICY inventory_branch_transfer_lines_deny_delete
  ON public.inventory_branch_transfer_lines AS RESTRICTIVE FOR DELETE
  TO authenticated USING (false);
