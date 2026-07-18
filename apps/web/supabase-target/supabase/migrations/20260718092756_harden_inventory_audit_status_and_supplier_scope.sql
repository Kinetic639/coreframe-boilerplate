-- Harden inventory-audit workflow transitions and connect supplier-scoped
-- audits to CRM item suppliers while preserving the legacy inventory supplier
-- path for existing data.

-- ---------------------------------------------------------------------------
-- 1. Supplier-scope matching helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.inventory_variant_matches_audit_supplier(
  p_organization_id uuid,
  p_variant_id uuid,
  p_product_id uuid,
  p_legacy_supplier_id uuid,
  p_supplier_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_matches boolean := false;
BEGIN
  IF p_supplier_id IS NULL THEN
    RETURN false;
  END IF;

  IF p_legacy_supplier_id = p_supplier_id THEN
    RETURN true;
  END IF;

  IF to_regclass('public.warehouse_item_suppliers') IS NULL THEN
    RETURN false;
  END IF;

  EXECUTE
    'SELECT EXISTS (
       SELECT 1
       FROM public.warehouse_item_suppliers wis
       WHERE wis.organization_id = $1
         AND wis.item_id = $2
         AND wis.party_id = $3
         AND wis.deleted_at IS NULL
     )'
  INTO v_matches
  USING p_organization_id, p_product_id, p_supplier_id;

  RETURN coalesce(v_matches, false);
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.warehouse_item_suppliers') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS warehouse_item_suppliers_audit_supplier_idx
      ON public.warehouse_item_suppliers (organization_id, party_id, item_id)
      WHERE deleted_at IS NULL';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Recompile session creation so supplier audits include CRM item suppliers
-- ---------------------------------------------------------------------------

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
    AND (v_include_zero_stock OR b.on_hand_quantity > 0)
    AND (
      (v_count_type = 'location' AND b.location_id = ANY (v_location_ids))
      OR (
        v_count_type = 'supplier'
        AND public.inventory_variant_matches_audit_supplier(
          p_organization_id,
          v.id,
          p.id,
          v.default_supplier_id,
          v_supplier_id
        )
        AND (array_length(v_location_filter_ids, 1) IS NULL OR b.location_id = ANY (v_location_filter_ids))
      )
    );

  RETURN jsonb_build_object('count_session_id', v_count_id, 'count_number', upper(v_number), 'status', 'draft');
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Session workflow transition guard
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.inventory_count_sessions_guard_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('approved', 'cancelled') THEN
    RAISE EXCEPTION 'Inventory count session is % and can no longer be changed', OLD.status
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' THEN
    IF NEW.approved_at IS NULL OR NEW.approved_by IS NULL THEN
      RAISE EXCEPTION 'Approving an inventory count session requires approved_at and approved_by'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status = 'draft' AND NEW.status IN ('counting', 'submitted'))
    OR (OLD.status = 'counting' AND NEW.status IN ('counting', 'submitted'))
    OR (OLD.status = 'submitted' AND NEW.status = 'submitted')
  ) THEN
    RAISE EXCEPTION 'Cannot move an inventory count session from % to %', OLD.status, NEW.status
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_count_sessions_guard_status_trigger
  ON public.inventory_count_sessions;

CREATE TRIGGER inventory_count_sessions_guard_status_trigger
  BEFORE UPDATE ON public.inventory_count_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.inventory_count_sessions_guard_status();

-- ---------------------------------------------------------------------------
-- 4. Count-line guard: closed session, same-session, and reason enforcement
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.inventory_count_lines_guard_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_session record;
  v_variance numeric;
  v_requires_reason boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.count_session_id IS DISTINCT FROM NEW.count_session_id THEN
      RAISE EXCEPTION 'Inventory count lines cannot be moved between sessions'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  SELECT id, status, scope
  INTO v_session
  FROM public.inventory_count_sessions
  WHERE id = NEW.count_session_id
    AND organization_id = NEW.organization_id
    AND branch_id = NEW.branch_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory count line must belong to a session in the same organization and branch'
      USING ERRCODE = '23514';
  END IF;

  IF v_session.status IN ('approved', 'cancelled') THEN
    RAISE EXCEPTION 'Inventory count session is % and can no longer be changed', v_session.status
      USING ERRCODE = '23514';
  END IF;

  v_requires_reason := coalesce((v_session.scope ->> 'require_reason_for_variance')::boolean, true);
  v_variance := coalesce(NEW.counted_quantity, NEW.expected_quantity) - NEW.expected_quantity;

  IF NEW.status = 'approved'
     AND v_requires_reason
     AND v_variance <> 0
     AND nullif(btrim(coalesce(NEW.reason_code, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required to approve a line with a quantity variance'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_count_lines_guard_session_trigger
  ON public.inventory_count_lines;

CREATE TRIGGER inventory_count_lines_guard_session_trigger
  BEFORE INSERT OR UPDATE ON public.inventory_count_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.inventory_count_lines_guard_session();
