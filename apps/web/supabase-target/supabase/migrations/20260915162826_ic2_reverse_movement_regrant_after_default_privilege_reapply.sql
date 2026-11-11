-- Live-caught defect: `anon` regained EXECUTE on inventory_reverse_movement
-- despite the explicit REVOKE ALL FROM PUBLIC / GRANT TO authenticated,
-- service_role issued in the very first IC-2 migration for this function.
-- Live-verified: this database applies a default-privilege grant (anon
-- EXECUTE on newly-created/replaced functions in schema public) that
-- re-applies on each subsequent CREATE OR REPLACE FUNCTION call -- the two
-- later migrations in this same IC-2 phase (the P0004 fix, the Zone 5
-- attribution guard) each silently re-exposed the function to anon. This
-- is the SAME pre-existing default-privilege behavior already observed on
-- `inventory_finalize_posting` (anon has held EXECUTE on it since before
-- IC-1/IC-2 -- out of scope to fix here, a pre-existing condition).
-- `inventory_reverse_movement` itself is a NEW, IC-2-owned RPC with an
-- explicit, narrower intended security model matching the established
-- Phase 10C/Zone 5 convention (authenticated + service_role only, e.g.
-- putaway_repair_order_stock, inventory_create_container) -- this
-- corrective migration re-applies that intent as the final word after
-- every CREATE OR REPLACE in this phase.
REVOKE ALL ON FUNCTION public.inventory_reverse_movement(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_reverse_movement(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.inventory_reverse_movement(uuid, uuid, text) TO authenticated, service_role;
