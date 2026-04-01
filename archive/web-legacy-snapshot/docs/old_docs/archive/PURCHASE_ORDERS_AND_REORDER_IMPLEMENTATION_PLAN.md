# Purchase Orders & Low Stock Alerts - Implementation Plan

**Version:** 2.0
**Created:** November 14, 2024
**Updated:** November 14, 2024
**Status:** Planning
**Priority:** P2 (High Priority - Next Up)
**Estimated Timeline:** 1.5-2 weeks

---

## 📋 Executive Summary

This document provides a comprehensive implementation plan for the **pre-production release** of the Purchase Orders system:

1. **Phase 0: Product-Supplier Integration** (Foundation) - 1-2 days
2. **Phase 1: Low Stock Monitoring & Alerts** - 2-3 days
3. **Phase 2: Purchase Orders Module** - 5-7 days

**Total Estimated Time:** 8-12 days (1.5-2 weeks)

### Scope for Production Release

This implementation focuses on **manual purchase order management** with automated low stock alerts. This provides:

- ✅ Proactive notifications when stock is low
- ✅ Manual purchase order creation and management
- ✅ Full supplier relationship tracking
- ✅ Purchase order lifecycle management
- ✅ Integration with stock receipts (movement type 101)

**Future Enhancement:** Automated reorder system has been deferred to post-production. See [FUTURE_ENHANCEMENTS.md](FUTURE_ENHANCEMENTS.md) for details.

### Why This Order?

- **Product-Supplier Integration** → Foundation for supplier management and pricing
- **Low Stock Monitoring** → Identifies when to reorder (alerts users)
- **Purchase Orders** → Manages the ordering process (manual creation)

### Key Dependencies

```
Product-Supplier Integration (Phase 0)
    ↓
Low Stock Monitoring (Phase 1)
    ↓
Purchase Orders (Phase 2)
```

---

## 🎯 Phase 0: Product-Supplier Integration

**Duration:** 1-2 days
**Priority:** Foundation
**Status:** Not Started

### Objectives

1. Enable products to have multiple suppliers
2. Track supplier-specific data (SKU, price, lead time, MOQ)
3. Set preferred/primary supplier per product
4. Foundation for automated purchase order generation
5. Support supplier pricing history

### Database Schema

#### New Table: `product_suppliers`

```sql
CREATE TABLE product_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  supplier_id UUID NOT NULL REFERENCES business_accounts(id) ON DELETE RESTRICT,

  -- Supplier-specific product data
  supplier_sku TEXT, -- Supplier's part/SKU number
  supplier_product_name TEXT, -- How supplier names this product
  supplier_product_description TEXT, -- Supplier's description

  -- Pricing
  unit_price DECIMAL(15,2) NOT NULL, -- Cost price from this supplier
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
  UNIQUE(product_id, supplier_id), -- One relationship per supplier per product
  CHECK (supplier_id IN (
    SELECT id FROM business_accounts WHERE partner_type = 'vendor'
  ))
);

-- Indexes
CREATE INDEX idx_product_suppliers_product ON product_suppliers(product_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_suppliers_supplier ON product_suppliers(supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_suppliers_preferred ON product_suppliers(product_id, is_preferred)
  WHERE is_preferred = true AND is_active = true AND deleted_at IS NULL;
CREATE INDEX idx_product_suppliers_active ON product_suppliers(product_id, is_active)
  WHERE is_active = true AND deleted_at IS NULL;

-- Ensure only one preferred supplier per product
CREATE UNIQUE INDEX idx_product_suppliers_one_preferred
  ON product_suppliers(product_id)
  WHERE is_preferred = true AND is_active = true AND deleted_at IS NULL;

-- Auto-update timestamp
CREATE TRIGGER trg_product_suppliers_updated_at
  BEFORE UPDATE ON product_suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### New Table: `product_supplier_price_history`

Track historical pricing for analysis and reporting:

```sql
CREATE TABLE product_supplier_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_supplier_id UUID NOT NULL REFERENCES product_suppliers(id) ON DELETE CASCADE,

  -- Price info
  unit_price DECIMAL(15,2) NOT NULL,
  currency_code TEXT DEFAULT 'PLN',
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,

  -- Why price changed
  change_reason TEXT, -- e.g., "Supplier price increase", "Volume discount", "Market adjustment"

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_price_history_supplier ON product_supplier_price_history(product_supplier_id);
CREATE INDEX idx_price_history_date ON product_supplier_price_history(effective_date DESC);
```

### Implementation Steps

#### Step 1: Database Migration (0.5 day)

**File:** `supabase/migrations/YYYYMMDDHHMMSS_create_product_suppliers.sql`

1. Create `product_suppliers` table with all constraints
2. Create `product_supplier_price_history` table
3. Add indexes and triggers
4. Migrate existing `preferred_business_account_id` data:
   ```sql
   -- Migrate existing preferred suppliers
   INSERT INTO product_suppliers (
     product_id,
     supplier_id,
     is_preferred,
     is_active,
     unit_price,
     created_at
   )
   SELECT
     p.id,
     p.preferred_business_account_id,
     true,
     true,
     COALESCE(p.cost_price, 0),
     NOW()
   FROM products p
   WHERE p.preferred_business_account_id IS NOT NULL
   ON CONFLICT (product_id, supplier_id) DO NOTHING;
   ```

#### Step 2: TypeScript Types (0.25 day)

**File:** `src/modules/warehouse/types/product-suppliers.ts`

```typescript
export interface ProductSupplier {
  id: string;
  product_id: string;
  supplier_id: string;
  supplier_sku: string | null;
  supplier_product_name: string | null;
  supplier_product_description: string | null;
  unit_price: number;
  currency_code: string;
  price_valid_from: string;
  price_valid_until: string | null;
  lead_time_days: number;
  min_order_qty: number;
  order_multiple: number;
  is_preferred: boolean;
  is_active: boolean;
  priority_rank: number;
  notes: string | null;
  last_order_date: string | null;
  last_order_price: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  deleted_at: string | null;
}

