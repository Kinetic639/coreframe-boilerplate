-- ============================================================================
-- IC-8 REPRODUCIBILITY RECONSTRUCTION (2026-09-22)
-- ============================================================================
-- This migration was historically applied live but never locally mirrored
-- (the "Zone-5 local migration-mirroring gap" disclosed since IC-5, and
-- carried as a HARD reproducibility gate into IC-8 per IC-6A's own
-- assignment). It is reconstructed here, at its own original live
-- timestamp/name, from cross-validated evidence -- NOT invented:
--
--   - `resolve_branch_receiving_location`'s own CURRENT live body was
--     fetched via `pg_get_functiondef` and found to be referenced only as
--     a CALLER by every later migration that touches it (`ic3_receive_
--     repair_order_stock_wrapper_refactor`, the various `ic5*_putaway_*`
--     migrations, `a8_receive_remove_projection_write`, `a8_putaway_live_
--     attribution_check`) -- none of them ever `CREATE OR REPLACE` it.
--     This proves the live body below is byte-identical to what this
--     migration originally created.
--   - The partial unique index `warehouse_locations_one_receiving_per_
--     branch` is live-confirmed and matches the "resolves exactly ONE
--     receiving location per branch" invariant this whole project's own
--     test suite and documentation have consistently described since
--     phase 10 (e.g. `101_..._characterization_test.sql`'s own header
--     comment).
--   - `warehouse_locations.purpose` (text, NOT NULL, default 'standard')
--     is live-confirmed; no CHECK constraint exists on its values live
--     today, so none is added here.
--
-- CONFIDENCE: HIGH for both the column/index/function shape (multiply
-- cross-validated against live state and every later caller) and the
-- function body (currently live, unmodified, byte-for-byte).
--
-- See docs/inventory/reviews/ic-8-final-production-readiness-review/
-- migration-reproducibility.md for the full evidence trail.

ALTER TABLE public.warehouse_locations
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'standard';

CREATE UNIQUE INDEX IF NOT EXISTS warehouse_locations_one_receiving_per_branch
  ON public.warehouse_locations (organization_id, branch_id)
  WHERE (purpose = 'receiving' AND deleted_at IS NULL);

CREATE OR REPLACE FUNCTION public.resolve_branch_receiving_location(p_organization_id uuid, p_branch_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_location_id uuid;
BEGIN
  SELECT id INTO v_location_id
  FROM public.warehouse_locations
  WHERE organization_id = p_organization_id
    AND branch_id = p_branch_id
    AND purpose = 'receiving'
    AND deleted_at IS NULL
    AND can_store_inventory = true;

  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'No active receiving location configured for this branch (organization_id=%, branch_id=%). An admin must designate one on the Locations page before receiving can post.', p_organization_id, p_branch_id
      USING ERRCODE = 'P0002';
  END IF;

  RETURN v_location_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_branch_receiving_location(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_branch_receiving_location(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_branch_receiving_location(uuid, uuid) FROM authenticated;
