# Sales Orders & Stock Reservations - Implementation Plan

**Version:** 1.0
**Created:** November 12, 2024
**Status:** In Progress
**Estimated Timeline:** 7-10 days

---

## 📋 Executive Summary

This document provides a comprehensive, step-by-step implementation plan for:

1. **Product-Supplier Integration** (Prerequisite) - 1-2 days
2. **Sales Orders Module** - 3-4 days
3. **Stock Reservations System** - 3-4 days

### Why This Order?

- **Product-Supplier Integration** → Foundation for purchase orders (P2 priority)
- **Sales Orders** → Provides context for stock reservations (testing)
- **Stock Reservations** → Prevents overselling (P1 priority)

### Key Dependencies

```
Product-Supplier Integration
    ↓ (enables future)
Purchase Orders (P2)

Sales Orders
    ↓ (required for)
Stock Reservations (P1)
    ↓ (prevents)
Overselling Risk
```

---

## 🎯 Phase 0: Product-Supplier Integration

**Duration:** 1-2 days
**Priority:** Foundation for P2 (Purchase Orders)

### Objectives

1. Enable products to have multiple suppliers
2. Track supplier-specific data (SKU, price, lead time, MOQ)
3. Set preferred supplier per product
4. Foundation for automated purchase order generation

### Database Schema

#### New Table: `product_suppliers`

```sql
CREATE TABLE product_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  business_account_id UUID NOT NULL REFERENCES business_accounts(id) ON DELETE RESTRICT,

  -- Supplier-specific data
  supplier_sku TEXT, -- Supplier's part/SKU number
  supplier_product_name TEXT, -- Supplier's product name
  unit_price DECIMAL(15,2), -- Cost price from this supplier
  currency_code TEXT DEFAULT 'PLN',
  lead_time_days INTEGER DEFAULT 0, -- Days from order to delivery
  min_order_qty DECIMAL(15,3) DEFAULT 1, -- Minimum order quantity

  -- Preferences
  is_preferred BOOLEAN DEFAULT false, -- Primary supplier for this product
  is_active BOOLEAN DEFAULT true, -- Can still order from this supplier

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Constraints
  UNIQUE(product_id, business_account_id), -- One relationship per supplier
  CHECK (unit_price >= 0),
  CHECK (lead_time_days >= 0),
  CHECK (min_order_qty > 0)
);

-- Indexes
CREATE INDEX idx_product_suppliers_product ON product_suppliers(product_id);
CREATE INDEX idx_product_suppliers_supplier ON product_suppliers(business_account_id);
CREATE INDEX idx_product_suppliers_preferred ON product_suppliers(product_id, is_preferred) WHERE is_preferred = true;

-- Ensure only one preferred supplier per product
CREATE UNIQUE INDEX idx_product_suppliers_one_preferred
  ON product_suppliers(product_id)
  WHERE is_preferred = true AND is_active = true;
```

### Implementation Steps

#### Step 1: Database Migration (0.5 day)

**File:** `supabase/migrations/YYYYMMDDHHMMSS_create_product_suppliers.sql`

1. Create `product_suppliers` table
2. Add indexes
3. Migrate existing `preferred_business_account_id` data:
   ```sql
   INSERT INTO product_suppliers (product_id, business_account_id, is_preferred, is_active)
   SELECT id, preferred_business_account_id, true, true
   FROM products
   WHERE preferred_business_account_id IS NOT NULL;
   ```

#### Step 2: TypeScript Types (0.25 day)

**File:** `src/modules/warehouse/types/product-suppliers.ts`

```typescript
export interface ProductSupplier {
  id: string;
  product_id: string;
  business_account_id: string;
  supplier_sku: string | null;
  supplier_product_name: string | null;
  unit_price: number | null;
  currency_code: string;
  lead_time_days: number;
  min_order_qty: number;
  is_preferred: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ProductSupplierWithRelations extends ProductSupplier {
  business_account: {
    id: string;
    name: string;
    partner_type: string;
    email: string | null;
    phone: string | null;
  };
}

export interface ProductSupplierFormData {
  business_account_id: string;
  supplier_sku?: string;
  supplier_product_name?: string;
  unit_price?: number;
  currency_code?: string;
  lead_time_days?: number;
  min_order_qty?: number;
  is_preferred?: boolean;
  is_active?: boolean;
  notes?: string;
}
```

