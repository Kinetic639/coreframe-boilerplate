-- ============================================================================
-- U4: MMJ between jednostki, also within one branch (docs/WAREHOUSE_UNITS_PLAN.md)
-- ============================================================================
-- * An MMJ names its source magazyn and its target jednostka + magazyn
--   (3112/115 -> 3332/315). The target may be in the same branch: it is
--   received there without switching branches. The flow is unchanged:
--   prepared (reserved) -> in transit -> received in full.
-- * The pair of documents is numbered as in AutoStacja: MMJ-(115)/nr/rr/3112
--   at the sender, MMJ+(315)/nr/rr/3332 at the receiver, each in its own
--   series. An MMJ- never takes more than the source magazyn holds.
-- * A ZW whose recipient is a jednostka code (3252…) finds its branch
--   through the jednostka, besides the branch's external codes.
-- * MMJ without magazyny (between branches, as before) keeps its numbering.
-- ============================================================================

-- 1. The magazyny of a transfer ---------------------------------------------------

ALTER TABLE public.inventory_branch_transfers
  ADD COLUMN IF NOT EXISTS source_warehouse_id uuid REFERENCES public.unit_warehouses(id),
  ADD COLUMN IF NOT EXISTS destination_warehouse_id uuid REFERENCES public.unit_warehouses(id);

COMMENT ON COLUMN public.inventory_branch_transfers.source_warehouse_id IS
  'MMJ: magazyn the parts leave (AutoStacja), NULL for a transfer without magazyny';
COMMENT ON COLUMN public.inventory_branch_transfers.destination_warehouse_id IS
  'MMJ: magazyn of the target jednostka the parts are received into';

-- 2. A transfer within one branch is allowed when it goes to another jednostka

DO $do$
DECLARE
  v_def text;
  v_new text;
BEGIN
  v_def := pg_get_functiondef(
    'public.inventory_create_branch_transfer(uuid,uuid,uuid,jsonb,text,uuid)'::regprocedure);
  IF position('ambra.unit_transfer' IN v_def) = 0 THEN
    v_new := replace(v_def,
      $a$  IF p_source_branch_id = p_destination_branch_id THEN$a$,
      $b$  IF p_source_branch_id = p_destination_branch_id
     AND COALESCE(current_setting('ambra.unit_transfer', true), '') <> 'on' THEN$b$);
    IF v_new = v_def THEN
      RAISE EXCEPTION 'inventory_create_branch_transfer patch did not apply';
    END IF;
    EXECUTE v_new;
  END IF;
END
$do$;

