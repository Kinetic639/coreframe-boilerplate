-- =====================================================
-- Purchase Orders System Migration
-- =====================================================
-- Description: Creates tables and functions for purchase order management
-- Dependencies: products, business_accounts, product_suppliers, locations
-- Author: Development Team
-- Date: 2025-11-15
-- =====================================================

-- =====================================================
-- 1. PURCHASE ORDERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organization & Branch
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT,

  -- PO Information
  po_number TEXT UNIQUE NOT NULL,
  po_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  delivery_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,

  -- Supplier
  supplier_id UUID NOT NULL REFERENCES business_accounts(id) ON DELETE RESTRICT,
  supplier_name TEXT NOT NULL, -- Denormalized for history
  supplier_email TEXT,
  supplier_phone TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft',
  -- Workflow: draft → pending → approved → partially_received → received → closed
  -- Can be cancelled at any stage except closed

  -- Financial
  subtotal DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  shipping_cost DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  currency_code TEXT DEFAULT 'PLN',

  -- Payment
  payment_terms TEXT, -- e.g., "Net 30", "COD", "50% upfront"
  payment_status TEXT DEFAULT 'unpaid',
  amount_paid DECIMAL(15,2) DEFAULT 0,

  -- Tracking
  supplier_reference TEXT, -- Supplier's PO number
  tracking_number TEXT,

  -- Notes
  notes TEXT, -- Visible to supplier
  internal_notes TEXT, -- Internal only

  -- Approval
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ, -- Soft delete
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),
  cancellation_reason TEXT,

  -- Constraints
  CONSTRAINT chk_po_status CHECK (status IN (
    'draft',
    'pending',
    'approved',
    'partially_received',
    'received',
    'cancelled',
    'closed'
  )),
  CONSTRAINT chk_po_payment_status CHECK (payment_status IN (
    'unpaid',
    'partially_paid',
    'paid'
  )),
  CONSTRAINT chk_po_total_amount CHECK (total_amount >= 0),
  CONSTRAINT chk_po_amount_paid CHECK (amount_paid >= 0 AND amount_paid <= total_amount),
  CONSTRAINT chk_po_delivery_date CHECK (expected_delivery_date >= po_date OR expected_delivery_date IS NULL)
);

