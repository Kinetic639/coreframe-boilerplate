-- =============================================================================
-- Migration: inventory_fk_performance_indexes
-- Project:   rjeraydumwechpjjzrus (TARGET)
-- Purpose:   Cover inventory foreign keys reported by Supabase performance advisor.
-- =============================================================================

-- Phase 1 core ownership and actor FKs.
CREATE INDEX IF NOT EXISTS inventory_settings_created_by_idx
  ON public.inventory_settings (created_by);
CREATE INDEX IF NOT EXISTS inventory_settings_updated_by_idx
  ON public.inventory_settings (updated_by);

CREATE INDEX IF NOT EXISTS inventory_units_created_by_idx
  ON public.inventory_units (created_by);
CREATE INDEX IF NOT EXISTS inventory_units_updated_by_idx
  ON public.inventory_units (updated_by);

CREATE INDEX IF NOT EXISTS inventory_products_base_unit_org_idx
  ON public.inventory_products (base_unit_id, organization_id);
CREATE INDEX IF NOT EXISTS inventory_products_default_variant_org_idx
  ON public.inventory_products (default_variant_id, organization_id);
CREATE INDEX IF NOT EXISTS inventory_products_created_by_idx
  ON public.inventory_products (created_by);
CREATE INDEX IF NOT EXISTS inventory_products_updated_by_idx
  ON public.inventory_products (updated_by);
CREATE INDEX IF NOT EXISTS inventory_products_archived_by_idx
  ON public.inventory_products (archived_by);
CREATE INDEX IF NOT EXISTS inventory_products_preferred_supplier_id_idx
  ON public.inventory_products (preferred_supplier_id);

CREATE INDEX IF NOT EXISTS inventory_variants_product_org_idx
  ON public.inventory_variants (product_id, organization_id);
CREATE INDEX IF NOT EXISTS inventory_variants_created_by_idx
  ON public.inventory_variants (created_by);
CREATE INDEX IF NOT EXISTS inventory_variants_updated_by_idx
  ON public.inventory_variants (updated_by);
CREATE INDEX IF NOT EXISTS inventory_variants_archived_by_idx
  ON public.inventory_variants (archived_by);

CREATE INDEX IF NOT EXISTS inventory_movement_reasons_created_by_idx
  ON public.inventory_movement_reasons (created_by);
CREATE INDEX IF NOT EXISTS inventory_movement_reasons_updated_by_idx
  ON public.inventory_movement_reasons (updated_by);

CREATE INDEX IF NOT EXISTS inventory_movement_headers_branch_org_idx
  ON public.inventory_movement_headers (branch_id, organization_id);
CREATE INDEX IF NOT EXISTS inventory_movement_headers_reason_org_idx
  ON public.inventory_movement_headers (reason_id, organization_id);
CREATE INDEX IF NOT EXISTS inventory_movement_headers_original_movement_idx
  ON public.inventory_movement_headers (original_movement_id);
CREATE INDEX IF NOT EXISTS inventory_movement_headers_reversal_movement_idx
  ON public.inventory_movement_headers (reversal_movement_id);
CREATE INDEX IF NOT EXISTS inventory_movement_headers_created_by_idx
  ON public.inventory_movement_headers (created_by);
CREATE INDEX IF NOT EXISTS inventory_movement_headers_posted_by_idx
  ON public.inventory_movement_headers (posted_by);
CREATE INDEX IF NOT EXISTS inventory_movement_headers_cancelled_by_idx
  ON public.inventory_movement_headers (cancelled_by);
CREATE INDEX IF NOT EXISTS inventory_movement_headers_reversed_by_idx
  ON public.inventory_movement_headers (reversed_by);

CREATE INDEX IF NOT EXISTS inventory_movement_lines_movement_org_branch_idx
  ON public.inventory_movement_lines (movement_id, organization_id, branch_id);
CREATE INDEX IF NOT EXISTS inventory_movement_lines_variant_org_idx
  ON public.inventory_movement_lines (variant_id, organization_id);
CREATE INDEX IF NOT EXISTS inventory_movement_lines_unit_org_idx
  ON public.inventory_movement_lines (unit_id, organization_id);
CREATE INDEX IF NOT EXISTS inventory_movement_lines_source_location_org_branch_idx
  ON public.inventory_movement_lines (source_location_id, organization_id, branch_id);
CREATE INDEX IF NOT EXISTS inventory_movement_lines_destination_location_org_branch_idx
  ON public.inventory_movement_lines (destination_location_id, organization_id, branch_id);
CREATE INDEX IF NOT EXISTS inventory_movement_lines_lot_org_idx
  ON public.inventory_movement_lines (lot_id, organization_id);