export interface ProductSupplierWithRelations extends ProductSupplier {
  supplier: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    is_active: boolean;
  };
  product: {
    id: string;
    name: string;
    sku: string;
    unit: string;
  };
}

export interface ProductSupplierFormData {
  supplier_id: string;
  supplier_sku?: string;
  supplier_product_name?: string;
  supplier_product_description?: string;
  unit_price: number;
  currency_code?: string;
  price_valid_from?: string;
  price_valid_until?: string;
  lead_time_days?: number;
  min_order_qty?: number;
  order_multiple?: number;
  is_preferred?: boolean;
  is_active?: boolean;
  priority_rank?: number;
  notes?: string;
}

export interface SupplierPriceHistory {
  id: string;
  product_supplier_id: string;
  unit_price: number;
  currency_code: string;
  effective_date: string;
  end_date: string | null;
  change_reason: string | null;
  created_at: string;
  created_by: string | null;
}
```

#### Step 3: Service Layer (0.5 day)

**File:** `src/modules/warehouse/api/product-suppliers-service.ts`

```typescript
class ProductSuppliersService {
  // Get all suppliers for a product
  async getProductSuppliers(
    productId: string,
    activeOnly: boolean = true
  ): Promise<ProductSupplierWithRelations[]>;

  // Get preferred supplier for a product
  async getPreferredSupplier(productId: string): Promise<ProductSupplierWithRelations | null>;

  // Get best price supplier (considering MOQ, lead time, etc.)
  async getBestPriceSupplier(
    productId: string,
    quantity: number
  ): Promise<ProductSupplierWithRelations | null>;

  // Add supplier to product
  async addSupplier(
    productId: string,
    data: ProductSupplierFormData,
    userId: string
  ): Promise<ProductSupplier>;

  // Update supplier relationship
  async updateSupplier(
    id: string,
    data: Partial<ProductSupplierFormData>,
    userId: string
  ): Promise<ProductSupplier>;

  // Remove supplier from product (soft delete)
  async removeSupplier(id: string): Promise<void>;

  // Set preferred supplier (unsets others for this product)
  async setPreferredSupplier(productId: string, supplierId: string): Promise<void>;

  // Update price (creates history record)
  async updatePrice(
    id: string,
    newPrice: number,
    reason: string,
    userId: string
  ): Promise<ProductSupplier>;

  // Get price history
  async getPriceHistory(productSupplierId: string): Promise<SupplierPriceHistory[]>;

