-- Zone 3 Phase 10 correction pass: close the direct-client write boundary.
--
-- LIVE VERIFIED before this migration (transaction-scoped dry run, rolled
-- back): with the Phase 2 permissive INSERT policy replaced by a deny-all
-- policy, a direct authenticated client INSERT is rejected (42501, RLS
-- violation) while the SAME actor's call to attach_repair_order_line_
-- movement(...) still succeeds -- because that RPC is SECURITY DEFINER,
-- owned by `postgres`, and `postgres` has rolbypassrls = true. The RPC's
-- own internal INSERT has therefore NEVER depended on this table's INSERT
-- policy at all -- it bypasses RLS unconditionally via role ownership, not
-- because of anything FORCE ROW LEVEL SECURITY does for it. This is why
-- closing the policy is safe and sufficient: no trigger duplication needed,
-- one canonical implementation of the attribution invariants (the RPC)
-- remains the only place they are enforced.
--
-- Final write boundary: a direct authenticated (or anon) client INSERT is
-- now denied unconditionally; attach_repair_order_line_movement(...) is the
-- only production write path. SELECT policy, DELETE-deny policy, and the
-- (nonexistent) UPDATE policy are all left exactly as Phase 2 built them --
-- only the INSERT policy is replaced.
drop policy if exists repair_order_line_movement_links_insert on repair_order_line_movement_links;

create policy repair_order_line_movement_links_insert_deny
  on repair_order_line_movement_links
  for insert
  with check (false);
