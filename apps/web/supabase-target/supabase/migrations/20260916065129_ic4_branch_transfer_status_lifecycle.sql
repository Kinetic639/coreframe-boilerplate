ALTER TABLE public.inventory_branch_transfers
  DROP CONSTRAINT inventory_branch_transfers_status_check;

ALTER TABLE public.inventory_branch_transfers
  ADD CONSTRAINT inventory_branch_transfers_status_check
  CHECK (status = ANY (ARRAY[
    'prepared'::text, 'in_transit'::text, 'accepted'::text,
    'partially_accepted'::text, 'declined'::text, 'cancelled'::text
  ]));

ALTER TABLE public.inventory_branch_transfers
  ALTER COLUMN status SET DEFAULT 'prepared';

ALTER TABLE public.inventory_branch_transfers
  ADD COLUMN cancelled_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancel_reason text;

COMMENT ON COLUMN public.inventory_branch_transfers.status IS
  'IC-4 lifecycle: prepared (reserved, not shipped) -> in_transit (physically shipped, source movement posted) -> accepted | partially_accepted (destination movement posted, any shortfall persisted as a discrepancy) -> declined (destination rejected before shipment only) | cancelled (source cancelled before shipment only). in_transit means physically shipped, never merely reserved -- product-owner decision, 2026-09-16.';