CREATE INDEX IF NOT EXISTS inventory_movement_lines_serial_org_idx
  ON public.inventory_movement_lines (serial_id, organization_id);

CREATE INDEX IF NOT EXISTS inventory_balances_branch_org_idx
  ON public.inventory_balances (branch_id, organization_id);
CREATE INDEX IF NOT EXISTS inventory_balances_location_org_branch_idx
  ON public.inventory_balances (location_id, organization_id, branch_id);
CREATE INDEX IF NOT EXISTS inventory_balances_variant_org_idx
  ON public.inventory_balances (variant_id, organization_id);
CREATE INDEX IF NOT EXISTS inventory_balances_lot_org_idx
  ON public.inventory_balances (lot_id, organization_id);
CREATE INDEX IF NOT EXISTS inventory_balances_serial_org_idx
  ON public.inventory_balances (serial_id, organization_id);
CREATE INDEX IF NOT EXISTS inventory_balances_last_movement_id_idx
  ON public.inventory_balances (last_movement_id);

-- Phase 2 variants, lots, reservations, allocations, procurement, and costing.
CREATE INDEX IF NOT EXISTS inventory_option_groups_created_by_idx
  ON public.inventory_option_groups (created_by);
CREATE INDEX IF NOT EXISTS inventory_option_groups_updated_by_idx
  ON public.inventory_option_groups (updated_by);
CREATE INDEX IF NOT EXISTS inventory_option_values_group_org_idx
  ON public.inventory_option_values (option_group_id, organization_id);
CREATE INDEX IF NOT EXISTS inventory_option_values_created_by_idx
  ON public.inventory_option_values (created_by);
CREATE INDEX IF NOT EXISTS inventory_option_values_updated_by_idx
  ON public.inventory_option_values (updated_by);
CREATE INDEX IF NOT EXISTS inventory_variant_option_values_group_org_idx
  ON public.inventory_variant_option_values (option_group_id, organization_id);
CREATE INDEX IF NOT EXISTS inventory_variant_option_values_value_org_idx
  ON public.inventory_variant_option_values (option_value_id, organization_id);

CREATE INDEX IF NOT EXISTS inventory_lots_product_org_idx
  ON public.inventory_lots (product_id, organization_id);
CREATE INDEX IF NOT EXISTS inventory_lots_variant_org_idx
  ON public.inventory_lots (variant_id, organization_id);
CREATE INDEX IF NOT EXISTS inventory_lots_created_by_idx
  ON public.inventory_lots (created_by);
CREATE INDEX IF NOT EXISTS inventory_lots_updated_by_idx
  ON public.inventory_lots (updated_by);

CREATE INDEX IF NOT EXISTS inventory_serials_product_org_idx
  ON public.inventory_serials (product_id, organization_id);
CREATE INDEX IF NOT EXISTS inventory_serials_variant_org_idx
  ON public.inventory_serials (variant_id, organization_id);
CREATE INDEX IF NOT EXISTS inventory_serials_lot_org_idx
  ON public.inventory_serials (lot_id, organization_id);
CREATE INDEX IF NOT EXISTS inventory_serials_current_branch_id_idx
  ON public.inventory_serials (current_branch_id);
CREATE INDEX IF NOT EXISTS inventory_serials_current_location_id_idx
  ON public.inventory_serials (current_location_id);
CREATE INDEX IF NOT EXISTS inventory_serials_created_by_idx
  ON public.inventory_serials (created_by);
CREATE INDEX IF NOT EXISTS inventory_serials_updated_by_idx
  ON public.inventory_serials (updated_by);

CREATE INDEX IF NOT EXISTS inventory_reservations_branch_id_idx
  ON public.inventory_reservations (branch_id);
CREATE INDEX IF NOT EXISTS inventory_reservations_created_by_idx
  ON public.inventory_reservations (created_by);
CREATE INDEX IF NOT EXISTS inventory_reservations_cancelled_by_idx
  ON public.inventory_reservations (cancelled_by);
CREATE INDEX IF NOT EXISTS inventory_reservation_lines_branch_id_idx
  ON public.inventory_reservation_lines (branch_id);
CREATE INDEX IF NOT EXISTS inventory_reservation_lines_reservation_id_idx
  ON public.inventory_reservation_lines (reservation_id);
CREATE INDEX IF NOT EXISTS inventory_reservation_lines_product_id_idx
  ON public.inventory_reservation_lines (product_id);
CREATE INDEX IF NOT EXISTS inventory_reservation_lines_variant_id_idx
  ON public.inventory_reservation_lines (variant_id);
