-- ============================================================================
-- U3: one document = one AutoStacja magazyn; numbering as in AutoStacja;
--     MM between magazyny of one jednostka (docs/WAREHOUSE_UNITS_PLAN.md)
-- ============================================================================
-- * A movement document belongs to one magazyn (Ustawa o rachunkowości:
--   stock records and counts per place of storage; JPK_MAG per magazyn).
--   inventory_movement_headers.warehouse_id is the document's magazyn, set
--   from its lines; a line of another magazyn is refused.
-- * MM (801) may also move stock to another magazyn of the same jednostka
--   (destination_warehouse_id), with or without changing the shelf. Moving
--   out more than the magazyn holds is refused.
-- * Number TYP(magazyn)/nr/rr/jednostka, e.g. PZ(115)/1/26/3112, counted per
--   document type + magazyn + year. 261 is numbered WU (wydanie na serwis),
--   its storno KWU; other stornos KOR. MMJ-/MMJ+ keep their numbering (U4).
--   A document without magazyn keeps the old numbering.
-- * The history of stock per magazyn is locked in 20261104190100 (run in
--   the SQL editor: the MCP declines a trigger on DELETE).
-- ============================================================================

-- 1. Columns --------------------------------------------------------------------

ALTER TABLE public.inventory_movement_headers
  ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.unit_warehouses(id),
  ADD COLUMN IF NOT EXISTS destination_warehouse_id uuid REFERENCES public.unit_warehouses(id);
ALTER TABLE public.inventory_movement_lines
  ADD COLUMN IF NOT EXISTS destination_warehouse_id uuid REFERENCES public.unit_warehouses(id);

COMMENT ON COLUMN public.inventory_movement_headers.warehouse_id IS
  'AutoStacja magazyn of the document (one per document); NULL = without magazyn';
COMMENT ON COLUMN public.inventory_movement_headers.destination_warehouse_id IS
  'MM (801): target magazyn of the same jednostka';
COMMENT ON COLUMN public.inventory_movement_lines.destination_warehouse_id IS
  'MM (801): target magazyn of the same jednostka';

CREATE INDEX IF NOT EXISTS inventory_movement_headers_warehouse_idx
  ON public.inventory_movement_headers (warehouse_id) WHERE warehouse_id IS NOT NULL;

-- 2. A line: magazyn of its branch, one magazyn per document, MM in one jednostka

CREATE OR REPLACE FUNCTION public.inventory_line_warehouse_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_header record;
  v_orig record;
  v_src_unit uuid;
  v_dst_unit uuid;