#### Step 3: Service Layer (0.5 day)

**File:** `src/modules/warehouse/api/product-suppliers-service.ts`

```typescript
class ProductSuppliersService {
  // Get all suppliers for a product
  async getProductSuppliers(productId: string): Promise<ProductSupplierWithRelations[]>;

  // Add supplier to product
  async addSupplier(productId: string, data: ProductSupplierFormData): Promise<ProductSupplier>;

  // Update supplier relationship
  async updateSupplier(
    id: string,
    data: Partial<ProductSupplierFormData>
  ): Promise<ProductSupplier>;

  // Remove supplier from product
  async removeSupplier(id: string): Promise<void>;

  // Set preferred supplier (unsets others)
  async setPreferredSupplier(productId: string, supplierId: string): Promise<void>;

  // Get preferred supplier for product
  async getPreferredSupplier(productId: string): Promise<ProductSupplierWithRelations | null>;
}
```

#### Step 4: Product Form UI Updates (0.5 day)

**File:** `src/modules/warehouse/products/components/create-product-dialog.tsx`

Add to "Purchase" tab:

```typescript
// Preferred Supplier Section
<div className="space-y-4">
  <Label>Preferred Supplier</Label>
  <Select
    value={form.watch("preferred_business_account_id")}
    onValueChange={(value) => form.setValue("preferred_business_account_id", value)}
  >
    <SelectTrigger>
      <SelectValue placeholder="Select preferred supplier" />
    </SelectTrigger>
    <SelectContent>
      {suppliers
        .filter(s => s.partner_type === 'vendor')
        .map(supplier => (
          <SelectItem key={supplier.id} value={supplier.id}>
            {supplier.name}
          </SelectItem>
        ))}
    </SelectContent>
  </Select>
  <p className="text-sm text-muted-foreground">
    This will be the default supplier for purchase orders
  </p>
</div>
```

#### Step 5: Product Details - Suppliers Tab (0.5 day)

**File:** `src/modules/warehouse/products/components/product-suppliers-tab.tsx`

New tab in product details showing:

1. List of all suppliers for this product
2. Supplier details (SKU, price, lead time, MOQ)
3. Add/Remove supplier buttons
4. Set preferred supplier action
5. Edit supplier relationship inline

---

## 🎯 Phase 1: Sales Orders Module

**Duration:** 3-4 days
**Priority:** P1 Prerequisite (enables reservation testing)

### Objectives

1. Create sales order management system
2. Track customer orders with line items
3. Enable order status workflow
4. Provide foundation for stock reservations
5. Support inventory allocation and fulfillment

### Database Schema

#### Table 1: `sales_orders`

```sql
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

  -- Constraints
  CHECK (status IN ('draft', 'pending', 'confirmed', 'processing', 'fulfilled', 'cancelled')),
  CHECK (total_amount >= 0),
  CHECK (expected_delivery_date >= order_date OR expected_delivery_date IS NULL)
);

-- Indexes
CREATE INDEX idx_sales_orders_org ON sales_orders(organization_id);
CREATE INDEX idx_sales_orders_branch ON sales_orders(branch_id);
CREATE INDEX idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX idx_sales_orders_status ON sales_orders(status);
CREATE INDEX idx_sales_orders_date ON sales_orders(order_date DESC);
CREATE INDEX idx_sales_orders_number ON sales_orders(order_number);

-- Auto-generate order number
CREATE OR REPLACE FUNCTION generate_sales_order_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  year_part TEXT;
BEGIN
  year_part := TO_CHAR(CURRENT_DATE, 'YYYY');

  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 9) AS INTEGER)), 0) + 1
  INTO next_num
  FROM sales_orders
  WHERE order_number LIKE 'SO-' || year_part || '-%';

  NEW.order_number := 'SO-' || year_part || '-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_sales_order_number
  BEFORE INSERT ON sales_orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL)
  EXECUTE FUNCTION generate_sales_order_number();
```

#### Table 2: `sales_order_items`

