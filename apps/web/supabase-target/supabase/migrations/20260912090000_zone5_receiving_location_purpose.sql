-- =============================================================================
-- Migration: zone5_receiving_location_purpose
-- Zone:      05 (Receiving / Putaway) -- Phase 1
-- Date:      2026-09-12
-- =============================================================================
-- Approved architecture: docs/mvp/zones/05-receiving-putaway-implementation-plan.md
-- section 5 ("Receiving-location schema (final)") + section 6 (provisioning).
--
-- Scope:
--   1. warehouse_locations.purpose ('standard' | 'receiving'), defaulted so
--      every existing row becomes 'standard' with zero data migration needed.
--   2. Partial unique index: at most one active (non-deleted) 'receiving'
--      location per (organization_id, branch_id).
--   3. A read helper (resolve_branch_receiving_location) used by the Phase 4/6
--      RPCs to resolve "the" receiving location server-side -- re-validating
--      org/branch/purpose/can_store_inventory/deleted_at every call, never
--      cached, never trusted from a caller-supplied id.
--
-- NOT in scope (per the approved plan -- do not add):
--   - 'quality' / 'quarantine' / 'dispatch' / etc. purpose values (the CHECK
--     constraint is written so a future migration can add them without a
--     schema redesign, but none are added now).
--   - Any automatic per-branch provisioning trigger (rejected in the plan --
--     no such pattern exists elsewhere in this repo to extend; the product
--     decision is admin-designates-an-existing-location).
--
-- Verification note (repo-only, this session -- Supabase MCP unavailable):
--   `warehouse_locations` IS fully tracked (base CREATE TABLE in
--   20260401120000_warehouse_locations.sql, altered by several later,
--   tracked migrations including 20260617120000_inventory_location_placement.sql
--   which added `can_store_inventory`). This migration is therefore additive
--   against a schema this session could read directly, not against an
--   untracked object -- unlike Phase 3's ledger trigger, flagged separately.
--   NOT applied to any live database in this session (no Supabase MCP tool
--   was available, and per instructions this session does not fall back to
--   a raw `supabase db push` against the live target project). Local/live
--   parity and live re-verification remain an explicit blocker until an MCP
--   (or equivalent reviewed) session applies and re-queries this migration.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PART 1: purpose column
-- ---------------------------------------------------------------------------
ALTER TABLE public.warehouse_locations
  ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'standard';

ALTER TABLE public.warehouse_locations
  DROP CONSTRAINT IF EXISTS warehouse_locations_purpose_check;

ALTER TABLE public.warehouse_locations
  ADD CONSTRAINT warehouse_locations_purpose_check
  CHECK (purpose IN ('standard', 'receiving'));

COMMENT ON COLUMN public.warehouse_locations.purpose IS
  'Zone 5: semantic role of this location. ''standard'' (default) or ''receiving''
   (the branch''s designated inbound buffer -- see warehouse_locations_one_receiving_per_branch).
   Deliberately named ''purpose'', not ''role'', to avoid colliding with the RBAC role concept
   (public.roles / role_permissions) used elsewhere in this schema. CHECK is intentionally
   narrow to the pitch domain; extending it later (e.g. ''quality'', ''quarantine'', ''dispatch'')
   is a CHECK-constraint change only, not a schema redesign.';

-- ---------------------------------------------------------------------------
-- PART 2: one active receiving location per branch (DB-enforced, not convention)
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.warehouse_locations_one_receiving_per_branch;

CREATE UNIQUE INDEX warehouse_locations_one_receiving_per_branch
  ON public.warehouse_locations (organization_id, branch_id)
  WHERE purpose = 'receiving' AND deleted_at IS NULL;

COMMENT ON INDEX public.warehouse_locations_one_receiving_per_branch IS
  'Zone 5: at most one non-deleted purpose=receiving location per branch. A location can be
   re-designated (change an old one back to standard, then mark a new one receiving) but never
   have two simultaneously active receiving locations in the same branch.';

-- ---------------------------------------------------------------------------
-- PART 3: server-side resolver -- used by Phase 4/6 RPCs, never a bare SELECT
-- from application code, so every caller re-validates the same invariants.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_branch_receiving_location(
  p_organization_id uuid,
  p_branch_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
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

COMMENT ON FUNCTION public.resolve_branch_receiving_location(uuid, uuid) IS
  'Zone 5: resolves the branch''s designated receiving location, re-checking
   purpose/deleted_at/can_store_inventory on every call (never cached, never trusted from a
   caller-supplied id). Raises a clear, catchable error if none is configured, rather than
   silently picking a wrong location. Used by receive_repair_order_stock and
   putaway_repair_order_stock (Phases 4/6).';

REVOKE ALL ON FUNCTION public.resolve_branch_receiving_location(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_branch_receiving_location(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_branch_receiving_location(uuid, uuid) TO authenticated;
