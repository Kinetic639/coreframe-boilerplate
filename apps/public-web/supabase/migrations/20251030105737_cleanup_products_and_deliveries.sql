-- =============================================
-- Cleanup Products and Deliveries Migration
-- Removes all existing products and delivery-related stock movements
-- =============================================

-- Delete all stock movements with movement_type_code '101' (deliveries/receipts)
-- This cascades to related stock_snapshots and other dependent records
DELETE FROM stock_movements
WHERE movement_type_code = '101';

-- Delete all other stock movements (to ensure clean state)
DELETE FROM stock_movements;

-- Delete product images
DELETE FROM product_images;

-- Delete product variants
DELETE FROM product_variants;

-- Delete product barcodes
DELETE FROM product_barcodes;

-- Delete product custom field values
DELETE FROM product_custom_field_values;

-- Delete variant attribute values
DELETE FROM variant_attribute_values;

-- Delete product group attributes
DELETE FROM product_group_attributes;

-- Delete all products (main table)
DELETE FROM products;

-- Delete product categories (optional - removes custom categories)
DELETE FROM product_categories;

-- Delete variant option values
DELETE FROM variant_option_values;

-- Delete variant option groups
DELETE FROM variant_option_groups;

-- Delete product custom field definitions
DELETE FROM product_custom_field_definitions;
