-- =============================================
-- Sales Orders System
-- Created: 2024-11-12
-- Purpose: Customer order management with line items
-- Dependencies: business_accounts, products, locations
-- =============================================

-- =============================================
-- Table: sales_orders
-- Purpose: Customer sales order headers
-- =============================================

CREATE TABLE sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organization & Branch
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT,

  -- Order Information
  order_number TEXT UNIQUE NOT NULL, -- Auto-generated: SO-2024-00001
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,

  -- Customer
  customer_id UUID REFERENCES business_accounts(id) ON DELETE SET NULL, -- NULL for walk-in customers
  customer_name TEXT NOT NULL, -- Denormalized for deleted customers
  customer_email TEXT,
  customer_phone TEXT,

  -- Delivery Address
  delivery_address_line1 TEXT,
  delivery_address_line2 TEXT,
  delivery_city TEXT,
  delivery_state TEXT,
  delivery_postal_code TEXT,
  delivery_country TEXT DEFAULT 'PL',

  -- Status
  status TEXT NOT NULL DEFAULT 'draft',
  -- draft: Being created
  -- pending: Awaiting approval
  -- confirmed: Approved, stock reserved
  -- processing: Being picked/packed
  -- fulfilled: Shipped/delivered
  -- cancelled: Cancelled

  -- Financial
  subtotal DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  shipping_cost DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  currency_code TEXT DEFAULT 'PLN',

  -- Tracking
  tracking_number TEXT,
  shipped_date DATE,
  delivered_date DATE,

  -- Notes
  customer_notes TEXT, -- Customer's special requests
  internal_notes TEXT, -- Internal warehouse notes

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),
  cancellation_reason TEXT,
  deleted_at TIMESTAMPTZ, -- Soft delete

  -- Constraints
  CONSTRAINT sales_orders_status_check CHECK (status IN ('draft', 'pending', 'confirmed', 'processing', 'fulfilled', 'cancelled')),
  CONSTRAINT sales_orders_total_positive CHECK (total_amount >= 0),
  CONSTRAINT sales_orders_delivery_date_check CHECK (expected_delivery_date >= order_date OR expected_delivery_date IS NULL)
);