-- Indexes for performance
CREATE INDEX idx_purchase_orders_org ON purchase_orders(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_branch ON purchase_orders(branch_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_date ON purchase_orders(po_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_number ON purchase_orders(po_number);
CREATE INDEX idx_purchase_orders_expected_delivery ON purchase_orders(expected_delivery_date) WHERE deleted_at IS NULL AND status NOT IN ('cancelled', 'closed', 'received');

-- Comments
COMMENT ON TABLE purchase_orders IS 'Purchase orders for procuring products from suppliers';
COMMENT ON COLUMN purchase_orders.po_number IS 'Auto-generated unique PO number (format: PO-YYYY-00001)';
COMMENT ON COLUMN purchase_orders.status IS 'Current status of the purchase order';
COMMENT ON COLUMN purchase_orders.payment_status IS 'Payment status tracking';
COMMENT ON COLUMN purchase_orders.supplier_name IS 'Denormalized supplier name for historical record';

-- =====================================================
-- 2. PURCHASE ORDER ITEMS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,

  -- Product Information
  product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
  product_supplier_id UUID REFERENCES product_suppliers(id) ON DELETE SET NULL,

  -- Denormalized product info (for historical record)
  product_name TEXT NOT NULL,
  product_sku TEXT,
  supplier_sku TEXT,
  variant_name TEXT,

  -- Quantity & Pricing
  quantity_ordered DECIMAL(15,3) NOT NULL CHECK (quantity_ordered > 0),
  quantity_received DECIMAL(15,3) DEFAULT 0 CHECK (quantity_received >= 0),
  quantity_pending DECIMAL(15,3) GENERATED ALWAYS AS (quantity_ordered - quantity_received) STORED,

  unit_of_measure TEXT,
  unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
  tax_rate DECIMAL(5,2) DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
  discount_percent DECIMAL(5,2) DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),

  -- Calculated fields (stored for performance and history)
  subtotal DECIMAL(15,2) GENERATED ALWAYS AS (quantity_ordered * unit_price) STORED,
  discount_amount DECIMAL(15,2) GENERATED ALWAYS AS (quantity_ordered * unit_price * discount_percent / 100) STORED,
  tax_amount DECIMAL(15,2) GENERATED ALWAYS AS ((quantity_ordered * unit_price - (quantity_ordered * unit_price * discount_percent / 100)) * tax_rate / 100) STORED,
  line_total DECIMAL(15,2) GENERATED ALWAYS AS (
    (quantity_ordered * unit_price) -
    (quantity_ordered * unit_price * discount_percent / 100) +
    ((quantity_ordered * unit_price - (quantity_ordered * unit_price * discount_percent / 100)) * tax_rate / 100)
  ) STORED,

  -- Stock Management
  expected_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ, -- Soft delete

  -- Constraints
  CONSTRAINT chk_poi_quantity_received CHECK (quantity_received <= quantity_ordered)
);

-- Indexes
CREATE INDEX idx_purchase_order_items_po ON purchase_order_items(purchase_order_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_order_items_product ON purchase_order_items(product_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_order_items_variant ON purchase_order_items(product_variant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_order_items_supplier ON purchase_order_items(product_supplier_id) WHERE deleted_at IS NULL;

-- Comments
COMMENT ON TABLE purchase_order_items IS 'Line items for purchase orders';
COMMENT ON COLUMN purchase_order_items.quantity_pending IS 'Auto-calculated pending quantity (ordered - received)';
COMMENT ON COLUMN purchase_order_items.line_total IS 'Auto-calculated total including tax and discounts';

-- =====================================================
-- 3. AUTO-GENERATE PO NUMBER FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  year_part TEXT;
BEGIN
  -- Only generate if po_number is NULL
  IF NEW.po_number IS NOT NULL THEN
    RETURN NEW;
  END IF;

  year_part := TO_CHAR(CURRENT_DATE, 'YYYY');

  -- Get next sequential number for this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 9) AS INTEGER)), 0) + 1
  INTO next_num
  FROM purchase_orders
  WHERE po_number LIKE 'PO-' || year_part || '-%'
    AND deleted_at IS NULL;

  -- Format: PO-YYYY-00001
  NEW.po_number := 'PO-' || year_part || '-' || LPAD(next_num::TEXT, 5, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_po_number
  BEFORE INSERT ON purchase_orders
  FOR EACH ROW
  WHEN (NEW.po_number IS NULL)
  EXECUTE FUNCTION generate_po_number();

COMMENT ON FUNCTION generate_po_number() IS 'Auto-generates sequential PO numbers in format PO-YYYY-00001';

-- =====================================================
-- 4. UPDATE PO TOTALS FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION update_po_totals()
RETURNS TRIGGER AS $$
DECLARE
  po_id UUID;
BEGIN
  -- Get the purchase order ID
  po_id := COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);

  -- Update purchase order totals
  UPDATE purchase_orders
  SET
    subtotal = (
      SELECT COALESCE(SUM(subtotal), 0)
      FROM purchase_order_items
      WHERE purchase_order_id = po_id
        AND deleted_at IS NULL
    ),
    tax_amount = (
      SELECT COALESCE(SUM(tax_amount), 0)
      FROM purchase_order_items
      WHERE purchase_order_id = po_id
        AND deleted_at IS NULL
    ),
    total_amount = (
      SELECT COALESCE(SUM(line_total), 0)
      FROM purchase_order_items
      WHERE purchase_order_id = po_id
        AND deleted_at IS NULL
    ) + COALESCE(shipping_cost, 0) - COALESCE(discount_amount, 0),
    updated_at = NOW()
  WHERE id = po_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_po_totals_insert
  AFTER INSERT ON purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_po_totals();

CREATE TRIGGER trg_update_po_totals_update
  AFTER UPDATE ON purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_po_totals();

CREATE TRIGGER trg_update_po_totals_delete
  AFTER DELETE ON purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_po_totals();

COMMENT ON FUNCTION update_po_totals() IS 'Automatically updates purchase order totals when items change';

-- =====================================================
-- 5. UPDATE PO STATUS BASED ON RECEIPTS FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION update_po_status_on_receipt()
RETURNS TRIGGER AS $$
DECLARE
  po_id UUID;
  total_ordered DECIMAL;
  total_received DECIMAL;