```sql
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
  tax_rate DECIMAL(5,2) DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,

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
  reservation_id UUID REFERENCES stock_reservations(id) ON DELETE SET NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL, -- Fulfillment location

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CHECK (quantity_ordered > 0),
  CHECK (quantity_fulfilled >= 0),
  CHECK (quantity_fulfilled <= quantity_ordered),
  CHECK (unit_price >= 0),
  CHECK (tax_rate >= 0 AND tax_rate <= 100),
  CHECK (discount_percent >= 0 AND discount_percent <= 100)
);

-- Indexes
CREATE INDEX idx_sales_order_items_order ON sales_order_items(sales_order_id);
CREATE INDEX idx_sales_order_items_product ON sales_order_items(product_id);
CREATE INDEX idx_sales_order_items_variant ON sales_order_items(product_variant_id);
CREATE INDEX idx_sales_order_items_reservation ON sales_order_items(reservation_id);

-- Update order totals when items change
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

CREATE TRIGGER trg_update_sales_order_totals
  AFTER INSERT OR UPDATE OR DELETE ON sales_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_order_totals();
```

### Implementation Steps

#### Step 1: Database Migration (0.5 day)

**File:** `supabase/migrations/YYYYMMDDHHMMSS_create_sales_orders.sql`

1. Create `sales_orders` table
2. Create `sales_order_items` table
3. Add triggers for order numbers and totals
4. Add indexes

#### Step 2: TypeScript Types (0.5 day)

**File:** `src/modules/warehouse/types/sales-orders.ts`

```typescript
export type SalesOrderStatus =
  | "draft"
  | "pending"
  | "confirmed"
  | "processing"
  | "fulfilled"
  | "cancelled";

export interface SalesOrder {
  id: string;
  organization_id: string;
  branch_id: string | null;
  order_number: string;
  order_date: string;
  expected_delivery_date: string | null;
  customer_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  delivery_address_line1: string | null;
  delivery_address_line2: string | null;
  delivery_city: string | null;
  delivery_state: string | null;
  delivery_postal_code: string | null;
  delivery_country: string;
  status: SalesOrderStatus;
  subtotal: number;
  tax_amount: number;
  shipping_cost: number;
  discount_amount: number;
  total_amount: number;
  currency_code: string;
  tracking_number: string | null;
  shipped_date: string | null;
  delivered_date: string | null;
  customer_notes: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
}

export interface SalesOrderItem {
  id: string;
  sales_order_id: string;
  product_id: string | null;
  product_variant_id: string | null;
  product_name: string;
  product_sku: string | null;
  variant_name: string | null;
  quantity_ordered: number;
  quantity_fulfilled: number;
  unit_of_measure: string | null;
  unit_price: number;
  tax_rate: number;
  discount_percent: number;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
  reservation_id: string | null;
  location_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesOrderWithItems extends SalesOrder {
  items: SalesOrderItem[];
}

export interface SalesOrderFormData {
  customer_id?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  order_date: string;
  expected_delivery_date?: string;
  delivery_address_line1?: string;
  delivery_address_line2?: string;
  delivery_city?: string;
  delivery_state?: string;
  delivery_postal_code?: string;
  delivery_country?: string;
  shipping_cost?: number;
  discount_amount?: number;
  customer_notes?: string;
  internal_notes?: string;
  items: SalesOrderItemFormData[];
}

export interface SalesOrderItemFormData {
  product_id: string;
  product_variant_id?: string;
  quantity_ordered: number;
  unit_price: number;
  tax_rate?: number;
  discount_percent?: number;
  location_id?: string;
  notes?: string;
}
```

#### Step 3: Service Layer (1 day)

**File:** `src/modules/warehouse/api/sales-orders-service.ts`

