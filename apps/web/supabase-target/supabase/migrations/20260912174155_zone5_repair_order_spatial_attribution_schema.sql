-- ============================================================================
-- IC-8 REPRODUCIBILITY RECONSTRUCTION (2026-09-22)
-- ============================================================================
-- Historically applied live, never locally mirrored (see the sibling
-- reconstruction `20260912174011_zone5_receiving_location_purpose.sql`
-- for the full context). Reconstructed at its own original timestamp.
--
-- Both tables were DROPPED by `20260922110807_a8_drop_projection_tables.sql`
-- (Inventory Core A8, same day as this reconstruction), so they no longer
-- exist live -- this reconstruction exists SOLELY to make the repository's
-- own migration history replayable from scratch; a clean replay will
-- create these tables here and then correctly drop them again via A8's
-- own already-mirrored migration, exactly reproducing the accepted live
-- end state.
--
-- CONFIDENCE: HIGH. Column lists were captured live via
-- `information_schema.columns` before A8 dropped these tables, and
-- independently cross-validated against every later, already-mirrored
-- migration that references specific columns on either table by name
-- (`ic5_rebuild_repair_order_projection_bucket_internal`'s own INSERT
-- statements name every column below explicitly; `20260916182708_ic5_
-- projection_tables_restrictive_rls.sql`'s own header comment states
-- "carried only a SELECT policy each" prior to that migration, confirming
-- the SELECT-only RLS shape created here). The SELECT policy's own exact
-- predicate is reconstructed from the live, byte-identical pattern used
-- by every other org/branch-scoped derived-state table in this schema
-- (`inventory_containers_select`, fetched live), matching this table
-- pair's own identical column shape (direct `organization_id`/
-- `branch_id` columns, no `deleted_at`).
--
-- See docs/inventory/reviews/ic-8-final-production-readiness-review/
-- migration-reproducibility.md for the full evidence trail.

CREATE TABLE public.repair_order_line_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  repair_order_id uuid NOT NULL,
  repair_order_line_id uuid NOT NULL,
  variant_id uuid,
  location_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT repair_order_line_locations_unique UNIQUE (repair_order_line_id, location_id)
);

CREATE TABLE public.repair_order_location_attribution_uncertain (
  organization_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  location_id uuid NOT NULL,
  variant_id uuid NOT NULL,
  first_uncertain_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT repair_order_location_attribution_uncertain_pkey
    PRIMARY KEY (organization_id, branch_id, location_id, variant_id)
);

ALTER TABLE public.repair_order_line_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_order_line_locations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.repair_order_location_attribution_uncertain ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_order_location_attribution_uncertain FORCE ROW LEVEL SECURITY;

CREATE POLICY repair_order_line_locations_select
  ON public.repair_order_line_locations FOR SELECT
  TO authenticated
  USING (has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read'));

CREATE POLICY repair_order_location_attribution_uncertain_select
  ON public.repair_order_location_attribution_uncertain FOR SELECT
  TO authenticated
  USING (has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read'));

GRANT SELECT ON public.repair_order_line_locations TO authenticated;
GRANT SELECT ON public.repair_order_location_attribution_uncertain TO authenticated;
