-- =============================================================================
-- Migration: inventory_remaining_fk_performance_indexes
-- Project:   rjeraydumwechpjjzrus (TARGET)
-- Purpose:   Cover remaining inventory foreign keys reported after the first
--            performance-index pass.
-- =============================================================================

CREATE INDEX IF NOT EXISTS inventory_count_lines_organization_id_idx
  ON public.inventory_count_lines (organization_id);

CREATE INDEX IF NOT EXISTS inventory_movement_lines_branch_id_idx
  ON public.inventory_movement_lines (branch_id);

CREATE INDEX IF NOT EXISTS inventory_option_values_organization_id_idx
  ON public.inventory_option_values (organization_id);

CREATE INDEX IF NOT EXISTS inventory_product_identifiers_created_by_idx
  ON public.inventory_product_identifiers (created_by);
CREATE INDEX IF NOT EXISTS inventory_product_identifiers_product_fk_idx
  ON public.inventory_product_identifiers (product_id, organization_id);
CREATE INDEX IF NOT EXISTS inventory_product_identifiers_variant_fk_idx
  ON public.inventory_product_identifiers (variant_id, organization_id);

CREATE INDEX IF NOT EXISTS inventory_product_tags_organization_id_idx
  ON public.inventory_product_tags (organization_id);

CREATE INDEX IF NOT EXISTS inventory_purchase_order_lines_organization_id_idx
  ON public.inventory_purchase_order_lines (organization_id);

CREATE INDEX IF NOT EXISTS inventory_reorder_rules_branch_id_idx
  ON public.inventory_reorder_rules (branch_id);
CREATE INDEX IF NOT EXISTS inventory_reorder_rules_location_fk_idx
  ON public.inventory_reorder_rules (location_id, organization_id, branch_id);
CREATE INDEX IF NOT EXISTS inventory_reorder_rules_preferred_supplier_id_idx
  ON public.inventory_reorder_rules (preferred_supplier_id);
CREATE INDEX IF NOT EXISTS inventory_reorder_rules_updated_by_idx
  ON public.inventory_reorder_rules (updated_by);
CREATE INDEX IF NOT EXISTS inventory_reorder_rules_variant_fk_idx
  ON public.inventory_reorder_rules (variant_id, organization_id);

CREATE INDEX IF NOT EXISTS inventory_sku_templates_updated_by_idx
  ON public.inventory_sku_templates (updated_by);

CREATE INDEX IF NOT EXISTS inventory_tax_rates_updated_by_idx
  ON public.inventory_tax_rates (updated_by);

CREATE INDEX IF NOT EXISTS inventory_valuation_snapshots_branch_id_idx
  ON public.inventory_valuation_snapshots (branch_id);
CREATE INDEX IF NOT EXISTS inventory_valuation_snapshots_location_id_idx
  ON public.inventory_valuation_snapshots (location_id);
CREATE INDEX IF NOT EXISTS inventory_valuation_snapshots_variant_id_idx
  ON public.inventory_valuation_snapshots (variant_id);

CREATE INDEX IF NOT EXISTS inventory_variant_option_values_organization_id_idx
  ON public.inventory_variant_option_values (organization_id);
CREATE INDEX IF NOT EXISTS inventory_variant_option_values_variant_fk_idx
  ON public.inventory_variant_option_values (variant_id, organization_id);
