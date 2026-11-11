CREATE TABLE public.inventory_branch_transfer_discrepancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  transfer_id uuid NOT NULL REFERENCES public.inventory_branch_transfers(id) ON DELETE CASCADE,
  transfer_line_id uuid NOT NULL REFERENCES public.inventory_branch_transfer_lines(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.inventory_variants(id) ON DELETE RESTRICT,
  sent_quantity numeric(18, 6) NOT NULL,
  accepted_quantity numeric(18, 6) NOT NULL,
  missing_quantity numeric(18, 6) NOT NULL,
  destination_movement_id uuid REFERENCES public.inventory_movement_headers(id) ON DELETE RESTRICT,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_branch_transfer_discrepancies_missing_positive
    CHECK (missing_quantity > 0),
  CONSTRAINT inventory_branch_transfer_discrepancies_arithmetic
    CHECK (missing_quantity = sent_quantity - accepted_quantity),
  CONSTRAINT inventory_branch_transfer_discrepancies_transfer_org_fkey
    FOREIGN KEY (transfer_id, organization_id)
    REFERENCES public.inventory_branch_transfers(id, organization_id) ON DELETE CASCADE
);

CREATE INDEX inventory_branch_transfer_discrepancies_transfer_idx
  ON public.inventory_branch_transfer_discrepancies (transfer_id);

ALTER TABLE public.inventory_branch_transfers
  ADD CONSTRAINT inventory_branch_transfers_id_org_unique UNIQUE (id, organization_id);

ALTER TABLE public.inventory_branch_transfer_discrepancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_branch_transfer_discrepancies FORCE ROW LEVEL SECURITY;

CREATE POLICY inventory_branch_transfer_discrepancies_select
  ON public.inventory_branch_transfer_discrepancies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.inventory_branch_transfers t
      WHERE t.id = inventory_branch_transfer_discrepancies.transfer_id
        AND t.organization_id = inventory_branch_transfer_discrepancies.organization_id
        AND (
          public.has_branch_permission(t.organization_id, t.source_branch_id, 'warehouse.inventory.read')
          OR public.has_branch_permission(t.organization_id, t.destination_branch_id, 'warehouse.inventory.read')
        )
    )
  );

CREATE POLICY inventory_branch_transfer_discrepancies_deny_insert
  ON public.inventory_branch_transfer_discrepancies AS RESTRICTIVE FOR INSERT
  TO authenticated WITH CHECK (false);
CREATE POLICY inventory_branch_transfer_discrepancies_deny_update
  ON public.inventory_branch_transfer_discrepancies AS RESTRICTIVE FOR UPDATE
  TO authenticated USING (false);
CREATE POLICY inventory_branch_transfer_discrepancies_deny_delete
  ON public.inventory_branch_transfer_discrepancies AS RESTRICTIVE FOR DELETE
  TO authenticated USING (false);