CREATE OR REPLACE FUNCTION public.inventory_create_unit_transfer(
  p_organization_id uuid,
  p_source_branch_id uuid,
  p_source_warehouse_id uuid,
  p_destination_warehouse_id uuid,
  p_lines jsonb,
  p_notes text,
  p_actor_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
-- MMJ from a magazyn of the active branch to a magazyn of another jednostka,
-- in this branch or another one of the organization.
DECLARE
  v_src record;
  v_dst record;
  v_created jsonb;
  v_transfer_id uuid;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  SELECT w.id, w.branch_id, w.unit_id, u.code AS unit_code INTO v_src
  FROM public.unit_warehouses w JOIN public.branch_warehouses u ON u.id = w.unit_id
  WHERE w.id = p_source_warehouse_id AND w.organization_id = p_organization_id
    AND w.deleted_at IS NULL AND u.deleted_at IS NULL;
  IF NOT FOUND OR v_src.branch_id IS DISTINCT FROM p_source_branch_id THEN
    RAISE EXCEPTION 'The source magazyn must belong to the active branch' USING ERRCODE = '22023';
  END IF;

  SELECT w.id, w.branch_id, w.unit_id, u.code AS unit_code INTO v_dst
  FROM public.unit_warehouses w JOIN public.branch_warehouses u ON u.id = w.unit_id
  WHERE w.id = p_destination_warehouse_id AND w.organization_id = p_organization_id
    AND w.deleted_at IS NULL AND u.deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The target magazyn does not exist in the organization' USING ERRCODE = '22023';
  END IF;
  IF v_dst.unit_id = v_src.unit_id THEN
    RAISE EXCEPTION 'Within one jednostka the parts move by MM, not MMJ' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('ambra.unit_transfer', 'on', true);
  v_created := public.inventory_create_branch_transfer(
    p_organization_id, p_source_branch_id, v_dst.branch_id, p_lines, p_notes, p_actor_user_id);
  PERFORM set_config('ambra.unit_transfer', '', true);
  v_transfer_id := (v_created->>'transfer_id')::uuid;

  UPDATE public.inventory_branch_transfers
  SET source_warehouse_id = v_src.id,
      destination_warehouse_id = v_dst.id,
      source_unit_code = v_src.unit_code,
      destination_unit_code = v_dst.unit_code,
      updated_at = now()
  WHERE id = v_transfer_id;

  RETURN v_created || jsonb_build_object(
    'destination_branch_id', v_dst.branch_id,
    'source_unit_code', v_src.unit_code,
    'destination_unit_code', v_dst.unit_code);
END;
$$;

GRANT EXECUTE ON FUNCTION public.inventory_create_unit_transfer(
  uuid, uuid, uuid, uuid, jsonb, text, uuid) TO authenticated;

-- 3. On receipt, MMJ- and MMJ+ carry their magazyny -------------------------------

DO $do$
DECLARE
  v_def text;
  v_new text;
BEGIN
  v_def := pg_get_functiondef(
    'public.inventory_accept_branch_transfer(uuid,uuid,uuid,jsonb)'::regprocedure);
  IF position('source_warehouse_id' IN v_def) = 0 THEN
    v_new := replace(v_def,
      $a$    status, reference_type, reference_id, external_reference, idempotency_key, created_by
  ) VALUES ($a$,
      $b$    status, reference_type, reference_id, external_reference, idempotency_key, created_by,
    warehouse_id
  ) VALUES ($b$);
    v_new := replace(v_new,
      $a$'branch-transfer-out-' || v_transfer.id::text, p_actor_user_id);$a$,
      $b$'branch-transfer-out-' || v_transfer.id::text, p_actor_user_id,
    v_transfer.source_warehouse_id);$b$);
    v_new := replace(v_new,
      $a$'branch-transfer-in-' || v_transfer.id::text, p_actor_user_id);$a$,
      $b$'branch-transfer-in-' || v_transfer.id::text, p_actor_user_id,
    v_transfer.destination_warehouse_id);$b$);
    IF (length(v_new) - length(v_def)) <> 2 * length(E',\n    warehouse_id')
         + length(E',\n    v_transfer.source_warehouse_id')
         + length(E',\n    v_transfer.destination_warehouse_id') THEN
      RAISE EXCEPTION 'inventory_accept_branch_transfer patch did not apply cleanly';
    END IF;
    EXECUTE v_new;
  END IF;
END
$do$;

-- 4. Numbering: MMJ-(magazyn)/nr/rr/jednostka, MMJ+(magazyn)/… --------------------