  // Get all products for a supplier
  async getSupplierProducts(supplierId: string): Promise<ProductSupplierWithRelations[]>;
}
```

#### Step 4: UI Components (0.5-0.75 day)

**A. Product Suppliers Tab**

**File:** `src/modules/warehouse/products/components/product-suppliers-tab.tsx`

New tab in product details showing:

- List of all suppliers for this product
- Supplier details (name, SKU, price, lead time, MOQ)
- Preferred supplier indicator (star icon)
- Price comparison
- Add/Remove supplier buttons
- Set preferred supplier action
- Edit supplier relationship inline
- Price history modal

**B. Add Supplier Dialog**

**File:** `src/modules/warehouse/products/components/add-product-supplier-dialog.tsx`

- Supplier selection (dropdown from business_accounts where partner_type = 'vendor')
- Supplier SKU input
- Unit price input
- Lead time (days)
- MOQ (minimum order quantity)
- Order multiple
- Set as preferred checkbox
- Notes textarea

**C. Supplier Products List**

**File:** `src/modules/warehouse/suppliers/components/supplier-products-list.tsx`

New component for supplier details page:

- Shows all products from this supplier
- Price, MOQ, lead time for each
- Quick reorder button
- Last order date

#### Step 5: Integration Points (0.25 day)

1. **Product Form Updates**
   - Keep existing `preferred_business_account_id` for backwards compatibility
   - Add note directing users to new Suppliers tab for detailed management

2. **Product Details Page**
   - Add "Suppliers" tab after "Overview" tab
   - Show supplier count badge on tab

3. **Supplier Details Page**
   - Add "Products" tab showing all products from this supplier
   - Show pricing and ordering info

---

## 🎯 Phase 1: Low Stock Monitoring & Alerts

**Duration:** 2-3 days
**Priority:** High
**Dependencies:** None (uses existing reorder_point field)

### Objectives

1. Monitor products approaching reorder point
2. Generate low stock alerts
3. Provide dashboard/widget for low stock items
4. Email notifications for critical stock levels
5. Reporting on stock trends

### Database Schema

#### New Table: `stock_alerts`

```sql
CREATE TABLE stock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,

  -- Alert details
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,

  -- Stock levels at time of alert
  current_stock DECIMAL(15,3) NOT NULL,
  reorder_point DECIMAL(15,3) NOT NULL,
  available_stock DECIMAL(15,3) NOT NULL, -- After reservations

  -- Alert type and severity
  alert_type TEXT NOT NULL, -- 'low_stock', 'out_of_stock', 'below_minimum'
  severity TEXT NOT NULL, -- 'info', 'warning', 'critical'

  -- Status
  status TEXT DEFAULT 'active', -- 'active', 'acknowledged', 'resolved', 'ignored'
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),

  -- Notifications
  notification_sent BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,

  CHECK (alert_type IN ('low_stock', 'out_of_stock', 'below_minimum')),
  CHECK (severity IN ('info', 'warning', 'critical')),
  CHECK (status IN ('active', 'acknowledged', 'resolved', 'ignored'))
);

CREATE INDEX idx_stock_alerts_org ON stock_alerts(organization_id);
CREATE INDEX idx_stock_alerts_product ON stock_alerts(product_id);
CREATE INDEX idx_stock_alerts_status ON stock_alerts(status) WHERE status = 'active';
CREATE INDEX idx_stock_alerts_created ON stock_alerts(created_at DESC);
```

#### New Table: `alert_notification_settings`

```sql
CREATE TABLE alert_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Notification preferences
  email_enabled BOOLEAN DEFAULT true,
  email_address TEXT,

  -- Alert level preferences
  notify_on_low_stock BOOLEAN DEFAULT true,
  notify_on_out_of_stock BOOLEAN DEFAULT true,
  notify_on_critical_only BOOLEAN DEFAULT false,

  -- Frequency
  digest_frequency TEXT DEFAULT 'daily', -- 'immediate', 'hourly', 'daily', 'weekly'

  -- Filters
  specific_products UUID[], -- NULL = all products
  specific_locations UUID[], -- NULL = all locations

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, user_id),
  CHECK (digest_frequency IN ('immediate', 'hourly', 'daily', 'weekly'))
);
```

### Implementation Steps

#### Step 1: Database Migration (0.25 day)

**File:** `supabase/migrations/YYYYMMDDHHMMSS_create_stock_alerts.sql`

1. Create `stock_alerts` table
2. Create `alert_notification_settings` table
3. Add indexes
4. Create function to check stock levels and create alerts

```sql
-- Function to check and create alerts
CREATE OR REPLACE FUNCTION check_stock_levels_and_alert()
RETURNS INTEGER AS $$
DECLARE
  alert_count INTEGER := 0;
  product_record RECORD;