BEGIN
  SELECT h.id, h.movement_type_code, h.original_movement_id, h.warehouse_id,
         h.destination_warehouse_id
  INTO v_header
  FROM public.inventory_movement_headers h WHERE h.id = NEW.movement_id;

  -- A storno line books back to the magazyny of the original line.
  IF v_header.movement_type_code = '900' AND v_header.original_movement_id IS NOT NULL
     AND NEW.warehouse_id IS NULL AND NEW.destination_warehouse_id IS NULL THEN
    SELECT ol.warehouse_id, ol.destination_warehouse_id INTO v_orig
    FROM public.inventory_movement_lines ol
    WHERE ol.movement_id = v_header.original_movement_id
      AND ol.line_number = NEW.line_number AND ol.deleted_at IS NULL;
    NEW.warehouse_id := v_orig.warehouse_id;
    NEW.destination_warehouse_id := v_orig.destination_warehouse_id;
  END IF;

  -- Lines without a magazyn of their own take the document's.
  IF NEW.warehouse_id IS NULL THEN
    NEW.warehouse_id := v_header.warehouse_id;
  END IF;
  IF NEW.destination_warehouse_id IS NULL THEN
    NEW.destination_warehouse_id := v_header.destination_warehouse_id;
  END IF;

  IF NEW.warehouse_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.unit_warehouses w
    WHERE w.id = NEW.warehouse_id AND w.organization_id = NEW.organization_id
      AND w.branch_id = NEW.branch_id
  ) THEN
    RAISE EXCEPTION 'Magazyn does not belong to this branch' USING ERRCODE = '22023';
  END IF;

  IF NEW.destination_warehouse_id IS NOT NULL THEN
    IF v_header.movement_type_code NOT IN ('801', '900') THEN
      RAISE EXCEPTION 'Only an MM moves stock to another magazyn' USING ERRCODE = '22023';
    END IF;
    IF NEW.warehouse_id IS NULL THEN
      RAISE EXCEPTION 'An MM to another magazyn needs the source magazyn' USING ERRCODE = '22023';
    END IF;
    SELECT unit_id INTO v_src_unit FROM public.unit_warehouses WHERE id = NEW.warehouse_id;
    SELECT unit_id INTO v_dst_unit FROM public.unit_warehouses
    WHERE id = NEW.destination_warehouse_id AND branch_id = NEW.branch_id;
    IF v_dst_unit IS NULL OR v_dst_unit IS DISTINCT FROM v_src_unit THEN
      RAISE EXCEPTION 'An MM moves stock only between magazyny of one jednostka (use MMJ)'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_header.movement_type_code = '801'
     AND NEW.source_location_id IS NOT DISTINCT FROM NEW.destination_location_id
     AND NEW.destination_warehouse_id IS NOT DISTINCT FROM NEW.warehouse_id THEN
    RAISE EXCEPTION 'An MM changes the shelf or the magazyn' USING ERRCODE = '22023';
  END IF;

  -- One document, one magazyn.
  IF EXISTS (
    SELECT 1 FROM public.inventory_movement_lines ol
    WHERE ol.movement_id = NEW.movement_id AND ol.deleted_at IS NULL
      AND ol.id IS DISTINCT FROM NEW.id
      AND (ol.warehouse_id IS DISTINCT FROM NEW.warehouse_id
           OR ol.destination_warehouse_id IS DISTINCT FROM NEW.destination_warehouse_id)
  ) THEN
    RAISE EXCEPTION 'A document has one magazyn: lines of different magazyny need separate documents'
      USING ERRCODE = '22023';
  END IF;

  IF v_header.warehouse_id IS DISTINCT FROM NEW.warehouse_id
     OR v_header.destination_warehouse_id IS DISTINCT FROM NEW.destination_warehouse_id THEN
    UPDATE public.inventory_movement_headers
    SET warehouse_id = NEW.warehouse_id,
        destination_warehouse_id = NEW.destination_warehouse_id
    WHERE id = NEW.movement_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER inventory_movement_lines_warehouse_guard
  BEFORE INSERT OR UPDATE OF warehouse_id, destination_warehouse_id
  ON public.inventory_movement_lines
  FOR EACH ROW EXECUTE FUNCTION public.inventory_line_warehouse_guard();

-- 3. Drafts carry the target magazyn of a line ---------------------------------

DO $do$
DECLARE
  v_def text;
  v_new text;
BEGIN
  v_def := pg_get_functiondef(
    'public.inventory_create_draft(uuid,uuid,text,jsonb,date,date,text,text,text,text,uuid)'::regprocedure);
  IF position('destination_warehouse_id uuid)' IN v_def) = 0 THEN
    v_new := replace(v_def,
      $a$unit_cost numeric, note text, warehouse_id uuid)$a$,
      $b$unit_cost numeric, note text, warehouse_id uuid, destination_warehouse_id uuid)$b$);
    v_new := replace(v_new,
      $a$      unit_cost, note, warehouse_id
    ) VALUES ($a$,
      $b$      unit_cost, note, warehouse_id, destination_warehouse_id
    ) VALUES ($b$);
    v_new := replace(v_new,
      $a$      v_line.unit_cost, v_line.note, v_line.warehouse_id
    );$a$,
      $b$      v_line.unit_cost, v_line.note, v_line.warehouse_id, v_line.destination_warehouse_id
    );$b$);
    IF (length(v_new) - length(v_def)) <> length(', destination_warehouse_id uuid')
         + length(', destination_warehouse_id') + length(', v_line.destination_warehouse_id') THEN
      RAISE EXCEPTION 'inventory_create_draft patch did not apply cleanly';
    END IF;
    EXECUTE v_new;
  END IF;

  v_def := pg_get_functiondef(
    'public.inventory_save_draft(uuid,date,date,text,text,text,jsonb,uuid)'::regprocedure);
  IF position('destination_warehouse_id uuid)' IN v_def) = 0 THEN
    v_new := replace(v_def,
      $a$destination_location_id uuid, note text, warehouse_id uuid)$a$,
      $b$destination_location_id uuid, note text, warehouse_id uuid, destination_warehouse_id uuid)$b$);
    v_new := replace(v_new,
      $a$        source_location_id, destination_location_id, note, warehouse_id
      ) VALUES ($a$,
      $b$        source_location_id, destination_location_id, note, warehouse_id, destination_warehouse_id
      ) VALUES ($b$);
    v_new := replace(v_new,
      $a$v_line.destination_location_id, v_line.note, v_line.warehouse_id
      );$a$,
      $b$v_line.destination_location_id, v_line.note, v_line.warehouse_id, v_line.destination_warehouse_id
      );$b$);
    IF (length(v_new) - length(v_def)) <> length(', destination_warehouse_id uuid')
         + length(', destination_warehouse_id') + length(', v_line.destination_warehouse_id') THEN
      RAISE EXCEPTION 'inventory_save_draft patch did not apply cleanly';
    END IF;
    EXECUTE v_new;
  END IF;
