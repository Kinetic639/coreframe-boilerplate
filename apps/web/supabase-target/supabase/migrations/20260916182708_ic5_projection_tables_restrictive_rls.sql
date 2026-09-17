-- IC-5: repair_order_line_locations / repair_order_location_attribution_
-- uncertain carried only a SELECT policy each -- zero PERMISSIVE policies
-- for INSERT/UPDATE/DELETE already meant implicit deny for ordinary roles
-- (live-verified before this migration), but make the closure explicit
-- and self-documenting, matching the pattern already used for
-- repair_order_line_movement_links and every other closed derived-state
-- table in this project. Projection tables are derived state; only
-- SECURITY DEFINER, postgres-owned RPCs/triggers (which bypass RLS via
-- same-owner privilege semantics) may ever write them.
CREATE POLICY repair_order_line_locations_deny_insert
  ON public.repair_order_line_locations AS RESTRICTIVE FOR INSERT
  TO authenticated WITH CHECK (false);
CREATE POLICY repair_order_line_locations_deny_update
  ON public.repair_order_line_locations AS RESTRICTIVE FOR UPDATE
  TO authenticated USING (false);
CREATE POLICY repair_order_line_locations_deny_delete
  ON public.repair_order_line_locations AS RESTRICTIVE FOR DELETE
  TO authenticated USING (false);

CREATE POLICY repair_order_location_attribution_uncertain_deny_insert
  ON public.repair_order_location_attribution_uncertain AS RESTRICTIVE FOR INSERT
  TO authenticated WITH CHECK (false);
CREATE POLICY repair_order_location_attribution_uncertain_deny_update
  ON public.repair_order_location_attribution_uncertain AS RESTRICTIVE FOR UPDATE
  TO authenticated USING (false);
CREATE POLICY repair_order_location_attribution_uncertain_deny_delete
  ON public.repair_order_location_attribution_uncertain AS RESTRICTIVE FOR DELETE
  TO authenticated USING (false);
