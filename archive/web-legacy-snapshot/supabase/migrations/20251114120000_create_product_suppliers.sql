-- Migration: Create Product-Supplier Integration Tables
-- Version: 1.0
-- Date: 2024-11-14
-- Description: Enables many-to-many product-supplier relationships with pricing, lead times, and MOQ tracking

-- =====================================================
-- Table: product_suppliers
-- =====================================================
-- Tracks supplier relationships for products with pricing and ordering parameters

CREATE TABLE IF NOT EXISTS product_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  supplier_id UUID NOT NULL REFERENCES business_accounts(id) ON DELETE RESTRICT,

  -- Supplier-specific product data
  supplier_sku TEXT, -- Supplier's part/SKU number
  supplier_product_name TEXT, -- How supplier names this product
  supplier_product_description TEXT, -- Supplier's description

  -- Pricing
  unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0), -- Cost price from this supplier
  currency_code TEXT DEFAULT 'PLN',
  price_valid_from DATE DEFAULT CURRENT_DATE,
  price_valid_until DATE, -- NULL = no expiry

  -- Ordering parameters
  lead_time_days INTEGER DEFAULT 0 CHECK (lead_time_days >= 0), -- Days from order to delivery
  min_order_qty DECIMAL(15,3) DEFAULT 1 CHECK (min_order_qty > 0), -- Minimum order quantity
  order_multiple DECIMAL(15,3) DEFAULT 1 CHECK (order_multiple > 0), -- Must order in multiples (e.g., packs of 12)

  -- Preferences & status
  is_preferred BOOLEAN DEFAULT false, -- Primary/preferred supplier
  is_active BOOLEAN DEFAULT true, -- Can still order from this supplier
  priority_rank INTEGER DEFAULT 0, -- Lower number = higher priority (0 = highest)

  -- Additional info
  notes TEXT,
  last_order_date DATE,
  last_order_price DECIMAL(15,2),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ, -- Soft delete

  -- Constraints
  UNIQUE(product_id, supplier_id) -- One relationship per supplier per product
);

-- Add comment
COMMENT ON TABLE product_suppliers IS 'Many-to-many relationship between products and suppliers with pricing and ordering parameters';

-- =====================================================
-- Indexes for product_suppliers
-- =====================================================

-- Product lookups (find all suppliers for a product)
CREATE INDEX idx_product_suppliers_product
  ON product_suppliers(product_id)
  WHERE deleted_at IS NULL;

-- Supplier lookups (find all products for a supplier)
CREATE INDEX idx_product_suppliers_supplier
  ON product_suppliers(supplier_id)
  WHERE deleted_at IS NULL;

-- Preferred supplier lookups
CREATE INDEX idx_product_suppliers_preferred
  ON product_suppliers(product_id, is_preferred)
  WHERE is_preferred = true AND is_active = true AND deleted_at IS NULL;

-- Active suppliers only
CREATE INDEX idx_product_suppliers_active
  ON product_suppliers(product_id, is_active)
  WHERE is_active = true AND deleted_at IS NULL;

-- Ensure only one preferred supplier per product
CREATE UNIQUE INDEX idx_product_suppliers_one_preferred
  ON product_suppliers(product_id)
  WHERE is_preferred = true AND is_active = true AND deleted_at IS NULL;

-- =====================================================
-- Triggers for product_suppliers
-- =====================================================

-- Auto-update timestamp
CREATE TRIGGER trg_product_suppliers_updated_at
  BEFORE UPDATE ON product_suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Table: product_supplier_price_history
-- =====================================================
-- Track historical pricing for analysis and reporting

CREATE TABLE IF NOT EXISTS product_supplier_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_supplier_id UUID NOT NULL REFERENCES product_suppliers(id) ON DELETE CASCADE,

  -- Price info
  unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
  currency_code TEXT DEFAULT 'PLN',
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,

  -- Why price changed
  change_reason TEXT, -- e.g., "Supplier price increase", "Volume discount", "Market adjustment"

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Add comment
COMMENT ON TABLE product_supplier_price_history IS 'Historical pricing data for product-supplier relationships';

-- =====================================================
-- Indexes for product_supplier_price_history
-- =====================================================

CREATE INDEX idx_price_history_supplier
  ON product_supplier_price_history(product_supplier_id);

CREATE INDEX idx_price_history_date
  ON product_supplier_price_history(effective_date DESC);

-- =====================================================
-- Trigger: Auto-create price history on price change
-- =====================================================

CREATE OR REPLACE FUNCTION create_price_history_on_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create history if price actually changed
  IF OLD.unit_price IS DISTINCT FROM NEW.unit_price THEN
    -- Close out old price record
    UPDATE product_supplier_price_history
    SET end_date = CURRENT_DATE
    WHERE product_supplier_id = OLD.id
      AND end_date IS NULL;

    -- Create new price history record
    INSERT INTO product_supplier_price_history (
      product_supplier_id,
      unit_price,
      currency_code,
      effective_date,
      change_reason,
      created_by
    ) VALUES (
      NEW.id,
      NEW.unit_price,
      NEW.currency_code,
      CURRENT_DATE,
      'Price updated',
      NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_price_history
  AFTER UPDATE ON product_suppliers
  FOR EACH ROW
  WHEN (OLD.unit_price IS DISTINCT FROM NEW.unit_price)
  EXECUTE FUNCTION create_price_history_on_update();

-- =====================================================
-- Data Migration: Migrate existing preferred suppliers
-- =====================================================

DO $$
BEGIN
  -- Migrate existing preferred_business_account_id to product_suppliers
  INSERT INTO product_suppliers (
    product_id,
    supplier_id,
    is_preferred,
    is_active,
    unit_price,
    currency_code,
    created_at
  )
  SELECT
    p.id,
    p.preferred_business_account_id,
    true, -- Set as preferred
    true, -- Set as active
    COALESCE(p.cost_price, 0), -- Use existing cost_price or 0
    'PLN',
    NOW()
  FROM products p
  WHERE p.preferred_business_account_id IS NOT NULL
    AND p.deleted_at IS NULL
    -- Only migrate if business account is a vendor
    AND EXISTS (
      SELECT 1 FROM business_accounts ba
      WHERE ba.id = p.preferred_business_account_id
        AND ba.partner_type = 'vendor'
        AND ba.deleted_at IS NULL
    )
  ON CONFLICT (product_id, supplier_id) DO NOTHING;

  -- Create initial price history for migrated records
  INSERT INTO product_supplier_price_history (
    product_supplier_id,
    unit_price,
    currency_code,
    effective_date,
    change_reason,
    created_at
  )
  SELECT
    ps.id,
    ps.unit_price,
    ps.currency_code,
    ps.created_at::DATE,
    'Initial migration from products.cost_price',
    NOW()
  FROM product_suppliers ps
  WHERE ps.created_at >= NOW() - INTERVAL '1 minute' -- Only for just-created records
    AND NOT EXISTS (
      SELECT 1 FROM product_supplier_price_history pph
      WHERE pph.product_supplier_id = ps.id
    );

  RAISE NOTICE 'Product-supplier migration completed successfully';
END $$;