```typescript
class SalesOrdersService {
  // CRUD operations
  async createOrder(
    organizationId: string,
    branchId: string,
    data: SalesOrderFormData
  ): Promise<SalesOrderWithItems>;
  async getOrder(id: string): Promise<SalesOrderWithItems | null>;
  async getOrders(
    organizationId: string,
    filters?: SalesOrderFilters,
    pagination?: Pagination
  ): Promise<{ orders: SalesOrder[]; total: number }>;
  async updateOrder(id: string, data: Partial<SalesOrderFormData>): Promise<SalesOrder>;
  async deleteOrder(id: string): Promise<void>;

  // Status transitions
  async submitForApproval(id: string): Promise<SalesOrder>; // draft → pending
  async confirmOrder(id: string): Promise<SalesOrder>; // pending → confirmed (reserves stock)
  async startProcessing(id: string): Promise<SalesOrder>; // confirmed → processing
  async fulfillOrder(id: string, trackingNumber?: string): Promise<SalesOrder>; // processing → fulfilled
  async cancelOrder(id: string, reason: string): Promise<SalesOrder>; // any → cancelled (releases reservations)

  // Order items
  async addItem(orderId: string, item: SalesOrderItemFormData): Promise<SalesOrderItem>;
  async updateItem(itemId: string, data: Partial<SalesOrderItemFormData>): Promise<SalesOrderItem>;
  async removeItem(itemId: string): Promise<void>;

  // Availability check
  async checkAvailability(
    orderId: string
  ): Promise<{
    available: boolean;
    unavailableItems: { itemId: string; requested: number; available: number }[];
  }>;
}
```

#### Step 4: UI Components (1.5 days)

**A. Sales Orders List Page**

**File:** `src/app/[locale]/dashboard/warehouse/sales-orders/page.tsx`

- Table view with order number, customer, date, status, total
- Filters: status, date range, customer
- Search by order number
- Status badges with colors
- Create new order button

**B. Create/Edit Order Form**

**File:** `src/modules/warehouse/sales-orders/components/sales-order-form.tsx`

- Customer selection (business_accounts with partner_type = 'customer')
- Order date and expected delivery
- Delivery address fields
- Line items table:
  - Product selection with search
  - Quantity input with availability check
  - Unit price (from product or manual)
  - Tax rate and discount
  - Calculated subtotal
- Shipping cost and order-level discount
- Customer notes and internal notes
- Total calculation display
- Save as draft / Submit for approval buttons

**C. Order Details Page**

**File:** `src/app/[locale]/dashboard/warehouse/sales-orders/[id]/page.tsx`

- Order header (number, customer, dates, status)
- Status stepper (visual workflow)
- Line items table (read-only or editable based on status)
- Totals summary
- Delivery address
- Actions based on status:
  - Draft: Edit, Delete, Submit
  - Pending: Confirm, Edit, Cancel
  - Confirmed: Start Processing, Cancel
  - Processing: Fulfill, Cancel
  - Fulfilled: View only
  - Cancelled: View only
- Activity log / audit trail

#### Step 5: Server Actions (0.5 day)

**Files:**

- `src/app/actions/warehouse/create-sales-order.ts`
- `src/app/actions/warehouse/update-sales-order.ts`
- `src/app/actions/warehouse/confirm-sales-order.ts`
- `src/app/actions/warehouse/fulfill-sales-order.ts`
- `src/app/actions/warehouse/cancel-sales-order.ts`

All with authentication and authorization checks.

#### Step 6: Routing & Navigation (0.25 day)

Add to warehouse module:

- `/dashboard/warehouse/sales-orders` - List
- `/dashboard/warehouse/sales-orders/new` - Create
- `/dashboard/warehouse/sales-orders/[id]` - Details
- `/dashboard/warehouse/sales-orders/[id]/edit` - Edit (draft only)

---

## 🎯 Phase 2: Stock Reservations

**Duration:** 3-4 days
**Priority:** P1 (Prevent Overselling)

### Objectives

1. Auto-reserve stock when sales order confirmed
2. Prevent overselling by tracking reserved quantities
3. Release reservations on order cancellation/fulfillment
4. Manual reservation management for special cases
5. Calculate available quantity (stock - reserved)

### Database Schema Updates

The `stock_reservations` table already exists. We need to enhance it and add business logic.

#### Enhanced `stock_reservations` Schema

```sql
-- Review existing table
ALTER TABLE stock_reservations
ADD COLUMN IF NOT EXISTS sales_order_id UUID REFERENCES sales_orders(id) ON DELETE RESTRICT,
ADD COLUMN IF NOT EXISTS sales_order_item_id UUID REFERENCES sales_order_items(id) ON DELETE RESTRICT,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ, -- Optional expiry
ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ, -- When reservation was released
ADD COLUMN IF NOT EXISTS released_by UUID REFERENCES auth.users(id);

-- Index for sales order lookups
CREATE INDEX IF NOT EXISTS idx_stock_reservations_sales_order ON stock_reservations(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_expiry ON stock_reservations(expires_at) WHERE expires_at IS NOT NULL AND released_at IS NULL;
```