BEGIN
  -- Find products below reorder point
  FOR product_record IN
    SELECT
      p.id as product_id,
      p.organization_id,
      p.name,
      p.reorder_point,
      pai.quantity_on_hand,
      pai.available_quantity,
      pai.location_id,
      pai.branch_id
    FROM products p
    INNER JOIN product_available_inventory pai ON p.id = pai.product_id
    WHERE p.track_inventory = true
      AND p.reorder_point IS NOT NULL
      AND p.reorder_point > 0
      AND pai.available_quantity <= p.reorder_point
      AND p.deleted_at IS NULL
  LOOP
    -- Check if alert already exists for this product/location
    IF NOT EXISTS (
      SELECT 1 FROM stock_alerts
      WHERE product_id = product_record.product_id
        AND location_id = product_record.location_id
        AND status = 'active'
        AND created_at > NOW() - INTERVAL '24 hours'
    ) THEN
      -- Create new alert
      INSERT INTO stock_alerts (
        organization_id,
        branch_id,
        product_id,
        location_id,
        current_stock,
        reorder_point,
        available_stock,
        alert_type,
        severity,
        status
      ) VALUES (
        product_record.organization_id,
        product_record.branch_id,
        product_record.product_id,
        product_record.location_id,
        product_record.quantity_on_hand,
        product_record.reorder_point,
        product_record.available_quantity,
        CASE
          WHEN product_record.available_quantity = 0 THEN 'out_of_stock'
          WHEN product_record.available_quantity < product_record.reorder_point * 0.5 THEN 'below_minimum'
          ELSE 'low_stock'
        END,
        CASE
          WHEN product_record.available_quantity = 0 THEN 'critical'
          WHEN product_record.available_quantity < product_record.reorder_point * 0.5 THEN 'warning'
          ELSE 'info'
        END,
        'active'
      );

      alert_count := alert_count + 1;
    END IF;
  END LOOP;

  RETURN alert_count;
END;
$$ LANGUAGE plpgsql;
```

#### Step 2: TypeScript Types (0.25 day)

**File:** `src/modules/warehouse/types/stock-alerts.ts`

```typescript
export type AlertType = "low_stock" | "out_of_stock" | "below_minimum";
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertStatus = "active" | "acknowledged" | "resolved" | "ignored";

export interface StockAlert {
  id: string;
  organization_id: string;
  branch_id: string | null;
  product_id: string;
  product_variant_id: string | null;
  location_id: string | null;
  current_stock: number;
  reorder_point: number;
  available_stock: number;
  alert_type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  notification_sent: boolean;
  notification_sent_at: string | null;
  created_at: string;
  notes: string | null;
}

export interface StockAlertWithRelations extends StockAlert {
  product: {
    id: string;
    name: string;
    sku: string;
    unit: string;
  };
  location?: {
    id: string;
    name: string;
    code: string;
  };
}
```

#### Step 3: Service Layer (0.5 day)

**File:** `src/modules/warehouse/api/stock-alerts-service.ts`

```typescript
class StockAlertsService {
  // Get active alerts
  async getActiveAlerts(
    organizationId: string,
    filters?: AlertFilters
  ): Promise<StockAlertWithRelations[]>;

  // Check stock levels and create alerts (called by cron)
  async checkAndCreateAlerts(organizationId: string): Promise<number>;

  // Acknowledge alert
  async acknowledgeAlert(alertId: string, userId: string): Promise<void>;

  // Resolve alert
  async resolveAlert(alertId: string, userId: string, notes?: string): Promise<void>;

  // Ignore alert
  async ignoreAlert(alertId: string, userId: string): Promise<void>;

  // Get alerts for product
  async getProductAlerts(productId: string): Promise<StockAlert[]>;