CREATE INDEX IF NOT EXISTS inventory_reservation_lines_location_id_idx
  ON public.inventory_reservation_lines (location_id);
CREATE INDEX IF NOT EXISTS inventory_reservation_lines_lot_id_idx
  ON public.inventory_reservation_lines (lot_id);
CREATE INDEX IF NOT EXISTS inventory_reservation_lines_serial_id_idx
  ON public.inventory_reservation_lines (serial_id);

CREATE INDEX IF NOT EXISTS inventory_allocations_branch_id_idx
  ON public.inventory_allocations (branch_id);
CREATE INDEX IF NOT EXISTS inventory_allocations_reservation_id_idx
  ON public.inventory_allocations (reservation_id);
CREATE INDEX IF NOT EXISTS inventory_allocations_created_by_idx
  ON public.inventory_allocations (created_by);
CREATE INDEX IF NOT EXISTS inventory_allocation_lines_branch_id_idx
  ON public.inventory_allocation_lines (branch_id);
CREATE INDEX IF NOT EXISTS inventory_allocation_lines_allocation_id_idx
  ON public.inventory_allocation_lines (allocation_id);
CREATE INDEX IF NOT EXISTS inventory_allocation_lines_reservation_line_id_idx
  ON public.inventory_allocation_lines (reservation_line_id);
CREATE INDEX IF NOT EXISTS inventory_allocation_lines_product_id_idx
  ON public.inventory_allocation_lines (product_id);
CREATE INDEX IF NOT EXISTS inventory_allocation_lines_variant_id_idx
  ON public.inventory_allocation_lines (variant_id);
CREATE INDEX IF NOT EXISTS inventory_allocation_lines_location_id_idx
  ON public.inventory_allocation_lines (location_id);
CREATE INDEX IF NOT EXISTS inventory_allocation_lines_lot_id_idx
  ON public.inventory_allocation_lines (lot_id);
CREATE INDEX IF NOT EXISTS inventory_allocation_lines_serial_id_idx
  ON public.inventory_allocation_lines (serial_id);

CREATE INDEX IF NOT EXISTS inventory_suppliers_created_by_idx
  ON public.inventory_suppliers (created_by);
CREATE INDEX IF NOT EXISTS inventory_purchase_orders_branch_id_idx
  ON public.inventory_purchase_orders (branch_id);
CREATE INDEX IF NOT EXISTS inventory_purchase_orders_supplier_id_idx
  ON public.inventory_purchase_orders (supplier_id);
CREATE INDEX IF NOT EXISTS inventory_purchase_orders_delivery_location_id_idx
  ON public.inventory_purchase_orders (delivery_location_id);
CREATE INDEX IF NOT EXISTS inventory_purchase_orders_created_by_idx
  ON public.inventory_purchase_orders (created_by);
CREATE INDEX IF NOT EXISTS inventory_purchase_order_lines_branch_id_idx
  ON public.inventory_purchase_order_lines (branch_id);
CREATE INDEX IF NOT EXISTS inventory_purchase_order_lines_product_id_idx
  ON public.inventory_purchase_order_lines (product_id);
CREATE INDEX IF NOT EXISTS inventory_purchase_order_lines_variant_id_idx
  ON public.inventory_purchase_order_lines (variant_id);
CREATE INDEX IF NOT EXISTS inventory_purchase_order_lines_unit_id_idx
  ON public.inventory_purchase_order_lines (unit_id);
CREATE INDEX IF NOT EXISTS inventory_variant_costs_branch_id_idx
  ON public.inventory_variant_costs (branch_id);
CREATE INDEX IF NOT EXISTS inventory_variant_costs_variant_id_idx
  ON public.inventory_variant_costs (variant_id);

-- Phase 3 and product enhancement FKs.
CREATE INDEX IF NOT EXISTS inventory_unit_conversions_from_unit_id_idx
  ON public.inventory_unit_conversions (from_unit_id);
CREATE INDEX IF NOT EXISTS inventory_unit_conversions_to_unit_id_idx
  ON public.inventory_unit_conversions (to_unit_id);
CREATE INDEX IF NOT EXISTS inventory_unit_conversions_created_by_idx
  ON public.inventory_unit_conversions (created_by);
CREATE INDEX IF NOT EXISTS inventory_product_unit_conversions_product_id_idx
  ON public.inventory_product_unit_conversions (product_id);
CREATE INDEX IF NOT EXISTS inventory_product_unit_conversions_from_unit_id_idx
  ON public.inventory_product_unit_conversions (from_unit_id);
CREATE INDEX IF NOT EXISTS inventory_product_unit_conversions_to_unit_id_idx
  ON public.inventory_product_unit_conversions (to_unit_id);