CREATE OR REPLACE FUNCTION public.inventory_document_number_parts(p_movement_id uuid)
RETURNS TABLE (prefix text, warehouse_code text, unit_code text, document_type_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_header record;
  v_issue record;
  v_wh uuid;
  v_prefix text;
  v_whs uuid[];
  v_dt uuid;
BEGIN
  SELECT h.id, h.organization_id, h.movement_type_code, h.warehouse_id, h.original_movement_id,
         h.reference_type, h.reference_id, dt.code AS doc_code, dt.id AS dt_id
  INTO v_header
  FROM public.inventory_movement_headers h
  JOIN public.inventory_movement_types mt ON mt.id = h.movement_type_id
  JOIN public.inventory_document_types dt ON dt.id = mt.document_type_id
  WHERE h.id = p_movement_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  -- An MMJ without magazyny keeps its own numbering (MMJ-/nr/rr/jednostka).
  IF v_header.movement_type_code IN ('303', '305') AND v_header.warehouse_id IS NULL THEN
    RETURN;
  END IF;

  v_wh := v_header.warehouse_id;
  v_issue := v_header;

  IF v_header.movement_type_code = '900' AND v_header.original_movement_id IS NOT NULL THEN
    SELECT o.id, o.movement_type_code, o.warehouse_id, o.reference_type, o.reference_id,
           dt.code AS doc_code
    INTO v_issue
    FROM public.inventory_movement_headers o
    JOIN public.inventory_movement_types mt ON mt.id = o.movement_type_id
    JOIN public.inventory_document_types dt ON dt.id = mt.document_type_id
    WHERE o.id = v_header.original_movement_id;
    v_wh := COALESCE(v_wh, v_issue.warehouse_id);
    v_prefix := 'K' || CASE WHEN v_issue.movement_type_code = '261' THEN 'WU' ELSE v_issue.doc_code END;
  ELSE
    v_prefix := CASE WHEN v_header.movement_type_code = '261' THEN 'WU' ELSE v_header.doc_code END;
  END IF;

  -- An issue to a repair order (WU) takes the magazyn of the order's
  -- reservations of the issued parts; it is one magazyn, as every document.
  IF v_wh IS NULL AND v_issue.movement_type_code = '261'
     AND v_issue.reference_type = 'repair_order' THEN
    SELECT array_agg(DISTINCT rl.warehouse_id) INTO v_whs
    FROM public.inventory_movement_lines ml
    JOIN public.repair_order_lines rol ON rol.repair_order_id::text = v_issue.reference_id
    JOIN public.inventory_reservation_lines rl
      ON rl.repair_order_line_id = rol.id AND rl.variant_id = ml.variant_id
    WHERE ml.movement_id = v_issue.id AND ml.deleted_at IS NULL AND rl.warehouse_id IS NOT NULL;
    IF array_length(v_whs, 1) > 1 AND v_header.movement_type_code = '261' THEN
      RAISE EXCEPTION 'A WU issues parts of one magazyn: issue the other magazyn separately or move the parts by MM first'
        USING ERRCODE = '22023';
    END IF;
    IF array_length(v_whs, 1) = 1 THEN
      v_wh := v_whs[1];
    END IF;
  END IF;

  IF v_wh IS NULL THEN
    RETURN;  -- without magazyn: old numbering
  END IF;

  SELECT d.id INTO v_dt
  FROM public.inventory_document_types d
  JOIN public.inventory_movement_types t ON t.document_type_id = d.id
  WHERE d.code = v_prefix
    AND (t.organization_id IS NULL OR t.organization_id = v_header.organization_id)
  ORDER BY d.id
  LIMIT 1;

  RETURN QUERY
  SELECT v_prefix, w.code, u.code, COALESCE(v_dt, v_header.dt_id)
  FROM public.unit_warehouses w
  JOIN public.branch_warehouses u ON u.id = w.unit_id
  WHERE w.id = v_wh;
END;
$$;

-- 5. MMJ- out of a magazyn: never more than it holds ------------------------------

DO $do$
DECLARE
  v_def text;
  v_new text;
BEGIN
  v_def := pg_get_functiondef('public.inventory_warehouse_stock_apply()'::regprocedure);
  IF position($q$movement_type_code = '303'$q$ IN v_def) = 0 THEN
    v_new := replace(v_def,
      $a$  IF v_header.movement_type_code = '801' AND v_line.destination_warehouse_id IS NOT NULL
     AND v_delta < 0 AND v_after < 0 THEN$a$,
      $b$  IF ((v_header.movement_type_code = '801' AND v_line.destination_warehouse_id IS NOT NULL)
      OR (v_header.movement_type_code = '303' AND v_line.warehouse_id IS NOT NULL))
     AND v_delta < 0 AND v_after < 0 THEN$b$);
    IF v_new = v_def THEN
      RAISE EXCEPTION 'inventory_warehouse_stock_apply patch did not apply';
    END IF;
    EXECUTE v_new;
  END IF;
END
$do$;

-- 6. A ZW to a jednostka code finds the jednostka's branch ------------------------

CREATE OR REPLACE FUNCTION public.internal_order_destination_branch_internal(p_internal_order_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT COALESCE(io.destination_branch_id, (
    SELECT b.id FROM public.branches b
    WHERE b.organization_id = io.organization_id AND b.deleted_at IS NULL AND b.id <> io.branch_id
      AND (upper(COALESCE(io.destination_code, '')) = ANY (b.external_codes)
           OR substring(COALESCE(io.client_name, '') from '^\s*(\d{3,6})\M') = ANY (b.external_codes)
           OR EXISTS (
             SELECT 1 FROM public.branch_warehouses u
             WHERE u.organization_id = io.organization_id AND u.branch_id = b.id
               AND u.deleted_at IS NULL
               AND (u.code = upper(COALESCE(io.destination_code, ''))
                    OR u.code = substring(COALESCE(io.client_name, '') from '^\s*(\d{3,6})\M'))))
    ORDER BY (upper(COALESCE(io.destination_code, '')) = ANY (b.external_codes)) DESC
    LIMIT 1))
  FROM public.internal_orders io
  WHERE io.id = p_internal_order_id;
$$;