END
$do$;

-- 4. Stock per magazyn: the side of the line, MM out only what the magazyn holds

CREATE OR REPLACE FUNCTION public.inventory_warehouse_stock_apply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_line record;
  v_header record;
  v_wh uuid;
  v_source text := 'line';
  v_delta numeric;
  v_after numeric;
  v_dest_side boolean;
BEGIN
  IF NEW.movement_line_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT ml.id, ml.movement_id, ml.line_number, ml.warehouse_id, ml.destination_warehouse_id,
         ml.source_location_id, ml.destination_location_id
  INTO v_line
  FROM public.inventory_movement_lines ml WHERE ml.id = NEW.movement_line_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT h.movement_type_code, h.reference_type, h.reference_id, h.original_movement_id
  INTO v_header
  FROM public.inventory_movement_headers h WHERE h.id = v_line.movement_id;

  -- Which side of the line this ledger entry is: the target magazyn of an
  -- MM applies to its destination side. By location when the shelf changes,
  -- by direction when only the magazyn does (inverted for a storno).
  IF v_line.destination_warehouse_id IS NOT NULL THEN
    IF v_line.source_location_id IS DISTINCT FROM v_line.destination_location_id THEN
      v_dest_side := NEW.location_id = v_line.destination_location_id;
    ELSE
      v_dest_side := (NEW.direction = 'increase') <> (v_header.movement_type_code = '900');
    END IF;
  ELSE
    v_dest_side := false;
  END IF;
  v_wh := CASE WHEN v_dest_side THEN v_line.destination_warehouse_id ELSE v_line.warehouse_id END;

  IF v_wh IS NULL THEN
    IF v_header.movement_type_code = '261' AND v_header.reference_type = 'repair_order' THEN
      SELECT rl.warehouse_id INTO v_wh
      FROM public.inventory_reservation_lines rl
      JOIN public.repair_order_lines rol ON rol.id = rl.repair_order_line_id
      WHERE rol.repair_order_id::text = v_header.reference_id
        AND rl.variant_id = NEW.variant_id
        AND rl.warehouse_id IS NOT NULL
      ORDER BY (rl.location_id = NEW.location_id) DESC, rl.created_at DESC
      LIMIT 1;
      v_source := 'reservation';
    ELSIF v_header.movement_type_code = '900' AND v_header.original_movement_id IS NOT NULL THEN
      SELECT wl.warehouse_id INTO v_wh
      FROM public.inventory_movement_lines ol
      JOIN public.inventory_warehouse_ledger wl ON wl.movement_line_id = ol.id
      JOIN public.inventory_stock_ledger_entries se ON se.id = wl.stock_ledger_entry_id
      WHERE ol.movement_id = v_header.original_movement_id
        AND ol.line_number = v_line.line_number
      ORDER BY (se.location_id = NEW.location_id) DESC, wl.created_at
      LIMIT 1;
      v_source := 'original';
    END IF;
  END IF;

  IF v_wh IS NULL THEN
    RETURN NULL;
  END IF;

  v_delta := CASE NEW.direction WHEN 'increase' THEN NEW.quantity ELSE -NEW.quantity END;

  INSERT INTO public.inventory_warehouse_stock AS s
    (organization_id, branch_id, warehouse_id, variant_id, quantity)
  VALUES (NEW.organization_id, NEW.branch_id, v_wh, NEW.variant_id, v_delta)
  ON CONFLICT (warehouse_id, variant_id)
  DO UPDATE SET quantity = s.quantity + EXCLUDED.quantity, updated_at = now()
  RETURNING s.quantity INTO v_after;

  IF v_header.movement_type_code = '801' AND v_line.destination_warehouse_id IS NOT NULL
     AND v_delta < 0 AND v_after < 0 THEN
    RAISE EXCEPTION 'The magazyn holds only % of this part', v_after - v_delta
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.inventory_warehouse_ledger (
    organization_id, branch_id, warehouse_id, variant_id, movement_id, movement_line_id,
    stock_ledger_entry_id, movement_type_code, document_number, quantity_delta,
    quantity_after, warehouse_source
  ) VALUES (
    NEW.organization_id, NEW.branch_id, v_wh, NEW.variant_id, v_line.movement_id, v_line.id,
    NEW.id, NEW.movement_type_code, NEW.document_number, v_delta, v_after, v_source
  );
  RETURN NULL;