### Implementation Steps

#### Step 1: Database Migration (0.25 day)

**File:** `supabase/migrations/YYYYMMDDHHMMSS_enhance_stock_reservations.sql`

1. Add sales order reference columns
2. Add expiry and release tracking
3. Create indexes
4. Create view for available inventory:

```sql
CREATE OR REPLACE VIEW product_available_inventory AS
SELECT
  si.product_id,
  si.product_variant_id,
  si.location_id,
  si.branch_id,
  si.organization_id,
  si.quantity_on_hand,
  COALESCE(sr.reserved_quantity, 0) AS reserved_quantity,
  (si.quantity_on_hand - COALESCE(sr.reserved_quantity, 0)) AS available_quantity
FROM stock_inventory si
LEFT JOIN (
  SELECT
    product_id,
    product_variant_id,
    location_id,
    branch_id,
    organization_id,
    SUM(quantity_reserved) AS reserved_quantity
  FROM stock_reservations
  WHERE status = 'active'
    AND released_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW())
  GROUP BY product_id, product_variant_id, location_id, branch_id, organization_id
) sr ON
  si.product_id = sr.product_id AND
  COALESCE(si.product_variant_id, '00000000-0000-0000-0000-000000000000') = COALESCE(sr.product_variant_id, '00000000-0000-0000-0000-000000000000') AND
  si.location_id = sr.location_id AND
  si.branch_id = sr.branch_id AND
  si.organization_id = sr.organization_id;
```

#### Step 2: TypeScript Types (0.25 day)

**File:** `src/modules/warehouse/types/stock-reservations.ts`

```typescript
export type ReservationStatus = "active" | "released" | "expired";

export interface StockReservation {
  id: string;
  organization_id: string;
  branch_id: string;
  location_id: string;
  product_id: string;
  product_variant_id: string | null;
  quantity_reserved: number;
  status: ReservationStatus;
  sales_order_id: string | null;
  sales_order_item_id: string | null;
  reference_number: string | null;
  notes: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  released_at: string | null;
  released_by: string | null;
}

export interface ReservationFormData {
  location_id: string;
  product_id: string;
  product_variant_id?: string;
  quantity_reserved: number;
  sales_order_id?: string;
  sales_order_item_id?: string;
  reference_number?: string;
  notes?: string;
  expires_at?: string;
}

export interface AvailableInventory {
  product_id: string;
  product_variant_id: string | null;
  location_id: string;
  branch_id: string;
  organization_id: string;
  quantity_on_hand: number;
  reserved_quantity: number;
  available_quantity: number;
}
```

#### Step 3: Service Layer (1 day)

**File:** `src/modules/warehouse/api/stock-reservations-service.ts`

```typescript
class StockReservationsService {
  // Core CRUD
  async createReservation(
    organizationId: string,
    branchId: string,
    data: ReservationFormData
  ): Promise<StockReservation>;
  async getReservation(id: string): Promise<StockReservation | null>;
  async getReservations(
    organizationId: string,
    filters?: ReservationFilters
  ): Promise<StockReservation[]>;
  async releaseReservation(id: string, userId: string): Promise<void>;

  // Sales order integration
  async reserveForSalesOrder(salesOrderId: string): Promise<StockReservation[]>;
  async releaseForSalesOrder(salesOrderId: string, userId: string): Promise<void>;

  // Availability checks
  async getAvailableQuantity(
    productId: string,
    variantId: string | null,
    locationId: string
  ): Promise<number>;
  async checkAvailability(
    items: { productId: string; variantId?: string; locationId: string; quantity: number }[]
  ): Promise<{ available: boolean; details: any[] }>;

  // Expiry management
  async releaseExpiredReservations(): Promise<number>; // Returns count released

  // Movement integration (future)
  async createReservationMovement(
    reservationId: string,
    movementType: "501" | "502"
  ): Promise<void>;
}
```

#### Step 4: Auto-Reserve on Order Confirmation (0.5 day)

**Update:** `src/modules/warehouse/api/sales-orders-service.ts`

