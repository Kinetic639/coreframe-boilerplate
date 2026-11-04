-- ============================================================================
-- U2: stock per AutoStacja magazyn (docs/WAREHOUSE_UNITS_PLAN.md)
-- ============================================================================
-- Decision 2026-11-04 (variant A): the AS magazyn is an ownership balance
-- "magazyn x part", kept next to the physical stock "location x part".
-- Parts of different magazyny lie on the same shelves, and AutoStacja has no
-- shelves at all, so the magazyn is not part of inventory_balances. The
-- posting engine, putaway, containers and relocation are untouched.
--
-- How it is fed: every on-hand effect the engine writes to the stock ledger
-- (PZ +, RW -, KPZ -, count +/-, MMJ -/+, storno inverse ...) is applied to
-- the magazyn of its movement line. A line without a magazyn changes nothing
-- here: its stock simply stays "without magazyn". A bin-to-bin move (801)
-- takes from and puts into the same magazyn, so it nets to zero.
--
-- Where the magazyn of a line comes from:
--   * PZ / any draft: warehouse_id in the line JSON (Matcher import sets it);
--   * reservation: inherits the magazyn of the PZ line it was made from (or
--     of the reservation line it was moved from);
--   * RW 261 for a repair order: the magazyn of the order's reservation of
--     that part;
--   * storno 900: the magazyn the original line was booked to.
-- Existing stock is not migrated here; it shows as "without magazyn" until a
-- reviewed migration assigns it.
-- ============================================================================

-- 1. The magazyn on movement and reservation lines ---------------------------

ALTER TABLE public.inventory_movement_lines
  ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.unit_warehouses(id);
ALTER TABLE public.inventory_reservation_lines
  ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.unit_warehouses(id);

CREATE INDEX IF NOT EXISTS inventory_movement_lines_warehouse_idx
  ON public.inventory_movement_lines (warehouse_id) WHERE warehouse_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS inventory_reservation_lines_warehouse_idx
  ON public.inventory_reservation_lines (warehouse_id) WHERE warehouse_id IS NOT NULL;

COMMENT ON COLUMN public.inventory_movement_lines.warehouse_id IS
  'AutoStacja magazyn (unit_warehouses) the line books to; NULL = without magazyn';
COMMENT ON COLUMN public.inventory_reservation_lines.warehouse_id IS
  'AutoStacja magazyn of the reserved stock, inherited from the PZ line';

-- A line's magazyn belongs to the line's branch.
CREATE OR REPLACE FUNCTION public.inventory_line_warehouse_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.warehouse_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.unit_warehouses w
    WHERE w.id = NEW.warehouse_id
      AND w.organization_id = NEW.organization_id
      AND w.branch_id = NEW.branch_id
  ) THEN
    RAISE EXCEPTION 'Magazyn does not belong to this branch' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER inventory_movement_lines_warehouse_guard
  BEFORE INSERT OR UPDATE OF warehouse_id ON public.inventory_movement_lines
  FOR EACH ROW EXECUTE FUNCTION public.inventory_line_warehouse_guard();

-- A reservation inherits the magazyn of the stock it reserves.
CREATE OR REPLACE FUNCTION public.inventory_reservation_line_inherit_warehouse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.warehouse_id IS NULL AND NEW.source_movement_line_id IS NOT NULL THEN
    SELECT ml.warehouse_id INTO NEW.warehouse_id
    FROM public.inventory_movement_lines ml WHERE ml.id = NEW.source_movement_line_id;
  END IF;
  IF NEW.warehouse_id IS NULL AND NEW.moved_from_line_id IS NOT NULL THEN
    SELECT rl.warehouse_id INTO NEW.warehouse_id
    FROM public.inventory_reservation_lines rl WHERE rl.id = NEW.moved_from_line_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER inventory_reservation_lines_inherit_warehouse
  BEFORE INSERT ON public.inventory_reservation_lines
  FOR EACH ROW EXECUTE FUNCTION public.inventory_reservation_line_inherit_warehouse();

-- 2. Stock and history per magazyn ------------------------------------------

CREATE TABLE IF NOT EXISTS public.inventory_warehouse_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  warehouse_id uuid NOT NULL REFERENCES public.unit_warehouses(id),
  variant_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_warehouse_stock_unique UNIQUE (warehouse_id, variant_id)
);
CREATE INDEX IF NOT EXISTS inventory_warehouse_stock_branch_variant_idx
  ON public.inventory_warehouse_stock (organization_id, branch_id, variant_id);

CREATE TABLE IF NOT EXISTS public.inventory_warehouse_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  warehouse_id uuid NOT NULL REFERENCES public.unit_warehouses(id),
  variant_id uuid NOT NULL,
  movement_id uuid,
  movement_line_id uuid,
  stock_ledger_entry_id uuid UNIQUE,
  movement_type_code text,
  document_number text,
  quantity_delta numeric NOT NULL,
  quantity_after numeric NOT NULL,
  -- how the magazyn was found: line, reservation (RW), original (storno)
  warehouse_source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_warehouse_ledger_variant_idx
  ON public.inventory_warehouse_ledger (organization_id, branch_id, variant_id, created_at);
CREATE INDEX IF NOT EXISTS inventory_warehouse_ledger_line_idx
  ON public.inventory_warehouse_ledger (movement_line_id);

ALTER TABLE public.inventory_warehouse_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_warehouse_ledger ENABLE ROW LEVEL SECURITY;

