-- =============================================================================
-- Migration: inventory_audits_workflow
-- Project:   rjeraydumwechpjjzrus (TARGET)
-- Feature:   Stock Audit / Cycle Count (apps/web/docs/stock-audit-implementation-plan.md)
-- =============================================================================
-- Scope (see plan §1a-h):
--   a. inventory_variants.default_supplier_id — MVP source of truth for
--      "which supplier delivers this item" (audit-by-supplier scoping).
--   b. inventory_count_lines workflow columns: status/reason_code/source/sequence_no.
--   c. inventory_count_sessions.scope stays jsonb (no new columns) — canonical
--      shape documented in src/lib/warehouse/count-session-types.ts.
--   d. inventory_create_count_session — rewritten scope filter (location vs
--      supplier), optional zero-stock branch, sequence_no assignment, gated on
--      warehouse.audits.manage instead of warehouse.inventory.adjust.
--   e. inventory_approve_count_session — all-or-nothing posting gate per the
--      state machine (plan §4/§5). Movement-engine call path is UNCHANGED.
--      Still independently requires warehouse.inventory.adjust (decision #3,
--      separation of duties) in addition to warehouse.audits.manage at the
--      action layer.
--   f. inventory_count_session_list — new read-only aggregate RPC for the
--      dashboard list (avoids N+1), gated on warehouse.audits.read.
--   g. New permissions warehouse.audits.read / warehouse.audits.manage,
--      seeded to mirror the existing warehouse.inventory.read/.adjust grant
--      shape exactly, RLS policies on the two count tables swapped to use them.
--   h. New table inventory_reorder_suggestion_actions (accept/ignore decisions
--      for the reorder report) — RLS enabled + forced from creation.
--
-- Explicitly NOT touched: inventory_create_draft_movement, inventory_post_movement
-- (movement engine semantics), inventory_balances (no direct UPDATE anywhere in
-- this file — search for "UPDATE public.inventory_balances" finds nothing),
-- inventory_variants RLS/ENABLE/FORCE state (only a plain ADD COLUMN), any
-- table/policy unrelated to this feature.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1a. inventory_variants.default_supplier_id
-- -----------------------------------------------------------------------------
ALTER TABLE public.inventory_variants
  ADD COLUMN IF NOT EXISTS default_supplier_id uuid NULL
    REFERENCES public.inventory_suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS inventory_variants_default_supplier_idx
  ON public.inventory_variants (organization_id, default_supplier_id)
  WHERE default_supplier_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 1b. inventory_count_lines workflow columns
-- -----------------------------------------------------------------------------
ALTER TABLE public.inventory_count_lines
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reason_code text NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'generated',
  ADD COLUMN IF NOT EXISTS sequence_no integer NULL;

ALTER TABLE public.inventory_count_lines
  DROP CONSTRAINT IF EXISTS inventory_count_lines_status_check;
ALTER TABLE public.inventory_count_lines
  ADD CONSTRAINT inventory_count_lines_status_check
    CHECK (status IN ('pending', 'counted', 'skipped', 'needs_recount', 'approved'));

ALTER TABLE public.inventory_count_lines
  DROP CONSTRAINT IF EXISTS inventory_count_lines_source_check;
ALTER TABLE public.inventory_count_lines
  ADD CONSTRAINT inventory_count_lines_source_check
    CHECK (source IN ('generated', 'unexpected_found'));

CREATE INDEX IF NOT EXISTS inventory_count_lines_status_idx
  ON public.inventory_count_lines (count_session_id, status);

-- Defensive, idempotent backfill in case any pre-existing rows exist (this
-- table has never been consumed by any UI, so this is expected to be a no-op
-- in every environment, but is kept for safety rather than assumed).
UPDATE public.inventory_count_lines
SET status = 'counted'
WHERE counted_quantity IS NOT NULL
  AND status = 'pending';

