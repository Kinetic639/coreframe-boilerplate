-- =============================================================================
-- Migration: inventory_cross_branch_transfers
-- Project:   rjeraydumwechpjjzrus (TARGET)
-- Phase:     Ambra Inventory V2 Phase 4 slice — Cross-Branch Transfers
-- =============================================================================
-- Implements two-step cross-branch transfers:
--   1. source branch sends stock, posting a linked outbound issue movement
--   2. transfer remains in_transit
--   3. destination branch accepts, posting a linked receipt movement, or declines
--      and returns stock to source locations with a linked receipt movement
-- =============================================================================

ALTER TABLE public.inventory_settings
  ADD COLUMN IF NOT EXISTS branch_transfer_number_prefix text not null default 'BT',
  ADD COLUMN IF NOT EXISTS branch_transfer_number_next bigint not null default 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_settings_branch_transfer_next_positive'
      AND conrelid = 'public.inventory_settings'::regclass
  ) THEN
    ALTER TABLE public.inventory_settings
      ADD CONSTRAINT inventory_settings_branch_transfer_next_positive
      CHECK (branch_transfer_number_next > 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.inventory_branch_transfers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  transfer_number text not null,
  source_branch_id uuid not null references public.branches(id) on delete restrict,
  destination_branch_id uuid not null references public.branches(id) on delete restrict,
  status text not null default 'in_transit',
  source_movement_id uuid null references public.inventory_movement_headers(id) on delete restrict,
  destination_movement_id uuid null references public.inventory_movement_headers(id) on delete restrict,
  return_movement_id uuid null references public.inventory_movement_headers(id) on delete restrict,
  notes text null,
  decline_reason text null,
  sent_by uuid null references public.users(id) on delete set null,
  sent_at timestamptz null,
  accepted_by uuid null references public.users(id) on delete set null,
  accepted_at timestamptz null,
  declined_by uuid null references public.users(id) on delete set null,
  declined_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint inventory_branch_transfers_status_check check (
    status in ('in_transit', 'accepted', 'declined')
  ),
  constraint inventory_branch_transfers_distinct_branches check (
    source_branch_id <> destination_branch_id
  ),
  constraint inventory_branch_transfers_number_not_empty check (length(trim(transfer_number)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_branch_transfers_number_uidx
  ON public.inventory_branch_transfers (organization_id, transfer_number)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS inventory_branch_transfers_source_idx
  ON public.inventory_branch_transfers (organization_id, source_branch_id, status, created_at desc)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS inventory_branch_transfers_destination_idx
  ON public.inventory_branch_transfers (organization_id, destination_branch_id, status, created_at desc)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.inventory_branch_transfer_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  transfer_id uuid not null references public.inventory_branch_transfers(id) on delete cascade,
  variant_id uuid not null references public.inventory_variants(id) on delete restrict,
  source_location_id uuid not null references public.warehouse_locations(id) on delete restrict,
  destination_location_id uuid null references public.warehouse_locations(id) on delete restrict,
  lot_id uuid null references public.inventory_lots(id) on delete restrict,
  serial_id uuid null references public.inventory_serials(id) on delete restrict,
  unit_id uuid not null references public.inventory_units(id) on delete restrict,
  quantity numeric(18, 6) not null,
  created_at timestamptz not null default now(),
  constraint inventory_branch_transfer_lines_quantity_positive check (quantity > 0)
);

CREATE INDEX IF NOT EXISTS inventory_branch_transfer_lines_transfer_idx
  ON public.inventory_branch_transfer_lines (transfer_id, variant_id);

CREATE OR REPLACE FUNCTION public.inventory_create_branch_transfer(
  p_organization_id uuid,
  p_source_branch_id uuid,
  p_destination_branch_id uuid,
  p_lines jsonb,
  p_notes text default null,
  p_actor_user_id uuid default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_settings public.inventory_settings%ROWTYPE;
  v_transfer_id uuid;
  v_transfer_number text;
  v_line jsonb;
  v_issue_lines jsonb;
  v_movement jsonb;
BEGIN
  IF p_source_branch_id = p_destination_branch_id THEN
    RAISE EXCEPTION 'Cross-branch transfer requires different source and destination branches';
  END IF;

  IF NOT public.has_branch_permission(p_organization_id, p_source_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission for source branch';
  END IF;

  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one transfer line is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branches
    WHERE id = p_source_branch_id
      AND organization_id = p_organization_id
      AND deleted_at IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM public.branches
    WHERE id = p_destination_branch_id
      AND organization_id = p_organization_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Transfer branches must belong to the organization';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  INSERT INTO public.inventory_settings (organization_id, created_by, updated_by)
  VALUES (p_organization_id, p_actor_user_id, p_actor_user_id)
  ON CONFLICT (organization_id) DO NOTHING;

  SELECT * INTO v_settings
  FROM public.inventory_settings
  WHERE organization_id = p_organization_id
    AND deleted_at IS NULL
  FOR UPDATE;

  v_transfer_number :=
    v_settings.branch_transfer_number_prefix || '-' || lpad(v_settings.branch_transfer_number_next::text, 6, '0');

  UPDATE public.inventory_settings
  SET branch_transfer_number_next = branch_transfer_number_next + 1,
      updated_by = p_actor_user_id
  WHERE id = v_settings.id;

  INSERT INTO public.inventory_branch_transfers (
    organization_id,
    transfer_number,
    source_branch_id,
    destination_branch_id,
    status,
    notes,
    sent_by,
    sent_at
  )
  VALUES (
    p_organization_id,
    v_transfer_number,
    p_source_branch_id,
    p_destination_branch_id,
    'in_transit',
    p_notes,
    p_actor_user_id,
    now()
  )
  RETURNING id INTO v_transfer_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.warehouse_locations
      WHERE id = (v_line ->> 'source_location_id')::uuid
        AND organization_id = p_organization_id
        AND branch_id = p_source_branch_id
        AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Source location must belong to the source branch';
    END IF;

    INSERT INTO public.inventory_branch_transfer_lines (
      organization_id,
      transfer_id,
      variant_id,
      source_location_id,
      lot_id,
      serial_id,
      unit_id,
      quantity
    )
    VALUES (
      p_organization_id,
      v_transfer_id,
      (v_line ->> 'variant_id')::uuid,
      (v_line ->> 'source_location_id')::uuid,
      nullif(v_line ->> 'lot_id', '')::uuid,
      nullif(v_line ->> 'serial_id', '')::uuid,
      (v_line ->> 'unit_id')::uuid,
      (v_line ->> 'quantity')::numeric
    );
  END LOOP;

  SELECT jsonb_agg(jsonb_build_object(
    'variant_id', variant_id,
    'source_location_id', source_location_id,
    'lot_id', lot_id,
    'serial_id', serial_id,
    'unit_id', unit_id,
    'quantity', quantity
  ))
  INTO v_issue_lines
  FROM public.inventory_branch_transfer_lines
  WHERE transfer_id = v_transfer_id;

  v_movement := public.inventory_create_draft_movement(
    p_organization_id,
    p_source_branch_id,
    'issue',
    v_issue_lines,
    null,
    null,
    'Cross-branch transfer ' || v_transfer_number,
    'branch_transfer',
    v_transfer_id::text,
    'branch-transfer-send-' || v_transfer_id::text,
    p_actor_user_id
  );

  v_movement := public.inventory_post_movement((v_movement ->> 'movement_id')::uuid, p_actor_user_id);

  UPDATE public.inventory_branch_transfers
  SET source_movement_id = (v_movement ->> 'movement_id')::uuid
  WHERE id = v_transfer_id;

  RETURN jsonb_build_object(
    'transfer_id', v_transfer_id,
    'transfer_number', v_transfer_number,
    'status', 'in_transit',
    'source_movement_id', v_movement ->> 'movement_id'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.inventory_accept_branch_transfer(
  p_transfer_id uuid,
  p_destination_location_id uuid,
  p_actor_user_id uuid default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_transfer public.inventory_branch_transfers%ROWTYPE;
  v_receipt_lines jsonb;
  v_movement jsonb;
BEGIN
  SELECT * INTO v_transfer
  FROM public.inventory_branch_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Branch transfer not found';
  END IF;

  IF v_transfer.status <> 'in_transit' THEN
    RAISE EXCEPTION 'Only in-transit branch transfers can be accepted';
  END IF;

  IF NOT public.has_branch_permission(v_transfer.organization_id, v_transfer.destination_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission for destination branch';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.warehouse_locations
    WHERE id = p_destination_location_id
      AND organization_id = v_transfer.organization_id
      AND branch_id = v_transfer.destination_branch_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Destination location must belong to the destination branch';
  END IF;

  UPDATE public.inventory_branch_transfer_lines
  SET destination_location_id = p_destination_location_id
  WHERE transfer_id = v_transfer.id;

  SELECT jsonb_agg(jsonb_build_object(
    'variant_id', variant_id,
    'destination_location_id', p_destination_location_id,
    'lot_id', lot_id,
    'serial_id', serial_id,
    'unit_id', unit_id,
    'quantity', quantity
  ))
  INTO v_receipt_lines
  FROM public.inventory_branch_transfer_lines
  WHERE transfer_id = v_transfer.id;

  v_movement := public.inventory_create_draft_movement(
    v_transfer.organization_id,
    v_transfer.destination_branch_id,
    'receipt',
    v_receipt_lines,
    null,
    null,
    'Accepted branch transfer ' || v_transfer.transfer_number,
    'branch_transfer',
    v_transfer.id::text,
    'branch-transfer-accept-' || v_transfer.id::text,
    p_actor_user_id
  );

  v_movement := public.inventory_post_movement((v_movement ->> 'movement_id')::uuid, p_actor_user_id);

  UPDATE public.inventory_branch_transfers
  SET status = 'accepted',
      destination_movement_id = (v_movement ->> 'movement_id')::uuid,
      accepted_by = p_actor_user_id,
      accepted_at = now()
  WHERE id = v_transfer.id;

  RETURN jsonb_build_object(
    'transfer_id', v_transfer.id,
    'transfer_number', v_transfer.transfer_number,
    'status', 'accepted',
    'destination_movement_id', v_movement ->> 'movement_id'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.inventory_decline_branch_transfer(
  p_transfer_id uuid,
  p_decline_reason text default null,
  p_actor_user_id uuid default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_transfer public.inventory_branch_transfers%ROWTYPE;
  v_settings public.inventory_settings%ROWTYPE;
  v_movement_id uuid;
  v_movement_number text;
  v_line record;
  v_line_number integer := 0;
  v_balance public.inventory_balances%ROWTYPE;
BEGIN
  SELECT * INTO v_transfer
  FROM public.inventory_branch_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Branch transfer not found';
  END IF;

  IF v_transfer.status <> 'in_transit' THEN
    RAISE EXCEPTION 'Only in-transit branch transfers can be declined';
  END IF;

  IF NOT public.has_branch_permission(v_transfer.organization_id, v_transfer.destination_branch_id, 'warehouse.inventory.operate') THEN
    RAISE EXCEPTION 'Missing warehouse.inventory.operate permission for destination branch';
  END IF;

  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);

  SELECT * INTO v_settings
  FROM public.inventory_settings
  WHERE organization_id = v_transfer.organization_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory settings unavailable';
  END IF;

  SELECT id INTO v_movement_id
  FROM public.inventory_movement_headers
  WHERE organization_id = v_transfer.organization_id
    AND idempotency_key = 'branch-transfer-decline-' || v_transfer.id::text
  FOR UPDATE;

  IF v_movement_id IS NULL THEN
    v_movement_number :=
      v_settings.movement_number_prefix || '-' || lpad(v_settings.movement_number_next::text, 6, '0');

    UPDATE public.inventory_settings
    SET movement_number_next = movement_number_next + 1,
        updated_by = p_actor_user_id
    WHERE id = v_settings.id;

    INSERT INTO public.inventory_movement_headers (
      organization_id,
      branch_id,
      movement_number,
      movement_kind,
      status,
      note,
      reference_type,
      reference_id,
      idempotency_key,
      created_by,
      posted_by,
      posted_at
    )
    VALUES (
      v_transfer.organization_id,
      v_transfer.source_branch_id,
      v_movement_number,
      'receipt',
      'posted',
      'Declined branch transfer return ' || v_transfer.transfer_number,
      'branch_transfer_decline',
      v_transfer.id::text,
      'branch-transfer-decline-' || v_transfer.id::text,
      p_actor_user_id,
      p_actor_user_id,
      now()
    )
    RETURNING id INTO v_movement_id;

    FOR v_line IN
      SELECT *
      FROM public.inventory_branch_transfer_lines
      WHERE transfer_id = v_transfer.id
      ORDER BY created_at, id
    LOOP
      v_line_number := v_line_number + 1;

      INSERT INTO public.inventory_movement_lines (
        organization_id,
        branch_id,
        movement_id,
        line_number,
        variant_id,
        destination_location_id,
        unit_id,
        quantity,
        note
      )
      VALUES (
        v_transfer.organization_id,
        v_transfer.source_branch_id,
        v_movement_id,
        v_line_number,
        v_line.variant_id,
        v_line.source_location_id,
        v_line.unit_id,
        v_line.quantity,
        'Returned after destination branch declined transfer'
      );

      v_balance := public.inventory_get_or_create_balance_for_update(
        v_transfer.organization_id,
        v_transfer.source_branch_id,
        v_line.source_location_id,
        v_line.variant_id,
        v_movement_id
      );

      UPDATE public.inventory_balances
      SET on_hand_quantity = on_hand_quantity + v_line.quantity,
          last_movement_id = v_movement_id,
          last_movement_at = now()
      WHERE id = v_balance.id;
    END LOOP;
  END IF;

  UPDATE public.inventory_branch_transfers
  SET status = 'declined',
      return_movement_id = v_movement_id,
      decline_reason = p_decline_reason,
      declined_by = p_actor_user_id,
      declined_at = now()
  WHERE id = v_transfer.id;

  RETURN jsonb_build_object(
    'transfer_id', v_transfer.id,
    'transfer_number', v_transfer.transfer_number,
    'status', 'declined',
    'return_movement_id', v_movement_id
  );
END;
$$;

ALTER TABLE public.inventory_branch_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_branch_transfers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_branch_transfer_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_branch_transfer_lines FORCE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS inventory_branch_transfers_updated_at ON public.inventory_branch_transfers;
CREATE TRIGGER inventory_branch_transfers_updated_at
  BEFORE UPDATE ON public.inventory_branch_transfers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS inventory_branch_transfers_select ON public.inventory_branch_transfers;
CREATE POLICY inventory_branch_transfers_select
  ON public.inventory_branch_transfers FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      public.has_branch_permission(organization_id, source_branch_id, 'warehouse.inventory.read')
      OR public.has_branch_permission(organization_id, destination_branch_id, 'warehouse.inventory.read')
    )
  );

DROP POLICY IF EXISTS inventory_branch_transfers_operate ON public.inventory_branch_transfers;
CREATE POLICY inventory_branch_transfers_operate
  ON public.inventory_branch_transfers FOR ALL
  USING (
    public.has_branch_permission(organization_id, source_branch_id, 'warehouse.inventory.operate')
    OR public.has_branch_permission(organization_id, destination_branch_id, 'warehouse.inventory.operate')
  )
  WITH CHECK (
    public.has_branch_permission(organization_id, source_branch_id, 'warehouse.inventory.operate')
    OR public.has_branch_permission(organization_id, destination_branch_id, 'warehouse.inventory.operate')
  );

DROP POLICY IF EXISTS inventory_branch_transfer_lines_select ON public.inventory_branch_transfer_lines;
CREATE POLICY inventory_branch_transfer_lines_select
  ON public.inventory_branch_transfer_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.inventory_branch_transfers t
      WHERE t.id = transfer_id
        AND t.organization_id = organization_id
        AND (
          public.has_branch_permission(t.organization_id, t.source_branch_id, 'warehouse.inventory.read')
          OR public.has_branch_permission(t.organization_id, t.destination_branch_id, 'warehouse.inventory.read')
        )
    )
  );

DROP POLICY IF EXISTS inventory_branch_transfer_lines_operate ON public.inventory_branch_transfer_lines;
CREATE POLICY inventory_branch_transfer_lines_operate
  ON public.inventory_branch_transfer_lines FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.inventory_branch_transfers t
      WHERE t.id = transfer_id
        AND t.organization_id = organization_id
        AND (
          public.has_branch_permission(t.organization_id, t.source_branch_id, 'warehouse.inventory.operate')
          OR public.has_branch_permission(t.organization_id, t.destination_branch_id, 'warehouse.inventory.operate')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.inventory_branch_transfers t
      WHERE t.id = transfer_id
        AND t.organization_id = organization_id
        AND (
          public.has_branch_permission(t.organization_id, t.source_branch_id, 'warehouse.inventory.operate')
          OR public.has_branch_permission(t.organization_id, t.destination_branch_id, 'warehouse.inventory.operate')
        )
    )
  );