-- Indexes for performance
CREATE INDEX idx_sales_orders_org ON sales_orders(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_orders_branch ON sales_orders(branch_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_orders_customer ON sales_orders(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_orders_status ON sales_orders(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_orders_date ON sales_orders(order_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_orders_number ON sales_orders(order_number);
CREATE INDEX idx_sales_orders_deleted ON sales_orders(deleted_at) WHERE deleted_at IS NOT NULL;

-- Comment
COMMENT ON TABLE sales_orders IS 'Customer sales orders for order management and stock reservations';
COMMENT ON COLUMN sales_orders.customer_id IS 'Reference to business_account (partner_type = customer), NULL for walk-in sales';
COMMENT ON COLUMN sales_orders.status IS 'Order workflow: draft → pending → confirmed (reserves stock) → processing → fulfilled';

-- =============================================
-- Function: Generate order numbers
-- =============================================

CREATE OR REPLACE FUNCTION generate_sales_order_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  year_part TEXT;
BEGIN
  -- Format: SO-YYYY-#####
  year_part := TO_CHAR(CURRENT_DATE, 'YYYY');

  -- Get next sequential number for this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 9) AS INTEGER)), 0) + 1
  INTO next_num
  FROM sales_orders
  WHERE order_number LIKE 'SO-' || year_part || '-%';

  -- Generate order number
  NEW.order_number := 'SO-' || year_part || '-' || LPAD(next_num::TEXT, 5, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate order numbers
CREATE TRIGGER trg_generate_sales_order_number
  BEFORE INSERT ON sales_orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL OR NEW.order_number = '')
  EXECUTE FUNCTION generate_sales_order_number();

-- =============================================
-- Table: sales_order_items
-- Purpose: Line items for sales orders
-- =============================================

CREATE TABLE sales_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE RESTRICT,

  -- Product Information
  product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,

  -- Denormalized product info (for deleted products)
  product_name TEXT NOT NULL,
  product_sku TEXT,
  variant_name TEXT,

  -- Quantity & Pricing
  quantity_ordered DECIMAL(15,3) NOT NULL,
  quantity_fulfilled DECIMAL(15,3) DEFAULT 0,
  unit_of_measure TEXT,
  unit_price DECIMAL(15,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0, -- Percentage (e.g., 23 for 23% VAT)
  discount_percent DECIMAL(5,2) DEFAULT 0, -- Percentage discount

  -- Calculated fields (using generated columns)
  subtotal DECIMAL(15,2) GENERATED ALWAYS AS (
    quantity_ordered * unit_price
  ) STORED,

  discount_amount DECIMAL(15,2) GENERATED ALWAYS AS (
    quantity_ordered * unit_price * discount_percent / 100
  ) STORED,

  tax_amount DECIMAL(15,2) GENERATED ALWAYS AS (
    (quantity_ordered * unit_price - (quantity_ordered * unit_price * discount_percent / 100)) * tax_rate / 100
  ) STORED,

  line_total DECIMAL(15,2) GENERATED ALWAYS AS (
    (quantity_ordered * unit_price) -
    (quantity_ordered * unit_price * discount_percent / 100) +
    ((quantity_ordered * unit_price - (quantity_ordered * unit_price * discount_percent / 100)) * tax_rate / 100)
  ) STORED,

  -- Stock Management
  reservation_id UUID REFERENCES stock_reservations(id) ON DELETE RESTRICT,
  location_id UUID REFERENCES locations(id) ON DELETE RESTRICT, -- Fulfillment location

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT sales_order_items_qty_positive CHECK (quantity_ordered > 0),
  CONSTRAINT sales_order_items_qty_fulfilled_check CHECK (quantity_fulfilled >= 0),
  CONSTRAINT sales_order_items_qty_max_check CHECK (quantity_fulfilled <= quantity_ordered),
  CONSTRAINT sales_order_items_price_positive CHECK (unit_price >= 0),
  CONSTRAINT sales_order_items_tax_valid CHECK (tax_rate >= 0 AND tax_rate <= 100),
  CONSTRAINT sales_order_items_discount_valid CHECK (discount_percent >= 0 AND discount_percent <= 100)
);

-- Indexes for performance
CREATE INDEX idx_sales_order_items_order ON sales_order_items(sales_order_id);
CREATE INDEX idx_sales_order_items_product ON sales_order_items(product_id);
CREATE INDEX idx_sales_order_items_variant ON sales_order_items(product_variant_id);
CREATE INDEX idx_sales_order_items_reservation ON sales_order_items(reservation_id);
CREATE INDEX idx_sales_order_items_location ON sales_order_items(location_id);

-- Comment
COMMENT ON TABLE sales_order_items IS 'Line items for sales orders with automatic total calculation';
COMMENT ON COLUMN sales_order_items.reservation_id IS 'Link to stock reservation created when order is confirmed';
COMMENT ON COLUMN sales_order_items.quantity_fulfilled IS 'Quantity that has been shipped/delivered';

-- =============================================
-- Function: Update order totals when items change
-- =============================================

CREATE OR REPLACE FUNCTION update_sales_order_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sales_orders
  SET
    subtotal = (
      SELECT COALESCE(SUM(subtotal), 0)
      FROM sales_order_items
      WHERE sales_order_id = COALESCE(NEW.sales_order_id, OLD.sales_order_id)
    ),
    tax_amount = (
      SELECT COALESCE(SUM(tax_amount), 0)
      FROM sales_order_items
      WHERE sales_order_id = COALESCE(NEW.sales_order_id, OLD.sales_order_id)
    ),
    total_amount = (
      SELECT COALESCE(SUM(line_total), 0)
      FROM sales_order_items
      WHERE sales_order_id = COALESCE(NEW.sales_order_id, OLD.sales_order_id)
    ) + COALESCE(shipping_cost, 0) - COALESCE(discount_amount, 0),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.sales_order_id, OLD.sales_order_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update order totals
CREATE TRIGGER trg_update_sales_order_totals
  AFTER INSERT OR UPDATE OR DELETE ON sales_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_order_totals();

-- =============================================
-- Sample Data (Optional - for testing)
-- =============================================

-- This section can be used to insert sample sales orders for testing
-- Uncomment below to add sample data

/*
DO $$
DECLARE
  v_org_id UUID;
  v_branch_id UUID;
  v_customer_id UUID;
  v_product_id UUID;
  v_order_id UUID;
BEGIN
  -- Get IDs (adjust these queries to match your data)
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  SELECT id INTO v_branch_id FROM branches WHERE organization_id = v_org_id LIMIT 1;
  SELECT id INTO v_customer_id FROM business_accounts WHERE partner_type = 'customer' LIMIT 1;
  SELECT id INTO v_product_id FROM products WHERE organization_id = v_org_id LIMIT 1;

  IF v_org_id IS NOT NULL AND v_product_id IS NOT NULL THEN
    -- Create sample order
    INSERT INTO sales_orders (
      organization_id,
      branch_id,
      customer_id,
      customer_name,
      customer_email,
      order_date,
      status,
      shipping_cost
    ) VALUES (
      v_org_id,
      v_branch_id,
      v_customer_id,
      'Sample Customer',
      'customer@example.com',
      CURRENT_DATE,
      'draft',
      10.00
    ) RETURNING id INTO v_order_id;

    -- Add sample order item
    INSERT INTO sales_order_items (
      sales_order_id,
      product_id,
      product_name,
      product_sku,
      quantity_ordered,
      unit_price,
      tax_rate
    ) VALUES (
      v_order_id,
      v_product_id,
      'Sample Product',
      'SKU-001',
      5,
      100.00,
      23 -- 23% VAT
    );
  END IF;
END $$;
*/

-- =============================================
-- Migration Complete
-- =============================================

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '✅ Sales orders system created successfully';
  RAISE NOTICE '📦 Tables: sales_orders, sales_order_items';
  RAISE NOTICE '🔢 Auto-numbering: SO-YYYY-#####';
  RAISE NOTICE '💰 Auto-calculation: Order totals update automatically';
  RAISE NOTICE '🔒 Soft delete: Uses deleted_at for data retention';
END $$;
