-- =============================================================================
-- Migration: zone5_repair_order_spatial_attribution_schema
-- Zone:      05 (Receiving / Putaway) -- Phase 2
-- Date:      2026-09-12
-- =============================================================================
-- Approved architecture: docs/mvp/zones/05-receiving-putaway-implementation-plan.md
-- section 11 (schema + pair-integrity) and section 1.6 (KNOWN/UNKNOWN model).
--
-- Two new, purely additive tables:
--   1. repair_order_line_locations -- the CURRENT/last-known spatial projection
--      (where a RepairOrderLine's received stock currently sits). This is NOT
--      the business-quantity ledger (repair_order_line_movement_links, Zone 3's
--      own table, untouched by this migration) -- the two are deliberately
--      separate dimensions, per the approved plan.
--   2. repair_order_location_attribution_uncertain -- the KNOWN/UNKNOWN marker.
--      Existence of a row means "attribution at this (location, variant) is
--      no longer provably true"; absence means "not currently flagged
--      uncertain" (it does NOT by itself assert KNOWN-with-confidence -- the
--      projection table's own rows are what carry the actual data).
--
-- Neither table has a client-writable RLS policy. All writes come from the
-- Phase 3 trigger or the Phase 4/6 SECURITY DEFINER RPCs.
--
-- Verification note (repo-only, this session -- Supabase MCP unavailable):
--   repair_orders / repair_order_lines / repair_order_line_movement_links are
--   fully tracked (20260910061711_repair_orders_core_schema.sql, read
--   directly this session). warehouse_locations is fully tracked (see Phase 1
--   migration's own note). This migration adds two small composite-unique
--   constraints (§11.1 of the plan) on repair_orders and repair_order_lines --
--   both additive, no column changes, no RLS change on either Zone 3 table,
--   mirroring the exact existing pattern already used by
--   warehouse_locations_id_org_branch_unique / branches_id_organization_id_unique
--   (20260505091000_inventory_phase1_core.sql). NOT applied to any live
--   database in this session.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PART 1: composite-unique constraints needed for the composite FKs below.
-- Additive, idempotent, no column changes, no RLS changes on either table.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'repair_orders_id_org_branch_unique'
      AND conrelid = 'public.repair_orders'::regclass
  ) THEN
    ALTER TABLE public.repair_orders
      ADD CONSTRAINT repair_orders_id_org_branch_unique
      UNIQUE (id, organization_id, branch_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'repair_order_lines_id_repair_order_id_unique'
      AND conrelid = 'public.repair_order_lines'::regclass
  ) THEN
    ALTER TABLE public.repair_order_lines
      ADD CONSTRAINT repair_order_lines_id_repair_order_id_unique
      UNIQUE (id, repair_order_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- PART 2: repair_order_line_locations -- current/last-known spatial projection
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.repair_order_line_locations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id            UUID NOT NULL,
  repair_order_id      UUID NOT NULL,
  repair_order_line_id UUID NOT NULL,
  variant_id           UUID REFERENCES public.inventory_variants(id),
  location_id          UUID NOT NULL,
  quantity             NUMERIC NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Exactly one logical row per (repair_order_line_id, location_id) -- no
  -- container_id in the pitch-scope key (approved plan §3: NULLS NOT DISTINCT
  -- is available and precedented in this repo if/when containers return in
  -- PILOT, but is deliberately not needed now).
  CONSTRAINT rol_locations_unique UNIQUE (repair_order_line_id, location_id),

  -- Layer 1a: location must genuinely belong to this row's own org/branch.
  CONSTRAINT rol_locations_location_fk
    FOREIGN KEY (location_id, organization_id, branch_id)
    REFERENCES public.warehouse_locations (id, organization_id, branch_id),

  -- Layer 1b: repair_order_id must genuinely belong to this row's own org/branch.
  CONSTRAINT rol_locations_repair_order_fk
    FOREIGN KEY (repair_order_id, organization_id, branch_id)
    REFERENCES public.repair_orders (id, organization_id, branch_id),

  -- Layer 1c: repair_order_line_id must genuinely belong to repair_order_id.
  CONSTRAINT rol_locations_line_fk
    FOREIGN KEY (repair_order_line_id, repair_order_id)
    REFERENCES public.repair_order_lines (id, repair_order_id)
);

CREATE INDEX IF NOT EXISTS rol_locations_repair_order_idx
  ON public.repair_order_line_locations (repair_order_id) WHERE quantity > 0;
CREATE INDEX IF NOT EXISTS rol_locations_lookup_idx
  ON public.repair_order_line_locations (location_id, variant_id) WHERE quantity > 0;

COMMENT ON TABLE public.repair_order_line_locations IS
  'Zone 5: CURRENT/last-known spatial projection -- where a RepairOrderLine''s received stock
   currently sits, by location. NOT a history table (see inventory_stock_ledger_entries for
   history) and NOT the business-quantity ledger (see repair_order_line_movement_links for
   received/issued totals -- a deliberately separate dimension). Written only by
   receive_repair_order_stock, putaway_repair_order_stock, and the
   repair_order_location_attribution_sync trigger -- never directly by client code.
   A (location, variant) with a row in repair_order_location_attribution_uncertain must be
   treated as UNKNOWN by every reader, regardless of what this table currently holds there.';

DROP TRIGGER IF EXISTS rol_locations_updated_at ON public.repair_order_line_locations;
CREATE OR REPLACE FUNCTION public.zone5_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;
CREATE TRIGGER rol_locations_updated_at
  BEFORE UPDATE ON public.repair_order_line_locations
  FOR EACH ROW EXECUTE FUNCTION public.zone5_touch_updated_at();

ALTER TABLE public.repair_order_line_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_order_line_locations FORCE ROW LEVEL SECURITY;

-- SELECT: readable by anyone with either workshop or warehouse read access on
-- the row's own org/branch -- both a RepairOrder advisor and a warehouse
-- operator have a legitimate reason to see "where is this RepairOrder's stock".
DROP POLICY IF EXISTS rol_locations_select ON public.repair_order_line_locations;
CREATE POLICY rol_locations_select ON public.repair_order_line_locations
  FOR SELECT
  USING (
    public.has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.read')
    OR public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read')
  );

-- No INSERT/UPDATE/DELETE policy at all for plain clients -- matches
-- inventory_balances' own posture. Every write goes through SECURITY DEFINER
-- functions (the Phase 3 trigger, the Phase 4/6 RPCs), which run as the
-- function owner and bypass RLS internally by design, not by a permissive
-- policy a client could also use directly.

-- ---------------------------------------------------------------------------
-- PART 3: repair_order_location_attribution_uncertain -- the KNOWN/UNKNOWN marker
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.repair_order_location_attribution_uncertain (
  organization_id    UUID NOT NULL,
  branch_id          UUID NOT NULL,
  location_id        UUID NOT NULL,
  variant_id         UUID NOT NULL,
  first_uncertain_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (organization_id, branch_id, location_id, variant_id),

  CONSTRAINT rolau_location_fk
    FOREIGN KEY (location_id, organization_id, branch_id)
    REFERENCES public.warehouse_locations (id, organization_id, branch_id)
);

COMMENT ON TABLE public.repair_order_location_attribution_uncertain IS
  'Zone 5: existence of a row means RepairOrder spatial attribution at this exact
   (organization, branch, location, variant) is no longer provably true -- a generic movement
   touched commingled/ambiguous stock and the safety-net trigger correctly declined to guess.
   Cleared ONLY when on_hand there reaches exactly zero (the trigger''s own opportunistic check)
   or by a future, explicit, full-bucket reconciliation/scan operation (PILOT, not built yet).
   It is NEVER cleared merely because a later mathematical check happens to look unambiguous
   again (see the plan''s §1.6a) and NEVER cleared by a single RepairOrder-aware RPC write that
   only proves one line, not the whole bucket (see §1.6b). Absence of a row does not itself
   assert confidence -- it means "not currently flagged"; the projection table''s own rows carry
   the actual data.';

ALTER TABLE public.repair_order_location_attribution_uncertain ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_order_location_attribution_uncertain FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rolau_select ON public.repair_order_location_attribution_uncertain;
CREATE POLICY rolau_select ON public.repair_order_location_attribution_uncertain
  FOR SELECT
  USING (
    public.has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.read')
    OR public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read')
  );

-- No client write policy -- written only by the Phase 3 trigger.