```typescript
async confirmOrder(id: string): Promise<SalesOrder> {
  // 1. Check stock availability
  const availability = await this.checkAvailability(id);
  if (!availability.available) {
    throw new Error(`Insufficient stock for items: ${availability.unavailableItems.map(i => i.itemId).join(', ')}`);
  }

  // 2. Create reservations for all items
  const reservations = await reservationsService.reserveForSalesOrder(id);

  // 3. Update order items with reservation IDs
  for (const reservation of reservations) {
    await supabase
      .from('sales_order_items')
      .update({ reservation_id: reservation.id })
      .eq('id', reservation.sales_order_item_id);
  }

  // 4. Update order status
  const { data, error } = await supabase
    .from('sales_orders')
    .update({
      status: 'confirmed',
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

#### Step 5: UI Components (1 day)

**A. Reservations List Page**

**File:** `src/app/[locale]/dashboard/warehouse/reservations/page.tsx`

- Table with product, location, quantity, status, sales order link
- Filters: status, product, location, sales order
- Manual create reservation button
- Release reservation action

**B. Create Manual Reservation**

**File:** `src/modules/warehouse/reservations/components/create-reservation-dialog.tsx`

- Product/variant selection with available quantity display
- Location selection
- Quantity input with validation (can't exceed available)
- Optional sales order link
- Expiry date (optional)
- Reference number and notes

**C. Reservation Badge/Indicator**

**Component:** Show available vs reserved in product lists and order forms

```typescript
// In product inventory display
<div>
  <span>On Hand: {onHand}</span>
  <span className="text-warning">Reserved: {reserved}</span>
  <span className="text-success">Available: {available}</span>
