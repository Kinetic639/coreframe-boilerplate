-- =============================================
-- Migration: Simplify Variants System
-- Removes complex functions and adds performance indexes
-- =============================================

-- Step 1: Remove complex variant functions that cause over-engineering
DROP FUNCTION IF EXISTS create_variant_batch(UUID, JSONB);
DROP FUNCTION IF EXISTS generate_variant_combinations(UUID, JSONB);
DROP FUNCTION IF EXISTS update_variant_pricing(JSONB[]);
DROP FUNCTION IF EXISTS get_variant_performance(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS generate_variant_skus(UUID, TEXT);
DROP FUNCTION IF EXISTS compare_variants(UUID[]);
DROP FUNCTION IF EXISTS get_variant_stock_summary(UUID);

-- Step 2: Add performance indexes for the simplified system
-- These replace the complex functions with fast, simple queries

-- Index for variant lookups by product
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id
ON product_variants(product_id)
WHERE deleted_at IS NULL;

-- Index for SKU searches (commonly used for lookups)
CREATE INDEX IF NOT EXISTS idx_product_variants_sku
ON product_variants(sku)
WHERE deleted_at IS NULL AND sku IS NOT NULL;

-- Index for variant status filtering
CREATE INDEX IF NOT EXISTS idx_product_variants_status
ON product_variants(status)
WHERE deleted_at IS NULL;

-- Index for variant attributes (for attribute-based searches)
CREATE INDEX IF NOT EXISTS idx_product_attributes_variant_key
ON product_attributes(variant_id, attribute_key)
WHERE variant_id IS NOT NULL;

-- Index for product attributes (for product-level searches)
CREATE INDEX IF NOT EXISTS idx_product_attributes_product_key
ON product_attributes(product_id, attribute_key);

-- Index for stock snapshots (for fast stock lookups)
CREATE INDEX IF NOT EXISTS idx_stock_snapshots_variant
ON stock_snapshots(variant_id, created_at DESC)
WHERE variant_id IS NOT NULL;

-- Composite index for common product queries
CREATE INDEX IF NOT EXISTS idx_products_org_template_status
ON products(organization_id, template_id, status)
WHERE deleted_at IS NULL;

-- Step 3: Create a simple view for variant data with stock
-- This replaces complex joins in the application layer
CREATE OR REPLACE VIEW variant_with_stock AS
SELECT
  v.*,
  COALESCE(latest_stock.quantity_on_hand, 0) as stock_quantity,
  COALESCE(latest_stock.total_value, 0) as stock_value
FROM product_variants v
LEFT JOIN LATERAL (
  SELECT
    quantity_on_hand,
    total_value
  FROM stock_snapshots ss
  WHERE ss.variant_id = v.id
  ORDER BY ss.created_at DESC
  LIMIT 1
) latest_stock ON true
WHERE v.deleted_at IS NULL;

-- Step 4: Grant permissions
GRANT SELECT ON variant_with_stock TO authenticated;

-- Step 5: Add comments for documentation
COMMENT ON INDEX idx_product_variants_product_id IS 'Fast lookup of variants by product ID';
COMMENT ON INDEX idx_product_variants_sku IS 'Fast SKU-based variant searches';
COMMENT ON INDEX idx_product_variants_status IS 'Filter variants by status efficiently';
COMMENT ON INDEX idx_product_attributes_variant_key IS 'Fast attribute lookups for variants';
COMMENT ON INDEX idx_stock_snapshots_variant IS 'Latest stock info for variants';
COMMENT ON VIEW variant_with_stock IS 'Simplified view combining variants with their latest stock data';