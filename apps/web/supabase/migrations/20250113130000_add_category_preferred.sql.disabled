-- Add is_preferred field to product_categories
-- This allows users to mark a category as their preferred/default for quick access
-- Unlike is_default (which is for the hidden "Uncategorized"), this is user-controlled

ALTER TABLE product_categories
ADD COLUMN is_preferred BOOLEAN DEFAULT false;

-- Create index for preferred categories
CREATE INDEX idx_product_categories_preferred
ON product_categories(organization_id, is_preferred)
WHERE is_preferred = true AND deleted_at IS NULL;

-- Add comment
COMMENT ON COLUMN product_categories.is_preferred IS 'User-preferred category for quick selection (starred). Unlike is_default which is system-managed.';