CREATE INDEX IF NOT EXISTS inventory_product_unit_conversions_created_by_idx
  ON public.inventory_product_unit_conversions (created_by);

CREATE INDEX IF NOT EXISTS inventory_custom_fields_created_by_idx
  ON public.inventory_custom_fields (created_by);
CREATE INDEX IF NOT EXISTS inventory_custom_field_values_field_id_idx
  ON public.inventory_custom_field_values (field_id);
CREATE INDEX IF NOT EXISTS inventory_custom_field_values_product_id_idx
  ON public.inventory_custom_field_values (product_id);
CREATE INDEX IF NOT EXISTS inventory_custom_field_values_variant_id_idx
  ON public.inventory_custom_field_values (variant_id);
CREATE INDEX IF NOT EXISTS inventory_custom_field_values_lot_id_idx
  ON public.inventory_custom_field_values (lot_id);
CREATE INDEX IF NOT EXISTS inventory_custom_field_values_serial_id_idx
  ON public.inventory_custom_field_values (serial_id);
CREATE INDEX IF NOT EXISTS inventory_custom_field_values_created_by_idx
  ON public.inventory_custom_field_values (created_by);

CREATE INDEX IF NOT EXISTS inventory_collections_created_by_idx
  ON public.inventory_collections (created_by);
CREATE INDEX IF NOT EXISTS inventory_collection_items_collection_id_idx
  ON public.inventory_collection_items (collection_id);
CREATE INDEX IF NOT EXISTS inventory_collection_items_product_id_idx
  ON public.inventory_collection_items (product_id);
CREATE INDEX IF NOT EXISTS inventory_collection_items_created_by_idx
  ON public.inventory_collection_items (created_by);
CREATE INDEX IF NOT EXISTS inventory_saved_views_user_id_idx
  ON public.inventory_saved_views (user_id);
CREATE INDEX IF NOT EXISTS inventory_import_jobs_branch_id_idx
  ON public.inventory_import_jobs (branch_id);
CREATE INDEX IF NOT EXISTS inventory_import_jobs_created_by_idx
  ON public.inventory_import_jobs (created_by);
CREATE INDEX IF NOT EXISTS inventory_export_jobs_branch_id_idx
  ON public.inventory_export_jobs (branch_id);
CREATE INDEX IF NOT EXISTS inventory_export_jobs_created_by_idx
  ON public.inventory_export_jobs (created_by);
CREATE INDEX IF NOT EXISTS inventory_reorder_rules_variant_id_idx
  ON public.inventory_reorder_rules (variant_id);
CREATE INDEX IF NOT EXISTS inventory_reorder_rules_location_id_idx
  ON public.inventory_reorder_rules (location_id);
CREATE INDEX IF NOT EXISTS inventory_reorder_rules_created_by_idx
  ON public.inventory_reorder_rules (created_by);
CREATE INDEX IF NOT EXISTS inventory_report_runs_branch_id_idx
  ON public.inventory_report_runs (branch_id);
CREATE INDEX IF NOT EXISTS inventory_report_runs_created_by_idx
  ON public.inventory_report_runs (created_by);

CREATE INDEX IF NOT EXISTS inventory_count_sessions_branch_id_idx
  ON public.inventory_count_sessions (branch_id);
CREATE INDEX IF NOT EXISTS inventory_count_sessions_created_by_idx
  ON public.inventory_count_sessions (created_by);
CREATE INDEX IF NOT EXISTS inventory_count_sessions_approved_by_idx
  ON public.inventory_count_sessions (approved_by);
CREATE INDEX IF NOT EXISTS inventory_count_lines_branch_id_idx
  ON public.inventory_count_lines (branch_id);
CREATE INDEX IF NOT EXISTS inventory_count_lines_count_session_id_idx
  ON public.inventory_count_lines (count_session_id);
CREATE INDEX IF NOT EXISTS inventory_count_lines_variant_id_idx
  ON public.inventory_count_lines (variant_id);
CREATE INDEX IF NOT EXISTS inventory_count_lines_location_id_idx
  ON public.inventory_count_lines (location_id);
CREATE INDEX IF NOT EXISTS inventory_count_lines_lot_id_idx
  ON public.inventory_count_lines (lot_id);
CREATE INDEX IF NOT EXISTS inventory_count_lines_serial_id_idx
  ON public.inventory_count_lines (serial_id);
CREATE INDEX IF NOT EXISTS inventory_count_lines_unit_id_idx
  ON public.inventory_count_lines (unit_id);