  // Get alert statistics
  async getAlertStats(organizationId: string): Promise<{
    active: number;
    critical: number;
    warning: number;
    info: number;
  }>;
}
```

#### Step 4: UI Components (0.75-1 day)

**A. Low Stock Dashboard Widget**

**File:** `src/modules/warehouse/widgets/low-stock-widget.tsx`

- Shows count of low stock items
- Severity breakdown (critical, warning, info)
- Quick link to full alerts page
- Color-coded indicators

**B. Stock Alerts Page**

**File:** `src/app/[locale]/dashboard/warehouse/alerts/page.tsx`

- List of all active alerts
- Filterable by severity, type, location
- Sortable by various fields
- Batch actions (acknowledge, resolve)
- Quick reorder button

**C. Alert Details Modal**

- Product details
- Stock level chart
- Preferred supplier info
- Quick create PO button
- Acknowledge/Resolve/Ignore actions

#### Step 5: Scheduled Job (0.25 day)

**File:** `src/lib/cron/check-stock-levels.ts`

```typescript
// Run every hour
export async function checkStockLevels() {
  const supabase = createServiceClient();

  // Call the database function
  const { data, error } = await supabase.rpc("check_stock_levels_and_alert");

  if (error) {
    console.error("Error checking stock levels:", error);
    return;
  }

  console.log(`Created ${data} new stock alerts`);

  // Send notifications for new alerts
  await sendAlertNotifications();
}
```

---

## 🎯 Phase 2: Purchase Orders Module

**Duration:** 5-7 days
**Priority:** High
**Dependencies:** Phase 0 (Product-Supplier Integration)

### Objectives

1. Create and manage purchase orders
2. Track PO status from draft to received
3. Link POs to stock receipts (movement type 101)
4. Support partial receipts
5. Track costs and payment status
6. Generate PO documents (PDF)

### Database Schema

#### Table: `purchase_orders`

```sql
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organization & Branch
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT,

  -- PO Information
  po_number TEXT UNIQUE NOT NULL, -- Auto-generated: PO-2024-00001
  po_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  delivery_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,

  -- Supplier
  supplier_id UUID NOT NULL REFERENCES business_accounts(id) ON DELETE RESTRICT,
  supplier_name TEXT NOT NULL, -- Denormalized
  supplier_email TEXT,
  supplier_phone TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft',
  -- draft: Being created
  -- pending: Awaiting approval
  -- approved: Approved, sent to supplier
  -- partially_received: Some items received
  -- received: All items received
  -- cancelled: Cancelled
  -- closed: Completed and closed

  -- Financial
  subtotal DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  shipping_cost DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  currency_code TEXT DEFAULT 'PLN',

  -- Payment
  payment_terms TEXT, -- e.g., "Net 30", "COD", "50% upfront"
  payment_status TEXT DEFAULT 'unpaid', -- 'unpaid', 'partially_paid', 'paid'
  amount_paid DECIMAL(15,2) DEFAULT 0,

  -- Tracking
  supplier_reference TEXT, -- Supplier's PO number
  tracking_number TEXT,

  -- Notes
  notes TEXT,
  internal_notes TEXT,

  -- Approval
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),
  cancellation_reason TEXT,

  CHECK (status IN ('draft', 'pending', 'approved', 'partially_received', 'received', 'cancelled', 'closed')),
  CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid')),
  CHECK (total_amount >= 0),
  CHECK (amount_paid >= 0 AND amount_paid <= total_amount),
  CHECK (expected_delivery_date >= po_date OR expected_delivery_date IS NULL)
);

-- Indexes
CREATE INDEX idx_purchase_orders_org ON purchase_orders(organization_id);
CREATE INDEX idx_purchase_orders_branch ON purchase_orders(branch_id);
CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_date ON purchase_orders(po_date DESC);
CREATE INDEX idx_purchase_orders_number ON purchase_orders(po_number);

-- Auto-generate PO number
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  year_part TEXT;
BEGIN
  year_part := TO_CHAR(CURRENT_DATE, 'YYYY');

  SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 9) AS INTEGER)), 0) + 1
  INTO next_num
  FROM purchase_orders
  WHERE po_number LIKE 'PO-' || year_part || '-%';

  NEW.po_number := 'PO-' || year_part || '-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_po_number
  BEFORE INSERT ON purchase_orders
  FOR EACH ROW
  WHEN (NEW.po_number IS NULL)
  EXECUTE FUNCTION generate_po_number();
```

#### Table: `purchase_order_items`

```sql
CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,

  -- Product Information
  product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
  product_supplier_id UUID REFERENCES product_suppliers(id) ON DELETE SET NULL,

  -- Denormalized product info
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

  -- Calculated fields
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

  CHECK (quantity_received <= quantity_ordered)
);

CREATE INDEX idx_purchase_order_items_po ON purchase_order_items(purchase_order_id);
CREATE INDEX idx_purchase_order_items_product ON purchase_order_items(product_id);
CREATE INDEX idx_purchase_order_items_supplier ON purchase_order_items(product_supplier_id);