BEGIN
  po_id := COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);

  -- Calculate totals
  SELECT
    COALESCE(SUM(quantity_ordered), 0),
    COALESCE(SUM(quantity_received), 0)
  INTO total_ordered, total_received
  FROM purchase_order_items
  WHERE purchase_order_id = po_id
    AND deleted_at IS NULL;

  -- Update PO status based on receipt progress
  UPDATE purchase_orders
  SET
    status = CASE
      WHEN total_received = 0 THEN status -- No change if nothing received yet
      WHEN total_received >= total_ordered THEN 'received'
      WHEN total_received > 0 THEN 'partially_received'
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = po_id
    AND status NOT IN ('cancelled', 'closed'); -- Don't update if already cancelled or closed

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_po_status_on_receipt
  AFTER UPDATE OF quantity_received ON purchase_order_items
  FOR EACH ROW
  WHEN (OLD.quantity_received IS DISTINCT FROM NEW.quantity_received)
  EXECUTE FUNCTION update_po_status_on_receipt();

COMMENT ON FUNCTION update_po_status_on_receipt() IS 'Automatically updates PO status to partially_received or received based on item receipts';

-- =====================================================
-- 6. UPDATED_AT TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION update_purchase_order_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION update_purchase_order_updated_at();

CREATE TRIGGER trg_purchase_order_items_updated_at
  BEFORE UPDATE ON purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_order_updated_at();

-- =====================================================
-- 7. VIEWS FOR REPORTING
-- =====================================================

-- View: Purchase orders with item counts and totals
CREATE OR REPLACE VIEW purchase_orders_summary AS
SELECT
  po.id,
  po.organization_id,
  po.branch_id,
  po.po_number,
  po.po_date,
  po.expected_delivery_date,
  po.supplier_id,
  po.supplier_name,
  po.status,
  po.payment_status,
  po.total_amount,
  po.amount_paid,
  po.currency_code,
  po.created_at,
  po.created_by,
  COUNT(poi.id) AS item_count,
  COALESCE(SUM(poi.quantity_ordered), 0) AS total_quantity_ordered,
  COALESCE(SUM(poi.quantity_received), 0) AS total_quantity_received,
  COALESCE(SUM(poi.quantity_pending), 0) AS total_quantity_pending,
  CASE
    WHEN SUM(poi.quantity_pending) = 0 THEN true
    ELSE false
  END AS is_fully_received
FROM purchase_orders po
LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id AND poi.deleted_at IS NULL
WHERE po.deleted_at IS NULL
GROUP BY po.id;

COMMENT ON VIEW purchase_orders_summary IS 'Summary view of purchase orders with aggregated item statistics';

-- =====================================================
-- 8. HELPER FUNCTIONS
-- =====================================================

-- Function: Get pending purchase orders for a product
CREATE OR REPLACE FUNCTION get_pending_po_quantity(p_product_id UUID, p_variant_id UUID DEFAULT NULL)
RETURNS DECIMAL AS $$
BEGIN
  RETURN (
    SELECT COALESCE(SUM(poi.quantity_pending), 0)
    FROM purchase_order_items poi
    JOIN purchase_orders po ON po.id = poi.purchase_order_id
    WHERE poi.product_id = p_product_id
      AND (p_variant_id IS NULL OR poi.product_variant_id = p_variant_id)
      AND po.status IN ('approved', 'partially_received')
      AND po.deleted_at IS NULL
      AND poi.deleted_at IS NULL
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_pending_po_quantity(UUID, UUID) IS 'Returns total pending quantity from approved purchase orders for a product/variant';

-- =====================================================
-- 9. INITIAL DATA VALIDATION
-- =====================================================

-- Ensure business_accounts table has partner_type for suppliers
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_accounts'
    AND column_name = 'partner_type'
  ) THEN
    -- Ensure all suppliers used in POs have partner_type = 'vendor'
    -- This is a sanity check, no actual data to migrate yet
    RAISE NOTICE 'business_accounts.partner_type column exists - validation passed';
  ELSE
    RAISE WARNING 'business_accounts.partner_type column missing - supplier filtering may not work correctly';
  END IF;
END $$;

-- =====================================================
-- END OF MIGRATION
-- =====================================================

-- Grant permissions (adjust based on your RLS setup when enabled)
-- Note: RLS is currently disabled for testing, will be implemented in Phase 10
-- When RLS is enabled, these grants will need to be reviewed

-- Enable RLS (currently disabled for testing - DO NOT ENABLE YET)
-- ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Purchase Orders migration completed successfully';
  RAISE NOTICE 'Created tables: purchase_orders, purchase_order_items';
  RAISE NOTICE 'Created functions: generate_po_number, update_po_totals, update_po_status_on_receipt';
  RAISE NOTICE 'Created view: purchase_orders_summary';
  RAISE NOTICE 'Next steps: Apply migration and run type generation';
END $$;