CREATE INDEX IF NOT EXISTS inventory_count_lines_counted_by_idx
  ON public.inventory_count_lines (counted_by);

CREATE INDEX IF NOT EXISTS inventory_brands_created_by_idx
  ON public.inventory_brands (created_by);
CREATE INDEX IF NOT EXISTS inventory_brands_updated_by_idx
  ON public.inventory_brands (updated_by);
CREATE INDEX IF NOT EXISTS inventory_manufacturers_created_by_idx
  ON public.inventory_manufacturers (created_by);
CREATE INDEX IF NOT EXISTS inventory_manufacturers_updated_by_idx
  ON public.inventory_manufacturers (updated_by);
CREATE INDEX IF NOT EXISTS inventory_item_images_product_org_idx
  ON public.inventory_item_images (product_id, organization_id);
CREATE INDEX IF NOT EXISTS inventory_item_images_variant_org_idx
  ON public.inventory_item_images (variant_id, organization_id);
CREATE INDEX IF NOT EXISTS inventory_item_images_created_by_idx
  ON public.inventory_item_images (created_by);
CREATE INDEX IF NOT EXISTS inventory_sku_templates_created_by_idx
  ON public.inventory_sku_templates (created_by);
CREATE INDEX IF NOT EXISTS inventory_tags_created_by_idx
  ON public.inventory_tags (created_by);
CREATE INDEX IF NOT EXISTS inventory_product_tags_product_org_idx
  ON public.inventory_product_tags (product_id, organization_id);
CREATE INDEX IF NOT EXISTS inventory_product_tags_tag_org_idx
  ON public.inventory_product_tags (tag_id, organization_id);
CREATE INDEX IF NOT EXISTS inventory_product_tags_created_by_idx
  ON public.inventory_product_tags (created_by);
CREATE INDEX IF NOT EXISTS inventory_tax_rates_created_by_idx
  ON public.inventory_tax_rates (created_by);

-- Cross-branch transfers.
CREATE INDEX IF NOT EXISTS inventory_branch_transfers_org_idx
  ON public.inventory_branch_transfers (organization_id);
CREATE INDEX IF NOT EXISTS inventory_branch_transfers_source_branch_id_idx
  ON public.inventory_branch_transfers (source_branch_id);
CREATE INDEX IF NOT EXISTS inventory_branch_transfers_destination_branch_id_idx
  ON public.inventory_branch_transfers (destination_branch_id);
CREATE INDEX IF NOT EXISTS inventory_branch_transfers_source_movement_id_idx
  ON public.inventory_branch_transfers (source_movement_id);
CREATE INDEX IF NOT EXISTS inventory_branch_transfers_destination_movement_id_idx
  ON public.inventory_branch_transfers (destination_movement_id);
CREATE INDEX IF NOT EXISTS inventory_branch_transfers_return_movement_id_idx
  ON public.inventory_branch_transfers (return_movement_id);
CREATE INDEX IF NOT EXISTS inventory_branch_transfers_sent_by_idx
  ON public.inventory_branch_transfers (sent_by);
CREATE INDEX IF NOT EXISTS inventory_branch_transfers_accepted_by_idx
  ON public.inventory_branch_transfers (accepted_by);
CREATE INDEX IF NOT EXISTS inventory_branch_transfers_declined_by_idx
  ON public.inventory_branch_transfers (declined_by);
CREATE INDEX IF NOT EXISTS inventory_branch_transfer_lines_org_idx
  ON public.inventory_branch_transfer_lines (organization_id);
CREATE INDEX IF NOT EXISTS inventory_branch_transfer_lines_transfer_id_idx
  ON public.inventory_branch_transfer_lines (transfer_id);
CREATE INDEX IF NOT EXISTS inventory_branch_transfer_lines_variant_id_idx
  ON public.inventory_branch_transfer_lines (variant_id);
CREATE INDEX IF NOT EXISTS inventory_branch_transfer_lines_source_location_id_idx
  ON public.inventory_branch_transfer_lines (source_location_id);
CREATE INDEX IF NOT EXISTS inventory_branch_transfer_lines_destination_location_id_idx
  ON public.inventory_branch_transfer_lines (destination_location_id);
CREATE INDEX IF NOT EXISTS inventory_branch_transfer_lines_lot_id_idx
  ON public.inventory_branch_transfer_lines (lot_id);
CREATE INDEX IF NOT EXISTS inventory_branch_transfer_lines_serial_id_idx
  ON public.inventory_branch_transfer_lines (serial_id);
CREATE INDEX IF NOT EXISTS inventory_branch_transfer_lines_unit_id_idx
  ON public.inventory_branch_transfer_lines (unit_id);
