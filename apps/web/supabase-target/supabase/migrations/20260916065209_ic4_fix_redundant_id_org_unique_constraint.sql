-- Self-caught, corrective: the prior migration added a UNIQUE(id,
-- organization_id) constraint on inventory_branch_transfers to satisfy
-- the discrepancies table's composite FK, without checking whether an
-- equivalent constraint already existed. It did:
-- inventory_branch_transfers_id_org_uidx (pre-existing, from an earlier
-- IC-4-unrelated migration). The composite FK still resolves against
-- that pre-existing index once the redundant duplicate is dropped.
ALTER TABLE public.inventory_branch_transfers
  DROP CONSTRAINT inventory_branch_transfers_id_org_unique;