-- Read like the physical stock; written only by the engine trigger below.
CREATE POLICY inventory_warehouse_stock_select ON public.inventory_warehouse_stock
  FOR SELECT TO authenticated
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read'));
CREATE POLICY inventory_warehouse_stock_write_deny ON public.inventory_warehouse_stock
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY inventory_warehouse_ledger_select ON public.inventory_warehouse_ledger
  FOR SELECT TO authenticated
  USING (public.has_branch_permission(organization_id, branch_id, 'warehouse.inventory.read'));
CREATE POLICY inventory_warehouse_ledger_write_deny ON public.inventory_warehouse_ledger
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- 3. Feed from the stock ledger -----------------------------------------------

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
BEGIN
  IF NEW.movement_line_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT ml.id, ml.movement_id, ml.line_number, ml.warehouse_id
  INTO v_line
  FROM public.inventory_movement_lines ml WHERE ml.id = NEW.movement_line_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  v_wh := v_line.warehouse_id;

  IF v_wh IS NULL THEN
    SELECT h.movement_type_code, h.reference_type, h.reference_id, h.original_movement_id
    INTO v_header
    FROM public.inventory_movement_headers h WHERE h.id = v_line.movement_id;

    IF v_header.movement_type_code = '261' AND v_header.reference_type = 'repair_order' THEN
      -- RW: the magazyn of the order's reservation of this part, the one at
      -- this location first, then the latest.
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
      -- Storno: back to the magazyn the original line was booked to.
      SELECT wl.warehouse_id INTO v_wh
      FROM public.inventory_movement_lines ol
      JOIN public.inventory_warehouse_ledger wl ON wl.movement_line_id = ol.id
      WHERE ol.movement_id = v_header.original_movement_id
        AND ol.line_number = v_line.line_number
      ORDER BY wl.created_at
      LIMIT 1;
      v_source := 'original';
    END IF;
  END IF;

  IF v_wh IS NULL THEN
    RETURN NULL;  -- stock without magazyn
  END IF;

  v_delta := CASE NEW.direction WHEN 'increase' THEN NEW.quantity ELSE -NEW.quantity END;

  INSERT INTO public.inventory_warehouse_stock AS s
    (organization_id, branch_id, warehouse_id, variant_id, quantity)
  VALUES (NEW.organization_id, NEW.branch_id, v_wh, NEW.variant_id, v_delta)
  ON CONFLICT (warehouse_id, variant_id)
  DO UPDATE SET quantity = s.quantity + EXCLUDED.quantity, updated_at = now()
  RETURNING s.quantity INTO v_after;

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

CREATE OR REPLACE TRIGGER inventory_stock_ledger_warehouse_stock
  AFTER INSERT ON public.inventory_stock_ledger_entries
  FOR EACH ROW
  WHEN (NEW.balance_field = 'on_hand')
  EXECUTE FUNCTION public.inventory_warehouse_stock_apply();

-- 4. Drafts carry the magazyn of each line ----------------------------------

DO $do$
DECLARE
  v_def text;
  v_new text;
BEGIN
  v_def := pg_get_functiondef(
    'public.inventory_create_draft(uuid,uuid,text,jsonb,date,date,text,text,text,text,uuid)'::regprocedure);
  IF position('warehouse_id uuid)' IN v_def) = 0 THEN
    v_new := replace(v_def,
      $a$unit_cost numeric, note text)$a$,
      $b$unit_cost numeric, note text, warehouse_id uuid)$b$);
    v_new := replace(v_new,
      $a$      unit_cost, note
    ) VALUES ($a$,
      $b$      unit_cost, note, warehouse_id
    ) VALUES ($b$);
    v_new := replace(v_new,
      $a$      v_line.unit_cost, v_line.note
    );$a$,
      $b$      v_line.unit_cost, v_line.note, v_line.warehouse_id
    );$b$);
    IF (length(v_new) - length(v_def)) <> length(', warehouse_id uuid') + length(', warehouse_id')
                                          + length(', v_line.warehouse_id') THEN
      RAISE EXCEPTION 'inventory_create_draft patch did not apply cleanly';
    END IF;
    EXECUTE v_new;
  END IF;

  v_def := pg_get_functiondef(
    'public.inventory_save_draft(uuid,date,date,text,text,text,jsonb,uuid)'::regprocedure);
  IF position('warehouse_id uuid)' IN v_def) = 0 THEN
    v_new := replace(v_def,
      $a$source_location_id uuid, destination_location_id uuid, note text)$a$,
      $b$source_location_id uuid, destination_location_id uuid, note text, warehouse_id uuid)$b$);
    v_new := replace(v_new,
      $a$        source_location_id, destination_location_id, note
      ) VALUES ($a$,
      $b$        source_location_id, destination_location_id, note, warehouse_id
      ) VALUES ($b$);
    v_new := replace(v_new,
      $a$        v_line.source_location_id, v_line.destination_location_id, v_line.note
      );$a$,
      $b$        v_line.source_location_id, v_line.destination_location_id, v_line.note, v_line.warehouse_id
      );$b$);
    IF (length(v_new) - length(v_def)) <> length(', warehouse_id uuid') + length(', warehouse_id')
                                          + length(', v_line.warehouse_id') THEN
      RAISE EXCEPTION 'inventory_save_draft patch did not apply cleanly';
    END IF;
    EXECUTE v_new;
  END IF;
END
$do$;