END;
$$;

-- 5. Numbering TYP(magazyn)/nr/rr/jednostka --------------------------------------

CREATE OR REPLACE FUNCTION public.inventory_document_warehouse_parts(p_movement_id uuid)
RETURNS TABLE (prefix text, warehouse_code text, unit_code text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_header record;
  v_wh uuid;
  v_type text;
  v_prefix text;
  v_whs uuid[];
BEGIN
  SELECT h.id, h.movement_type_code, h.warehouse_id, h.original_movement_id,
         h.reference_type, h.reference_id, dt.code AS doc_code
  INTO v_header
  FROM public.inventory_movement_headers h
  JOIN public.inventory_movement_types mt ON mt.id = h.movement_type_id
  JOIN public.inventory_document_types dt ON dt.id = mt.document_type_id
  WHERE h.id = p_movement_id;
  IF NOT FOUND OR v_header.movement_type_code IN ('303', '305') THEN
    RETURN;  -- MMJ keeps its own numbering until U4
  END IF;

  v_wh := v_header.warehouse_id;
  v_type := v_header.movement_type_code;

  IF v_type = '900' AND v_header.original_movement_id IS NOT NULL THEN
    SELECT o.movement_type_code, COALESCE(v_wh, o.warehouse_id)
    INTO v_type, v_wh
    FROM public.inventory_movement_headers o WHERE o.id = v_header.original_movement_id;
    v_prefix := CASE WHEN v_type = '261' THEN 'KWU' ELSE 'KOR' END;
  ELSE
    v_prefix := CASE WHEN v_type = '261' THEN 'WU' ELSE v_header.doc_code END;
  END IF;

  -- An issue to a repair order: the magazyn of the order's reservations of
  -- the issued parts, when they are all of one magazyn.
  IF v_wh IS NULL AND v_header.movement_type_code = '261'
     AND v_header.reference_type = 'repair_order' THEN
    SELECT array_agg(DISTINCT rl.warehouse_id) INTO v_whs
    FROM public.inventory_movement_lines ml
    JOIN public.repair_order_lines rol ON rol.repair_order_id::text = v_header.reference_id
    JOIN public.inventory_reservation_lines rl
      ON rl.repair_order_line_id = rol.id AND rl.variant_id = ml.variant_id
    WHERE ml.movement_id = v_header.id AND ml.deleted_at IS NULL AND rl.warehouse_id IS NOT NULL;
    IF array_length(v_whs, 1) = 1 THEN
      v_wh := v_whs[1];
    END IF;
  END IF;

  IF v_wh IS NULL THEN
    RETURN;  -- without magazyn: old numbering
  END IF;

  RETURN QUERY
  SELECT v_prefix, w.code, u.code
  FROM public.unit_warehouses w
  JOIN public.branch_warehouses u ON u.id = w.unit_id
  WHERE w.id = v_wh;
END;
$$;

DO $do$
DECLARE
  v_def text;
  v_new text;
BEGIN
  v_def := pg_get_functiondef('public.inventory_finalize_posting_internal(uuid,uuid,jsonb)'::regprocedure);
  IF position('inventory_document_warehouse_parts' IN v_def) = 0 THEN
    v_new := replace(v_def,
      E'  v_unit text;\n',
      E'  v_unit text;\n  v_whp record;\n');
    v_new := replace(v_new,
      $a$  v_unit := NULLIF(current_setting('ambra.document_unit', true), '');
  IF v_unit IS NOT NULL AND COALESCE(v_mvt_type.numbering_template, '') LIKE '%{unit}%' THEN$a$,
      $b$  v_unit := NULLIF(current_setting('ambra.document_unit', true), '');
  SELECT * INTO v_whp FROM public.inventory_document_warehouse_parts(v_header.id);
  IF v_whp.prefix IS NOT NULL THEN
    -- One document, one magazyn: TYP(magazyn)/nr/rr/jednostka, e.g. PZ(115)/1/26/3112,
    -- counted per document type + magazyn + year.
    INSERT INTO inventory_document_sequences (organization_id, document_type_id, year, series)
    VALUES (v_header.organization_id, v_mvt_type.dt_id, v_year,
            v_whp.prefix || '(' || v_whp.warehouse_code || ')')
    ON CONFLICT DO NOTHING;

    SELECT * INTO v_seq FROM inventory_document_sequences
    WHERE organization_id = v_header.organization_id
      AND document_type_id = v_mvt_type.dt_id
      AND branch_id IS NULL
      AND series = v_whp.prefix || '(' || v_whp.warehouse_code || ')'
      AND year = v_year
    FOR UPDATE;

    v_doc_number := v_whp.prefix || '(' || v_whp.warehouse_code || ')/' || v_seq.next_number::text
      || '/' || lpad((v_year % 100)::text, 2, '0') || '/' || v_whp.unit_code;
  ELSIF v_unit IS NOT NULL AND COALESCE(v_mvt_type.numbering_template, '') LIKE '%{unit}%' THEN$b$);
    IF v_new = v_def OR position('v_whp record' IN v_new) = 0 THEN
      RAISE EXCEPTION 'inventory_finalize_posting_internal patch did not apply';
    END IF;
    EXECUTE v_new;
  END IF;
END
$do$;

-- 6. Several PZ of one delivery, posted together ----------------------------------

CREATE OR REPLACE FUNCTION public.inventory_create_and_finalize_receipts(
  p_organization_id uuid,
  p_branch_id uuid,
  p_documents jsonb,
  p_operation_date date,
  p_document_date date,
  p_counterparty_name text,
  p_external_reference text,
  p_note text,
  p_idempotency_key text,
  p_actor_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
-- A delivery whose lines belong to several magazyny is received as one PZ per
-- magazyn, all in this one transaction: every PZ is posted, or none is.
-- p_documents: [{ "lines": [...], "attribution": [...] }, ...]
DECLARE
  v_doc jsonb;
  v_i integer := 0;
  v_out jsonb := '[]'::jsonb;
BEGIN
  IF p_documents IS NULL OR jsonb_typeof(p_documents) <> 'array'
     OR jsonb_array_length(p_documents) = 0 THEN
    RAISE EXCEPTION 'No documents to post' USING ERRCODE = '22023';
  END IF;
  FOR v_doc IN SELECT value FROM jsonb_array_elements(p_documents)
  LOOP
    v_i := v_i + 1;
    v_out := v_out || jsonb_build_array(public.inventory_create_and_finalize_receipt(
      p_organization_id, p_branch_id, v_doc->'lines',
      p_operation_date, p_document_date, p_counterparty_name, p_external_reference, p_note,
      CASE WHEN p_idempotency_key IS NULL THEN NULL ELSE p_idempotency_key || ':' || v_i END,
      p_actor_user_id, COALESCE(v_doc->'attribution', '[]'::jsonb)));
  END LOOP;
  RETURN jsonb_build_object('documents', v_out);
END;
$$;

GRANT EXECUTE ON FUNCTION public.inventory_create_and_finalize_receipts(
  uuid, uuid, jsonb, date, date, text, text, text, text, uuid) TO authenticated;