</div>
```

#### Step 6: Integration Points (0.5 day)

**A. Sales Order Form - Availability Check**

Show available quantity when selecting products:

```typescript
const available = await reservationsService.getAvailableQuantity(productId, variantId, locationId);
```

**B. Sales Order Confirmation - Auto Reserve**

Handled in Step 4.

**C. Sales Order Cancellation - Release Reservations**

```typescript
async cancelOrder(id: string, reason: string): Promise<SalesOrder> {
  // Release all reservations
  await reservationsService.releaseForSalesOrder(id, userId);

  // Update order status
  const { data, error } = await supabase
    .from('sales_orders')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: userId,
      cancellation_reason: reason
    })
    .eq('id', id)
    .select()
    .single();

  return data;
}
```

**D. Order Fulfillment - Release Reservations**

When creating movement type 201 (Goods Issue for Sales Order):

```typescript
async fulfillOrder(id: string): Promise<SalesOrder> {
  // Create movement 201 for each item
  // This will decrease stock

  // Release reservations (stock already decreased)
  await reservationsService.releaseForSalesOrder(id, userId);

  // Update order status
  // ...
}
```

#### Step 7: Scheduled Jobs (0.25 day)

**Cron Job:** Release expired reservations

```typescript
// Run daily
async function releaseExpiredReservations() {
  const count = await reservationsService.releaseExpiredReservations();
  console.log(`Released ${count} expired reservations`);
}
```

---

## 🧪 Testing Strategy

### Unit Tests

1. **Product-Supplier Service Tests**
   - Add/remove suppliers
   - Set preferred supplier
   - Validate unique constraints

2. **Sales Orders Service Tests**
   - Order creation with items
   - Total calculations
   - Status transitions
   - Validation rules

3. **Reservations Service Tests**
   - Reserve/release operations
   - Available quantity calculations
   - Expiry handling
   - Sales order integration

### Integration Tests

1. **Order Confirmation Flow**
   - Create order → Confirm → Check reservations created
   - Verify available quantity decreases

2. **Order Cancellation Flow**
   - Create order → Confirm → Cancel → Check reservations released
   - Verify available quantity increases

3. **Order Fulfillment Flow**
   - Create order → Confirm → Fulfill → Check stock decreased
   - Verify reservations released

### Manual Testing Scenarios

1. **Product-Supplier**
   - Add multiple suppliers to product
   - Set preferred supplier
   - View supplier details in product page

2. **Sales Orders**
   - Create walk-in customer order
   - Create order for existing customer
   - Add/remove line items
   - Apply discounts and shipping
   - Submit for approval
   - Confirm order (check reservations)
   - Cancel order (check reservations released)

3. **Stock Reservations**
   - Create manual reservation
   - Try to reserve more than available (should fail)
   - View reserved quantities in inventory
   - Release manual reservation
   - Check expiry handling

4. **Overselling Prevention**
   - Create order for 100 units
   - Confirm order (100 units reserved)
   - Try to create another order for 50 units of same product
   - Should fail or show only available quantity

---

## 📊 Success Criteria

### Phase 0: Product-Supplier Integration ✅

- [ ] Products can have multiple suppliers
- [ ] Supplier-specific data tracked (SKU, price, lead time, MOQ)
- [ ] UI for managing product-supplier relationships
- [ ] Preferred supplier can be set
- [ ] Data migration from old `preferred_business_account_id` complete

### Phase 1: Sales Orders ✅

- [ ] Sales orders can be created with line items
- [ ] Order totals calculate correctly
- [ ] Order status workflow implemented
- [ ] Customer information captured
- [ ] Delivery address support
- [ ] Order number auto-generated
- [ ] UI for creating, viewing, editing orders
- [ ] Orders can be confirmed, processed, fulfilled, cancelled

### Phase 2: Stock Reservations ✅

- [ ] Stock auto-reserved on order confirmation
- [ ] Available quantity = on_hand - reserved
- [ ] Overselling prevented (can't confirm order if insufficient stock)
- [ ] Reservations released on order cancellation
- [ ] Reservations released on order fulfillment
- [ ] Manual reservations can be created
- [ ] Expired reservations automatically released
- [ ] Reservation status visible in inventory views
- [ ] Sales order items linked to reservations

---

## 📝 Implementation Checklist

### Phase 0: Product-Supplier Integration

- [ ] Create `product_suppliers` table migration
- [ ] Migrate existing `preferred_business_account_id` data
- [ ] Create TypeScript types
- [ ] Implement service layer
- [ ] Add supplier dropdown to product form
- [ ] Create suppliers tab in product details
- [ ] Test supplier relationships
- [ ] Update documentation

### Phase 1: Sales Orders

- [ ] Create `sales_orders` and `sales_order_items` tables
- [ ] Create TypeScript types
- [ ] Implement service layer with status transitions
- [ ] Create orders list page
- [ ] Create order form (create/edit)
- [ ] Create order details page
- [ ] Implement server actions
- [ ] Add to warehouse module navigation
- [ ] Test order workflow
- [ ] Update documentation

### Phase 2: Stock Reservations

- [ ] Enhance `stock_reservations` table
- [ ] Create `product_available_inventory` view
- [ ] Create TypeScript types
- [ ] Implement reservations service
- [ ] Integrate auto-reserve on order confirmation
- [ ] Integrate release on cancellation
- [ ] Integrate release on fulfillment
- [ ] Create reservations list page
- [ ] Create manual reservation dialog
- [ ] Add availability indicators to UI
- [ ] Implement expiry job
- [ ] Test reservation flows
- [ ] Test overselling prevention
- [ ] Update documentation

---

## 🚀 Deployment Notes

### Database Migrations Order

1. `YYYYMMDDHHMMSS_create_product_suppliers.sql`
2. `YYYYMMDDHHMMSS_create_sales_orders.sql`
3. `YYYYMMDDHHMMSS_enhance_stock_reservations.sql`

### Feature Flags (Optional)

Consider feature flags for gradual rollout:

- `enable_sales_orders`
- `enable_auto_reservations`
- `enable_manual_reservations`

### Monitoring

Track metrics:

- Sales orders created per day
- Average order value
- Reservations created/released
- Overselling prevention events (failed confirmations)
- Expired reservations released

---

## 📚 Related Documentation

- [STOCK_MOVEMENTS_SPECIFICATION.md](STOCK_MOVEMENTS_SPECIFICATION.md) - Movement type 501-502 details
- [REMAINING_MOVEMENTS_IMPLEMENTATION_PLAN.md](REMAINING_MOVEMENTS_IMPLEMENTATION_PLAN.md) - Overall roadmap
- [README.md](README.md) - Current status and navigation

---

**Last Updated:** November 12, 2024
**Status:** Ready for Implementation
**Next Review:** After Phase 0 completion
