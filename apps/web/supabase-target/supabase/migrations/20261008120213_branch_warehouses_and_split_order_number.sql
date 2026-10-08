-- Zone 3: DMS warehouses per branch and the split repair-order number.
--
-- A repair-order number from the DMS looks like ZL/178024/26/3122/BL:
--   prefix (ZL / ZLEC, set by the warehouse) / number / year / warehouse code / BL.
-- The same number can exist in two warehouses (e.g. 3112 Volkswagen and 3332 Škoda), so the
-- warehouse is part of the order's identity. Until now only the whole string was stored.
--
-- 1. branch_warehouses: the warehouses a branch owns (code, brand name, number prefix),
--    managed in the branch settings with branches.update. A code belongs to one branch.
-- 2. repair_orders gets order_prefix / order_no / order_year / warehouse_code, always derived
--    from zl_number by a trigger (they cannot drift from it), backfilled here, and a unique
--    key per branch on warehouse + number + year.
-- Additive only: no existing column, policy or index is changed.

-- ---------------------------------------------------------------------------
-- 1. Branch warehouses
-- ---------------------------------------------------------------------------
CREATE TABLE public.branch_warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  code text NOT NULL CHECK (code ~ '^[0-9]{3,5}$'),
  name text CHECK (name IS NULL OR char_length(name) <= 80),
  order_prefix text NOT NULL DEFAULT 'ZL' CHECK (order_prefix IN ('ZL', 'ZLEC')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

COMMENT ON TABLE public.branch_warehouses IS
  'DMS warehouses (magazyny) of a branch, e.g. 3112 Volkswagen, 3332 Škoda. A code belongs to one branch per organization; order_prefix is the repair-order number prefix used by that warehouse (ZL / ZLEC).';

CREATE UNIQUE INDEX branch_warehouses_org_code_unique
  ON public.branch_warehouses (organization_id, code) WHERE deleted_at IS NULL;
CREATE INDEX branch_warehouses_branch_idx
  ON public.branch_warehouses (organization_id, branch_id) WHERE deleted_at IS NULL;

-- The branch must belong to the same organization; org/branch never change after insert.
CREATE OR REPLACE FUNCTION public.branch_warehouses_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.organization_id := OLD.organization_id;
    NEW.branch_id := OLD.branch_id;
    NEW.created_by := OLD.created_by;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.branches b
    WHERE b.id = NEW.branch_id AND b.organization_id = NEW.organization_id AND b.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Branch does not belong to the organization' USING ERRCODE = '22023';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER branch_warehouses_guard
  BEFORE INSERT OR UPDATE ON public.branch_warehouses
  FOR EACH ROW EXECUTE FUNCTION public.branch_warehouses_guard();

ALTER TABLE public.branch_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_warehouses FORCE ROW LEVEL SECURITY;

CREATE POLICY branch_warehouses_select ON public.branch_warehouses
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.is_org_member(organization_id));

CREATE POLICY branch_warehouses_insert ON public.branch_warehouses
  FOR INSERT TO authenticated
  WITH CHECK (
    deleted_at IS NULL
    AND public.is_org_member(organization_id)
    AND public.has_permission(organization_id, 'branches.update')
  );

-- Updates (including the soft delete) by branch managers. No SELECT re-check problem: the
-- soft delete is done by branch_warehouse_remove() below.
CREATE POLICY branch_warehouses_update ON public.branch_warehouses
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND public.is_org_member(organization_id)
         AND public.has_permission(organization_id, 'branches.update'))
  WITH CHECK (deleted_at IS NULL AND public.is_org_member(organization_id)
              AND public.has_permission(organization_id, 'branches.update'));

CREATE POLICY branch_warehouses_delete_deny ON public.branch_warehouses
  FOR DELETE TO authenticated USING (false);

GRANT SELECT, INSERT, UPDATE ON public.branch_warehouses TO authenticated;

-- Soft delete (an UPDATE setting deleted_at would fail the SELECT policy re-check).
CREATE OR REPLACE FUNCTION public.branch_warehouse_remove(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  SELECT organization_id INTO v_org FROM public.branch_warehouses WHERE id = p_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN
    RETURN false;
  END IF;
  IF NOT (public.is_org_member(v_org) AND public.has_permission(v_org, 'branches.update')) THEN
    RAISE EXCEPTION 'Not allowed to change warehouses of this organization' USING ERRCODE = '42501';
  END IF;
  UPDATE public.branch_warehouses SET deleted_at = now() WHERE id = p_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.branch_warehouse_remove(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.branch_warehouse_remove(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Split repair-order number
-- ---------------------------------------------------------------------------
ALTER TABLE public.repair_orders
  ADD COLUMN order_prefix text,
  ADD COLUMN order_no text,
  ADD COLUMN order_year smallint,
  ADD COLUMN warehouse_code text;

COMMENT ON COLUMN public.repair_orders.warehouse_code IS
  'DMS warehouse of the order (e.g. 3122), derived from zl_number (ZL/<no>/<yy>/<warehouse>/BL). NULL when zl_number is not in the full DMS format.';
COMMENT ON COLUMN public.repair_orders.order_no IS 'Order number without prefix / year / warehouse, derived from zl_number.';

-- Pure parser, reused by the trigger and by readers (search, portal lookup).
CREATE OR REPLACE FUNCTION public.parse_repair_order_number(p_zl text)
RETURNS TABLE (order_prefix text, order_no text, order_year smallint, warehouse_code text)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT upper(m[1]), m[2], m[3]::smallint % 100, m[4]
  FROM (SELECT regexp_match(btrim(p_zl), '^(ZLEC|ZL)/([0-9]+)/([0-9]{2,4})/([0-9]{3,5})(/|$)', 'i') AS m) s
  WHERE m IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.repair_orders_split_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  r record;
BEGIN
  SELECT * INTO r FROM public.parse_repair_order_number(NEW.zl_number);
  IF FOUND THEN
    NEW.order_prefix := r.order_prefix;
    NEW.order_no := r.order_no;
    NEW.order_year := r.order_year;
    NEW.warehouse_code := r.warehouse_code;
  ELSE
    NEW.order_prefix := NULL;
    NEW.order_no := NULL;
    NEW.order_year := NULL;
    NEW.warehouse_code := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER repair_orders_split_number
  BEFORE INSERT OR UPDATE ON public.repair_orders
  FOR EACH ROW EXECUTE FUNCTION public.repair_orders_split_number();

-- Backfill (the trigger fills the columns on this no-op update).
UPDATE public.repair_orders SET zl_number = zl_number WHERE zl_number IS NOT NULL;

CREATE UNIQUE INDEX repair_orders_warehouse_number_unique
  ON public.repair_orders (organization_id, branch_id, warehouse_code, order_no, order_year)
  WHERE warehouse_code IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX repair_orders_order_no_idx
  ON public.repair_orders (organization_id, order_no) WHERE deleted_at IS NULL;