-- -----------------------------------------------------------------------------
-- 1d. inventory_create_count_session — rewritten scope filter + zero-stock
--     branch + sequence_no assignment + permission swap.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inventory_create_count_session(
  p_organization_id uuid,
  p_branch_id uuid,
  p_scope jsonb DEFAULT '{}'::jsonb,
  p_notes text DEFAULT NULL,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count_id uuid;
  v_number text;
  v_count_type text;
  v_include_zero_stock boolean;
  v_location_ids uuid[];
  v_location_filter_ids uuid[];
  v_supplier_id uuid;
  v_seq_offset integer;
BEGIN
  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.audits.manage') THEN
    RAISE EXCEPTION 'Missing warehouse.audits.manage permission';
  END IF;

  v_count_type := coalesce(p_scope ->> 'count_type', 'location');
  IF v_count_type NOT IN ('location', 'supplier') THEN
    RAISE EXCEPTION 'scope.count_type must be location or supplier';
  END IF;

  v_include_zero_stock := coalesce((p_scope ->> 'include_zero_stock')::boolean, false);

  SELECT coalesce(array_agg(elem::uuid), ARRAY[]::uuid[])
  INTO v_location_ids
  FROM jsonb_array_elements_text(coalesce(p_scope -> 'location_ids', '[]'::jsonb)) AS elem;

  SELECT coalesce(array_agg(elem::uuid), ARRAY[]::uuid[])
  INTO v_location_filter_ids
  FROM jsonb_array_elements_text(coalesce(p_scope -> 'location_filter_ids', '[]'::jsonb)) AS elem;

  v_supplier_id := nullif(p_scope ->> 'supplier_id', '')::uuid;

  IF v_count_type = 'supplier' AND v_supplier_id IS NULL THEN
    RAISE EXCEPTION 'scope.supplier_id is required when count_type is supplier';
  END IF;
  IF v_count_type = 'location' AND array_length(v_location_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'scope.location_ids must not be empty when count_type is location';
  END IF;

  v_number := 'CNT-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || substr(gen_random_uuid()::text, 1, 6);

  INSERT INTO public.inventory_count_sessions (
    organization_id, branch_id, count_number, scope, notes, created_by
  )
  VALUES (
    p_organization_id, p_branch_id, upper(v_number), coalesce(p_scope, '{}'::jsonb), p_notes, p_actor_user_id
  )
  RETURNING id INTO v_count_id;

  -- Branch 1: seed lines from existing balances matching the resolved scope.
  -- Location-subtree expansion already happened in TypeScript before this RPC
  -- was called (buildLocationTree) — v_location_ids is always the final,
  -- already-expanded list, never a set of parent-only ids to expand here.
  INSERT INTO public.inventory_count_lines (
    organization_id, branch_id, count_session_id, variant_id, location_id,
    lot_id, serial_id, expected_quantity, unit_id, status, source, sequence_no
  )
  SELECT
    b.organization_id, b.branch_id, v_count_id, b.variant_id, b.location_id,
    b.lot_id, b.serial_id, b.on_hand_quantity, p.base_unit_id, 'pending', 'generated',
    row_number() OVER (ORDER BY b.location_id, b.variant_id)
  FROM public.inventory_balances b
  JOIN public.inventory_variants v
    ON v.id = b.variant_id AND v.organization_id = b.organization_id
  JOIN public.inventory_products p
    ON p.id = v.product_id AND p.organization_id = b.organization_id
  WHERE b.organization_id = p_organization_id
    AND b.branch_id = p_branch_id
    AND (
      (v_count_type = 'location' AND b.location_id = ANY (v_location_ids))
      OR (
        v_count_type = 'supplier'
        AND v.default_supplier_id = v_supplier_id
        AND (array_length(v_location_filter_ids, 1) IS NULL OR b.location_id = ANY (v_location_filter_ids))
      )
    );

  -- Branch 2: optionally seed zero-stock catalog items that have no existing
  -- balance row. Scoped strictly to the explicit location set already
  -- resolved above (v_location_ids for count_type=location,
  -- v_location_filter_ids for count_type=supplier). If a supplier-scoped
  -- session sets include_zero_stock=true without a location_filter_ids
  -- narrowing, unnest() over the empty v_location_filter_ids array yields zero
  -- rows and this branch intentionally contributes nothing — rather than
  -- iterating every location in the branch for every matching-supplier
  -- variant, which would be an unbounded cross product. This boundary is
  -- documented in the implementation report as a concrete scope decision.
  IF v_include_zero_stock THEN
    SELECT coalesce(max(sequence_no), 0) INTO v_seq_offset
    FROM public.inventory_count_lines
    WHERE count_session_id = v_count_id;

    INSERT INTO public.inventory_count_lines (
      organization_id, branch_id, count_session_id, variant_id, location_id,
      lot_id, serial_id, expected_quantity, unit_id, status, source, sequence_no
    )
    SELECT
      p_organization_id, p_branch_id, v_count_id, v.id, loc_id,
      NULL, NULL, 0, p.base_unit_id, 'pending', 'generated',
      v_seq_offset + row_number() OVER (ORDER BY loc_id, v.id)
    FROM public.inventory_variants v
    JOIN public.inventory_products p
      ON p.id = v.product_id AND p.organization_id = v.organization_id
    CROSS JOIN unnest(
      CASE WHEN v_count_type = 'location' THEN v_location_ids ELSE v_location_filter_ids END
    ) AS loc_id
    WHERE v.organization_id = p_organization_id
      AND v.status = 'active'
      AND (v_count_type = 'location' OR v.default_supplier_id = v_supplier_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.inventory_count_lines existing
        WHERE existing.count_session_id = v_count_id
          AND existing.variant_id = v.id
          AND existing.location_id = loc_id
          AND existing.lot_id IS NULL
          AND existing.serial_id IS NULL
      );
  END IF;

  RETURN jsonb_build_object('count_session_id', v_count_id, 'count_number', upper(v_number), 'status', 'draft');
END;
$$;

-- -----------------------------------------------------------------------------
-- 1e. inventory_approve_count_session — all-or-nothing posting gate.
--     Movement-engine call shape is UNCHANGED (still
--     inventory_create_draft_movement -> inventory_post_movement, still no
--     direct UPDATE on inventory_balances). Still independently requires
--     warehouse.inventory.adjust.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inventory_approve_count_session(
  p_count_session_id uuid,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_session public.inventory_count_sessions%ROWTYPE;
  v_require_reason boolean;
  v_line record;
  v_increase_lines jsonb := '[]'::jsonb;
  v_decrease_lines jsonb := '[]'::jsonb;
  v_result jsonb;
BEGIN
  SELECT *
  INTO v_session
  FROM public.inventory_count_sessions
  WHERE id = p_count_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory count session not found';
  END IF;

  IF NOT public.has_branch_permission(v_session.organization_id, v_session.branch_id, 'warehouse.inventory.adjust') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.adjust permission';
  END IF;

  IF v_session.status NOT IN ('draft', 'counting', 'submitted') THEN
    RAISE EXCEPTION 'Inventory count cannot be approved in current status';
  END IF;

  v_require_reason := coalesce((v_session.scope ->> 'require_reason_for_variance')::boolean, true);

  -- All-or-nothing posting gate (plan §5). No partial posting exists — there
  -- is no scope flag or parameter that bypasses any of these four checks.
  IF EXISTS (
    SELECT 1 FROM public.inventory_count_lines
    WHERE count_session_id = v_session.id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Cannot post: session has unresolved pending lines';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.inventory_count_lines
    WHERE count_session_id = v_session.id AND status = 'needs_recount'
  ) THEN
    RAISE EXCEPTION 'Cannot post: session has lines flagged for recount';
  END IF;

  -- A counted line with variance_quantity = 0 is already resolved and is
  -- intentionally excluded from this check (plan §4/§5) — only counted lines
  -- with an actual discrepancy that were never approved block posting.
  IF EXISTS (
    SELECT 1 FROM public.inventory_count_lines
    WHERE count_session_id = v_session.id AND status = 'counted' AND variance_quantity <> 0
  ) THEN
    RAISE EXCEPTION 'Cannot post: session has counted variance lines that were not reviewed and approved';
  END IF;

  IF v_require_reason AND EXISTS (
    SELECT 1 FROM public.inventory_count_lines
    WHERE count_session_id = v_session.id
      AND status = 'approved'
      AND variance_quantity <> 0
      AND reason_code IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot post: session has approved variance lines missing a required reason code';
  END IF;

  -- Only approved lines with nonzero variance ever contribute to a movement.
  -- Skipped lines and zero-variance counted lines are excluded by this WHERE
  -- clause and never reach the increase/decrease arrays below.
  FOR v_line IN
    SELECT *
    FROM public.inventory_count_lines
    WHERE count_session_id = v_session.id
      AND status = 'approved'
      AND variance_quantity <> 0
    ORDER BY location_id, variant_id
  LOOP
    IF v_line.variance_quantity > 0 THEN
      v_increase_lines := v_increase_lines || jsonb_build_array(jsonb_build_object(
        'variant_id', v_line.variant_id,
        'destination_location_id', v_line.location_id,
        'lot_id', v_line.lot_id,
        'serial_id', v_line.serial_id,
        'unit_id', v_line.unit_id,
        'quantity', v_line.variance_quantity
      ));
    ELSE
      v_decrease_lines := v_decrease_lines || jsonb_build_array(jsonb_build_object(
        'variant_id', v_line.variant_id,
        'source_location_id', v_line.location_id,
        'lot_id', v_line.lot_id,
        'serial_id', v_line.serial_id,
        'unit_id', v_line.unit_id,
        'quantity', abs(v_line.variance_quantity)
      ));
    END IF;
  END LOOP;

  IF jsonb_array_length(v_increase_lines) > 0 THEN
    v_result := public.inventory_create_draft_movement(
      v_session.organization_id,
      v_session.branch_id,
      'adjustment',
      v_increase_lines,
      'increase',
      NULL,
      'Inventory count ' || v_session.count_number,
      'inventory_count',
      v_session.id::text,
      'count-increase-' || v_session.id::text,
      p_actor_user_id
    );
    PERFORM public.inventory_post_movement((v_result ->> 'movement_id')::uuid, p_actor_user_id);
  END IF;

  IF jsonb_array_length(v_decrease_lines) > 0 THEN
    v_result := public.inventory_create_draft_movement(
      v_session.organization_id,
      v_session.branch_id,
      'adjustment',
      v_decrease_lines,
      'decrease',
      NULL,
      'Inventory count ' || v_session.count_number,
      'inventory_count',
      v_session.id::text,
      'count-decrease-' || v_session.id::text,
      p_actor_user_id
    );
    PERFORM public.inventory_post_movement((v_result ->> 'movement_id')::uuid, p_actor_user_id);
  END IF;

  UPDATE public.inventory_count_sessions
  SET status = 'approved',
      approved_at = now(),
      approved_by = p_actor_user_id
  WHERE id = v_session.id;

  RETURN jsonb_build_object(
    'count_session_id', v_session.id,
    'count_number', v_session.count_number,
    'status', 'approved',
    'increase_lines', jsonb_array_length(v_increase_lines),
    'decrease_lines', jsonb_array_length(v_decrease_lines)
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 1f. inventory_count_session_list — new read-only aggregate RPC.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inventory_count_session_list(
  p_organization_id uuid,
  p_branch_id uuid,
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_page integer;
  v_page_size integer;
  v_offset integer;
  v_rows jsonb;
  v_total integer;
BEGIN
  IF NOT public.has_branch_permission(p_organization_id, p_branch_id, 'warehouse.audits.read') THEN
    RAISE EXCEPTION 'Missing warehouse.audits.read permission';
  END IF;

  v_page := greatest(coalesce(p_page, 1), 1);
  v_page_size := greatest(coalesce(p_page_size, 20), 1);
  v_offset := (v_page - 1) * v_page_size;

  SELECT count(*) INTO v_total
  FROM public.inventory_count_sessions s
  WHERE s.organization_id = p_organization_id
    AND s.branch_id = p_branch_id
    AND s.deleted_at IS NULL
    AND (p_status IS NULL OR s.status = p_status)
    AND (p_search IS NULL OR s.count_number ILIKE '%' || p_search || '%');

  SELECT coalesce(jsonb_agg(row_data), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'id', s.id,
      'count_number', s.count_number,
      'status', s.status,
      'scope', s.scope,
      'notes', s.notes,
      'created_by', s.created_by,
      'approved_by', s.approved_by,
      'created_at', s.created_at,
      'updated_at', s.updated_at,
      'approved_at', s.approved_at,
      'total_lines', coalesce(l.total_lines, 0),
      'counted_lines', coalesce(l.counted_lines, 0),
      'variance_lines', coalesce(l.variance_lines, 0)
    ) AS row_data
    FROM public.inventory_count_sessions s
    LEFT JOIN LATERAL (
      SELECT
        count(*) AS total_lines,
        count(*) FILTER (WHERE cl.status IN ('counted', 'approved')) AS counted_lines,
        count(*) FILTER (WHERE cl.variance_quantity <> 0 AND cl.status IN ('counted', 'approved')) AS variance_lines
      FROM public.inventory_count_lines cl
      WHERE cl.count_session_id = s.id
    ) l ON true
    WHERE s.organization_id = p_organization_id
      AND s.branch_id = p_branch_id
      AND s.deleted_at IS NULL
      AND (p_status IS NULL OR s.status = p_status)
      AND (p_search IS NULL OR s.count_number ILIKE '%' || p_search || '%')
    ORDER BY s.created_at DESC
    LIMIT v_page_size
    OFFSET v_offset
  ) sub;

  RETURN jsonb_build_object('rows', v_rows, 'total_count', v_total, 'page', v_page, 'page_size', v_page_size);
END;
$$;

-- -----------------------------------------------------------------------------
-- 1g. Permissions: warehouse.audits.read / warehouse.audits.manage.
--     Seeded to mirror the existing warehouse.inventory.read/.adjust grant
--     shape exactly (verified against live role_permissions data before
--     writing this): org_member has an explicit warehouse.inventory.read
--     grant and NO explicit warehouse.inventory.adjust grant (org_owner
--     covers both via the warehouse.* wildcard only). audits.read/manage
--     mirror that 1:1.
-- -----------------------------------------------------------------------------
INSERT INTO public.permissions (slug, name, category, action)
VALUES
  ('warehouse.audits.read',   'Warehouse Audits Read',   'warehouse', 'audits.read'),
  ('warehouse.audits.manage', 'Warehouse Audits Manage', 'warehouse', 'audits.manage')
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  v_member_id UUID;
  v_perm_id   UUID;
BEGIN
  SELECT id INTO v_member_id
  FROM public.roles
  WHERE name = 'org_member' AND is_basic = true
  LIMIT 1;

  IF v_member_id IS NOT NULL THEN
    SELECT id INTO v_perm_id FROM public.permissions WHERE slug = 'warehouse.audits.read';
    IF v_perm_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (v_member_id, v_perm_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  -- No explicit warehouse.audits.manage grant for org_member, matching the
  -- existing warehouse.inventory.adjust pattern (org_owner only, via wildcard).
END $$;

-- -----------------------------------------------------------------------------
-- 1g. RLS policy swap on the two existing count tables:
--     warehouse.inventory.read/.adjust -> warehouse.audits.read/.manage.
--     ENABLE/FORCE ROW LEVEL SECURITY state on these tables is untouched.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS inventory_count_sessions_select ON public.inventory_count_sessions;
DROP POLICY IF EXISTS inventory_count_sessions_adjust ON public.inventory_count_sessions;

CREATE POLICY inventory_count_sessions_select
  ON public.inventory_count_sessions FOR SELECT
  USING (deleted_at IS NULL AND public.has_branch_permission(organization_id, branch_id, 'warehouse.audits.read'));

CREATE POLICY inventory_count_sessions_manage
  ON public.inventory_count_sessions FOR ALL
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.audits.manage'))
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.audits.manage'));

DROP POLICY IF EXISTS inventory_count_lines_select ON public.inventory_count_lines;
DROP POLICY IF EXISTS inventory_count_lines_adjust ON public.inventory_count_lines;

CREATE POLICY inventory_count_lines_select
  ON public.inventory_count_lines FOR SELECT
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.audits.read'));

CREATE POLICY inventory_count_lines_manage
  ON public.inventory_count_lines FOR ALL
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.audits.manage'))
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.audits.manage'));

-- -----------------------------------------------------------------------------
-- 1h. New table: inventory_reorder_suggestion_actions (accept/ignore decisions
--     for the reorder report — see plan §7). Numbers are always computed live
--     from inventory_reorder_rules + inventory_balances; only the human
--     accept/ignore decision is persisted here.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_reorder_suggestion_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL,
  location_id uuid NULL,
  status text NOT NULL,
  actor_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  count_session_id uuid NULL REFERENCES public.inventory_count_sessions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_reorder_suggestion_actions_status_check
    CHECK (status IN ('accepted', 'ignored')),
  CONSTRAINT inventory_reorder_suggestion_actions_variant_fk
    FOREIGN KEY (variant_id, organization_id)
    REFERENCES public.inventory_variants (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT inventory_reorder_suggestion_actions_location_fk
    FOREIGN KEY (location_id, organization_id, branch_id)
    REFERENCES public.warehouse_locations (id, organization_id, branch_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS inventory_reorder_suggestion_actions_lookup_idx
  ON public.inventory_reorder_suggestion_actions (organization_id, branch_id, variant_id, location_id);

ALTER TABLE public.inventory_reorder_suggestion_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reorder_suggestion_actions FORCE ROW LEVEL SECURITY;

CREATE POLICY inventory_reorder_suggestion_actions_select
  ON public.inventory_reorder_suggestion_actions FOR SELECT
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.audits.read'));

CREATE POLICY inventory_reorder_suggestion_actions_manage
  ON public.inventory_reorder_suggestion_actions FOR ALL
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.audits.manage'))
  WITH CHECK (public.has_branch_permission(organization_id, branch_id, 'warehouse.audits.manage'));

-- -----------------------------------------------------------------------------
-- Recompute compiled permission snapshots for all active org members so the
-- two new slugs take effect immediately (same tail-block pattern used by
-- every prior permissions-affecting migration in this project).
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_member record;
BEGIN
  FOR v_member IN
    SELECT organization_id, user_id
    FROM public.organization_members
    WHERE status = 'active'
  LOOP
    PERFORM public.compile_user_permissions(v_member.user_id, v_member.organization_id);
  END LOOP;
END $$;
