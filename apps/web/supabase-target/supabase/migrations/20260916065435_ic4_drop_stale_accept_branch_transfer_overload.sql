-- Corrective, self-caught: the prior migration added p_line_acceptances
-- as a new 4th parameter via CREATE OR REPLACE, which (per this
-- project's own established pitfall) creates an ADDITIONAL overload
-- rather than replacing the original 3-arg signature. The stale 3-arg
-- overload was the OLD, broken, still-anon-exploitable version (hand-
-- written balance writes, references the nonexistent
-- inventory_allocate_movement_number). Dropped, not left dormant.
DROP FUNCTION public.inventory_accept_branch_transfer(uuid, uuid, uuid);
