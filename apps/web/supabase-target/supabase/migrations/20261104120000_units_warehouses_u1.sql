-- ============================================================================
-- U1 (docs/WAREHOUSE_UNITS_PLAN.md): jednostki and their magazyny
-- ============================================================================
-- A branch (e.g. Poznań Komorniki) holds several jednostki -- AutoStacja's
-- branches 3112 VW, 3252 Seat, 3332 Škoda, 3142 BC (table branch_warehouses,
-- codes exactly as in AS). A jednostka is divided into magazyny -- AS's
-- warehouses 110 / 115 / 116… (new table unit_warehouses, codes as in AS).
--
-- Managed in the branch settings by whoever may change branches
-- (branches.update) or holds warehouse.structure.manage for that branch
-- (owner via warehouse.*, kierownik magazynu, admin -- added to their roles).
--
-- Configuration only: stock, movements and locations do not change here.
-- ============================================================================

INSERT INTO public.permissions (slug, name, category, action)
VALUES ('warehouse.structure.manage', 'Warehouse Structure Manage', 'warehouse', 'structure.manage')
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.can_manage_branch_structure(p_org_id uuid, p_branch_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.is_org_member(p_org_id)
     AND (public.has_permission(p_org_id, 'branches.update')
          OR public.has_branch_permission(p_org_id, p_branch_id, 'warehouse.structure.manage'));
$function$;

REVOKE ALL ON FUNCTION public.can_manage_branch_structure(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_branch_structure(uuid, uuid) TO authenticated;

-- Jednostki: the same writers now include warehouse.structure.manage.
ALTER POLICY branch_warehouses_insert ON public.branch_warehouses
  WITH CHECK (deleted_at IS NULL AND public.can_manage_branch_structure(organization_id, branch_id));
ALTER POLICY branch_warehouses_update ON public.branch_warehouses
  USING (deleted_at IS NULL AND public.can_manage_branch_structure(organization_id, branch_id))
  WITH CHECK (public.can_manage_branch_structure(organization_id, branch_id));

-- Magazyny of a jednostka
CREATE TABLE IF NOT EXISTS public.unit_warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.branch_warehouses(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (code ~ '^[0-9]{2,5}$'),
  name text CHECK (name IS NULL OR length(trim(name)) BETWEEN 1 AND 80),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
-- A magazyn code is unique in the organization (as in AS: 115 is one magazyn)
CREATE UNIQUE INDEX IF NOT EXISTS unit_warehouses_org_code_unique
  ON public.unit_warehouses (organization_id, code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS unit_warehouses_unit_idx ON public.unit_warehouses (unit_id) WHERE deleted_at IS NULL;

ALTER TABLE public.branch_warehouses
  ADD COLUMN IF NOT EXISTS default_warehouse_id uuid REFERENCES public.unit_warehouses(id) ON DELETE SET NULL;

-- Organization / branch always follow the jednostka; the branch of a jednostka is fixed.
CREATE OR REPLACE FUNCTION public.unit_warehouses_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_unit record;
BEGIN
  SELECT organization_id, branch_id INTO v_unit
  FROM public.branch_warehouses WHERE id = NEW.unit_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jednostka not found' USING ERRCODE = '22023';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.unit_id := OLD.unit_id;
    NEW.created_by := OLD.created_by;
  END IF;
  NEW.organization_id := v_unit.organization_id;
  NEW.branch_id := v_unit.branch_id;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE TRIGGER unit_warehouses_guard BEFORE INSERT OR UPDATE ON public.unit_warehouses
  FOR EACH ROW EXECUTE FUNCTION public.unit_warehouses_guard();

-- The default magazyn of a jednostka is one of its own magazyny.
CREATE OR REPLACE FUNCTION public.branch_warehouses_default_check()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.default_warehouse_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.unit_warehouses w
    WHERE w.id = NEW.default_warehouse_id AND w.unit_id = NEW.id AND w.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'The default magazyn must belong to the jednostka' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE TRIGGER branch_warehouses_default_check BEFORE INSERT OR UPDATE OF default_warehouse_id
  ON public.branch_warehouses FOR EACH ROW EXECUTE FUNCTION public.branch_warehouses_default_check();

ALTER TABLE public.unit_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_warehouses FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.unit_warehouses FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.unit_warehouses TO authenticated;

CREATE POLICY unit_warehouses_select ON public.unit_warehouses
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.is_org_member(organization_id));
CREATE POLICY unit_warehouses_insert ON public.unit_warehouses
  FOR INSERT TO authenticated
  WITH CHECK (deleted_at IS NULL AND public.can_manage_branch_structure(organization_id, branch_id));
CREATE POLICY unit_warehouses_update ON public.unit_warehouses
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND public.can_manage_branch_structure(organization_id, branch_id))
  WITH CHECK (public.can_manage_branch_structure(organization_id, branch_id));
CREATE POLICY unit_warehouses_delete_deny ON public.unit_warehouses
  FOR DELETE TO authenticated USING (false);

-- Removing a jednostka (soft): its magazyny go with it.
CREATE OR REPLACE FUNCTION public.branch_warehouse_remove(p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  SELECT organization_id, branch_id INTO v_row
  FROM public.branch_warehouses WHERE id = p_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF NOT public.can_manage_branch_structure(v_row.organization_id, v_row.branch_id) THEN
    RAISE EXCEPTION 'Not allowed to change the jednostki of this branch' USING ERRCODE = '42501';
  END IF;
  UPDATE public.branch_warehouses SET default_warehouse_id = NULL WHERE id = p_id;
  UPDATE public.unit_warehouses SET deleted_at = now() WHERE unit_id = p_id AND deleted_at IS NULL;
  UPDATE public.branch_warehouses SET deleted_at = now() WHERE id = p_id;
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.unit_warehouse_remove(p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  SELECT organization_id, branch_id, unit_id INTO v_row
  FROM public.unit_warehouses WHERE id = p_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF NOT public.can_manage_branch_structure(v_row.organization_id, v_row.branch_id) THEN
    RAISE EXCEPTION 'Not allowed to change the magazyny of this branch' USING ERRCODE = '42501';
  END IF;
  UPDATE public.branch_warehouses SET default_warehouse_id = NULL
  WHERE id = v_row.unit_id AND default_warehouse_id = p_id;
  UPDATE public.unit_warehouses SET deleted_at = now() WHERE id = p_id;
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.unit_warehouse_remove(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unit_warehouse_remove(uuid) TO authenticated;

-- What the Matcher saw and the branch does not have yet: jednostki (from ZW
-- numbers) and magazyny (from block headers), with how often and the
-- jednostka a magazyn appeared with. Suggestions only; nothing is added.
CREATE OR REPLACE FUNCTION public.branch_structure_suggestions(p_org_id uuid, p_branch_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH seen AS (
    SELECT
      NULLIF(split_part(COALESCE(b.metadata->>'zw_number', ''), '/', 4), '') AS unit_code,
      NULLIF(trim(b.metadata->>'warehouse_code'), '') AS warehouse_code,
      NULLIF(trim(b.metadata->>'warehouse_section_label'), '') AS warehouse_label,
      NULLIF(trim(b.metadata->>'dealer_name'), '') AS dealer_name
    FROM public.wdd_matcher_blocks b
    JOIN public.wdd_matcher_sessions s ON s.id = b.session_id
    WHERE s.organization_id = p_org_id AND s.branch_id = p_branch_id
      AND public.is_org_member(p_org_id)
  ),
  units AS (
    SELECT unit_code AS code, count(*) AS seen,
           (array_agg(dealer_name ORDER BY dealer_name) FILTER (WHERE dealer_name IS NOT NULL))[1] AS name
    FROM seen
    WHERE unit_code ~ '^[0-9]{3,5}$'
      AND NOT EXISTS (SELECT 1 FROM public.branch_warehouses w
                      WHERE w.organization_id = p_org_id AND w.code = seen.unit_code AND w.deleted_at IS NULL)
    GROUP BY unit_code
  ),
  warehouses AS (
    SELECT warehouse_code AS code, count(*) AS seen,
           mode() WITHIN GROUP (ORDER BY unit_code) AS unit_code,
           mode() WITHIN GROUP (ORDER BY warehouse_label) AS name
    FROM seen
    WHERE warehouse_code ~ '^[0-9]{2,5}$'
      AND NOT EXISTS (SELECT 1 FROM public.unit_warehouses w
                      WHERE w.organization_id = p_org_id AND w.code = seen.warehouse_code AND w.deleted_at IS NULL)
    GROUP BY warehouse_code
  )
  SELECT jsonb_build_object(
    'units', COALESCE((SELECT jsonb_agg(jsonb_build_object('code', code, 'name', name, 'seen', seen) ORDER BY code) FROM units), '[]'::jsonb),
    'warehouses', COALESCE((SELECT jsonb_agg(jsonb_build_object('code', code, 'name', name, 'unitCode', unit_code, 'seen', seen) ORDER BY code) FROM warehouses), '[]'::jsonb)
  );
$function$;

REVOKE ALL ON FUNCTION public.branch_structure_suggestions(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.branch_structure_suggestions(uuid, uuid) TO authenticated;

-- Owners get the new slug through warehouse.*: recompile everyone once.
DO $do$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT m.user_id, m.organization_id
    FROM public.organization_members m
    WHERE m.deleted_at IS NULL
  LOOP
    BEGIN
      PERFORM public.compile_user_permissions(r.user_id, r.organization_id);
    EXCEPTION WHEN OTHERS THEN
      -- A user the compiler cannot handle (known overlap issue) keeps their snapshot
      RAISE NOTICE 'compile_user_permissions(%, %) failed: %', r.user_id, r.organization_id, SQLERRM;
    END;
  END LOOP;
END
$do$;