-- Update PO totals when items change
CREATE OR REPLACE FUNCTION update_po_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE purchase_orders
  SET
    subtotal = (
      SELECT COALESCE(SUM(subtotal), 0)
      FROM purchase_order_items
      WHERE purchase_order_id = COALESCE(NEW.purchase_order_id, OLD.purchase_order_id)
    ),
    tax_amount = (
      SELECT COALESCE(SUM(tax_amount), 0)
      FROM purchase_order_items
      WHERE purchase_order_id = COALESCE(NEW.purchase_order_id, OLD.purchase_order_id)
    ),
    total_amount = (
      SELECT COALESCE(SUM(line_total), 0)
      FROM purchase_order_items
      WHERE purchase_order_id = COALESCE(NEW.purchase_order_id, OLD.purchase_order_id)
    ) + COALESCE(shipping_cost, 0) - COALESCE(discount_amount, 0),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_po_totals
  AFTER INSERT OR UPDATE OR DELETE ON purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_po_totals();
```

### Implementation Steps

#### Step 1: Database Migration (0.5 day)

**File:** `supabase/migrations/YYYYMMDDHHMMSS_create_purchase_orders.sql`

1. Create tables
2. Add triggers and functions
3. Add indexes

#### Step 2: TypeScript Types (0.5 day)

**File:** `src/modules/warehouse/types/purchase-orders.ts`

```typescript
export type PurchaseOrderStatus =
  | "draft"
  | "pending"
  | "approved"
  | "partially_received"
  | "received"
  | "cancelled"
  | "closed";

export type PaymentStatus = "unpaid" | "partially_paid" | "paid";

export interface PurchaseOrder {
  id: string;
  organization_id: string;
  branch_id: string | null;
  po_number: string;
  po_date: string;
  expected_delivery_date: string | null;
  delivery_location_id: string | null;
  supplier_id: string;
  supplier_name: string;
  supplier_email: string | null;
  supplier_phone: string | null;
  status: PurchaseOrderStatus;
  subtotal: number;
  tax_amount: number;
  shipping_cost: number;
  discount_amount: number;
  total_amount: number;
  currency_code: string;
  payment_terms: string | null;
  payment_status: PaymentStatus;
  amount_paid: number;
  supplier_reference: string | null;
  tracking_number: string | null;
  notes: string | null;
  internal_notes: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  product_id: string | null;
  product_variant_id: string | null;
  product_supplier_id: string | null;
  product_name: string;
  product_sku: string | null;
  supplier_sku: string | null;
  variant_name: string | null;
  quantity_ordered: number;
  quantity_received: number;
  quantity_pending: number;
  unit_of_measure: string | null;
  unit_price: number;
  tax_rate: number;
  discount_percent: number;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
  expected_location_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderWithItems extends PurchaseOrder {
  items: PurchaseOrderItem[];
}
```

#### Step 3: Service Layer (1.5-2 days)

**File:** `src/modules/warehouse/api/purchase-orders-service.ts`

Comprehensive service with full CRUD, status transitions, and receipt integration.

#### Step 4: UI Components (2-2.5 days)

1. PO list page
2. Create PO form
3. PO details page
4. Receive goods workflow
5. PDF generation

#### Step 5: Integration with Receipts (0.5 day)

Link POs to stock movements (type 101).

---

## 📊 Success Metrics

### Phase 0: Product-Supplier Integration ✅

- [ ] Products can have multiple suppliers
- [ ] Supplier-specific pricing tracked
- [ ] Preferred supplier can be set
- [ ] Price history maintained
- [ ] Supplier products displayed on supplier details page
- [ ] Product suppliers displayed on product details page

### Phase 1: Low Stock Monitoring ✅

- [ ] Alerts created for low stock items
- [ ] Dashboard shows active alerts
- [ ] Low stock widget on warehouse dashboard
- [ ] Alerts can be acknowledged/resolved/ignored
- [ ] Alert severity properly calculated (info, warning, critical)
- [ ] Scheduled job runs hourly to check stock levels

### Phase 2: Purchase Orders ✅

- [ ] POs can be created manually
- [ ] Status workflow functional (draft → approved → received)
- [ ] Items can be received (partial/full)
- [ ] Integration with stock movements (type 101) works
- [ ] Supplier selection from product suppliers
- [ ] PO totals calculated automatically
- [ ] PO list page with filtering and sorting
- [ ] PO details page with full information
- [ ] Quick create PO from low stock alert

---

## 🚀 Post-Production Enhancements

For features planned after initial production release, see [FUTURE_ENHANCEMENTS.md](FUTURE_ENHANCEMENTS.md):

- **Automated Reorder System** - Automatic PO generation from alerts
- **PDF Document Generation** - Print POs and receipts
- **Advanced Supplier Analytics** - Price trends, supplier performance
- **Batch Purchase Orders** - Order multiple low-stock items in one PO

---

**Last Updated:** November 14, 2024 (Version 2.0)
**Next Review:** After Phase 2 completion
